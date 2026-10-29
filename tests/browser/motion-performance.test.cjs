const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

function fixture({ reduced = false, observer = true } = {}) {
  const events = new Map(), frames = new Map(), observers = [], mutations = [], elements = [];
  let frameId = 0, rootScans = 0;
  const listen = (type, handler) => {
    if (!events.has(type)) events.set(type, []);
    events.get(type).push(handler);
  };
  const element = (kind = 'card') => {
    const classes = new Set();
    const node = {
      nodeType: 1, kind, isConnected: true, style: {}, dataset: {}, animations: [], children: [],
      classList: { add: (...names) => names.forEach(n => classes.add(n)), remove: (...names) => names.forEach(n => classes.delete(n)), toggle(name, value) { value ? classes.add(name) : classes.delete(name); } },
      setAttribute(name, value) { this[name] = value; },
      matches(selector) { return kind === 'section' ? selector.includes('section') : kind === 'wrapper' ? selector.includes('[data-kd-reveal]') : selector.includes('.service-card'); },
      closest() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return this.children; },
      animate(keyframes, options) {
        const animation = { keyframes, options, cancelled: false, cancel() { this.cancelled = true; } };
        this.animations.push(animation);
        return animation;
      },
    };
    elements.push(node);
    return node;
  };
  const card = element();
  const root = { nodeType: 1, isConnected: true, matches: () => false, querySelectorAll() { rootScans++; return [card]; } };
  const motion = { matches: reduced, addEventListener: (name, cb) => listen('motion:' + name, cb) };
  const document = {
    hidden: false, readyState: 'complete', documentElement: { scrollHeight: 2000, classList: { add() {}, toggle() {} } },
    body: { appendChild() {}, scrollHeight: 2000 },
    createElement: () => element('progress'),
    querySelector: selector => selector.includes('#root') ? root : null,
    querySelectorAll() { rootScans++; return [card]; },
    addEventListener: listen,
  };
  const window = {
    scrollY: 0, innerHeight: 700, matchMedia: () => motion, addEventListener: listen,
    dispatchEvent(event) { for (const cb of events.get(event.type) || []) cb(event); },
    requestAnimationFrame(cb) { frames.set(++frameId, cb); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
  };
  class IntersectionObserver {
    constructor(callback) { this.callback = callback; this.targets = new Set(); observers.push(this); }
    observe(node) { this.targets.add(node); }
    unobserve(node) { this.targets.delete(node); }
    disconnect() { this.targets.clear(); }
  }
  if (observer) window.IntersectionObserver = IntersectionObserver;
  class MutationObserver { constructor(callback) { mutations.push(callback); } observe() {} disconnect() {} }
  const sandbox = { window, document, MutationObserver, Event: class { constructor(type) { this.type = type; } }, performance: { now: () => 1000 } };
  if (observer) sandbox.IntersectionObserver = IntersectionObserver;
  sandbox.requestAnimationFrame = window.requestAnimationFrame;
  sandbox.cancelAnimationFrame = window.cancelAnimationFrame;
  vm.runInNewContext(readFileSync('public/assets/kd-37f189b118.js', 'utf8'), sandbox);
  const flush = () => { const queued = [...frames.values()]; frames.clear(); queued.forEach(cb => cb(1000)); };
  const dispatch = (type, detail = {}) => window.dispatchEvent({ type, ...detail });
  flush();
  return {
    card, root, elements, window, document, observers, frames, element, flush, dispatch,
    get rootScans() { return rootScans; },
    intersection(node, visible) { for (const obs of observers) if (obs.targets.has(node)) obs.callback([{ target: node, isIntersecting: visible }]); },
    mutate(record) { mutations.forEach(cb => cb([record])); flush(); },
    reduce() { motion.matches = true; dispatch('motion:change'); },
  };
}

test('one entrance plays on entry and reverses after leaving and scrolling upward', () => {
  const app = fixture();
  assert.equal(app.card.style.opacity, undefined, 'content is visible before observation');
  app.intersection(app.card, true);
  assert.equal(app.card.animations.length, 1);
  assert.match(app.card.animations[0].keyframes[0].translate, /16px/);
  app.intersection(app.card, true);
  assert.equal(app.card.animations.length, 1, 'duplicate notifications do not restart an entrance');
  app.intersection(app.card, false);
  app.window.scrollY = 500; app.dispatch('scroll'); app.flush();
  app.window.scrollY = 100; app.dispatch('scroll'); app.flush();
  app.intersection(app.card, true);
  assert.equal(app.card.animations.length, 2);
  assert.match(app.card.animations[1].keyframes[0].translate, /-16px/);
});

