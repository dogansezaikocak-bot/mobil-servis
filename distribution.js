(function(){
'use strict';
const KEY='ekzen-distribution-v7';
const LEGACY_KEY='ekzen-distribution-v6';
const BACKUP_KEY='ekzen-distribution-backup-v8';
const SNAPSHOT_KEY='ekzen-distribution-last-good-v8';
const AI_PROXY_KEY='ekzen-ai-proxy-url';
let data=load();
let filters={q:'',group:'',status:'all'};
let mode='route';
let aiImages=[];
let searchTimer=null;
let manageMode=false;
let selectedStops=new Set();
let expandedStops=new Set();
let aiRows=[];
let nearbyMode=false;
let currentLocation=null;
let nearbyBusy=false;
let nearbyMessage='';
function uid(){return 'd'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function distanceKm(lat1,lon1,lat2,lon2){
 const r=6371,toRad=v=>v*Math.PI/180;
 const dLat=toRad(lat2-lat1),dLon=toRad(lon2-lon1);
 const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
 return 2*r*Math.asin(Math.sqrt(a));
}
function formatDistance(km){if(!Number.isFinite(km))return '';return km<1?Math.round(km*1000)+' m':km.toLocaleString('tr-TR',{maximumFractionDigits:1})+' km'}
function getPhoneLocation(){return new Promise((resolve,reject)=>{
 if(!navigator.geolocation){reject(new Error('Bu telefonda konum özelliği desteklenmiyor.'));return}
 navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude}),e=>{
  const msg=e.code===1?'Konum izni verilmedi. Telefon ayarlarından bu siteye konum izni ver.':e.code===2?'Telefon konumu belirleyemedi. GPS ve internet bağlantısını kontrol et.':'Konum alınırken zaman aşımı oluştu.';
  reject(new Error(msg));
 },{enableHighAccuracy:true,timeout:20000,maximumAge:0});
})}
async function geocodeStop(stop){
 if(Number.isFinite(Number(stop.lat))&&Number.isFinite(Number(stop.lng)))return {lat:Number(stop.lat),lng:Number(stop.lng)};
 const query=[stop.address,stop.district,'Keçiören Ankara Türkiye'].filter(Boolean).join(', ');
 const url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=tr&q='+encodeURIComponent(query);
 const res=await fetch(url,{headers:{'Accept':'application/json'}});
 if(!res.ok)throw new Error('Adres konuma çevrilemedi.');
 const arr=await res.json();if(!arr?.length)return null;
 stop.lat=Number(arr[0].lat);stop.lng=Number(arr[0].lon);return {lat:stop.lat,lng:stop.lng};
}
async function activateNearby(){
 if(nearbyBusy)return;nearbyBusy=true;nearbyMessage='Telefon konumu alınıyor…';render();
 try{
  currentLocation=await getPhoneLocation();
  const targets=data.filter(x=>x.status!=='delivered');let completed=0,missing=0;
  for(const stop of targets){
   if(!(Number.isFinite(Number(stop.lat))&&Number.isFinite(Number(stop.lng)))){
    nearbyMessage=`Adresler konuma çevriliyor: ${completed+1}/${targets.length}`;render();
    try{const found=await geocodeStop(stop);if(!found)missing++;}catch(e){missing++;}
    completed++;save();
    await new Promise(r=>setTimeout(r,1050));
   }
  }
  nearbyMode=true;filters.status='waiting';filters.group='';const now=new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});nearbyMessage=missing?`${now}: ${missing} adres bulunamadı; bulunanlar güncel konumuna göre sıralandı.`:`${now}: Dükkânlar güncel konumuna göre yakından uzağa sıralandı.`;
 }catch(e){nearbyMessage=e.message;nearbyMode=false;}
 finally{nearbyBusy=false;save();render();}
}
function parseStored(raw){try{const x=JSON.parse(raw||'null');if(Array.isArray(x))return x;if(x&&Array.isArray(x.data))return x.data;return []}catch(e){return []}}
function load(){
 try{
  const candidates=[KEY,BACKUP_KEY,SNAPSHOT_KEY,LEGACY_KEY].map(k=>({key:k,items:parseStored(localStorage.getItem(k))}));
  const best=candidates.sort((a,b)=>b.items.length-a.items.length)[0];
  return best&&best.items.length?best.items:[];
 }catch(e){return []}
}
function save(){
 try{
  const json=JSON.stringify(data);
  localStorage.setItem(KEY,json);
  localStorage.setItem(BACKUP_KEY,json);
  if(data.length)localStorage.setItem(SNAPSHOT_KEY,json);
 }catch(e){alert('Kayıt yapılamadı: '+e.message)}
}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function trTitle(s){return String(s||'').toLocaleLowerCase('tr-TR').replace(/(^|[\s-])([a-zçğıöşü])/g,(m,a,b)=>a+b.toLocaleUpperCase('tr-TR')).trim()}
function inferNeighborhood(address){
 const a=String(address||'').replace(/\s+/g,' ').trim();if(!a)return '';
 // Kural: Adreste ilk geçen “Mahallesi / Mah. / Mh.” ifadesinin hemen önündeki ad mahalledir.
 // AI'nin yazdığı eski grup bilgisine güvenilmez; doğrudan adres metni esas alınır.
 const marker=/(?:MAHALLESİ|MAHALLESI|MAHALLE|MAH|MH)\.?(?=\s|[,;/]|$)/iu;
 const hit=marker.exec(a);if(!hit)return '';
 let before=a.slice(0,hit.index).trim();
 // Adres başındaki il/ilçe ifadelerini temizle; mahalle adının kendisini koru.
 before=before.replace(/^(?:ANKARA(?:\s+İLİ)?|KEÇİÖREN|KECIOREN|PURSAKLAR|YENİMAHALLE|YENIMAHALLE|MAMAK|ALTINDAĞ|ALTINDAG|ÇANKAYA|CANKAYA|ETİMESGUT|ETIMESGUT|SİNCAN|SINCAN)[,\s-]+/iu,'').trim();
 // Virgül, eğik çizgi veya noktalı virgülden sonraki son bölüm mahalle adıdır.
 before=before.split(/[,/;]/).pop().trim();
 // Cadde/sokak gibi önceki adres parçaları yanlışlıkla kaldıysa son parçayı al.
 before=before.replace(/^(?:CADDE|CADDESİ|CAD\.?|CD\.?|SOKAK|SOK\.?|SK\.?)\s+/iu,'').trim();
 if(!before)return '';
 return trTitle(before)+' Mahallesi';
}
function shouldInferDistrict(d){const x=foldTr(d||'');return !x||['kecioren','ankara kecioren','ankara','pursaklar','yenimahalle','mamak','altindag','cankaya','etimesgut','sincan'].includes(x)}
function applyNeighborhood(x){const inferred=inferNeighborhood(x.address)||inferNeighborhood(x.rawAddress);if(inferred)x.district=inferred;return x}
function statusLabel(s){return ({waiting:'Bekliyor',prepared:'Hazırlandı',loaded:'Yüklendi',delivered:'Teslim Edildi'})[s]||'Bekliyor'}
function nextStatus(s){return ({waiting:'prepared',prepared:'loaded',loaded:'delivered',delivered:'waiting'})[s]||'prepared'}
function normalizeMaterial(m){
 if(typeof m==='string')return {id:uid(),kind:'generic',name:m.trim(),cooler:m.trim(),newDesign:'',quantity:1,delivered:false};
 const rawKind=String(m.kind||m.type||m.category||'').trim().toLocaleLowerCase('tr-TR');
 const kind=rawKind.includes('levha')||rawKind==='plate'?'plate':rawKind.includes('led')?'led':'generic';
 const cooler=String(m.cooler||m.sogutucu||m.soğutucu||m.name||m.material||'').trim();
 const newDesign=String(m.newDesign||m.new_design||m.yeniTasarim||m.yeni_tasarim||m.design||'').trim();
 const quantity=Math.max(1,Number.parseInt(m.quantity||m.qty||m.adet||1,10)||1);
 const name=String(m.name||(kind==='plate'?'Baskı Levhası: '+(newDesign||cooler):[cooler,newDesign].filter(Boolean).join(' · '))).trim();
 return {id:m.id||uid(),kind,name,cooler:cooler||name,newDesign,quantity,delivered:Boolean(m.delivered)};
}
function materialKey(m){return foldTr((m.kind||'generic')+'|'+(m.cooler||m.name||'')+'|'+(m.newDesign||''))}
function materialLabel(m){return m.kind==='plate'?'Baskı Levhası: '+(m.newDesign||m.cooler||m.name||'-'):[m.cooler||m.name,m.newDesign].filter(Boolean).join(' · ')}
function groupedMaterials(stop){
 const map=new Map();
 for(const m of stop.materials||[]){const k=materialKey(m);const cur=map.get(k)||{key:k,kind:m.kind||'generic',cooler:m.cooler||m.name,newDesign:m.newDesign||'',quantity:0,deliveredQuantity:0,ids:[]};cur.quantity+=Math.max(1,Number(m.quantity)||1);if(m.delivered)cur.deliveredQuantity+=Math.max(1,Number(m.quantity)||1);cur.ids.push(m.id);map.set(k,cur)}
 return [...map.values()];
}
function normalizeItem(x={}){
 const raw=Array.isArray(x.materials)?x.materials:String(x.materials||x.material||'').split(/[,;\n]+/);
 const materials=raw.map(normalizeMaterial).filter(m=>m.name||m.cooler||m.newDesign);
 const allDelivered=materials.length&&materials.every(m=>m.delivered);
 const requestedStatus=String(x.status||'').trim();if(requestedStatus==='delivered')materials.forEach(m=>m.delivered=true);
 return applyNeighborhood({id:x.id||uid(),customer:String(x.customer||x.name||'').trim(),address:String(x.address||'').trim(),district:String(x.district||x.group||x.neighborhood||'').trim(),phone:String(x.phone||'').trim(),materials,status:(requestedStatus==='delivered'||allDelivered)?'delivered':'waiting',note:String(x.note||'').trim(),deliveredAt:x.deliveredAt||'',rawAddress:String(x.rawAddress||x.raw_address||'').trim(),addressConfidence:Number.isFinite(Number(x.addressConfidence??x.address_confidence))?Number(x.addressConfidence??x.address_confidence):null,needsReview:Boolean(x.needsReview??x.needs_review),lat:Number.isFinite(Number(x.lat))?Number(x.lat):null,lng:Number.isFinite(Number(x.lng))?Number(x.lng):null});
}
function mergeDuplicates(list){
 const map=new Map();
 for(const raw of list.map(normalizeItem)){
  const key=foldTr(raw.customer)+'|'+foldTr(raw.address);
  if(!map.has(key)){map.set(key,raw);continue}
  const base=map.get(key);base.materials.push(...raw.materials);base.phone=base.phone||raw.phone;base.district=base.district||raw.district;base.note=[base.note,raw.note].filter(Boolean).join(' · ');
 }
 return [...map.values()];
}
function syncStatus(x){const ms=x.materials||[];x.status=ms.length&&ms.every(m=>m.delivered)?'delivered':'waiting';if(x.status==='delivered'&&!x.deliveredAt)x.deliveredAt=new Date().toISOString();if(x.status!=='delivered')x.deliveredAt='';}
data=mergeDuplicates(data);
function visible(){
 const list=data.filter(x=>{const h=(x.customer+' '+x.address+' '+x.district+' '+x.materials.map(m=>m.name).join(' ')+' '+x.note).toLocaleLowerCase('tr');return (!filters.q||h.includes(filters.q.toLocaleLowerCase('tr'))) && (!filters.group||x.district===filters.group) && (filters.status==='all'||x.status===filters.status)});
 if(nearbyMode&&currentLocation){
  for(const x of list)x._distance=(Number.isFinite(Number(x.lat))&&Number.isFinite(Number(x.lng)))?distanceKm(currentLocation.lat,currentLocation.lng,Number(x.lat),Number(x.lng)):Infinity;
  list.sort((a,b)=>(a._distance??Infinity)-(b._distance??Infinity));
 }
 return list;
}
function materialTotals(){
 const map=new Map();
 for(const stop of data)for(const m of stop.materials){const k=materialLabel(m);const q=Math.max(1,Number(m.quantity)||1);const cur=map.get(k)||{name:k,total:0,delivered:0};cur.total+=q;if(m.delivered)cur.delivered+=q;map.set(k,cur)}
 return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'tr'));
}
function render(){
 const root=document.querySelector('#distributionView'); if(!root)return;
 data.forEach(syncStatus);save();
 if(mode==='warehouse')mode='route';
 const total=data.length,delivered=data.filter(x=>x.status==='delivered').length;
 const groups=[...new Set(data.map(x=>x.district).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));
 const mats=materialTotals();
 root.innerHTML=`<div class="dist-page v7-page">
 <div class="dist-head"><div><span class="section-kicker">V7 Operasyon Merkezi</span><h2>Malzeme Operasyon Sistemi</h2><p>PDF veya fotoğrafı oku → müşteri kartından malzemeleri kontrol et → eksiksiz teslim et.</p></div><div class="dist-head-actions"><button class="secondary-button dist-ai-main-button" data-dist="ai-open">📄 AI Listeyi Oku</button><button class="secondary-button" data-dist="import">Liste İçe Aktar</button><button class="primary-button" data-dist="add">+ Yeni Durak</button></div></div>
 <div class="dist-stats"><article><span>Toplam Müşteri</span><b>${total}</b></article><article><span>Toplam Malzeme</span><b>${mats.reduce((a,m)=>a+m.total,0)}</b></article><article><span>Teslim</span><b>${delivered}</b></article><article><span>Kalan</span><b>${total-delivered}</b></article></div>
 <div class="v7-tabs"><button class="${mode==='route'?'is-active':''}" data-dist="set-mode" data-mode="route">🚚 Dağıtım</button><button class="${mode==='summary'?'is-active':''}" data-dist="set-mode" data-mode="summary">📊 Operasyon Özeti</button></div>
 ${mode==='summary'?summaryView(mats,total,delivered):routeView(groups)}
 </div>`;
}
function neighborhoodStats(groups){return groups.map(name=>{const stops=data.filter(x=>x.district===name);const delivered=stops.filter(x=>x.status==='delivered').length;return {name,total:stops.length,delivered,complete:Boolean(stops.length)&&delivered===stops.length}})}
function routeView(groups){
 const list=visible(),stats=neighborhoodStats(groups);
 const neighborhoodBar=`<section class="dist-neighborhoods"><div class="dist-neighborhoods-head"><b>📍 Mahalleler</b><span>Mahalleye dokunarak o bölgedeki dükkânları göster.</span></div><div class="dist-neighborhood-chips"><button class="dist-neighborhood-chip all ${!filters.group?'is-active':''}" data-dist="group-chip" data-group=""><span>Tümü</span><b>${data.length}</b></button>${stats.map(g=>`<button class="dist-neighborhood-chip ${g.complete?'is-complete':''} ${filters.group===g.name?'is-active':''}" data-dist="group-chip" data-group="${esc(g.name)}"><span>${esc(g.name)}</span><b>${g.total}</b>${g.complete?'<em>✓</em>':`<small>${g.total-g.delivered} kaldı</small>`}</button>`).join('')}</div></section>`;
 return `${neighborhoodBar}<div class="dist-toolbar"><input id="distSearch" type="search" autocomplete="off" placeholder="Dükkân, adres, LED veya baskı levhası ara" value="${esc(filters.q)}"><select id="distGroup"><option value="">Tüm Mahalleler (${data.length})</option>${stats.map(g=>`<option value="${esc(g.name)}" ${g.name===filters.group?'selected':''}>${esc(g.name)} (${g.total})${g.complete?' ✓':''}</option>`).join('')}</select><select id="distStatus"><option value="all">Tüm Durumlar</option>${['waiting','delivered'].map(st=>`<option value="${st}" ${st===filters.status?'selected':''}>${statusLabel(st)}</option>`).join('')}</select><button class="primary-button nearby-button ${nearbyMode?'is-active':''}" data-dist="nearby" ${nearbyBusy?'disabled':''}>${nearbyBusy?'📍 Konum yenileniyor…':nearbyMode?'📍 Konumumu Yenile':'📍 Yakınımdaki Dükkânlar'}</button>${nearbyMode?'<button class="secondary-button" data-dist="normal-order">↩ Normal Sıra</button>':''}<button class="secondary-button" data-dist="manage-toggle">${manageMode?'Bitti':'☑ Seç'}</button><button class="secondary-button" data-dist="export">Yedek Al</button><button class="danger-button" data-dist="clear-delivered">Teslimleri Temizle</button></div>${nearbyMessage?`<div class="nearby-status ${nearbyMode?'success':''}">${esc(nearbyMessage)}</div>`:''}${filters.group?`<div class="dist-active-neighborhood ${stats.find(g=>g.name===filters.group)?.complete?'is-complete':''}"><span>📍 ${esc(filters.group)}</span><b>${stats.find(g=>g.name===filters.group)?.total||0} müşteri</b>${stats.find(g=>g.name===filters.group)?.complete?'<em>✓ Tamamlandı</em>':''}</div>`:''}${manageMode?`<div class="dist-bulkbar"><button class="secondary-button" data-dist="select-all">Tümünü Seç</button><span>${selectedStops.size} seçili</span><button class="danger-button" data-dist="delete-selected" ${selectedStops.size?'':'disabled'}>Seçilenleri Sil</button><button class="danger-button" data-dist="delete-all">Tüm Dağıtımı Sil</button></div>`:''}<div class="dist-list">${list.length?list.map(card).join(''):'<div class="dist-empty">Bu filtrede kayıt yok.</div>'}</div>`
}
function summaryView(mats,total,delivered){const remaining=mats.filter(m=>m.total>m.delivered);return `<section class="v7-summary"><div class="v7-summary-hero"><b>${delivered}/${total}</b><span>müşteri tamamlandı</span><div class="dist-progress"><span style="width:${total?Math.round(delivered/total*100):0}%"></span></div></div><div class="v7-summary-grid"><article><h3>Teslim Edilecek Malzemeler</h3>${remaining.length?remaining.map(m=>`<p><span>${esc(m.name)}</span><b>${m.total-m.delivered} adet</b></p>`).join(''):'<p>Tüm malzemeler teslim edildi.</p>'}</article><article><h3>Teslim Edilemeyen Duraklar</h3>${data.filter(x=>x.status!=='delivered').slice(0,30).map(x=>`<p><span>${esc(x.customer)}</span><b>${groupedMaterials(x).reduce((a,m)=>a+(m.quantity-m.deliveredQuantity),0)} adet</b></p>`).join('')||'<p>Kalan durak yok.</p>'}</article></div></section>`}
function materialCardRow(g,x){
 const done=g.deliveredQuantity===g.quantity;
 const text=g.kind==='plate'
  ? `<span><b>${g.quantity} adet</b> · Baskı Levhası<br><em>${esc(g.newDesign||g.cooler||'-')}</em></span>`
  : `<span><b>${g.quantity} adet</b> · LED: ${esc(g.cooler||'-')}</span>`;
 return `<label class="${done?'is-done':''}"><input type="checkbox" data-dist="deliver-group" data-id="${x.id}" data-key="${esc(g.key)}" ${done?'checked':''}>${text}<small>${done?'Teslim edildi':'Bekliyor'}</small></label>`;
}
function card(x){
 const map=x.address?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(x.address)}`:'';
 const groups=groupedMaterials(x),totalQty=groups.reduce((a,m)=>a+m.quantity,0),complete=x.materials.length&&x.materials.every(m=>m.delivered),expanded=expandedStops.has(x.id);
 const leds=groups.filter(g=>g.kind!=='plate'),plates=groups.filter(g=>g.kind==='plate');
 const materialHtml=groups.length?`${leds.length?`<div class="v7-material-section"><strong>LED MALZEMELERİ</strong>${leds.map(g=>materialCardRow(g,x)).join('')}</div>`:''}${plates.length?`<div class="v7-material-section"><strong>BASKI LEVHASI</strong>${plates.map(g=>materialCardRow(g,x)).join('')}</div>`:''}`:'<span>Malzeme girilmedi</span>';
 return `<article class="dist-card status-${x.status}">${manageMode?`<label class="dist-select"><input type="checkbox" data-dist="select-stop" data-id="${x.id}" ${selectedStops.has(x.id)?'checked':''}><span>Seç</span></label>`:''}<div class="dist-card-top"><div><small>${esc(x.district||'Grup belirtilmedi')}</small><h3>${esc(x.customer||'İsimsiz dükkân')}</h3><p>${esc(x.address||'Adres girilmedi')}</p></div><div class="dist-card-badges">${nearbyMode&&Number.isFinite(x._distance)?`<span class="distance-badge">📍 ${formatDistance(x._distance)}</span>`:''}<span class="dist-badge">${statusLabel(x.status)}</span></div></div><button class="v7-material-toggle" data-dist="toggle-materials" data-id="${x.id}">📦 Malzemeler (${totalQty} adet) ${expanded?'▲':'▼'}</button>${expanded?`<div class="v7-stop-materials">${materialHtml}</div>`:''}${x.note?`<p class="dist-note">Not: ${esc(x.note)}</p>`:''}<div class="dist-card-actions">${x.phone?`<a class="secondary-button" href="tel:${esc(x.phone)}">Ara</a>`:''}${map?`<a class="secondary-button" target="_blank" rel="noopener" href="${map}">Konuma Git</a>`:''}${complete?`<button class="secondary-button" data-dist="reset-waiting" data-id="${x.id}">↩ Beklemeye Al</button>`:''}<button class="secondary-button" data-dist="edit" data-id="${x.id}">Düzenle</button><button class="primary-button" data-dist="complete-stop" data-id="${x.id}" ${complete?'disabled':''}>${complete?'✓ Teslim Tamam':'Tümünü Teslim Et'}</button></div>${x.deliveredAt?`<small class="dist-time">Teslim: ${new Date(x.deliveredAt).toLocaleString('tr-TR')}</small>`:''}</article>`
}
function openForm(item){item=item||normalizeItem();const d=document.querySelector('#distributionDialog');const f=d.querySelector('form');f.reset();f.elements.id.value=item.id;f.elements.customer.value=item.customer;f.elements.district.value=item.district;f.elements.address.value=item.address;f.elements.phone.value=item.phone;f.elements.materials.value=item.materials.map(m=>m.kind==='plate'?`BASKI LEVHASI | ${m.newDesign||m.cooler||''} | ${Math.max(1,Number(m.quantity)||1)}`:`LED | ${m.cooler||m.name||''} | ${Math.max(1,Number(m.quantity)||1)}`).join('\n');f.elements.note.value=item.note;f.elements.status.value=item.status;d.querySelector('[data-dist-delete]').hidden=!data.some(x=>x.id===item.id);d.showModal()}
function importDialog(){document.querySelector('#distributionImportDialog').showModal()}
function parseImport(text){
 text=String(text||'').trim();if(!text)return[];
 try{const j=JSON.parse(text);const arr=Array.isArray(j)?j:(j.items||j.distributions||[]);return arr.map(normalizeItem)}catch(e){}
 const looksLikeAddress=v=>/(?:MAHALLESİ|MAHALLESI|MAHALLE|MAH|MH)\.?\b|\b(?:CADDE|CADDESİ|CAD|CD|SOKAK|SOK|SK|BULVAR|NO)\.?\b/iu.test(String(v||''));
 return text.split(/\n+/).map(line=>{
  const parts=line.split(/\t|\s*\|\s*|\s*;\s*/).map(v=>v.trim());
  if(!parts[0])return null;
  let customer=parts[0]||'',address='',district='',materials=[];
  if(parts.length>=7 && looksLikeAddress(parts[1])){
   address=parts[1]||'';
   const led1=parts[2]||'',qty1=Math.max(0,Number.parseInt(parts[3]||'0',10)||0);
   const led2=parts[4]||'',qty2=Math.max(0,Number.parseInt(parts[5]||'0',10)||0);
   const plate=parts.slice(6).join(' | ').trim();
   if(led1&&qty1)materials.push({kind:'led',cooler:led1,newDesign:'',quantity:qty1});
   if(led2&&qty2)materials.push({kind:'led',cooler:led2,newDesign:'',quantity:qty2});
   if(plate&&!/^(?:-|LEVHA YOK|YOK)$/iu.test(plate))materials.push({kind:'plate',cooler:'Baskı Levhası',newDesign:plate,quantity:Math.max(1,qty2||1)});
  }else if(parts.length===2){address=parts[1]||'';}
  else if(looksLikeAddress(parts[1])){address=parts[1]||'';materials=parts.slice(2).filter(Boolean);}
  else{district=parts[1]||'';address=parts[2]||'';materials=parts.slice(3).filter(Boolean);}
  return normalizeItem({customer,address,district,materials});
 }).filter(x=>x&&x.customer);
}
function download(name,content,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function aiDialog(){
 const d=document.querySelector('#distributionAiDialog'); const f=document.querySelector('#distributionAiForm');
 aiImages=[]; aiRows=[]; f.reset(); document.querySelector('#distAiPreviews').innerHTML='<p>Henüz PDF veya fotoğraf seçilmedi.</p>'; document.querySelector('#distAiResultSection').hidden=true; document.querySelector('#distAiSaveButton').disabled=true; const proxyInput=document.querySelector('#distAiProxyUrl');if(proxyInput)proxyInput.value=localStorage.getItem(AI_PROXY_KEY)||''; setAiStatus('PDF veya fotoğrafları seçip “AI ile Oku” düğmesine bas.'); d.showModal();
}
function setAiStatus(text,type=''){const el=document.querySelector('#distAiStatus');if(!el)return;el.textContent=text;el.className='dist-ai-status'+(type?' '+type:'')}
function readFileAsDataUrl(file){
 return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(r.error||new Error('Dosya okunamadı.'));r.readAsDataURL(file)})
}
function isHeicFile(file){
 const type=String(file?.type||'').toLowerCase(),name=String(file?.name||'').toLowerCase();
 return type.includes('heic')||type.includes('heif')||/\.(heic|heif)$/.test(name);
}
async function heicToJpegBlob(file){
 if(typeof window.heic2any!=='function')throw new Error('HEIC dönüştürücü yüklenemedi. Sayfayı yenileyip tekrar dene.');
 const result=await window.heic2any({blob:file,toType:'image/jpeg',quality:0.88});
 return Array.isArray(result)?result[0]:result;
}
function loadImageFromBlob(blob){
 return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(blob),img=new Image();
  img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};
  img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Fotoğraf tarayıcıda açılamadı.'))};
  img.src=url;
 });
}
async function fileToDataUrl(file){
 // OpenAI yalnızca JPEG, PNG, GIF ve WEBP kabul eder. iPhone HEIC fotoğrafları önce JPEG'e çevrilir.
 let source=file;
 if(isHeicFile(file))source=await heicToJpegBlob(file);
 const supported=/^image\/(jpeg|jpg|png|gif|webp)$/i.test(String(source.type||''));
 if(!supported && !isHeicFile(file))throw new Error('Desteklenmeyen fotoğraf biçimi. JPG, PNG veya WEBP seç.');
 const img=await loadImageFromBlob(source);
 const max=1800,largest=Math.max(img.naturalWidth||0,img.naturalHeight||0);
 if(!largest)throw new Error('Fotoğraf boyutu okunamadı.');
 const scale=Math.min(1,max/largest),c=document.createElement('canvas');
 c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));
 const ctx=c.getContext('2d');if(!ctx)throw new Error('Fotoğraf dönüştürülemedi.');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);
 const url=c.toDataURL('image/jpeg',0.88);
 if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(url))throw new Error('Geçerli JPEG oluşturulamadı.');
 return url;
}
function renderAiImages(){
 const box=document.querySelector('#distAiPreviews');if(!box)return;
 box.innerHTML=aiImages.length?aiImages.map((x,i)=>`<figure><img src="${x.url}" alt="Sayfa ${i+1}"><figcaption>${esc(x.label||('Sayfa '+(i+1)))}<button type="button" data-dist="ai-remove-image" data-index="${i}">×</button></figcaption></figure>`).join(''):'<p>Henüz PDF veya fotoğraf seçilmedi.</p>';
}
function isPdfFile(file){
 const type=String(file?.type||'').toLowerCase(),name=String(file?.name||'').toLowerCase();
 return type==='application/pdf'||/\.pdf$/.test(name);
}
async function pdfToPageImages(file,maxPages){
 if(!window.pdfjsLib)throw new Error('PDF okuyucu yüklenemedi. İnternet bağlantısını kontrol edip sayfayı yenile.');
 window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
 const bytes=new Uint8Array(await file.arrayBuffer());
 const pdf=await window.pdfjsLib.getDocument({data:bytes}).promise;
 const count=Math.min(pdf.numPages,maxPages),out=[];
 for(let pageNo=1;pageNo<=count;pageNo++){
  setAiStatus(`${file.name}: ${pageNo}/${count}. sayfa hazırlanıyor…`,'working');
  const page=await pdf.getPage(pageNo);
  const base=page.getViewport({scale:1});
  const scale=Math.min(2.4,1800/Math.max(base.width,base.height));
  const viewport=page.getViewport({scale:Math.max(1.4,scale)});
  const canvas=document.createElement('canvas');
  canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('PDF sayfası görüntüye çevrilemedi.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  await page.render({canvasContext:ctx,viewport}).promise;
  out.push({name:file.name,url:canvas.toDataURL('image/jpeg',0.92),label:`${file.name} · Sayfa ${pageNo}`});
 }
 if(pdf.numPages>count)throw new Error(`PDF ${pdf.numPages} sayfa; en fazla ${maxPages} sayfa alınabildi.`);
 return out;
}
async function handleAiFiles(files){
 const list=Array.from(files||[]);
 if(!list.length){setAiStatus('Dosya seçilmedi.','error');return}
 const remaining=10-aiImages.length;if(remaining<=0){setAiStatus('En fazla 10 sayfa eklenebilir.','error');return}
 setAiStatus(list.length+' dosya alındı, hazırlanıyor…','working');
 let added=0,errors=[];
 for(const f of list){
  if(aiImages.length>=10)break;
  try{
   if(isPdfFile(f)){
    const pages=await pdfToPageImages(f,10-aiImages.length);aiImages.push(...pages);added+=pages.length;
   }else{
    const url=await fileToDataUrl(f);aiImages.push({name:f.name||'Fotoğraf',url,label:f.name||('Fotoğraf '+(aiImages.length+1))});added++;
   }
  }catch(e){console.warn(e);errors.push((f.name||'Dosya')+': '+e.message)}
 }
 renderAiImages();
 const input1=document.querySelector('#distAiFiles'),input2=document.querySelector('#distAiCamera');if(input1)input1.value='';if(input2)input2.value='';
 if(added)setAiStatus(aiImages.length+' sayfa hazır.'+(errors.length?' '+errors.join(' | '):''),errors.length?'warning':'success');
 else setAiStatus('Dosya alınamadı. PDF, JPG veya PNG olarak tekrar seç.','error');
}
function aiPrompt(groupRules){
 const existing=[...new Set(data.map(x=>x.district).filter(Boolean))];
 const knownCustomers=data.slice(0,250).filter(x=>x.customer&&x.address).map(x=>`${x.customer} => ${x.address}`).join(' | ');
 return `Bu PDF sayfaları veya fotoğraflar market dolabı malzeme dağıtım listeleridir. Tablodaki HER SATIRI yukarıdan aşağıya sırayla oku ve yalnızca geçerli JSON döndür.
