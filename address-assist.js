/* EKZEN Ankara cadde/sokak seçici. Ekim 2026 NVİ referanslı statik veri. */
(function(){
  "use strict";
  const cache=new Map();
  const norm=x=>String(x||"").trim().toLocaleLowerCase("tr-TR")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ı/g,"i");
  function cleanedStreetName(name){
    const str=String(name||"").trim();
    if(!str||str.length>130||/^[0-9]+$/.test(str))return "";
    return str;
  }
  function slug(value){
    return norm(value).replace(/[çğıöşü]/g, c=>({"ç":"c","ğ":"g","ı":"i","ö":"o","ş":"s","ü":"u"}[c]))
      .normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  }
  function neighborhoodKey(value){
    // PTT kaynağı "Doğantepe Mah", "Doğantepe Mah.", "Doğantepe Mahallesi"
    // gibi ekler döndürebilir; sokak dosyalarında yalın mahalle adı tutulur.
    return slug(String(value||"").trim().replace(/(?:\s|[.,-])*(?:mahallesi|mah\.?|mahalle)$/iu,""));
  }
  async function loadStreets(district,neighborhood){
    if(!district||!neighborhood)return [];
    const districtSlug=slug(district),key=districtSlug+"|"+neighborhoodKey(neighborhood);
    if(cache.has(key))return cache.get(key);
    const request=(async()=>{
      // GitHub Pages kendi statik dosyası: harita servislerinden bağımsız.
      const relative="data/ankara-streets/"+encodeURIComponent(districtSlug)+".json";
      const candidates=[
        new URL("./"+relative,document.querySelector('script[src*="address-assist.js"]')?.src||document.baseURI).href,
        "https://raw.githubusercontent.com/dogansezaikocak-bot/mobil-servis/main/"+relative,
        "https://cdn.jsdelivr.net/gh/dogansezaikocak-bot/mobil-servis@main/"+relative
      ];
      const requestedSlug=neighborhoodKey(neighborhood);
      const errors=[];
      for(const url of candidates){
        try{
          const response=await fetch(url,{cache:"no-store"});
          if(!response.ok)throw new Error("HTTP "+response.status);
          const data=await response.json();
          const neighborhoods=data.neighborhoods||{};
          const key=Object.keys(neighborhoods).find(k=>neighborhoodKey(k)===requestedSlug);
          const names=neighborhoods[key];
          if(!Array.isArray(names))throw new Error("Seçilen mahalle ("+neighborhood+") "+district+" sokak dosyasında bulunamadı");
          return [...new Set(names.map(cleanedStreetName).filter(Boolean))];
        }catch(error){
          errors.push(new URL(url).hostname+": "+error.message);
        }
      }
      throw new Error(errors.join(" | "));
    })();
    cache.set(key,request);
    try{return await request;}catch(e){cache.delete(key);throw e;}
  }
  function roadLabel(name){
    const raw=String(name||"").trim();
    const m=raw.match(/^(.+?)\s*\((Sokak|Cadde|Bulvar|Meydan|Küme Evler)\)$/iu);
    if(!m)return raw;
    const stem=m[1].trim().replace(/\.\s*$/,"");
    const type=m[2].toLocaleLowerCase("tr-TR");
    const numbered=/^\d+(?:[/-]\d+)?$/.test(stem);
    const suffix=type==="sokak"?"Sokak":
      type==="cadde"?(numbered?"Cadde":"Caddesi"):
      type==="bulvar"?(numbered?"Bulvar":"Bulvarı"):
      type==="meydan"?"Meydanı":"Küme Evler";
    return numbered?stem+". "+suffix:stem+" "+suffix;
  }
  function roadKey(value){
    // "742. Cd.", "742. Cadde", "742. Caddesi" aynı numaralı yolu bulur.
    return norm(roadLabel(value)).replace(/\bcd\.?\b/giu,"cadde")
      .replace(/\bcaddesi\b/giu,"cadde")
      .replace(/[().,\s/-]+/g," ").trim();
  }
  function splitOld(value){
    let x=String(value||"").trim();
    // Eski fişlerde mahalle adı sokak satırına kopyalanmış olabilir.
    x=x.replace(/^\s*,+\s*/,"");
    const parens=x.match(/^(.+?\s*\((?:Sokak|Cadde|Bulvar|Meydan|Küme Evler)\))\s*,?\s*(.*)$/iu);
    if(parens)return {street:roadLabel(parens[1]),detail:parens[2].replace(/^[\s,;]+/,"").trim()};
    const clear=x.match(/^(.+?\b(?:sokak|sokağı|cadde|caddesi|cd\.?|bulvar|bulvarı|meydan|meydanı|küme evler)\b)\s*[,;]?\s*(.*)$/iu);
    if(clear)return {street:roadLabel(clear[1]),detail:clear[2].replace(/^[\s,;]+/,"").trim()};
    return {street:"",detail:x};
  }
  function mount(root,district,neighborhood,oldValue,onChange){
    if(!root)return null;
    const original=splitOld(oldValue);
    root.replaceChildren();
    root.style.cssText="display:grid;gap:10px;width:100%;font:14px Arial,sans-serif";
    const title=document.createElement("label");title.textContent="Cadde / Sokak";
    const select=document.createElement("select");select.id="ekzenStreetSelect";
    select.style.cssText="width:100%;min-height:46px;padding:9px;border:1px solid #cbd5e1;border-radius:9px;background:white;color:#111827;font-size:16px";
    const manual=document.createElement("input");manual.type="text";manual.placeholder="Listede yoksa cadde / sokak yaz";
    manual.value=original.street;
    manual.style.cssText="width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:9px;font-size:16px";
    const detailTitle=document.createElement("label");detailTitle.textContent="Bina No / Daire / Ek Adres";
    const detail=document.createElement("input");detail.type="text";detail.placeholder="No: 17/A Daire: 3";
    detail.value=original.detail;
    detail.style.cssText=manual.style.cssText;
    const note=document.createElement("small");note.style.cssText="color:#64748b;line-height:1.4";
    note.textContent="Ankara adres listesinden yollar yükleniyor. Eksik ad varsa elle giriş mümkün.";
    title.appendChild(select);
    detailTitle.appendChild(detail);
    root.append(title,manual,detailTitle,note);
    const setOptions=(items,description)=>{
      const last=select.value;
      select.replaceChildren();
      const opt=document.createElement("option");opt.value="";opt.textContent=description;select.appendChild(opt);
      items.forEach(street=>{
        const o=document.createElement("option");o.value=roadLabel(street);o.textContent=roadLabel(street);select.appendChild(o);
      });
      const custom=document.createElement("option");custom.value="__manual";custom.textContent="Listede yok / Elle yaz";select.appendChild(custom);
      if(original.street&&items.some(x=>roadKey(x)===roadKey(original.street))){
        select.value=roadLabel(items.find(x=>roadKey(x)===roadKey(original.street)));
        manual.value=select.value;
      }else if(last&&items.some(x=>roadKey(x)===roadKey(last)))select.value=roadLabel(items.find(x=>roadKey(x)===roadKey(last)));
      else if(original.street)select.value="__manual";
      manual.hidden=!!select.value&&select.value!=="__manual";
    };
    setOptions([],"Sokak ve caddeler yükleniyor...");
    select.addEventListener("change",()=>{
      if(select.value&&select.value!=="__manual")manual.value=select.value;
      manual.hidden=!!select.value&&select.value!=="__manual";
      if(onChange)onChange();
    });
    for(const field of [manual,detail])field.addEventListener("input",()=>onChange?.());
    const getValue=()=>[roadLabel(select.value==="__manual"||!select.value?manual.value:select.value),detail.value.trim().replace(/^[,;\s]+/,"")].filter(x=>x.trim()).join(", ");
    loadStreets(district,neighborhood).then(items=>{
      if(!root.isConnected)return;
      setOptions(items,items.length?"Cadde / Sokak seçin ("+items.length+")":"Bu mahalle için sokak kaydı yok");
      note.textContent=items.length
        ?"Adres veri setinde "+items.length+" cadde/sokak kaydı bulundu. Listede yoksa elle yazın."
        :"Bu mahalle için cadde/sokak kaydı yok. Elle yazabilirsiniz.";
      if(!items.length)manual.hidden=false;
    }).catch(error=>{
      if(!root.isConnected)return;
      setOptions([],"Sokak listesi şu anda yüklenemedi");
      select.value="__manual";manual.hidden=false;
      note.textContent="Sokak listesi alınamadı: "+(error?.message||"Bilinmeyen hata")+". Elle adres yazabilirsiniz.";
      console.warn("EKZEN sokak verisi:",{district,neighborhood,error});
    });
    return {getValue};
  }
  window.ekzenStreetPicker={mount,loadStreets};
})();