test('reduced motion cancels running entrances and never hides content', () => {
  const app = fixture();
  app.intersection(app.card, true);
  app.reduce();
  assert.equal(app.card.animations[0].cancelled, true);
  app.intersection(app.card, false); app.intersection(app.card, true);
  assert.equal(app.card.animations.length, 1);
  assert.equal(app.card.style.opacity, undefined);
  const initiallyReduced = fixture({ reduced: true });
  initiallyReduced.intersection(initiallyReduced.card, true);
  assert.equal(initiallyReduced.card.animations.length, 0);
});

test('lazy content registers incrementally and detached nodes release observers', () => {
  const app = fixture(), added = app.element();
  const scans = app.rootScans;
  app.mutate({ addedNodes: [added], removedNodes: [] });
  assert.equal(app.rootScans, scans, 'adding a card must not rescan the entire application');
  app.intersection(added, true);
  assert.equal(added.animations.length, 1);
  added.isConnected = false;
  app.mutate({ addedNodes: [], removedNodes: [added] });
  assert.ok(app.observers.every(obs => !obs.targets.has(added)));
  assert.equal(added.animations[0].cancelled, true);
});

test('scroll work is coalesced and a hidden page stops pending animation work', () => {
  const app = fixture();
  for (let i = 0; i < 30; i++) app.dispatch('scroll');
  assert.equal(app.frames.size, 1);
  app.intersection(app.card, true);
  app.document.hidden = true; app.dispatch('visibilitychange');
  assert.equal(app.frames.size, 0);
  assert.equal(app.card.animations[0].cancelled, true);
  app.dispatch('scroll');
  assert.equal(app.frames.size, 0);
});

test('missing observer support leaves all content usable', () => {
  const app = fixture({ observer: false });
  assert.equal(app.card.style.opacity, undefined);
  assert.equal(app.card.animations.length, 0);
});

test('Reveal renders ordinary visible markup without per-component animation observers', () => {
  const text = readFileSync('public/assets/Reveal-a4c48c8478.js', 'utf8');
  const start = text.indexOf('function me('), end = text.indexOf('export{', start);
  const jsx = (tag, props) => ({ tag, props });
  const forbiddenHook = () => { throw new Error('Reveal should delegate motion to the shared controller'); };
  const sandbox = { S: { jsx }, x: forbiddenHook, r: forbiddenHook, C: { useEffect: forbiddenHook, useRef: forbiddenHook, useState: forbiddenHook } };
  vm.runInNewContext(text.slice(start, end) + '\nglobalThis.result=me({children:"Visible content",className:"service-card",as:"article",delay:.08});', sandbox);
  assert.equal(sandbox.result.tag, 'article');
  assert.equal(sandbox.result.props.children, 'Visible content');
  assert.equal(sandbox.result.props['data-kd-reveal'], '');
  vm.runInNewContext(text.slice(start, end) + '\nglobalThis.result=me({children:"Priority content",priority:true});', sandbox);
  assert.equal(sandbox.result.props['data-kd-reveal'], undefined);
  assert.equal(sandbox.result.props['data-kd-motion-disabled'], '');
});

test('Home menu makes one smooth scroll and respects reduced motion', () => {
  const text = readFileSync('public/assets/appBoot-634c31a5ba.js', 'utf8');
  const start = text.indexOf('function ce('), end = text.indexOf('function le(', start);
  for (const reduced of [false, true]) {
    const scrolls = [];
    const sandbox = {
      window: { location: { pathname: '/', search: '', hash: '#kontak' }, history: { replaceState() {} },
        matchMedia: () => ({ matches: reduced }), scrollTo: value => scrolls.push(value), dispatchEvent() {}, requestAnimationFrame() {}, setTimeout() {} },
      document: { documentElement: { classList: { add() {}, remove() {} } } },
      Event: class {},
    };
    vm.runInNewContext(text.slice(start, end) + '\nce(true);', sandbox);
    assert.equal(scrolls.length, 1);
    assert.equal(scrolls[0].behavior, reduced ? 'instant' : 'smooth');
  }
});