BENİM İÇİN ZORUNLU 4 ALAN ŞUNLARDIR ve hiçbirini atlama:
1) MÜŞTERİ / DÜKKÂN İSMİ
2) ADRES
3) SOĞUTUCU bölümü
4) YENİ TASARIM yazan bölüm
Şema: {"items":[{"customer":"dükkan/müşteri adı","raw_address":"fotoğraftaki adresin harfiyen yazımı","address":"doğrulanmış tam adres","address_confidence":0-100,"needs_review":true/false,"phone":"telefon varsa","district":"mahalle veya grup","materials":[{"cooler":"SOĞUTUCU sütunundaki metin","new_design":"YENİ TASARIM sütunundaki metin","quantity":1}],"note":"belirsiz veya ek bilgi"}]}.
KRİTİK KURALLAR:
- Her fiziksel tablo satırı bir dolap ve bir malzeme kaydıdır. Aynı dükkân 3 satırdaysa 3 ayrı malzeme vardır; quantity toplamda 3 olmalıdır. Hiçbir satırı tekilleştirip kaybetme.
- SOĞUTUCU sütununu ve YENİ TASARIM sütununu birbirine karıştırma; ikisini ayrı alanlara aynen yaz.
- Yeni Tasarım hücresi boşsa boş bırak, ama alanı JSON'da mutlaka bulundur.
- Aynı dükkânın satırlarını tek müşteri kaydında birleştirebilirsin fakat materials dizisine her satırı ayrı nesne olarak ekle.
ADRES KURALLARI:
1) Adres sütununu diğer sütunlardan bağımsız, karakter karakter oku.
2) Türkçe harfleri aynen koru: Ç, Ğ, İ, I, Ö, Ş, Ü. Görüntüde olmayan harfi tahmin ederek değiştirme.
3) İlçe, mahalle, cadde, sokak ve kapı numarasını atlama. Sayıları aynen yaz.
4) Emin olmadığın kelimeyi uydurma; needs_review=true yap.
- Başlık, sayfa numarası ve toplam satırlarını alma.
- Okunamayan alanı boş bırak ve note alanında belirt.
Mevcut grup adları: ${existing.join(', ')||'yok'}.
Kullanıcının grup kuralları: ${groupRules||'yok'}.
Kayıtlı müşteri-adres eşleşmeleri: ${knownCustomers||'yok'}.`;}

function foldTr(s){return String(s||'').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'')}
function similarity(a,b){a=foldTr(a);b=foldTr(b);if(!a||!b)return 0;if(a===b)return 1;if(a.includes(b)||b.includes(a))return Math.min(a.length,b.length)/Math.max(a.length,b.length);const big=s=>{const r=[];for(let i=0;i<s.length-1;i++)r.push(s.slice(i,i+2));return r};const A=big(a),B=big(b);let hit=0,copy=B.slice();for(const x of A){const i=copy.indexOf(x);if(i>=0){hit++;copy.splice(i,1)}}return (2*hit)/Math.max(1,A.length+B.length)}
function canonicalAddress(s){
 let v=String(s||'').replace(/\s+/g,' ').trim();
 const fixes=[
  [/\bKecioren\b/gi,'Keçiören'],[/\bPursaklar\b/gi,'Pursaklar'],[/\bYenimahalle\b/gi,'Yenimahalle'],[/\bAltindag\b/gi,'Altındağ'],[/\bCankaya\b/gi,'Çankaya'],[/\bEtimesgut\b/gi,'Etimesgut'],[/\bSincan\b/gi,'Sincan'],[/\bMamak\b/gi,'Mamak'],
  [/\bInonu\b/gi,'İnönü'],[/\bSentepe\b/gi,'Şentepe'],[/\bDemetevler\b/gi,'Demetevler'],[/\bBatikent\b/gi,'Batıkent'],[/\bEtlik\b/gi,'Etlik'],[/\bSaray\b/gi,'Saray'],
  [/\bMah\.?\b/gi,'Mah.'],[/\bMahallesi\b/gi,'Mahallesi'],[/\bCad\.?\b/gi,'Cad.'],[/\bCaddesi\b/gi,'Caddesi'],[/\bSok\.?\b/gi,'Sok.'],[/\bSokak\b/gi,'Sokak'],[/\bNo\s*[:.]?\s*/gi,'No: ']
 ];
 for(const [re,to] of fixes)v=v.replace(re,to);
 return v.replace(/\s+([,.;:])/g,'$1').replace(/([,.;:])(\S)/g,'$1 $2').replace(/\s+/g,' ').trim();
}
function validateAiRows(rows){
 return rows.map(row=>{
  const x=normalizeItem(row);x.rawAddress=x.rawAddress||x.address;x.address=canonicalAddress(x.address||x.rawAddress);const addressNeighborhood=inferNeighborhood(x.address||x.rawAddress);if(addressNeighborhood)x.district=addressNeighborhood;
  let best=null,score=0;for(const old of data){if(!old.customer||!old.address)continue;const sc=similarity(x.customer,old.customer);if(sc>score){score=sc;best=old}}
  if(best&&score>=0.90){if(!x.address||x.needsReview||Number(x.addressConfidence||0)<85){x.address=best.address;x.district=x.district||best.district;x.note=[x.note,'Kayıtlı adresle doğrulandı'].filter(Boolean).join(' · ');x.addressConfidence=Math.max(Number(x.addressConfidence||0),95);x.needsReview=false}}
  if(!x.address){x.needsReview=true;x.addressConfidence=0;x.note=[x.note,'Adres okunamadı'].filter(Boolean).join(' · ')}
  if(x.addressConfidence===null)x.addressConfidence=x.needsReview?60:85;
  if(x.addressConfidence<80)x.needsReview=true;
  return x;
 })
}
function extractOutputText(j){if(typeof j.output_text==='string')return j.output_text;const out=j.output||[];return out.flatMap(x=>x.content||[]).map(c=>c.text||c.output_text||'').join('\n')}
function parseAiJson(text){const cleaned=String(text||'').replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();let j;try{j=JSON.parse(cleaned)}catch(e){const a=cleaned.indexOf('{'),b=cleaned.lastIndexOf('}');if(a<0||b<a)throw new Error('AI yanıtında JSON bulunamadı.');j=JSON.parse(cleaned.slice(a,b+1))}const arr=Array.isArray(j)?j:(j.items||[]);return validateAiRows(arr).filter(x=>x.customer||x.address||x.materials.length)}
async function runAi(){
 const f=document.querySelector('#distributionAiForm');if(!aiImages.length){alert('Önce PDF veya fotoğraf seç.');return}
 const proxy=f.elements.proxyUrl.value.trim();if(!proxy){alert('Güvenli AI bağlantı adresini gir.');return}localStorage.setItem(AI_PROXY_KEY,proxy);
 const btn=document.querySelector('#distAiReadButton');btn.disabled=true;document.querySelector('#distAiSaveButton').disabled=true;setAiStatus('AI listeyi okuyor… Bu işlem fotoğraf sayısına göre sürebilir.','working');
 try{
  const content=[{type:'input_text',text:aiPrompt(f.elements.groupRules.value.trim())},...aiImages.map(x=>({type:'input_image',image_url:x.url,detail:'high'}))];
  const body={model:'gpt-4.1-mini',input:[{role:'user',content}],temperature:0};
  const url=proxy.replace(/\/$/,'');
  const headers={'Content-Type':'application/json'};
  const r=await fetch(url,{method:'POST',headers,body:JSON.stringify(body)});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error?.message||'AI bağlantı hatası ('+r.status+')');
  aiRows=parseAiJson(extractOutputText(j));if(!aiRows.length)throw new Error('Listede okunabilir kayıt bulunamadı.');renderAiRows();setAiStatus(aiRows.length+' kayıt okundu. Kaydetmeden önce kontrol et.','success');document.querySelector('#distAiSaveButton').disabled=false;
 }catch(e){console.error(e);setAiStatus('Hata: '+e.message,'error')}finally{btn.disabled=false}
}
function renderAiRows(){const s=document.querySelector('#distAiResultSection'),l=document.querySelector('#distAiResultList');s.hidden=false;const review=aiRows.filter(x=>x.needsReview).length;document.querySelector('#distAiResultCount').textContent=aiRows.length+' kayıt'+(review?' · '+review+' adres kontrol gerekli':'');l.innerHTML=aiRows.map((x,i)=>`<article class="${x.needsReview?'needs-review':'address-ok'}"><div class="dist-ai-row-main"><div class="dist-ai-row-title"><input aria-label="Müşteri" data-ai-field="customer" data-index="${i}" value="${esc(x.customer||'')}"><span class="dist-confidence ${x.needsReview?'low':'high'}">${x.needsReview?'⚠ Kontrol':'✓ Doğrulandı'} · %${Math.round(x.addressConfidence||0)}</span></div><input class="dist-ai-group-input" aria-label="Grup" data-ai-field="district" data-index="${i}" value="${esc(x.district||'')}"><textarea aria-label="Adres" data-ai-field="address" data-index="${i}" rows="2">${esc(x.address||'')}</textarea>${x.rawAddress&&x.rawAddress!==x.address?`<small class="dist-raw-address">Kaynakta okunan: ${esc(x.rawAddress)}</small>`:''}<div>${x.materials.map(m=>`<span>${Math.max(1,Number(m.quantity)||1)} adet · Soğutucu: ${esc(m.cooler||m.name||'-')} · Yeni Tasarım: ${esc(m.newDesign||'-')}</span>`).join('')}</div>${x.note?`<em>${esc(x.note)}</em>`:''}</div><button type="button" data-dist="ai-remove-row" data-index="${i}">Sil</button></article>`).join('')}
function saveAiRows(){if(!aiRows.length)return;const f=document.querySelector('#distributionAiForm');data=mergeDuplicates(f.elements.mode.value==='replace'?aiRows:data.concat(aiRows));save();document.querySelector('#distributionAiDialog').close();render();alert(aiRows.length+' kayıt dağıtım listesine eklendi.')}

function saveDistributionForm(){
 const f=document.querySelector('#distributionForm');
 if(!f)return;
 if(!String(f.elements.customer.value||'').trim()){
  alert('Müşteri adı boş bırakılamaz.');f.elements.customer.focus();return;
 }
 const id=String(f.elements.id.value||'').trim();
 const old=data.find(x=>x.id===id);
 const selectedStatus=String(f.elements.status.value||'waiting');
 const parsed=String(f.elements.materials.value||'').split(/\n+/).map(v=>v.trim()).filter(Boolean).map(line=>{
  const p=line.split('|').map(v=>v.trim());
  const kind=/LEVHA|PLATE/iu.test(p[0]||'')?'plate':/LED/iu.test(p[0]||'')?'led':'generic';
  if(kind==='plate')return {kind,cooler:'Baskı Levhası',newDesign:p[1]||'',quantity:Math.max(1,Number.parseInt(p[2]||'1',10)||1),delivered:selectedStatus==='delivered'};
  if(kind==='led')return {kind,cooler:p[1]||'',newDesign:'',quantity:Math.max(1,Number.parseInt(p[2]||'1',10)||1),delivered:selectedStatus==='delivered'};
  return {kind,cooler:p[0]||'',newDesign:p[1]||'',quantity:Math.max(1,Number.parseInt(p[2]||'1',10)||1),delivered:selectedStatus==='delivered'};
 });
 if(!parsed.length){alert('En az bir malzeme gir.');f.elements.materials.focus();return;}
 const manualDistrict=String(f.elements.district.value||'').trim();
 const manualAddress=String(f.elements.address.value||'').trim();
 const item=normalizeItem({
  id:id||(old?.id)||uid(),
  customer:String(f.elements.customer.value||'').trim(),
  address:manualAddress,
  district:manualDistrict,
  phone:String(f.elements.phone.value||'').trim(),
  materials:parsed,
  status:selectedStatus,
  note:String(f.elements.note.value||'').trim(),
  deliveredAt:old?.deliveredAt||''
 });
 // Kullanıcının elle yazdığı mahalleyi koru. Sadece alan boşsa adresten otomatik bul.
 item.district=manualDistrict||inferNeighborhood(manualAddress)||'';
 if(selectedStatus==='delivered'){
  item.materials.forEach(m=>m.delivered=true);item.status='delivered';item.deliveredAt=old?.deliveredAt||new Date().toISOString();
 }else{
  item.materials.forEach(m=>m.delivered=false);item.status='waiting';item.deliveredAt='';
 }
 const i=data.findIndex(x=>x.id===item.id);
 if(i>=0)data[i]=item;else data.push(item);
 save();
 // Kaydın gerçekten localStorage'a yazıldığını doğrula.
 try{
  const check=JSON.parse(localStorage.getItem(KEY)||'[]');
  const saved=check.find(x=>x.id===item.id);
  if(!saved)throw new Error('Kayıt doğrulanamadı');
 }catch(err){alert('Değişiklik kaydedilemedi: '+err.message);return;}
 const dlg=document.querySelector('#distributionDialog');if(dlg?.open)dlg.close();
 if(selectedStatus!=='delivered'&&filters.status==='delivered')filters.status='all';
 render();
 alert('Değişiklikler kaydedildi.');
}

document.addEventListener('click',e=>{const b=e.target.closest('[data-dist]');if(!b)return;const a=b.dataset.dist,id=b.dataset.id;
 if(a==='set-mode'){mode=b.dataset.mode;render();return}
 if(a==='nearby'){activateNearby();return}
 if(a==='normal-order'){nearbyMode=false;currentLocation=null;nearbyMessage='';render();return}
 if(a==='toggle-materials'){expandedStops.has(id)?expandedStops.delete(id):expandedStops.add(id);render();return}
 if(a==='group-chip'){filters.group=b.dataset.group||'';render();return}
 if(a==='manage-toggle'){manageMode=!manageMode;if(!manageMode)selectedStops.clear();render();return}
 if(a==='select-stop'){return}
 if(a==='select-all'){const list=visible();const all=list.length&&list.every(x=>selectedStops.has(x.id));for(const x of list){if(all)selectedStops.delete(x.id);else selectedStops.add(x.id)}render();return}
 if(a==='delete-selected'){if(!selectedStops.size)return;if(confirm(selectedStops.size+' seçili dağıtım silinsin mi?')){data=data.filter(x=>!selectedStops.has(x.id));selectedStops.clear();save();render()}return}
 if(a==='delete-all'){if(confirm('Bütün dağıtım listesi silinsin mi? Bu işlem geri alınamaz.')){data=[];selectedStops.clear();save();render()}return}
 if(a==='bulk-material'){const name=b.dataset.name,stage=b.dataset.stage;for(const x of data)for(const m of x.materials)if(m.name===name){if(stage==='prepared')m.prepared=true;if(stage==='loaded'&&m.prepared)m.loaded=true}data.forEach(syncStatus);save();render();return}
 if(a==='load-all-prepared'){for(const x of data)for(const m of x.materials)if(m.prepared)m.loaded=true;data.forEach(syncStatus);save();render();return}
 if(a==='deliver-material'){return}
 if(a==='complete-stop'){const x=data.find(v=>v.id===id);if(!x)return;if(confirm(x.customer+' için '+groupedMaterials(x).reduce((a,m)=>a+m.quantity,0)+' adet malzemenin tamamı teslim edildi mi?')){x.materials.forEach(m=>m.delivered=true);syncStatus(x);save();render()}return}
 if(a==='reset-waiting'){const x=data.find(v=>v.id===id);if(!x)return;if(confirm(x.customer+' kaydı Bekliyor durumuna geri alınsın mı?')){x.materials.forEach(m=>m.delivered=false);x.status='waiting';x.deliveredAt='';save();filters.status=filters.status==='delivered'?'all':filters.status;render()}return}
 if(a==='save-form'){saveDistributionForm();return} if(a==='add')openForm(); if(a==='edit')openForm(data.find(x=>x.id===id)); if(a==='advance'){const x=data.find(x=>x.id===id);x.status=nextStatus(x.status);x.deliveredAt=x.status==='delivered'?new Date().toISOString():'';save();render()} if(a==='import')importDialog(); if(a==='export')download('ekzen-dagitim-yedek.json',JSON.stringify(data,null,2),'application/json'); if(a==='clear-delivered'&&confirm('Teslim edilen kayıtlar silinsin mi?')){data=data.filter(x=>x.status!=='delivered');save();render()} if(a==='close-form')document.querySelector('#distributionDialog').close();if(a==='close-import')document.querySelector('#distributionImportDialog').close();if(a==='delete'){data=data.filter(x=>x.id!==document.querySelector('#distributionForm').elements.id.value);save();document.querySelector('#distributionDialog').close();render()}
 if(a==='ai-open')aiDialog();if(a==='close-ai')document.querySelector('#distributionAiDialog').close();if(a==='ai-read')runAi();if(a==='ai-save')saveAiRows();if(a==='ai-remove-image'){aiImages.splice(Number(b.dataset.index),1);renderAiImages();setAiStatus(aiImages.length?aiImages.length+' sayfa hazır.':'Henüz PDF veya fotoğraf seçilmedi.')}if(a==='ai-remove-row'){aiRows.splice(Number(b.dataset.index),1);renderAiRows();document.querySelector('#distAiSaveButton').disabled=!aiRows.length}
});
document.addEventListener('input',e=>{if(e.target.id==='distSearch'){filters.q=e.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{render();const i=document.querySelector('#distSearch');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}},220);return}const field=e.target.dataset?.aiField;if(field&&aiRows[Number(e.target.dataset.index)]){const x=aiRows[Number(e.target.dataset.index)];x[field]=e.target.value;if(field==='address'){x.needsReview=false;x.addressConfidence=100}document.querySelector('#distAiSaveButton').disabled=!aiRows.length}});
document.addEventListener('change',e=>{if(e.target.matches('[data-dist=\"select-stop\"]')){const id=e.target.dataset.id;if(e.target.checked)selectedStops.add(id);else selectedStops.delete(id);render();return}if(e.target.matches('[data-dist=\"deliver-material\"]')){const x=data.find(v=>v.id===e.target.dataset.id);const m=x?.materials.find(v=>v.id===e.target.dataset.mid);if(m){m.delivered=e.target.checked;syncStatus(x);save();render()}return}if(e.target.id==='distGroup'){filters.group=e.target.value;render()}if(e.target.id==='distStatus'){filters.status=e.target.value;render()}if(e.target.id==='distAiFiles'||e.target.id==='distAiCamera')handleAiFiles(e.target.files)});
document.addEventListener('submit',e=>{if(e.target.id==='distributionForm'){e.preventDefault();e.stopPropagation();saveDistributionForm();}},true);
document.querySelector('#distributionImportForm')?.addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget,arr=parseImport(f.elements.text.value);if(!arr.length){alert('Okunabilir kayıt bulunamadı.');return}data=mergeDuplicates(f.elements.mode.value==='replace'?arr:data.concat(arr));save();document.querySelector('#distributionImportDialog').close();f.reset();render();alert(arr.length+' kayıt içe aktarıldı.')});
data=mergeDuplicates(data).map(applyNeighborhood);save();window.renderDistribution=render;render();
})();
