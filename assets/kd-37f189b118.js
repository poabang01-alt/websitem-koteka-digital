/* Koteka Digital — lightweight interaction layer.
   Motion / Framer Motion in the app bundle owns section transitions.
   No per-text blur animations, no DOM subtree observer, no duplicated timelines. */
(() => {
  'use strict';
  const d = document, w = window;
  d.documentElement.classList.add('kd-premium');
  const progress = d.createElement('div');
  progress.id = 'kd-scroll-progress';
  progress.setAttribute('aria-hidden', 'true');
  d.body.appendChild(progress);
  let queued = false;
  const update = () => {
    queued = false;
    const total = d.documentElement.scrollHeight - w.innerHeight;
    progress.style.transform = `scaleX(${total > 0 ? Math.max(0, Math.min(1, w.scrollY / total)) : 0})`;
    d.querySelector('.site-header, .article-topbar')?.classList.toggle('kd-scrolled', w.scrollY > 24);
  };
  const schedule = () => {
    if (!queued) { queued = true; w.requestAnimationFrame(update); }
  };
  w.addEventListener('scroll', schedule, { passive: true });
  w.addEventListener('resize', schedule, { passive: true });
  d.addEventListener('visibilitychange', () => {
    d.documentElement.classList.toggle('kd-page-hidden', d.hidden);
    schedule();
  });
  // Lightweight entry/re-entry choreography. Initial content stays visible;
  // animation only runs after intersection, and returns on reverse scrolling.
  const reduceMotion = w.matchMedia('(prefers-reduced-motion: reduce)');
  if ('IntersectionObserver' in w && !reduceMotion.matches) {
    const seen = new WeakSet();
    const sectionSelector = '.section-heading, .services-heading, .pricing-header, .portfolio-heading, .blog-section-intro, .faq-heading, .contact-heading, .about-heading, .about-team-heading-copy, .route-page-intro-copy, .route-page-hero-media, .article-hero, .article-proof, .service-card, .pricing-card-reference, .portfolio-card, .blog-card, .contact-card, .testimonial-card';
    let previousY = w.scrollY;
    let direction = 'down';
    w.addEventListener('scroll', () => {
      direction = w.scrollY < previousY ? 'up' : 'down';
      previousY = w.scrollY;
    }, {passive:true});
    const inView = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.remove('kd-scroll-enter','kd-scroll-from-top');
          entry.target.classList.add('kd-scroll-enter');
          if (direction === 'up') entry.target.classList.add('kd-scroll-from-top');
        } else {
          entry.target.classList.remove('kd-scroll-enter','kd-scroll-from-top');
        }
      }
    }, {threshold:0.04,rootMargin:'0px 0px -1% 0px'});
    const register = () => d.querySelectorAll(sectionSelector).forEach(el => {
      if (!seen.has(el)) {seen.add(el);inView.observe(el);}
    });
    register();
    d.addEventListener('DOMContentLoaded', register, {once:true});
    w.addEventListener('kotekadigital:section-rendered', register);
    w.addEventListener('kotekadigital:navigation-change', register);
  }
  schedule();
  w.addEventListener('load', schedule, { once: true });
})();
