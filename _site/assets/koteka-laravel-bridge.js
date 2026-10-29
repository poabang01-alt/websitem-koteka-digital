/* Laravel content persistence and CSRF headers for the existing site. */
(()=>{'use strict';
 const meta=document.querySelector('meta[name="csrf-token"]');
 const endpoint='/api/workspace-content',key='koteka.public.content.v1';
 const nativeFetch=window.fetch.bind(window);
 let version=0,ready=false,writing=false,generation=0,hydration;
 const isAdmin=/^\/admin(?:\/|$)/.test(location.pathname);
 window.fetch=function(input,init={}){
  let url;try{url=new URL(typeof input==='string'||input instanceof URL?input:input.url,location.href);}catch{return nativeFetch(input,init);}
  const method=String(init.method||(input instanceof Request?input.method:'GET')).toUpperCase();
  if(url.origin!==location.origin||!['POST','PUT','PATCH','DELETE'].includes(method))return nativeFetch(input,init);
  const headers=new Headers(init.headers||(input instanceof Request?input.headers:undefined));
  if(meta?.content&&!headers.has('X-CSRF-TOKEN'))headers.set('X-CSRF-TOKEN',meta.content);
  return nativeFetch(input,{...init,headers}).then(response=>{
   const rotated=response.headers.get('X-Koteka-CSRF');if(rotated&&meta)meta.content=rotated;
   return response;
  });
 };
 function apply(content){
  const value=JSON.stringify(content);
  try{localStorage.setItem(key,value);}catch{throw Error('Penyimpanan browser tidak tersedia. Muat ulang halaman.');}
  window.dispatchEvent(new StorageEvent('storage',{key,newValue:value,storageArea:localStorage}));
 }
 async function hydrate(){
  const requestGeneration=++generation;
  ready=false;
  const res=await nativeFetch(endpoint,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json',...(isAdmin?{'X-Koteka-Editor':'1'}:{})}});
  if(!res.ok)throw Error('Konten belum dapat dimuat. Coba muat ulang halaman.');
  const payload=await res.json();
  if(requestGeneration!==generation)return;
  if(!payload.content||typeof payload.content!=='object')throw Error('Konten tidak valid.');
  version=Number(payload.version)||0;
  apply(Array.isArray(payload.content)?{}:payload.content);
  ready=true;
 }
 function reload(){hydration=hydrate();hydration.catch(()=>{});return hydration;}
 reload();
 async function saveContent(content){
  await hydration;
  if(!ready)throw Error('Muat ulang konten sebelum menyimpan.');
  if(!window.KotekaAccess?.user)throw Error('Silakan masuk kembali.');
  if(writing)throw Error('Penyimpanan lain masih berjalan. Coba kembali setelah selesai.');
  writing=true;
  try{
   const res=await fetch(endpoint,{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({content,version})});
   const payload=await res.json().catch(()=>({}));
   if(!res.ok)throw Error(res.status===409?'Konten telah berubah. Muat ulang halaman sebelum menyimpan.':(payload.error||payload.message||'Perubahan belum tersimpan. Coba kembali.'));
   version=payload.version;
   return payload.content;
  }finally{writing=false;}
 }
 window.KotekaLaravel={get version(){return version;},get ready(){return ready;},saveContent,reload};
})();
