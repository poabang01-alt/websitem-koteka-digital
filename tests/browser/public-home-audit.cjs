// Run with: node tests/browser/public-home-audit.cjs
// Uses an isolated browser and intercepted APIs; never changes published content.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.KOTEKA_TEST_URL || 'http://127.0.0.1:8000';
const failures = [];

async function check(name, run) {
  if (process.env.KOTEKA_PUBLIC_ONLY && name.startsWith('admin ')) return;
  if (process.env.KOTEKA_TEST_FILTER && !name.includes(process.env.KOTEKA_TEST_FILTER)) return;
  try { await run(); console.log('PASS ' + name); }
  catch (error) { failures.push(name); console.error('FAIL ' + name + ': ' + error.message); }
}

async function fixture(browser, content = {}, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  let snapshot = structuredClone(content), version = 1;
  await context.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let json = {};
    if (path === '/api/workspace-content') {
      if (route.request().method() === 'PUT') {
        snapshot = route.request().postDataJSON().content;
        version++;
      }
      json = { content: snapshot, version };
    } else if (path === '/api/admin-session') {
      json = { authenticated: true, user: { id: 'test', name: 'Test Admin', email: 'test@example.invalid', role: 'admin', active: true, version: 1 } };
    } else if (path === '/api/inbox') json = { items: [], unread: 0 };
    await route.fulfill({ json });
  });
  const page = await context.newPage();
  return { context, page, snapshot: () => snapshot };
}

