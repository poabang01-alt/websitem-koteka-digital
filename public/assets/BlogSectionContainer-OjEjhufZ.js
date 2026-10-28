import { r as interop, t as runtime } from './jsx-runtime-BkSabwWG.js';
import { t as react } from './react-DHmoMYoq.js';
import { blogPosts } from './siteData-C5f9a5aD.js';
import { n as imageProps, t as modernImage } from './modernImage-B_n1VIeC.js';
import { t as Reveal } from './Reveal-a4c48c8478.js';
const React = interop(react(), 1);
const { jsx, jsxs } = runtime();
const pageSize = () => window.innerWidth <= 640 ? 1 : window.innerWidth <= 1024 ? 2 : 3;

function BlogSection() {
  const [all, setAll] = React.useState(false);
  const [visible, setVisible] = React.useState(pageSize);
  const [index, setIndex] = React.useState(0);
  const touch = React.useRef(null);
  const last = Math.max(0, blogPosts.length - visible);
  const current = Math.min(index, last);
  React.useEffect(() => {
    const resize = () => { setVisible(pageSize()); setIndex(0); };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const move = direction => setIndex(value => direction < 0 ? (value <= 0 ? last : value - 1) : (value >= last ? 0 : value + 1));
  const arrow = direction => jsx('button', {
    type: 'button', className: 'blog-arrow-button', onClick: () => move(direction), disabled: last === 0,
    'aria-label': direction < 0 ? 'Artikel sebelumnya' : 'Artikel berikutnya', 'aria-controls': 'blog-showcase-content',
    children: jsx('svg', { viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none', stroke: 'currentColor',
      strokeWidth: 1.8, 'aria-hidden': true, children: jsx('path', { d: direction < 0 ? 'M19 12H5m7-7-7 7 7 7' : 'M5 12h14m-7-7 7 7-7 7' }) })
  });
  const card = (post, cardIndex) => {
    const formats = modernImage(post.image);
    const offscreen = !all && (cardIndex < current || cardIndex >= current + visible);
    const img = jsx('img', { src: post.image, ...imageProps(post.image), alt: post.title, loading: 'lazy', decoding: 'async',
      sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw', width: post.imageWidth, height: post.imageHeight });
    return jsx('article', { className: `blog-card blog-card-showcase ${all ? 'blog-card-grid' : ''}`,
      'aria-hidden': offscreen || undefined, children: jsxs('div', { className: 'blog-card-frame', children: [
        jsx('div', { className: 'blog-card-media', children: formats ? jsxs('picture', { children: [
          jsx('source', { srcSet: formats.avif, type: 'image/avif' }), jsx('source', { srcSet: formats.webp, type: 'image/webp' }), img
        ] }) : img }),
        jsxs('div', { className: 'blog-card-body', children: [
          jsxs('div', { className: 'blog-chip-row', children: [
            jsx('span', { className: 'blog-tag blog-tag-primary', children: post.category }),
            post.audience ? jsx('span', { className: 'blog-tag blog-tag-soft', children: post.audience }) : null,
            post.focus ? jsx('span', { className: 'blog-tag blog-tag-muted', children: post.focus }) : null
          ] }),
          post.meta ? jsx('span', { className: 'blog-date', children: post.meta }) : null,
          jsx('h3', { children: post.title }), jsx('p', { children: post.excerpt }),
          jsx('a', { className: 'blog-readmore', href: post.link, tabIndex: offscreen ? -1 : undefined, children: 'Baca Artikel' })
        ] })
      ] })
    }, post.title);
  };
  return jsx(Reveal, { as: 'section', className: 'blog-section', id: 'blog', 'aria-labelledby': 'blog-heading',
    children: jsxs('div', { className: 'container', children: [
      jsxs('div', { className: 'blog-section-intro', children: [
        jsx('span', { className: 'blog-kicker', children: 'Semua Artikel' }),
        jsx('h2', { id: 'blog-heading', children: 'Blog dan Artikel' }),
        jsxs('p', { className: 'blog-intro-copy', children: ['Temukan insight, panduan, dan strategi praktis seputar ',
          jsx('span', { children: 'website bisnis' }), ', ', jsx('span', { children: 'SEO' }), ', dan ',
          jsx('span', { children: 'digital marketing' }), ' yang kami susun untuk membantu bisnis Anda tampil lebih profesional dan berkembang di era digital.'] })
      ] }),
      jsxs('div', { className: 'blog-showcase', children: [
        jsxs('div', { className: 'blog-showcase-top', children: [
          jsx('button', { type: 'button', className: 'blog-showcase-link', onClick: () => { setAll(value => !value); setIndex(0); },
            'aria-pressed': all, 'aria-controls': 'blog-showcase-content', children: all ? 'Tampilkan slider' : 'Lihat semua' })
        ] }),
        all ? jsx('div', { id: 'blog-showcase-content', className: 'blog-all-grid', children: blogPosts.map(card) }) : jsxs(React.Fragment, { children: [
          jsx('div', { id: 'blog-showcase-content', className: 'blog-carousel', role: 'region', 'aria-roledescription': 'carousel',
            'aria-label': 'Slider artikel unggulan', 'aria-live': 'polite', tabIndex: 0,
            onKeyDown: event => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); }
            },
            onTouchStart: event => { const point = event.touches[0]; touch.current = point ? { x: point.clientX, y: point.clientY } : null; },
            onTouchEnd: event => {
              const start = touch.current, end = event.changedTouches[0]; touch.current = null;
              if (!start || !end) return;
              const dx = end.clientX - start.x, dy = end.clientY - start.y;
              if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1);
            },
            children: jsx('div', { className: 'blog-carousel-track is-animated',
              style: { transform: `translateX(-${100 / visible * current}%)` }, children: blogPosts.map(card) })
          }),
          jsxs('div', { className: 'blog-carousel-footer', children: [
            jsx('span', { className: 'blog-swipe-hint', children: 'Geser artikel' }),
            jsxs('div', { className: 'blog-carousel-actions', role: 'group', 'aria-label': 'Geser artikel', children: [
              arrow(-1), jsx('span', { className: 'blog-slide-count', role: 'status',
                children: `${current + 1}–${Math.min(current + visible, blogPosts.length)} dari ${blogPosts.length} artikel` }), arrow(1)
            ] })
          ] })
        ] })
      ] })
    ] })
  });
}
export default BlogSection;
