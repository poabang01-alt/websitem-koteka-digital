/* Shared public/Workspace motion. Content remains visible when animation is unavailable. */
(() => {
  'use strict';
  const d = document, w = window;
  d.documentElement.classList.add('kd-premium');
  const motion = w.matchMedia('(prefers-reduced-motion: reduce)');
  const root = d.querySelector('#root') || d.querySelector('#mainContent') || d.querySelector('main') || d.body;
  const contentSelector = '.section-heading,.services-heading,.pricing-header,.portfolio-heading,.blog-section-intro,.faq-heading,.contact-heading,.about-heading,.about-team-heading-copy,.route-page-intro-copy,.route-page-hero-media,.article-hero,.article-proof,.article-content>h2,.article-body h2,.route-article-hero,.route-article-content h2,.article-section,.service-card,.about-info-card,.team-card,.pricing-card-reference,.portfolio-card,.thumb-card,.blog-card,.contact-card,.contact-form-card,.contact-social-card,.testimonial-card,.faq-item,.route-card,.route-article-card,.page-shell .hero,.page-shell .article>section,.site-footer .footer-grid>*,#mainContent .page-heading,#mainContent .stat-card,#mainContent .panel';
  const ambientSelector = 'section,.site-footer';
  const selector = `${contentSelector},[data-kd-reveal],${ambientSelector}`;
  const registered = new WeakSet(), entered = new WeakSet(), animations = new Map();
  const pending = new Set();
  let frame = 0, previousY = w.scrollY, upward = false, heightDirty = true, contentChanged = false, total = 0, header;
  const progress = d.createElement('div');
  progress.id = 'kd-scroll-progress';
  progress.setAttribute('aria-hidden', 'true');
  d.body.appendChild(progress);

  const cancel = node => {
    animations.get(node)?.cancel();
    animations.delete(node);
  };
  const cancelAll = () => {
    for (const node of animations.keys()) cancel(node);
  };
  const intersection = 'IntersectionObserver' in w ? new w.IntersectionObserver(entries => {
    for (const entry of entries) {
      const node = entry.target;
      if (node.matches(ambientSelector)) node.dataset.kdInView = String(entry.isIntersecting);
      if (!entry.isIntersecting) { entered.delete(node); cancel(node); continue; }
      if (entered.has(node)) continue;
      entered.add(node);
      if (motion.matches || d.hidden || !node.animate) continue;
      if (node.closest('[data-kd-motion-disabled]')) continue;
      if (node.matches(ambientSelector) && !node.matches(contentSelector)) continue;
      if (node.matches('[data-kd-reveal]') && node.querySelector(contentSelector)) continue;
      if (node.parentElement?.closest(contentSelector)) continue;
      cancel(node);
      const animation = node.animate([
        { opacity: 0.55, translate: `0 ${upward ? -16 : 16}px` },
        { opacity: 1, translate: '0 0' }
      ], { duration: 480, delay: Math.min(120, Math.max(0, Number(node.dataset.kdDelay) * 1000 || 0)), easing: 'cubic-bezier(.22,1,.36,1)', fill: 'none' });
      animations.set(node, animation);
      animation.onfinish = () => { if (animations.get(node) === animation) animations.delete(node); };
    }
  }, { threshold: 0.04, rootMargin: '0px 0px -12px 0px' }) : null;

  const visit = (node, callback) => {
    if (node.nodeType !== 1) return;
    if (node.matches(selector)) callback(node);
    node.querySelectorAll(selector).forEach(callback);
  };
  const register = node => {
    if (!intersection || registered.has(node)) return;
    registered.add(node);
    intersection.observe(node);
  };
  const unregister = node => {
    if (node.isConnected) return;
    intersection?.unobserve(node);
    registered.delete(node);
    entered.delete(node);
    cancel(node);
  };
  const update = () => {
    frame = 0;
    if (d.hidden) return;
    for (const node of pending) { if (node.isConnected) visit(node, register); }
    const changed = contentChanged || pending.size > 0;
    contentChanged = false;
    pending.clear();
    if (heightDirty) {
      total = Math.max(0, d.documentElement.scrollHeight - w.innerHeight);
      header = d.querySelector('.site-header, .article-topbar');
      heightDirty = false;
    }
    progress.style.transform = `scaleX(${total > 0 ? Math.max(0, Math.min(1, w.scrollY / total)) : 0})`;
    header?.classList.toggle('kd-scrolled', w.scrollY > 24);
    if (changed) w.dispatchEvent(new Event('kotekadigital:content-ready'));
  };
  const schedule = () => { if (!frame && !d.hidden) frame = w.requestAnimationFrame(update); };
  const refresh = () => { pending.add(root); heightDirty = true; schedule(); };
  w.addEventListener('scroll', () => {
    if (w.scrollY !== previousY) upward = w.scrollY < previousY;
    previousY = w.scrollY;
    schedule();
  }, { passive: true });
  w.addEventListener('resize', () => { heightDirty = true; schedule(); }, { passive: true });
  d.addEventListener('visibilitychange', () => {
    d.documentElement.classList.toggle('kd-page-hidden', d.hidden);
    if (d.hidden) { w.cancelAnimationFrame(frame); frame = 0; cancelAll(); }
    else refresh();
  });
  motion.addEventListener?.('change', () => { if (motion.matches) cancelAll(); });
  w.addEventListener('kotekadigital:section-rendered', refresh);
  w.addEventListener('kotekadigital:navigation-change', refresh);
  w.addEventListener('load', refresh, { once: true });
  const start = () => {
    refresh();
    if (typeof MutationObserver === 'function') {
      new MutationObserver(changes => {
        for (const change of changes) {
          change.removedNodes.forEach(node => {
            if (node.nodeType === 1) { contentChanged = true; visit(node, unregister); }
          });
          change.addedNodes.forEach(node => {
            if (node.nodeType === 1) { contentChanged = true; pending.add(node); }
          });
        }
        if (contentChanged) { heightDirty = true; schedule(); }
      }).observe(root, { childList: true, subtree: true });
    }
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(() => { heightDirty = true; schedule(); }).observe(d.body);
    }
  };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
