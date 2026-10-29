// Load local Font Awesome asynchronously without blocking first paint.
// A failed stylesheet fetch gets one bounded retry; do not lose all icons.
(function () {
  var sheet = document.getElementById('fontawesome-stylesheet');
  if (!sheet || !sheet.dataset.href) return;
  var attempts = 0, loading = false, ready = false;
  function start() {
    if (ready || loading || attempts >= 2) return;
    attempts += 1;
    loading = true;
    sheet.media = 'print';
    sheet.onload = function () {
      ready = true;
      loading = false;
      sheet.media = 'all';
    };
    sheet.onerror = function () {
      loading = false;
      if (attempts < 2) window.setTimeout(start, 700);
    };
    sheet.href = sheet.dataset.href;
  }
  start();
  window.setTimeout(function () {
    if (ready) return;
    // If the load event was missed but the CSSOM is available, show the icons.
    if (sheet.sheet) { ready = true; loading = false; sheet.media = 'all'; return; }
    loading = false;
    start();
  }, 3000);
})();
