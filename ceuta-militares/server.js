require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_KEY = process.env.ADMIN_KEY;

if (!DATABASE_URL) {
  console.error('Falta DATABASE_URL. Configure PostgreSQL antes de iniciar el servicio.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: /sslmode=require/i.test(DATABASE_URL) ? { rejectUnauthorized: false } : false
});

app.disable('x-powered-by');
app.use(express.json({ limit: '8mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

function loadPackedHtml(name) {
  const packed = fs.readFileSync(path.join(__dirname, 'public', `${name}.gz.b64`), 'utf8').trim();
  return zlib.gunzipSync(Buffer.from(packed, 'base64')).toString('utf8');
}
const studyHtml = loadPackedHtml('index.html');
const adminHtml = loadPackedHtml('admin.html');

function safeJson(value, fallback = {}) {
  return value && typeof value === 'object' ? value : fallback;
}

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = 'CEU-';
  for (let i = 0; i < 8; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

function adminOnly(req, res, next) {
  if (!ADMIN_KEY) return res.status(503).json({ error: 'Panel administrativo no configurado.' });
  const key = req.get('x-admin-key');
  if (key !== ADMIN_KEY) return res.status(401).json({ error: 'No autorizado.' });
  res.setHeader('Cache-Control', 'no-store');
  next();
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  let s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n\r;]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function flatten(obj, prefix = '', out = {}) {
  if (obj === null || obj === undefined) {
    out[prefix] = '';
  } else if (Array.isArray(obj)) {
    out[prefix] = obj.join('|');
  } else if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      flatten(v, key, out);
    }
  } else {
    out[prefix] = obj;
  }
  return out;
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ceuta_assessments (
      id UUID PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      consent BOOLEAN NOT NULL DEFAULT FALSE,
      user_agent TEXT,
      device JSONB NOT NULL DEFAULT '{}'::jsonb,
      responses JSONB NOT NULL DEFAULT '{}'::jsonb,
      scores JSONB NOT NULL DEFAULT '{}'::jsonb,
      cognitive_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
      trials JSONB NOT NULL DEFAULT '[]'::jsonb,
      completion_seconds INTEGER,
      schema_version TEXT NOT NULL DEFAULT '1.0.0'
    );
    CREATE INDEX IF NOT EXISTS idx_ceuta_completed_at ON ceuta_assessments(completed_at);
    CREATE INDEX IF NOT EXISTS idx_ceuta_code ON ceuta_assessments(code);
  `);
}

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, database: true, version: '1.0.0' });
  } catch (e) {
    res.status(500).json({ ok: false, database: false });
  }
});

app.post('/api/ceuta/start', async (req, res) => {
  try {
    const consent = req.body?.consent === true;
    if (!consent) return res.status(400).json({ error: 'Es necesario aceptar el consentimiento informado.' });
    const id = uuidv4();
    let code;
    for (let tries = 0; tries < 5; tries++) {
      code = makeCode();
      try {
        await pool.query(
          `INSERT INTO ceuta_assessments(id, code, consent, user_agent, device)
           VALUES($1,$2,$3,$4,$5::jsonb)`,
          [id, code, true, req.get('user-agent') || '', JSON.stringify(safeJson(req.body.device))]
        );
        return res.json({ participant_id: id, code });
      } catch (err) {
        if (err.code !== '23505') throw err;
      }
    }
    res.status(500).json({ error: 'No se pudo generar un código anónimo.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al iniciar la evaluación.' });
  }
});

app.post('/api/ceuta/complete', async (req, res) => {
  try {
    const { participant_id, responses, scores, cognitive_summary, trials, completion_seconds, device } = req.body || {};
    if (!participant_id) return res.status(400).json({ error: 'Falta participant_id.' });
    if (!Array.isArray(trials)) return res.status(400).json({ error: 'Formato de pruebas cognitivas incorrecto.' });
    const result = await pool.query(
      `UPDATE ceuta_assessments
       SET completed_at = NOW(), responses=$2::jsonb, scores=$3::jsonb,
           cognitive_summary=$4::jsonb, trials=$5::jsonb,
           completion_seconds=$6, device=$7::jsonb
       WHERE id=$1 AND completed_at IS NULL
       RETURNING code, completed_at`,
      [participant_id, JSON.stringify(safeJson(responses)), JSON.stringify(safeJson(scores)),
       JSON.stringify(safeJson(cognitive_summary)), JSON.stringify(trials),
       Number.isFinite(completion_seconds) ? Math.round(completion_seconds) : null,
       JSON.stringify(safeJson(device))]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Evaluación no encontrada o ya finalizada.' });
    res.json({ ok: true, code: result.rows[0].code, completed_at: result.rows[0].completed_at });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudieron guardar los datos.' });
  }
});

app.get('/api/admin/summary', adminOnly, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT COUNT(*)::int AS started,
           COUNT(completed_at)::int AS completed,
           MIN(started_at) AS first_started,
           MAX(completed_at) AS last_completed
    FROM ceuta_assessments`);
  res.json(rows[0]);
});

