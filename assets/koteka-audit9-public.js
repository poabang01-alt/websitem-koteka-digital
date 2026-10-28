/* Koteka Digital / audit 9: scroll entry and pricing carousel only. */
(()=>{'use strict';
// Pricing: two identical card sets are rendered by React. Advance on requestAnimationFrame
// and wrap at the midpoint so the loop has no blank gap or snap on mobile.
const controls=new WeakMap(),activeControllers=new Set();
function initCarousel(viewport){if(!viewport||controls.has(viewport))return;const rail=viewport.querySelector('.pricing-package-grid');if(!rail)return;
 let last=0,pauseUntil=0,hovered=false,focused=false,touching=false,visible=false,raf=0,disposed=false,half=0;
 // Measure card positions only when layout or the card list changes, never on every animation frame.
 const measure=()=>{const cards=rail.querySelectorAll('.pricing-card-reference');half=cards.length>1&&cards.length%2===0?Math.max(0,cards[cards.length/2].offsetLeft-cards[0].offsetLeft):0};
 measure();
 const sizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(measure):null;
 sizeObserver?.observe(rail);sizeObserver?.observe(viewport);
 const cardObserver=new MutationObserver(measure);cardObserver.observe(rail,{childList:true});
 const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
 const cancelTick=()=>{if(raf){cancelAnimationFrame(raf);raf=0}last=0};
 const scheduleTick=()=>{if(!disposed&&!raf&&visible&&!document.hidden&&!reducedMotion.matches)raf=requestAnimationFrame(tick)};
 const onVisibility=()=>{if(document.hidden)cancelTick();else scheduleTick()};
 const onMotionChange=()=>{if(reducedMotion.matches)cancelTick();else scheduleTick()};
 document.addEventListener('visibilitychange',onVisibility);
 reducedMotion.addEventListener?.('change',onMotionChange);
 // Keep touch/trackpad scrolling native. Only an intentional horizontal mouse drag is captured.
 let pointer=null,dragged=false;
 viewport.addEventListener('wheel',()=>{pauseUntil=performance.now()+1800},{passive:true});
 viewport.addEventListener('pointerdown',event=>{
  dragged=false;
  if(event.pointerType!=='mouse'||event.button!==0||event.target.closest('a,button,input,select,textarea'))return;
  pointer={id:event.pointerId,x:event.clientX,y:event.clientY,left:viewport.scrollLeft};
  pauseUntil=performance.now()+1800;
 });
 viewport.addEventListener('pointermove',event=>{
  if(!pointer||event.pointerId!==pointer.id)return;
  const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;
  if(!dragged){
   if(Math.abs(dy)>8&&Math.abs(dy)>Math.abs(dx)){pointer=null;return}
   if(Math.abs(dx)<=8)return;
   dragged=true;viewport.setPointerCapture(event.pointerId);viewport.classList.add('is-dragging');
  }
  event.preventDefault();viewport.scrollLeft=pointer.left-dx;pauseUntil=performance.now()+1800;
 });
 const endDrag=event=>{
  if(!pointer||event.pointerId!==pointer.id)return;
  if(viewport.hasPointerCapture(event.pointerId))viewport.releasePointerCapture(event.pointerId);
  pointer=null;viewport.classList.remove('is-dragging');pauseUntil=performance.now()+1800;
 };
 viewport.addEventListener('pointerup',endDrag);viewport.addEventListener('pointercancel',endDrag);
 viewport.addEventListener('lostpointercapture',()=>{pointer=null;viewport.classList.remove('is-dragging')});
 viewport.addEventListener('pointerleave',()=>{if(!dragged)pointer=null},{passive:true});
 viewport.addEventListener('dragstart',event=>{if(pointer)event.preventDefault()});
 viewport.addEventListener('click',event=>{if(dragged){event.preventDefault();event.stopPropagation();dragged=false}},true);
 viewport.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')hovered=true},{passive:true});
 viewport.addEventListener('pointerleave',()=>{hovered=false},{passive:true});
 viewport.addEventListener('focusin',()=>{focused=true});
 viewport.addEventListener('focusout',event=>{focused=viewport.contains(event.relatedTarget)});
 viewport.addEventListener('touchstart',()=>{touching=true},{passive:true});
 const endTouch=()=>{touching=false;pauseUntil=performance.now()+1300};
 viewport.addEventListener('touchend',endTouch,{passive:true});viewport.addEventListener('touchcancel',endTouch,{passive:true});
 const intersection=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??false;if(visible){measure();scheduleTick()}else cancelTick()},{threshold:0});intersection.observe(viewport);
 function tick(now){raf=0;if(disposed)return;if(!viewport.isConnected){controller.dispose();controls.delete(viewport);return}
  if(!visible||document.hidden||reducedMotion.matches){last=0;return}
  const step=Math.min(50,Math.max(0,now-(last||now)));last=now;
  if(!hovered&&!focused&&!touching&&now>pauseUntil&&half>0){viewport.scrollLeft+=step*.039;if(viewport.scrollLeft>=half-2)viewport.scrollLeft-=half}
  scheduleTick();
 }
 const controller={viewport,rail,pause(){pauseUntil=performance.now()+1800},dispose(){if(disposed)return;disposed=true;activeControllers.delete(controller);controls.delete(viewport);cancelTick();intersection.disconnect();sizeObserver?.disconnect();cardObserver.disconnect();document.removeEventListener('visibilitychange',onVisibility);reducedMotion.removeEventListener?.('change',onMotionChange)}};
 controls.set(viewport,controller);activeControllers.add(controller);
}
window.KotekaPricingMarquee={nudge(viewport,direction){if(!viewport)return;const ctl=controls.get(viewport);if(ctl)ctl.pause();const card=viewport.querySelector('.pricing-card-reference'),cards=viewport.querySelectorAll('.pricing-card-reference');const step=cards.length>1?cards[1].offsetLeft-cards[0].offsetLeft:(card?.getBoundingClientRect().width||310);if(direction<0&&cards.length>1&&cards.length%2===0&&viewport.scrollLeft<step){viewport.scrollLeft+=cards[cards.length/2].offsetLeft-cards[0].offsetLeft}viewport.scrollBy({left:direction*step,behavior:'smooth'});},refresh(){document.querySelectorAll('.kd-pricing-viewport').forEach(initCarousel)}};
// Opt-in entry animation only on elements that do not already use motion transforms.
const motionOff=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const seen=new WeakSet();const observer=('IntersectionObserver' in window)?new IntersectionObserver(entries=>{entries.forEach(e=>{if(!e.isIntersecting)return;observer.unobserve(e.target);if(!motionOff()&&!e.target.animate)return;if(!motionOff())e.target.animate([{opacity:.55,transform:'translate3d(0,18px,0)'},{opacity:1,transform:'translate3d(0,0,0)'}],{duration:620,easing:'cubic-bezier(.2,.7,.2,1)',fill:'none'});});},{threshold:.1,rootMargin:'0px 0px -24px 0px'}):null;
function scan(){document.querySelectorAll('.kd-pricing-viewport').forEach(initCarousel);
 if(observer&&!motionOff())document.querySelectorAll('section[id] h2,section[id] .pricing-card-reference,section[id] .contact-card,section[id] .section-heading').forEach(el=>{if(seen.has(el)||el.closest('[data-motion-pop-id]')||el.style.transform)return;seen.add(el);observer.observe(el)});
}
let scheduled=false;const queue=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;scan()})};
const dom=new MutationObserver(changes=>{if(changes.some(x=>x.addedNodes.length||x.removedNodes.length)){for(const controller of activeControllers){if(!controller.viewport.isConnected||!controller.rail.isConnected)controller.dispose()}queue()}});
document.addEventListener('DOMContentLoaded',()=>{scan();dom.observe(document.querySelector('#root')||document.body,{subtree:true,childList:true});});
})();
