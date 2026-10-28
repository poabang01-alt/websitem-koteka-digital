// Static directory entry files and their clean URLs represent the same page.
export function publicPath(pathname) {
  return pathname.replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/';
}

// Keep the shared public application mounted when navigating its listing pages.
export function navigatePublicPage(event, href) {
  if (!href || event.defaultPrevented || event.button > 0 || event.metaKey ||
      event.ctrlKey || event.shiftKey || event.altKey) return false;
  const destination = new URL(href, window.location.href);
  const path = publicPath(destination.pathname);
  if (destination.origin !== window.location.origin || destination.hash ||
      destination.search || !['/', '/layanan', '/portofolio', '/blog'].includes(path)) return false;
  event.preventDefault();
  if (publicPath(window.location.pathname) !== path) {
    window.history.pushState(null, '', destination.pathname);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  window.dispatchEvent(new Event('kotekadigital:navigation-change'));
  return true;
}

// Live Server opens the active editor file, which may be 404.html.
// Restrict this convenience to an explicit error-file preview on loopback hosts.
export function redirectErrorPreview(location, homeUrl) {
  if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) &&
      location.pathname === '/404.html') {
    location.replace(homeUrl);
    return true;
  }
  return false;
}
