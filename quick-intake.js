/* EKZEN – WhatsApp mesajından tek dokunuşla taslak servis kaydı. */
(function(){
"use strict";
const get=id=>document.getElementById(id);
const clean=v=>String(v||"").toLocaleLowerCase("tr-TR").replace(/ı/g,"i").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const districts=["Akyurt","Altındağ","Ayaş","Bala","Beypazarı","Çamlıdere","Çankaya","Çubuk","Elmadağ","Etimesgut","Evren","Gölbaşı","Güdül","Haymana","Kahramankazan","Kalecik","Keçiören","Kızılcahamam","Mamak","Nallıhan","Polatlı","Pursaklar","Sincan","Şereflikoçhisar","Yenimahalle"];
const devices=["çamaşır makinesi","bulaşık makinesi","kurutma makinesi","buzdolabı","kahve makinesi","kombi","fırın","ocak","süpürge"];
const brands=["Bosch","Siemens","Profilo","Arçelik","Beko","Altus","Samsung","Miele","Vaillant","Demirdöküm","Baymak","Buderus","ECA","Protherm","Airfel","Ferroli"];
function extract(raw){
  const text=String(raw||"").trim();
  const links=text.match(/https?:\/\/[^\s<>"']+/gi)||[];
  let locationUrl="";
  for(const link of links){
    const candidate=link.replace(/[),;]+$/,"");
    if(typeof safeServiceLocationUrl==="function"&&safeServiceLocationUrl(candidate)){locationUrl=candidate;break;}
  }
  const simple=text.replace(/https?:\/\/[^\s<>"']+/gi," ").replace(/\s+/g," ").trim();
  const phone=simple.match(/(?:\+?90\s*|0)?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/)?.[0]||"";
  const district=districts.find(x=>new RegExp("(^|\\W)"+clean(x)+"($|\\W)","i").test(clean(simple)))||"";
  const device=devices.find(x=>clean(simple).includes(clean(x)))||"";
  const brand=brands.find(x=>clean(simple).includes(clean(x)))||"";
  const street=simple.match(/(?:^|[,;]|\s)([A-Za-zÇĞİÖŞÜçğıöşü0-9][A-Za-zÇĞİÖŞÜçğıöşü0-9. \-]{0,65}?\s+(?:caddesi|cadde|cd\.?|sokak|sokağı|sk\.?|bulvarı))\b/iu)?.[1]?.trim()||"";
  const remainder=street?simple.slice(simple.indexOf(street)+street.length):"";
  const number=remainder.match(/^\s*(?:,?\s*(?:No|Numara)\s*:?\s*)?(\d+[A-Za-z]?(?:\s*\/\s*\d+[A-Za-z]?)?)/iu)?.[1]?.replace(/\s+/g,"")||"";
  const apartment=simple.match(/([A-Za-zÇĞİÖŞÜçğıöşü][A-Za-zÇĞİÖŞÜçğıöşü\s]{1,32})\s+(?:apartmanı|apt\.?|sitesi)\b/iu)?.[0]?.trim()||"";
  // Hızlı kayıt: WhatsApp metninin tamamı açık adreste kalsın; konum URL\u0027si ayrı alanda tutulur.
  const address=text.replace(/https?:\/\/[^\s<>"\u0027]+/gi," ").replace(/[ \t]+/g," ").trim();
  const fault=simple.split(/[.!?\n]/).map(s=>s.trim()).find(s=>/akıt|çalışm|ısıtm|soğutm|sıkm|ses yap|su alm|hata ver|arızal/i.test(s))||"";
  return {raw:text,locationUrl,phone,district,device,brand,address,fault};
}
function createDialog(){
  if(get("ekzenQuickIntake"))return get("ekzenQuickIntake");
  const d=document.createElement("dialog");d.id="ekzenQuickIntake";
  d.style.cssText="border:0;border-radius:15px;padding:0;width:min(95vw,530px);max-height:92dvh;box-shadow:0 18px 60px #0005;color:#203248;background:#fff";
  d.innerHTML='<div style="display:grid;gap:12px;padding:18px;max-height:88dvh;overflow:auto;font-family:Arial,sans-serif">'+
  '<div style="display:flex;align-items:center;justify-content:space-between"><h2 style="font-size:20px;margin:0">⚡ Hızlı Kayıt</h2><button type="button" id="ekzenQuickClose">Kapat</button></div>'+
  '<label style="display:grid;gap:8px;font-weight:bold">WhatsApp mesajını veya konumu yapıştır<textarea id="ekzenQuickRaw" rows="6" style="width:100%;box-sizing:border-box;padding:11px;font:16px/1.5 Arial;border:1px solid #b5c8d7;border-radius:8px" placeholder="Örn: Aydik caddesi 8/11 Yavuzlar Apartmanı Mamak. Bosch çamaşır makinesi su akıtıyor."></textarea></label>'+
  '<div id="ekzenQuickPreview" style="padding:11px;background:#f3f7fa;border:1px solid #d5e2ea;border-radius:8px;white-space:pre-wrap;font-size:13px;line-height:1.6"></div>'+
  '<label style="display:grid;gap:6px;font-weight:bold">İş Kaynağı<select id="ekzenQuickSource" style="font-size:16px;padding:10px;border:1px solid #b5c8d7;border-radius:8px"></select></label>'+
  '<button id="ekzenQuickSave" type="button" style="padding:14px;background:#0f766e;border:0;border-radius:9px;color:#fff;font-size:17px;font-weight:bold">Hızlı Kaydet</button>'+
  '<small style="color:#64748b">Mesaj Açık Adres alanına, harita bağlantısı Konum alanına kaydedilir. Yapılan İşlemler boş kalır.</small><p id="ekzenQuickError" role="alert" style="color:#b91c1c;margin:0"></p></div>';
  document.body.appendChild(d);
  get("ekzenQuickClose").onclick=()=>d.close();
  get("ekzenQuickRaw").oninput=showPreview;
  get("ekzenQuickSave").onclick=save;
  return d;
}
function showPreview(){
  const p=extract(get("ekzenQuickRaw")?.value||"");
  const info=[];
  if(p.phone)info.push("Telefon: "+p.phone);
  if(p.district)info.push("İlçe: "+p.district);
  if(p.address)info.push("Adres: "+p.address);
  if(p.brand||p.device)info.push("Cihaz: "+[p.brand,p.device].filter(Boolean).join(" "));
  if(p.fault)info.push("Şikâyet: "+p.fault);
  if(p.locationUrl)info.push("WhatsApp/Harita konumu: Bağlantı alındı");
  get("ekzenQuickPreview").textContent=info.join("\n")||"Henüz ayrıştırılan bilgi yok. Mesaj olduğu gibi kaydedilecek.";
}
function open(){
  const d=createDialog();
  get("ekzenQuickRaw").value="";
  get("ekzenQuickError").textContent="";
  const selector=get("ekzenQuickSource");
  const current=document.querySelector("#mobileSourcePicker")?.value||document.querySelector("#mobileWelcomeSourcePicker")?.value||"Kendi İşim";
  const items=[...new Set(["Kendi İşim",...(typeof settingsList==="function"?settingsList("sources"):[]),current].filter(Boolean))];
  selector.replaceChildren(...items.map(x=>{const o=document.createElement("option");o.textContent=x;o.value=x;return o;}));
  const portal=typeof isSourcePortal==="function"&&isSourcePortal();
  selector.disabled=portal;selector.value=portal?portalSourceName():items.includes(current)?current:"Kendi İşim";
  showPreview();d.showModal();get("ekzenQuickRaw").focus();
}
function save(){
  const raw=get("ekzenQuickRaw").value.trim();
  if(!raw){get("ekzenQuickError").textContent="Önce WhatsApp mesajını yapıştır.";return;}
  const p=extract(raw);
  const today=typeof isoToday!=="undefined"?isoToday:new Date().toISOString().slice(0,10);
  const date=typeof mobileSelectedDate!=="undefined"&&mobileSelectedDate?mobileSelectedDate:today;
  const now=new Date().toISOString();
  const service={
    id:nextServiceId(),customerName:"",phone:p.phone,city:"Ankara",
    district:p.district,neighborhood:"",address:p.address,locationUrl:p.locationUrl,
    brand:p.brand,device:p.device,model:"",fault:p.fault,source:get("ekzenQuickSource").value||"Kendi İşim",
    status:"Yeni Kayıt",paymentStatus:"",availableDate:date,visitDate:date,availableTime:"",
    warrantyEnd:addYear(today),operatorNote:"",createdAt:now,price:0,
    sortOrder:state.services.reduce((min,item)=>Math.min(min,Number.isFinite(Number(item.sortOrder))?Number(item.sortOrder):0),0)-1,
    notes:[],
    photos:[],quickDraft:true,quickRawMessage:raw,
    statusHistory:[{id:uid(),date,status:"Yeni Kayıt",description:"WhatsApp hızlı kayıt – eksik bilgiler sonra tamamlanacak",createdAt:now}],
    history:[]
  };
  state.services.unshift(service);saveState();get("ekzenQuickIntake").close();
  if(typeof mobileSelectedDate!=="undefined")mobileSelectedDate=date;
  if(typeof mobileTechFilter!=="undefined")mobileTechFilter="new";
  render();
  if((/iPhone|Android|iPad|iPod/i.test(navigator.userAgent)||innerWidth<=820)&&typeof mobileOpenDetail==="function")mobileOpenDetail(service.id);
  else if(typeof switchView==="function")switchView("services");
}
function inject(){
  document.querySelectorAll('[data-mobile-action="open-new-service"],[data-action="open-service-modal"]').forEach(b=>{
    if(b.dataset.quickIntakeAdded)return;
    b.dataset.quickIntakeAdded="true";
    const btn=document.createElement("button");btn.type="button";btn.className="ekzen-quick-intake";btn.textContent="⚡ Hızlı Kayıt";
    btn.style.cssText="padding:10px 14px;margin:6px;border-radius:10px;border:1px solid #0f766e;background:#e5f4f0;color:#155e52;font-size:14px;font-weight:800;cursor:pointer";
    btn.onclick=e=>{e.preventDefault();e.stopPropagation();open();};
    if(b.classList.contains("mobile-new-service-bar") || b.classList.contains("mobile-welcome-new-service")){
      const parent=document.createElement("div");
      parent.className=b.classList.contains("mobile-welcome-new-service")?"ekzen-mobile-actions ekzen-welcome-actions":"ekzen-mobile-actions";
      b.parentNode.insertBefore(parent,b);
      parent.appendChild(b);
      parent.appendChild(btn);
    }else{
      b.insertAdjacentElement("afterend",btn);
    }
  });
}
inject();
new MutationObserver(inject).observe(document.body,{childList:true,subtree:true});
window.ekzenQuickIntakeOpen=open;
})();
