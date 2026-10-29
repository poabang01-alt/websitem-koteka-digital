const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

function carousel() {
  const events = new Map(), documentEvents = new Map(), frames = new Map(), timers = new Map(), intersections = [];
  let clock = 1000, id = 0;
  const cards = [0, 300, 600, 900].map(offsetLeft => ({ offsetLeft }));
  const rail = { isConnected: true, querySelectorAll: () => cards };
  const viewport = {
    isConnected: true, scrollLeft: 0, classList: { add() {}, remove() {} }, contains: () => false,
    querySelector: () => rail,
    addEventListener(type, callback) { if (!events.has(type)) events.set(type, []); events.get(type).push(callback); },
  };
  const document = {
    hidden: false, readyState: 'loading', querySelectorAll: () => [viewport], querySelector: () => viewport,
    addEventListener(type, callback) { documentEvents.set(type, callback); }, removeEventListener() {},
  };
  const motion = { matches: false, addEventListener() {}, removeEventListener() {} };
  const windowEvents = new Map();
  const sandbox = {
    document, performance: { now: () => clock },
    window: { matchMedia: () => motion, addEventListener: (name, callback) => windowEvents.set(name, callback) },
    requestAnimationFrame(callback) { frames.set(++id, callback); return id; }, cancelAnimationFrame: key => frames.delete(key),
    setTimeout(callback, wait) { timers.set(++id, { callback, at: clock + wait }); return id; }, clearTimeout: key => timers.delete(key),
    MutationObserver: class { observe() {} disconnect() {} },
    ResizeObserver: class { observe() {} disconnect() {} },
    IntersectionObserver: class { constructor(callback) { intersections.push(callback); } observe() {} disconnect() {} },
  };
  vm.runInNewContext(readFileSync('public/assets/koteka-audit9-public.js', 'utf8'), sandbox);
  documentEvents.get('DOMContentLoaded')();
  intersections[0]([{ isIntersecting: true, target: viewport }]);
  return {
    frames, timers, viewport, motion,
    fire(type, detail = {}) { for (const callback of events.get(type) || []) callback({ pointerType: 'mouse', ...detail }); },
    tick(ms = 20) { clock += ms; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(cb => cb(clock)); },
    wake(ms = 2000) { clock += ms; for (const [key, timer] of timers) if (timer.at <= clock) { timers.delete(key); timer.callback(); } },
    hidden() { document.hidden = true; documentEvents.get('visibilitychange')(); },
  };
}

test('pricing autoplay sleeps while hovered, focused or touched and resumes on release', () => {
  for (const [pause, resume] of [['pointerenter', 'pointerleave'], ['focusin', 'focusout'], ['touchstart', 'touchend']]) {
    const app = carousel();
    app.tick(); app.tick();
    assert.ok(app.viewport.scrollLeft > 0);
    app.fire(pause);
    assert.equal(app.frames.size, 0, pause + ' must cancel the animation loop');
    app.fire(resume);
    app.wake();
    assert.equal(app.frames.size, 1, resume + ' should resume autoplay');
  }
});

test('wheel pause uses a delayed wake and a hidden document cancels pending work', () => {
  const app = carousel();
  app.fire('wheel');
  assert.equal(app.frames.size, 0);
  assert.equal(app.timers.size, 1);
  app.hidden();
  assert.equal(app.frames.size, 0);
  assert.equal(app.timers.size, 0);
});
