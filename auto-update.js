/* Ekzen sürüm denetimi: aynı sabit URL, güvenli otomatik güncelleme. */
(function(){
  const current=document.querySelector('meta[name="ekzen-build"]')?.content||"";
  if(!current)return;
  let busy=false, lastCheck=0, pending=false;
  const interval=120000;
  function editing(){
    const el=document.activeElement;
    if(el && (el.matches('input:not([type=checkbox]):not([type=radio]),textarea,select,[contenteditable="true"]')))return true;
    if(document.querySelector('dialog[open],#mobileNewServiceWizard:not([hidden]),#mobileDetailSheet:not([hidden])'))return true;
    return false;
  }
  function showUpdate(){
    if(document.querySelector('#ekzenUpdateNotice'))return;
    const bar=document.createElement('div');bar.id='ekzenUpdateNotice';
    bar.setAttribute('role','status');
    bar.style.cssText='position:fixed;bottom:calc(env(safe-area-inset-bottom,0px) + 12px);left:12px;right:12px;max-width:520px;margin:auto;z-index:2147483000;background:#103f56;color:#fff;border-radius:12px;padding:13px 15px;box-shadow:0 6px 22px #0005;display:flex;align-items:center;justify-content:space-between;gap:12px;font:600 14px system-ui';
    const label=document.createElement('span');label.textContent='Yeni sürüm hazır. İşleminiz bitince güncellenecek.';
    const button=document.createElement('button');button.textContent='Şimdi güncelle';button.type='button';button.style.cssText='background:#fff;color:#103f56;border:0;border-radius:8px;padding:10px;white-space:nowrap;font-weight:700';
    button.onclick=()=>location.reload();bar.append(label,button);document.body.append(bar);
  }
  async function check(force=false){
    if(busy||document.visibilityState==='hidden')return;
    if(!force&&Date.now()-lastCheck<interval)return;
    lastCheck=Date.now();busy=true;
    try{
      const url=new URL('./index.html',location.href);
      url.searchParams.set('_ekzen_check',String(Date.now()));
      const response=await fetch(url,{cache:'no-store'});
      if(!response.ok)return;
      const html=await response.text();
      const found=html.match(/<meta\s+name=["']ekzen-build["']\s+content=["']([^"']+)["']/i);
      if(!found||found[1]===current)return;
      pending=true;
      if(editing())showUpdate();else location.reload();
    }catch(error){console.warn('Sürüm kontrolü yapılamadı.',error);}
    finally{busy=false;}
  }
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check(true);});
  window.addEventListener('focus',()=>check(false));
  setInterval(()=>{if(pending){if(!editing())location.reload();else showUpdate();}else check(false);},interval);
  setTimeout(()=>check(true),12000);
})();
