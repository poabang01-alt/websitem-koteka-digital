/* Register independently of the application bundle so an old cached entry can recover. */
(() => {
  if (!('serviceWorker' in navigator)) return;
  const workerUrl = new URL('../sw.js', document.currentScript.src);
  const wasControlled = Boolean(navigator.serviceWorker.controller);
  let reloading = false, editingForm = false;
  window.addEventListener('input', event => {
    if (event.target.closest?.('form')) editingForm = true;
  }, { capture: true });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!wasControlled || reloading || editingForm) return;
    reloading = true;
    window.location.reload();
  });
  const register = () => navigator.serviceWorker.register(workerUrl, { updateViaCache: 'none' }).catch(() => {});
  if (document.readyState === 'loading') window.addEventListener('load', register, { once: true });
  else register();
})();
