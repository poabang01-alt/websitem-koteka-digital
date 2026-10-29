/* Koteka Laravel: aggregate anonymous first-party visit events + administrator activity. */
(()=>{'use strict';
 const S=window.KotekaServerAnalytics={active:false,logActive:false,serverReady:false,truncated:false};
 const isAdmin=/^\/admin(?:\/|$)/.test(location.pathname);
 const id=()=>globalThis.crypto?.randomUUID?.()||'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c=>{let n=Math.random()*16|0;return (c==='x'?n:(n&3|8)).toString(16)});
 const channel=(()=>{try{const r=new URL(document.referrer);if(r.host===location.host)return'Direct';if(/google|bing|yahoo|duckduckgo/i.test(r.host))return'Organic Search';if(/facebook|instagram|tiktok|twitter|x.com/i.test(r.host))return'Social Media';return'Referral';}catch{return'Direct';}})();
 const device=/ipad|tablet/i.test(navigator.userAgent)?'Tablet':/mobile|android/i.test(navigator.userAgent)?'Mobile':'Desktop';
 if(!isAdmin){
   let session;
   try{session=sessionStorage.getItem('koteka.analytics.session');if(!session){session=id().replace(/-/g,'');sessionStorage.setItem('koteka.analytics.session',session);}}catch{session=id().replace(/-/g,'');}
   let last='', lastAt=0;
   const visit=()=>{
     const path=location.pathname || '/'; // Exclude querystrings, fragments and private details
     if(path===last&&Date.now()-lastAt<3000)return;
     last=path;lastAt=Date.now();
     fetch('/api/visits',{method:'POST',credentials:'same-origin',keepalive:true,
       headers:{'Content-Type':'application/json',Accept:'application/json'},
       body:JSON.stringify({id:id(),page:path,channel,device,session})
     }).catch(()=>{});
   };
   if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',visit,{once:true});else visit();
   window.addEventListener('popstate',visit);window.addEventListener('kotekadigital:navigation-change',visit);
   return;
 }
 S.refresh=refresh;
 let running=false,identity=null,lastTraffic=null,lastActivities=null;
 const resetSnapshots=()=>{identity=null;lastTraffic=null;lastActivities=null;};
 async function refresh(){
   if(running||document.visibilityState==='hidden')return;
   running=true;
   try{
     const sess=await fetch('/api/admin-session',{cache:'no-store',credentials:'same-origin',headers:{Accept:'application/json'}});
     if(!sess.ok)return;
     const auth=await sess.json();
     if(!auth.authenticated){S.active=false;S.logActive=false;resetSnapshots();return;}
     const nextIdentity=JSON.stringify([auth.user?.id,auth.user?.version,auth.user?.role]);
     if(identity!==nextIdentity){resetSnapshots();identity=nextIdentity;}
     const response=await fetch('/api/visits',{cache:'no-store',credentials:'same-origin',headers:{Accept:'application/json'}});
     if(response.ok){const payload=await response.json();if(Array.isArray(payload.items)){
       S.active=true;S.serverReady=true;S.truncated=Boolean(payload.truncated);
       const snapshot=JSON.stringify([payload.items,S.truncated]);
       if(snapshot!==lastTraffic){
         lastTraffic=snapshot;
         window.dispatchEvent(new CustomEvent('koteka:server-traffic',{detail:{items:payload.items,truncated:S.truncated}}));
       }
     }}
     if(auth.user?.role==='super_admin'){
       const res=await fetch('/api/admin-activity',{cache:'no-store',credentials:'same-origin',headers:{Accept:'application/json'}});
       if(res.ok){const activity=await res.json();if(Array.isArray(activity.items)){
         S.logActive=true;
         const snapshot=JSON.stringify(activity.items);
         if(snapshot!==lastActivities){
           lastActivities=snapshot;
           window.dispatchEvent(new CustomEvent('koteka:server-activities',{detail:{items:activity.items}}));
         }
       }}
     }
   }catch(e){console.warn('[Koteka Analytics] Data belum tersedia:',e.message);}
   finally{running=false;}
 }
 window.addEventListener('koteka:session-expired',()=>{S.active=false;S.logActive=false;resetSnapshots();});
 window.addEventListener('focus',refresh);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh();});
 setInterval(refresh,15000);
 setTimeout(refresh,1000);
})();
