/* Role-aware Workspace access. Browser storage is used only by the localhost demo. */
(()=>{'use strict';
 const AUTH='koteka.admin.demo.session.v1',SESSION='koteka.workspace.identity.v1',DB='koteka.workspace.access.demo.v1',INBOX='koteka.consultation.demo.v1';
 // Server-rendered Laravel pages must never fall back to simulated login when an API fails.
 const localHost=['localhost','127.0.0.1','::1','[::1]'].includes(window.location.hostname) && !document.querySelector('meta[name="csrf-token"]');
 const owner={id:'admin',name:'Super Admin Koteka Digital',email:'superadmin@kotekadigital.com',role:'super_admin',active:true,version:1,locked:true};
 let identity=null,mode=null;
 const response=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 const clean=(value,max=150)=>String(value??'').trim().slice(0,max);
 const publicUser=u=>u?Object.fromEntries(['id','name','email','role','active','version','locked'].map(k=>[k,u[k]])):null;
 const read=()=>{const raw=localStorage.getItem(DB);if(!raw)return null;const db=JSON.parse(raw);if(!Array.isArray(db.accounts)||!Array.isArray(db.activity))throw Error('Penyimpanan akun lokal tidak valid.');return db;};
 const save=db=>localStorage.setItem(DB,JSON.stringify(db));
 const withLock=fn=>typeof navigator!=='undefined'&&navigator.locks?.request?navigator.locks.request(DB,fn):fn();
 const bytesHex=value=>Array.from(new Uint8Array(value),n=>n.toString(16).padStart(2,'0')).join('');
 async function passwordHash(password,salt=bytesHex(crypto.getRandomValues(new Uint8Array(16)))){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const hash=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:210000,hash:'SHA-256'},key,256);
  return {salt,hash:bytesHex(hash)};
 }
 async function database(){let db=read();if(db)return db;db={accounts:[{id:'demo-admin',name:'Administrator Koteka Digital',email:'admin@kotekadigital.com',role:'admin',active:true,version:1,passwordHash:await passwordHash('KotekaDemo@2026')}],activity:[]};save(db);return db;}
 function currentUser(){
  if(!identity)return null;
  if(mode==='server')return publicUser(identity);
  try{const u=identity.id===owner.id?owner:read()?.accounts.find(u=>u.id===identity.id);return u?.active&&u.version===identity.version?publicUser(u):null;}catch{return null;}
 }
 function clear(){identity=null;mode=null;sessionStorage.removeItem(SESSION);sessionStorage.removeItem(AUTH);}
 function setIdentity(user,nextMode){identity=publicUser(user);mode=nextMode;sessionStorage.setItem(SESSION,JSON.stringify({id:user.id,version:user.version,mode:nextMode}));}
 const actor=u=>({id:u.id,name:u.name,email:u.email,role:u.role});
 function log(db,user,module,description){db.activity.unshift({id:crypto.randomUUID(),date:new Date().toISOString(),user:actor(user),module:clean(module,80),description:clean(description,500)});db.activity=db.activity.slice(0,2000);}
 const unavailable=res=>[404,405,501,503].includes(res.status)||(res.ok&&!(res.headers.get('content-type')||'').includes('application/json'));
 async function loginResponse(email,password,options={}){
  clear();
  const res=await fetch('/api/admin-session',{...options,method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  if(!localHost||!unavailable(res)){
   const data=await res.clone().json().catch(()=>({}));
   if(res.ok&&data.authenticated===true&&data.user){setIdentity(data.user,'server');}
   return res;
  }
  return withLock(async()=>{try{
   const db=await database(),normalized=clean(email,120).toLowerCase();
   let user=null;
   if(normalized===owner.email&&password==='KotekaDemo@2026')user=owner;
   else{const row=db.accounts.find(u=>u.email===normalized&&u.active);if(row&&typeof password==='string'&&(await passwordHash(password,row.passwordHash.salt)).hash===row.passwordHash.hash)user=row;}
   if(!user)return response(401,{error:'Email atau kata sandi tidak cocok, atau akun tidak aktif.'});
   log(db,user,'Autentikasi','Login Workspace lokal');save(db);setIdentity(user,'local');
   return response(200,{authenticated:true,user:publicUser(user),simulation:true});
  }catch{return response(507,{error:'Akun lokal tidak dapat disimpan atau dibaca.'});}});
 }
 async function restore(){
  try{
   const res=await fetch('/api/admin-session',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
   if(!localHost||!unavailable(res)){
    const data=await res.json().catch(()=>({}));
    if(res.ok&&data.authenticated===true&&data.user){setIdentity(data.user,'server');sessionStorage.setItem(AUTH,'ok');return currentUser();}
    clear();return null;
   }
   mode='local';
   if(sessionStorage.getItem(AUTH)!=='ok'){identity=null;return null;}
   return withLock(async()=>{
    const db=await database();let saved=null;
    try{saved=JSON.parse(sessionStorage.getItem(SESSION));}catch{}
    // Migrate existing demo sessions as Admin; a profile label never grants privileges.
    const row=saved?.mode==='local'?(saved.id===owner.id?owner:db.accounts.find(u=>u.id===saved.id)):db.accounts.find(u=>u.id==='demo-admin');
    if(!row?.active||(saved?.mode==='local'&&row.version!==saved.version)){clear();return null;}
    setIdentity(row,'local');return currentUser();
   });
  }catch{clear();return null;}
 }
 async function localRequest(path,options){
  const user=currentUser();if(!user)return response(401,{error:'Sesi berakhir. Silakan masuk kembali.'});
  const method=(options.method||'GET').toUpperCase();
  let input;try{input=JSON.parse(options.body||'{}');}catch{return response(400,{error:'JSON tidak valid.'});}
  const db=await database();
  if(path==='/api/admin-accounts'){
   if(user.role!=='super_admin')return response(403,{error:'Hanya Super Admin yang dapat mengelola akun.'});
   if(method==='GET')return response(200,{items:[owner,...db.accounts].map(publicUser),simulation:true});
   if(!['POST','PATCH','DELETE'].includes(method))return response(405,{error:'Metode tidak didukung.'});
   if(input.id===owner.id)return response(403,{error:'Akun Super Admin utama dilindungi.'});
   const existing=db.accounts.find(u=>u.id===input.id);
   if(method!=='POST'&&!existing)return response(404,{error:'Akun tidak ditemukan.'});
   if(method!=='POST'&&(!Number.isInteger(input.expectedVersion)||input.expectedVersion<1))return response(422,{error:'Versi akun diperlukan. Muat ulang daftar akun.'});
   if(existing&&input.expectedVersion!==existing.version)return response(409,{error:'Akun sudah diubah di tab lain. Muat ulang sebelum menyimpan.'});
   if(method==='DELETE'){
    db.accounts=db.accounts.filter(u=>u.id!==input.id);log(db,user,'Account Control',`Menghapus akun ${existing.email}`);save(db);return response(200,{ok:true});
   }
   const email=clean(input.email??existing?.email,120).toLowerCase(),name=clean(input.name??existing?.name,80),password=input.password||'',role=input.role??existing?.role,active=input.active??existing?.active;
   if(name.length<2||!/^\S+@\S+\.\S+$/.test(email)||!['admin','operator'].includes(role)||typeof active!=='boolean'||(method==='POST'||password)&& (typeof password!=='string'||password.length<12||password.length>128))return response(422,{error:'Nama, email, peran, status, atau password (12–128 karakter) tidak valid.'});
   if(email===owner.email||db.accounts.some(u=>u.email===email&&u.id!==existing?.id))return response(409,{error:'Email sudah digunakan.'});
   const row={id:existing?.id||crypto.randomUUID(),name,email,role,active,version:(existing?.version||0)+1,passwordHash:password?await passwordHash(password):existing.passwordHash};
   if(existing)db.accounts[db.accounts.indexOf(existing)]=row;else db.accounts.push(row);
   log(db,user,'Account Control',`${existing?'Memperbarui':'Menambahkan'} akun ${email} (${row.role}, ${row.active?'aktif':'nonaktif'})`);save(db);
   return response(existing?200:201,{ok:true,item:publicUser(row),simulation:true});
  }
  if(path==='/api/admin-activity'){
   if(method==='GET')return user.role==='super_admin'?response(200,{items:db.activity,simulation:true}):response(403,{error:'Hanya Super Admin yang dapat melihat aktivitas admin.'});
   if(method!=='POST')return response(405,{error:'Metode tidak didukung.'});
   if(!clean(input.module,80)||!clean(input.description,500))return response(422,{error:'Aktivitas tidak lengkap.'});
   log(db,user,input.module,input.description);save(db);return response(201,{ok:true,simulation:true});
  }
  if(path==='/api/inbox-reply'){
   if(method!=='POST')return response(405,{error:'Metode tidak didukung.'});
   if(input.channel!=='whatsapp_confirm'||input.confirmed!==true||typeof input.text!=='string'||input.text.trim().length<3||input.text.length>5000||!(/^[\w-]{8,100}$/).test(input.requestId||''))return response(422,{error:'Konfirmasi balasan WhatsApp yang sudah terkirim diperlukan.'});
   const items=JSON.parse(localStorage.getItem(INBOX)||'[]'),item=items.find(m=>m.id===input.id);
   if(!item)return response(404,{error:'Pesan tidak ditemukan.'});
   const receiptKey=`${input.id}:${input.requestId}`,receipt=db.replyReceipts?.[receiptKey]||item.replies?.find(r=>r.requestId===input.requestId);
   if(receipt)return receipt.text===input.text.trim()&&receipt.channel===input.channel?response(200,{ok:true,item,simulation:true}):response(409,{error:'ID konfirmasi sudah digunakan untuk balasan berbeda.'});
   const date=new Date().toISOString();
   const reply={requestId:input.requestId,text:input.text.trim(),channel:input.channel,date,user:actor(user)};
   Object.assign(item,{read:true,replied:true,repliedAt:date,repliedBy:actor(user),replyChannel:input.channel,replies:[...(item.replies||[]),reply].slice(-20)});
   log(db,user,'Pesan Masuk',`Mengonfirmasi balasan WhatsApp untuk ${clean(item.nama,90)}`);
   db.replyReceipts={...(db.replyReceipts||{}),[receiptKey]:{text:reply.text,channel:reply.channel}};
   // Roll back the audit write if saving the shared Inbox fails.
   const previous=localStorage.getItem(DB);save(db);
   try{localStorage.setItem(INBOX,JSON.stringify(items));}catch(e){if(previous!==null)localStorage.setItem(DB,previous);throw e;}
   try{localStorage.setItem('koteka.consultation.updated',date);}catch{}
   return response(200,{ok:true,item,simulation:true});
  }
  if(path==='/api/inbox')return (window.KotekaConsultation?.request||fetch)(path,options);
  return response(404,{error:'API tidak ditemukan.'});
 }
 async function request(path,options={}){
  if(mode==='local'){
   try{const res=await withLock(()=>localRequest(path,options));if(res.status===401){clear();window.dispatchEvent?.(new Event('koteka:session-expired'));}return res;}catch{return response(507,{error:'Perubahan belum tersimpan. Penyimpanan lokal tidak tersedia.'});}
  }
  const res=await fetch(path,{...options,credentials:'same-origin'});
  if(res.status===401){clear();window.dispatchEvent?.(new Event('koteka:session-expired'));}
  return res;
 }
 async function record(entry){if(!currentUser())return;const res=await request('/api/admin-activity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(entry)});if(!res.ok)throw Error('Aktivitas belum tersimpan.');}
 async function logout(){
  if(mode==='local'){await withLock(async()=>{const user=currentUser();if(user){const db=await database();log(db,user,'Autentikasi','Logout Workspace lokal');save(db);}});}
  else{const res=await fetch('/api/admin-session',{method:'DELETE',credentials:'same-origin'});if(!res.ok)throw Error('Logout server belum dikonfirmasi.');}
  clear();
 }
 window.addEventListener('storage',event=>{if(event.key===DB&&mode==='local'&&identity&&!currentUser()){clear();window.dispatchEvent?.(new Event('koteka:session-expired'));}});
 window.KotekaAccess={loginResponse,restore,request,record,logout,clear,isSuperAdmin:()=>currentUser()?.role==='super_admin',get user(){return currentUser();},get simulation(){return mode==='local';}};
})();
