/* capa codigo-acceso · registro de lo que se vio. Lo carga cada página del proyecto (agregar_capa.py lo inyecta).
   Manda a /api/acceso/track la apertura, cada cambio de lámina o sección con el tiempo pasado en la anterior, y al salir
   o esconder la pestaña el tiempo de la última.
   Qué cuenta como lámina, en este orden: lo que diga data-slide en la etiqueta del script, los elementos con data-acc,
   los .slide, las <section> y los [data-title] (si están anidados, cuenta el de afuera).
   Cuál es la actual: la única que tenga una clase de estado (on, active, is-active, current, present); si no hay una sola,
   la que está en el centro de la pantalla; si tampoco, la última cuyo borde de arriba pasó el 40% de la pantalla.
   Nombre: data-sec, data-title, aria-label, el primer título o el id. Número: data-i si lo trae (por ejemplo la versión de
   celular de un deck, donde cada sección dice qué lámina del deck es); si no, el orden. */
(() => {
  const D = (document.currentScript && document.currentScript.dataset) || {};
  const vid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const lang = (document.documentElement.lang || '').slice(0, 2).toLowerCase();
  const ON = ['on', 'active', 'is-active', 'current', 'present'];
  const list = () => {
    for (const q of [D.slide, '[data-acc]', '.slide', 'section', '[data-title]']) {
      if (!q) continue;
      const L = [...document.querySelectorAll(q)];
      const top = L.filter(el => !L.some(o => o !== el && o.contains(el)));
      if (top.length >= 2 || (q === D.slide && top.length)) return top;
    }
    return [];
  };
  // texto visible de un elemento aunque la lámina esté oculta: un <br> o un bloque cuentan como espacio, scripts y estilos no
  const BLOCK = /^(BR|P|DIV|LI|H[1-6]|SECTION|ARTICLE|HEADER|FOOTER|FIGCAPTION|TD|TH)$/;
  const txt = el => [...el.childNodes].map(n => n.nodeType === 3 ? n.data : n.nodeType === 1 && !/^(SCRIPT|STYLE|SVG|TEMPLATE|NOSCRIPT)$/.test(n.tagName)
    ? (BLOCK.test(n.tagName) ? ' ' + txt(n) + ' ' : txt(n)) : '').join('');
  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
  const name = el => clean(el.dataset.sec || el.dataset.title || el.getAttribute('aria-label')
    || [...el.querySelectorAll('h1, h2, h3')].map(txt).map(clean).find(Boolean) || clean(txt(el)) || el.id).slice(0, 60);
  const info = (el, L) => ({ i: Number(el.dataset.i) || L.indexOf(el) + 1, sec: name(el) });
  const current = L => {
    const on = L.filter(el => ON.some(c => el.classList.contains(c)));
    if (on.length === 1) return on[0];
    const hit = document.elementsFromPoint ? document.elementsFromPoint(innerWidth / 2, innerHeight / 2) : [];
    for (const h of hit) { const el = L.find(s => s === h || s.contains(h)); if (el) return el; }
    let best = null;
    for (const s of L) { const r = s.getBoundingClientRect(); if (r.height && r.top <= innerHeight * 0.4) best = s; }
    return best || L[0];
  };
  const send = (k, x) => {
    const L = list();
    const body = JSON.stringify({ k, vid, lang, p: location.pathname, n: Number(document.documentElement.dataset.n) || L.length, ...x });
    if (!(navigator.sendBeacon && navigator.sendBeacon('/api/acceso/track', new Blob([body], { type: 'text/plain' }))))
      fetch('/api/acceso/track', { method: 'POST', body, keepalive: true, credentials: 'same-origin' }).catch(() => {});
  };
  let cur = null, curInfo = null, t0 = performance.now(), opened = false, visible = document.visibilityState !== 'hidden';
  const tick = () => {
    const L = list(); if (!L.length) return;
    const el = current(L);
    if (!el || el === cur) return;
    const now = performance.now();
    const prev = cur && visible ? { ...curInfo, ms: now - t0 } : null;
    cur = el; curInfo = info(el, L); t0 = now;
    // la apertura manda la lista de láminas para el panel, salvo que las secciones digan su número de lámina (data-i):
    // ahí no son todas las láminas, solo las que tiene esta versión
    const all = opened || L.some(x => x.dataset.i) ? {} : { all: L.map(name) };
    send(opened ? 'view' : 'open', { ...curInfo, prev, ...all });
    opened = true;
  };
  setInterval(tick, 400); tick();
  const flush = () => { if (cur && visible) send('leave', { ...curInfo, prev: { ...curInfo, ms: performance.now() - t0 } }); t0 = performance.now(); };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { flush(); visible = false; } else { visible = true; t0 = performance.now(); }
  });
  addEventListener('pagehide', () => { if (visible) flush(); visible = false; });
})();
