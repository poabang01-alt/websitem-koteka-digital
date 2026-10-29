const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

function runtime(controlled) {
  const events = new Map(), registrations = [], state = { reloads: 0 };
  const sandbox = {
    document: { readyState: 'complete', currentScript: { src: 'https://example.invalid/project/assets/public-runtime.js' } },
    window: { addEventListener: (type, callback) => events.set(type, callback), location: { reload: () => state.reloads++ } },
    navigator: { serviceWorker: {
      controller: controlled ? {} : null,
      addEventListener: (type, callback) => events.set(type, callback),
      register: async (url, options) => { registrations.push({ url: String(url), options }); },
    } }, URL,
  };
  vm.runInNewContext(readFileSync('public/assets/public-runtime.js', 'utf8'), sandbox);
  return { events, registrations, state };
}

test('an existing worker update recovers a stale entry bundle with exactly one reload', () => {
  const app = runtime(true);
  assert.equal(app.registrations[0].url, 'https://example.invalid/project/sw.js');
  assert.equal(app.registrations[0].options.updateViaCache, 'none');
  app.events.get('controllerchange')(); app.events.get('controllerchange')();
  assert.equal(app.state.reloads, 1);
});

test('first installation does not reload the page', () => {
  const app = runtime(false);
  app.events.get('controllerchange')();
  assert.equal(app.state.reloads, 0);
});

test('a worker update preserves a consultation form being edited', () => {
  const app = runtime(true);
  app.events.get('input')({ target: { closest: () => ({}) } });
  app.events.get('controllerchange')();
  assert.equal(app.state.reloads, 0);
});
