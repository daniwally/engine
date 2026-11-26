// capa codigo-acceso · POST /api/acceso/track (sendBeacon desde /acceso/track.js): apertura, cada lámina o sección vista
// y el tiempo en la anterior. {k: 'open' | 'view' | 'leave', vid, i, sec, lang, n, p, prev: {i, sec, ms}, all}
import { kvp, hasKV, verify, cookie, geo, device, NS, langOf } from '../../lib/acceso.js';
import { ACCESO } from '../../lib/acceso-config.js';

const MAX_MS = 30 * 60e3;   // más de 30 min en una lámina = se fue a otra cosa, no cuenta

export async function POST(request) {
  if (!hasKV()) return new Response(null, { status: 204 });
  const s = await verify(cookie(request, 'acc_s'));
  if (!s) return new Response(null, { status: 401 });
  let b;
  try { b = JSON.parse(await request.text()); } catch { return new Response(null, { status: 400 }); }
  if (!['open', 'view', 'leave'].includes(b.k)) return new Response(null, { status: 400 });
  const c = s.c, now = Date.now(), n = Number(b.i) || 0, sec = String(b.sec || '').slice(0, 60);
  const lang = langOf(b.lang), path = String(b.p || '').slice(0, 80);
  const ms = b.prev ? Math.round(Number(b.prev.ms) || 0) : 0;
  const cmds = [];
  if (b.k === 'open') cmds.push(['HINCRBY', NS + 'agg:' + c, 'visits', 1], ['HSETNX', NS + 'agg:' + c, 'first', now]);
  // nombres de todas las láminas (los manda la apertura) para que el panel muestre también las que no vio
  if (b.k === 'open' && Array.isArray(b.all) && b.all.length && b.all.length < 120) cmds.push(['SET', NS + 'slides', JSON.stringify(b.all.map(x => String(x).slice(0, 60)))]);
  if (b.prev && ms > 400 && ms < MAX_MS) {
    const pk = (Number(b.prev.i) || 0) + '|' + String(b.prev.sec || '').slice(0, 60);
    cmds.push(['HINCRBY', NS + 'dw:' + c, pk, ms], ['HINCRBY', NS + 'agg:' + c, 'ms', ms]);
  }
  if (b.k !== 'leave' && n) cmds.push(['HSET', NS + 'seen:' + c, n + '|' + sec, now]);
  cmds.push(['HSET', NS + 'agg:' + c, 'last', now, 'lang', lang, 'n', Number(b.n) || 0]);
  const ev = { t: now, k: b.k, v: String(b.vid || '').slice(0, 24), i: n, s: sec, l: lang, d: ms };
  if (b.k === 'open') Object.assign(ev, geo(request), { dv: device(request) });
  if (ACCESO.movil && path.startsWith(ACCESO.movil)) ev.m = 1;   // vino de la versión de celular
  cmds.push(['LPUSH', NS + 'ev:' + c, JSON.stringify(ev)], ['LTRIM', NS + 'ev:' + c, 0, 1999]);
  await kvp(cmds);
  return new Response(null, { status: 204 });
}
