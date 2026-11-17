/* EKZEN Ankara adres yardımcısı - açık veriye dayalı öneri, asla zorunlu doğrulama değil.
   Photon/OSM güncel arama önerileri; ABB'nin doğrulanmış isim değişikliği örnekleri.
   Eski sokak adının yeni adını otomatik değiştirmez; kullanıcı seçer.
*/
(() => {
  "use strict";
  const ABB_URL="https://direct.ankara.bel.tr/degisen-cadde-ve-sokak-isimleri";
  const renamed=[
    ["Elmadağ","Tatlıca","Bıldırcın","Şehit Coşkun Elber Caddesi"],
    ["Gölbaşı","Karşıyaka","489. Sokak","Yağmur Sokak"],
    ["Keçiören","İncirli","115. Sokak","Şehit Bülent Yollu Sokak"],
    ["Altındağ","Beşikkaya","1916 Cadde","Şehit Osman Taştan"],
    ["Keçiören","Pınarbaşı","Asya Sokak","Şehit Hakan Kavdır Sokak"],
    ["Yenimahalle","Çamlıca","141 Ç Sokak","3667. Sokak"],
    ["Keçiören","Şevkat","56 Sokak","Şehit Ömer Akpınar"],
    ["Çankaya","Üniversiteler","1598. Cadde","Prof. Dr. İlber Ortaylı Caddesi"],
    ["Mamak","Gökçeyurt","3012. Cadde","Nenek Caddesi"],
    ["Yenimahalle","Emniyet","Çarşıyolu Caddesi","Ankaragücü Caddesi"],
    ["Etimesgut","Kazım Karabekir","2721. Sokak","İclal Karabekir Sokak"],
    ["Etimesgut","Kazım Karabekir","2032. Sokak","Hayat Karabekir Sokak"],
    ["Etimesgut","Kazım Karabekir","2053. Cadde","Şark Fatihi Caddesi"],
    ["Keçiören","Esertepe","244. Sokak","Şehit Ahmet Tamer Sokak"],
    ["Keçiören","Sancaktepe","1596. Sokak","Şehit İhsan Pekesen Sokak"],
    ["Çankaya","Çankaya","Hüseyin Rahmi Sokak","Hüseyin Rahmi Gürpınar Sokak"]
  ];
  const norm=x=>String(x||"").toLocaleLowerCase("tr-TR").normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"").replace(/ı/g,"i").replace(/[^a-z0-9]+/g," ").trim();
  let timer=0, controller=null, activeInput=null, sequence=0;
  const label=(x)=>String(x||"").replace(/^\s+|\s+$/g,"");
  function context(input){
    const quick=input.id==="ekzenQuickAddress";
    const wizard=input.id==="mobileWizardField";
    const source=quick?document.querySelector("#mobileDetailBody .mobile-detail-head"):null;
    let district="", neighborhood="";
    if(quick){
      const id=document.querySelector("#mobileDetailBody [data-mobile-action='quick-address']")?.dataset.serviceId;
      const service=(typeof state!=="undefined"?state.services:[]).find(s=>String(s.id)===String(id));
      district=service?.district||"";neighborhood=service?.neighborhood||"";
    }else if(wizard){
      district=typeof mobileNewServiceData!=="undefined"?mobileNewServiceData.district||"":"";
      neighborhood=typeof mobileNewServiceData!=="undefined"?mobileNewServiceData.neighborhood||"":"";
    }else{
      const form=input.closest("form");
      district=form?.querySelector("[name='district']")?.value||"";
      neighborhood=form?.querySelector("[name='neighborhood']")?.value||"";
    }
    return {district,neighborhood};
  }
  function isAddressInput(input){
    if(!input||!["INPUT","TEXTAREA"].includes(input.tagName))return false;
    if(input.id==="ekzenQuickAddress")return true;
    if(input.id==="mobileWizardField"){
      return typeof mobileNewServiceSteps!=="undefined"&&
        mobileNewServiceSteps[mobileNewServiceIndex]?.key==="address";
    }
    return input.name==="address"&&!!input.closest("#serviceForm");
  }
  function closeOther(current){
    document.querySelectorAll(".ekzenStreetAssist").forEach(el=>{if(el!==current)el.remove();});
  }
  function panel(input){
    let p=input.parentElement?.querySelector(".ekzenStreetAssist");
    if(p)return p;
    p=document.createElement("div");
    p.className="ekzenStreetAssist";
    p.style.cssText="padding:10px;margin:9px 0;border:1px solid #bfd3e1;border-radius:10px;background:#f5f9fc;font:13px/1.45 Arial,sans-serif;color:#25415b;max-height:270px;overflow:auto;";
    input.insertAdjacentElement("afterend",p);
    closeOther(p);
    return p;
  }
  function showMessage(p,message){
    p.replaceChildren();
    const line=document.createElement("div");line.textContent=message;p.appendChild(line);
  }
  function helpLink(p){
    const a=document.createElement("a");
    a.href=ABB_URL;a.target="_blank";a.rel="noopener noreferrer";
    a.textContent="ABB resmî değişen sokak isimlerini kontrol et";
    a.style.cssText="display:block;margin-top:8px;font-size:12px;text-decoration:underline;color:#15547d";
    p.appendChild(a);
  }
  function option(p, title, detail, action){
    const b=document.createElement("button");
    b.type="button";
    b.style.cssText="display:block;width:100%;padding:9px 7px;text-align:left;margin:5px 0;border:1px solid #cbd5e1;background:#fff;border-radius:7px;color:#1a3045;font:inherit;";
    const strong=document.createElement("strong");strong.textContent=title;b.appendChild(strong);
    if(detail){const sub=document.createElement("small");sub.style.cssText="display:block;color:#64748b";sub.textContent=detail;b.appendChild(sub);}
    b.addEventListener("click",()=>{action();p.remove();input.focus();});
    p.appendChild(b);
  }
  function takeStreet(input,query,value){
    // Bina ve daire numarası yazıldıysa kaybetme. Seçilen yol ismini yeniden gir.
    const original=label(input.value);
    const words=original.match(/(?:no|numara|bina|daire|d\.?)\s*[:.]?\s*\d+[^\s,]*/gi)||[];
    input.value=value+(words.length?", "+words.join(", "):"");
    input.dispatchEvent(new Event("input",{bubbles:true}));
  }
  async function queryPhoton(input,p,q,ctx,token){
    // Tek kullanıcılı interaktif sorgu; hız sınırı ve en az üç harf.
    controller?.abort();
    controller=new AbortController();
    const url="https://photon.komoot.io/api/?q="+encodeURIComponent([q,ctx.neighborhood,ctx.district,"Ankara","Türkiye"].filter(Boolean).join(" "))+"&limit=10&lang=tr";
    const abort=controller;
    const timeout=setTimeout(()=>abort.abort(),7000);
    try{
      const r=await fetch(url,{signal:abort.signal,headers:{"Accept":"application/json"}});
      if(!r.ok)throw new Error("Adres araması cevap vermedi");
      const data=await r.json();
      if(token!==sequence||!p.isConnected||input!==activeInput)return;
      let results=(data.features||[]).filter(x=>{
        const props=x.properties||{};
        const name=props.name||"";
        const type=String(props.osm_value||"");
        const location=norm([props.city,props.county,props.district,props.state,props.country].join(" "));
        const municipality=norm([props.city,props.county,props.district].join(" "));
        const area=norm([props.suburb,props.neighbourhood,props.locality].join(" "));
        return name&&(!props.countrycode||props.countrycode.toLowerCase()==="tr")&&
          (!location||location.includes("ankara"))&&
          (!ctx.district||!municipality||municipality.includes(norm(ctx.district))||municipality==="ankara")&&
          (!ctx.neighborhood||!area||area.includes(norm(ctx.neighborhood).replace(/ mahallesi$/,"")))&&
          !["restaurant","shop","house"].includes(type);
      }).slice(0,7);
      if(results.length){
        const h=document.createElement("strong");h.textContent="Haritada bulunan adres önerileri";p.appendChild(h);
        results.forEach(x=>{
          const v=x.properties||{};
          const street=label(v.name);
          option(p,street,[v.street,v.district,v.city,v.county,v.state].filter(Boolean).join(" · ")||"Harita verisi",()=>takeStreet(input,q,street));
        });
      }else{
        const line=document.createElement("div");line.textContent="Haritada uygun öneri bulunamadı. Adresi elle girebilirsiniz.";p.appendChild(line);
      }
    }catch(e){
      if(e.name==="AbortError")return;
      if(token!==sequence)return;
      const line=document.createElement("div");line.textContent="Harita servisine ulaşılamadı. Elle giriş devam edebilir.";p.appendChild(line);
    }finally{clearTimeout(timeout);}
  }
  function search(input){
    if(!isAddressInput(input))return;
    activeInput=input;
    clearTimeout(timer);
    controller?.abort();
    const token=++sequence,p=panel(input),ctx=context(input),q=label(input.value);
    p.replaceChildren();
    if(!ctx.district||!ctx.neighborhood){showMessage(p,"Önce ilçe ve mahalleyi seçin.");return;}
    if(q.length<3){showMessage(p,"Sokak veya cadde adından en az 3 karakter yazın. Güncel öneriler burada görünecek.");return;}
    const matches=renamed.filter(row=>norm(row[0])===norm(ctx.district)&&norm(row[1])===norm(ctx.neighborhood)
      &&(norm(row[2]).includes(norm(q))||norm(q).includes(norm(row[2]))));
    if(matches.length){
      const h=document.createElement("strong");h.textContent="ABB resmî isim değişikliği";p.appendChild(h);
      matches.forEach(row=>option(p,row[2]+" → "+row[3],"Eski adı / Yeni adı — Ankara Büyükşehir Belediyesi",()=>takeStreet(input,q,row[3])));
    }
    helpLink(p);
    timer=setTimeout(()=>queryPhoton(input,p,q,ctx,token),850);
  }
  document.addEventListener("focusin",e=>{
    if(!isAddressInput(e.target))return;
    search(e.target);
  });
  document.addEventListener("input",e=>{
    if(!isAddressInput(e.target))return;
    search(e.target);
  });
})();
