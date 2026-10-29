const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

function workspace(role = 'super_admin') {
  const elements = new Map(), windowEvents = new Map(), documentEvents = new Map(), calls = [], cache = new Map();
  const classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
  const element = () => ({ hidden: true, innerHTML: '', value: '', dataset: {}, style: {}, classList, listeners: {},
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); },
    setAttribute() {}, focus() {}, append() {}, prepend() {}, replaceChildren() {}, scrollIntoView() {},
    querySelector: () => element(), querySelectorAll: () => [],
  });
  const get = name => { if (!elements.has(name)) elements.set(name, element()); return elements.get(name); };
  const storage = { getItem: key => cache.get(key) ?? null, setItem: (key, value) => cache.set(key, value), removeItem: key => cache.delete(key) };
  const user = { id: 'test-admin', name: 'Test Admin', role };
  let inbox = [];
  let bridge;
  const sandbox = {
    document: { querySelector: get, querySelectorAll: () => [], addEventListener(name, fn) { if (!documentEvents.has(name)) documentEvents.set(name, []); documentEvents.get(name).push(fn); }, documentElement: { classList }, body: element(), createElement: element, hidden: false },
    window: { addEventListener: (name, fn) => windowEvents.set(name, fn), scrollTo() {},
      KotekaAccess: { user, isSuperAdmin: () => role === 'super_admin', restore: async () => user, record: async () => {},
        request: async (url, options) => { calls.push({ url, options }); return Response.json({ items: url === '/api/inbox' ? inbox : [], unread: 0, ok: true, deleted: 1 }); } },
      KotekaLaravel: { reload: async () => {} }, KotekaServerAnalytics: { refresh: async () => {} },
      KotekaSecurityUI: { connect: value => { bridge = value; }, render() {} }, KotekaFA: { icon: () => '<i></i>' },
    },
    localStorage: storage, sessionStorage: storage, location: { pathname: '/admin/', hash: '#dashboard' },
    URL, URLSearchParams, structuredClone, crypto: require('node:crypto').webcrypto,
    matchMedia: () => ({ matches: false }), requestAnimationFrame() {}, setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {},
  };
  for (const file of ['public/admin/seed.js', 'public/assets/koteka-workspace-sync.js', 'public/admin/app.js']) {
    vm.runInNewContext(readFileSync(file, 'utf8'), sandbox, { filename: file });
  }
  return { elements, get, calls, bridge, windowEvents, documentEvents, setInbox: items => { inbox = items; } };
}

test('Workspace merges real visitor/admin events and sends confirmed row deletion to the server', async () => {
  const view = workspace();
  view.windowEvents.get('koteka:server-traffic')({ detail: { items: [{ id: 'visit-1', date: '2026-10-29T01:00:00Z', page: '/blog/', views: 1, device: 'Desktop' }] } });
  view.windowEvents.get('koteka:server-activities')({ detail: { items: [{ id: 'admin-1', date: '2026-10-29T01:01:00Z', module: 'CMS', description: 'Saved', user: { name: 'Administrator' } }] } });
  view.bridge.go('logs');
  const html = view.get('#mainContent').innerHTML;
  assert.match(html, /visit-1/);
  assert.match(html, /admin-1/);
  assert.match(html, /deleteAllLogs/);
  assert.doesNotMatch(html, /database Laravel|demo lokal/);
  const button = { dataset: { action: 'deleteLog', id: 'visit-1', source: 'visitor' } };
  for (const handler of view.documentEvents.get('click')) {
    handler({ target: { closest: selector => selector === '[data-action]' ? button : null } });
  }
  assert.equal(view.get('#confirmBackdrop').hidden, false);
  await view.get('#approveDelete').listeners.click[0]();
  const deletion = view.calls.find(call => call.url === '/api/activity-logs');
  assert.deepEqual(JSON.parse(deletion.options.body), { scope: 'visitor', ids: ['visit-1'], confirmed: true });
  assert.equal(deletion.options.method, 'DELETE');
});

test('Operator sees visitor logs without privileged delete controls', () => {
  const view = workspace('operator');
  view.bridge.go('logs');
  assert.doesNotMatch(view.get('#mainContent').innerHTML, /deleteAllLogs|data-action="deleteLog"/);
});

test('unchanged inbox polling preserves existing DOM while new messages still render', async () => {
  const view = workspace('admin');
  await new Promise(setImmediate);
  view.bridge.go('inbox');
  await new Promise(setImmediate);
  let writes = 0;
  for (const selector of ['#inboxList', '#kdNotificationDropdown']) {
    const node = view.get(selector);
    let html = node.innerHTML;
    Object.defineProperty(node, 'innerHTML', { get: () => html, set(value) { writes++; html = value; } });
  }
  await view.bridge.loadInbox(true);
  await view.bridge.loadInbox(true);
  assert.equal(writes, 0, 'unchanged polling must not rebuild cards or notification controls');
  view.setInbox([{ id: 1, nama: 'New Customer', pesan: 'A new consultation', date: '2026-10-29T01:00:00Z', read: false }]);
  await view.bridge.loadInbox(true);
  assert.equal(writes, 2);
  assert.match(view.get('#inboxList').innerHTML, /New Customer/);
  assert.match(view.get('#kdNotificationDropdown').innerHTML, /New Customer/);
});
