/* EKZEN AI servis fisi - ek modül. Ana kasa ve kayit hesaplarini degistirmez. */
(function () {
  "use strict";
  var ENDPOINT = "https://ekzen-ai-servis.dogansezaikocak.workers.dev/api/service-report/generate";
  var selected = null, processing = false;
  function get(id) { return document.getElementById(id); }
  function enc(x) { return escapeHtml(String(x == null ? "" : x)); }
  function moneyValue(x) { return new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"}).format(Number(x)||0); }
  function status(s) { var x=get("ekzenAiStatus"); if(x)x.textContent=s; }
  function serviceNote(service) { return serviceCloseNote(service)?.text || ""; }
  function getDialog() {
    if (get("ekzenAiDialog")) return get("ekzenAiDialog");
    var d=document.createElement("dialog");
    d.id="ekzenAiDialog";
    d.style.cssText="border:0;border-radius:14px;padding:0;width:min(94vw,750px);max-height:92dvh;box-shadow:0 12px 48px #0005;color:#21364e";
    d.innerHTML='<div style="padding:20px;max-height:91dvh;overflow:auto;font-family:Arial,sans-serif">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><h2 style="font-size:19px;margin:0">EKZEN · Yapay Zekâ Servis Fişi</h2><button type="button" id="ekzenAiClose">Kapat</button></div>'+
      '<p id="ekzenAiPerson" style="font-size:13px;color:#637185"></p><p id="ekzenAiStatus" role="status" style="color:#8b5300;font-size:13px"></p>'+
      '<label style="display:block;font-weight:bold">Müşteri Şikâyeti / Arıza Tespiti<textarea id="ekzenAiDiagnosis" rows="5" style="box-sizing:border-box;width:100%;display:block;margin:8px 0 15px;padding:10px;border:1px solid #bccada;border-radius:7px;font:14px/1.5 Arial"></textarea></label>'+
      '<label style="display:block;font-weight:bold">Yapılan İşlemler ve Açıklamalar<textarea id="ekzenAiWork" rows="6" style="box-sizing:border-box;width:100%;display:block;margin:8px 0 15px;padding:10px;border:1px solid #bccada;border-radius:7px;font:14px/1.5 Arial"></textarea></label>'+
      '<label style="display:flex;gap:9px;align-items:center;font-size:13px"><input type="checkbox" id="ekzenAiTests"> Test ve kontroller gerçekleştirildi, cihaz müşteriye teslim edildi</label>'+
      '<div style="display:flex;flex-wrap:wrap;gap:9px;margin-top:17px"><button id="ekzenAiGenerate" type="button" style="padding:11px 14px;background:#1c4066;color:white;border:0;border-radius:8px;font-weight:bold">✦ Teknik Açıklama Oluştur</button><button id="ekzenAiPrint" type="button" style="padding:11px 14px;border:1px solid #becbda;border-radius:8px;font-weight:bold">A4 Servis Fişi / PDF</button></div>'+
      '<p style="font-size:12px;color:#65758a">Yapay zekânın oluşturduğu metni kontrol edin. Yapılmayan işlemleri veya doğrulanmamış tespitleri fişe yazmayın.</p></div>';
    document.body.appendChild(d);
    get("ekzenAiClose").onclick=function(){d.close();};
    get("ekzenAiGenerate").onclick=generate;
    get("ekzenAiPrint").onclick=printReport;
    return d;
  }
  function openReport(id) {
    var service=state.services.find(function(s){return String(s.id)===String(id);});
    if(!service || !mobileIsDoneService(service) || !matchesPortalSource(service.source))return;
    selected=service;
    var d=getDialog();
    get("ekzenAiPerson").textContent=[service.customerName,service.brand,service.device,service.model].filter(Boolean).join(" · ");
    get("ekzenAiDiagnosis").value=service.fault||"";
    get("ekzenAiWork").value=serviceNote(service);
    get("ekzenAiTests").checked=false;
    status("Teknik açıklama oluşturabilir veya alanları kendiniz düzenleyebilirsiniz.");
    if(!d.open)d.showModal();
  }
  async function generate() {
    if(!selected||processing)return;
    var current=window.firebase?.auth?.().currentUser;
    if(!current){status("EKZEN oturumu bulunamadı. Yeniden giriş yapın.");return;}
    processing=true; get("ekzenAiGenerate").disabled=true;
    status("Teknik açıklama hazırlanıyor...");
    try {
      var token=await current.getIdToken();
      var note=serviceNote(selected);
      var response=await fetch(ENDPOINT,{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},
        body:JSON.stringify({
          device:selected.device||"",brand:selected.brand||"",model:selected.model||"",
          complaint:selected.fault||"",operation:note,parts:note
        })
      });
      var result=await response.json();
      if(!response.ok||!result.ok)throw new Error(result.error||"Yapay zekâ bağlantısı başarısız");
      get("ekzenAiDiagnosis").value=result.diagnosis||"";
      get("ekzenAiWork").value=result.work||"";
      status("Açıklamalar hazır. Kontrol edip PDF alabilirsiniz.");
    }catch(err){
      status("Bağlantı hatası: "+err.message+". İsterseniz açıklamaları elle düzenleyip PDF hazırlayabilirsiniz.");
    }finally{processing=false;get("ekzenAiGenerate").disabled=false;}
  }
  function printReport(){
    if(!selected)return;
    var s=selected;
    var diagnosis=get("ekzenAiDiagnosis").value.trim();
    var work=get("ekzenAiWork").value.trim();
    if(get("ekzenAiTests").checked&&!/gerekli test ve kontroller/i.test(work)){
      work+=(work?" ":"")+"Gerekli test ve kontroller sağlanarak müşteriye teslim edilmiştir.";
    }
    var cash=primaryCashForService(s.id);
    var amount=Number(cash?.amount??s.price??0)||0;
    var material=Number(cash?.materialCost||0)||0;
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
      (material?'<tr><td>Malzeme bedeli (toplam tutara dâhil)</td><td></td><td>'+enc(moneyValue(material))+'</td></tr>':"")+'</tbody></table>'+
      '<div class="total">'+(paid?"GENEL TOPLAM (TAHSİL EDİLEN)":"GENEL TOPLAM (KAYITLI BEDEL)")+'<span>'+enc(moneyValue(amount))+'</span></div>'+
      '<div class="terms"><b>TÜKETİCİYE NOTLAR:</b> Garanti kapsamı ve süresi, servis tarafından yapılan işleme ve müşteriye bildirilen şartlara göre belirlenir.</div>'+
      '<footer><span>EKZEN Beyaz Eşya &amp; Kombi Servis Hizmetleri</span><span>Sayfa 1 / 1</span></footer></main></body></html>';
    var win=window.open("","_blank");
    if(!win){status("Açılır pencere engellendi. Tarayıcıdan izin verin.");return;}
    win.document.open();win.document.write(html);win.document.close();win.focus();
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
