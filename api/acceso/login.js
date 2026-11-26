// capa codigo-acceso · POST /api/acceso/login {code, lang}: valida el código personal, deja la cookie de sesión (30 días)
// y registra el ingreso para el panel central.
import { kv, kvp, hasKV, sign, setCookie, normCode, ip, hash, geo, device, json, NS, langOf } from '../../lib/acceso.js';

const DAYS = 30;

export async function POST(request) {
  if (!hasKV()) return json({ ok: false, error: 'sin-base' }, 503);
  const rl = NS + 'rl:' + (await hash(ip(request)));
  if (Number((await kv('GET', rl)) || 0) >= 12) return json({ ok: false, error: 'intentos' }, 429);   // 12 errores en 15 min por conexión
  let body = {};
  try { body = await request.json(); } catch {}
  const code = normCode(body.code);
  const rec = code ? JSON.parse((await kv('HGET', NS + 'codes', code)) || 'null') : null;
  if (!rec || rec.active === false) {
    await kvp([['INCR', rl], ['EXPIRE', rl, 900]]);
    return json({ ok: false, error: 'codigo' }, 401);
  }
  const now = Date.now();
  const tok = await sign({ c: code, iat: now, exp: now + DAYS * 864e5 });
  const lang = langOf(body.lang);
  await kvp([
    ['LPUSH', NS + 'log', JSON.stringify({ t: now, k: 'login', c: code, l: lang, ...geo(request), d: device(request) })],
    ['LTRIM', NS + 'log', 0, 4999],
    ['HSETNX', NS + 'agg:' + code, 'first', now],
    ['HSET', NS + 'agg:' + code, 'login', now],
    ['HINCRBY', NS + 'agg:' + code, 'logins', 1],
    ['DEL', rl],
  ]);
  return json({ ok: true }, 200, { 'Set-Cookie': setCookie('acc_s', tok, DAYS * 86400) });
}
