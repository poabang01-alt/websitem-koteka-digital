// Only bundled illustrations have generated responsive variants. Uploads use their exact URL.
export function heroImageSrcSet(slide) {
  return /^\/img\/hero\/hero-(?:frontend-stack|backend-architecture|go-live-deployment)\.webp$/.test(slide.src)
    ? `${slide.src.replace('.webp', '-480.webp')} 480w, ${slide.src.replace('.webp', '-720.webp')} 720w, ${slide.src} 1000w`
    : undefined;
}

// Decode the next illustration before crossfading; inactive slides need no request.
export async function prepareHeroSlide(slide, createImage = () => new Image()) {
  const image = createImage();
  image.decoding = 'async';
  image.sizes = '(max-width: 900px) 340px, 480px';
  const srcset = heroImageSrcSet(slide);
  if (srcset) image.srcset = srcset;
  image.src = slide.src;
  await image.decode();
  return slide;
}
