/* EKZEN – Ankara cadde/sokak seçici (mobil + masaüstü).
   Sokak adları OpenStreetMap'teki yol adlarından mahalle konumu çevresinde alınır.
   Bu resmî UAVT listesi değildir; eksik olabilir. Manuel giriş daima mümkündür.
*/
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
  async function fetchJson(url,timeout=11000){
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);
    try{
      const response=await fetch(url,{signal:ctl.signal,headers:{"Accept":"application/json"}});
      if(!response.ok)throw new Error("Adres verisine ulaşılamadı ("+response.status+")");
      return await response.json();
    }finally{clearTimeout(timer);}
  }
  async function resolveBox(district,neighborhood){
    const q=[neighborhood.replace(/\s+mahallesi$/iu,"")+" Mahallesi",district,"Ankara","Türkiye"].join(", ");
    const url="https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q="+encodeURIComponent(q);
    const data=await fetchJson(url);
    const candidates=data.filter(x=>{
      const desc=norm([x.display_name,x.address?.county,x.address?.suburb].join(" "));
      return desc.includes("ankara")&&(!district||desc.includes(norm(district)));
    });
    const best=candidates[0];
    if(!best||!best.boundingbox)throw new Error("Mahalle konumu haritada bulunamadı");
    let [south,north,west,east]=best.boundingbox.map(Number);
    if(![south,north,west,east].every(Number.isFinite))throw new Error("Mahalle sınırı okunamadı");
    // Nokta mahalleleri için 1 km yarıçap; geniş boundingbox'ları sınırlama.
    const lat=Number(best.lat),lon=Number(best.lon);
    if(north-south<0.001){south=lat-0.009;north=lat+0.009;}
    if(east-west<0.001){west=lon-0.011;east=lon+0.011;}
    if(north-south>0.038){south=lat-0.019;north=lat+0.019;}
    if(east-west>0.046){west=lon-0.023;east=lon+0.023;}
    return [south,west,north,east];
  }
  async function loadStreets(district,neighborhood){
    if(!district||!neighborhood)return [];
    const key=norm(district)+"|"+norm(neighborhood);
    if(cache.has(key))return cache.get(key);
    const task=(async()=>{
      const box=await resolveBox(district,neighborhood);
      const query='[out:json][timeout:20];way["highway"]["name"]('+box.join(",")+');out tags;';
      const endpointList=[
        "https://overpass.kumi.systems/api/interpreter?data="+encodeURIComponent(query),
        "https://overpass-api.de/api/interpreter?data="+encodeURIComponent(query)
      ];
      let data=null,lastError;
      for(const url of endpointList){
        try{data=await fetchJson(url,22000);break;}catch(e){lastError=e;}
      }
      if(!data)throw lastError||new Error("Sokak listesi alınamadı");
      const names=new Set();
      (data.elements||[]).forEach(el=>{
        const title=cleanedStreetName(el.tags?.name);
        if(title)names.add(title);
      });
      return [...names].sort((a,b)=>a.localeCompare(b,"tr",{numeric:true}));
    })();
    cache.set(key,task);
    try{return await task;}catch(e){cache.delete(key);throw e;}
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
    note.textContent="Mahalleye yakın harita yolları listelenir. Eksik veya eski isim olabilir; adresi doğrulayın.";
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
      setOptions(items,items.length?"Cadde / Sokak seçin ("+items.length+")":"Haritada sokak bulunamadı");
      note.textContent=items.length
        ?"Haritada bu mahalle çevresinde "+items.length+" farklı yol adı bulundu. İsimleri kontrol edin; listede yoksa elle yazın."
        :"Bu mahalle için yol listesi alınamadı. Cadde / sokak adını elle girin.";
      if(!items.length)manual.hidden=false;
    }).catch(()=>{
      if(!root.isConnected)return;
      setOptions([],"Sokak listesi şu anda yüklenemedi");
      select.value="__manual";manual.hidden=false;
      note.textContent="Bağlantı sorunu var; cadde/sokağı elle yazabilirsiniz.";
    });
    return {getValue};
  }
  window.ekzenStreetPicker={mount,loadStreets};
})();
