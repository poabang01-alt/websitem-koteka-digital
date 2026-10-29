/* Pricing carousel. Shared entry motion is owned by kd-37f189b118.js. */
(()=>{'use strict';
// Pricing: two identical card sets are rendered by React. Advance on requestAnimationFrame
// and wrap at the midpoint so the loop has no blank gap or snap on mobile.
const controls=new WeakMap(),activeControllers=new Set();
function initCarousel(viewport){if(!viewport||controls.has(viewport))return;const rail=viewport.querySelector('.pricing-package-grid');if(!rail)return;
 let last=0,pauseUntil=0,hovered=false,focused=false,touching=false,visible=false,raf=0,wakeTimer=0,disposed=false,half=0;
 // Measure card positions only when layout or the card list changes, never on every animation frame.
 const measure=()=>{const cards=rail.querySelectorAll('.pricing-card-reference');half=cards.length>1&&cards.length%2===0?Math.max(0,cards[cards.length/2].offsetLeft-cards[0].offsetLeft):0};
 measure();
 const sizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(measure):null;
 sizeObserver?.observe(rail);sizeObserver?.observe(viewport);
 const cardObserver=new MutationObserver(measure);cardObserver.observe(rail,{childList:true});
 const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
 const cancelTick=()=>{if(raf){cancelAnimationFrame(raf);raf=0}if(wakeTimer){clearTimeout(wakeTimer);wakeTimer=0}last=0};
 const scheduleTick=()=>{
  if(disposed||raf||wakeTimer||!visible||document.hidden||reducedMotion.matches||hovered||focused||touching)return;
  const wait=pauseUntil-performance.now();
  if(wait>0){wakeTimer=setTimeout(()=>{wakeTimer=0;scheduleTick()},wait);return}
  raf=requestAnimationFrame(tick);
 };
 const pause=(duration=1800)=>{pauseUntil=performance.now()+duration;cancelTick();scheduleTick()};
 const onVisibility=()=>{if(document.hidden)cancelTick();else scheduleTick()};
 const onMotionChange=()=>{if(reducedMotion.matches)cancelTick();else scheduleTick()};
 document.addEventListener('visibilitychange',onVisibility);
 reducedMotion.addEventListener?.('change',onMotionChange);
 // Keep touch/trackpad scrolling native. Only an intentional horizontal mouse drag is captured.
 let pointer=null,dragged=false;
 viewport.addEventListener('wheel',()=>pause(),{passive:true});
 viewport.addEventListener('pointerdown',event=>{
  dragged=false;
  if(event.pointerType!=='mouse'||event.button!==0||event.target.closest('a,button,input,select,textarea'))return;
  pointer={id:event.pointerId,x:event.clientX,y:event.clientY,left:viewport.scrollLeft};
  pause();
 });
 viewport.addEventListener('pointermove',event=>{
  if(!pointer||event.pointerId!==pointer.id)return;
  const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;
  if(!dragged){
   if(Math.abs(dy)>8&&Math.abs(dy)>Math.abs(dx)){pointer=null;return}
   if(Math.abs(dx)<=8)return;
   dragged=true;viewport.setPointerCapture(event.pointerId);viewport.classList.add('is-dragging');
  }
  event.preventDefault();viewport.scrollLeft=pointer.left-dx;pause();
 });
 const endDrag=event=>{
  if(!pointer||event.pointerId!==pointer.id)return;
  if(viewport.hasPointerCapture(event.pointerId))viewport.releasePointerCapture(event.pointerId);
  pointer=null;viewport.classList.remove('is-dragging');pause();
 };
 viewport.addEventListener('pointerup',endDrag);viewport.addEventListener('pointercancel',endDrag);
 viewport.addEventListener('lostpointercapture',()=>{pointer=null;viewport.classList.remove('is-dragging')});
 viewport.addEventListener('pointerleave',()=>{if(!dragged)pointer=null},{passive:true});
 viewport.addEventListener('dragstart',event=>{if(pointer)event.preventDefault()});
 viewport.addEventListener('click',event=>{if(dragged){event.preventDefault();event.stopPropagation();dragged=false}},true);
 viewport.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch'){hovered=true;cancelTick()}},{passive:true});
 viewport.addEventListener('pointerleave',()=>{hovered=false;scheduleTick()},{passive:true});
 viewport.addEventListener('focusin',()=>{focused=true;cancelTick()});
 viewport.addEventListener('focusout',event=>{focused=viewport.contains(event.relatedTarget);scheduleTick()});
 viewport.addEventListener('touchstart',()=>{touching=true;cancelTick()},{passive:true});
 const endTouch=()=>{touching=false;pause(1300)};
 viewport.addEventListener('touchend',endTouch,{passive:true});viewport.addEventListener('touchcancel',endTouch,{passive:true});
 const intersection=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??false;if(visible){measure();scheduleTick()}else cancelTick()},{threshold:0});intersection.observe(viewport);
 function tick(now){raf=0;if(disposed)return;if(!viewport.isConnected){controller.dispose();controls.delete(viewport);return}
  if(!visible||document.hidden||reducedMotion.matches){last=0;return}
  const step=Math.min(50,Math.max(0,now-(last||now)));last=now;
  if(!hovered&&!focused&&!touching&&now>pauseUntil&&half>0){viewport.scrollLeft+=step*.039;if(viewport.scrollLeft>=half-2)viewport.scrollLeft-=half}
  scheduleTick();
 }
 const controller={viewport,rail,pause(){pause()},dispose(){if(disposed)return;disposed=true;activeControllers.delete(controller);controls.delete(viewport);cancelTick();intersection.disconnect();sizeObserver?.disconnect();cardObserver.disconnect();document.removeEventListener('visibilitychange',onVisibility);reducedMotion.removeEventListener?.('change',onMotionChange)}};
 controls.set(viewport,controller);activeControllers.add(controller);
}
window.KotekaPricingMarquee={nudge(viewport,direction){if(!viewport)return;const ctl=controls.get(viewport);if(ctl)ctl.pause();const card=viewport.querySelector('.pricing-card-reference'),cards=viewport.querySelectorAll('.pricing-card-reference');const step=cards.length>1?cards[1].offsetLeft-cards[0].offsetLeft:(card?.getBoundingClientRect().width||310);if(direction<0&&cards.length>1&&cards.length%2===0&&viewport.scrollLeft<step){viewport.scrollLeft+=cards[cards.length/2].offsetLeft-cards[0].offsetLeft}viewport.scrollBy({left:direction*step,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});},refresh(){document.querySelectorAll('.kd-pricing-viewport').forEach(initCarousel)}};
// React lazy sections and route changes notify the one shared content observer.
function refresh(){
 for(const controller of activeControllers){if(!controller.viewport.isConnected||!controller.rail.isConnected)controller.dispose()}
 document.querySelectorAll('.kd-pricing-viewport').forEach(initCarousel);
}
window.addEventListener('kotekadigital:content-ready',refresh);
window.addEventListener('kotekadigital:section-rendered',refresh);
window.addEventListener('kotekadigital:navigation-change',refresh);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});
else refresh();
})();
