/* Focus management for the three existing Workspace dialogs.
   Keep original opening/closing logic, UI styling and keyboard Escape handlers. */
(()=>{'use strict';
 const ids=['dialogBackdrop','confirmBackdrop','profileBackdrop'];
 const backdrops=ids.map(id=>document.getElementById(id)).filter(Boolean);
 const selector='button:not([disabled]),a[href],input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
 let latestOutside=null;
 const openers=new WeakMap();
 const top=()=>[...backdrops].reverse().find(el=>!el.hidden)||null;
 const focusables=overlay=>[...overlay.querySelectorAll(selector)].filter(el=>!el.closest('[hidden]')&&el.getClientRects().length);
 document.addEventListener('focusin',event=>{
  if(!backdrops.some(overlay=>overlay.contains(event.target)))latestOutside=event.target;
 },true);
 const observer=new MutationObserver(changes=>{
  let closed=false,restore=null;
  changes.forEach(({target,attributeName,oldValue})=>{
   if(attributeName!=='hidden')return;
   if(target.hidden){closed=true;restore=openers.get(target)||restore;openers.delete(target);}
   else {openers.set(target,latestOutside);}
  });
  const active=top();
  if(active){
   if(!active.contains(document.activeElement)){
    const first=focusables(active)[0]||active.querySelector('[role="dialog"],[role="alertdialog"]');
    if(first){if(!first.hasAttribute('tabindex')&&!first.matches(selector))first.setAttribute('tabindex','-1');first.focus({preventScroll:true});}
   }
  }else if(closed&&restore?.isConnected&&typeof restore.focus==='function')restore.focus({preventScroll:true});
 });
 backdrops.forEach(overlay=>observer.observe(overlay,{attributes:true,attributeFilter:['hidden'],attributeOldValue:true}));
 document.addEventListener('keydown',event=>{
  const active=top();if(!active)return;
  // Global shortcuts must not move focus behind an active modal dialog.
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();event.stopImmediatePropagation();return;}
  if(event.key!=='Tab')return;
  const options=focusables(active);
  if(!options.length){event.preventDefault();active.querySelector('[role="dialog"],[role="alertdialog"]')?.focus();return;}
  const first=options[0],last=options[options.length-1],current=document.activeElement;
  if(event.shiftKey&&(current===first||!active.contains(current))){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&(current===last||!active.contains(current))){event.preventDefault();first.focus();}
 },true);
})();