async function atSection(page, id) {
  try { await page.waitForFunction(id => {
    const target = document.getElementById(id);
    if (!target || target.closest('[aria-busy="true"]')) return false;
    const top = target.getBoundingClientRect().top;
    return window.scrollY > 0 && top >= -5 && top < 160;
  }, id, { timeout: 12000 }); } catch (error) {
    const state = await page.evaluate(id => ({ id, hash: location.hash, scrollY, top: document.getElementById(id)?.getBoundingClientRect().top, pending: [...document.querySelectorAll('main .deferred-section')].map(el => ({ id: el.id, busy: el.getAttribute('aria-busy'), placeholder: !!el.querySelector('.section-placeholder') })) }), id);
    throw new Error(error.message + ' ' + JSON.stringify(state));
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    await check('performance: the offscreen hero pauses image rotation and resumes on Home', async () => {
      const { context, page } = await fixture(browser);
      try {
        await page.goto(origin);
        await page.locator('.hero-carousel-image.is-active').waitFor();
        await page.locator('.nav-menu-desktop a[href="#kontak"]').click();
        await atSection(page, 'kontak');
        const first = await page.locator('.hero-carousel-image.is-active').getAttribute('src');
        await page.waitForTimeout(5500);
        assert.equal(await page.locator('.hero-carousel-image.is-active').getAttribute('src'), first);
        await page.locator('.site-header .brand').evaluate(el => el.click());
        await page.waitForFunction(first => document.querySelector('.hero-carousel-image.is-active')?.getAttribute('src') !== first, first, { timeout: 7000 });
      } finally { await context.close(); }
    });
    await check('performance: unchanged admin analytics do not redraw charts but changed data still updates', async () => {
      const { context, page } = await fixture(browser);
      let visits = [], activities = [];
      await context.route('**/api/admin-session', route => route.fulfill({ json: {
        authenticated: true, user: { id: 'test', name: 'Test', email: 'test@example.invalid', role: 'super_admin', active: true, version: 1 }
      } }));
      await context.route('**/api/visits', route => route.fulfill({ json: { items: visits, truncated: false } }));
      await context.route('**/api/admin-activity', route => route.fulfill({ json: { items: activities } }));
      await context.addInitScript(() => {
        const interval = window.setInterval;
        window.auditAnalyticsEvents = { traffic: 0, activities: 0 };
        window.addEventListener('koteka:server-traffic', () => window.auditAnalyticsEvents.traffic++);
        window.addEventListener('koteka:server-activities', () => window.auditAnalyticsEvents.activities++);
        window.setInterval = function (callback, delay, ...args) {
          if (delay === 15000) {
            window.auditAnalyticsPoll = callback;
            return interval(() => {}, delay);
          }
          return interval(callback, delay, ...args);
        };
      });
      try {
        await page.goto(origin + '/admin/#dashboard');
        await page.waitForFunction(() => window.auditAnalyticsEvents.activities === 1);
        await page.evaluate(() => window.auditAnalyticsPoll());
        assert.deepEqual(await page.evaluate(() => window.auditAnalyticsEvents), { traffic: 1, activities: 1 });
        visits = [{ id: 'visit', date: '2026-10-28', page: '/', views: 2, channel: 'Direct', device: 'Desktop' }];
        activities = [{ id: 'activity', date: '2026-10-28', module: 'Konten', description: 'Updated', user: { name: 'Test' } }];
        await page.evaluate(() => window.auditAnalyticsPoll());
        assert.deepEqual(await page.evaluate(() => window.auditAnalyticsEvents), { traffic: 2, activities: 2 });
        await page.evaluate(async () => {
          window.dispatchEvent(new Event('koteka:session-expired'));
          await window.auditAnalyticsPoll();
        });
        assert.deepEqual(await page.evaluate(() => window.auditAnalyticsEvents), { traffic: 3, activities: 3 });
      } finally { await context.close(); }
    });
    await check('performance: admin brand images use the existing small optimized logo', async () => {
      const { context, page } = await fixture(browser);
      let originalLogoRequests = 0;
      page.on('request', request => { if (new URL(request.url()).pathname === '/img/koteka-digital-logo-jayapura-papua.png') originalLogoRequests++; });
      try {
        await page.goto(origin + '/admin/#dashboard');
        await page.locator('#appShell:not([hidden])').waitFor();
        await page.waitForFunction(() => [...document.querySelectorAll('#loginScreen .login-logo img,#sidebar .brand img')].every(img => img.complete && img.naturalWidth > 0));
        assert.equal(originalLogoRequests, 0);
      } finally { await context.close(); }
    });
    await check('performance: content reads reuse the snapshot while updates and Draft filtering stay correct', async () => {
      const { context, page } = await fixture(browser, {
        home: { heading: 'Original' },
        teamMembers: [{ name: 'Published', status: 'Publik' }, { name: 'Private', status: 'Draft' }]
      });
      try {
        await page.goto(origin);
        await page.locator('.hero-section').waitFor();
        const result = await page.evaluate(() => {
          const ws = window.KotekaWorkspace, key = ws.keys.public;
          const raw = localStorage.getItem(key), parse = JSON.parse;
          let fullParses = 0;
          JSON.parse = function (value, ...args) {
            if (value === raw) fullParses++;
            return parse.call(this, value, ...args);
          };
          try {
            for (let i = 0; i < 100; i++) ws.get('home', {});
            const home = ws.get('home', {});
            home.heading = 'Uncommitted';
            const unchanged = ws.get('home', {}).heading;
            const publicNames = ws.get('teamMembers', []).map(item => item.name);
            history.replaceState(null, '', '/admin/');
            const editorNames = ws.get('teamMembers', []).map(item => item.name);
            history.replaceState(null, '', '/');
            const restoredNames = ws.get('teamMembers', []).map(item => item.name);
            localStorage.setItem(key, JSON.stringify({ home: { heading: 'Updated' } }));
            return { fullParses, unchanged, publicNames, editorNames, restoredNames, updated: ws.get('home', {}).heading };
          } finally { JSON.parse = parse; }
        });
        assert.ok(result.fullParses <= 3, 'unchanged content should not be parsed on every read: ' + result.fullParses);
        assert.equal(result.unchanged, 'Original');
        assert.deepEqual(result.publicNames, ['Published']);
        assert.deepEqual(result.editorNames, ['Published', 'Private']);
        assert.deepEqual(result.restoredNames, ['Published']);
        assert.equal(result.updated, 'Updated');
      } finally { await context.close(); }
    });
    await check('performance: a failed local publish preserves the last successful content', async () => {
      const { context, page } = await fixture(browser, { home: { heading: 'Original' } });
      try {
        await page.goto(origin);
        await page.locator('.hero-section').waitFor();
        const result = await page.evaluate(() => {
          const ws = window.KotekaWorkspace, setItem = Storage.prototype.setItem;
          const before = localStorage.getItem(ws.keys.public);
          ws.get('home', {});
          let rejected = false, failed = false;
          Storage.prototype.setItem = function (key, value) {
            if (this === localStorage && key === ws.keys.public && !rejected) {
              rejected = true;
              throw new DOMException('Storage full', 'QuotaExceededError');
            }
            return setItem.call(this, key, value);
          };
          try { ws.commit({ home: { heading: 'Unsaved' } }, 'home'); }
          catch { failed = true; }
          finally { Storage.prototype.setItem = setItem; }
          return { failed, unchanged: localStorage.getItem(ws.keys.public) === before, heading: ws.get('home', {}).heading };
        });
        assert.deepEqual(result, { failed: true, unchanged: true, heading: 'Original' });
      } finally { await context.close(); }
    });
    await check('performance: the main public stylesheet is requested only once', async () => {
      const { context, page } = await fixture(browser);
      let requests = 0;
      page.on('request', request => { if (new URL(request.url()).pathname === '/assets/appBoot-6l2zS1Ny.css') requests++; });
      try {
        await page.goto(origin);
        await page.locator('.hero-section').waitFor();
        assert.equal(requests, 1);
      } finally { await context.close(); }
    });
    await check('performance: admin icons update new content without rescanning the document', async () => {
      const { context, page } = await fixture(browser);
      try {
        await page.goto(origin + '/admin/#dashboard');
        await page.locator('#appShell:not([hidden])').waitFor();
        await page.waitForLoadState('networkidle');
        const scans = await page.evaluate(async () => {
          const query = Document.prototype.querySelectorAll;
          let scans = 0;
          Document.prototype.querySelectorAll = function (selector) {
            if (selector === 'i.fa-solid') scans++;
            return query.call(this, selector);
          };
          try {
            const host = document.createElement('div');
            host.id = 'audit-new-icons';
            host.innerHTML = '<i class="fa-solid fa-house"></i><span>Counter</span>';
            document.body.append(host);
            for (let i = 0; i < 10; i++) {
              host.querySelector('span').textContent = String(i);
              await new Promise(requestAnimationFrame);
            }
            if (!host.querySelector('svg.fa-house')) throw new Error('new icon was not converted');
            return scans;
          } finally { Document.prototype.querySelectorAll = query; }
        });
        assert.equal(scans, 0, 'updates should inspect added elements instead of the full document');
      } finally { await context.close(); }
    });
    await check('performance: background admin tabs pause inbox polling and resume when visible', async () => {
      const { context, page } = await fixture(browser);
      await context.addInitScript(() => {
        const interval = window.setInterval;
        window.setInterval = function (callback, delay, ...args) {
          if (delay === 8000) {
            window.auditInboxPoll = callback;
            return interval(() => {}, delay);
          }
          return interval(callback, delay, ...args);
        };
      });
      let requests = 0;
      page.on('request', request => { if (new URL(request.url()).pathname === '/api/inbox') requests++; });
      try {
        await page.goto(origin + '/admin/#dashboard');
        await page.locator('#appShell:not([hidden])').waitFor();
        await page.waitForLoadState('networkidle');
        const before = requests;
        await page.evaluate(async () => {
          Object.defineProperty(document, 'hidden', { configurable: true, value: true });
          await window.auditInboxPoll();
        });
        assert.equal(requests, before, 'a hidden tab should not poll the inbox');
        await page.evaluate(() => {
          Object.defineProperty(document, 'hidden', { configurable: true, value: false });
          document.dispatchEvent(new Event('visibilitychange'));
        });
        await page.waitForResponse(response => new URL(response.url()).pathname === '/api/inbox');
        assert.equal(requests, before + 1);
      } finally { await context.close(); }
    });
    await check('public audit: page menus switch without reloading the document and Back restores the page', async () => {
      const { context, page } = await fixture(browser);
      try {
        await page.goto(origin);
        await page.locator('.nav-menu-desktop').waitFor();
        await page.evaluate(() => { window.auditDocument = 'same-document'; });
        for (const path of ['/portofolio/', '/blog/', '/layanan/']) {
          if (path === '/layanan/') {
            await page.locator('.nav-menu-desktop .nav-button').filter({ hasText: 'Layanan' }).click();
          } else {
            await page.locator(`.nav-menu-desktop a[href="${path}"]`).click();
          }
          await page.waitForURL(url => url.pathname.replace(/\/$/, '') === path.replace(/\/$/, ''));
          await page.locator('.route-page').waitFor();
          assert.equal(await page.evaluate(() => window.auditDocument), 'same-document');
          assert.ok(await page.locator('.route-page h1').isVisible());
        }
        await page.goBack();
        await page.locator('.route-blog-page').waitFor();
        await page.locator('.site-header .brand').click();
        await page.locator('.hero-section').waitFor();
        await page.waitForFunction(() => scrollY === 0);
        assert.equal(await page.evaluate(() => window.auditDocument), 'same-document');
      } finally { await context.close(); }
    });
    await check('public audit: mobile sidebar animates in and close preserves the current scroll position', async () => {
      const { context, page } = await fixture(browser, {}, { width: 390, height: 844 });
      try {
        await page.goto(origin + '/#about');
        await atSection(page, 'about');
        await page.mouse.wheel(0, -40);
        await page.waitForFunction(() => !document.querySelector('.site-header').classList.contains('header-hidden'));
        const before = await page.evaluate(() => scrollY);
        const hamburger = await page.locator('.hamburger').boundingBox();
        await page.mouse.click(hamburger.x + hamburger.width / 2, hamburger.y + hamburger.height / 2);
        const entering = await page.locator('.nav-menu-mobile').evaluate(el => {
          const animation = el.getAnimations().find(animation => animation.effect.getKeyframes().some(frame => frame.transform));
          if (!animation) return false;
          animation.pause();
          animation.currentTime = 0;
          const start = el.getBoundingClientRect().left;
          animation.finish();
          return start > el.getBoundingClientRect().left + 100;
        });
        assert.ok(entering, 'sidebar should slide into place when first mounted');
        await page.locator('.mobile-close').click();
        await page.locator('.nav-menu-mobile').waitFor({ state: 'detached' });
        assert.ok(Math.abs(await page.evaluate(() => scrollY) - before) < 3);
        await page.locator('.hamburger').click();
        await page.keyboard.press('Escape');
        await page.locator('.nav-menu-mobile').waitFor({ state: 'detached' });
        assert.equal(await page.locator('.hamburger').getAttribute('aria-expanded'), 'false');
      } finally { await context.close(); }
    });
    await check('desktop cold navigation reaches About while later sections stay deferred', async () => {
      const { context, page } = await fixture(browser);
      try {
        await page.goto(origin);
        await page.locator('.nav-menu-desktop a[href="#about"]').click();
        await atSection(page, 'about');
      } finally { await context.close(); }
    });
    await check('all home section links, dropdowns and the Home return reach their targets', async () => {
      const { context, page } = await fixture(browser);
      try {
        for (const id of ['pricing-section', 'testimoni', 'faq', 'kontak', 'portfolio']) {
          await page.goto(origin);
          if (id === 'testimoni') {
            await page.locator('.nav-menu-desktop .nav-button').filter({ hasText: 'Info' }).click();
            await atSection(page, id);
            continue;
          }
          if (id === 'faq') await page.locator('.nav-menu-desktop .nav-button').filter({ hasText: 'Info' }).hover();
          const selector = id === 'portfolio' ? '.hero-portfolio-button' : `.nav-menu-desktop a[href="#${id}"]`;
          await page.locator(selector).click();
          await atSection(page, id);
          assert.equal(new URL(page.url()).hash, '#' + id);
        }
        await page.locator('.site-header .brand').evaluate(el => el.click());
        await page.waitForFunction(() => window.scrollY === 0 && !location.hash);
        for (const path of ['/layanan/', '/portofolio/', '/blog/']) {
          await page.goto(origin);
          const link = page.locator(`.nav-menu-desktop a[href="${path}"]`);
          if (path === '/layanan/') await page.locator('.nav-menu-desktop .nav-button').filter({ hasText: 'Layanan' }).click();
          else await link.click();
          await page.waitForURL(url => url.pathname.replace(/\/$/, '') === path.replace(/\/$/, ''), { waitUntil: 'domcontentloaded' });
          await page.locator('.route-page').waitFor();
        }
      } finally { await context.close(); }
    });
    await check('direct section URL and browser Back reach the matching section', async () => {
      const { context, page } = await fixture(browser);
      try {
        await page.goto(origin + '/#faq');
        await atSection(page, 'faq');
        await page.locator('.site-header .brand').evaluate(el => el.click());
        await page.waitForFunction(() => window.scrollY === 0);
        await page.locator('.nav-menu-desktop a[href="#about"]').click();
        await atSection(page, 'about');
        await page.locator('.nav-menu-desktop a[href="#kontak"]').evaluate(el => el.click());
        await atSection(page, 'kontak');
        await page.goBack();
        await atSection(page, 'about');
      } finally { await context.close(); }
    });
    await check('mobile menu reaches Contact from a fresh home', async () => {
      const { context, page } = await fixture(browser, {}, { width: 390, height: 844 });
      try {
        await page.goto(origin);
        await page.locator('.hamburger').click();
        await page.locator('.nav-menu-mobile a[href="#kontak"]').click();
        await atSection(page, 'kontak');
        await page.waitForFunction(() => !document.body.classList.contains('menu-open'));
      } finally { await context.close(); }
    });
    await check('published welcome retains a blue bold Koteka Digital brand', async () => {
      const { context, page } = await fixture(browser, { home: { eyebrow: 'Selamat datang di Koteka Digital', background: '/img/hero/hero-frontend-stack.webp' } });
      try {
        await page.goto(origin);
        const brand = page.locator('.hero-welcome strong.kd-welcome-brand');
        await brand.waitFor({ timeout: 8000 });
        const style = await brand.evaluate(el => ({ color: getComputedStyle(el).color, weight: Number(getComputedStyle(el).fontWeight) }));
        assert.equal(style.color, 'rgb(35, 115, 244)');
        assert.ok(style.weight >= 700);
        if (process.env.KOTEKA_SCREENSHOTS) {
          await page.waitForTimeout(3500);
          await page.screenshot({ path: 'storage/app/audit-public-home-desktop.png' });
        }
      } finally { await context.close(); }
    });
    await check('legacy admin background keeps at least four automatic slides', async () => {
      const { context, page } = await fixture(browser, { home: { background: '/img/hero/hero-frontend-stack.webp' } });
      try {
        await page.goto(origin);
        await page.locator('.hero-carousel-image.is-active').waitFor();
        assert.ok(await page.locator('.hero-carousel-image').count() >= 4);
        const first = await page.locator('.hero-carousel-image.is-active').getAttribute('src');
        await page.waitForFunction(first => document.querySelector('.hero-carousel-image.is-active')?.getAttribute('src') !== first, first, { timeout: 8000 });
      } finally { await context.close(); }
    });
    await check('custom gallery uses uploaded URL directly, skips Draft and broken images, and loops', async () => {
      const gallery = [
        { _id: 'broken', title: 'Broken', image: '/missing-hero.webp', status: 'Publik' },
        { _id: 'one', title: 'One', image: '/api/koteka-media/test-image', status: 'Publik' },
        { _id: 'draft', title: 'Draft', image: '/img/owner.jpg', status: 'Draft' },
        { _id: 'two', title: 'Two', image: '/img/hero/hero-backend-architecture.webp', status: 'Publik' }
      ];
      const { context, page } = await fixture(browser, { heroSlides: gallery });
      await context.route('**/api/koteka-media/test-image', route => route.fulfill({ path: 'public/img/hero/hero-frontend-stack.webp', contentType: 'image/webp' }));
      try {
        await page.goto(origin);
        await page.waitForFunction(() => [...document.querySelectorAll('.hero-carousel-image')].some(el => el.getAttribute('src') === '/api/koteka-media/test-image'));
        assert.equal(await page.locator('.hero-carousel-image[alt="Draft"]').count(), 0);
        await page.waitForFunction(() => document.querySelector('.hero-carousel-image.is-active')?.getAttribute('alt') === 'Two', null, { timeout: 17000 });
        await page.waitForFunction(() => document.querySelector('.hero-carousel-image.is-active')?.getAttribute('alt') === 'One', null, { timeout: 17000 });
        assert.equal(await page.locator('.hero-carousel-image[alt="One"]').getAttribute('srcset'), null);
      } finally { await context.close(); }
    });
    await check('reduced motion still recovers a broken first image without automatic rotation', async () => {
      const { context, page } = await fixture(browser, { heroSlides: [
        { image: '/missing-hero.webp', title: 'Missing' },
        { image: '/img/hero/hero-frontend-stack.webp', title: 'Valid' },
        { image: '/img/hero/hero-backend-architecture.webp', title: 'Next' }
      ] });
      try {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto(origin);
        await page.waitForFunction(() => document.querySelector('.hero-carousel-image.is-active')?.alt === 'Valid', null, { timeout: 5000 });
        await page.waitForTimeout(5500);
        assert.equal(await page.locator('.hero-carousel-image.is-active').getAttribute('alt'), 'Valid');
      } finally { await context.close(); }
    });
    await check('admin Home adds, edits and deletes gallery images through the existing publishing flow', async () => {
      const { context, page, snapshot } = await fixture(browser, { home: { background: '/img/hero/hero-frontend-stack.webp' } });
      await context.route('**/api/koteka-media', route => route.fulfill({ json: { url: '/api/koteka-media/audit-upload' } }));
      try {
        await page.goto(origin + '/admin/#home');
        await page.locator('[data-action="add"][data-collection="heroSlides"]').click();
        await page.locator('#f_title').fill('Gambar audit');
        await page.locator('[data-upload="image"]').setInputFiles('public/img/hero/hero-backend-architecture.webp');
        await page.locator('#editForm button[type="submit"]').click();
        await page.waitForFunction(() => window.KotekaWorkspace.get('heroSlides', []).some(x => x.title === 'Gambar audit'));
        await page.waitForTimeout(800);
        assert.ok(snapshot().heroSlides.some(x => x.title === 'Gambar audit'));
        assert.equal(snapshot().heroSlides.find(x => x.title === 'Gambar audit').image, '/api/koteka-media/audit-upload');
        const card = page.locator('#section-heroSlides .content-card').filter({ hasText: 'Gambar audit' });
        await card.locator('[data-action="edit"]').click();
        await page.locator('#f_title').fill('Gambar diperbarui');
        await page.locator('#editForm button[type="submit"]').click();
        await page.locator('#section-heroSlides .content-card').filter({ hasText: 'Gambar diperbarui' }).locator('[data-action="delete"]').click();
        await page.locator('#approveDelete').click();
        await page.waitForTimeout(800);
        assert.ok(!snapshot().heroSlides.some(x => x.title === 'Gambar diperbarui'));
        assert.ok(snapshot().heroSlides.length >= 4);
        if (process.env.KOTEKA_SCREENSHOTS) await page.screenshot({ path: 'storage/app/audit-public-home-admin.png', fullPage: true });
      } finally { await context.close(); }
    });
  } finally { await browser.close(); }
  if (failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
