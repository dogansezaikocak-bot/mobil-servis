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
  async function loadStreets(district,neighborhood){
    if(!district||!neighborhood)return [];
    const districtSlug=slug(district),key=districtSlug+"|"+slug(neighborhood.replace(/\s+mahallesi$/iu,""));
    if(cache.has(key))return cache.get(key);
    const request=(async()=>{
      // GitHub Pages kendi statik dosyası: harita servislerinden bağımsız.
      const url="./data/ankara-streets/"+encodeURIComponent(districtSlug)+".json?v=2026-10";
      const r=await fetch(url,{cache:"default"});
      if(!r.ok)throw new Error("Ankara adres veri dosyası bulunamadı ("+r.status+")");
      const data=await r.json();
      const names=data.neighborhoods?.[slug(neighborhood.replace(/\s+mahallesi$/iu,""))];
      if(!Array.isArray(names))throw new Error("Mahalle bu adres veri dosyasında yok");
      return [...new Set(names.map(cleanedStreetName).filter(Boolean))];
    })();
    cache.set(key,request);
    try{return await request;}catch(e){cache.delete(key);throw e;}
  }
  function splitOld(value){
    const x=String(value||"").trim();
    const match=x.match(/^(.*?\b(?:sokak|sokağı|cadde|caddesi|bulvar|bulvarı|meydan|meydanı|küme evler)\b)\s*(?:[,;]\s*)?(.*)$/iu);
    return match?{street:match[1].trim(),detail:match[2].trim()}:{street:"",detail:x};
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
        const o=document.createElement("option");o.value=street;o.textContent=street;select.appendChild(o);
      });
      const custom=document.createElement("option");custom.value="__manual";custom.textContent="Listede yok / Elle yaz";select.appendChild(custom);
      if(original.street&&items.some(x=>norm(x)===norm(original.street))){
        select.value=items.find(x=>norm(x)===norm(original.street));
        manual.value=select.value;
      }else if(last&&items.includes(last))select.value=last;
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
    const getValue=()=>[select.value==="__manual"||!select.value?manual.value:select.value,detail.value].filter(x=>x.trim()).join(", ");
    loadStreets(district,neighborhood).then(items=>{
      if(!root.isConnected)return;
      setOptions(items,items.length?"Cadde / Sokak seçin ("+items.length+")":"Bu mahalle için sokak kaydı yok");
      note.textContent=items.length
        ?"Adres veri setinde "+items.length+" cadde/sokak kaydı bulundu. Listede yoksa elle yazın."
        :"Bu mahalle için cadde/sokak kaydı yok. Elle yazabilirsiniz.";
      if(!items.length)manual.hidden=false;
    }).catch(()=>{
      if(!root.isConnected)return;
      setOptions([],"Sokak listesi şu anda yüklenemedi");
      select.value="__manual";manual.hidden=false;
      note.textContent="Adres sunucuları şu anda yanıt vermedi. Tekrar denemek için mahalleyi yeniden seçebilir veya elle yazabilirsiniz.";
    });
    return {getValue};
  }
  window.ekzenStreetPicker={mount,loadStreets};
})();
