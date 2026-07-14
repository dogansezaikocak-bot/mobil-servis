(function(){
'use strict';
const KEY='ekzen-distribution-v7';
const LEGACY_KEY='ekzen-distribution-v6';
const AI_PROXY_KEY='ekzen-ai-proxy-url';
let data=load();
let filters={q:'',group:'',status:'all'};
let mode='route';
let aiImages=[];
let aiRows=[];
function uid(){return 'd'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function load(){try{const raw=localStorage.getItem(KEY)||localStorage.getItem(LEGACY_KEY)||'[]';const x=JSON.parse(raw);return Array.isArray(x)?x:[]}catch(e){return []}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(data))}catch(e){alert('Kayıt yapılamadı: '+e.message)}}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function statusLabel(s){return ({waiting:'Bekliyor',prepared:'Hazırlandı',loaded:'Yüklendi',delivered:'Teslim Edildi'})[s]||'Bekliyor'}
function nextStatus(s){return ({waiting:'prepared',prepared:'loaded',loaded:'delivered',delivered:'waiting'})[s]||'prepared'}
function normalizeMaterial(m){
 if(typeof m==='string')return {id:uid(),name:m.trim(),prepared:false,loaded:false,delivered:false};
 return {id:m.id||uid(),name:String(m.name||m.material||'').trim(),prepared:Boolean(m.prepared),loaded:Boolean(m.loaded),delivered:Boolean(m.delivered)};
}
function normalizeItem(x={}){
 const raw=Array.isArray(x.materials)?x.materials:String(x.materials||x.material||'').split(/[,;\n]+/);
 const materials=raw.map(normalizeMaterial).filter(m=>m.name);
 const allDelivered=materials.length&&materials.every(m=>m.delivered);
 const allLoaded=materials.length&&materials.every(m=>m.loaded);
 const allPrepared=materials.length&&materials.every(m=>m.prepared);
 return {id:x.id||uid(),customer:String(x.customer||x.name||'').trim(),address:String(x.address||'').trim(),district:String(x.district||x.group||x.neighborhood||'').trim(),phone:String(x.phone||'').trim(),materials,status:allDelivered?'delivered':allLoaded?'loaded':allPrepared?'prepared':(['waiting','prepared','loaded','delivered'].includes(x.status)?x.status:'waiting'),note:String(x.note||'').trim(),deliveredAt:x.deliveredAt||'',rawAddress:String(x.rawAddress||x.raw_address||'').trim(),addressConfidence:Number.isFinite(Number(x.addressConfidence??x.address_confidence))?Number(x.addressConfidence??x.address_confidence):null,needsReview:Boolean(x.needsReview??x.needs_review)};
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
function syncStatus(x){const ms=x.materials||[];x.status=ms.length&&ms.every(m=>m.delivered)?'delivered':ms.length&&ms.every(m=>m.loaded)?'loaded':ms.length&&ms.every(m=>m.prepared)?'prepared':'waiting';if(x.status==='delivered'&&!x.deliveredAt)x.deliveredAt=new Date().toISOString();if(x.status!=='delivered')x.deliveredAt='';}
data=mergeDuplicates(data);
function visible(){return data.filter(x=>{const h=(x.customer+' '+x.address+' '+x.district+' '+x.materials.map(m=>m.name).join(' ')+' '+x.note).toLocaleLowerCase('tr');return (!filters.q||h.includes(filters.q.toLocaleLowerCase('tr'))) && (!filters.group||x.district===filters.group) && (filters.status==='all'||x.status===filters.status)})}
function materialTotals(){
 const map=new Map();
 for(const stop of data)for(const m of stop.materials){const k=m.name;const cur=map.get(k)||{name:k,total:0,prepared:0,loaded:0,delivered:0};cur.total++;if(m.prepared)cur.prepared++;if(m.loaded)cur.loaded++;if(m.delivered)cur.delivered++;map.set(k,cur)}
 return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'tr'));
}
function render(){
 const root=document.querySelector('#distributionView'); if(!root)return;
 data.forEach(syncStatus);save();
 const total=data.length,delivered=data.filter(x=>x.status==='delivered').length,loaded=data.filter(x=>x.status==='loaded').length,prepared=data.filter(x=>x.status==='prepared').length;
 const groups=[...new Set(data.map(x=>x.district).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));
 const mats=materialTotals();
 root.innerHTML=`<div class="dist-page v7-page">
 <div class="dist-head"><div><span class="section-kicker">V7 Operasyon Merkezi</span><h2>Malzeme Operasyon Sistemi</h2><p>Listeyi oku → depoda topla → araca yükle → müşteriye eksiksiz teslim et.</p></div><div class="dist-head-actions"><button class="secondary-button dist-ai-main-button" data-dist="ai-open">📄 AI Listeyi Oku</button><button class="secondary-button" data-dist="import">Liste İçe Aktar</button><button class="primary-button" data-dist="add">+ Yeni Durak</button></div></div>
 <div class="dist-stats"><article><span>Toplam Müşteri</span><b>${total}</b></article><article><span>Hazır Durak</span><b>${prepared}</b></article><article><span>Yüklü Durak</span><b>${loaded}</b></article><article><span>Teslim</span><b>${delivered}</b></article><article><span>Kalan</span><b>${total-delivered}</b></article></div>
 <div class="v7-tabs"><button class="${mode==='warehouse'?'is-active':''}" data-dist="set-mode" data-mode="warehouse">📦 Depo Toplama</button><button class="${mode==='route'?'is-active':''}" data-dist="set-mode" data-mode="route">🚚 Dağıtıma Çık</button><button class="${mode==='summary'?'is-active':''}" data-dist="set-mode" data-mode="summary">📊 Operasyon Özeti</button></div>
 ${mode==='warehouse'?warehouseView(mats):mode==='summary'?summaryView(mats,total,delivered):routeView(groups)}
 </div>`;
}
function warehouseView(mats){return `<section class="v7-warehouse"><div class="v7-section-head"><div><h3>Depo Toplama ve Araç Yükleme</h3><p>Aynı malzemeler tek satırda toplanır. Hazırlanan ve araca yüklenen adetleri kontrol et.</p></div><button class="primary-button" data-dist="load-all-prepared">Hazırlananların Tümünü Yükle</button></div><div class="v7-material-summary">${mats.length?mats.map(m=>`<article><div><b>${esc(m.name)}</b><small>Toplam ${m.total} adet</small></div><div class="v7-counts"><span>Hazır ${m.prepared}/${m.total}</span><span>Yüklü ${m.loaded}/${m.total}</span><span>Teslim ${m.delivered}/${m.total}</span></div><div class="v7-material-actions"><button data-dist="bulk-material" data-name="${esc(m.name)}" data-stage="prepared">${m.prepared===m.total?'✓ Hazır':'Hazırla'}</button><button data-dist="bulk-material" data-name="${esc(m.name)}" data-stage="loaded" ${m.prepared<m.total?'disabled':''}>${m.loaded===m.total?'✓ Yüklü':'Araca Yükle'}</button></div></article>`).join(''):'<div class="dist-empty">Henüz malzeme yok.</div>'}</div></section>`}
function routeView(groups){return `<div class="dist-toolbar"><input id="distSearch" type="search" placeholder="Dükkân, adres veya malzeme ara" value="${esc(filters.q)}"><select id="distGroup"><option value="">Tüm Gruplar</option>${groups.map(g=>`<option ${g===filters.group?'selected':''}>${esc(g)}</option>`).join('')}</select><select id="distStatus"><option value="all">Tüm Durumlar</option>${['waiting','prepared','loaded','delivered'].map(s=>`<option value="${s}" ${s===filters.status?'selected':''}>${statusLabel(s)}</option>`).join('')}</select><button class="secondary-button" data-dist="export">Yedek Al</button><button class="danger-button" data-dist="clear-delivered">Teslimleri Temizle</button></div><div class="dist-list">${visible().length?visible().map(card).join(''):'<div class="dist-empty">Bu filtrede kayıt yok.</div>'}</div>`}
function summaryView(mats,total,delivered){const remaining=mats.filter(m=>m.loaded>m.delivered);return `<section class="v7-summary"><div class="v7-summary-hero"><b>${delivered}/${total}</b><span>müşteri tamamlandı</span><div class="dist-progress"><span style="width:${total?Math.round(delivered/total*100):0}%"></span></div></div><div class="v7-summary-grid"><article><h3>Araçta Kalan</h3>${remaining.length?remaining.map(m=>`<p><span>${esc(m.name)}</span><b>${m.loaded-m.delivered}</b></p>`).join(''):'<p>Tüm yüklü malzemeler teslim edildi.</p>'}</article><article><h3>Teslim Edilemeyen Duraklar</h3>${data.filter(x=>x.status!=='delivered').slice(0,20).map(x=>`<p><span>${esc(x.customer)}</span><b>${x.materials.filter(m=>!m.delivered).length} malzeme</b></p>`).join('')||'<p>Kalan durak yok.</p>'}</article></div></section>`}
function card(x){const map=x.address?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(x.address)}`:'';const complete=x.materials.length&&x.materials.every(m=>m.delivered);return `<article class="dist-card status-${x.status}"><div class="dist-card-top"><div><small>${esc(x.district||'Grup belirtilmedi')}</small><h3>${esc(x.customer||'İsimsiz dükkân')}</h3><p>${esc(x.address||'Adres girilmedi')}</p></div><span class="dist-badge">${statusLabel(x.status)}</span></div><div class="v7-stop-materials">${x.materials.length?x.materials.map(m=>`<label class="${m.delivered?'is-done':''}"><input type="checkbox" data-dist="deliver-material" data-id="${x.id}" data-mid="${m.id}" ${m.delivered?'checked':''} ${!m.loaded&&!m.delivered?'disabled':''}><span>📦 ${esc(m.name)}</span><small>${m.loaded?'Araçta':'Yüklenmedi'}</small></label>`).join(''):'<span>Malzeme girilmedi</span>'}</div>${x.note?`<p class="dist-note">Not: ${esc(x.note)}</p>`:''}<div class="dist-card-actions">${x.phone?`<a class="secondary-button" href="tel:${esc(x.phone)}">Ara</a>`:''}${map?`<a class="secondary-button" target="_blank" rel="noopener" href="${map}">Konuma Git</a>`:''}<button class="secondary-button" data-dist="edit" data-id="${x.id}">Düzenle</button><button class="primary-button" data-dist="complete-stop" data-id="${x.id}" ${complete?'disabled':''}>${complete?'✓ Teslim Tamam':'Teslimatı Tamamla'}</button></div>${x.materials.some(m=>!m.loaded)?'<small class="v7-warning">⚠ Yüklenmemiş malzeme var.</small>':''}${x.deliveredAt?`<small class="dist-time">Teslim: ${new Date(x.deliveredAt).toLocaleString('tr-TR')}</small>`:''}</article>`}
function openForm(item){item=item||normalizeItem();const d=document.querySelector('#distributionDialog');const f=d.querySelector('form');f.reset();f.elements.id.value=item.id;f.elements.customer.value=item.customer;f.elements.district.value=item.district;f.elements.address.value=item.address;f.elements.phone.value=item.phone;f.elements.materials.value=item.materials.map(m=>m.name).join('\n');f.elements.note.value=item.note;f.elements.status.value=item.status;d.querySelector('[data-dist-delete]').hidden=!data.some(x=>x.id===item.id);d.showModal()}
function importDialog(){document.querySelector('#distributionImportDialog').showModal()}
function parseImport(text){text=text.trim();if(!text)return[];try{const j=JSON.parse(text);const arr=Array.isArray(j)?j:(j.items||j.distributions||[]);return arr.map(normalizeItem)}catch(e){}
 return text.split(/\n+/).map(line=>{const p=line.split(/\t|\s*\|\s*|\s*;\s*/);return normalizeItem({customer:p[0]||'',district:p[1]||'',address:p[2]||'',materials:(p.slice(3).join(',')||'').split(',')})}).filter(x=>x.customer)}
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
 return `Bu PDF sayfaları veya fotoğraflar market dolabı malzeme dağıtım listeleridir. Tablodaki HER satırı yukarıdan aşağıya sırayla oku ve yalnızca geçerli JSON döndür.