app.get('/api/admin/participants', adminOnly, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT id, code, started_at, completed_at, completion_seconds,
           responses->>'unidad' AS unidad,
           responses->>'empleo' AS empleo,
           scores,
           cognitive_summary
    FROM ceuta_assessments
    ORDER BY started_at DESC
    LIMIT 2000`);
  res.json(rows);
});

app.get('/api/admin/export.json', adminOnly, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM ceuta_assessments ORDER BY started_at');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="ceuta_militares_completo_${new Date().toISOString().slice(0,10)}.json"`);
  res.send(JSON.stringify(rows, null, 2));
});

app.get('/api/admin/export.csv', adminOnly, async (req, res) => {
  const { rows } = await pool.query(`SELECT id, code, started_at, completed_at, completion_seconds, device, responses, scores, cognitive_summary FROM ceuta_assessments ORDER BY started_at`);
  const flatRows = rows.map(r => flatten({
    id: r.id,
    code: r.code,
    started_at: r.started_at ? new Date(r.started_at).toISOString() : '',
    completed_at: r.completed_at ? new Date(r.completed_at).toISOString() : '',
    completion_seconds: r.completion_seconds,
    device: r.device,
    responses: r.responses,
    scores: r.scores,
    cognitive: r.cognitive_summary
  }));
  const headers = [...new Set(flatRows.flatMap(r => Object.keys(r)))];
  const csv = [headers.join(';'), ...flatRows.map(r => headers.map(h => csvEscape(r[h])).join(';'))].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="ceuta_militares_resumen_${new Date().toISOString().slice(0,10)}.csv"`);
  res.send('\ufeff' + csv);
});

app.get('/api/admin/trials.csv', adminOnly, async (req, res) => {
  const { rows } = await pool.query(`SELECT id, code, trials FROM ceuta_assessments WHERE completed_at IS NOT NULL ORDER BY started_at`);
  const out = [];
  for (const r of rows) {
    for (const t of (r.trials || [])) out.push(flatten({ participant_id:r.id, code:r.code, ...t }));
  }
  const headers = [...new Set(out.flatMap(r => Object.keys(r)))];
  const csv = [headers.join(';'), ...out.map(r => headers.map(h => csvEscape(r[h])).join(';'))].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="ceuta_militares_trials_${new Date().toISOString().slice(0,10)}.csv"`);
  res.send('\ufeff' + csv);
});

app.get('/admin', (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.type('html').send(adminHtml); });
app.use((req, res) => { res.setHeader('Cache-Control', 'no-store'); res.type('html').send(studyHtml); });

initDb().then(() => {
  app.listen(PORT, () => console.log(`CEUTA militares activo en puerto ${PORT}`));
}).catch(err => {
  console.error('No se pudo inicializar PostgreSQL', err);
  process.exit(1);
});
