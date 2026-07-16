const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Ekzen-Token',
  'Access-Control-Max-Age': '86400'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}
function unauthorized() { return json({ error: 'Yetkisiz erişim.' }, 401); }
function safeId(v) { return String(v || '').replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 180); }
function tokenOk(request, env, url) {
  const token = request.headers.get('X-Ekzen-Token') || url.searchParams.get('token') || '';
  return Boolean(env.APP_TOKEN && token === env.APP_TOKEN);
}
function normalizeMaterial(m = {}, distributionId = '') {
  return {
    id: String(m.id || crypto.randomUUID()),
    distribution_id: distributionId,
    kind: String(m.kind || (m.newDesign ? 'plate' : 'led')),
    name: String(m.name || ''),
    cooler: String(m.cooler || ''),
    new_design: String(m.newDesign || m.new_design || ''),
    quantity: Math.max(1, Number(m.quantity) || 1),
    delivered: m.delivered ? 1 : 0
  };
}
function normalizeDistribution(x = {}) {
  return {
    id: String(x.id || crypto.randomUUID()),
    customer_name: String(x.customer || x.customer_name || 'İsimsiz dükkân'),
    address: String(x.address || ''),
    neighborhood: String(x.district || x.neighborhood || ''),
    phone: String(x.phone || ''),
    status: String(x.status || 'waiting'),
    notes: String(x.note || x.notes || ''),
    latitude: Number.isFinite(Number(x.lat ?? x.latitude)) ? Number(x.lat ?? x.latitude) : null,
    longitude: Number.isFinite(Number(x.lng ?? x.longitude)) ? Number(x.lng ?? x.longitude) : null,
    delivered_at: String(x.deliveredAt || x.delivered_at || ''),
    materials: Array.isArray(x.materials) ? x.materials : []
  };
}

async function state(env) {
  const distributions = await env.DB.prepare(`
    SELECT id, customer_name, address, neighborhood, phone, status, notes,
           latitude, longitude, delivered_at, created_at, updated_at
    FROM distributions ORDER BY created_at, id
  `).all();
  const materials = await env.DB.prepare(`
    SELECT id, distribution_id, kind, name, cooler, new_design, quantity, delivered
    FROM materials ORDER BY rowid
  `).all();
  const photos = await env.DB.prepare(`
    SELECT id, distribution_id, photo_type, object_key, file_name, mime_type, created_at
    FROM delivery_photos ORDER BY created_at
  `).all();
  const byStop = new Map();
  for (const m of materials.results || []) {
    const a = byStop.get(m.distribution_id) || [];
    a.push({
      id: m.id, kind: m.kind, name: m.name || '', cooler: m.cooler || '',
      newDesign: m.new_design || '', quantity: Number(m.quantity) || 1,
      delivered: Boolean(m.delivered)
    });
    byStop.set(m.distribution_id, a);
  }
  return {
    distributions: (distributions.results || []).map(d => ({
      id: d.id, customer: d.customer_name, address: d.address, district: d.neighborhood || '',
      phone: d.phone || '', status: d.status || 'waiting', note: d.notes || '',
      lat: d.latitude, lng: d.longitude, deliveredAt: d.delivered_at || '',
      materials: byStop.get(d.id) || []
    })),
    photos: photos.results || []
  };
}

async function replaceAll(env, input) {
  const list = Array.isArray(input.distributions) ? input.distributions.map(normalizeDistribution) : [];
  const statements = [
    env.DB.prepare('DELETE FROM materials'),
    env.DB.prepare('DELETE FROM distributions')
  ];
  for (const d of list) {
    statements.push(env.DB.prepare(`
      INSERT INTO distributions
      (id, customer_name, address, neighborhood, phone, status, notes, latitude, longitude, delivered_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(d.id, d.customer_name, d.address, d.neighborhood, d.phone, d.status, d.notes,
      d.latitude, d.longitude, d.delivered_at));
    for (const raw of d.materials) {
      const m = normalizeMaterial(raw, d.id);
      statements.push(env.DB.prepare(`
        INSERT INTO materials
        (id, distribution_id, kind, name, cooler, new_design, quantity, delivered)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(m.id, d.id, m.kind, m.name, m.cooler, m.new_design, m.quantity, m.delivered));
    }
  }
  await env.DB.batch(statements);
  return { ok: true, count: list.length };
}

