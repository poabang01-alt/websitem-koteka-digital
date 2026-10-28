/* Shared demo content for public pages and Workspace on the same browser/origin. */
(() => {
  'use strict';
  if (window.KotekaWorkspace) return;
  const keys = {content:'koteka.admin.content.v1',public:'koteka.public.content.v1',traffic:'koteka.admin.traffic.v2',logs:'koteka.admin.logs.v2'};
  const listeners = new Set();
  const read = (key, fallback = {}) => {try {return JSON.parse(localStorage.getItem(key)) ?? fallback;} catch {return fallback;}};
  const projectPublic = input => {
    if(Array.isArray(input))return input.filter(x=>!x||typeof x!=='object'||!('status' in x)||x.status==='Publik').map(projectPublic);
    if(input && typeof input==='object'){
      const out={};for(const [k,v] of Object.entries(input)){
        if(v && typeof v==='object' && !Array.isArray(v) && 'status' in v && v.status!=='Publik')continue;
        out[k]=projectPublic(v);
      }return out;
    }return input;
  };
  let publishedRaw, publishedForEditor, publishedSnapshot;
  const published = () => {
    let raw;
    try {raw=localStorage.getItem(keys.public);} catch {return {};}
    const forEditor=/^\/admin(?:\/|$)/.test(location.pathname);
    if(raw===publishedRaw && forEditor===publishedForEditor)return publishedSnapshot;
    let value;
    try {value=JSON.parse(raw);} catch {value=null;}
    publishedRaw=raw;publishedForEditor=forEditor;
    publishedSnapshot=value && typeof value==='object' && !Array.isArray(value)
      ? (forEditor?value:projectPublic(value)) : {};
    return publishedSnapshot;
  };
  const notify = () => {for (const listener of listeners) listener();};
  const get = (key, fallback) => {
    const value=published()[key];
    if(value===undefined)return fallback;
    if(!value || typeof value!=='object')return value;
    return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));
  };
  const list = value => Array.isArray(value) ? value.filter(x=>x && (!x.status || x.status==='Publik')) : [];
  const words = value => Array.isArray(value) ? value : String(value || '').split(/[,\n]/).map(x=>x.trim()).filter(Boolean);
  const url = (value, image=false) => {
    const text=String(value || '').trim();
    if (/^(?:\/[^/]|\/$|#|\.\.?\/)/.test(text)) return text;
    if (/^https?:\/\//i.test(text)) return text;
    if (!image && /^(?:mailto:|tel:)/i.test(text)) return text;
    if (image && /^data:image\/(?:png|jpeg|webp|gif);base64,[\w+/=]+$/i.test(text)) return text;
    return '';
  };
  const clean = item => ({...item,...Object.fromEntries(['link','website','instagram','facebook','tiktok','download','orderLink','primaryLink','secondaryLink','ctaLink','mapLink'].filter(k=>k in item).map(k=>[k,url(item[k])])),...('image' in item ? {image:url(item.image,true)} : {})});
  // Map position comes from the Maps destination, independently of address copy.
  const defaultMapLink = 'https://www.google.com/maps/place/Kenyam,+Kec.+Kenyam,+Kabupaten+Nduga,+Papua+Pegunungan/@-4.606634,138.3781112,3960m/data=!3m1!1e3!4m6!3m5!1s0x683c181bf8185751:0x4da75a927488f879!8m2!3d-4.6049794!4d138.3863687!16s%2Fg%2F120nqg16?authuser=0&entry=ttu&g_ep=EgoyMDI2MTAyMC4wIKXMDSoASAFQAw%3D%3D';
  function contactMap(contact = {}) {
    const supplied = String(contact.mapLink || '').trim();
    let link = supplied || defaultMapLink, point, center, valid = true;
    const coordinates = match => {
      if (!match) return null;
      const latitude = Number(match[1]), longitude = Number(match[2]);
      return Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180
        ? latitude + ',' + longitude : null;
    };
    try {
      const parsed = new URL(link);
      if (parsed.protocol !== 'https:' || !['www.google.com','google.com','maps.google.com'].includes(parsed.hostname) || !parsed.pathname.startsWith('/maps')) throw Error('Unsupported map');
      const path = decodeURIComponent(parsed.pathname);
      point = coordinates(path.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/));
      center = coordinates(path.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),/));
      const query = parsed.searchParams.get('q') || parsed.searchParams.get('query') || '';
      point ||= coordinates(query.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/)) || center;
      if (!point) throw Error('Missing coordinates');
    } catch {
      valid = false; link = defaultMapLink;
    }
    if (!valid) {point = '-4.6049794,138.3863687'; center = '-4.606634,138.3781112';}
    const params = new URLSearchParams({q:point,ll:center || point,z:'14',t:'h',hl:'id',output:'embed'});
    return {link,embed:'https://maps.google.com/maps?' + params,valid};
  }
  // The editor and public hero share the same gallery, including legacy hero images.
  const defaultHeroSlides = (background = '') => {
    const defaults = [
      {image:'/websitem-koteka-digital/img/hero/hero-frontend-stack.webp',title:'Ilustrasi frontend development dengan HTML CSS JavaScript dan React'},
      {image:'/websitem-koteka-digital/img/hero/hero-backend-architecture.webp',title:'Ilustrasi backend PHP Laravel API database dan autentikasi'},
      {image:'/websitem-koteka-digital/img/hero/hero-go-live-deployment.webp',title:'Ilustrasi deployment website HTTPS server dan proses go live'},
      {image:'/websitem-koteka-digital/img/backgrounds/08-laptop-ui-illustration.webp',title:'Ilustrasi perancangan antarmuka website Koteka Digital'}
    ];
    const legacy = url(background,true);
    if (legacy && !defaults.some(slide=>slide.image===legacy)) defaults.unshift({image:legacy,title:'Koteka Digital'});
    else if (legacy) defaults.sort((a,b)=>Number(b.image===legacy)-Number(a.image===legacy));
    return defaults.map((slide,index)=>({...slide,_id:'hero_default_'+index,order:index+1,status:'Publik'}));
  };
  const heroSlides = () => {
    const saved = get('heroSlides',null);
    const slides = list(Array.isArray(saved) ? saved : defaultHeroSlides(get('home',{}).background))
      .map(slide=>({...slide,src:url(slide.image,true),alt:slide.title || 'Koteka Digital'}))
      .filter(slide=>slide.src)
      .sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0));
    return slides.length ? slides : defaultHeroSlides().map(slide=>({...slide,src:slide.image,alt:slide.title}));
  };
  // The public snapshot is authoritative. The admin cache can contain old seed
  // placeholders which have never appeared on the website.
  function editorData(defaults) {
    const value=published(),out=JSON.parse(JSON.stringify(defaults));
    for(const key of Object.keys(defaults)) {
      if(!(key in value)) continue;
      if(Array.isArray(defaults[key]) && Array.isArray(value[key])) {
        out[key]=value[key].map(item=>{
          const original=defaults[key].find(x=>x._id===item._id || (item.link && x.link===item.link));
          const next={...original,...item};
          if(key==='blogPosts' && !item._bodyEdited && !item.body) next.body=original?.body || '';
          return next;
        });
      } else if(value[key] && typeof value[key]==='object') out[key]={...defaults[key],...value[key]};
    }
    return out;
  }
  function settingsPatch(key,before,after) {
    const changes=Object.fromEntries(Object.entries(after).filter(([name,value])=>value!==before[name]));
    return Object.keys(changes).length ? {...get(key,{}),...changes} : null;
  }
  const detailField = name => ({'jumlah halaman':'pages','desain':'design','desain ui':'design','revisi':'revisions','estimasi pengerjaan':'duration','maintenance':'maintenance'})[String(name || '').trim().toLowerCase()];
  function commit(content, key) {
    const beforeContent=localStorage.getItem(keys.content),beforePublic=localStorage.getItem(keys.public);
    const next={...published()},cached={...read(keys.content)};
    next[key]=content[key];
    cached[key]=Array.isArray(content[key]) ? content[key] : {...cached[key],...content[key]};
    // Synchronize shared facts, keeping editorial rows and custom channels intact.
    if(key==='pricingPlans' && Array.isArray(content.pricingTable)) {
      const previous=read(keys.content).pricingPlans || [];
      let changed=false;
      const rows=content.pricingTable.map(row=>{
        const field=detailField(row.name);if(!field)return row;
        const out={...row};
        for(const plan of content.pricingPlans) {
          const old=previous.find(x=>x._id===plan._id),column=plan.comparisonColumn;
          if(column && plan[field]!==undefined && plan[field]!==old?.[field]) {out[column]=plan[field];changed=true;}
        }
        return out;
      });
      if(changed)next.pricingTable=cached.pricingTable=rows;
    }
    if(key==='pricingTable' && Array.isArray(content.pricingPlans)) {
      const previous=read(keys.content).pricingTable || [];
      const plans=content.pricingPlans.map(plan=>{
        const out={...plan},column=plan.comparisonColumn;if(!column)return out;
        for(const row of content.pricingTable) {
          const field=detailField(row.name),old=previous.find(x=>x._id===row._id);
          if(field && row[column]!==undefined && row[column]!==old?.[column])out[field]=row[column];
        }
        return out;
      });
      next.pricingPlans=cached.pricingPlans=plans;
    }
    if(key==='contact' && Array.isArray(content.contactChannels)) {
      const old=read(keys.content).contact || {},contact={...old,...next.contact};
      const whatsappChanged=contact.whatsapp!==old.whatsapp;
      if(whatsappChanged && contact.whatsapp && contact.ctaLink===old.ctaLink) {
        contact.ctaLink='https://wa.me/'+String(contact.whatsapp).replace(/\D/g,'')+(String(old.ctaLink || '').includes('?')?'?'+old.ctaLink.split('?')[1]:'');
        next.contact={...next.contact,ctaLink:contact.ctaLink};cached.contact={...old,...next.contact};
      }
      const channels=content.contactChannels.map(item=>{
        if(item.icon?.includes('envelope') && contact.email!==old.email)return {...item,value:contact.email,link:'mailto:'+contact.email};
        if(item.icon?.includes('whatsapp') && (contact.phone!==old.phone || whatsappChanged))return {...item,value:contact.phone,link:whatsappChanged?'https://wa.me/'+String(contact.whatsapp || '').replace(/\D/g,''):item.link};
        return item;
      });
      next.contactChannels=cached.contactChannels=channels;
    }
    if(key==='contactChannels') {
      const old=read(keys.content).contactChannels || [],contact={...get('contact',{})};let changed=false;
      for(const item of content.contactChannels) {
        const before=old.find(x=>x._id===item._id);
        if(item.icon?.includes('envelope') && item.value!==before?.value){contact.email=item.value;changed=true;}
        if(item.icon?.includes('whatsapp') && (item.value!==before?.value || item.link!==before?.link)) {
          contact.phone=item.value;const number=String(item.link || '').match(/^https:\/\/wa.me\/(\d+)/)?.[1];
          if(number) {contact.whatsapp=number;contact.ctaLink=item.link;}changed=true;
        }
      }
      if(changed){next.contact=contact;cached.contact={...cached.contact,...contact};}
    }
    if (key==='serviceItems' || key==='serviceCategories') {next.serviceItems=content.serviceItems;next.serviceCategories=content.serviceCategories;}
    if (key==='serviceItems' || key==='serviceCategories') {cached.serviceItems=content.serviceItems;cached.serviceCategories=content.serviceCategories;}
    try {localStorage.setItem(keys.content,JSON.stringify(cached));localStorage.setItem(keys.public,JSON.stringify(next));}
    catch(error) {for(const [name,value] of [[keys.content,beforeContent],[keys.public,beforePublic]]) {try {value===null ? localStorage.removeItem(name) : localStorage.setItem(name,value);} catch {}}throw error;}
    notify();
  }
  function readPublic(base) {
    const value=published(),out={...base};
    if (value.about) out.aboutCards=(base.aboutCards || []).map((x,i)=>({...x,text:i===0?(value.about.vision ?? x.text):i===1?(value.about.mission ?? x.text):x.text}));
    if ('teamMembers' in value) out.teamMembers=list(value.teamMembers).map(x=>({...clean(x),socials:[['website','fa-solid fa-globe'],['instagram','fa-brands fa-instagram'],['facebook','fa-brands fa-facebook-f'],['tiktok','fa-brands fa-tiktok']].filter(([k])=>url(x[k])).map(([k,icon])=>({href:url(x[k]),icon,label:k+' '+x.name}))}));
    if ('serviceCategories' in value) out.serviceGroups=list(value.serviceCategories).map(x=>({...clean(x),items:list(value.serviceItems).filter(item=>item.category===x._id).map(clean)}));
    if ('pricingPlans' in value) out.pricingPlans=list(value.pricingPlans).map(x=>({...clean(x),features:String(x.features || '').split('\n').map(v=>v.trim()).filter(Boolean),details:{pages:x.pages,design:x.design,revisions:x.revisions,duration:x.duration,maintenance:x.maintenance}}));
    if ('portfolioItems' in value) out.portfolioItems=list(value.portfolioItems).map(x=>({...clean(x),tech:words(x.tech)}));
    if ('blogPosts' in value) out.blogPosts=list(value.blogPosts).map(x=>({...clean(x),keywords:words(x.keywords),link:(base.blogPosts || []).some(b=>b.link===x.link) ? url(x.link) : '/websitem-koteka-digital/blog/article.html?id='+encodeURIComponent(x._id)}));
    if ('faqs' in value) out.faqs=list(value.faqs).map(clean);
    if (value.contact) {
      const contact=value.contact,original=base.contactInfo || {},number=contact.whatsapp ?? original.whatsappNumber;
      out.contactInfo={...original,...clean(contact),whatsappNumber:number,whatsappLabel:contact.phone ?? original.whatsappLabel,
        whatsappLink:contact.whatsapp!==undefined?'https://wa.me/'+String(number || '').replace(/\D/g,'')+(String(original.whatsappLink || '').includes('?')?'?'+original.whatsappLink.split('?')[1]:''):original.whatsappLink};
    }
    return out;
  }
  const subscribe = fn => {listeners.add(fn);return ()=>listeners.delete(fn);};
  window.addEventListener('storage',event=>{if (event.key===keys.public || event.key===null) notify();});
  function append(key,item,limit) {const current=read(key,[]);try {localStorage.setItem(key,JSON.stringify([item,...(Array.isArray(current)?current:[])].slice(0,limit)));} catch {}}
  function startTracking() {
    // Local-only preview analytics are not real visitor counts and must never
    // be written on the public production origin. Server analytics comes later.
    if (window.KotekaServerAnalytics || startTracking.started || !['localhost','127.0.0.1','[::1]','::1'].includes(location.hostname) || /^\/admin(?:\/|$)/.test(location.pathname)) return;
    startTracking.started=true;
    const id=()=>typeof crypto!=='undefined' && typeof crypto.randomUUID==='function' ? crypto.randomUUID() : 'local-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
    let session;
    try {session=sessionStorage.getItem('koteka.demo.visitor');if(!session){session=id();sessionStorage.setItem('koteka.demo.visitor',session);}} catch {session=id();}
    const device=/ipad|tablet/i.test(navigator.userAgent)?'Tablet':/mobile|android/i.test(navigator.userAgent)?'Mobile':'Desktop';
    let channel='Direct';
    try {const ref=new URL(document.referrer);if(ref.host!==location.host)channel=/google|bing|yahoo/i.test(ref.host)?'Organic Search':/facebook|instagram|tiktok|twitter/i.test(ref.host)?'Social Media':'Referral';} catch {}
    const log=description=>append(keys.logs,{id:id(),date:new Date().toISOString(),kind:'visitor',module:'Kunjungan Website',actor:'Pengunjung lokal (demo)',description},1500);
    let last='';
    const visit=()=>{const page=location.pathname+location.hash;if(page===last)return;last=page;append(keys.traffic,{id:id(),date:new Date().toISOString(),page,channel,device,session,views:1,demo:true},15000);log('Mengunjungi '+page);};
    visit();window.addEventListener('popstate',visit);window.addEventListener('hashchange',visit);window.addEventListener('kotekadigital:navigation-change',visit);
    document.addEventListener('click',event=>{const link=event.target.closest?.('a[href]');if(link){const target=url(link.getAttribute('href'));if(target)log('Membuka tautan '+target.split('?')[0].slice(0,180));}});
    document.addEventListener('submit',()=>log('Mengirim formulir konsultasi (demo lokal)'));
  }
  window.KotekaWorkspace={keys,get,list,url,contactMap,heroSlides,defaultHeroSlides,readPublic,editorData,settingsPatch,commit,subscribe,startTracking};
  if(typeof document!=='undefined' && typeof location!=='undefined' && !/^\/admin(?:\/|$)/.test(location.pathname)) {
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startTracking,{once:true});
    else startTracking();
  }
})();

