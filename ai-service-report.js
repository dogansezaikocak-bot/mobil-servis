/* EKZEN AI servis fisi - ek modül. Ana kasa ve kayit hesaplarini degistirmez. */
(function () {
  "use strict";
  var ENDPOINT = "https://ekzen-ai-servis.dogansezaikocak.workers.dev/api/service-report/generate";
  var selected = null, processing = false, preparedShare = null;
  function get(id) { return document.getElementById(id); }
  function enc(x) { return escapeHtml(String(x == null ? "" : x)); }
  function moneyValue(x) { return new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"}).format(Number(x)||0); }
  function status(s) { var x=get("ekzenAiStatus"); if(x)x.textContent=s; }
  function serviceNote(service) { return serviceCloseNote(service)?.text || ""; }
  function normalizeKey(x){return String(x||"").toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü]+/gi," ").trim();}
  function operationKey(service){
    var note=serviceNote(service);
    var known=["ntc","kart","pompa","devirdaim","sirkülasyon","fan","prosestat","rezistans","filtre","vana","sensör","sensor","bakım","temizlik","motor","termostat","eşanjör","ateşleme","gaz valfi"];
    var text=normalizeKey([note,service.fault].join(" "));
    return known.filter(function(k){return text.includes(k);}).join(" ") || text.slice(0,100);
  }
  function templates(){return Array.isArray(state.settings?.aiReportTemplates)?state.settings.aiReportTemplates:[];}
  function matchesTemplate(t,service){
    if(normalizeKey(t.device)!==normalizeKey(service.device))return false;
    if(t.brand && normalizeKey(t.brand)!==normalizeKey(service.brand))return false;
    var text=operationKey(service);
    return !!(t.operation && text && (text===t.operation || text.includes(t.operation) || t.operation.includes(text)));
  }
  function suggestedTemplates(service){
    return templates().filter(function(t){return matchesTemplate(t,service);})
      .sort(function(a,b){return String(b.updatedAt||"").localeCompare(String(a.updatedAt||""));});
  }
  function refreshSavedOptions(){
    var select=get("ekzenAiTemplateList");
    if(!select||!selected)return;
    var matches=suggestedTemplates(selected);
    select.replaceChildren();
    var intro=document.createElement("option");intro.value="";intro.textContent=matches.length?"Kayıtlı açıklama seç ("+matches.length+")":"Bu işleme ait kayıtlı açıklama yok";select.appendChild(intro);
    matches.forEach(function(t){var opt=document.createElement("option");opt.value=t.id;opt.textContent=t.title||"Kayıtlı servis açıklaması";select.appendChild(opt);});
    select.disabled=!matches.length;
  }
  function applySavedTemplate(id){
    var t=templates().find(function(x){return String(x.id)===String(id);});
    if(!t)return;
    get("ekzenAiDiagnosis").value=t.diagnosis;
    get("ekzenAiWork").value=t.work;
    status("Kütüphanedeki açıklama getirildi. Kontrol edip PDF oluşturabilirsiniz.");
  }
  function saveTemplate(){
    if(!selected)return;
    var diagnosis=get("ekzenAiDiagnosis").value.trim(),work=get("ekzenAiWork").value.trim();
    if(!diagnosis||!work){status("Önce iki açıklama alanını doldurun.");return;}
    if(!window.confirm("Bu teknik açıklamayı benzer servislerde tekrar kullanmak üzere taslak kütüphanesine kaydedelim mi?"))return;
    var list=templates().slice(),key=operationKey(selected);
    if(!key){status("Taslağa kaydetmek için fişin işlem veya şikâyet bilgisini girin.");return;}
    var title=[selected.brand,selected.device,serviceNote(selected)||selected.fault].filter(Boolean).join(" · ").slice(0,150);
    var existing=list.find(function(x){return normalizeKey(x.brand)===normalizeKey(selected.brand)&&normalizeKey(x.device)===normalizeKey(selected.device)&&x.operation===key;});
    var entry={id:existing?.id||("report-"+Date.now().toString(36)),brand:selected.brand||"",device:selected.device||"",operation:key,title:title,diagnosis:diagnosis,work:work,updatedAt:new Date().toISOString()};
    if(existing){if(!window.confirm("Bu işlem için kayıtlı açıklama var. Üzerine yazılsın mı?"))return;list=list.filter(function(x){return x.id!==existing.id;});}
    list.unshift(entry);
    state.settings.aiReportTemplates=list.slice(0,300);
    saveState();
    refreshSavedOptions();
    status("Açıklama taslak kütüphanesine kaydedildi. EKZEN bulut eşitlemesi açıksa diğer cihazlarda da kullanılabilir.");
  }
  function deleteTemplate(){
    if(!selected)return;
    var id=get("ekzenAiTemplateList")?.value;
    if(!id)return;
    if(!window.confirm("Seçili kayıtlı açıklamayı taslak kütüphanesinden silelim mi?"))return;
    state.settings.aiReportTemplates=templates().filter(function(x){return String(x.id)!==String(id);});
    saveState();refreshSavedOptions();status("Kayıtlı açıklama silindi.");
  }
  function getDialog() {
    if (get("ekzenAiDialog")) return get("ekzenAiDialog");
    var d=document.createElement("dialog");
    d.id="ekzenAiDialog";
    // Mobil ekranda iki içerik eylemi ve tek PDF eylemi; masaüstü aynen kalır.
    var mobileReportView=window.matchMedia("(max-width: 767px)").matches;
    if(mobileReportView)d.classList.add("ekzen-ai-mobile");
    var mobileStyle=document.getElementById("ekzenAiMobileStyle");
    if(!mobileStyle){
      mobileStyle=document.createElement("style");
      mobileStyle.id="ekzenAiMobileStyle";
      mobileStyle.textContent='@media(max-width:767px){#ekzenAiDialog #ekzenAiSavedLibrary,#ekzenAiDialog #ekzenAiTestingLabel,#ekzenAiDialog #ekzenAiPrint,#ekzenAiDialog #ekzenAiDownloadPdf,#ekzenAiDialog #ekzenAiShare{display:none!important}#ekzenAiDialog #ekzenAiMobilePdf{display:block!important;width:100%;min-height:52px;font-size:16px}#ekzenAiDialog #ekzenAiGenerate,#ekzenAiDialog #ekzenAiOnline{flex:1 1 135px;min-height:48px}#ekzenAiDialog{width:96vw!important}}';
      document.head.appendChild(mobileStyle);
    }
    d.style.cssText="border:0;border-radius:14px;padding:0;width:min(94vw,750px);max-height:92dvh;box-shadow:0 12px 48px #0005;color:#21364e";
    d.innerHTML='<div style="padding:20px;max-height:91dvh;overflow:auto;font-family:Arial,sans-serif">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><h2 style="font-size:19px;margin:0">EKZEN · Yapay Zekâ Servis Fişi</h2><button type="button" id="ekzenAiClose">Kapat</button></div>'+
      '<p id="ekzenAiPerson" style="font-size:13px;color:#637185"></p><p id="ekzenAiStatus" role="status" style="color:#8b5300;font-size:13px"></p>'+
      '<label style="display:block;font-weight:bold">Müşteri Şikâyeti / Arıza Tespiti<textarea id="ekzenAiDiagnosis" rows="5" style="box-sizing:border-box;width:100%;display:block;margin:8px 0 15px;padding:10px;border:1px solid #bccada;border-radius:7px;font:14px/1.5 Arial"></textarea></label>'+
      '<label style="display:block;font-weight:bold">Yapılan İşlemler ve Açıklamalar<textarea id="ekzenAiWork" rows="6" style="box-sizing:border-box;width:100%;display:block;margin:8px 0 15px;padding:10px;border:1px solid #bccada;border-radius:7px;font:14px/1.5 Arial"></textarea></label>'+
      '<div id="ekzenAiSavedLibrary" style="border:1px solid #d6dee7;border-radius:8px;padding:11px;margin:10px 0;background:#f7f9fb"><b style="display:block;margin-bottom:7px">Kayıtlı Teknik Açıklamalar</b><select id="ekzenAiTemplateList" style="width:100%;padding:9px;border-radius:6px;border:1px solid #bdcbd9"></select><div style="display:flex;gap:7px;margin-top:8px;flex-wrap:wrap"><button type="button" id="ekzenAiSaveTemplate">Taslağa Kaydet</button><button type="button" id="ekzenAiDeleteTemplate">Seçili Kaydı Sil</button></div></div>'+ 
      '<label id="ekzenAiTestingLabel" style="display:flex;gap:9px;align-items:center;font-size:13px"><input type="checkbox" id="ekzenAiTests"> Test ve kontroller gerçekleştirildi, cihaz müşteriye teslim edildi</label>'+
      '<div style="display:flex;flex-wrap:wrap;gap:9px;margin-top:17px"><button id="ekzenAiGenerate" type="button" style="padding:11px 14px;background:#1c4066;color:white;border:0;border-radius:8px;font-weight:bold">Hazır Taslak Oluştur</button><button id="ekzenAiOnline" type="button" style="padding:11px 14px;background:#087e79;color:white;border:0;border-radius:8px;font-weight:bold">✦ Yapay Zekâ ile Oluştur</button><button id="ekzenAiDownloadPdf" type="button" style="padding:11px 14px;background:#1c4066;color:white;border:0;border-radius:8px;font-weight:bold">↓ PDF Kaydet</button><button id="ekzenAiPrint" type="button" style="padding:11px 14px;border:1px solid #becbda;border-radius:8px;font-weight:bold">⎙ Yazdır / Önizle</button><button id="ekzenAiShare" type="button" style="padding:11px 14px;background:#16834d;color:white;border:0;border-radius:8px;font-weight:bold">Müşteri WhatsApp’ını Aç</button><button id="ekzenAiMobilePdf" type="button" style="display:none;padding:12px 16px;background:#1c4066;color:#fff;border:0;border-radius:9px;font-weight:bold">PDF Paylaş / Kaydet</button></div>'+
      '<p style="font-size:12px;color:#65758a">Teknik taslağı kontrol edin. Yapılmayan işlemleri veya doğrulanmamış tespitleri fişe yazmayın.</p></div>';
    document.body.appendChild(d);
    get("ekzenAiClose").onclick=function(){d.close();};
    get("ekzenAiGenerate").onclick=generate;
    get("ekzenAiOnline").onclick=generateOnline;
    get("ekzenAiPrint").onclick=printReport;
    get("ekzenAiDownloadPdf").onclick=savePdfDirect;
    ["ekzenAiDiagnosis","ekzenAiWork","ekzenAiTests"].forEach(function(id){get(id).addEventListener("input",function(){preparedShare=null;});});
    get("ekzenAiShare").onclick=shareReport;
    get("ekzenAiMobilePdf").onclick=mobileShareOrSavePdf;
    get("ekzenAiSaveTemplate").onclick=saveTemplate;
    get("ekzenAiDeleteTemplate").onclick=deleteTemplate;
    get("ekzenAiTemplateList").onchange=function(e){if(e.target.value)applySavedTemplate(e.target.value);};
    return d;
  }
  function openReport(id) {
    var service=state.services.find(function(s){return String(s.id)===String(id);});
    if(!service || !mobileIsDoneService(service) || !matchesPortalSource(service.source))return;
    selected=service;
    preparedShare=null;
    var d=getDialog();
    get("ekzenAiPerson").textContent=[service.customerName,service.brand,service.device,service.model].filter(Boolean).join(" · ");
    get("ekzenAiDiagnosis").value=service.fault||"";
    get("ekzenAiWork").value=serviceNote(service);
    get("ekzenAiTests").checked=false;
    refreshSavedOptions();
    var exactMatches=suggestedTemplates(service).filter(function(t){return t.operation===operationKey(service);});
    if(exactMatches.length===1){
      applySavedTemplate(exactMatches[0].id);
      get("ekzenAiTemplateList").value=exactMatches[0].id;
      status("Bu cihaz ve işleme uygun kayıtlı açıklama otomatik getirildi. Kontrol edip PDF hazırlayabilirsiniz.");
    }else if(exactMatches.length>1){
      status("Bu işlem için birden fazla kayıtlı açıklama bulundu. Yukarıdaki listeden uygun olanı seçin.");
    }else{
      status("Bu işlemle tam eşleşen kayıtlı açıklama yok. Hazır Taslak veya Yapay Zekâ ile Oluştur seçeneklerinden birini kullanabilirsiniz.");
    }
    if(!d.open)d.showModal();
  }
  function localTechnicalDraft(service) {
    var note=serviceNote(service).trim();
    var key=[service.device,service.brand,service.fault,note].join(" ").toLocaleLowerCase("tr-TR");
    var item="cihaz";
    var symptom="Cihazın çalışma fonksiyonlarıyla ilgili arıza şikâyeti üzerine servis müdahalesi gerçekleştirilmiştir.";
    var action="";
    if(/kart|anakart|elektronik modül|elektronik modul/.test(key)){
      item="elektronik kontrol kartı";
      symptom="Cihazın elektronik kontrol sistemiyle ilgili arıza şikâyeti üzerine müdahale edilmiştir. Elektronik kart değişimi uygulanmıştır.";
      action="Cihazın elektronik kontrol kartı değiştirilmiştir. Yeni kartın cihazla uyumlu şekilde montajı yapılmıştır.";
    } else if(/pompa|devirdaim|sirkülasyon/.test(key)){
      item="sirkülasyon pompası";
      symptom="Cihazın su dolaşımı veya ısıtma performansıyla ilgili şikâyeti kapsamında sirkülasyon pompasına müdahale edilmiştir.";
      action=/temiz/.test(key)?"Sirkülasyon pompasının temizliği yapılmıştır.": "Sirkülasyon pompasıyla ilgili bildirilen servis işlemi gerçekleştirilmiştir.";
    } else if(/fan|prosestat/.test(key)){
      item="fan sistemi";
      symptom="Cihazın hava akışı veya yanma sistemiyle ilgili şikâyeti üzerine fan grubuna müdahale edilmiştir.";
      action="Fan grubuna yönelik bildirilen servis işlemi gerçekleştirilmiştir.";
    } else if(/ntc|sensör|sensor|termistör/.test(key)){
      item="sıcaklık sensörü";
      symptom="Cihazın sıcaklık algılama veya kontrol fonksiyonuyla ilgili şikâyeti üzerine sensör grubuna müdahale edilmiştir.";
      action="Sıcaklık sensörüne yönelik bildirilen servis işlemi uygulanmıştır.";
    } else if(/üç yollu|3 yollu|vana/.test(key)){
      item="vana mekanizması";
      symptom="Cihazın su yönlendirme veya ısıtma devresiyle ilgili şikâyeti kapsamında vana mekanizmasına müdahale edilmiştir.";
      action="Vana mekanizmasıyla ilgili bildirilen servis işlemi gerçekleştirilmiştir.";
    } else if(/rezistans|ısıtıcı/.test(key)){
      item="ısıtıcı eleman";
      symptom="Cihazın ısıtma işleviyle ilgili şikâyeti üzerine ısıtıcı eleman grubuna müdahale edilmiştir.";
      action="Isıtıcı elemanla ilgili bildirilen servis işlemi uygulanmıştır.";
    } else if(/bakım|temizlik|filtre/.test(key)){
      item="bakım";
      symptom="Cihazın periyodik bakım veya temizlik ihtiyacı kapsamında servis işlemi gerçekleştirilmiştir.";
      action="Bildirilen bakım ve temizlik işlemleri uygulanmıştır.";
    }
    if(!action)action=note?note.replace(/[.!?]+$/,"")+".":"Cihaz üzerinde bildirilen servis işlemi gerçekleştirilmiştir.";
    else if(note && !action.toLocaleLowerCase("tr-TR").includes(note.toLocaleLowerCase("tr-TR"))) {
      action=note.replace(/[.!?]+$/,"")+". "+action;
    }
    return {diagnosis:symptom,work:action};
  }
  function setLocalDraft(service, reason) {
    var draft=localTechnicalDraft(service);
    get("ekzenAiDiagnosis").value=draft.diagnosis;
    get("ekzenAiWork").value=draft.work;
    status("Çevrim içi yapay zekâya ulaşılamadı ("+reason+"). Değişen parçaya göre çevrim dışı teknik taslak hazırlandı. PDF öncesi kontrol edin.");
  }
  function generate() {
    if(!selected||processing)return;
    var candidates=suggestedTemplates(selected);
    var draft=candidates.length?candidates[0]:localTechnicalDraft(selected);
    get("ekzenAiDiagnosis").value=draft.diagnosis;
    get("ekzenAiWork").value=draft.work;
    status(candidates.length?"Kütüphaneden eşleşen kayıtlı açıklama getirildi. Kontrol edip PDF oluşturabilirsiniz.":"Hazır teknik taslak oluşturuldu. Dilerseniz düzenleyip Taslağa Kaydet ile kütüphaneye ekleyin.");
  }
  async function generateOnline() {
    if(!selected||processing)return;
    var user=window.firebase?.auth?.().currentUser;
    if(!user||typeof user.getIdToken!=="function"){
      status("Yapay zekâ için EKZEN oturumu bulunamadı. Uygulamaya yeniden giriş yapın.");return;
    }
    processing=true;
    var btn=get("ekzenAiOnline");
    btn.disabled=true;
    status("Yapay zekâya bağlanıyor...");
    try {
      var token=await user.getIdToken();
      var note=serviceNote(selected);
      var response=await fetch(ENDPOINT,{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},
        body:JSON.stringify({
          device:selected.device||"",
          brand:selected.brand||"",
          model:selected.model||"",
          complaint:selected.fault||"",
          operation:note + "\nYanıt biçimi: json.",
          parts:note
        })
      });
      var result=await response.json().catch(function(){return {error:"Sunucudan geçerli yanıt alınamadı"};});
      if(!response.ok||!result.ok){
        throw new Error(result.detail||result.error||("HTTP "+response.status));
      }
      get("ekzenAiDiagnosis").value=result.diagnosis||"";
      get("ekzenAiWork").value=result.work||"";
      status("Yapay zekâ metni oluşturuldu. PDF öncesi doğruluğunu kontrol edin.");
    }catch(e){
      console.warn("EKZEN AI fişi bağlantısı:",e);
      status("Yapay zekâ bağlantısı henüz çalışmıyor: "+e.message+". Mevcut açıklamalar korunmuştur; Hazır Taslak seçeneğini kullanabilirsiniz.");
    }finally{
      processing=false;
      btn.disabled=false;
    }
  }
  function printReport(mode){
    if(!selected)return;
    var s=selected;
    var diagnosis=get("ekzenAiDiagnosis").value.trim();
    var work=get("ekzenAiWork").value.trim();
    if(get("ekzenAiTests").checked&&!/gerekli test ve kontroller/i.test(work)){
      work+=(work?" ":"")+"Gerekli test ve kontroller sağlanarak müşteriye teslim edilmiştir.";
    }
    var cash=primaryCashForService(s.id);
    var amount=Number(cash?.amount??s.price??0)||0;
    var paid=(s.paymentStatus==="Ödendi"||cash?.title==="Tahsilat Yapıldı");
    var closeEntry=(s.statusHistory||[]).find(function(x){return /Fiş kapatıldı/.test(x.description||"");});
    var rawDate=closeEntry?.date||s.visitDate||s.availableDate||s.date||"";
    var date=rawDate?formatDisplayDate(String(rawDate).slice(0,10)):"";
    var address=mobileFullAddress(s);
    function field(k,v){return '<div class="field"><b>'+enc(k)+'</b><span>'+enc(v)+'</span></div>';}
    var html='<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>EKZEN Servis Fişi</title><style>'+
      '@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font:12px/1.5 Arial,sans-serif;color:#243950;margin:0}.toolbar{text-align:center;padding:12px;background:#e9eef4}.toolbar button{padding:10px 18px;background:#1d4165;color:white;border:0;border-radius:7px}.sheet{max-width:185mm;margin:0 auto}header{display:flex;justify-content:space-between;margin:8px 0 18px}h1{font-size:27px;color:#1d4165;margin:0}header small{color:#64748b}.headright{text-align:right;color:#cd3440;font-size:17px;font-weight:bold}.headright small{display:block;font-size:11px;color:#64748b}.cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}.card{border:1px solid #cbd5e1;border-radius:4px;overflow:hidden}.card h3{background:#f4f7fa;border-bottom:1px solid #cbd5e1;margin:0;padding:6px 9px;font-size:12px}.content{padding:7px 9px}.field{display:grid;grid-template-columns:110px 1fr;gap:7px;padding:3px 0;overflow-wrap:anywhere}h2{font-size:13px;color:#1d4165;border-left:4px solid #1d4165;padding-left:8px;margin:18px 0 7px}.paragraph{white-space:pre-wrap;border:1px solid #d4dce5;background:#fafbfc;border-radius:4px;padding:9px;min-height:55px}table{width:100%;border-collapse:collapse}th{background:#1d4165;color:white;padding:8px;text-align:left}td{border:1px solid #cbd5e1;padding:8px}.total{margin-top:17px;text-align:right;color:#cd3440;font-weight:bold;font-size:15px}.total span{margin-left:14px;border:1px solid #cd3440;padding:7px 13px}.terms{margin-top:22px;padding:10px;font-size:10px;background:#f7f9fb;border:1px solid #d4dce5;color:#596c80}footer{display:flex;justify-content:space-between;margin-top:30px;color:#76869a;font-size:10px}@media print{.toolbar{display:none}.sheet{max-width:none}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.card,.paragraph,table,.terms{break-inside:avoid}}'+
      '</style></head><body><div class="toolbar"><button onclick="window.print()">PDF Kaydet / Yazdır</button></div><main class="sheet"><header><div><h1>EKZEN</h1><small>Beyaz Eşya &amp; Kombi Servis Hizmetleri</small></div><div class="headright">SERVİS FİŞİ<small>Tarih: '+enc(date)+'</small></div></header>'+
      '<div class="cols"><section class="card"><h3>MÜŞTERİ BİLGİLERİ</h3><div class="content">'+field("Adı Soyadı",s.customerName)+field("Telefon",s.phone)+field("Adres",address)+'</div></section>'+
      '<section class="card"><h3>SERVİS BİLGİLERİ</h3><div class="content">'+field("İşlem Tarihi",date)+field("Durum",s.status)+field("Fiş No",s.id)+'</div></section></div>'+
      '<h2>CİHAZ BİLGİLERİ</h2><div class="card"><div class="content">'+field("Cihaz Türü",s.device)+field("Marka / Model",[s.brand,s.model].filter(Boolean).join(" "))+'</div></div>'+
      '<h2>MÜŞTERİ ŞİKÂYETİ / ARIZA TESPİTİ</h2><div class="paragraph">'+enc(diagnosis)+'</div>'+
      '<h2>YAPILAN İŞLEMLER VE AÇIKLAMALAR</h2><div class="paragraph">'+enc(work)+'</div>'+
      '<h2>DEĞİŞEN PARÇALAR VE ÜCRETLENDİRME</h2><table><thead><tr><th>İşlem / Açıklama</th><th>Adet</th><th>Tutar</th></tr></thead><tbody><tr><td>'+enc(serviceNote(s)||"Servis hizmeti")+'</td><td>1</td><td>'+enc(moneyValue(amount))+'</td></tr>'+
      '</tbody></table>'+
      '<div class="total">'+(paid?"GENEL TOPLAM (TAHSİL EDİLEN)":"GENEL TOPLAM (KAYITLI BEDEL)")+'<span>'+enc(moneyValue(amount))+'</span></div>'+
      '<div class="terms"><b>TÜKETİCİYE NOTLAR:</b> Garanti kapsamı ve süresi, servis tarafından yapılan işleme ve müşteriye bildirilen şartlara göre belirlenir.</div>'+
      '<footer><span>EKZEN Beyaz Eşya &amp; Kombi Servis Hizmetleri</span><span>Sayfa 1 / 1</span></footer></main></body></html>';
    if(mode === "share")return html;
    var win=window.open("","_blank");
    if(!win){status("Açılır pencere engellendi. Tarayıcıdan izin verin.");return;}
    win.document.open();win.document.write(html);win.document.close();win.focus();
    // Mobil tarayıcı yeni sekmede üst araç düğmesini gizleyebilir.
    // Kullanıcının Yazdır eyleminde doğrudan sistem yazdırma ekranını da dene.
    if(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)){
      win.addEventListener("load",function(){setTimeout(function(){try{win.print();}catch(e){console.warn("Mobil yazdırma:",e);}},250);},{once:true});
      status("Mobil yazdırma ekranı açılıyor. Açılmazsa A4 önizlemesinden tarayıcının Paylaş / Yazdır seçeneğini kullanabilirsiniz.");
    }
  }
  function reportFilename(service) {
    return "EKZEN-Servis-Fisi-"+String(service.customerName||service.id||"Musteri")
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/[^a-zA-Z0-9_-]+/g,"-").slice(0,70)+".pdf";
  }
  async function savePdfDirect() {
    if(!selected||processing)return;
    var button=get("ekzenAiDownloadPdf");
    var html=printReport("share");
    if(!html)return;
    processing=true;
    button.disabled=true;
    status("PDF dosyası hazırlanıyor...");
    try {
      var file=await makePdf(html,reportFilename(selected));
      downloadFile(file);
      status("PDF hazırlandı ve indirildi. Telefonda Dosyalar / İndirilenler bölümünde bulabilirsiniz.");
    }catch(e){
      console.warn("EKZEN PDF kaydetme hatası:",e);
      status("PDF indirilemedi: "+(e?.message||"Bilinmeyen hata")+". Yazdır / Önizle seçeneğini kullanabilirsiniz.");
    }finally{processing=false;button.disabled=false;}
  }
  async function mobileShareOrSavePdf(){
    if(!selected||processing)return;
    var button=get("ekzenAiMobilePdf");
    var html=printReport("share");
    if(!html)return;
    processing=true;button.disabled=true;
    status("A4 servis fişi hazırlanıyor...");
    try{
      var file=await makePdf(html,reportFilename(selected));
      var shareSupported=typeof navigator.share==="function"&&typeof navigator.canShare==="function"&&navigator.canShare({files:[file]});
      if(shareSupported){
        try{
          await navigator.share({files:[file],title:"EKZEN Servis Fişi"});
          status("Paylaşım penceresi açıldı. WhatsApp veya Dosyalara Kaydet seçeneğini kullanabilirsiniz.");
          return;
        }catch(error){
          if(error.name==="AbortError"){
            status("Paylaşım iptal edildi. PDF Paylaş / Kaydet düğmesiyle yeniden deneyebilirsiniz.");
            return;
          }
          console.warn("Mobil dosya paylaşımı açılamadı:",error);
        }
      }
      // Mobil tarayıcı paylaşım API'sini desteklemiyorsa dosyayı hazır bir bağlantıyla sun.
      // Kullanıcı tek dokunuşla yeni sekmede açıp iOS/Android paylaşım menüsünü kullanabilir.
      var previous=get("ekzenAiReadyPdf");
      if(previous){URL.revokeObjectURL(previous.href);previous.remove();}
      var url=URL.createObjectURL(file);
      var link=document.createElement("a");
      link.id="ekzenAiReadyPdf";
      link.href=url;
      link.target="_blank";
      link.rel="noopener";
      link.textContent="Hazırlanan PDF’yi Aç / Kaydet";
      link.style.cssText="display:block;margin-top:12px;padding:12px;background:#e9f2fb;color:#16395d;border-radius:8px;text-align:center;font-weight:bold;text-decoration:underline";
      button.after(link);
      status("PDF hazır. Aşağıdaki bağlantıya dokunup telefonun Paylaş menüsünden Dosyalara Kaydet veya WhatsApp'ı seçin.");
    }catch(error){
      console.warn("Mobil PDF oluşturma başarısız:",error);
      status("PDF oluşturulamadı: "+(error?.message||"Bilinmeyen hata")+". Lütfen tekrar deneyin.");
    }finally{processing=false;button.disabled=false;}
  }
  function customerWhatsAppPhone(service) {
    var raw=String(service?.phone||"").replace(/\D/g,"");
    if(raw.startsWith("00"))raw=raw.slice(2);
    if(raw.startsWith("90")&&raw.length===12)return raw;
    if(raw.startsWith("0")&&raw.length===11)return "9"+raw;
    if(raw.length===10)return "90"+raw;
    return "";
  }
  function downloadFile(file) {
    var href=URL.createObjectURL(file);
    var a=document.createElement("a");
    a.href=href;a.download=file.name;document.body.appendChild(a);
    a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(href);},20000);
  }
  async function makePdf(html, filename) {
    var frame=document.createElement("iframe");
    frame.setAttribute("title","Servis fişi PDF oluşturma");
    frame.style.cssText="position:fixed;left:-15000px;top:0;width:820px;height:1160px;border:0;opacity:0;pointer-events:none";
    document.body.appendChild(frame);
    try {
      var doc=frame.contentDocument;
      doc.open();doc.write(html);doc.close();
      var lib=doc.createElement("script");
      lib.src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      await new Promise(function(resolve,reject){
        lib.onload=resolve;lib.onerror=function(){reject(new Error("PDF oluşturma kütüphanesi yüklenemedi"));};
        doc.head.appendChild(lib);
      });
      if(!frame.contentWindow.html2pdf)throw new Error("PDF oluşturucu bulunamadı");
      await new Promise(function(resolve){frame.contentWindow.requestAnimationFrame(function(){frame.contentWindow.requestAnimationFrame(resolve);});});
      var sheet=doc.querySelector(".sheet");
      if(!sheet)throw new Error("Servis fişi sayfası bulunamadı");
      var blob=await frame.contentWindow.html2pdf().set({
        margin:0,
        filename:filename,
        image:{type:"jpeg",quality:0.98},
        html2canvas:{scale:1.7,backgroundColor:"#ffffff",useCORS:true,scrollX:0,scrollY:0},
        jsPDF:{unit:"mm",format:"a4",orientation:"portrait"},
        pagebreak:{mode:["css","legacy"]}
      }).from(sheet).outputPdf("blob");
      return new File([blob],filename,{type:"application/pdf",lastModified:Date.now()});
    }finally{frame.remove();}
  }
  function shareReport() {
    if(!selected)return;
    var phone=customerWhatsAppPhone(selected);
    if(!phone){
      status("Bu fişte geçerli müşteri telefon numarası yok. Önce servis kaydını güncelleyin.");
      return;
    }
    // WhatsApp bağlantısını doğrudan kullanıcı tıklaması esnasında aç.
    // Asenkron PDF üretimini beklemek mobilde boş pencerede takılmaya yol açıyordu.
    var url="https://wa.me/"+phone+"?text="+encodeURIComponent("Merhaba, EKZEN Teknik servis fişiniz hazırlanmıştır.");
    var link=document.createElement("a");
    link.href=url;link.target="_blank";link.rel="noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
    status("Müşterinin kayıtlı numarası için WhatsApp sohbeti açıldı. PDF'yi göndermek için önce PDF Kaydet düğmesiyle dosyayı hazırlayın, ardından WhatsApp'ta ataçtan ekleyin.");
  }
  function insertButtons() {
    var areas=[
      {root:get("detailBody"),buttonClass:"v412-action",target:".v412-actions",isMobile:false},
      {root:get("mobileDetailBody"),buttonClass:"mobile-repeat-service-btn",target:".mobile-sheet-footer",isMobile:true}
    ];
    areas.forEach(function(a){
      if(!a.root||a.root.querySelector("[data-ai-service-report]"))return;
      var target=a.root.querySelector(a.target);
      if(!target)return;
      var id=a.isMobile?target.querySelector("[data-service-id]")?.dataset.serviceId:target.querySelector("[data-service-id]")?.dataset.serviceId;
      if(!id)return;
      var service=state.services.find(function(s){return String(s.id)===String(id);});
      if(!service||!mobileIsDoneService(service))return;
      var btn=document.createElement("button");
      btn.type="button";btn.className=a.buttonClass;
      btn.dataset.aiServiceReport=id;
      btn.textContent="✦ Yapay Zekâ ile Servis Fişi Hazırla";
      if(a.isMobile){target.appendChild(btn);}else{target.appendChild(btn);}
    });
  }
  document.addEventListener("click",function(e){
    var printButton=e.target.closest("[data-print-service-card]");
    if(printButton){
      e.preventDefault();
      e.stopPropagation();
      if(typeof printSingleServiceCard==="function")printSingleServiceCard(printButton.dataset.printServiceCard);
      return;
    }
    var btn=e.target.closest("[data-ai-service-report]");
    if(btn){e.preventDefault();e.stopPropagation();openReport(btn.dataset.aiServiceReport);}
  },true);
  function boot(){
    var observer=new MutationObserver(function(){insertButtons();});
    ["detailBody","mobileDetailBody"].forEach(function(id){
      var node=get(id);if(node)observer.observe(node,{childList:true,subtree:false});
    });
    insertButtons();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();
