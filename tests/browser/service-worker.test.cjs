const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

function worker() {
  const handlers = {}, stores = new Map(), requests = [];
  let offline = false;
  const key = request => typeof request === 'string' ? request : request.url;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async match(request) { return store.get(key(request))?.clone(); },
        async put(request, response) { store.set(key(request), response.clone()); },
        async keys() { return [...store.keys()].map(url => ({ url })); },
        async delete(request) { return store.delete(key(request)); },
        async addAll() {}
      };
    },
    async match(request) {
      for (const store of stores.values()) {
        if (store.has(key(request))) return store.get(key(request)).clone();
      }
    }
  };
  const sandbox = {
    URL, Response, caches,
    self: {
      location: { origin: 'https://example.invalid' },
      registration: { scope: 'https://example.invalid/' },
      addEventListener: (type, handler) => { handlers[type] = handler; }
    },
    async fetch(request) {
      requests.push(key(request));
      if (offline) throw new Error('Offline');
      return new Response('new asset');
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync('public/sw.js', 'utf8'), sandbox);
  return {
    requests,
    setOffline() { offline = true; },
    async seed(path) {
      const name = vm.runInContext('STATIC_CACHE', sandbox);
      const cache = await caches.open(name);
      await cache.put('https://example.invalid' + path, new Response('old asset'));
    },
    async request(path) {
      let response;
      handlers.fetch({
        request: { method: 'GET', mode: 'cors', url: 'https://example.invalid' + path },
        respondWith(value) { response = value; },
        waitUntil() {}
      });
      return response;
    }
  };
}

test('mutable CSS and JS refresh even when an old worker cache entry exists', async () => {
  for (const path of ['/assets/koteka-public-mobile-audit-20261023.css', '/assets/kd-icons-loader-20261010.js', '/assets/koteka-editorial20.css', '/assets/koteka-server-analytics.js', '/assets/home-critical.css']) {
    const app = worker();
    await app.seed(path);

    const response = await app.request(path);

    assert.equal(await response.text(), 'new asset');
    assert.equal(app.requests.length, 1);
  }
});

test('generated hashed assets reuse a warm cache without another download', async () => {
  for (const path of ['/assets/appBoot-634c31a5ba.js', '/assets/react-DHmoMYoq.js', '/assets/ContactSectionContainer-DXOfP6-K.js']) {
    const app = worker();
    await app.seed(path);

    const response = await app.request(path);

    assert.equal(await response.text(), 'old asset');
    assert.equal(app.requests.length, 0);
  }
});

test('mutable assets still load from cache when offline', async () => {
  const app = worker();
  const path = '/assets/koteka-public-mobile-audit-20261023.css';
  await app.seed(path);
  app.setOffline();

  const response = await app.request(path);

  assert.equal(await response.text(), 'old asset');
});

test('the worker never handles authenticated APIs or admin assets', async () => {
  const app = worker();

  for (const path of ['/api/workspace-content', '/api/koteka-media/example', '/admin/app.js']) {
    assert.equal(await app.request(path), undefined);
  }
  assert.equal(app.requests.length, 0);
});