async function uploadPhoto(request, env, stopId, photoType) {
  const fd = await request.formData();
  const file = fd.get('file');
  if (!(file instanceof File)) return json({ error: 'Fotoğraf dosyası bulunamadı.' }, 400);
  const id = safeId(fd.get('id') || crypto.randomUUID());
  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const objectKey = `deliveries/${safeId(stopId)}/${safeId(photoType)}/${id}.${ext}`;
  await env.PHOTOS.put(objectKey, file.stream(), { httpMetadata: { contentType: file.type || 'image/jpeg' } });
  await env.DB.prepare(`
    INSERT INTO delivery_photos (id, distribution_id, photo_type, object_key, file_name, mime_type)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET object_key=excluded.object_key, file_name=excluded.file_name,
      mime_type=excluded.mime_type, created_at=CURRENT_TIMESTAMP
  `).bind(id, stopId, photoType, objectKey, file.name || `${photoType}.${ext}`, file.type || 'image/jpeg').run();
  return json({ ok: true, id, object_key: objectKey });
}

async function getPhoto(env, id) {
  const row = await env.DB.prepare('SELECT object_key, mime_type FROM delivery_photos WHERE id=?').bind(id).first();
  if (!row) return json({ error: 'Fotoğraf bulunamadı.' }, 404);
  const obj = await env.PHOTOS.get(row.object_key);
  if (!obj) return json({ error: 'Fotoğraf dosyası bulunamadı.' }, 404);
  const headers = new Headers(CORS);
  obj.writeHttpMetadata(headers);
  headers.set('Content-Type', row.mime_type || headers.get('Content-Type') || 'image/jpeg');
  headers.set('Cache-Control', 'private, max-age=300');
  return new Response(obj.body, { headers });
}

async function deletePhoto(env, id) {
  const row = await env.DB.prepare('SELECT object_key FROM delivery_photos WHERE id=?').bind(id).first();
  if (row?.object_key) await env.PHOTOS.delete(row.object_key);
  await env.DB.prepare('DELETE FROM delivery_photos WHERE id=?').bind(id).run();
  return json({ ok: true });
}
async function deleteStopPhotos(env, stopId) {
  const rows = await env.DB.prepare('SELECT object_key FROM delivery_photos WHERE distribution_id=?').bind(stopId).all();
  const keys = (rows.results || []).map(x => x.object_key).filter(Boolean);
  if (keys.length) await env.PHOTOS.delete(keys);
  await env.DB.prepare('DELETE FROM delivery_photos WHERE distribution_id=?').bind(stopId).run();
  return json({ ok: true, deleted: keys.length });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (!tokenOk(request, env, url)) return unauthorized();
    try {
      if (url.pathname === '/api/health' && request.method === 'GET') return json({ ok: true, version: '9.0.0' });
      if (url.pathname === '/api/state' && request.method === 'GET') return json(await state(env));
      if (url.pathname === '/api/sync' && request.method === 'POST') return json(await replaceAll(env, await request.json()));

      let m = url.pathname.match(/^\/api\/photos\/by-stop\/([^/]+)$/);
      if (m && request.method === 'DELETE') return deleteStopPhotos(env, decodeURIComponent(m[1]));
      m = url.pathname.match(/^\/api\/photos\/([^/]+)\/([^/]+)$/);
      if (m && request.method === 'POST') return uploadPhoto(request, env, decodeURIComponent(m[1]), decodeURIComponent(m[2]));
      m = url.pathname.match(/^\/api\/photos\/([^/]+)$/);
      if (m && request.method === 'GET') return getPhoto(env, decodeURIComponent(m[1]));
      if (m && request.method === 'DELETE') return deletePhoto(env, decodeURIComponent(m[1]));
      return json({ error: 'Adres bulunamadı.' }, 404);
    } catch (error) {
      console.error(error);
      return json({ error: error?.message || 'Sunucu hatası.' }, 500);
    }
  }
};
