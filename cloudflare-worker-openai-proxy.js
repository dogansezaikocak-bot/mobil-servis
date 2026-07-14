/**
 * İsteğe bağlı güvenli bağlantı: OpenAI anahtarını tarayıcıya yazmamak için Cloudflare Worker.
 * Worker değişkeni/secret adı: OPENAI_API_KEY
 */
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, {headers: cors()});
    if (request.method !== 'POST') return new Response('Method not allowed', {status:405, headers:cors()});
    if (!env.OPENAI_API_KEY) return json({error:{message:'OPENAI_API_KEY tanımlı değil.'}},500);
    const body = await request.text();
    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+env.OPENAI_API_KEY},
      body
    });
    return new Response(await upstream.text(), {status:upstream.status, headers:{...cors(),'Content-Type':'application/json'}});
  }
};
function cors(){return {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'POST, OPTIONS'}}
function json(v,status=200){return new Response(JSON.stringify(v),{status,headers:{...cors(),'Content-Type':'application/json'}})}
