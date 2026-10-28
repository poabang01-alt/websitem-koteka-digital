import{r as e,t}from"./jsx-runtime-BkSabwWG.js";import{t as n}from"./react-DHmoMYoq.js";import{contactInfo as r}from"./siteData-C5f9a5aD.js";import{t as i}from"./Reveal-a4c48c8478.js";var a=e(n(),1);function o(e=``){let t=e.replace(/\D/g,``);return t?t.startsWith(`62`)?t:t.startsWith(`0`)?`62${t.slice(1)}`:t:``}function s(e){let t={},n=e.nama.trim(),r=e.email.trim(),i=e.pesan.trim(),a=o(e.wa);return n.length<3&&(t.nama=`Nama minimal 3 karakter.`),/^62\d{9,13}$/.test(a)||(t.wa=`Gunakan nomor WhatsApp Indonesia yang valid, misalnya 0812... atau 62812...`),r&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r)&&(t.email=`Format email belum valid.`),e.kirimVia===`email`&&!r&&(t.email=`Email wajib diisi jika memilih kirim via email.`),i.length<10&&(t.pesan=`Pesan minimal 10 karakter agar kebutuhan Anda lebih jelas.`),e.jenisWebsite||(t.jenisWebsite=`Pilih jenis website.`),e.namaBisnis.trim()||(t.namaBisnis=`Nama bisnis wajib diisi.`),e.anggaran||(t.anggaran=`Pilih kisaran anggaran.`),e.targetSelesai||(t.targetSelesai=`Pilih target selesai.`),{errors:t,name:n,email:r,message:i,whatsapp:a}}function c(e,t){return[`Halo Koteka Digital, saya tertarik konsultasi layanan website.`,``,`Nama: ${t.name}`,`Bisnis: ${e.namaBisnis.trim()}`,`Jenis website: ${e.jenisWebsite}`,`Anggaran: ${e.anggaran}`,`Target selesai: ${e.targetSelesai}`,`WhatsApp: ${t.whatsapp}`,`Email: ${t.email||`-`}`,`Pesan: ${t.message}`].join(`
`)}var l=t(),u={type:``,message:``};function d({contactInfo:e}){let[t,n]=(0,a.useState)({nama:``,wa:``,email:``,pesan:``,jenisWebsite:``,namaBisnis:``,anggaran:``,targetSelesai:``,kirimVia:`email`,persetujuan:!1}),[r,i]=(0,a.useState)({}),[o,d]=(0,a.useState)(u),[f,p]=(0,a.useState)(!1),m=(0,a.useRef)(null),h=e=>{let{name:t,value:r}=e.target;i(e=>{if(!e[t])return e;let n={...e};return delete n[t],n}),o.message&&d(u),n(e=>({...e,[t]:r}))};return(0,l.jsxs)(`article`,{className:`contact-card contact-form-card`,children:[(0,l.jsxs)(`div`,{className:`contact-panel-head`,children:[(0,l.jsx)(`span`,{className:`contact-panel-icon`,"aria-hidden":`true`,children:(0,l.jsx)(`i`,{className:`fa-solid fa-pen-ruler`})}),(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`h3`,{children:`Form Konsultasi`}),(0,l.jsx)(`p`,{className:`contact-panel-copy`,children:`Isi form berikut dan tim kami akan menghubungi Anda.`})]}),(0,l.jsxs)(`span`,{className:`kd-contact-security`,children:[(0,l.jsx)(`i`,{className:`fa-solid fa-lock`,"aria-hidden":`true`}),` Data Anda Aman & Rahasia`]})]}),(0,l.jsxs)(`form`,{className:`contact-form`,method:`post`,onSubmit:async r=>{
  r.preventDefault();if(f)return;
  const a=s(t),errors=a.errors;
  if(!t.persetujuan)errors.persetujuan=`Setujui penggunaan data untuk keperluan konsultasi.`;
  if(Object.keys(errors).length){i(errors);d({type:`error`,message:`Mohon cek kembali data form sebelum dikirim.`});window.requestAnimationFrame(()=>m.current?.querySelector(`[aria-invalid="true"]`)?.focus());return;}
  i({});d(u);p(!0);
  const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),20000);
  try {
    const response=await (window.KotekaConsultation?.request || fetch)(`/api/leads`,{method:`POST`,headers:{"Content-Type":`application/json`,Accept:`application/json`},body:JSON.stringify({...t,...a,message:a.message}),signal:controller.signal});
    const json=(response.headers.get(`content-type`)||``).toLowerCase().includes(`application/json`);
    const result=json?await response.json().catch(()=>({})):{};
    if(!response.ok||result.stored!==true){
      d({type:`error`,message:response.status===503?`Pengiriman otomatis belum aktif. Hubungi Koteka Digital melalui kontak yang tersedia; data form Anda tetap tersimpan di halaman ini.`:result.error||`Server belum mengonfirmasi penyimpanan pesan. Data form Anda tetap ada; periksa sebelum mengirim ulang.`});return;
    }
    const channel=t.kirimVia===`email`?`Email`:`WhatsApp`;
    const sent=result.delivery?.[t.kirimVia]===`sent`;
    d({type:result.simulation?`success`:sent?`success`:`warning`,message:result.simulation?`Simulasi berhasil: konsultasi masuk ke dashboard pada browser ini. Pengiriman ${channel} disimulasikan; tidak ada pesan yang dikirim ke luar.`:sent?`Konsultasi berhasil masuk ke dashboard dan dikirim melalui ${channel}. Tim kami akan menghubungi Anda.`:`Konsultasi sudah masuk ke dashboard. Pengiriman melalui ${channel} belum berhasil. Tim kami dapat membaca pesan Anda; tidak perlu mengirim ulang.`});
    n(e=>({...e,nama:``,wa:``,email:``,pesan:``,jenisWebsite:``,namaBisnis:``,anggaran:``,targetSelesai:``,persetujuan:!1}));
    try{localStorage.setItem(`koteka.consultation.updated`,String(Date.now()));}catch{}
    window.dispatchEvent(new CustomEvent(`koteka:consultation-stored`));
  }catch{
    d({type:`error`,message:`Koneksi terputus sebelum ada konfirmasi dari server. Data form tetap ada. Periksa sebelum mengirim ulang, atau hubungi Koteka Digital.`});
  }finally{window.clearTimeout(timer);p(!1);}
},noValidate:!0,ref:m,"aria-describedby":`contact-form-help`,children:[(0,l.jsx)(`p`,{id:`contact-form-help`,className:`contact-form-help`,children:window.KotekaConsultation?.localPreview?`Pratinjau lokal: jika backend belum aktif, konsultasi disimulasikan dan hanya tersimpan pada browser ini. Tidak ada email atau WhatsApp yang dikirim keluar.`:`Data Anda hanya digunakan untuk menyiapkan konsultasi dan menghubungi Anda sesuai channel yang dipilih.`}),(0,l.jsxs)(`div`,{className:`contact-form-grid`,children:[(0,l.jsxs)(`div`,{className:`contact-field`,children:[(0,l.jsx)(`label`,{htmlFor:`nama`,children:`Nama Lengkap`}),(0,l.jsx)(`input`,{id:`nama`,name:`nama`,placeholder:`Masukkan nama lengkap`,value:t.nama,onChange:h,autoComplete:`name`,"aria-invalid":r.nama?`true`:`false`,"aria-describedby":r.nama?`nama-error`:void 0,required:!0}),r.nama?(0,l.jsx)(`small`,{id:`nama-error`,children:r.nama}):null]}),(0,l.jsxs)(`div`,{className:`contact-field`,children:[(0,l.jsx)(`label`,{htmlFor:`namaBisnis`,children:`Nama Bisnis`}),(0,l.jsx)(`input`,{id:`namaBisnis`,name:`namaBisnis`,placeholder:`Nama usaha/organisasi`,value:t.namaBisnis,onChange:h,autoComplete:`organization`,"aria-invalid":r.namaBisnis?`true`:`false`,"aria-describedby":r.namaBisnis?`namaBisnis-error`:void 0,required:!0}),r.namaBisnis?(0,l.jsx)(`small`,{id:`namaBisnis-error`,children:r.namaBisnis}):null]}),(0,l.jsxs)(`div`,{className:`contact-field`,children:[(0,l.jsx)(`label`,{htmlFor:`email`,children:t.kirimVia===`email`?`Email Aktif`:`Email (opsional)`}),(0,l.jsx)(`input`,{id:`email`,type:`email`,name:`email`,placeholder:`Masukkan email aktif`,value:t.email,onChange:h,autoComplete:`email`,"aria-invalid":r.email?`true`:`false`,"aria-describedby":r.email?`email-error`:void 0,required:t.kirimVia===`email`}),r.email?(0,l.jsx)(`small`,{id:`email-error`,children:r.email}):null]}),(0,l.jsxs)(`div`,{className:`contact-field`,children:[(0,l.jsx)(`label`,{htmlFor:`wa`,children:`Nomor WhatsApp Aktif`}),(0,l.jsx)(`input`,{id:`wa`,type:`tel`,name:`wa`,placeholder:`Masukkan nomor WhatsApp`,value:t.wa,onChange:h,autoComplete:`tel`,inputMode:`numeric`,"aria-invalid":r.wa?`true`:`false`,"aria-describedby":r.wa?`wa-error`:void 0,required:!0}),r.wa?(0,l.jsx)(`small`,{id:`wa-error`,children:r.wa}):null]})]}),(0,l.jsxs)(`div`,{className:`contact-form-grid`,children:[(0,l.jsxs)(`div`,{className:`contact-field`,children:[(0,l.jsx)(`label`,{htmlFor:`jenisWebsite`,children:`Jenis Website`}),(0,l.jsxs)(`select`,{id:`jenisWebsite`,name:`jenisWebsite`,value:t.jenisWebsite,onChange:h,"aria-invalid":r.jenisWebsite?`true`:`false`,"aria-describedby":r.jenisWebsite?`jenisWebsite-error`:void 0,required:!0,children:[(0,l.jsx)(`option`,{value:``,children:`Pilih kebutuhan`}),(0,l.jsx)(`option`,{children:`Website UMKM`}),(0,l.jsx)(`option`,{children:`Company Profile`}),(0,l.jsx)(`option`,{children:`Landing Page`}),(0,l.jsx)(`option`,{children:`Toko Online`}),(0,l.jsx)(`option`,{children:`Sistem Digital`})]}),r.jenisWebsite?(0,l.jsx)(`small`,{id:`jenisWebsite-error`,children:r.jenisWebsite}):null]}),(0,l.jsxs)(`div`,{className:`contact-field`,children:[(0,l.jsx)(`label`,{htmlFor:`anggaran`,children:`Kisaran Anggaran`}),(0,l.jsxs)(`select`,{id:`anggaran`,name:`anggaran`,value:t.anggaran,onChange:h,"aria-invalid":r.anggaran?`true`:`false`,"aria-describedby":r.anggaran?`anggaran-error`:void 0,required:!0,children:[(0,l.jsx)(`option`,{value:``,children:`Pilih anggaran`}),(0,l.jsx)(`option`,{children:`Di bawah Rp2,5 juta`}),(0,l.jsx)(`option`,{children:`Rp2,5–5 juta`}),(0,l.jsx)(`option`,{children:`Rp5–15 juta`}),(0,l.jsx)(`option`,{children:`Di atas Rp15 juta`})]}),r.anggaran?(0,l.jsx)(`small`,{id:`anggaran-error`,children:r.anggaran}):null]})]}),(0,l.jsxs)(`div`,{className:`contact-field`,children:[(0,l.jsx)(`label`,{htmlFor:`targetSelesai`,children:`Target Selesai`}),(0,l.jsxs)(`select`,{id:`targetSelesai`,name:`targetSelesai`,value:t.targetSelesai,onChange:h,"aria-invalid":r.targetSelesai?`true`:`false`,"aria-describedby":r.targetSelesai?`targetSelesai-error`:void 0,required:!0,children:[(0,l.jsx)(`option`,{value:``,children:`Pilih target waktu`}),(0,l.jsx)(`option`,{children:`Secepatnya`}),(0,l.jsx)(`option`,{children:`1–2 bulan`}),(0,l.jsx)(`option`,{children:`3 bulan atau lebih`}),(0,l.jsx)(`option`,{children:`Belum ditentukan`})]}),r.targetSelesai?(0,l.jsx)(`small`,{id:`targetSelesai-error`,children:r.targetSelesai}):null]}),(0,l.jsxs)(`div`,{className:`contact-field`,children:[(0,l.jsx)(`label`,{htmlFor:`pesan`,children:`Kebutuhan Anda`}),(0,l.jsx)(`textarea`,{id:`pesan`,name:`pesan`,rows:`4`,placeholder:`Ceritakan kebutuhan website atau sistem digital Anda`,value:t.pesan,onChange:h,"aria-invalid":r.pesan?`true`:`false`,"aria-describedby":r.pesan?`pesan-error`:void 0,required:!0}),r.pesan?(0,l.jsx)(`small`,{id:`pesan-error`,children:r.pesan}):null]}),(0,l.jsxs)(`div`,{className:`contact-field`,children:[(0,l.jsx)(`label`,{htmlFor:`kirimVia`,children:`Pilih Channel Pengiriman`}),(0,l.jsxs)(`select`,{id:`kirimVia`,name:`kirimVia`,value:t.kirimVia,onChange:h,children:[(0,l.jsx)(`option`,{value:`whatsapp`,children:`WhatsApp (Respon Lebih Cepat)`}),(0,l.jsx)(`option`,{value:`email`,children:`Email (Format Lebih Formal)`})]})]}),(0,l.jsxs)(`label`,{className:`contact-consent`,children:[(0,l.jsx)(`input`,{type:`checkbox`,name:`persetujuan`,checked:t.persetujuan,onChange:e=>{i(e=>{if(!e.persetujuan)return e;let t={...e};return delete t.persetujuan,t}),n(t=>({...t,persetujuan:e.target.checked}))},"aria-invalid":r.persetujuan?`true`:`false`,"aria-describedby":r.persetujuan?`persetujuan-error`:void 0}),(0,l.jsx)(`span`,{children:`Saya menyetujui data ini digunakan untuk keperluan konsultasi.`})]}),r.persetujuan?(0,l.jsx)(`small`,{id:`persetujuan-error`,className:`contact-consent-error`,children:r.persetujuan}):null,o.message?(0,l.jsx)(`p`,{className:`form-status ${o.type}`,role:o.type===`error`?`alert`:`status`,"aria-live":`polite`,children:o.message}):null,(0,l.jsx)(`button`,{type:`submit`,className:`button button-primary form-submit`,disabled:f,"aria-busy":f,children:f?`Memproses...`:t.kirimVia===`email`?`Kirim via Email`:`Kirim via WhatsApp`})]})]})}function f({contactInfo: info}) {
  const {jsx, jsxs} = l;
  const workspace=window.KotekaWorkspace, contact=workspace.get("contact",{}), channels=workspace.get("contactChannels",null);
  const map=workspace.contactMap(contact);
  const icon = name => jsx('i', {className: name, 'aria-hidden': true});
  const channel = (name, value, href, symbol, external = false) => jsxs('a', {
    className: 'contact-social-card', href,
    target: external ? '_blank' : undefined, rel: external ? 'noopener noreferrer' : undefined,
    children: [icon(symbol), jsxs('div', {children: [jsx('strong', {children: name}), jsx('span', {children: value})]}), icon('fa-solid fa-arrow-up-right-from-square')]
  });
  return jsx(i, {as: 'section', className: 'contact-section', id: 'kontak', 'aria-labelledby': 'contact-heading',
    children: jsxs('div', {className: 'container', children: [
      jsxs('div', {className: 'section-heading contact-heading', children: [
        jsx('span', {className: 'eyebrow', children: 'Kontak'}),
        jsxs('h2', {id: 'contact-heading', children: String(contact.heading ?? 'Mari bicarakan kebutuhan bisnis Anda').split(/(kebutuhan)/i).map((part,index)=>index%2?jsx('span',{className:'kd-contact-head-highlight',children:part}):part)}),
        jsx('p', {children: contact.subtitle ?? 'Konsultasikan website, SEO, dan strategi digital Anda. Pilih cara yang paling nyaman untuk terhubung dengan kami.'})
      ]}),
      jsxs('div', {className: 'kd-contact-perks', children: [
        ['fa-solid fa-bolt','Respon Cepat','Kami siap membantu setiap hari'],
        ['fa-solid fa-comments','Konsultasi Gratis','Diskusi kebutuhan bisnis Anda'],
        ['fa-solid fa-gear','Solusi Tepat','Sesuai tujuan dan anggaran Anda'],
        ['fa-solid fa-shield-halved','Aman & Terpercaya','Data Anda aman bersama kami']
      ].map(([symbol,title,description])=>jsxs('div',{className:'kd-contact-perk',children:[jsx('span',{className:'kd-contact-perk-icon',children:icon(symbol)}),jsxs('div',{children:[jsx('strong',{children:title}),jsx('span',{children:description})]})]}))}),
      jsxs('div', {className: 'contact-main-grid', children: [
        jsxs('div', {className: 'contact-left-column', children: [
          jsxs('article', {className: 'contact-card contact-intro-card', children: [
            jsx('span', {className: 'contact-small-label', children: 'KONSULTASI AWAL'}),
            jsx('h3', {children: 'Langkah pertama menuju website yang tepat.'}),
            jsx('p', {className: 'contact-lead', children: 'Ceritakan tujuan dan kebutuhan bisnis Anda. Kami bantu menentukan solusi yang sesuai, mulai dari website hingga sistem digital.'}),
            jsxs('div', {className: 'contact-social-grid', children: channels ? workspace.list(channels).map(x=>channel(x.title,x.value,workspace.url(x.link),x.icon,true)) : [
              channel('WhatsApp', info.whatsappLabel, info.whatsappLink, 'fa-brands fa-whatsapp', true),
              channel('Email', info.email, `mailto:${info.email}`, 'fa-regular fa-envelope')
            ]}),
            jsxs('div', {className: 'contact-benefits', children: [
              jsxs('div', {className: 'contact-benefit', children: [icon('fa-solid fa-check'), jsx('span', {children: 'Diskusi terarah sesuai target bisnis'})]}),
              jsxs('div', {className: 'contact-benefit', children: [icon('fa-solid fa-check'), jsx('span', {children: 'Konsultasi online dari mana saja'})]})
            ]})
          ]}),
          jsx(d, {contactInfo: {...info,email:contact.formRecipient || info.email}})
        ]}),
        jsxs('article', {className: 'contact-card contact-location-card', children: [
          jsxs('div', {className: 'contact-location-copy', children: [
            jsxs('div', {className: 'contact-panel-head', children: [
              jsx('span', {className: 'contact-panel-icon', children: icon('fa-solid fa-location-dot')}),
              jsxs('div', {children: [jsx('h3', {children: contact.locationHeading==='Berbasis di Ndugama'?'Berbasis di Nduga':contact.locationHeading ?? 'Berbasis di Nduga'}), jsx('p', {className: 'contact-panel-copy', children: contact.address ?? 'Kenyam, Kabupaten Nduga, Papua Pegunungan, Indonesia'})]})
            ]}),
            jsxs('div',{className:'kd-contact-service-list',children:[jsxs('p',{className:'contact-hours',children:[icon('fa-regular fa-clock'),' ',contact.hours ?? '24 jam setiap hari · Konsultasi online']}),jsxs('p',{children:[icon('fa-solid fa-users'),' Melayani seluruh Papua dan Indonesia']})]})
          ]}),
          jsxs('div', {className: 'map-card contact-map-panel', children: [
            jsxs('div', {className: 'contact-map-identity', children: [icon('fa-solid fa-location-dot'), jsx('strong', {children: 'Koteka Digital'}), jsx('span', {children: contact.address ?? 'Kenyam, Kabupaten Nduga'})]}),
            jsx('div', {className: 'map-wrap', children: jsx('iframe', {title: 'Lokasi Koteka Digital',
              src: map.embed, loading: 'lazy', referrerPolicy: 'strict-origin-when-cross-origin'})}),
            jsxs('a', {className: 'contact-map-link', href: map.link,
              target: '_blank', rel: 'noopener noreferrer', children: ['Buka di Google Maps', icon('fa-solid fa-arrow-up-right-from-square')]})
          ]})
        ]})
      ]})
    ]})
  });
}
function p(){return l.jsx(f,{contactInfo:r})}
export{p as default};
