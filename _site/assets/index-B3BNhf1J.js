import './koteka-workspace-sync.js';
import { redirectErrorPreview } from './public-entry.js';
const previewRedirected = redirectErrorPreview(window.location, new URL('../', import.meta.url).href);

const __vite__mapDeps = (
  i,
  m = __vite__mapDeps,
  d = m.f ||
    (m.f = [
      'assets/appBoot-634c31a5ba.js',
      'assets/jsx-runtime-BkSabwWG.js',
      'assets/react-DHmoMYoq.js',
      'assets/appBoot-6l2zS1Ny.css',
    ])
) => i.map((i) => d[i]);
(function () {
  let e = document.createElement(`link`).relList;
  if (e && e.supports && e.supports(`modulepreload`)) return;
  for (let e of document.querySelectorAll(`link[rel="modulepreload"]`)) n(e);
  new MutationObserver((e) => {
    for (let t of e)
      if (t.type === `childList`)
        for (let e of t.addedNodes) e.tagName === `LINK` && e.rel === `modulepreload` && n(e);
  }).observe(document, { childList: !0, subtree: !0 });
  function t(e) {
    let t = {};
    return (
      e.integrity && (t.integrity = e.integrity),
      e.referrerPolicy && (t.referrerPolicy = e.referrerPolicy),
      (t.credentials =
        e.crossOrigin === `use-credentials`
          ? `include`
          : e.crossOrigin === `anonymous`
            ? `omit`
            : `same-origin`),
      t
    );
  }
  function n(e) {
    if (e.ep) return;
    e.ep = !0;
    let n = t(e);
    fetch(e.href, n);
  }
})();
var e = `modulepreload`,
  t = function (e) {
    return new URL(`../${e}`, import.meta.url).href;
  },
  n = {},
  r = function (r, i, a) {
    let o = Promise.resolve();
    if (i && i.length > 0) {
      let r = document.getElementsByTagName(`link`),
        s = document.querySelector(`meta[property=csp-nonce]`),
        c = s?.nonce || s?.getAttribute(`nonce`);
      function l(e) {
        return Promise.all(
          e.map((e) =>
            Promise.resolve(e).then(
              (e) => ({ status: `fulfilled`, value: e }),
              (e) => ({ status: `rejected`, reason: e })
            )
          )
        );
      }
      function u(e) {
        return import.meta.resolve ? import.meta.resolve(e) : new URL(e, import.meta.url).href;
      }
      o = l(
        i.map((i) => {
          if (((i = t(i, a)), (i = u(i)), i in n)) return;
          n[i] = !0;
          let o = i.endsWith(`.css`);
          for (let e = r.length - 1; e >= 0; e--) {
            let t = r[e];
            if (t.href === i && (!o || t.rel === `stylesheet`)) return;
          }
          let s = document.createElement(`link`);
          if (
            ((s.rel = o ? `stylesheet` : e),
            o || (s.as = `script`),
            (s.crossOrigin = ``),
            (s.href = i),
            c && s.setAttribute(`nonce`, c),
            document.head.appendChild(s),
            o)
          )
            return new Promise((e, t) => {
              (s.addEventListener(`load`, e),
                s.addEventListener(`error`, () => t(Error(`Unable to preload CSS for ${i}`))));
            });
        })
      );
    }
    function s(e) {
      let t = new Event(`vite:preloadError`, { cancelable: !0 });
      if (((t.payload = e), window.dispatchEvent(t), !t.defaultPrevented)) throw e;
    }
    return o.then((e) => {
      for (let t of e || []) t.status === `rejected` && s(t.reason);
      return r().catch(s);
    });
  },
  i;
function a() {
  if (previewRedirected) return Promise.resolve();
  return (
    (i ||= r(
      async () => {
        let { mountApp: e } = await import(`./appBoot-634c31a5ba.js`);
        return { mountApp: e };
      },
      __vite__mapDeps(window.KotekaPublicCss ? [0, 1, 2] : [0, 1, 2, 3])
    ).then(({ mountApp: e }) => e())),
    i
  );
}
(
  window.addEventListener(`pointerdown`, a, { once: !0, passive: !0 }),
  window.addEventListener(`keydown`, a, { once: !0, passive: !0 }),
  window.addEventListener(`touchstart`, a, { once: !0, passive: !0 }),
  (() => {
    if (`queueMicrotask` in window) {
      window.queueMicrotask(a);
      return;
    }
    window.setTimeout(a, 0);
  })());
export { r as t };
