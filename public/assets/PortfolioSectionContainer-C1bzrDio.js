import { r as interop, t as runtime } from './jsx-runtime-BkSabwWG.js';
import { t as react } from './react-DHmoMYoq.js';
import { i as techIcons } from './appBoot-634c31a5ba.js';
import { portfolioItems } from './siteData-C5f9a5aD.js';
import { t as Reveal } from './Reveal-a4c48c8478.js';
const React = interop(react(), 1);
const { jsx, jsxs } = runtime();

function PortfolioSection() {
  const [index, setIndex] = React.useState(0);
  const loopQuery = '(prefers-reduced-motion: no-preference)';
  const [allowLoop, setAllowLoop] = React.useState(() =>
    typeof window !== 'undefined' && window.matchMedia(loopQuery).matches
  );
  React.useEffect(() => {
    const media = window.matchMedia(loopQuery);
    const sync = () => setAllowLoop(media.matches);
    sync();
    if (media.addEventListener) {
      media.addEventListener('change', sync);
      return () => media.removeEventListener('change', sync);
    }
    media.addListener(sync);
    return () => media.removeListener(sync);
  }, []);
  const active = portfolioItems[index];
  if(!active)return jsx(Reveal,{as:'section',className:'portfolio-section',id:'portfolio',children:jsxs('div',{className:'container section-heading',children:[jsx('h2',{id:'portfolio-heading',children:'Portofolio'}),jsx('p',{children:'Belum ada portofolio yang dipublikasikan.'})]})});
  const move = direction => setIndex(value => (value + direction + portfolioItems.length) % portfolioItems.length);
  const arrow = direction => jsx('button', {
    type: 'button', className: 'slider-control', onClick: () => move(direction),
    'aria-label': direction < 0 ? 'Portofolio sebelumnya' : 'Portofolio berikutnya',
    'aria-controls': 'portfolio-featured-card', disabled: portfolioItems.length < 2,
    children: jsx('i', { className: `fa-solid fa-arrow-${direction < 0 ? 'left' : 'right'}`, 'aria-hidden': true })
  });
  const thumbs = (duplicate = false) => jsx('div', {
    className: 'portfolio-thumb-group', 'aria-hidden': duplicate || undefined,
    children: portfolioItems.map((item, itemIndex) => jsxs('button', {
      type: 'button', className: `thumb-card ${itemIndex === index ? 'active' : ''}`,
      onClick: () => setIndex(itemIndex), tabIndex: duplicate ? -1 : 0,
      'aria-label': `Tampilkan portofolio ${item.title}`, 'aria-pressed': itemIndex === index,
      'aria-controls': 'portfolio-featured-card',
      children: [jsx('img', { src: item.image, alt: '', loading: 'lazy', decoding: 'async',
        width: item.imageWidth, height: item.imageHeight, sizes: '(max-width: 640px) 170px, 220px' }),
        jsx('span', { children: item.title })]
    }, `${duplicate ? 'copy-' : ''}${item.title}`))
  });
  return jsx(Reveal, {
    as: 'section', className: 'portfolio-section', id: 'portfolio', 'aria-labelledby': 'portfolio-heading',
    children: jsxs('div', { className: 'container', children: [
      jsxs('div', { className: 'section-heading', children: [
        jsx('span', { className: 'eyebrow', children: 'Portofolio' }),
        jsx('h2', { id: 'portfolio-heading', children: 'Proyek yang sudah tayang dan bisa langsung dilihat' })
      ] }),
      jsxs('div', { className: 'portfolio-showcase', role: 'region', 'aria-roledescription': 'carousel',
        'aria-label': 'Carousel portofolio unggulan', 'aria-live': 'polite', children: [
          arrow(-1), jsxs('article', { id: 'portfolio-featured-card', className: 'portfolio-card featured portfolio-card-animated', children: [
            jsx('div', { className: 'portfolio-image', children: jsx('img', {
              src: active.image, alt: active.title, loading: 'lazy', decoding: 'async',
              sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 92vw, 720px',
              width: active.imageWidth, height: active.imageHeight
            }) }),
            jsxs('div', { className: 'portfolio-content', children: [
              jsx('span', { className: 'portfolio-label', children: active.label }),
              jsx('h3', { children: active.title }), jsx('p', { children: active.description }),
              jsx('p', { className: 'portfolio-impact', children: active.impact }),
              jsx('div', { className: 'tech-list', 'aria-label': 'Teknologi yang digunakan',
                children: active.tech.map(tech => jsxs('span', { children: [
                  jsx('i', { className: techIcons[tech] || 'fa-solid fa-code', 'aria-hidden': true }), tech
                ] }, tech)) }),
              jsxs('a', { className: 'button button-primary portfolio-cta', href: active.link,
                target: '_blank', rel: 'noopener noreferrer', children: [
                  jsx('i', { className: 'fa-solid fa-up-right-from-square', 'aria-hidden': true }), 'Lihat Website'
                ] })
            ] })
          ] }, active.title), arrow(1)
        ] }),
      jsx('div', { className: 'portfolio-thumb-viewport', role: 'group', 'aria-label': 'Pilih proyek portofolio',
        children: jsxs('div', { className: allowLoop ? 'portfolio-thumbs kd-portfolio-loop' : 'portfolio-thumbs kd-portfolio-static',
          style: { '--kd-portfolio-duration': `${Math.max(30, portfolioItems.length * 6)}s` },
          children: allowLoop ? [thumbs(), thumbs(true)] : [thumbs()] })
      })
    ] })
  });
}
export default PortfolioSection;
