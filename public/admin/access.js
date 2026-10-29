/* Workspace identity and actions are authorized by the Laravel session. */
(()=>{'use strict';
 let identity=null;
 const publicUser=user=>user?Object.fromEntries(['id','name','email','role','active','version','locked'].map(key=>[key,user[key]])):null;
 function clear(){
  identity=null;
  for(const key of ['koteka.admin.content.v1','koteka.public.content.v1','koteka.admin.logs.v2','koteka.admin.traffic.v2']){
   try{localStorage.removeItem(key);}catch{}
  }
  for(const key of ['koteka.workspace.access.demo.v1','koteka.consultation.demo.v1','koteka.workspace.inbox.hidden.v1']){
   try{localStorage.removeItem(key);}catch{}
  }
  for(const key of ['koteka.admin.demo.session.v1','koteka.workspace.identity.v1']){
   try{sessionStorage.removeItem(key);}catch{}
  }
 }
 async function loginResponse(email,password,options={}){
  clear();
  const res=await fetch('/api/admin-session',{...options,method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({email,password})});
  const data=await res.clone().json().catch(()=>({}));
  if(res.ok&&data.authenticated===true&&data.user)identity=publicUser(data.user);
  return res;
 }
 async function restore(){
  try{
   const res=await fetch('/api/admin-session',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
   const data=await res.json().catch(()=>({}));
   identity=res.ok&&data.authenticated===true?publicUser(data.user):null;
   if(!identity)clear();
   return identity;
  }catch{clear();return null;}
 }
 async function request(path,options={}){
  const res=await fetch(path,{...options,credentials:'same-origin',headers:{Accept:'application/json',...options.headers}});
  if(res.status===401){clear();window.dispatchEvent(new Event('koteka:session-expired'));}
  return res;
 }
 async function record(entry){
  if(!identity)return;
  const res=await request('/api/admin-activity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(entry)});
  if(!res.ok)throw Error('Aktivitas belum tersimpan.');
  window.KotekaServerAnalytics?.refresh();
 }
 async function logout(){
  const res=await request('/api/admin-session',{method:'DELETE'});
  if(!res.ok)throw Error('Keluar belum berhasil. Coba kembali.');
  clear();
  window.dispatchEvent(new Event('koteka:session-expired'));
  await window.KotekaLaravel?.reload();
 }
 window.KotekaAccess={loginResponse,restore,request,record,logout,clear,isSuperAdmin:()=>identity?.role==='super_admin',get user(){return publicUser(identity);}};
})();
