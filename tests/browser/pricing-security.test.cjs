const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

function pricingAction(plan) {
  const downloads = [], opened = [];
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() {}, open: url => opened.push(url) },
    localStorage: { getItem: () => JSON.stringify({ pricingPlans: [plan] }) },
    location: { pathname: '/layanan/' }, URL, URLSearchParams, structuredClone,
    CustomEvent: class {}, encodeURIComponent,
    document: { createElement: () => ({ click() { downloads.push(this.href); } }), body: { appendChild() {}, removeChild() {} } },
    w: { jsx: (component, props) => props }, P() {}, F: [], I: {}, i: '', o: { whatsappNumber: '6281234567890' }, s: [],
  };
  vm.runInNewContext(readFileSync('public/assets/koteka-workspace-sync.js', 'utf8'), sandbox);
  const source = readFileSync('public/assets/PricingSectionContainer-CyXKa1Eh.js', 'utf8');
  const start = source.indexOf('function L()');
  const end = source.indexOf('export', start);
  vm.runInNewContext(source.slice(start, end) + '\nL().handlePricingAction(L().pricingPlans[0]);', sandbox);
  return { downloads, opened, url: sandbox.window.KotekaWorkspace.url };
}

test('legacy pricing records cannot pass script URLs to imperative browser sinks', () => {
  for (const bad of ['javascript:void(0)', 'java\tscript:void(0)', '/\\example.invalid/file', '//example.invalid/file', 'data:text/html,invalid']) {
    const result = pricingAction({ name: 'Plan', download: bad, orderLink: bad });
    assert.deepEqual(result.downloads, []);
    assert.match(result.opened[0], /^https:\/\/wa\.me\/6281234567890\?text=/);
    assert.equal(result.url(bad), '');
  }
});

test('valid PDF downloads and WhatsApp ordering retain their behavior', () => {
  const result = pricingAction({ name: 'Plan', download: '/downloads/paket-basic.pdf', orderLink: 'https://wa.me/6281234567890', whatsappMessage: 'Hello Koteka' });
  assert.deepEqual(result.downloads, ['/downloads/paket-basic.pdf']);
  assert.equal(result.opened[0], 'https://wa.me/6281234567890?text=Hello%20Koteka');
});
