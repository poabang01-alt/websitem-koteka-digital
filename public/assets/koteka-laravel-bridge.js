/* Koteka Digital Laravel compatibility bridge. No React source changes required. */
(()=>{'use strict';
 const meta=document.querySelector('meta[name="csrf-token"]');
 const endpoint='/api/workspace-content',key='koteka.public.content.v1';
 const nativeFetch=window.fetch.bind(window);
 let version=0,hydrated=false,pending=false,writeInFlight=false,retryNeeded=false,suppress=false;
 function notice(message){
  console.warn('[Koteka Laravel]',message);
  if(!location.pathname.startsWith('/admin'))return;
  let el=document.getElementById('kdLaravelBridgeWarning');
  if(!el){el=document.createElement('div');el.id='kdLaravelBridgeWarning';el.setAttribute('role','alert');
    Object.assign(el.style,{position:'fixed',zIndex:'99999',bottom:'16px',right:'16px',background:'#7f1d1d',color:'#fff',
      padding:'12px 16px',borderRadius:'10px',font:'500 13px system-ui',maxWidth:'390px',boxShadow:'0 8px 22px #0003'});
    document.body.appendChild(el);
  }el.textContent=message;
 }
 function csrf(){return meta?.getAttribute('content')||'';}
 window.fetch=function(input,init={}){
  let url;try{url=new URL(typeof input==='string'||input instanceof URL?input:input.url,location.href);}catch{return nativeFetch(input,init);}
  const method=String(init?.method || (input instanceof Request?input.method:'GET')).toUpperCase();
  if(url.origin!==location.origin || !['POST','PUT','PATCH','DELETE'].includes(method))return nativeFetch(input,init);
  const headers=new Headers(init?.headers || (input instanceof Request?input.headers:undefined));
  if(!headers.has('X-CSRF-TOKEN') && csrf())headers.set('X-CSRF-TOKEN',csrf());
  const actualInput=input instanceof Request?new Request(input,{headers,...init}):input;
  return nativeFetch(actualInput,input instanceof Request?undefined:{...init,headers}).then(response=>{
    const rotated=response.headers.get('X-Koteka-CSRF');if(rotated&&meta)meta.setAttribute('content',rotated);
    return response;
  });
 };
 const oldSet=Storage.prototype.setItem;
 try{Storage.prototype.setItem=function(k,value){
   const result=oldSet.call(this,k,value);
   if(this===localStorage && k===key && !suppress){pending=true;if(hydrated)queueSave();}
   return result;
 };}catch(e){console.warn('[Koteka Laravel] Persistent content change interception unavailable',e);}
 function announce(value){
   window.dispatchEvent(new StorageEvent('storage',{key,newValue:value,storageArea:localStorage}));
 }
 function apply(content){
  if(!content||typeof content!=='object'||Array.isArray(content))return;
  const value=JSON.stringify(content);
  suppress=true;
  try{oldSet.call(localStorage,key,value);}catch(e){notice('Penyimpanan browser tidak tersedia; konten dari server tidak dapat ditampilkan.');}
  finally{suppress=false;}
  announce(value);
 }
 let timer;
 function queueSave(){if(!location.pathname.startsWith('/admin'))return;
   clearTimeout(timer);timer=setTimeout(save,420);
 }
 async function save(){
   if(!hydrated||!pending){return;}
   if(writeInFlight){retryNeeded=true;return;}
   if(sessionStorage.getItem('koteka.admin.demo.session.v1')!=='ok')return;
   let content;try{content=JSON.parse(localStorage.getItem(key)||'{}');}catch{return;}
   if(!content||typeof content!=='object'||Array.isArray(content))return;
   const wasVersion=version;
   writeInFlight=true;pending=false;
   try{
    const res=await fetch(endpoint,{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({content,version:wasVersion})});
    const payload=await res.json().catch(()=>({}));
    if(!res.ok){
      pending=true;
      notice(res.status===409?'Konten berubah di perangkat lain. Cadangkan perubahan lokal lalu muat ulang halaman sebelum mengedit lagi.':
        (payload.error||`Sinkronisasi konten gagal (${res.status}). Perubahan masih ada di browser ini.`));
      return;
    }
    version=payload.version;
   }catch(e){pending=true;notice('Koneksi server bermasalah. Perubahan tetap tersimpan di browser, tetapi belum terpublikasi.');}
   finally{writeInFlight=false;if(retryNeeded){retryNeeded=false;queueSave();}}
 }
 async function hydrate(){
  try{
    const res=await nativeFetch(endpoint,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json',...(location.pathname.startsWith('/admin')?{'X-Koteka-Editor':'1'}:{})}});
    if(!res.ok)throw Error('Status '+res.status);
    const payload=await res.json();
    version=Number(payload.version)||0;
    // Empty server: preserve existing browser data; publication happens after admin login/edit.
    if(version>0 && !pending)apply(payload.content||{});
   }catch(e){console.warn('[Koteka Laravel] Shared content unavailable:',e.message);}
   finally{hydrated=true;if(pending)queueSave();}
 }
 hydrate();
 window.KotekaLaravel={get version(){return version},sync:()=>{pending=true;queueSave();},reload:hydrate};
})();
