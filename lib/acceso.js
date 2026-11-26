// capa codigo-acceso · base, sesión firmada y códigos de este proyecto.
// Generalizado del acceso del deck de Infinite Engine (16-10-2026). La configuración está en acceso-config.js (la escribe
// agregar_capa.py desde lib/acceso.json; no se edita a mano).
// Base: Upstash Redis por REST, la misma que lee el panel central de accesos. Todo lo de este proyecto vive bajo acc:<slug>:
import { ACCESO } from './acceso-config.js';

const enc = new TextEncoder();
// si al conectar la base en Vercel se eligió otro prefijo (ej. STORAGE_KV_REST_API_URL), se toma igual
const envEnding = suf => process.env[Object.keys(process.env).find(k => k.endsWith(suf) && !k.includes('READ_ONLY')) || ''];
const KV_URL = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || envEnding('KV_REST_API_URL') || envEnding('REDIS_REST_URL');
const KV_TOKEN = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || envEnding('KV_REST_API_TOKEN') || envEnding('REDIS_REST_TOKEN');
export const hasKV = () => !!(KV_URL() && KV_TOKEN());

async function kvFetch(path, body) {
  const r = await fetch(KV_URL() + path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok && r.status !== 400) throw new Error('kv ' + r.status);
  return r.json();
}
export async function kv(...cmd) {
  const j = await kvFetch('', cmd.map(String));
  if (j.error) throw new Error(j.error);
  return j.result;
}
export async function kvp(cmds) {
  if (!cmds.length) return [];
  const j = await kvFetch('/pipeline', cmds.map(c => c.map(String)));
  return j.map(x => { if (x.error) throw new Error(x.error); return x.result; });
}

// ---------- proyecto ----------
export const NS = 'acc:' + ACCESO.slug + ':';   // acc:<slug>:codes, acc:<slug>:agg:<código>, acc:<slug>:ev:<código>...
export const REG = 'acc:projects';              // registro de proyectos que lee el panel central
export const LANGS = Object.keys(ACCESO.idiomas);
export const langOf = l => (LANGS.includes(l) ? l : LANGS[0]);

// ---------- sesión firmada ----------
let _key;
async function key() {
  if (_key) return _key;
  const secret = process.env.ACC_SECRET || 'acc:' + ACCESO.slug + ':' + (KV_TOKEN() || 'local');
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  _key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  return _key;
}
const b64u = buf => Buffer.from(buf).toString('base64url');
export async function sign(obj) {
  const p = b64u(enc.encode(JSON.stringify(obj)));
  return p + '.' + b64u(await crypto.subtle.sign('HMAC', await key(), enc.encode(p)));
}
export async function verify(tok) {
  if (!tok || tok.indexOf('.') < 1) return null;
  const [p, s] = tok.split('.');
  try {
    if (!(await crypto.subtle.verify('HMAC', await key(), Buffer.from(s, 'base64url'), enc.encode(p)))) return null;
    const o = JSON.parse(Buffer.from(p, 'base64url').toString());
    return o.exp && Date.now() > o.exp ? null : o;
  } catch { return null; }
}
export function cookie(req, name) {
  const m = (req.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}
export const setCookie = (name, val, maxAge) =>
  `${name}=${encodeURIComponent(val)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;

// ---------- códigos: PREFIJO-XXXXX (los crea el panel central) ----------
export function normCode(s) {
  const P = ACCESO.prefijo;
  s = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length === P.length + 5 && s.startsWith(P)) s = s.slice(P.length);
  return s.length === 5 ? P + '-' + s : '';
}

// ---------- datos del pedido (sin guardar la IP) ----------
export const ip = req => (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';
export async function hash(s) { return b64u(await crypto.subtle.digest('SHA-256', enc.encode(String(s)))).slice(0, 16); }
export function geo(req) {
  const d = v => { try { return v ? decodeURIComponent(v) : ''; } catch { return v || ''; } };
  return { pais: req.headers.get('x-vercel-ip-country') || '', ciudad: d(req.headers.get('x-vercel-ip-city')) };
}
export function device(req) {
  const ua = req.headers.get('user-agent') || '';
  const so = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
  const nav = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : '';
  return [nav, so].filter(Boolean).join(' · ') + (/Mobi/.test(ua) ? ' · móvil' : '');
}
export const json = (o, status = 200, headers = {}) =>
  new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });
