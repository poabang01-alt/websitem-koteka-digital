const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

const storage = () => {
  const entries = new Map();
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
};

test('missing API never permits a demo login', async () => {
  const sessionStorage = storage();
  const sandbox = {
    window: { location: { hostname: 'localhost' }, addEventListener() {}, dispatchEvent() {} },
    document: { querySelector: () => null }, sessionStorage, localStorage: storage(),
    fetch: async () => new Response('{}', { status: 503 }), Response, crypto: require('node:crypto').webcrypto,
    TextEncoder, navigator: {},
  };
  vm.runInNewContext(readFileSync('public/admin/access.js', 'utf8'), sandbox);
  const res = await sandbox.window.KotekaAccess.loginResponse('superadmin@kotekadigital.com', 'KotekaDemo@2026');
  assert.equal(res.status, 503);
  assert.equal(sandbox.window.KotekaAccess.user, null);
});

test('failed server publication never changes the published browser snapshot', async () => {
  const localStorage = storage();
  localStorage.setItem('koteka.public.content.v1', JSON.stringify({ faqs: [{ _id: 'keep' }] }));
  const sandbox = {
    window: { addEventListener() {}, KotekaLaravel: { saveContent: async () => { throw Error('Conflict'); } } },
    localStorage, location: { pathname: '/admin/' }, URL, URLSearchParams, structuredClone,
  };
  vm.runInNewContext(readFileSync('public/assets/koteka-workspace-sync.js', 'utf8'), sandbox);
  await assert.rejects(() => sandbox.window.KotekaWorkspace.commit({ faqs: [] }, 'faqs'), /Conflict/);
  assert.equal(JSON.parse(localStorage.getItem('koteka.public.content.v1')).faqs.length, 1);
});

test('successful publication finishes on the server before notifying subscribers', async () => {
  const localStorage = storage(), events = [];
  localStorage.setItem('koteka.public.content.v1', '{}');
  const sandbox = {
    window: { addEventListener() {}, KotekaLaravel: { saveContent: async content => { events.push('server'); return content; } } },
    localStorage, location: { pathname: '/admin/' }, URL, URLSearchParams, structuredClone,
  };
  vm.runInNewContext(readFileSync('public/assets/koteka-workspace-sync.js', 'utf8'), sandbox);
  sandbox.window.KotekaWorkspace.subscribe(() => events.push('subscriber'));
  await sandbox.window.KotekaWorkspace.commit({ faqs: [] }, 'faqs');
  assert.deepEqual(events, ['server', 'subscriber']);
  assert.deepEqual(JSON.parse(localStorage.getItem('koteka.public.content.v1')), { faqs: [] });
});

test('reloading after an initial API failure allows saving with the recovered version', async () => {
  let calls = 0;
  const localStorage = storage();
  const nativeFetch = async (path, options = {}) => {
    calls++;
    if (calls === 1) return new Response('{}', { status: 503 });
    if (options.method === 'PUT') {
      assert.equal(JSON.parse(options.body).version, 7);
      return Response.json({ version: 8, content: { faqs: [] } });
    }
    return Response.json({ version: 7, content: { faqs: [] } });
  };
  const sandbox = {
    window: { fetch: nativeFetch, dispatchEvent() {}, KotekaAccess: { user: { id: 'admin' } } },
    document: { querySelector: () => ({ content: 'csrf-token' }) },
    localStorage, location: { pathname: '/admin/', origin: 'http://localhost', href: 'http://localhost/admin/' },
    URL, Request, Headers, StorageEvent: class {},
  };
  sandbox.fetch = (...args) => sandbox.window.fetch(...args);
  vm.runInNewContext(readFileSync('public/assets/koteka-laravel-bridge.js', 'utf8'), sandbox);
  await new Promise(resolve => setImmediate(resolve));
  await sandbox.window.KotekaLaravel.reload();
  await sandbox.window.KotekaLaravel.saveContent({ faqs: [] });
  assert.equal(sandbox.window.KotekaLaravel.version, 8);
});

test('browser cache failure after server acknowledgement cannot resurrect deleted content', async () => {
  const localStorage = storage(), saved = [];
  localStorage.setItem('koteka.public.content.v1', JSON.stringify({ faqs: [{ _id: 'deleted' }] }));
  const setItem = localStorage.setItem;
  let failOnce = true;
  localStorage.setItem = (key, value) => {
    if (key === 'koteka.public.content.v1' && failOnce) { failOnce = false; throw Error('Quota exceeded'); }
    setItem(key, value);
  };
  const sandbox = {
    window: { addEventListener() {}, KotekaLaravel: { saveContent: async content => { saved.push(structuredClone(content)); return content; } } },
    localStorage, location: { pathname: '/admin/' }, URL, URLSearchParams, structuredClone,
  };
  vm.runInNewContext(readFileSync('public/assets/koteka-workspace-sync.js', 'utf8'), sandbox);
  await sandbox.window.KotekaWorkspace.commit({ faqs: [] }, 'faqs');
  assert.equal(sandbox.window.KotekaWorkspace.get('faqs', null).length, 0);
  await sandbox.window.KotekaWorkspace.commit({ home: { title: 'Next edit' } }, 'home');
  assert.deepEqual(saved[1].faqs, []);
});
