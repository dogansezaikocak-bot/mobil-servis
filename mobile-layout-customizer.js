/* Mobil ana sayfa ve kasa görünürlük/isim/sıra ayarları. Veriler silinmez. */
(function(){
 const KEY="ekzen-mobile-layout-v1";
 const defs={
 home:[["cash","Para Hareketleri",".mobile-welcome-cash-entry[data-welcome-action='cash']"],["source","Kaynak Seçimi",".mobile-welcome-source-entry"],["search","Tüm Kayıtlarda Ara","#ekzenGlobalSearchButton"]],
 cash:[["profit","Net Kazanç","#mobileCashProfitCounter"],["payment","Ödeme Bekliyor","#mobileCashPaymentCounter"],["income","Toplam Hasılat","[data-cash-detail='income']"],["commission","Ödenen Komisyon","[data-cash-detail='commission']"],["material","Malzeme","[data-cash-detail='material']"],["expense","Diğer Gider","[data-cash-detail='expense']"],["transactions","Para Hareketleri",".mobile-cash-transactions"]]
 };
 const defaults=type=>defs[type].map(([id,name])=>({id,name,visible:true}));
 let settings;
 try{settings=JSON.parse(localStorage.getItem(KEY)||"null")||{};}catch(_){settings={};}
 for(const type of ["home","cash"]){
  const old=Array.isArray(settings[type])?settings[type]:[];
  settings[type]=[...old.filter(x=>defs[type].some(d=>d[0]===x.id)),...defaults(type).filter(x=>!old.some(y=>y.id===x.id))];
 }
 function persist(){try{localStorage.setItem(KEY,JSON.stringify(settings));}catch(e){console.warn("Düzen kaydedilemedi",e);}}
 function ensureSearch(){
  if(document.querySelector("#ekzenGlobalSearchButton"))return;
  const source=document.querySelector(".mobile-welcome-source-entry");if(!source)return;
  const b=document.createElement("button");b.type="button";b.id="ekzenGlobalSearchButton";b.className="mobile-welcome-cash-entry";b.innerHTML='<div><span>Arama</span><strong>Tüm Kayıtlarda Ara</strong><small>Servis ve kasa kayıtlarını bul</small></div><i>›</i>';
  source.after(b);
  b.addEventListener("click",()=>{document.querySelector("#ekzenSearchOverlay").hidden=false;document.querySelector("#ekzenSearchInput").focus();search();});
  const overlay=document.createElement("section");overlay.id="ekzenSearchOverlay";overlay.hidden=true;
  overlay.innerHTML='<div class="ekzen-search-card"><div class="ekzen-search-head"><strong>Tüm Kayıtlarda Ara</strong><button type="button" id="ekzenSearchClose">✕</button></div><input id="ekzenSearchInput" type="search" placeholder="Müşteri, telefon, adres, fiş, tutar..." autocomplete="off"><div id="ekzenSearchResults"></div></div>';
  document.body.append(overlay);
  overlay.querySelector("#ekzenSearchClose").onclick=()=>overlay.hidden=true;
  overlay.querySelector("#ekzenSearchInput").addEventListener("input",search);
 }
 function search(){
  const input=document.querySelector("#ekzenSearchInput"),out=document.querySelector("#ekzenSearchResults");if(!input||!out)return;
  const q=input.value.toLocaleLowerCase("tr").trim();if(!q){out.textContent="Aramak için bir kelime veya numara yazın.";return;}
  const records=[...(state.services||[]).map(x=>({type:"Servis",data:x})),...(state.cash||[]).map(x=>({type:"Kasa",data:x}))];
  const hits=records.filter(x=>Object.values(x.data||{}).some(v=>v!=null&&typeof v!=="object"&&String(v).toLocaleLowerCase("tr").includes(q))).slice(0,80);
  out.replaceChildren();
  if(!hits.length){out.textContent="Eşleşen kayıt bulunamadı.";return;}
  for(const hit of hits){
   const b=document.createElement("button");b.type="button";b.className="ekzen-search-result";
   const d=hit.data;const parts=[d.customerName,d.name,d.phone,d.address,d.description,d.amount,d.id].filter(Boolean);
   b.textContent=hit.type+" · "+parts.slice(0,4).join(" · ");
   b.onclick=()=>{overlayClose();if(hit.type==="Servis"&&typeof mobileOpenDetail==="function")mobileOpenDetail(d.id);else{document.querySelector('[data-welcome-action="cash"]')?.click();}};
   out.append(b);
  }
 }
 function overlayClose(){document.querySelector("#ekzenSearchOverlay").hidden=true;}
 function apply(type){
  if(type==="home")ensureSearch();
  const root=type==="home"?document.querySelector(".mobile-welcome-cash-entry[data-welcome-action='cash']")?.parentElement:document.querySelector("#mobileCashProfitCounter")?.parentElement;
  if(!root)return;
  const entries=settings[type];
  for(const entry of entries){
   const def=defs[type].find(x=>x[0]===entry.id),el=document.querySelector(def[2]);if(!el)continue;
   el.hidden=!entry.visible;el.style.display=entry.visible?"":"none";
   const title=el.querySelector("strong")||(type==="cash"?el.querySelector("span"):null);
   if(title)title.textContent=entry.name;
  }
  // Only reorder siblings within the same container, preserving existing event handlers.
  const groups=new Map();
  for(const entry of entries){const def=defs[type].find(x=>x[0]===entry.id),el=document.querySelector(def[2]);if(!el||!el.parentElement)continue;const parent=el.parentElement;if(!groups.has(parent))groups.set(parent,[]);groups.get(parent).push(el);}
  for(const [parent,elements] of groups){if(elements.length<2)continue;const anchor=elements[0];for(const el of elements.slice(1))parent.insertBefore(el,anchor.nextSibling);}
 }
 function render(){
  const host=document.querySelector("#settingsHome");if(!host)return;
  let panel=document.querySelector("#ekzenLayoutSettings");if(!panel){panel=document.createElement("section");panel.id="ekzenLayoutSettings";host.append(panel);}
  panel.replaceChildren();
  const heading=document.createElement("h3");heading.textContent="Mobil Menü ve Kasa Düzeni";panel.append(heading);
  for(const type of ["home","cash"]){
   const h=document.createElement("h4");h.textContent=type==="home"?"Ana sayfa menüleri":"Kasa sayfası";panel.append(h);
   settings[type].forEach((entry,i)=>{
    const row=document.createElement("div");row.className="ekzen-layout-row";
    const name=document.createElement("input");name.value=entry.name;name.setAttribute("aria-label","Menü adı");name.onchange=()=>{entry.name=name.value.trim()||defs[type].find(x=>x[0]===entry.id)[1];persist();apply(type);};
    const up=document.createElement("button");up.textContent="↑";up.disabled=i===0;up.onclick=()=>move(type,i,-1);
    const down=document.createElement("button");down.textContent="↓";down.disabled=i===settings[type].length-1;down.onclick=()=>move(type,i,1);
    const show=document.createElement("input");show.type="checkbox";show.checked=entry.visible;show.title="Göster / gizle";show.onchange=()=>{entry.visible=show.checked;persist();apply(type);};
    row.append(name,up,down,show);panel.append(row);
   });
  }
  const reset=document.createElement("button");reset.textContent="Varsayılana döndür";reset.onclick=()=>{settings.home=defaults("home");settings.cash=defaults("cash");persist();render();apply("home");apply("cash");};panel.append(reset);
  const note=document.createElement("p");note.textContent="Gizlenen menüler ve sayaçlar kayıtları silmez. Düzen bu cihazda saklanır.";panel.append(note);
 }
 function move(type,i,delta){const arr=settings[type];[arr[i],arr[i+delta]]=[arr[i+delta],arr[i]];persist();render();apply(type);}
 function init(){ensureSearch();apply("home");apply("cash");render();}
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
 // Settings and counters can be rerendered by the main application.
 const observer=new MutationObserver(()=>{if(document.querySelector("#settingsHome")&&!document.querySelector("#ekzenLayoutSettings"))render();});
 document.addEventListener("DOMContentLoaded",()=>{const host=document.querySelector("#settingsHome");if(host)observer.observe(host,{childList:true});});
})();
