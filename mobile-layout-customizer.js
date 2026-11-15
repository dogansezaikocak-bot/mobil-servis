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
 if(typeof state!=="undefined"&&state.settings?.mobileLayoutCustom?.home)settings=structuredClone(state.settings.mobileLayoutCustom);
 for(const type of ["home","cash"]){
  const old=Array.isArray(settings[type])?settings[type]:[];
  settings[type]=[...old.filter(x=>defs[type].some(d=>d[0]===x.id)),...defaults(type).filter(x=>!old.some(y=>y.id===x.id))];
 }
 function persist(){const status=document.querySelector("#ekzenLayoutSaveStatus");if(status)status.textContent="Kaydedilmemiş değişiklikler var.";}
 async function saveLayout(){const status=document.querySelector("#ekzenLayoutSaveStatus");const btn=document.querySelector("#ekzenLayoutSave");if(btn)btn.disabled=true;try{state.settings.mobileLayoutCustom=JSON.parse(JSON.stringify(settings));localStorage.setItem(KEY,JSON.stringify(settings));saveLocalState();if(typeof canSyncCloud==="function"&&canSyncCloud()){await cloudRef.set({updatedAt:new Date().toISOString(),state});if(status)status.textContent="✓ Kaydedildi ve bulutla eşitlendi.";}else if(status)status.textContent="✓ Bu cihazda kaydedildi. Bulut bağlantısı yok; diğer cihazlara aktarılmadı.";}catch(error){if(status)status.textContent="⚠ Cihazda kaydedildi; bulut kaydı başarısız: "+(error?.message||"Bağlantı hatası");}finally{if(btn)btn.disabled=false;}}
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
  const flatten=v=>v==null?"":typeof v==="object"?Object.values(v).map(flatten).join(" "):String(v);
  const norm=v=>String(v).toLocaleLowerCase("tr-TR").replace(/ı/g,"i").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  const hits=records.filter(x=>norm(flatten(x.data)).includes(norm(q))).slice(0,80);
  out.replaceChildren();
  if(!hits.length){out.textContent="Eşleşen kayıt bulunamadı.";return;}
  for(const hit of hits){
   const b=document.createElement("button");b.type="button";b.className="ekzen-search-result";
   const d=hit.data;
   if(hit.type==="Servis"){
    const customer=document.createElement("span");customer.className="ekzen-search-customer";customer.textContent=d.customerName||d.customer||"İsimsiz Müşteri";
    const info=document.createElement("span");info.className="ekzen-search-info";info.textContent=[d.brand,d.device,d.address].filter(Boolean).join(" · ");
    const right=document.createElement("span");right.className="ekzen-search-right";
    const status=document.createElement("strong");status.className="ekzen-search-status";status.textContent=d.status||"Durum belirtilmedi";
    const payment=document.createElement("span");payment.className="ekzen-search-payment";
    const cash=(state.cash||[]).filter(x=>x.serviceId===d.id&&x.type==="income"&&!x.autoMaterialExpense&&!x.autoCommissionExpense&&!x.autoOtherExpense&&!x.parentCashId);
    const paid=cash.filter(x=>["Ödendi","Tahsilat Yapıldı"].includes(String(d.paymentStatus||""))||/tahsilat yapıldı|ödendi/i.test(String(x.title||""))).reduce((sum,x)=>sum+(Number(x.amount)||0),0);
    payment.textContent="Alınan: "+paid.toLocaleString("tr-TR",{style:"currency",currency:"TRY",maximumFractionDigits:0});
    const left=document.createElement("span");left.className="ekzen-search-left";left.append(customer,info);right.append(status,payment);b.append(left,right);
   }else{
    const parts=[d.name,d.title,d.description,d.source,d.amount,d.id].filter(Boolean);
    b.textContent="Kasa · "+parts.slice(0,4).join(" · ");
   }
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
   const def=defs[type].find(x=>x[0]===entry.id),el=(type==="cash"&&entry.id!=="transactions"?document.querySelector("#mobileDailyCashPage "+def[2])||document.querySelector("#mobileCashProfitCounter")?.parentElement?.querySelector(def[2]):document.querySelector(def[2]));if(!el)continue;
   el.hidden=!entry.visible;el.classList.toggle("ekzen-layout-hidden",!entry.visible);el.style.setProperty("display",entry.visible?"":"none",entry.visible?"":"important");
   const title=el.querySelector("strong")||(type==="cash"?el.querySelector("span"):null);
   if(title)title.textContent=entry.name;
  }
  // Only reorder siblings within the same container, preserving existing event handlers.
  const groups=new Map();
  for(const entry of entries){const def=defs[type].find(x=>x[0]===entry.id),el=(type==="cash"&&entry.id!=="transactions"?document.querySelector("#mobileDailyCashPage "+def[2])||document.querySelector("#mobileCashProfitCounter")?.parentElement?.querySelector(def[2]):document.querySelector(def[2]));if(!el||!el.parentElement)continue;const parent=el.parentElement;if(!groups.has(parent))groups.set(parent,[]);groups.get(parent).push(el);}
  for(const [parent,elements] of groups){if(elements.length<2)continue;const anchor=elements[0];let previous=anchor;for(const el of elements.slice(1)){parent.insertBefore(el,previous.nextSibling);previous=el;}}
 }
 function render(){
  const host=document.querySelector("#homeLayoutSettings");if(!host)return;
  let panel=host.querySelector("#ekzenLayoutSettings");if(!panel){panel=document.createElement("section");panel.id="ekzenLayoutSettings";host.append(panel);} panel.hidden=Boolean(host.querySelector('[data-home-device-tab="desktop"].is-active'));
  panel.replaceChildren();
  const heading=document.createElement("h3");heading.textContent="Mobil Menü ve Kasa Düzeni";panel.append(heading);
  for(const type of ["home","cash"]){
   const h=document.createElement("h4");h.textContent=type==="home"?"Ana sayfa menüleri":"Kasa sayfası";panel.append(h);
   settings[type].forEach((entry,i)=>{
    const row=document.createElement("div");row.className="ekzen-layout-row";
    const name=document.createElement("input");name.type="text";name.className="ekzen-layout-name";name.value=entry.name;name.setAttribute("aria-label","Menü adı");name.onchange=()=>{entry.name=name.value.trim()||defs[type].find(x=>x[0]===entry.id)[1];persist();apply(type);};
    const up=document.createElement("button");up.textContent="↑";up.disabled=i===0;up.onclick=()=>move(type,i,-1);
    const down=document.createElement("button");down.textContent="↓";down.disabled=i===settings[type].length-1;down.onclick=()=>move(type,i,1);
    const show=document.createElement("input");show.type="checkbox";show.className="ekzen-layout-visible";show.checked=entry.visible;show.title="Göster / gizle";show.onchange=()=>{entry.visible=show.checked;persist();apply(type);};
    const label=document.createElement("label");label.className="ekzen-layout-check";label.append(show,document.createTextNode("Göster"));row.append(name,up,down,label);panel.append(row);
   });
  }
  const reset=document.createElement("button");reset.textContent="Varsayılana döndür";reset.onclick=()=>{settings.home=defaults("home");settings.cash=defaults("cash");persist();render();apply("home");apply("cash");};panel.append(reset);
  const save=document.createElement("button");save.type="button";save.id="ekzenLayoutSave";save.textContent="✓ Değişiklikleri Kaydet";save.onclick=saveLayout;panel.append(save);const status=document.createElement("p");status.id="ekzenLayoutSaveStatus";status.setAttribute("role","status");status.textContent="Değişiklikleri uygulamak için Kaydet düğmesine basın.";panel.append(status);const note=document.createElement("p");note.textContent="Gizlenen menüler ve sayaçlar kayıtları silmez.";panel.append(note);
 }
 function move(type,i,delta){const arr=settings[type];[arr[i],arr[i+delta]]=[arr[i+delta],arr[i]];persist();render();apply(type);}
 function init(){ensureSearch();apply("home");apply("cash");render();document.addEventListener("click",e=>{if(e.target.closest("[data-home-device-tab]"))setTimeout(render,0);});}
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
 // Settings and counters can be rerendered by the main application.
 const style=document.createElement("style");
 style.textContent="#ekzenSearchOverlay[hidden]{display:none!important}#ekzenSearchOverlay{position:fixed;inset:0;z-index:2147483000;background:#0009;display:flex;justify-content:center;align-items:flex-start;padding:24px 12px;overflow:auto}.ekzen-search-card{width:min(100%,650px);background:white;color:#1e2530;border-radius:14px;padding:16px}.ekzen-search-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}#ekzenSearchInput{display:block;width:100%;padding:12px;font-size:16px;border:1px solid #aaa;border-radius:8px;background:white;color:#111}#ekzenSearchResults{max-height:65vh;overflow:auto;margin-top:12px}.ekzen-search-result{display:block;width:100%;padding:12px 5px;background:white;color:#222;text-align:left;border:0;border-bottom:1px solid #ddd;overflow-wrap:anywhere}.ekzen-layout-row{display:flex;gap:6px;margin:8px 0;align-items:center}.ekzen-layout-row input:not([type=checkbox]){flex:1;min-width:0}";
 style.textContent+=`
#ekzenLayoutSettings{display:block!important;max-width:100%;margin-top:18px;padding:16px;border:1px solid #d9e0e8;border-radius:12px;background:#f8fafc;color:#1e2530}
#ekzenLayoutSettings[hidden]{display:none!important}
#ekzenLayoutSettings h3,#ekzenLayoutSettings h4{color:#1e2530;margin:12px 0}
#ekzenLayoutSettings .ekzen-layout-row{display:flex!important;flex-wrap:wrap;gap:8px;align-items:center;min-height:48px;margin:8px 0;padding:8px;background:#fff;border:1px solid #e2e8f0;border-radius:9px}
#ekzenLayoutSettings .ekzen-layout-name{display:block!important;flex:1 1 180px!important;min-width:130px!important;width:auto!important;height:40px!important;min-height:40px!important;margin:0!important;padding:8px 10px!important;border:1px solid #aab8c8!important;border-radius:7px!important;background:#fff!important;color:#172033!important;-webkit-text-fill-color:#172033!important;font-size:15px!important;opacity:1!important;visibility:visible!important;appearance:auto!important}
#ekzenLayoutSettings .ekzen-layout-row>button{display:inline-flex!important;align-items:center;justify-content:center;width:38px!important;height:38px!important;min-width:38px!important;min-height:38px!important;margin:0!important;padding:0!important;background:#eef2f7!important;border:1px solid #cbd5e1!important;border-radius:7px!important;color:#172033!important;font-size:20px!important;line-height:1!important}
#ekzenLayoutSettings .ekzen-layout-row>button:disabled{opacity:.35!important}
#ekzenLayoutSettings .ekzen-layout-check{display:inline-flex!important;align-items:center!important;gap:6px!important;white-space:nowrap;color:#172033!important;font-size:13px!important;cursor:pointer}
#ekzenLayoutSettings input.ekzen-layout-visible{display:inline-block!important;position:static!important;width:18px!important;height:18px!important;min-width:18px!important;min-height:18px!important;max-width:18px!important;max-height:18px!important;margin:0!important;padding:0!important;transform:none!important;appearance:auto!important;accent-color:#2563eb!important;vertical-align:middle!important}
@media(max-width:550px){#ekzenLayoutSettings{padding:10px}#ekzenLayoutSettings .ekzen-layout-name{flex-basis:100%!important}}
`;
 style.textContent+="#mobileWelcomePage .ekzen-layout-hidden,#mobileWelcomePage .ekzen-layout-hidden.mobile-welcome-source-entry,#mobileWelcomePage .ekzen-layout-hidden.mobile-welcome-cash-entry,.ekzen-layout-hidden{display:none!important}#ekzenLayoutSave{display:block!important;background:#1765bd!important;color:white!important;padding:12px 18px!important;border-radius:9px!important;font-weight:700!important;margin:16px 0 8px!important;min-height:44px!important}#ekzenLayoutSaveStatus{font-size:13px;color:#334155}";style.textContent+="#ekzenSearchResults .ekzen-search-result{display:flex!important;justify-content:space-between;align-items:center;gap:12px;min-height:64px}#ekzenSearchResults .ekzen-search-left{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}#ekzenSearchResults .ekzen-search-customer{font-weight:750;font-size:15px;color:#172033}#ekzenSearchResults .ekzen-search-info{font-size:12px;color:#64748b;overflow-wrap:anywhere}#ekzenSearchResults .ekzen-search-right{display:flex;flex-direction:column;gap:5px;align-items:flex-end;text-align:right;flex-shrink:0;max-width:45%}#ekzenSearchResults .ekzen-search-status{font-size:12px;color:#075985;background:#e0f2fe;padding:4px 7px;border-radius:7px}#ekzenSearchResults .ekzen-search-payment{font-size:13px;font-weight:700;color:#166534}";document.head.append(style);
 const observer=new MutationObserver(()=>{if(document.querySelector("#homeLayoutSettings")&&!document.querySelector("#homeLayoutSettings #ekzenLayoutSettings"))render();});
 document.addEventListener("DOMContentLoaded",()=>{const host=document.querySelector("#homeLayoutSettings");if(host)observer.observe(host,{childList:true});});
})();