/* Loopback-only consultation simulation for static previews without an API.
   Real server responses remain authoritative; an ambiguous failure is never retried locally. */
(() => {
  'use strict';
  if (!window.location || window.KotekaConsultation) return;
  // Never synthesize a successful lead/inbox operation on a Laravel-origin preview.
  const localPreview = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) && !document.querySelector('meta[name="csrf-token"]');
  const key = 'koteka.consultation.demo.v1';
  const unavailable = new Set();
  const reply = (status, value) => new Response(JSON.stringify(value), {
    status, headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}
  });
  const read = () => {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(value)) throw Error('Invalid simulation data');
    return value;
  };
  const clean = (value, max) => String(value ?? '').trim().slice(0, max);
  function simulate(path, options) {
    try {
      const items = read(), method = (options.method || 'GET').toUpperCase();
      if (path === '/api/inbox' && method === 'GET') return reply(200, {
        items, unread: items.filter(item => !item.read).length, simulation: true,
        integrations: {email: false, whatsapp: false}
      });
      const input = JSON.parse(options.body || '{}');
      if (path === '/api/inbox' && method === 'PATCH') {
        const item = items.find(item => item.id === input.id);
        if (!item) return reply(404, {error: 'Pesan simulasi tidak ditemukan.'});
        item.read = true;
        localStorage.setItem(key, JSON.stringify(items));
        return reply(200, {ok: true, id: item.id, simulation: true});
      }
      if (path !== '/api/leads' || method !== 'POST') return reply(405, {error: 'Metode tidak didukung.'});
      const lead = {id: crypto.randomUUID(), date: new Date().toISOString(),
        nama: clean(input.nama, 90), namaBisnis: clean(input.namaBisnis, 120),
        wa: clean(input.whatsapp || input.wa, 32).replace(/\D/g, '').replace(/^0/, '62'),
        email: clean(input.email, 120), jenisWebsite: clean(input.jenisWebsite, 90),
        anggaran: clean(input.anggaran, 90), targetSelesai: clean(input.targetSelesai, 90),
        pesan: clean(input.pesan || input.message, 2500), kirimVia: clean(input.kirimVia, 30),
        read: false, simulation: true};
      if (input.persetujuan !== true || !['email', 'whatsapp'].includes(lead.kirimVia) ||
          lead.nama.length < 3 || !lead.namaBisnis || !/^62\d{9,13}$/.test(lead.wa) ||
          lead.pesan.length < 10 || !lead.jenisWebsite || !lead.anggaran || !lead.targetSelesai ||
          (lead.kirimVia === 'email' && !lead.email) ||
          (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email))) {
        return reply(422, {error: 'Data konsultasi tidak lengkap atau tidak valid.'});
      }
      lead.delivery = {email: 'not_requested', whatsapp: 'not_requested', [lead.kirimVia]: 'simulated'};
      items.unshift(lead);
      // A single durable write is the acknowledgement for both inbox and simulated delivery.
      localStorage.setItem(key, JSON.stringify(items));
      return reply(201, {ok: true, stored: true, id: lead.id, simulation: true, delivery: lead.delivery});
    } catch {
      return reply(507, {error: 'Simulasi belum tersimpan. Penyimpanan browser penuh, diblokir, atau tidak dapat dibaca. Data form tetap ada.'});
    }
  }
  async function request(path, options = {}) {
    if (!localPreview || !['/api/leads', '/api/inbox'].includes(path)) return fetch(path, options);
    if (!unavailable.has(path)) {
      const response = await fetch(path, options);
      const json = (response.headers.get('content-type') || '').includes('application/json');
      if (![404, 405, 501, 503].includes(response.status) && !(response.ok && !json)) return response;
      unavailable.add(path);
    }
    // Serialize local writes across tabs when the browser supports Web Locks.
    if (typeof navigator !== 'undefined' && navigator.locks?.request) {
      return navigator.locks.request(key, () => simulate(path, options));
    }
    return simulate(path, options);
  }
  window.KotekaConsultation = {request, localPreview};
})();
