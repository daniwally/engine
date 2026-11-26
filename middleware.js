// capa codigo-acceso: todo el sitio (páginas, imágenes, videos) pide la cookie de sesión que deja /api/acceso/login.
// Quedan abiertos la pantalla de acceso (/acceso/), la API y las rutas marcadas como abiertas al sumar la capa.
import { next } from '@vercel/functions';
import { ACCESO } from './lib/acceso-config.js';
import { verify, cookie, kv, hasKV, NS } from './lib/acceso.js';

export const config = {
  matcher: ['/((?!acceso|api|favicon\\.ico|robots\\.txt|propuesta\\.html|rumikuna\\-presupuesto\\.html|brinox\\.html|brinox\\-site\\-thumb\\.jpg|pernod\\-ricard\\.html|sembrasol\\.html|wtf\\-ai\\-first\\-2026\\.html|wtf\\-propuesta\\-2026\\.html|wtf\\-propuesta\\-pipona\\.html|wtf\\-credenciales\\-slides).*)'],   // la escribe agregar_capa.py: Vercel la lee como texto fijo, no puede venir de ACCESO
};

const MOBILE = /iPhone|iPod|Android.*Mobile|Mobile.*Firefox|Windows Phone/i;
const isPage = p => p === '/' || p.endsWith('/') || p.endsWith('.html');

export default async function middleware(request) {
  const url = new URL(request.url);
  // una carpeta pedida sin la barra final (/en) va con la barra: si no, las rutas relativas de la página apuntan mal
  if (ACCESO.barra !== false && !url.pathname.endsWith('/') && !/\.[^/]+$/.test(url.pathname))
    return Response.redirect(new URL(url.pathname + '/' + url.search, url), 308);
  const s = await verify(cookie(request, 'acc_s'));
  let ok = !!s;
  // en las páginas (no en cada imagen) se revisa además que el código siga activo: pausar un código corta el acceso
  if (ok && isPage(url.pathname) && hasKV()) {
    try { const rec = JSON.parse((await kv('HGET', NS + 'codes', s.c)) || 'null'); ok = !!rec && rec.active !== false; }
    catch { ok = true; }   // si la base no responde, no se le cierra la puerta a quien ya entró
  }
  // versión de celular (si el proyecto la tiene): la portada lleva ahí, salvo que se haya elegido la de escritorio (cookie acc_v=d)
  if (ok && ACCESO.movil && (url.pathname === '/' || url.pathname === '/index.html') && MOBILE.test(request.headers.get('user-agent') || '') && cookie(request, 'acc_v') !== 'd')
    return new Response(null, { status: 302, headers: { Location: ACCESO.movil + url.search, 'Cache-Control': 'no-store', Vary: 'User-Agent' } });
  if (ok) return next();
  if (isPage(url.pathname)) {
    const to = new URL('/acceso/', url);
    to.searchParams.set('next', url.pathname);
    return new Response(null, { status: 302, headers: { Location: to.pathname + to.search, 'Cache-Control': 'no-store' } });
  }
  return new Response('Acceso restringido', { status: 401, headers: { 'Cache-Control': 'no-store' } });
}
