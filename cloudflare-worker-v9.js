const VERSION = '9.5.2';
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
function fail(message, status = 500, details = undefined) {
  return json({ ok: false, error: message, ...(details ? { details } : {}) }, status);
}
function safeId(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 180);
}
function tokenOk(request, env, url) {
  const token = request.headers.get('X-Ekzen-Token') || url.searchParams.get('token') || '';
  return Boolean(env.APP_TOKEN && token === env.APP_TOKEN);
}
function bindings(env) {
  return {
    DB: Boolean(env.DB && typeof env.DB.prepare === 'function'),
    PHOTOS: Boolean(env.PHOTOS && typeof env.PHOTOS.put === 'function')
  };
}
function requireDb(env) {
  if (!env.DB || typeof env.DB.prepare !== 'function') {
    throw new Error('DB binding bulunamadı. Worker Settings > Bindings bölümünde D1 veritabanını DB adıyla bağlayın.');
  }
}
function requirePhotos(env) {
  if (!env.PHOTOS || typeof env.PHOTOS.put !== 'function') {
    throw new Error('PHOTOS binding bulunamadı. Worker Settings > Bindings bölümünde R2 bucket\'ını PHOTOS adıyla bağlayın.');
  }
}

let schemaReady = false;
async function tableColumns(env, table) {
  const result = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
  return new Set((result.results || []).map(row => row.name));
}
async function addMissingColumns(env, table, columns) {
  const existing = await tableColumns(env, table);
  for (const [name, definition] of Object.entries(columns)) {
    if (!existing.has(name)) await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`).run();
  }
}
async function ensureSchema(env) {
  requireDb(env);
  if (schemaReady) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS distributions (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      neighborhood TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'waiting',
      notes TEXT NOT NULL DEFAULT '',
      latitude REAL,
      longitude REAL,
      delivered_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      distribution_id TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'led',
      name TEXT NOT NULL DEFAULT '',
      cooler TEXT NOT NULL DEFAULT '',
      new_design TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 1,
      delivered INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (distribution_id) REFERENCES distributions(id) ON DELETE CASCADE
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS delivery_photos (
      id TEXT PRIMARY KEY,
      distribution_id TEXT NOT NULL,
      photo_type TEXT NOT NULL,
      object_key TEXT NOT NULL,
      file_name TEXT NOT NULL DEFAULT '',
      mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (distribution_id) REFERENCES distributions(id) ON DELETE CASCADE
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_distributions_neighborhood ON distributions(neighborhood)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_distributions_status ON distributions(status)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_materials_distribution ON materials(distribution_id)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_photos_distribution ON delivery_photos(distribution_id)')
  ]);
  await addMissingColumns(env, 'distributions', {
    neighborhood: "TEXT NOT NULL DEFAULT ''", phone: "TEXT NOT NULL DEFAULT ''",
    status: "TEXT NOT NULL DEFAULT 'waiting'", notes: "TEXT NOT NULL DEFAULT ''",
    latitude: 'REAL', longitude: 'REAL', delivered_at: "TEXT NOT NULL DEFAULT ''",
    created_at: "TEXT NOT NULL DEFAULT ''", updated_at: "TEXT NOT NULL DEFAULT ''"
  });
  await addMissingColumns(env, 'materials', {
    kind: "TEXT NOT NULL DEFAULT 'led'", name: "TEXT NOT NULL DEFAULT ''",
    cooler: "TEXT NOT NULL DEFAULT ''", new_design: "TEXT NOT NULL DEFAULT ''",
    quantity: 'INTEGER NOT NULL DEFAULT 1', delivered: 'INTEGER NOT NULL DEFAULT 0'
  });
  await addMissingColumns(env, 'delivery_photos', {
    file_name: "TEXT NOT NULL DEFAULT ''", mime_type: "TEXT NOT NULL DEFAULT 'image/jpeg'",
    created_at: "TEXT NOT NULL DEFAULT ''"
  });
  schemaReady = true;
}

function normalizeMaterial(raw = {}, distributionId = '') {
  return {
    id: String(raw.id || crypto.randomUUID()),
    distribution_id: distributionId,
    kind: String(raw.kind || (raw.newDesign || raw.new_design ? 'plate' : 'led')),
    name: String(raw.name || ''),
    cooler: String(raw.cooler || ''),
    new_design: String(raw.newDesign || raw.new_design || ''),
    quantity: Math.max(1, Number(raw.quantity) || 1),
    delivered: raw.delivered ? 1 : 0
  };
}
function normalizeDistribution(raw = {}) {
  return {
    id: String(raw.id || crypto.randomUUID()),
    customer_name: String(raw.customer || raw.customer_name || 'İsimsiz dükkân'),
    address: String(raw.address || ''),
    neighborhood: String(raw.district || raw.neighborhood || ''),
    phone: String(raw.phone || ''),
    status: String(raw.status || 'waiting'),
    notes: String(raw.note || raw.notes || ''),
    latitude: Number.isFinite(Number(raw.lat ?? raw.latitude)) ? Number(raw.lat ?? raw.latitude) : null,
    longitude: Number.isFinite(Number(raw.lng ?? raw.longitude)) ? Number(raw.lng ?? raw.longitude) : null,
    delivered_at: String(raw.deliveredAt || raw.delivered_at || ''),
    materials: Array.isArray(raw.materials) ? raw.materials : []
  };
}

async function getState(env) {
  await ensureSchema(env);
  const [distResult, materialResult, photoResult] = await Promise.all([
    env.DB.prepare(`SELECT id, customer_name, address, neighborhood, phone, status, notes,
      latitude, longitude, delivered_at, created_at, updated_at
      FROM distributions ORDER BY created_at, id`).all(),
    env.DB.prepare(`SELECT id, distribution_id, kind, name, cooler, new_design, quantity, delivered
      FROM materials ORDER BY rowid`).all(),
    env.DB.prepare(`SELECT id, distribution_id, photo_type, object_key, file_name, mime_type, created_at
      FROM delivery_photos ORDER BY created_at, id`).all()
  ]);
  const materialMap = new Map();
  for (const row of materialResult.results || []) {
    const list = materialMap.get(row.distribution_id) || [];
    list.push({
      id: row.id, kind: row.kind || 'led', name: row.name || '', cooler: row.cooler || '',
      newDesign: row.new_design || '', quantity: Math.max(1, Number(row.quantity) || 1),
      delivered: Boolean(row.delivered)
    });
    materialMap.set(row.distribution_id, list);
  }
  return {
    ok: true,
    version: VERSION,
    distributions: (distResult.results || []).map(row => ({
      id: row.id, customer: row.customer_name, address: row.address || '',
      district: row.neighborhood || '', phone: row.phone || '', status: row.status || 'waiting',
      note: row.notes || '', lat: row.latitude, lng: row.longitude,
      deliveredAt: row.delivered_at || '', materials: materialMap.get(row.id) || []
    })),
    photos: photoResult.results || []
  };
}

async function replaceAll(env, payload) {
  await ensureSchema(env);
  const list = Array.isArray(payload?.distributions) ? payload.distributions.map(normalizeDistribution) : [];
  const statements = [env.DB.prepare('DELETE FROM materials'), env.DB.prepare('DELETE FROM distributions')];
  for (const item of list) {
    statements.push(env.DB.prepare(`INSERT INTO distributions
      (id, customer_name, address, neighborhood, phone, status, notes, latitude, longitude, delivered_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .bind(item.id, item.customer_name, item.address, item.neighborhood, item.phone, item.status,
        item.notes, item.latitude, item.longitude, item.delivered_at));
    for (const rawMaterial of item.materials) {
      const material = normalizeMaterial(rawMaterial, item.id);
      statements.push(env.DB.prepare(`INSERT INTO materials
        (id, distribution_id, kind, name, cooler, new_design, quantity, delivered)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(material.id, item.id, material.kind, material.name, material.cooler,
          material.new_design, material.quantity, material.delivered));
    }
  }
  await env.DB.batch(statements);
  return { ok: true, count: list.length };
}

async function upsertDistribution(env, raw, routeId = '') {
  await ensureSchema(env);
  const item = normalizeDistribution({ ...raw, id: routeId || raw?.id });
  const statements = [
    env.DB.prepare(`INSERT INTO distributions
      (id, customer_name, address, neighborhood, phone, status, notes, latitude, longitude, delivered_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET customer_name=excluded.customer_name, address=excluded.address,
      neighborhood=excluded.neighborhood, phone=excluded.phone, status=excluded.status,
      notes=excluded.notes, latitude=excluded.latitude, longitude=excluded.longitude,
      delivered_at=excluded.delivered_at, updated_at=CURRENT_TIMESTAMP`)
      .bind(item.id, item.customer_name, item.address, item.neighborhood, item.phone, item.status,
        item.notes, item.latitude, item.longitude, item.delivered_at),
    env.DB.prepare('DELETE FROM materials WHERE distribution_id=?').bind(item.id)
  ];
  for (const rawMaterial of item.materials) {
    const material = normalizeMaterial(rawMaterial, item.id);
    statements.push(env.DB.prepare(`INSERT INTO materials
      (id, distribution_id, kind, name, cooler, new_design, quantity, delivered)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(material.id, item.id, material.kind, material.name, material.cooler,
        material.new_design, material.quantity, material.delivered));
  }
  await env.DB.batch(statements);
  const saved = await getDistribution(env, item.id);
  if (!saved?.ok || !saved?.distribution) throw new Error('Kayıt D1 içine yazıldıktan sonra okunamadı.');
  return { ok: true, id: item.id, distribution: saved.distribution };
}

async function getDistribution(env, id) {
  await ensureSchema(env);
  const state = await getState(env);
  const distribution = state.distributions.find(row => row.id === id) || null;
  if (!distribution) return { ok: false, distribution: null };
  return { ok: true, distribution };
}

async function deleteDistribution(env, id) {
  await ensureSchema(env);
  requirePhotos(env);
  const rows = await env.DB.prepare('SELECT object_key FROM delivery_photos WHERE distribution_id=?').bind(id).all();
  const keys = (rows.results || []).map(row => row.object_key).filter(Boolean);
  if (keys.length) await env.PHOTOS.delete(keys);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM delivery_photos WHERE distribution_id=?').bind(id),
    env.DB.prepare('DELETE FROM materials WHERE distribution_id=?').bind(id),
    env.DB.prepare('DELETE FROM distributions WHERE id=?').bind(id)
  ]);
  return { ok: true, deletedPhotos: keys.length };
}

async function uploadPhoto(request, env, stopId, photoType) {
  await ensureSchema(env);
  requirePhotos(env);
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return fail('Fotoğraf dosyası bulunamadı.', 400);
  const id = safeId(form.get('id') || crypto.randomUUID());
  const extension = file.type === 'image/png' ? 'png' : 'jpg';
  const key = `deliveries/${safeId(stopId)}/${safeId(photoType)}/${id}.${extension}`;
  await env.PHOTOS.put(key, file.stream(), { httpMetadata: { contentType: file.type || 'image/jpeg' } });
  await env.DB.prepare(`INSERT INTO delivery_photos
    (id, distribution_id, photo_type, object_key, file_name, mime_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET object_key=excluded.object_key, file_name=excluded.file_name,
      mime_type=excluded.mime_type, created_at=CURRENT_TIMESTAMP`)
    .bind(id, stopId, photoType, key, file.name || `${photoType}.${extension}`, file.type || 'image/jpeg').run();
  return json({ ok: true, id, objectKey: key });
}
async function getPhoto(env, id) {
  await ensureSchema(env);
  requirePhotos(env);
  const row = await env.DB.prepare('SELECT object_key, mime_type FROM delivery_photos WHERE id=?').bind(id).first();
  if (!row) return fail('Fotoğraf kaydı bulunamadı.', 404);
  const object = await env.PHOTOS.get(row.object_key);
  if (!object) return fail('Fotoğraf dosyası R2 içinde bulunamadı.', 404);
  const headers = new Headers(CORS);
  object.writeHttpMetadata(headers);
  headers.set('Content-Type', row.mime_type || headers.get('Content-Type') || 'image/jpeg');
  headers.set('Cache-Control', 'private, max-age=300');
  return new Response(object.body, { headers });
}
async function deletePhoto(env, id) {
  await ensureSchema(env);
  requirePhotos(env);
  const row = await env.DB.prepare('SELECT object_key FROM delivery_photos WHERE id=?').bind(id).first();
  if (row?.object_key) await env.PHOTOS.delete(row.object_key);
  await env.DB.prepare('DELETE FROM delivery_photos WHERE id=?').bind(id).run();
  return json({ ok: true });
}
async function deleteStopPhotos(env, stopId) {
  await ensureSchema(env);
  requirePhotos(env);
  const rows = await env.DB.prepare('SELECT object_key FROM delivery_photos WHERE distribution_id=?').bind(stopId).all();
  const keys = (rows.results || []).map(row => row.object_key).filter(Boolean);
  if (keys.length) await env.PHOTOS.delete(keys);
  await env.DB.prepare('DELETE FROM delivery_photos WHERE distribution_id=?').bind(stopId).run();
  return json({ ok: true, deleted: keys.length });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (!tokenOk(request, env, url)) return json({ ok: false, error: 'Yetkisiz erişim.' }, 401);
    try {
      if (url.pathname === '/api/health' && request.method === 'GET') {
        const b = bindings(env);
        if (b.DB) {
          await ensureSchema(env);
          await env.DB.prepare('SELECT 1 AS ok').first();
        }
        return json({ ok: b.DB && b.PHOTOS, version: VERSION, bindings: b });
      }
      if (url.pathname === '/api/diagnostics' && request.method === 'GET') {
        const b = bindings(env);
        let dbTest = null;
        if (b.DB) {
          await ensureSchema(env);
          dbTest = await env.DB.prepare('SELECT COUNT(*) AS count FROM distributions').first();
        }
        return json({ ok: b.DB && b.PHOTOS, version: VERSION, bindings: b, distributionCount: Number(dbTest?.count || 0) });
      }
      if (url.pathname === '/api/state' && request.method === 'GET') return json(await getState(env));
      if (url.pathname === '/api/sync' && request.method === 'POST') return json(await replaceAll(env, await request.json()));

      let match = url.pathname.match(/^\/api\/distributions\/([^/]+)$/);
      if (match && request.method === 'GET') return json(await getDistribution(env, decodeURIComponent(match[1])));
      if (match && request.method === 'PUT') return json(await upsertDistribution(env, await request.json(), decodeURIComponent(match[1])));
      if (match && request.method === 'DELETE') return json(await deleteDistribution(env, decodeURIComponent(match[1])));

      match = url.pathname.match(/^\/api\/photos\/by-stop\/([^/]+)$/);
      if (match && request.method === 'DELETE') return deleteStopPhotos(env, decodeURIComponent(match[1]));
      match = url.pathname.match(/^\/api\/photos\/([^/]+)\/([^/]+)$/);
      if (match && request.method === 'POST') return uploadPhoto(request, env, decodeURIComponent(match[1]), decodeURIComponent(match[2]));
      match = url.pathname.match(/^\/api\/photos\/([^/]+)$/);
      if (match && request.method === 'GET') return getPhoto(env, decodeURIComponent(match[1]));
      if (match && request.method === 'DELETE') return deletePhoto(env, decodeURIComponent(match[1]));

      return fail('API adresi bulunamadı.', 404);
    } catch (error) {
      console.error(error);
      return fail(error?.message || 'Sunucu hatası.', 500);
    }
  }
};
