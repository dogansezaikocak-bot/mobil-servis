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
  // Hızlı kayıt, telefon haricindeki metni herhangi bir servis alanına dağıtmaz.
  // Ham mesaj sadece quickRawMessage içinde saklanır.
  const phone=text.replace(/https?:\/\/[^\s<>"']+/gi," ").match(/(?:\+?90[\s.-]*|0)?5\d{2}[\s.-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}\b/)?.[0]||"";
  const links=text.match(/https?:\/\/[^\s<>"']+/gi)||[];
  const locationUrl=links.map(u=>u.replace(/[),;]+$/,"")).find(u=>
    typeof safeServiceLocationUrl==="function"&&safeServiceLocationUrl(u))||"";
  return {raw:text,phone,locationUrl};
}

/* Harita paylaşımındaki gerçek pin koordinatından adres çözümlemesi.
   Kamuya açık OpenStreetMap Nominatim yalnızca kullanıcı dokunduğunda çağrılır. */
let geoResult=null,geoBusy=false;
function embeddedLocation(raw){
  const text=String(raw||"").trim();
  const link=text.match(/https?:\/\/[^\s<>"']+/i)?.[0]?.replace(/[),;]+$/,"")||"";
  const coordinate=(lat,lon)=>{
    lat=Number(lat);lon=Number(lon);
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return null;
    return {lat,lon,link};
  };
  const tryPair=value=>{
    const m=String(value||"").match(/^\s*(-?\d{1,2}\.\d{3,})\s*[,;\s]\s*(-?\d{1,3}\.\d{3,})\s*$/);
    return m?coordinate(m[1],m[2]):null;
  };
  if(link){
    try {
      const u=new URL(link);
      // Yalnız kesin pin parametreleri; @lat,lon haritanın merkezini ifade edebilir.
      const tagged=u.href.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
      if(tagged)return coordinate(tagged[1],tagged[2]);
      for(const key of ["q","query","ll","daddr","destination","sll"]){
        const pair=tryPair(u.searchParams.get(key));
        if(pair)return pair;
      }
      const path=u.pathname.match(/\/(?:place|search)\/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
      if(path)return coordinate(path[1],path[2]);
    }catch(_){}
  }
  const direct=tryPair(text);
  if(direct)return direct;
  // WhatsApp açıklaması içinde ayrı satırda "39.x, 32.x" gibi açık koordinatlar.
  const literal=text.match(/(?:^|[\s(])(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})(?=$|[\s)])/);
  return literal?coordinate(literal[1],literal[2]):{link};
}
function normalizeNeighborhood(value){
  return String(value||"").trim().replace(/\s+(?:mahallesi|mah\.?)$/iu,"").trim();
}
function matchingDistrict(values){
  const possibilities=values.filter(Boolean).map(x=>String(x).trim());
  for(const value of possibilities){
    const hit=districts.find(d=>clean(d)===clean(value)
      ||clean(value).startsWith(clean(d)+" "));
    if(hit)return hit;
  }
  return "";
}
function geoFields(){
  return ["district","neighborhood","road","number"];
}
function clearGeo(){
  geoResult=null;
  const area=get("ekzenGeoFields");if(area){area.hidden=true;area.style.display="none";}
  const msg=get("ekzenGeoStatus");if(msg)msg.textContent="";
}
function displayGeo(result){
  geoResult=result;
  const area=get("ekzenGeoFields");
  area.hidden=false;
  area.style.display="grid";
  geoFields().forEach(field=>{get("ekzenGeo_"+field).value=result[field]||"";});
  get("ekzenGeoStatus").textContent="Harita verisinde bulunan bilgiler aşağıda. Doğru olduklarını kontrol et; eksikleri elle tamamlayabilirsin.";
}
async function resolveGeo(){
  if(geoBusy)return;
  const raw=get("ekzenQuickRaw")?.value||"";
  const pin=embeddedLocation(raw);
  const status=get("ekzenGeoStatus");
  if(!pin||!Number.isFinite(pin.lat)||!Number.isFinite(pin.lon)){
    status.textContent="Bu bağlantıdan kesin koordinat okunamadı. Kısa Google Maps bağlantıları doğrudan çözümlenemeyebilir. Haritadan pinin enlem-boylamını (ör. 39.912345, 32.812345) kopyalayıp yapıştırabilirsin.";
    return;
  }
  // Ankara dışı koordinatlar nedeniyle başka il/ilçenin yanlış kaydedilmesini engelle.
  if(pin.lat<38.4||pin.lat>41.1||pin.lon<30.2||pin.lon>34.8){
    status.textContent="Bu koordinat Ankara çevresinde görünmüyor. Konumu kontrol et.";return;
  }
  geoBusy=true;
  const btn=get("ekzenGeoLookup");btn.disabled=true;btn.textContent="Adres aranıyor…";
  status.textContent="Harita adres kaydı sorgulanıyor…";
  try {
    const request=new URL("https://nominatim.openstreetmap.org/reverse");
    request.searchParams.set("format","jsonv2");
    request.searchParams.set("lat",String(pin.lat));
    request.searchParams.set("lon",String(pin.lon));
    request.searchParams.set("zoom","18");
    request.searchParams.set("addressdetails","1");
    request.searchParams.set("accept-language","tr");
    const response=await fetch(request.href,{headers:{"Accept":"application/json"}});
    if(!response.ok)throw new Error("Adres sorgusu başarısız ("+response.status+")");
    const data=await response.json();
    if(get("ekzenQuickRaw")?.value!==raw)return;
    const a=data.address||{};
    const region=[a.province,a.state,a.city,a.municipality,a.county,a.state_district].filter(Boolean).join(" ");
    if(!/ankara/i.test(clean(region))){status.textContent="Harita sonucu Ankara olarak doğrulanamadı. Alanlar doldurulmadı.";return;}
    const district=matchingDistrict([a.city_district,a.town,a.municipality,a.county,a.state_district,a.suburb]);
    const candidate=normalizeNeighborhood(a.neighbourhood||a.quarter||a.suburb||"");
    const neighborhood=clean(candidate)===clean(district)?"":candidate;
    const road=String(a.road||a.pedestrian||a.residential||"").trim();
    const number=String(a.house_number||"").trim();
    displayGeo({district,neighborhood,road,number,lat:pin.lat,lon:pin.lon,
      locationUrl:(pin.link&&typeof safeServiceLocationUrl==="function"&&safeServiceLocationUrl(pin.link))?pin.link:
        "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(pin.lat+","+pin.lon)});
    if(!district)status.textContent="Konum bulundu, ancak ilçe açıkça tespit edilemedi. İlçeyi kontrol ederek elle girebilirsin.";
    if(!number)status.textContent+=" Kapı numarası haritada kayıtlı değilse boş kalır; tahmin edilmez.";
  }catch(e){
    status.textContent="Adres servisine ulaşılamadı: "+(e?.message||"Bağlantı hatası")+". Konum metni korunacak.";
  }finally{geoBusy=false;btn.disabled=false;btn.textContent="📍 Konumdan Adres Çıkar";}
}
function verifiedGeo(){
  if(!geoResult||get("ekzenGeoFields")?.hidden)return null;
  const values=Object.fromEntries(geoFields().map(f=>[f,get("ekzenGeo_"+f).value.trim()]));
  // Onaylanmış seçim ekranındaki bilgiler dışında otomatik tahmin yapılmaz.
  const house=values.number?("No:"+values.number):"";
  return {...values,address:[values.road,house].filter(Boolean).join(" "),
    locationUrl:geoResult.locationUrl};
}

function createDialog(){
  if(get("ekzenQuickIntake"))return get("ekzenQuickIntake");
  const d=document.createElement("dialog");d.id="ekzenQuickIntake";
  d.style.cssText="border:0;border-radius:15px;padding:0;width:min(95vw,530px);max-height:92dvh;box-shadow:0 18px 60px #0005;color:#203248;background:#fff";
  d.innerHTML='<div style="display:grid;gap:12px;padding:18px;max-height:88dvh;overflow:auto;font-family:Arial,sans-serif">'+
  '<div style="display:flex;align-items:center;justify-content:space-between"><h2 style="font-size:20px;margin:0">⚡ Hızlı Kayıt</h2><button type="button" id="ekzenQuickClose">Kapat</button></div>'+
  '<label style="display:grid;gap:8px;font-weight:bold">WhatsApp mesajını veya konumu yapıştır<textarea id="ekzenQuickRaw" rows="6" style="width:100%;box-sizing:border-box;padding:11px;font:16px/1.5 Arial;border:1px solid #b5c8d7;border-radius:8px" placeholder="Örn: Aydik caddesi 8/11 Yavuzlar Apartmanı Mamak. Bosch çamaşır makinesi su akıtıyor."></textarea></label>'+
  '<div id="ekzenQuickPreview" style="padding:11px;background:#f3f7fa;border:1px solid #d5e2ea;border-radius:8px;white-space:pre-wrap;font-size:13px;line-height:1.6"></div>'+
  '<button type="button" id="ekzenGeoLookup" style="padding:13px;background:#e0f2fe;color:#075985;border:1px solid #7dd3fc;border-radius:9px;font-weight:800;font-size:16px">📍 Konumdan Adres Çıkar</button>'+
  '<div id="ekzenGeoStatus" role="status" style="font-size:13px;line-height:1.5;color:#475569"></div>'+
  '<div id="ekzenGeoFields" hidden style="border:1px solid #cbd5e1;border-radius:10px;padding:12px;background:#f8fafc;gap:9px">'+
    '<strong style="font-size:15px">Haritadan bulunan adres — kontrol et</strong>'+
    '<label>İlçe<input id="ekzenGeo_district" autocomplete="off" placeholder="Örn: Mamak" style="display:block;width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:7px;font-size:16px"></label>'+
    '<label>Mahalle<input id="ekzenGeo_neighborhood" autocomplete="off" style="display:block;width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:7px;font-size:16px" placeholder="Örn: Peyami Safa"></label>'+
    '<label>Cadde / Sokak<input id="ekzenGeo_road" autocomplete="off" style="display:block;width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:7px;font-size:16px" placeholder="Örn: 372. Cadde"></label>'+
    '<label>Kapı No<input id="ekzenGeo_number" autocomplete="off" style="display:block;width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:7px;font-size:16px" placeholder="Haritada yoksa boş bırak"></label>'+
    '<small>Kaydet dediğinde yalnız burada kontrol ettiğin alanlar servise aktarılır. Adres bilgisi: © OpenStreetMap katılımcıları</small>'+
  '</div>'+
  '<label style="display:grid;gap:6px;font-weight:bold">İş Kaynağı<select id="ekzenQuickSource" style="font-size:16px;padding:10px;border:1px solid #b5c8d7;border-radius:8px"></select></label>'+
  '<button id="ekzenQuickSave" type="button" style="padding:14px;background:#0f766e;border:0;border-radius:9px;color:#fff;font-size:17px;font-weight:bold">Hızlı Kaydet</button>'+
  '<small style="color:#64748b">Yapıştırılan mesaj yalnızca Hızlı Kayıt bilgi kutusunda saklanır. Telefon varsa arama için kaydedilir.</small><p id="ekzenQuickError" role="alert" style="color:#b91c1c;margin:0"></p></div>';
  document.body.appendChild(d);
  get("ekzenQuickClose").onclick=()=>d.close();
  get("ekzenQuickRaw").oninput=()=>{clearGeo();showPreview();};
  get("ekzenGeoLookup").onclick=resolveGeo;
  get("ekzenQuickSave").onclick=save;
  return d;
}
function showPreview(){
  const p=extract(get("ekzenQuickRaw")?.value||"");
  get("ekzenQuickPreview").textContent=p.raw
    ? "Mesaj, fişte \"Hızlı Kayıt — Eksik Bilgileri Tamamla\" kutusunda saklanacak.\n"+
      (p.phone?"Telefon arama alanına kaydedilecek: "+p.phone:"Telefon bulunamadı; daha sonra ekleyebilirsin.")+
      "\nAdres yalnızca konumdan bulunup kontrol edildiyse doldurulacak. Şikâyet ve yapılan işlemler boş kalacak."
    : "Mesajı yapıştır; tamamı fişteki Hızlı Kayıt kutusunda korunacak.";
}
function open(){
  const d=createDialog();
  get("ekzenQuickRaw").value="";clearGeo();
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
  const confirmed=verifiedGeo();
  const today=typeof isoToday!=="undefined"?isoToday:new Date().toISOString().slice(0,10);
  const date=typeof mobileSelectedDate!=="undefined"&&mobileSelectedDate?mobileSelectedDate:today;
  const now=new Date().toISOString();
  const service={
    id:nextServiceId(),customerName:"",phone:p.phone,city:"Ankara",
    district:confirmed?.district||"",neighborhood:confirmed?.neighborhood||"",
    address:confirmed?.address||"",locationUrl:confirmed?.locationUrl||p.locationUrl||"",
    brand:"",device:"",model:"",fault:"",source:get("ekzenQuickSource").value||"Kendi İşim",
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
