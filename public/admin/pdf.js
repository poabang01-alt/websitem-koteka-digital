/* Dependency-free dashboard PDF reports. Landscape A4, wrapped cells and
   bounded row continuations keep every record readable across pages. */
(function(){'use strict';
const W=842,H=595,M=34,TABLE=W-M*2,BOTTOM=536,SIZE=8,LEADING=11,PAD=7;
// Helvetica uses WinAnsi. Keep Western characters; normalize punctuation that
// otherwise has no glyph in the built-in PDF font. PDF syntax stays ASCII.
const printable=value=>String(value??'').replace(/\r\n?/g,'\n').replace(/\t/g,'    ').replace(/[\u2010-\u2015]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/\u2026/g,'...').replace(/[^\x20-\x7e\xa0-\xff\n]/g,'?');
const esc=value=>printable(value).replace(/[\\()]/g,'\\$&').replace(/[\xa0-\xff]/g,c=>'\\'+c.charCodeAt(0).toString(8).padStart(3,'0'));
const value=v=>v===undefined||v===null||v===''?'-':String(v);
const fmt=input=>{
 if(input===undefined||input===null||input==='')return '-';
 const d=new Date(input);if(Number.isNaN(d.getTime()))return '-';
 const p=new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jayapura',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d);
 const part=type=>p.find(x=>x.type===type)?.value||'';
 return `${part('day')} ${part('month')} ${part('year')}, ${part('hour')}:${part('minute')} WIT`;
};
const stamp=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jayapura',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const widths={};
// Standard Helvetica character advances, in thousandths of an em.
' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'.split('').forEach((c,i)=>{widths[c]=[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584][i];});
function charWidth(c,size,bold=false){const plain=c.normalize('NFD').replace(/[\u0300-\u036f]/g,'');return (widths[plain]||600)*size/1000*(bold?1.08:1);}
function wrap(input,width,size=SIZE,bold=false){
 const result=[];
 for(const paragraph of printable(input).split('\n')){
  let line='',used=0;
  for(const word of paragraph.split(/ +/)){
   if(!word)continue;
   const wordWidth=[...word].reduce((n,c)=>n+charWidth(c,size,bold),0),space=charWidth(' ',size,bold);
   if(line&&used+space+wordWidth<=width){line+=' '+word;used+=space+wordWidth;continue;}
   if(line){result.push(line);line='';used=0;}
   for(const ch of word){const next=charWidth(ch,size,bold);if(line&&used+next>width){result.push(line);line='';used=0;}line+=ch;used+=next;}
  }
  result.push(line);
 }
 return result.length?result:[''];
}
function build({heading,subtitle,columns,rows,summary=[],filename}){
 const pages=[];let cmds=[],y=0;
 const color=rgb=>rgb.join(' '),cmd=s=>cmds.push(s);
 function rect(x,top,w,h,rgb){cmd(`${color(rgb)} rg ${x} ${H-top-h} ${w} ${h} re f`);}
 function line(x,top,x2,top2,rgb=[.85,.89,.92]){cmd(`${color(rgb)} RG 0.5 w ${x} ${H-top} m ${x2} ${H-top2} l S`);}
 function text(s,x,top,{size=SIZE,bold=false,fill=[.17,.23,.29]}={}){cmd(`BT /${bold?'F2':'F1'} ${size} Tf ${color(fill)} rg 1 0 0 1 ${x} ${H-top-size} Tm (${esc(s)}) Tj ET`);}
 const generated=fmt(Date.now());
 function tableHeader(){
  const labels=columns.map(c=>wrap(c.label,c.width-PAD*2,8,true));
  const height=Math.max(...labels.map(x=>x.length))*LEADING+PAD*2;
  rect(M,y,TABLE,height,[.06,.18,.27]);
  let x=M;columns.forEach((c,i)=>{labels[i].forEach((s,j)=>text(s,x+PAD,y+PAD+j*LEADING,{bold:true,fill:[1,1,1]}));x+=c.width;});y+=height;
 }
 function start(){
  cmds=[];rect(0,0,W,6,[.05,.18,.27]);rect(M,29,4,25,[.82,.62,.25]);
  text('KOTEKA DIGITAL',M+14,28,{size:12,bold:true,fill:[.06,.18,.27]});
  text('WORKSPACE / LAPORAN DASHBOARD',M+14,46,{size:7,fill:[.4,.47,.53]});
  text(heading,M,69,{size:18,bold:true,fill:[.06,.18,.27]});
  y=97;for(const s of wrap(subtitle,TABLE,8)){text(s,M,y,{fill:[.38,.45,.51]});y+=LEADING;}
  text(`Dihasilkan: ${generated}  |  Total data: ${rows.length}`,M,y+3,{size:7,fill:[.38,.45,.51]});y+=25;
  if(!pages.length&&summary.length){
   const gap=10,width=(TABLE-gap*(summary.length-1))/summary.length;
   const items=summary.map(s=>({label:wrap(s.label,width-20,7),value:wrap(value(s.value),width-20,12,true)}));
   const height=Math.max(...items.map(s=>s.label.length*10+s.value.length*14))+20;
   items.forEach((s,i)=>{const x=M+i*(width+gap);rect(x,y,width,height,[.95,.97,.98]);s.label.forEach((v,j)=>text(v,x+10,y+8+j*10,{size:7,fill:[.4,.47,.53]}));s.value.forEach((v,j)=>text(v,x+10,y+12+s.label.length*10+j*14,{size:12,bold:true,fill:[.06,.18,.27]}));});
   y+=height+14;
  }
  tableHeader();
 }
 function finish(){pages.push(cmds);}
 start();
 if(!rows.length){rect(M,y,TABLE,47,[.97,.98,.99]);text('Tidak ada data pada filter yang dipilih.',M+PAD,y+17,{size:10});}
 rows.forEach((row,index)=>{
  const cells=columns.map(c=>wrap(value(row[c.key]),c.width-PAD*2));
  const count=Math.max(...cells.map(c=>c.length));let offset=0;
  // Move an ordinary row intact when possible. Very tall rows continue by a
  // bounded number of lines, with the same column grid on every page.
  if(y+(count*LEADING+PAD*2)>BOTTOM&&y>260&&count*LEADING+PAD*2<310){finish();start();}
  while(offset<count){
   let fit=Math.floor((BOTTOM-y-PAD*2)/LEADING);
   if(fit<1){finish();start();fit=Math.floor((BOTTOM-y-PAD*2)/LEADING);}
   const take=Math.min(count-offset,fit),height=take*LEADING+PAD*2;
   if(index%2===0)rect(M,y,TABLE,height,[.965,.975,.982]);
   let x=M;columns.forEach((c,i)=>{cells[i].slice(offset,offset+take).forEach((s,j)=>text(s,x+PAD,y+PAD+j*LEADING));x+=c.width;});
   line(M,y+height,M+TABLE,y+height);y+=height;offset+=take;
   if(offset<count){finish();start();}
  }
 });
 finish();
 pages.forEach((commands,i)=>{cmds=commands;line(M,552,W-M,552);text('KOTEKA DIGITAL  |  Waktu Indonesia Timur (UTC+09:00)',M,561,{size:7,fill:[.4,.47,.53]});const label=`Halaman ${i+1} dari ${pages.length}`;text(label,W-M-100,561,{size:7,bold:true,fill:[.4,.47,.53]});});
 const objects=[],add=s=>(objects.push(s),objects.length);
 const regular=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
 const bold=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
 const parent=add(''),ids=[];
 pages.forEach(commands=>{const stream=commands.join('\n'),content=add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);ids.push(add(`<< /Type /Page /Parent ${parent} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> >> /Contents ${content} 0 R >>`));});
 objects[parent-1]=`<< /Type /Pages /Kids [${ids.map(i=>i+' 0 R').join(' ')}] /Count ${ids.length} >>`;
 const catalog=add(`<< /Type /Catalog /Pages ${parent} 0 R >>`),info=add(`<< /Title (${esc(heading)}) /Author (Koteka Digital) /Subject (${esc(subtitle)}) /Creator (Koteka Workspace) >>`);
 let output='%PDF-1.4\n%KOTEKA\n';const offsets=[0];
 objects.forEach((o,i)=>{offsets.push(output.length);output+=`${i+1} 0 obj\n${o}\nendobj\n`;});
 const xref=output.length;output+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
 for(let i=1;i<=objects.length;i++)output+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
 output+=`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF`;
 const data=new Uint8Array(output.length);for(let i=0;i<output.length;i++)data[i]=output.charCodeAt(i);
 const url=URL.createObjectURL(new Blob([data],{type:'application/pdf'})),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),6000);
 return {pages:pages.length,records:rows.length};
}
const col=(key,label,width)=>({key,label,width});
const period=meta=>`${meta.from||'Semua tanggal'} - ${meta.to||'Sekarang'}`;
const activityLabel=kind=>({editor:'Perubahan Konten',visitor:'Kunjungan',system:'Sistem'}[kind]||kind||'-');
const statusLabel=status=>({all:'Semua status',unread:'Belum dibaca',read:'Sudah dibaca',replied:'Sudah dibalas','not-replied':'Belum dibalas'}[status]||status||'Semua status');
window.KotekaPDF={
 exportTraffic(records,meta={}){return build({heading:'Laporan Trafik Pengunjung',subtitle:`Periode: ${meta.period||'Semua periode'} | Kanal: ${meta.channel||'Semua'} | Perangkat: ${meta.device||'Semua'}`,summary:[{label:'Total tayangan',value:meta.total??records.reduce((sum,r)=>sum+(Number(r.views)||0),0)},{label:'Pengunjung unik',value:meta.unique??'-'},{label:'Rata-rata per titik',value:meta.average??'-'},{label:'Jumlah periode',value:records.length}],columns:[col('label','Periode',280),col('views','Tayangan',130),col('unique','Pengunjung unik',140),col('channel','Kanal',224)],rows:records,filename:'koteka-trafik-'+stamp()+'.pdf'});},
 exportInbox(records,meta={}){const rows=records.map(m=>({date:fmt(m.date),sender:`${value(m.nama)}\nBisnis: ${value(m.namaBisnis)}`,contact:`Email: ${value(m.email)}\nWhatsApp: ${value(m.wa)}`,message:`Jenis website: ${value(m.jenisWebsite)}\n${value(m.pesan)}`,status:`${m.read?'Dibaca':'Belum dibaca'}\n${m.replied===true?'Sudah dibalas':'Belum dibalas'}`}));return build({heading:'Laporan Pesan Konsultasi',subtitle:`Periode: ${period(meta)} | Status: ${statusLabel(meta.status)}${meta.search?' | Pencarian: '+meta.search:''}`,summary:[{label:'Total pesan',value:rows.length},{label:'Belum dibaca',value:records.filter(m=>!m.read).length},{label:'Sudah dibalas',value:records.filter(m=>m.replied===true).length}],columns:[col('date','Waktu (WIT)',104),col('sender','Nama / Bisnis',135),col('contact','Kontak',165),col('message','Kebutuhan konsultasi',270),col('status','Status',100)],rows,filename:'koteka-pesan-masuk-'+stamp()+'.pdf'});},
 exportLogs(records,meta={}){return build({heading:'Laporan Log Aktivitas',subtitle:`Periode: ${period(meta)} | Jenis: ${meta.filter==='all'||!meta.filter?'Semua':activityLabel(meta.filter)} | Modul: ${meta.module==='all'||!meta.module?'Semua':meta.module}${meta.search?' | Pencarian: '+meta.search:''}`,summary:[{label:'Total aktivitas',value:records.length},{label:'Aktivitas admin',value:records.filter(x=>x.kind==='editor').length},{label:'Kunjungan tercatat',value:records.filter(x=>x.kind==='visitor').length}],columns:[col('dateLabel','Waktu (WIT)',106),col('kind','Jenis',65),col('actor','Pelaku',132),col('module','Modul',120),col('description','Aktivitas',351)],rows:records.map(r=>({...r,kind:activityLabel(r.kind),dateLabel:r.date?fmt(r.date):value(r.dateLabel)})),filename:'koteka-log-'+stamp()+'.pdf'});},
 exportAdminActivity(records,meta={}){return build({heading:'Laporan Aktivitas Admin',subtitle:`Periode: ${period(meta)} | Modul: ${meta.module||'Semua'}${meta.search?' | Pencarian: '+meta.search:''}`,summary:[{label:'Total aktivitas admin',value:records.length}],columns:[col('date','Waktu (WIT)',104),col('id','ID aktivitas',90),col('user','Admin / Email / Role',185),col('module','Modul',120),col('description','Aktivitas',275)],rows:records.map(r=>({...r,date:fmt(r.date),user:`${value(r.user?.name)}\n${value(r.user?.email)}\nRole: ${value(r.user?.role)}`})),filename:'koteka-aktivitas-admin-'+stamp()+'.pdf'});}
};
})();
