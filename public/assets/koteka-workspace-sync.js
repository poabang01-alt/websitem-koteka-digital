/* Published content shared by the website and Workspace. */
(() => {
  'use strict';
  if (window.KotekaWorkspace) return;
  const keys = {content:'koteka.admin.content.v1',public:'koteka.public.content.v1',traffic:'koteka.admin.traffic.v2',logs:'koteka.admin.logs.v2'};
  const listeners = new Set();
  const read = (key, fallback = {}) => {try {return JSON.parse(localStorage.getItem(key)) ?? fallback;} catch {return fallback;}};
  const projectPublic = input => {
    if(Array.isArray(input))return input.filter(x=>!x||typeof x!=='object'||!('status' in x)||x.status==='Publik').map(projectPublic);
    if(input && typeof input==='object'){
      const out={},implicit=Array.isArray(input._koteka_implicit_collections)?input._koteka_implicit_collections:[];for(const [k,v] of Object.entries(input)){
        if(k==='_koteka_implicit_collections'||implicit.includes(k)&&Array.isArray(v)&&v.length>0&&v.every(x=>x&&x.status==='Draft'))continue;
        if(v && typeof v==='object' && !Array.isArray(v) && 'status' in v && v.status!=='Publik')continue;
        const cleanValue=projectPublic(v);
        out[k]=cleanValue;
      }return out;
    }return input;
  };
  let publishedRaw, publishedForEditor, publishedSnapshot, confirmedRaw=null;
  const published = () => {
    let raw;
    try {raw=confirmedRaw??localStorage.getItem(keys.public);} catch {raw=confirmedRaw;}
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
    const raw=String(value || '');
    if(/[\x00-\x1f\x7f\\]/.test(raw))return '';
    const text=raw.trim();
    if(text.startsWith('//'))return '';
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
      {image:'/img/hero/hero-frontend-stack.webp',title:'Ilustrasi frontend development dengan HTML CSS JavaScript dan React'},
      {image:'/img/hero/hero-backend-architecture.webp',title:'Ilustrasi backend PHP Laravel API database dan autentikasi'},
      {image:'/img/hero/hero-go-live-deployment.webp',title:'Ilustrasi deployment website HTTPS server dan proses go live'},
      {image:'/img/backgrounds/08-laptop-ui-illustration.webp',title:'Ilustrasi perancangan antarmuka website Koteka Digital'}
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
  async function commit(content, key) {
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
    if(!window.KotekaLaravel?.saveContent)throw Error('Layanan penyimpanan tidak tersedia.');
    const saved=await window.KotekaLaravel.saveContent(next);
    confirmedRaw=JSON.stringify(saved||next);
    try {localStorage.setItem(keys.content,JSON.stringify(cached));localStorage.setItem(keys.public,confirmedRaw);} catch {}
    notify();
  }
  function readPublic(base) {
    const value=published(),out={...base};
    if (value.about) out.aboutCards=(base.aboutCards || []).map((x,i)=>({...x,text:i===0?(value.about.vision ?? x.text):i===1?(value.about.mission ?? x.text):x.text}));
    if ('teamMembers' in value) out.teamMembers=list(value.teamMembers).map(x=>({...clean(x),socials:[['website','fa-solid fa-globe'],['instagram','fa-brands fa-instagram'],['facebook','fa-brands fa-facebook-f'],['tiktok','fa-brands fa-tiktok']].filter(([k])=>url(x[k])).map(([k,icon])=>({href:url(x[k]),icon,label:k+' '+x.name}))}));
    if ('serviceCategories' in value) out.serviceGroups=list(value.serviceCategories).map(x=>({...clean(x),items:list(value.serviceItems).filter(item=>item.category===x._id).map(clean)}));
    if ('pricingPlans' in value) out.pricingPlans=list(value.pricingPlans).map(x=>({...clean(x),features:String(x.features || '').split('\n').map(v=>v.trim()).filter(Boolean),details:{pages:x.pages,design:x.design,revisions:x.revisions,duration:x.duration,maintenance:x.maintenance}}));
    if ('portfolioItems' in value) out.portfolioItems=list(value.portfolioItems).map(x=>({...clean(x),tech:words(x.tech)}));
    if ('blogPosts' in value) out.blogPosts=list(value.blogPosts).map(x=>({...clean(x),keywords:words(x.keywords),link:(base.blogPosts || []).some(b=>b.link===x.link) ? url(x.link) : '/blog/article.html?id='+encodeURIComponent(x._id)}));
    if ('faqs' in value) out.faqs=list(value.faqs).map(clean);
    if (value.contact) {
      const contact=value.contact,original=base.contactInfo || {},number=contact.whatsapp ?? original.whatsappNumber;
      out.contactInfo={...original,...clean(contact),whatsappNumber:number,whatsappLabel:contact.phone ?? original.whatsappLabel,
        whatsappLink:contact.whatsapp!==undefined?'https://wa.me/'+String(number || '').replace(/\D/g,'')+(String(original.whatsappLink || '').includes('?')?'?'+original.whatsappLink.split('?')[1]:''):original.whatsappLink};
    }
    return out;
  }
  const subscribe = fn => {listeners.add(fn);return ()=>listeners.delete(fn);};
  window.addEventListener('storage',event=>{if (event.key===keys.public || event.key===null) {confirmedRaw=event.newValue??null;notify();}});
  window.addEventListener('koteka:session-expired',()=>{confirmedRaw=null;publishedRaw=undefined;notify();});
  window.KotekaWorkspace={keys,get,list,url,contactMap,heroSlides,defaultHeroSlides,readPublic,editorData,settingsPatch,commit,subscribe};
})();
