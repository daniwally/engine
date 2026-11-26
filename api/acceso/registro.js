// capa codigo-acceso · GET /api/acceso/registro: anota este proyecto en el registro del panel central (acc:projects) con su
// nombre, prefijo de códigos, idiomas, color, logo y fondo. Escribe solo la configuración fija de este proyecto, nada que
// venga del pedido, y solo si cambió. Lo llama el skill después de publicar, o el botón "Sumar proyecto" del panel.
// Si el slug ya está registrado con otra dirección, no lo pisa salvo ?forzar=1 (por ejemplo, al cambiar de dominio).
import { kv, hasKV, json, NS, REG } from '../../lib/acceso.js';
import { ACCESO } from '../../lib/acceso-config.js';

const local = u => /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(u || '');

export async function GET(request) {
  if (!hasKV()) return json({ ok: false, error: 'sin-base' }, 503);
  const req = new URL(request.url);
  const url = (ACCESO.url || req.origin).replace(/\/$/, '');
  // logo y fondo: del dominio del proyecto; en la prueba local, del servidor local (en el dominio todavía no existen)
  const abs = p => (p ? (local(req.origin) ? req.origin : url) + p : '');
  const rec = {
    slug: ACCESO.slug, nombre: ACCESO.nombre, prefijo: ACCESO.prefijo, url, idiomas: ACCESO.idiomas,
    color: ACCESO.color, on: ACCESO.on, tema: ACCESO.tema, unidad: ACCESO.unidad, comparte: ACCESO.comparte || {},
    logo: abs(ACCESO.logo), fondo: abs(ACCESO.fondo), ns: NS, v: 1,
  };
  const prev = JSON.parse((await kv('HGET', REG, ACCESO.slug)) || 'null');
  if (prev && prev.url !== url && !local(prev.url) && req.searchParams.get('forzar') !== '1')
    return json({ ok: false, error: 'slug-en-uso', slug: ACCESO.slug, url: prev.url }, 409);
  const { t, ...was } = prev || {};
  if (JSON.stringify(was) !== JSON.stringify(rec)) await kv('HSET', REG, ACCESO.slug, JSON.stringify({ ...rec, t: t || Date.now() }));
  return json({ ok: true, slug: ACCESO.slug, nombre: ACCESO.nombre, url });
}