Şema: {"items":[{"customer":"dükkan/müşteri adı","raw_address":"fotoğrafta görülen adresin harfiyen yazımı","address":"doğrulanmış tam adres","address_confidence":0-100,"needs_review":true/false,"phone":"telefon varsa","district":"mahalle veya grup","materials":["malzeme/stok/ölçü bilgileri"],"note":"belirsiz veya ek bilgi"}]}.
ADRES KURALLARI:
1) Adres sütununu müşteri ve malzeme sütunlarından bağımsız, karakter karakter oku.
2) Türkçe harfleri aynen koru: Ç, Ğ, İ, I, Ö, Ş, Ü. Görüntüde olmayan harfi tahmin ederek değiştirme.
3) İlçe, mahalle, cadde, sokak ve kapı numarasını atlama. Sayıları aynen yaz.
4) Emin olmadığın kelimeyi uydurma. raw_address alanına gördüğünü yaz; address alanında yalnızca yüksek güvenli düzeltme yap. Emin değilsen needs_review=true ve address_confidence 79 veya daha düşük olsun.
5) Ankara'daki bilinen yazımları sadece açıkça eşleşiyorsa düzelt: Keçiören, Pursaklar, Yenimahalle, Altındağ, Mamak, Etimesgut, Sincan, Çankaya; İnönü, Saray, Etlik, Şentepe, Demetevler, Batıkent. Benzer ama kesin olmayan ifadeyi zorla bunlara dönüştürme.
6) Aynı dükkân daha önce kayıtlıysa, müşteri adı güçlü biçimde eşleştiğinde kayıtlı adresi kullan ve note alanına "Kayıtlı adresle doğrulandı" yaz.
GENEL KURALLAR:
- Aynı dükkânın ardışık satırlarında farklı malzemeler varsa tek kayıtta birleştir.
- Başlık, sayfa numarası ve toplam satırlarını alma.
- Okunamayan alanı boş bırak; note alanına hangi kısmın belirsiz olduğunu yaz.
- Malzeme/stok kodu/ölçü metnini aynen koru.
Mevcut grup adları: ${existing.join(', ')||'yok'}.
Kullanıcının grup kuralları: ${groupRules||'yok'}.
Kurallar eşleşirse district alanına grup adını, eşleşmezse adresteki mahalleyi yaz.
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
  const x=normalizeItem(row);x.rawAddress=x.rawAddress||x.address;x.address=canonicalAddress(x.address||x.rawAddress);
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
function renderAiRows(){const s=document.querySelector('#distAiResultSection'),l=document.querySelector('#distAiResultList');s.hidden=false;const review=aiRows.filter(x=>x.needsReview).length;document.querySelector('#distAiResultCount').textContent=aiRows.length+' kayıt'+(review?' · '+review+' adres kontrol gerekli':'');l.innerHTML=aiRows.map((x,i)=>`<article class="${x.needsReview?'needs-review':'address-ok'}"><div class="dist-ai-row-main"><div class="dist-ai-row-title"><input aria-label="Müşteri" data-ai-field="customer" data-index="${i}" value="${esc(x.customer||'')}"><span class="dist-confidence ${x.needsReview?'low':'high'}">${x.needsReview?'⚠ Kontrol':'✓ Doğrulandı'} · %${Math.round(x.addressConfidence||0)}</span></div><input class="dist-ai-group-input" aria-label="Grup" data-ai-field="district" data-index="${i}" value="${esc(x.district||'')}"><textarea aria-label="Adres" data-ai-field="address" data-index="${i}" rows="2">${esc(x.address||'')}</textarea>${x.rawAddress&&x.rawAddress!==x.address?`<small class="dist-raw-address">Kaynakta okunan: ${esc(x.rawAddress)}</small>`:''}<div>${x.materials.map(m=>`<span>${esc(m.name)}</span>`).join('')}</div>${x.note?`<em>${esc(x.note)}</em>`:''}</div><button type="button" data-dist="ai-remove-row" data-index="${i}">Sil</button></article>`).join('')}
function saveAiRows(){if(!aiRows.length)return;const f=document.querySelector('#distributionAiForm');data=mergeDuplicates(f.elements.mode.value==='replace'?aiRows:data.concat(aiRows));save();document.querySelector('#distributionAiDialog').close();render();alert(aiRows.length+' kayıt dağıtım listesine eklendi.')}
document.addEventListener('click',e=>{const b=e.target.closest('[data-dist]');if(!b)return;const a=b.dataset.dist,id=b.dataset.id;
 if(a==='set-mode'){mode=b.dataset.mode;render();return}
 if(a==='bulk-material'){const name=b.dataset.name,stage=b.dataset.stage;for(const x of data)for(const m of x.materials)if(m.name===name){if(stage==='prepared')m.prepared=true;if(stage==='loaded'&&m.prepared)m.loaded=true}data.forEach(syncStatus);save();render();return}
 if(a==='load-all-prepared'){for(const x of data)for(const m of x.materials)if(m.prepared)m.loaded=true;data.forEach(syncStatus);save();render();return}
 if(a==='deliver-material'){return}
 if(a==='complete-stop'){const x=data.find(v=>v.id===id);if(!x)return;const pending=x.materials.filter(m=>!m.delivered);if(pending.length){alert('Eksik malzeme var. Önce listedeki tüm malzemeleri tek tek işaretle.');return}syncStatus(x);save();render();return}
 if(a==='add')openForm(); if(a==='edit')openForm(data.find(x=>x.id===id)); if(a==='advance'){const x=data.find(x=>x.id===id);x.status=nextStatus(x.status);x.deliveredAt=x.status==='delivered'?new Date().toISOString():'';save();render()} if(a==='import')importDialog(); if(a==='export')download('ekzen-dagitim-yedek.json',JSON.stringify(data,null,2),'application/json'); if(a==='clear-delivered'&&confirm('Teslim edilen kayıtlar silinsin mi?')){data=data.filter(x=>x.status!=='delivered');save();render()} if(a==='close-form')document.querySelector('#distributionDialog').close();if(a==='close-import')document.querySelector('#distributionImportDialog').close();if(a==='delete'){data=data.filter(x=>x.id!==document.querySelector('#distributionForm').elements.id.value);save();document.querySelector('#distributionDialog').close();render()}
 if(a==='ai-open')aiDialog();if(a==='close-ai')document.querySelector('#distributionAiDialog').close();if(a==='ai-read')runAi();if(a==='ai-save')saveAiRows();if(a==='ai-remove-image'){aiImages.splice(Number(b.dataset.index),1);renderAiImages();setAiStatus(aiImages.length?aiImages.length+' sayfa hazır.':'Henüz PDF veya fotoğraf seçilmedi.')}if(a==='ai-remove-row'){aiRows.splice(Number(b.dataset.index),1);renderAiRows();document.querySelector('#distAiSaveButton').disabled=!aiRows.length}
});
document.addEventListener('input',e=>{if(e.target.id==='distSearch'){filters.q=e.target.value;render()}const field=e.target.dataset?.aiField;if(field&&aiRows[Number(e.target.dataset.index)]){const x=aiRows[Number(e.target.dataset.index)];x[field]=e.target.value;if(field==='address'){x.needsReview=false;x.addressConfidence=100}document.querySelector('#distAiSaveButton').disabled=!aiRows.length}});
document.addEventListener('change',e=>{if(e.target.matches('[data-dist=\"deliver-material\"]')){const x=data.find(v=>v.id===e.target.dataset.id);const m=x?.materials.find(v=>v.id===e.target.dataset.mid);if(m){m.delivered=e.target.checked;syncStatus(x);save();render()}return}if(e.target.id==='distGroup'){filters.group=e.target.value;render()}if(e.target.id==='distStatus'){filters.status=e.target.value;render()}if(e.target.id==='distAiFiles'||e.target.id==='distAiCamera')handleAiFiles(e.target.files)});
document.querySelector('#distributionForm')?.addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget;const item=normalizeItem({id:f.elements.id.value,customer:f.elements.customer.value,district:f.elements.district.value,address:f.elements.address.value,phone:f.elements.phone.value,materials:f.elements.materials.value,status:f.elements.status.value,note:f.elements.note.value});const i=data.findIndex(x=>x.id===item.id);if(i>=0)data[i]={...data[i],...item};else data.push(item);save();document.querySelector('#distributionDialog').close();render()});
document.querySelector('#distributionImportForm')?.addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget,arr=parseImport(f.elements.text.value);if(!arr.length){alert('Okunabilir kayıt bulunamadı.');return}data=mergeDuplicates(f.elements.mode.value==='replace'?arr:data.concat(arr));save();document.querySelector('#distributionImportDialog').close();f.reset();render();alert(arr.length+' kayıt içe aktarıldı.')});
data=mergeDuplicates(data);save();window.renderDistribution=render;render();
})();
