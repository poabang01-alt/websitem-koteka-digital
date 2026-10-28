/* New/updated Workspace articles use the SAME published article shell and typography. */
(() => {
  'use strict';
  const workspace=window.KotekaWorkspace;
  const main=document.querySelector('.article-shell');
  if(!workspace||!main)return;
  const generic=location.pathname.replace(/\/$/,'')==='/blog/article.html';
  const requested=new URLSearchParams(location.search).get('id');
  const original=main.cloneNode(true);
  function buildBody(text,root) {
    root.replaceChildren();
    const parts=String(text||'').replace(/\r\n/g,'\n').split('\n');
    let paragraph=[],list=null;
    const flush=()=>{if(paragraph.length){const node=document.createElement('p');node.textContent=paragraph.join(' ').trim();root.append(node);paragraph=[]}};
    for(const raw of parts){const line=raw.trim();if(!line){flush();list=null;continue;}
      if(/^#{1,3}\s+/.test(line)){flush();list=null;const depth=(line.match(/^#+/)||['##'])[0].length;const node=document.createElement(depth===1?'h2':'h3');node.textContent=line.replace(/^#{1,3}\s+/,'');root.append(node);continue;}
      if(/^[-*]\s+/.test(line)){flush();if(!list){list=document.createElement('ul');root.append(list)}const li=document.createElement('li');li.textContent=line.slice(2);list.append(li);continue;}
      if(/^\d+[.)]\s+/.test(line)){flush();if(!list||list.tagName!=='OL'){list=document.createElement('ol');root.append(list)}const li=document.createElement('li');li.textContent=line.replace(/^\d+[.)]\s+/,'');list.append(li);continue;}
      list=null;paragraph.push(line);
    }
    flush();
  }
  function setMeta(selector,value){const element=document.querySelector(selector);if(element)element.setAttribute('content',String(value||''));}
  function render(){
    const posts=workspace.get('blogPosts',null);if(!posts&&!generic)return;
    const post=workspace.list(posts).find(x=>generic?String(x._id)===requested:String(x.link||'').split('?')[0].replace(/\/$/,'')===location.pathname.replace(/\/$/,''));
    const template=original.cloneNode(true);main.replaceChildren(...template.childNodes);
    if(!post||post.status==='Draft'||post.status==='Arsip'){
      main.replaceChildren();const section=document.createElement('section');section.className='article-body kd-article-empty';
      const h=document.createElement('h1');h.textContent='Artikel tidak tersedia';const desc=document.createElement('p');desc.textContent='Artikel belum dipublikasikan atau sudah tidak tersedia.';
      const back=document.createElement('a');back.href='/blog/';back.className='back-link';back.textContent='Kembali ke Artikel';section.append(h,desc,back);main.append(section);document.title='Artikel tidak tersedia | Koteka Digital';return;
    }
    const set=(selector,text)=>{const node=main.querySelector(selector);if(node)node.textContent=String(text||'')};
    set('h1',post.title);set('.article-label',post.category||'Artikel');set('.article-intro',post.excerpt);
    const cover=main.querySelector('.article-hero img.article-cover');
    if(cover){const image=workspace.url(post.image,true);if(image){cover.src=image;cover.alt=post.imageAlt||post.title;cover.hidden=false}else cover.remove();}
    if(generic||post._bodyEdited){const body=main.querySelector('.article-body');if(body)buildBody(post.body||post.excerpt,body);}
    document.title=post.seoTitle||post.title+' | Koteka Digital';
    setMeta('meta[name="description"]',post.seoDescription||post.excerpt);
    let canonical=document.querySelector('link[rel="canonical"]');if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.append(canonical)}canonical.href=location.href.split('?')[0]+(requested?'?id='+encodeURIComponent(requested):'');
    for(const [key,value] of [['og:title',post.title],['og:description',post.excerpt],['og:type','article'],['og:image',workspace.url(post.image,true)]]){
      let node=document.head.querySelector('meta[property="'+key+'"]');if(!node){node=document.createElement('meta');node.setAttribute('property',key);document.head.append(node)}node.content=value||'';
    }
  }
  render();workspace.subscribe(render);
})();
