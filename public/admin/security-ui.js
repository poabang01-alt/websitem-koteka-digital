/* Screens and reply controls scoped to account access and Inbox follow-up. */
(()=>{'use strict';
 const $=q=>document.querySelector(q);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const roleLabel=r=>({super_admin:'Super Admin',admin:'Admin',operator:'Operator'}[r]||r);
 const date=value=>new Date(value).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'medium',timeZone:'Asia/Jayapura'})+' WIT';
 let bridge,accounts=[],activityRows=[],activityPage=0,activityPageSize=10,activityPanel=null,replyMessage=null,replyRequestId=null,renderVersion=0;
 const access=()=>window.KotekaAccess;
 const api=async(path,body,method=body?'POST':'GET')=>{
  const res=await access().request(path,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store'});
  const value=await res.json().catch(()=>({}));if(!res.ok)throw Error(value.error||'Permintaan belum berhasil.');return value;
 };
 const header=(title,description)=>`<div class="page-heading"><div><span class="page-kicker">KOTEKA DIGITAL / SUPER ADMIN</span><h1>${title}</h1><p>${description}</p></div><button type="button" class="btn btn-light" data-security-action="refresh"><i class="fa-solid fa-rotate" aria-hidden="true"></i> Refresh</button></div>`;
 function authorized(){return access()?.isSuperAdmin()===true;}
 function accountForm(row){
  const editing=!!row;
  return `<section class="panel panel-pad kd-account-editor" aria-labelledby="kdAccountEditorTitle"><div class="panel-head"><div><h2 id="kdAccountEditorTitle">${editing?'Edit Akun':'Tambah Akun'}</h2><p>${editing?'Perubahan akun mengakhiri sesi login sebelumnya.':'Buat akses Admin atau Operator untuk Workspace.'}</p></div></div>
  <form id="kdAccountForm" data-id="${esc(row?.id||'')}" data-version="${esc(row?.version||'')}" class="kd-security-form">
  <label>Nama lengkap<input name="name" required minlength="2" maxlength="80" value="${esc(row?.name||'')}" autocomplete="name"></label>
  <label>Email akun<input name="email" type="email" required maxlength="120" value="${esc(row?.email||'')}" autocomplete="username"></label>
  <label>Peran<select name="role"><option value="admin" ${row?.role==='admin'?'selected':''}>Admin</option><option value="operator" ${row?.role==='operator'?'selected':''}>Operator</option></select></label>
  <label>Password ${editing?'baru (opsional)':''}<input name="password" type="password" ${editing?'':'required'} minlength="12" maxlength="128" autocomplete="new-password" placeholder="${editing?'Kosongkan untuk mempertahankan password':'Minimal 12 karakter'}"></label>
  <label class="kd-security-check"><input type="checkbox" name="active" ${!row||row.active?'checked':''}> Akun aktif</label>
  <p class="kd-security-error" role="alert" hidden></p><div class="kd-security-actions"><button type="submit" class="btn btn-primary">${editing?'Simpan Perubahan':'Tambah Akun'}</button><button type="button" class="btn btn-light" data-security-action="cancel-edit">Batal</button></div></form></section>`;
 }
 async function render(which,container){
  const version=++renderVersion;
  if(!authorized()){bridge.go('dashboard');return;}
  const accountPage=which==='accounts';
  container.innerHTML=header(accountPage?'Account Control':'Admin Activity Logs',accountPage?'Kelola akun, peran, dan status akses Admin / Operator.':'Jejak aktivitas Super Admin, Admin, dan Operator · waktu Papua (WIT).')+`<section class="panel panel-pad kd-security-panel" aria-busy="true"><p role="status">Memuat ${accountPage?'akun':'aktivitas'}...</p></section>`;
  try{
   const data=await api(accountPage?'/api/admin-accounts':'/api/admin-activity');
   if(version!==renderVersion||!authorized()||container.dataset.module!==which)return;
   const panel=container.querySelector('.kd-security-panel');panel.removeAttribute('aria-busy');
   if(accountPage){
    accounts=data.items||[];
    panel.innerHTML=`<div class="panel-head"><div><h2>Akun Workspace</h2><p>${accounts.length} akun · akun Super Admin utama dilindungi</p></div><button type="button" class="btn btn-primary" data-security-action="add-account"><i class="fa-solid fa-plus" aria-hidden="true"></i> Tambah Akun</button></div><div class="kd-security-table-wrap"><table class="kd-security-table"><thead><tr><th>Pengguna</th><th>Peran</th><th>Status</th><th>Tindakan</th></tr></thead><tbody>${accounts.map(u=>`<tr><td><strong>${esc(u.name)}</strong><small>${esc(u.email)}</small></td><td><span class="tag">${esc(roleLabel(u.role))}</span></td><td><span class="kd-account-status ${u.active?'is-active':''}">${u.active?'Aktif':'Nonaktif'}</span></td><td>${u.locked?'<span class="kd-security-muted"><i class="fa-solid fa-lock" aria-hidden="true"></i> Dilindungi</span>':`<div class="kd-security-row-actions"><button type="button" class="btn btn-light btn-xs" data-security-action="edit-account" data-id="${esc(u.id)}">Edit</button><button type="button" class="btn btn-light btn-xs" data-security-action="toggle-account" data-id="${esc(u.id)}">${u.active?'Nonaktifkan':'Aktifkan'}</button><button type="button" class="btn btn-danger btn-xs" data-security-action="delete-account" data-id="${esc(u.id)}">Hapus</button></div>`}</td></tr>`).join('')}</tbody></table></div>`;
   }else{
    const rows=data.items||[];
    activityRows=rows;activityPage=0;activityPanel=panel;paintActivityPage();
   }
  }catch(e){
   if(version!==renderVersion||container.dataset.module!==which)return;
   if(!authorized()){bridge.go('dashboard');return;}
   container.querySelector('.kd-security-panel').innerHTML=`<p class="kd-security-error" role="alert">${esc(e.message)}</p><button type="button" class="btn btn-light" data-security-action="refresh">Coba Lagi</button>`;
  }
 }
 function paintActivityPage(){
  const panel=activityPanel;if(!panel)return;
  const pages=Math.max(1,Math.ceil(activityRows.length/activityPageSize));activityPage=Math.max(0,Math.min(activityPage,pages-1));
  const begin=activityPage*activityPageSize,rows=activityRows.slice(begin,begin+activityPageSize);
  const action=(label,target,disabled=false,current=false)=>`<button type="button" class="btn btn-light btn-xs ${current?'is-current':''}" data-security-action="activity-page" data-page="${target}" ${disabled?'disabled':''} ${current?'aria-current="page"':''}>${label}</button>`;
  const low=Math.max(0,Math.min(activityPage-2,pages-5)),high=Math.min(pages,low+5);
  const controls=`<nav class="pagination-row" aria-label="Navigasi Log Aktivitas Admin"><span>Menampilkan ${activityRows.length?begin+1:0}–${Math.min(begin+activityPageSize,activityRows.length)} dari ${activityRows.length} data</span><div class="pagination-controls"><label class="pagination-size-label">Baris per halaman <select id="adminActivityPageSize" aria-label="Baris Log Aktivitas Admin per halaman">${[10,25,50].map(v=>`<option value="${v}" ${activityPageSize===v?'selected':''}>${v}</option>`).join('')}</select></label>${action('« Awal',0,activityPage===0)}${action('← Sebelumnya',activityPage-1,activityPage===0)}${Array.from({length:high-low},(_,i)=>action(String(low+i+1),low+i,false,low+i===activityPage)).join('')}${action('Berikutnya →',activityPage+1,activityPage>=pages-1)}${action('Akhir »',pages-1,activityPage>=pages-1)}</div></nav>`;
  panel.innerHTML=`<div class="panel-head"><div><h2>Riwayat Aktivitas Admin</h2><p>${activityRows.length} aktivitas terbaru · identitas tercatat dari sesi akun</p></div><div class="kd-security-row-actions"><button type="button" class="btn btn-danger" data-security-action="delete-all-activity">Hapus Semua</button><button type="button" class="btn btn-primary" data-security-action="export-activity"><i class="fa-solid fa-file-pdf" aria-hidden="true"></i> Unduh PDF</button></div></div><div class="kd-security-table-wrap"><table class="kd-security-table"><thead><tr><th>Pengguna</th><th>Peran</th><th>Aktivitas</th><th>Tanggal & Waktu</th><th>Tindakan</th></tr></thead><tbody>${rows.map(x=>`<tr><td><strong>${esc(x.user?.name||x.actor||'Administrator')}</strong><small>${esc(x.user?.email||'')}</small></td><td><span class="tag">${esc(roleLabel(x.user?.role||x.role||''))}</span></td><td><strong>${esc(x.module)}</strong><span>${esc(x.description)}</span></td><td class="kd-audit-date">${esc(date(x.date))}</td><td><button type="button" class="btn btn-danger btn-xs" data-security-action="delete-activity" data-id="${esc(x.id)}">Hapus</button></td></tr>`).join('')||'<tr><td colspan="5">Belum ada aktivitas admin.</td></tr>'}</tbody></table></div>${controls}`;
 }
 function editAccount(row){
  if(!authorized()||row?.locked)return;
  $('.kd-account-editor')?.remove();$('#mainContent').insertAdjacentHTML('beforeend',accountForm(row));
  $('.kd-account-editor input').focus();$('.kd-account-editor').scrollIntoView({block:'nearest',behavior:'smooth'});
 }
 function accountConfirmation(row,remove){
  if(!authorized()||!row||row.locked)return;
  const panel=$('.kd-security-panel');panel.querySelector('.kd-account-confirm')?.remove();
  panel.insertAdjacentHTML('beforeend',`<div class="kd-account-confirm" role="alert"><p>${remove?'Hapus akun':'Nonaktifkan akun'} <strong>${esc(row.email)}</strong>? Sesi akun ini akan berakhir.${remove?' Akun diarsipkan dan tidak dapat digunakan untuk masuk.':''}</p><div class="kd-security-actions"><button type="button" class="btn btn-danger" data-security-action="confirm-${remove?'delete':'disable'}" data-id="${esc(row.id)}">${remove?'Hapus Akun':'Nonaktifkan Akun'}</button><button type="button" class="btn btn-light" data-security-action="cancel-confirm">Batal</button></div></div>`);
  panel.querySelector('.kd-account-confirm button').focus();
 }
 async function accountAction(button){
  if(!authorized())return;
  const action=button.dataset.securityAction,row=accounts.find(u=>u.id===button.dataset.id);
  if(action==='activity-page'){if(button.disabled)return;activityPage=Number(button.dataset.page)||0;return paintActivityPage();}
  if(action==='export-activity'){const output=window.KotekaPDF?.exportAdminActivity(activityRows);if(output)bridge.toast(`PDF Log Admin berhasil diunduh (${output.records} data).`);return;}
  if(action==='delete-activity'||action==='delete-all-activity'){
   const id=button.dataset.id;
   return bridge.confirmDeletion(id?'Hapus log admin ini?':'Hapus semua log admin?',id?'Log ini akan dihapus permanen.':'Seluruh log admin akan dihapus permanen, termasuk yang tidak sedang ditampilkan.',async()=>{
    await api('/api/activity-logs',id?{scope:'admin',ids:[id],confirmed:true}:{scope:'admin',all:true,confirmed:true},'DELETE');
    await window.KotekaServerAnalytics?.refresh();
    if($('#mainContent').dataset.module==='admin-activity')await render('admin-activity',$('#mainContent'));
    bridge.toast('Log admin berhasil dihapus.');
   });
  }
  if(action==='add-account')return editAccount();
  if(action==='edit-account')return editAccount(row);
  if(action==='cancel-edit')return $('.kd-account-editor')?.remove();
  if(action==='cancel-confirm')return $('.kd-account-confirm')?.remove();
  if(action==='delete-account')return accountConfirmation(row,true);
  if(action==='toggle-account'&&row?.active)return accountConfirmation(row,false);
  if(action==='refresh')return render($('#mainContent').dataset.module,$('#mainContent'));
  if(!row||row.locked)return;
  if(!['toggle-account','confirm-disable','confirm-delete'].includes(action))return;
  button.disabled=true;
  try{await api('/api/admin-accounts',action==='confirm-delete'?{id:row.id,expectedVersion:row.version}:{id:row.id,expectedVersion:row.version,active:action==='toggle-account'},action==='confirm-delete'?'DELETE':'PATCH');bridge.toast('Akun berhasil diperbarui.');await render('accounts',$('#mainContent'));}
  catch(e){bridge.toast(e.message,'error');button.disabled=false;}
 }
 async function saveAccount(event){
  event.preventDefault();if(!authorized())return;
  const form=event.target;if(!form.reportValidity())return;
  const button=form.querySelector('[type=submit]'),error=form.querySelector('[role=alert]');
  if(button.disabled)return;button.disabled=true;error.hidden=true;
  const values=Object.fromEntries(new FormData(form));values.active=form.elements.active.checked;if(form.dataset.id){values.id=form.dataset.id;values.expectedVersion=Number(form.dataset.version);}
  try{await api('/api/admin-accounts',values,values.id?'PATCH':'POST');bridge.toast(values.id?'Perubahan akun tersimpan.':'Akun berhasil ditambahkan.');await render('accounts',$('#mainContent'));}
  catch(e){error.textContent=e.message;error.hidden=false;button.disabled=false;}
 }
 function openReply(id){
  const message=bridge.getMessage(id);if(!message||!access()?.user)return;
  const number=String(message.wa||'').replace(/\D/g,'').replace(/^0/,'62');
  if(!/^62\d{9,13}$/.test(number))return bridge.toast('Nomor WhatsApp pelanggan tidak valid.','error');
  replyMessage=message;replyRequestId=crypto.randomUUID();
  const dialog=$('#kdReplyDialog');
  dialog.innerHTML=`<div class="dialog-head"><div><span class="overline">PESAN MASUK / WHATSAPP</span><h2 id="kdReplyTitle">Balas ${esc(message.nama||'Pelanggan')}</h2></div><button type="button" class="icon-button" data-reply-close aria-label="Tutup balasan">×</button></div><form id="kdReplyForm" class="kd-reply-form"><p>${esc(message.pesan)}</p><label>Isi balasan<textarea name="text" required minlength="3" maxlength="5000" rows="5" placeholder="Tulis balasan untuk pelanggan..."></textarea></label><a id="kdOpenWhatsapp" class="btn btn-light" href="https://wa.me/${number}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Buka WhatsApp</a><p class="kd-security-muted">Kirim pesan di WhatsApp, lalu kembali dan konfirmasi. Membuka WhatsApp tidak mengubah status balasan.</p><label class="kd-security-check"><input name="confirmed" type="checkbox" required> Saya sudah mengirim balasan ini di WhatsApp.</label><p class="kd-security-error" role="alert" hidden></p><div class="kd-security-actions"><button type="submit" class="btn btn-primary">Konfirmasi Terkirim</button><button type="button" class="btn btn-light" data-reply-close>Batal</button></div>${message.repliedAt?`<small class="kd-security-muted">Balasan terakhir: ${esc(date(message.repliedAt))} · ${esc(message.repliedBy?.name||'Admin')}</small>`:''}</form>`;
  dialog.querySelector('textarea').addEventListener('input',event=>{dialog.querySelector('#kdOpenWhatsapp').href=`https://wa.me/${number}?text=${encodeURIComponent(event.target.value)}`;});
  dialog.querySelector('#kdOpenWhatsapp').addEventListener('click',()=>bridge.writeLog('editor','Pesan Masuk',`Membuka WhatsApp untuk ${message.nama||'pelanggan'}`));
  dialog.showModal();
 }
 async function confirmReply(event){
  event.preventDefault();const form=event.target;if(!form.reportValidity()||!replyMessage)return;
  const button=form.querySelector('[type=submit]'),error=form.querySelector('[role=alert]');if(button.disabled)return;
  button.disabled=true;error.hidden=true;
  try{
   await api('/api/inbox-reply',{id:replyMessage.id,channel:'whatsapp_confirm',confirmed:form.elements.confirmed.checked,text:form.elements.text.value,requestId:replyRequestId});
   $('#kdReplyDialog').close();bridge.toast('Status diperbarui: Replied.');await bridge.loadInbox();
  }catch(e){error.textContent=e.message;error.hidden=false;button.disabled=false;}
 }
 function connect(context){
  bridge=context;const dialog=document.createElement('dialog');dialog.id='kdReplyDialog';dialog.className='kd-reply-dialog';dialog.setAttribute('aria-labelledby','kdReplyTitle');document.body.append(dialog);
  dialog.addEventListener('close',()=>{replyMessage=null;replyRequestId=null;dialog.replaceChildren();});
  document.addEventListener('click',event=>{
   const button=event.target.closest('[data-security-action]');if(button){event.preventDefault();accountAction(button);}
   const reply=event.target.closest('[data-reply-id]');if(reply){event.preventDefault();openReply(reply.dataset.replyId);}
   if(event.target.closest('[data-reply-close]'))dialog.close();
  
  });
  document.addEventListener('change',event=>{if(event.target?.id==='adminActivityPageSize'){const value=Number(event.target.value);if([10,25,50].includes(value)){activityPageSize=value;activityPage=0;paintActivityPage();}}});
  document.addEventListener('submit',event=>{if(event.target.id==='kdAccountForm')saveAccount(event);if(event.target.id==='kdReplyForm')confirmReply(event);});
 }
 window.KotekaSecurityUI={connect,render,openReply,closeReply:()=>$('#kdReplyDialog')?.close()};
})();
