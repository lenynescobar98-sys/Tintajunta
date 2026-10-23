/* TintaJunta · prototipo — lógica de la sala en vivo (cliente) */
'use strict';

/* v115: limpieza de elementos obsoletos — si el navegador tiene HTML viejo en caché
 * (ej. la barra roomKeyBar eliminada en v114), quitarlos del DOM al arrancar. */
(function killStale() {
  try {
    ['roomKeyBar', 'roomKeyBtn'].forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  } catch (e) {}
})();

/* ============ Google AdSense ============
 * Alejandro: pega aquí tu Publisher ID cuando Google apruebe la cuenta.
 * Formato: 'ca-pub-XXXXXXXXXXXXXXXX'
 * Vacío ('') = muestra placeholder "Espacio publicitario" en los slots.
 * NO se muestran anuncios dentro de la sala de lectura (regla permanente).
 */
const ADSENSE_CLIENT = 'ca-pub-7762243852397440';

const COLORS = {
  azul:     '#1e40af',
  rojo:     '#b91c1c',
  verde:    '#166534',
  ambar:    '#b45309',
  violeta:  '#6d28d9',
  negro:    '#111827',
  celeste:  '#0284c7',
  turquesa: '#0d9488',
  cian:     '#0891b2',
  indigo:   '#4338ca',
  lila:     '#a78bfa',
  fucsia:   '#c026d3',
  magenta:  '#be185d',
  rosa:     '#ec4899',
  coral:    '#f97362',
  naranja:  '#ea580c',
  salmon:   '#fb7185',
  terracota:'#c2410c',
  mostaza:  '#ca8a04',
  dorado:   '#a16207',
  lima:     '#65a30d',
  esmeralda:'#059669',
  menta:    '#34d399',
  oliva:    '#4d7c0f',
  chocolate:'#92400e',
  vino:     '#881337',
  petroleo: '#155e75',
  gris:     '#4b5563',
};
const COLOR_NAMES = {
  azul: 'Azul', rojo: 'Rojo', verde: 'Verde', ambar: 'Ámbar', violeta: 'Violeta', negro: 'Negro',
  celeste: 'Celeste', turquesa: 'Turquesa', cian: 'Cian', indigo: 'Índigo', lila: 'Lila',
  fucsia: 'Fucsia', magenta: 'Magenta', rosa: 'Rosa', coral: 'Coral', naranja: 'Naranja',
  salmon: 'Salmón', terracota: 'Terracota', mostaza: 'Mostaza', dorado: 'Dorado', lima: 'Lima',
  esmeralda: 'Esmeralda', menta: 'Menta', oliva: 'Oliva', chocolate: 'Chocolate', vino: 'Vino',
  petroleo: 'Petróleo', gris: 'Gris',
};

/* La red es HTTP puro (ver initNet): no hay socket persistente. */
let myName = localStorage.getItem('tj_name') || '';
let myColor = localStorage.getItem('tj_color') || 'azul';
let isTeacher = localStorage.getItem('tj_teacher') === '1'; // el profesor siempre usa tinta negra
if (isTeacher) myColor = 'negro';
/* Nombre visible: PLANO, sin adornos. El 🎓 del profesor se deriva del color
   verificado (tinta negra) al pintar, nunca del nombre — el servidor es quien
   decide quién es profesor (anti-suplantación). */
const displayName = () => myName;
const capFor = (color) => (color === 'negro' ? '🎓 ' : ''); // distintivo del profesor
let myRoom = '';

/* Normaliza un código de sala igual que el servidor (null si inválido) */
function normalizeRoomClient(raw) {
  const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  if (!code) return null;
  if (code.length < 4) return null;
  return code;
}
myRoom = normalizeRoomClient(localStorage.getItem('tj_room')) || '';
let highlights = [];
let notes = [];
let wordCount = 0;
const cover = new Map();      // índice de palabra -> subrayado (el más reciente gana)
const spanByIdx = [];         // índice de palabra -> <span>
let pendingRange = null;      // rango seleccionado pendiente de acción
let suppressSel = false;      // evita que los clics en la barra disparen selección
let pencilMode = localStorage.getItem('tj_pencil') !== 'off'; // lápiz: marcar directo, activado por defecto
/* Borrar: mantén presionado tu propio subrayado ½ segundo (sin menús) */
/* Tema: blanco (claro) por defecto; 'dark' es el cálido original */
/* 2026-10-03: migración — forzar blanco al abrir (teléfonos con 'dark' guardado de pruebas) */
if (!localStorage.getItem('tj_theme_v2')) {
  localStorage.setItem('tj_theme', 'light');
  localStorage.setItem('tj_theme_v2', '1');
}
function applyTheme() {
  const th = localStorage.getItem('tj_theme') || 'light';
  document.documentElement.dataset.theme = th === 'dark' ? 'dark' : '';
  const b = document.getElementById('themeBtn');
  if (b) { b.textContent = th === 'dark' ? '☀️' : '🌙'; b.title = th === 'dark' ? t('themeLight') : t('themeDark'); }
}
applyTheme();

const $ = (id) => document.getElementById(id);
/* fetch con timeout: evita el "Conectando…" eterno */
async function fetchTimeout(url, ms, opts) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms || 10000);
  try {
    const r = await fetch(url, { ...(opts || {}), signal: ctrl.signal });
    return r;
  } finally { clearTimeout(t); }
}
/* Estado de error con botón Reintentar */
function libError(msg, retryFn) {
  const row = document.getElementById('rowRecomendados');
  if (!row) return;
  row.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'hrow-empty';
  p.textContent = msg;
  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.style.marginTop = '10px';
  btn.textContent = '🔄 Reintentar';
  btn.onclick = retryFn;
  row.appendChild(p);
  row.appendChild(btn);
}
/* Registro remoto de diagnóstico (temporal, para depurar el prototipo) */
function clog(m) {
  try {
    fetch('/api/clog', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg: Math.round(performance.now()) + 'ms ' + String(m).slice(0, 380) }), keepalive: true });
  } catch (e) { /* noop */ }
}
window.addEventListener('error', (e) => clog('JSERROR: ' + e.message + ' @' + (e.lineno || '?')));
const hexA = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ------------------------- pantalla de entrada ------------------------- */
function buildSwatchesInto(box) {
  if (!box) return;
  box.innerHTML = '';
  Object.keys(COLORS).forEach((key) => {
    const b = document.createElement('button');
    const reserved = key === 'negro' && !isTeacher; // el negro es solo del profesor
    b.className = 'swatch' + (key === myColor ? ' sel' : '') + (reserved ? ' reserved' : '');
    b.style.background = COLORS[key];
    b.title = reserved ? t('blackInk') : colorName(key);
    b.setAttribute('aria-label', b.title);
    if (reserved) b.disabled = true;
    b.onclick = () => {
      if (isTeacher) return; // el profesor no cambia de color
      myColor = key;
      localStorage.setItem('tj_color', myColor);
      document.querySelectorAll('.swatches').forEach((bx) =>
        bx.querySelectorAll('.swatch').forEach((s, i) =>
          s.classList.toggle('sel', Object.keys(COLORS)[i] === key)));
    };
    box.appendChild(b);
  });
}
function buildSwatches() { buildSwatchesInto($('swatches')); }

function renderTools() {
  const pb = $('pencilBtn');
  if (pb) {
    pb.classList.toggle('on', pencilMode);
    pb.title = pencilMode ? t('pencilOn') : t('pencilOff');
  }
  // Sin menús nativos mientras el lápiz maneja los toques
  document.body.classList.toggle('pencil-on', pencilMode);
  const hint = document.querySelector('.hint');
  if (hint) {
    hint.innerHTML = pencilMode
      ? t('hintOn')
      : t('hintOff');
  }
}
function renderPencilBtn() { renderTools(); } // compatibilidad

/* v77 — Auth en header: detecta sesión y muestra login o chip de usuario */
let headerUser = null;
async function initHeaderAuth() {
  const loginBtn = $('loginBtn'), chip = $('userChip');
  if (!loginBtn || !chip) return;
  loginBtn.onclick = () => { googleLogin(); };
  try {
    const r = await fetch('/api/auth/me', { cache: 'no-store' });
    const d = await r.json();
    headerUser = (d && d.ok && d.user) || null;
    // Compartir el estado de Google con googleLogin()/needLogin()
    tjGoogleEnabled = !!(d && d.googleEnabled);
    tjAuthChecked = true;
  } catch (e) { headerUser = null; }
  if (headerUser) {
    loginBtn.classList.add('hidden'); loginBtn.hidden = true;
    chip.classList.remove('hidden'); chip.hidden = false;
    const av = $('userAvatar'), nm = $('userName');
    if (av) { av.src = headerUser.picture || ''; av.alt = headerUser.name || ''; }
    if (nm) nm.textContent = (headerUser.name || headerUser.email || '').split(' ')[0];
    chip.onclick = (e) => {
      const m = $('userMenu');
      if (m) { m.classList.toggle('hidden'); m.hidden = !m.hidden; }
      e.stopPropagation();
    };
    document.addEventListener('click', () => {
      const m = $('userMenu');
      if (m) { m.classList.add('hidden'); m.hidden = true; }
    });
    const pb = $('userProfileBtn');
    if (pb) pb.onclick = () => { showCreatorProfile && showCreatorProfile(headerUser.name); };
    const lo = $('logoutBtn');
    if (lo) lo.onclick = async () => {
      try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) {}
      window.location.reload();
    };
  } else {
    // Sin Google configurado en el servidor, no mostrar un botón que lleva a un error
    if (tjGoogleEnabled) { loginBtn.classList.remove('hidden'); loginBtn.hidden = false; }
    else { loginBtn.classList.add('hidden'); loginBtn.hidden = true; }
    chip.classList.add('hidden'); chip.hidden = true;
  }
  // Aviso de login exitoso/fallido
  const q = new URLSearchParams(window.location.search);
  if (q.get('login') === 'ok') { toast(t('sessionStarted')); history.replaceState(null, '', '/'); }
  else if (q.get('login') === 'error') { toast(t('sessionErr')); history.replaceState(null, '', '/'); }
}

function initJoin() {
  buildSwatches();
  renderPencilBtn();
  $('pencilBtn').onclick = () => {
    pencilMode = !pencilMode;
    localStorage.setItem('tj_pencil', pencilMode ? 'on' : 'off');
    renderTools();
    toast(pencilMode ? t('pencilOn') : t('pencilOff'));
  };
  $('themeBtn').onclick = () => {
    const cur = localStorage.getItem('tj_theme') || 'light';
    localStorage.setItem('tj_theme', cur === 'dark' ? 'light' : 'dark');
    applyTheme();
  };
  $('nameInput').value = myName;
  $('roomInput').value = myRoom || '';
  const doJoin = () => {
    myName = $('nameInput').value.trim().slice(0, 24) || t('joinDefaultName');
    const rc = normalizeRoomClient($('roomInput').value);
    if (!rc) {
      toast(t('joinNeedCode'));
      return;
    }
    myRoom = rc;
    localStorage.setItem('tj_name', myName);
    localStorage.setItem('tj_color', myColor);
    localStorage.setItem('tj_room', myRoom);

    $('join').classList.add('hidden');
    setViewState('room', true);
    boot();
  };
  $('joinBtn').onclick = doJoin;
  $('createRoomBtn').onclick = async () => {
    myName = $('nameInput').value.trim().slice(0, 24) || t('joinDefaultName');
    let code = null;
    try {
      const r = await fetch('/api/room/new');
      const d = await r.json();
      code = d && d.code;
    } catch (e) { /* abajo */ }
    if (!code) {
      // Sin login el servidor no genera códigos (prototipo): crear uno local
      // con el mismo formato; la sala se crea sola al entrar
      const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
      code = '';
      for (let i = 0; i < 6; i++) code += ABC[Math.floor(Math.random() * ABC.length)];
    }
    myRoom = code;
    localStorage.setItem('tj_name', myName);
    localStorage.setItem('tj_color', myColor);
    localStorage.setItem('tj_room', myRoom);

    $('join').classList.add('hidden');
    setViewState('room', true);
    boot();
  };
  $('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') doJoin(); });
  $('roomInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') doJoin(); });
}

/* ------------------------------ capítulo ------------------------------ */
/* v146: renderizado por partes — los libros completos (hasta ~500 mil
   palabras) se pintan en trozos para no congelar el teléfono. Los primeros
   párrafos salen al instante y el resto se agrega solo al acercarse al
   final (scroll infinito), sin que se trabe la página. */
const CHUNK_FIRST = 60, CHUNK_NEXT = 120;
let paraQueue = [], queuePos = 0, wordBase = 0, totalParas = 0;
let chunkObs = null, chunkSentinel = null;
/* v162: carga paginada — el total de párrafos viene del meta y la cola se
   llena por rangos desde /api/books/:id/paras (el libro completo de ~3MB
   no abre en señal débil). */
let bookParaTotal = 0, bookParaLoading = null;
const PARA_FIRST = 200, PARA_NEXT = 400;
/* v168: cooldown tras fallo total de rangos — con la red muerta, cada
   movimiento al pie del libro re-disparaba el ciclo completo de reintentos
   (0s/2s/6s) + otro aviso "Tardó demasiado". 30s de pausa tras el fallo. */
let bookParaFailAt = 0;
const BOOKPARA_COOLDOWN = 30000;
function renderText(paragraphs, chapterTitle, bookLine, sampleNote, images) {
  $('chapterTitle').textContent = chapterTitle;
  $('bookLine').textContent = bookLine || '';
  $('sampleNote').textContent = sampleNote || '';
  const paras = $('paras');
  if (chunkObs) { try { chunkObs.disconnect(); } catch (e) {} chunkObs = null; }
  chunkSentinel = null;
  paras.innerHTML = '';
  spanByIdx.length = 0;
  cover.clear();
  highlights = [];
  notes = [];
  // Fotos del libro (si tiene): se muestran arriba del texto
  if (images && images.length) {
    const gal = document.createElement('div');
    gal.className = 'book-gallery';
    images.forEach((src) => {
      const img = document.createElement('img');
      img.src = src; img.loading = 'lazy'; img.alt = t('photoAlt');
      gal.appendChild(img);
    });
    paras.appendChild(gal);
  }
  // v146: cola de párrafos — se pinta el primer trozo ya y el resto por scroll
  paraQueue = paragraphs || [];
  queuePos = 0;
  wordBase = 0;
  /* v163: el total NUNCA se adivina de la cola — lo pone bootBook desde el
     meta y queda estable (antes brincaba "1 de 19" → "1 de 10"). */
  wordCount = 0;
  for (const t of paraQueue) wordCount += String(t).split(/\s+/).length; // total, sin DOM
  renderMoreParas(paras, CHUNK_FIRST, true);
  setupChunkObserver();
  renderNotes();
  /* v78: transición suave al pintar un capítulo */
  paras.classList.remove('fade-in');
  void paras.offsetWidth;
  paras.classList.add('fade-in');
}
/* v146: pinta el siguiente trozo de párrafos (usa fragmento: un solo reflow).
   Devuelve cuántos párrafos agregó. */
function renderMoreParas(paras, count, skipRepaint) {
  paras = paras || $('paras');
  if (!paras || queuePos >= paraQueue.length) return 0;
  const frag = document.createDocumentFragment();
  const end = Math.min(paraQueue.length, queuePos + (count || CHUNK_NEXT));
  let pi = queuePos, idx = wordBase, added = 0;
  for (; pi < end; pi++) {
    const p = document.createElement('p');
    p.dataset.para = pi; // v68: índice de párrafo para presencia viva y notas
    String(paraQueue[pi]).split(/\s+/).forEach((t) => {
      if (!t) return;
      const s = document.createElement('span');
      s.className = 'w';
      s.textContent = t;
      s.dataset.i = idx;
      spanByIdx[idx] = s;
      p.appendChild(s);
      p.appendChild(document.createTextNode(' '));
      idx++;
    });
    frag.appendChild(p);
    added++;
  }
  if (chunkSentinel) paras.insertBefore(frag, chunkSentinel);
  else paras.appendChild(frag);
  queuePos = pi;
  wordBase = idx;
  if (!skipRepaint) repaintAll(); // aplica marcas/notas a lo recién pintado
  return added;
}
/* v163: caché offline-first en IndexedDB — la conexión se cae a cada rato;
   lo ya descargado (meta + rangos de párrafos) se lee sin red. La caché es
   best-effort: cualquier fallo de IDB se ignora en silencio y la app sigue
   igual que antes. */
const idbCache = (() => {
  const DBN = 'tintajunta', VER = 1;
  let dbp = null;
  function openDb() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      let req;
      try { req = indexedDB.open(DBN, VER); }
      catch (e) { reject(e); return; }
      req.onupgradeneeded = (ev) => {
        const d = ev.target.result;
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('paras')) d.createObjectStore('paras', { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('idb-open'));
    }).catch((e) => { dbp = null; throw e; });
    return dbp;
  }
  function get(store, key) {
    return openDb().then((d) => new Promise((resolve) => {
      let done = false;
      const fin = (v) => { if (!done) { done = true; resolve(v); } };
      try {
        const t = d.transaction(store, 'readonly');
        const r = t.objectStore(store).get(key);
        r.onsuccess = () => fin(r.result || null);
        r.onerror = () => fin(null);
        t.onerror = () => fin(null);
      } catch (e) { fin(null); }
    })).catch(() => null);
  }
  function put(store, val) {
    return openDb().then((d) => new Promise((resolve) => {
      let done = false;
      const fin = (v) => { if (!done) { done = true; resolve(v); } };
      try {
        const t = d.transaction(store, 'readwrite');
        t.objectStore(store).put(val);
        t.oncomplete = () => fin(true);
        t.onerror = () => fin(false);
      } catch (e) { fin(false); }
    })).catch(() => false);
  }
  function count(store) {
    return openDb().then((d) => new Promise((resolve) => {
      try {
        const t = d.transaction(store, 'readonly');
        const r = t.objectStore(store).count();
        r.onsuccess = () => resolve(r.result || 0);
        r.onerror = () => resolve(0);
      } catch (e) { resolve(0); }
    })).catch(() => 0);
  }
  function del(store, key) {
    return openDb().then((d) => new Promise((resolve) => {
      try {
        const t = d.transaction(store, 'readwrite');
        t.objectStore(store).delete(key);
        t.oncomplete = () => resolve(true);
        t.onerror = () => resolve(false);
      } catch (e) { resolve(false); }
    })).catch(() => false);
  }
  function oldestKeys(store, n) {
    return openDb().then((d) => new Promise((resolve) => {
      const out = [];
      try {
        const t = d.transaction(store, 'readonly');
        const r = t.objectStore(store).openCursor();
        r.onsuccess = (ev) => {
          const c = ev.target.result;
          if (c) { out.push({ key: c.key, ts: (c.value && c.value.ts) || 0 }); c.continue(); }
          else { out.sort((a, b) => a.ts - b.ts); resolve(out.slice(0, n).map((x) => x.key)); }
        };
        r.onerror = () => resolve([]);
      } catch (e) { resolve([]); }
    })).catch(() => []);
  }
  let evicting = false;
  async function evict() {
    if (evicting) return;
    evicting = true;
    try {
      const n = await count('paras');
      if (n > 400) {
        const keys = await oldestKeys('paras', n - 400);
        for (const k of keys) await del('paras', k);
      }
      const nm = await count('meta');
      if (nm > 60) {
        const keys = await oldestKeys('meta', nm - 60);
        for (const k of keys) await del('meta', k);
      }
    } catch (e) {}
    evicting = false;
  }
  /* v167: borra todos los rangos cacheados de un libro (por bookId). Se usa
     cuando el contentHash del servidor cambió: el texto se actualizó y los
     rangos viejos quedarían rancios para siempre. */
  function delBook(store, bookId) {
    return openDb().then((d) => new Promise((resolve) => {
      try {
        const t = d.transaction(store, 'readwrite');
        const r = t.objectStore(store).openCursor();
        r.onsuccess = (ev) => {
          const c = ev.target.result;
          if (c) {
            if ((c.value || {}).bookId === bookId) { try { c.delete(); } catch (e) {} }
            c.continue();
          } else resolve(true);
        };
        r.onerror = () => resolve(false);
      } catch (e) { resolve(false); }
    })).catch(() => false);
  }
  return { get, put, del, evict, delBook };
})();
function scheduleIdbEvict() {
  try { setTimeout(() => { try { idbCache.evict(); } catch (e) {} }, 5000); } catch (e) {}
}
/* v162: trae el siguiente rango de párrafos del servidor y lo agrega a la
   cola (rangos pequeños: ~40-90KB crudos, ~10-20KB con gzip). Con guardia
   anti-doble-fetch y anti-libro-viejo (si el usuario salió del libro a
   mitad de la descarga, el trozo se descarta). */
/* v167: huella del texto que estamos leyendo ahora (del meta en memoria).
   Un rango cacheado con otra huella es de una versión vieja del libro y se
   descarta — el servidor la actualiza cuando merge-books trae texto nuevo. */
function rangeBookHash(id) {
  return (currentBook && currentBook.id === id && currentBook.contentHash) || null;
}
function staleRangeHit(hit, id) {
  const h = rangeBookHash(id);
  return !!(h && hit && hit.contentHash && hit.contentHash !== h);
}
async function fetchBookParas(id, from, count) {
  id = String(id || '').toUpperCase(); // v163: misma normalización que el servidor
  const key = id + ':' + from + ':' + count;
  const myHash = rangeBookHash(id);
  /* v163: caché primero — si el rango ya se descargó, no toca la red */
  try {
    const hit = await idbCache.get('paras', key);
    if (hit && Array.isArray(hit.paragraphs) && hit.paragraphs.length) {
      if (staleRangeHit(hit, id)) { try { idbCache.del('paras', key); } catch (e) {} } // v167: versión vieja, rancio
      else return { ok: true, from, count: hit.paragraphs.length, total: hit.total, paragraphs: hit.paragraphs, cached: true };
    }
  } catch (e) {}
  let lastErr = null;
  for (let intento = 0; intento < 2; intento++) {
    try {
      const r = await fetchTimeout('/api/books/' + encodeURIComponent(id) +
        '/paras?from=' + from + '&count=' + count, 20000);
      if (r.status === 404) throw 404;
      if (!r.ok) throw r.status;
      const d = await r.json();
      if (!d.ok || !Array.isArray(d.paragraphs)) throw 'bad-paras';
      /* v163: escritura directa a caché. v167: se guarda la huella del texto
         para invalidar el rango si el libro se actualiza en el servidor. */
      try { idbCache.put('paras', { key, bookId: id, from, count, total: d.total, paragraphs: d.paragraphs, contentHash: myHash, ts: Date.now() }); } catch (e) {}
      return d;
    } catch (e) {
      lastErr = e;
      if (e === 404) break;
      if (intento === 0) await new Promise((res) => setTimeout(res, 1200));
    }
  }
  /* v163: último recurso — otro intento paralelo pudo haberlo guardado */
  try {
    const hit2 = await idbCache.get('paras', key);
    if (hit2 && Array.isArray(hit2.paragraphs) && hit2.paragraphs.length) {
      if (staleRangeHit(hit2, id)) { try { idbCache.del('paras', key); } catch (e) {} } // v167: versión vieja
      else return { ok: true, from, count: hit2.paragraphs.length, total: hit2.total, paragraphs: hit2.paragraphs, cached: true };
    }
  } catch (e) {}
  throw lastErr;
}
async function loadMoreBookParas(count) {
  if (!currentBook || !currentBook.id) return 0;
  const from = paraQueue.length;
  if (from >= bookParaTotal) return 0;
  const id = currentBook.id;
  /* v162: la ranura identifica libro+posición — un fetch viejo de otro libro
     (o de otra posición) nunca se reutiliza ni se pisa con el nuevo. */
  if (bookParaLoading && bookParaLoading.id === id && bookParaLoading.from === from)
    return bookParaLoading.promise;
  const n = Math.min(count || PARA_NEXT, bookParaTotal - from);
  const slot = { id, from, promise: null };
  bookParaLoading = slot;
  slot.promise = (async () => {
    /* v163: reintentos automáticos con backoff (inmediato, 2s, 6s) — la
       conexión se cae a cada rato; no se le pide al usuario que haga scroll
       para reintentar. Silencioso: un solo aviso al final, y solo si de
       verdad no hay nada que mostrar (la caché ya habría respondido). */
    const delays = [0, 2000, 6000];
    for (let a = 0; a < delays.length; a++) {
      if (a > 0) {
        await new Promise((res) => setTimeout(res, delays[a]));
        if (!currentBook || currentBook.id !== id || bookParaLoading !== slot) return 0;
      }
      try {
        const d = await fetchBookParas(id, from, n);
        if (!currentBook || currentBook.id !== id) return 0;
        if (bookParaLoading !== slot) return 0;
        const ps = d.paragraphs || [];
        for (const p of ps) {
          paraQueue.push(p);
          wordCount += String(p).split(/\s+/).length;
        }
        if (ps.length > 0 && !d.cached) scheduleIdbEvict();
        return ps.length;
      } catch (e) { /* siguiente intento */ }
    }
    if (currentBook && currentBook.id === id && bookParaLoading === slot) {
      bookParaFailAt = Date.now(); // v168: enfriar el sentinel tras el fallo total
      toast(t('bookTimeout'));
    }
    return 0;
  })();
  const p = slot.promise;
  p.then(() => { if (bookParaLoading === slot) bookParaLoading = null; },
        () => { if (bookParaLoading === slot) bookParaLoading = null; });
  return p;
}
/* v162: pinta lo que haya en cola; si se acabó pero el servidor tiene más,
   descarga el siguiente rango y sigue. */
async function paintMoreOrFetch() {
  const id = currentBook && currentBook.id;
  let n = renderMoreParas(null, CHUNK_NEXT);
  if (n === 0 && paraQueue.length < bookParaTotal) {
    const added = await loadMoreBookParas();
    if (added > 0 && queuePos < paraQueue.length) n = renderMoreParas(null, CHUNK_NEXT);
    /* v163: sin aviso aquí — loadMoreBookParas ya avisa una sola vez al final
       de sus reintentos (antes se duplicaba el "Tardó demasiado"). */
  }
  if (chunkObs && queuePos >= paraQueue.length && paraQueue.length >= bookParaTotal) {
    try { chunkObs.disconnect(); } catch (err) {}
    chunkObs = null;
  }
}
/* v146: al acercarse al final, agrega el siguiente trozo automáticamente */
function setupChunkObserver() {
  const paras = $('paras');
  /* v162: idempotente — renderText y bootBook pueden llamarlo en secuencia */
  if (chunkObs) { try { chunkObs.disconnect(); } catch (e) {} chunkObs = null; }
  if (chunkSentinel) { try { chunkSentinel.remove(); } catch (e) {} chunkSentinel = null; }
  if (!paras || (queuePos >= paraQueue.length && paraQueue.length >= bookParaTotal)) return;
  chunkSentinel = document.createElement('div');
  chunkSentinel.className = 'chunk-sentinel';
  chunkSentinel.setAttribute('aria-hidden', 'true');
  paras.appendChild(chunkSentinel);
  chunkObs = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      /* v168: cooldown tras fallo total — no re-disparar el ciclo de
         reintentos en cada movimiento al pie del libro con la red muerta */
      if (Date.now() - bookParaFailAt < BOOKPARA_COOLDOWN) continue;
      paintMoreOrFetch(); // v162: trae más del servidor si la cola se vació
    }
  }, { rootMargin: '1200px' });
  chunkObs.observe(chunkSentinel);
}
/* v146: garantiza que el párrafo idx esté pintado (Modo Sígueme, pizarra) —
   v162: ahora también descarga del servidor lo que falte. */
async function ensureParaRendered(idx) {
  /* v168: respetar el cooldown tras fallo total — el modo Sígueme puede
     llamar esto en cada movimiento del profesor con la red muerta */
  if (Date.now() - bookParaFailAt < BOOKPARA_COOLDOWN) return;
  let guard = 0;
  while (queuePos <= idx && guard++ < 60) {
    if (queuePos < paraQueue.length) renderMoreParas(null, CHUNK_NEXT);
    else if (paraQueue.length < bookParaTotal) {
      const n = await loadMoreBookParas();
      if (!n) break;
    } else break;
  }
}
/* ------------------------------ pintado ------------------------------- */
function paintHighlight(h) {
  const base = COLORS[h.color] || COLORS.azul;
  // v151: estilo resaltador real — degradado de marcador con bordes
  // irregulares (como trazo hecho a mano); la variante es estable por índice
  const bg = 'linear-gradient(100deg,' + hexA(base, 0) + ' 0%,' +
    hexA(base, 0.45) + ' 5%,' + hexA(base, 0.34) + ' 50%,' +
    hexA(base, 0.45) + ' 95%,' + hexA(base, 0) + ' 100%)';
  for (let i = h.start; i <= h.end; i++) {
    cover.set(i, h);
    const s = spanByIdx[i];
    if (!s) continue;
    s.style.background = bg;
    s.classList.add('mk');
    s.classList.add('mkr' + (i % 4));
    s.title = `${capFor(h.color)}${h.name} · ${colorName(h.color)}`;
  }
}
function repaintAll() {
  cover.clear();
  spanByIdx.forEach((s) => { s.style.background = ''; s.title = ''; s.classList.remove('has-note'); s.classList.remove('mk'); s.classList.remove('mkr0'); s.classList.remove('mkr1'); s.classList.remove('mkr2'); s.classList.remove('mkr3'); s.style.setProperty('--note-c', ''); });
  highlights.forEach(paintHighlight);
  paintNoteMarks();
  paintNoteBadges(); // v68
  pendingMarks.forEach(paintPendingVisual); // v175: la marca provisional sobrevive a los re-pintados del poll
}
/* Marca visual en palabras con nota: subrayado punteado del color del autor */
/* v68 — Insignias 💬 por párrafo (patrón Wattpad): los párrafos con notas muestran
   cuántas tienen; al tocar, se abre el panel de notas. Hace visibles las notas. */
function paintNoteBadges() {
  const paras = $('paras');
  if (!paras) return;
  paras.querySelectorAll('.note-badge').forEach((b) => b.remove());
  const countByPara = {};
  for (const n of notes) {
    const s = spanByIdx[n.start];
    const pEl = s && s.closest('p[data-para]');
    if (!pEl) continue;
    const pi = pEl.dataset.para;
    countByPara[pi] = (countByPara[pi] || 0) + 1;
  }
  Object.keys(countByPara).forEach((pi) => {
    const pEl = paras.querySelector(`p[data-para="${pi}"]`);
    if (!pEl) return;
    const b = document.createElement('button');
    b.className = 'note-badge';
    b.type = 'button';
    b.title = t('noteViewTitle');
    b.innerHTML = `💬 ${countByPara[pi]}`;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      setMarginTab('notes');
      const first = notes.find((n) => {
        const s = spanByIdx[n.start];
        return s && s.closest('p[data-para]') === pEl;
      });
      if (first) {
        const card = [...document.querySelectorAll('#notes .note-card')].find((c) =>
          c.querySelector('.note-quote')?.textContent.includes((first.quote || '').slice(0, 20)));
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      const margin = document.querySelector('aside.margin');
      if (margin && window.innerWidth < 900) margin.scrollIntoView({ behavior: 'smooth' });
    });
    pEl.appendChild(b);
  });
}
function paintNoteMarks() {
  const seen = new Set();
  for (const n of notes) {
    const c = COLORS[n.color] || COLORS.azul;
    for (let i = n.start; i <= n.end; i++) {
      if (seen.has(i)) continue;
      seen.add(i);
      const s = spanByIdx[i];
      if (!s) continue;
      s.classList.add('has-note');
      s.style.setProperty('--note-c', c);
    }
  }
}

/* ------------------------------- notas -------------------------------- */
function renderNotes() {
  const box = $('notes');
  $('notesCount').textContent = notes.length ? `(${notes.length})` : '';
  if (!notes.length) {
    box.innerHTML = '<p class="notes-empty">' + t('notesEmpty') + '</p>';
    return;
  }
  box.innerHTML = '';
  [...notes].reverse().forEach((n) => {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.style.borderLeftColor = COLORS[n.color] || COLORS.azul;
    card.innerHTML =
      `<div class="note-head">
         <span class="note-author"><span class="dot" style="background:${COLORS[n.color] || COLORS.azul}"></span>${capFor(n.color)}${esc(n.name)}${n.code ? `<span class="note-code">${esc(n.code)}</span>` : ''}</span>
         ${n.name === displayName() ? `<button class="note-del" data-id="${n.id}" title="' + t('noteDelTitle') + '">✕</button>` : ''}
       </div>
       <p class="note-quote" data-start="${n.start}" data-end="${n.end}">“${esc(n.quote)}”</p>
       <p class="note-text">${esc(n.text)}</p>`;
    box.appendChild(card);
  });
  box.querySelectorAll('.note-del').forEach((b) => {
    b.onclick = async () => {
      /* v176: el borrado de nota va por netPost (outbox) — en señal débil se
         encola y reintenta solo al reconectar en vez de perderse con un toast.
         404 = la nota ya se borró con otro gesto: confirmar en silencio. */
      const r = await netPost(roomBase() + '/del', { kind: 'note', id: b.dataset.id }, null);
      if (r.ok || r.queued || r.status === 404) {
        notes = notes.filter((n) => n.id !== b.dataset.id);
        renderNotes(); paintNoteMarks(); paintNoteBadges(); // v176 C4: las insignias 💬 también se actualizan
        if (r.queued) toast(t('actQueued'));
      } else {
        toast(t('noteDelErr'));
      }
    };
  });
  box.querySelectorAll('.note-quote').forEach((q) => {
    q.onclick = () => {
      const s = spanByIdx[+q.dataset.start];
      if (!s) return;
      s.scrollIntoView({ behavior: 'smooth', block: 'center' });
      for (let i = +q.dataset.start; i <= +q.dataset.end; i++) {
        const sp = spanByIdx[i];
        if (sp) { sp.classList.remove('flash'); void sp.offsetWidth; sp.classList.add('flash'); }
      }
    };
  });
}

/* ----------------------------- presencia ------------------------------
   Rediseño: avatares con la inicial en el color de tinta de cada uno;
   el profesor lleva aro dorado + 🎓. paintHandsInRoster sigue usando
   .chip / data-name, sin cambios de lógica. */
/* v174: el último roster se conserva — renderRoster() se llama sin argumento al
   levantar/bajar la mano; antes eso lanzaba TypeError (roster undefined) y el
   catch mostraba un error falso con punto rojo aunque el servidor había aceptado. */
let lastRoster = [];
function renderRoster(roster) {
  roster = roster || lastRoster || [];
  lastRoster = roster;
  const box = $('presence');
  box.innerHTML = `<span class="roster-count">${t('rosterInRoom', { n: roster.length })}</span>` +
    roster.map((p) => {
      const initial = esc((p.name || '?').trim().charAt(0).toUpperCase());
      const teacher = p.color === 'negro';
      const label = esc(p.name) + (teacher ? t('rosterTeacher') : '');
      return `<span class="chip avatar-chip${teacher ? ' is-teacher' : ''}" data-name="${esc(p.name)}" title="${label}"><span class="avatar" style="background:${COLORS[p.color] || COLORS.azul}">${initial}</span><span class="avatar-name">${esc(p.name)}</span></span>`;
    }).join('');
  paintHandsInRoster();
  renderParaPresence(roster); // v68: 👁 dónde lee cada uno
}

/* v68 — Presencia viva por párrafo ("efervescencia colectiva", idea de Perusall):
   muestra quién está leyendo cada párrafo en tiempo real. */
let lastTogetherToast = 0;
const togetherSeen = new Set(); // "para::nombre" ya anunciados
function currentParaIdx() {
  const paras = $('paras');
  if (!paras) return -1;
  const midY = window.scrollY + window.innerHeight * 0.4;
  const ps = paras.querySelectorAll('p[data-para]');
  let best = -1, bestDist = 1e9;
  ps.forEach((p) => {
    const r = p.getBoundingClientRect();
    const top = r.top + window.scrollY;
    const d = Math.abs(top + r.height / 2 - midY);
    if (d < bestDist) { bestDist = d; best = Number(p.dataset.para); }
  });
  return best;
}
/* v173: firma del mapeo párrafo→nombres para no reconstruir los chips si
   nadie cambió de párrafo (renderRoster corre cada pocos segundos). */
let lastParaEyesSig = '';
function renderParaPresence(roster) {
  const paras = $('paras');
  if (!paras || currentView !== 'room') return;
  const mine = (myName || '').trim();
  const byPara = {};
  (roster || []).forEach((p) => {
    if ((p.name || '').trim() === mine) return;
    const pi = Number(p.para);
    if (!Number.isFinite(pi) || pi < 0) return;
    (byPara[pi] = byPara[pi] || []).push(p);
  });
  /* Firma insensible al orden (el roster del servidor no garantiza orden
     estable). Si no cambió nada, se salta el remove/re-add del DOM; el aviso
     de "leyendo juntos" sigue evaluándose siempre. */
  const sig = JSON.stringify(Object.keys(byPara).sort().map((pi) =>
    [pi, byPara[pi].map((p) => p.name).sort()]));
  if (sig !== lastParaEyesSig) {
    lastParaEyesSig = sig;
    paras.querySelectorAll('.para-eyes').forEach((e) => e.remove());
    Object.keys(byPara).forEach((pi) => {
      const pEl = paras.querySelector(`p[data-para="${pi}"]`);
      if (!pEl) return;
      const chip = document.createElement('span');
      chip.className = 'para-eyes';
      const names = byPara[pi].slice(0, 3).map((p) =>
        `<span class="dot" style="background:${COLORS[p.color] || COLORS.azul}"></span>${esc(p.name)}`).join('');
      const more = byPara[pi].length > 3 ? ` <b>+${byPara[pi].length - 3}</b>` : '';
      chip.innerHTML = t('presenceHere', { names, more });
      pEl.appendChild(chip);
    });
  }
  // v68: aviso sutil cuando alguien llega a TU párrafo (máx 1 cada 45s, sin spam)
  try {
    const myPara = String(currentParaIdx());
    const now = Date.now();
    (byPara[myPara] || []).forEach((p) => {
      const key = myPara + '::' + p.name;
      if (!togetherSeen.has(key) && now - lastTogetherToast > 45000) {
        togetherSeen.add(key);
        lastTogetherToast = now;
        toast(t('presencePara', { name: p.name }));
      }
    });
    if (togetherSeen.size > 60) togetherSeen.clear(); // higiene de memoria
  } catch (e) {}
}

/* ------------------------------- avisos ------------------------------- */
/* v157: avisos sin spam — el mismo mensaje no se apila: si ya está visible,
   solo se renueva su temporizador. Nunca más de 3 avisos a la vez. */
const toastTimers = new Map();
function toast(msg) {
  const box = $('toasts');
  if (!box) return;
  const prev = toastTimers.get(msg);
  if (prev) {
    clearTimeout(prev.timer);
    prev.el.classList.remove('toast');
    void prev.el.offsetWidth; // re-dispara la animación
    prev.el.classList.add('toast');
    prev.timer = setTimeout(() => { prev.el.remove(); toastTimers.delete(msg); }, 3200);
    return;
  }
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  box.appendChild(t);
  while (box.children.length > 3) {
    const old = box.firstElementChild;
    if (!old) break;
    const rec = toastTimers.get(old.textContent);
    if (rec) clearTimeout(rec.timer);
    toastTimers.delete(old.textContent);
    old.remove();
  }
  const timer = setTimeout(() => { t.remove(); toastTimers.delete(msg); }, 3200);
  toastTimers.set(msg, { el: t, timer });
}
/* v163: quitar un aviso específico (ej. "Abriendo libro…" cuando el libro ya abrió) */
function dismissToast(msg) {
  try {
    const rec = toastTimers.get(msg);
    if (!rec) return;
    clearTimeout(rec.timer);
    toastTimers.delete(msg);
    if (rec.el && rec.el.remove) rec.el.remove();
  } catch (e) {}
}

/* ----------------------------- selección ------------------------------ */
function wordSpanOf(node) {
  if (!node) return null;
  const el = node.nodeType === 3 ? node.parentElement : node;
  if (!el || !el.closest) return null;
  const w = el.closest('.w');
  if (w) return w;
  // La selección cayó en el espacio entre dos palabras (nodo de texto suelto
  // dentro del <p>): usa la palabra vecina anterior o siguiente.
  if (node.nodeType === 3 && el.tagName === 'P') {
    const prev = node.previousSibling, next = node.nextSibling;
    if (prev && prev.nodeType === 1 && prev.classList.contains('w')) return prev;
    if (next && next.nodeType === 1 && next.classList.contains('w')) return next;
  }
  return null;
}
function getWordRange() {
  const sel = window.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) return null;
  const a = wordSpanOf(sel.anchorNode);
  const b = wordSpanOf(sel.focusNode);
  if (!a || !b || !$('paras').contains(a) || !$('paras').contains(b)) return null;
  const i1 = +a.dataset.i, i2 = +b.dataset.i;
  return { start: Math.min(i1, i2), end: Math.max(i1, i2) };
}
function selectionRect() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return null;
  const r = sel.getRangeAt(0).getBoundingClientRect();
  return (r.width || r.height) ? r : null;
}
// v155: los popups nunca salen de la pantalla. El clamp viejo
// Math.min(Math.max(8, cx), innerWidth - 360) daba valores NEGATIVOS en
// móviles angostos (320px - 360 = -40) y con el teclado abierto el alto
// (innerHeight - 280) también podía ser negativo: el popup quedaba fuera
// de la pantalla, sin forma de cerrarlo. El ancho real es ≤340px (CSS).
function clampPopupX(cx, w) { return Math.min(Math.max(8, cx), Math.max(8, window.innerWidth - w - 8)); }
function clampPopupY(cy, h) { return Math.min(Math.max(8, cy), Math.max(8, window.innerHeight - h - 8)); }
function showToolbar(range, anchorRect, mode) {
  pendingRange = range;
  const tb = $('toolbar');
  const own = cover.get(range.start);
  const mine = own && own.name === displayName() && range.start === own.start && range.end === own.end;
  if (mode === 'highlight') {
    // Toque sobre un subrayado existente: Nota (+ Quitar si es mío)
    $('btnHighlight').classList.add('hidden');
    $('btnNote').classList.remove('hidden');
    const isMine = !!(own && own.name === displayName());
    $('btnRemove').classList.toggle('hidden', !isMine);
    tb.dataset.hid = isMine ? own.id : '';
  } else {
    $('btnHighlight').classList.toggle('hidden', !!mine);
    $('btnNote').classList.toggle('hidden', !!mine);
    $('btnRemove').classList.toggle('hidden', !mine);
    tb.dataset.hid = mine ? own.id : '';
  }
  tb.classList.remove('hidden');
  const x = clampPopupX(anchorRect.left + anchorRect.width / 2 - 120, 250);
  const y = clampPopupY(anchorRect.top - 56, 60); // .toolbar es position:fixed -> coordenadas de viewport
  tb.style.left = x + 'px';
  tb.style.top = y + 'px';
}
function hideToolbar() { $('toolbar').classList.add('hidden'); pendingRange = null; }
function hideNotepop() { $('notepop').classList.add('hidden'); $('noteText').value = ''; $('noteCount').textContent = '0'; }
/* v177: reabrir el popup de nota con el texto intacto — ante un error DURO del
   servidor la nota no quedó encolada y el texto se perdería (patrón del chat
   v154 / pizarra v139). */
function reopenNotepop(start, end, text) {
  const words = [];
  for (let i = start; i <= end; i++) { if (spanByIdx[i]) words.push(spanByIdx[i].textContent); }
  $('noteQuote').textContent = '“' + words.join(' ').slice(0, 120) + '”';
  const a = spanByIdx[start] ? spanByIdx[start].getBoundingClientRect() : { left: 20, bottom: 200 };
  const np = $('notepop');
  np.style.left = clampPopupX(a.left, 340) + 'px';
  np.style.top = clampPopupY(a.bottom + 8, 280) + 'px'; // .notepop es position:fixed
  $('noteText').value = text;
  $('noteCount').textContent = String(text.length);
  np.classList.remove('hidden');
  setTimeout(() => { try { $('noteText').focus(); } catch (e) {} }, 50);
}
function hideViewNote() { $('viewNotePop').classList.add('hidden'); }
/* Muestra una nota al tocar una palabra marcada: autor, color, código y fecha */
function showViewNote(n, anchorRect) {
  $('vnoteDot').style.background = COLORS[n.color] || COLORS.azul;
  $('vnoteName').textContent = n.name || t('joinDefaultName');
  $('vnoteCode').textContent = n.code || '';
  $('vnoteCode').style.display = n.code ? '' : 'none';
  $('vnoteQuote').textContent = '“' + (n.quote || '') + '”';
  $('vnoteText').textContent = n.text || '';
  const d = n.ts ? new Date(n.ts) : null;
  $('vnoteDate').textContent = d ? d.toLocaleDateString('es', { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '';
  const p = $('viewNotePop');
  p.style.left = clampPopupX(anchorRect.left + anchorRect.width / 2 - 170, 340) + 'px';
  p.style.top = clampPopupY(anchorRect.bottom + 8, 300) + 'px'; // .notepop es position:fixed
  p.classList.remove('hidden');
}

function initSelection() {
  let maybeTimer = null;
  const maybe = () => {
    if (suppressSel) return;
    if (!pencilMode) {
      // Todo apagado: no se marca; limpiar cualquier selección nativa
      window.getSelection().removeAllRanges();
      hideToolbar();
      return;
    }
    clearTimeout(maybeTimer); // solo importa el estado MÁS RECIENTE de la selección
    maybeTimer = setTimeout(() => {
      maybeTimer = null;
      if (suppressSel) return;
      const r = getWordRange();
      if (r) {
        const rect = selectionRect();
        if (rect) {
          // Lápiz: subrayar directo sin barra (ratón)
          const ownH = cover.get(r.start);
          const isMine = !!(ownH && ownH.name === displayName() && r.start === ownH.start && r.end === ownH.end);
          if (!isMine) {
            postHighlight(r);
            window.getSelection().removeAllRanges();
            hideToolbar();
          } else {
            showToolbar(r, rect);
          }
        }
      } else {
        hideToolbar();
      }
    }, 30);
  };
  document.addEventListener('mouseup', (e) => {
    if (e.target.closest && (e.target.closest('#toolbar') || e.target.closest('#notepop'))) return;
    maybe();
  });
  document.addEventListener('touchend', (e) => {
    if (e.target.closest && (e.target.closest('#toolbar') || e.target.closest('#notepop'))) return;
    maybe();
  });
  // iOS Safari: la señal más fiable de que la selección cambió (el dedo no
  // siempre dispara touchend sobre el documento tras una pulsación larga)
  document.addEventListener('selectionchange', () => { maybe(); });

  // --- Marcado táctil: como un lápiz de verdad ---
  // Con el lápiz activado NO hay espera: tocas y arrastras, y pinta al instante.
  // El gesto se decide por dirección: horizontal = marcar, vertical = desplazar
  // la página. Con el lápiz apagado se mantiene la pulsación larga (450ms) para
  // la barra clásica. Un toque simple (sin arrastrar) no marca: abre el popup.
  let marking = false, markStartIdx = null, markCur = null;
  let touchMode = null, touchStartPt = null; // null | 'maybe' | 'marking' | 'scroll'
  const parasEl = $('paras');
  // v127: solo se borra el tramo pintado antes (O(rango) en vez de O(libro) por touchmove)
  let lastTempRange = null;
  function clearTempMark() {
    if (lastTempRange) {
      for (let i = lastTempRange.s; i <= lastTempRange.e; i++) { const sp = spanByIdx[i]; if (sp) sp.classList.remove('marking'); }
      lastTempRange = null;
    } else {
      spanByIdx.forEach((s) => s.classList.remove('marking'));
    }
  }
  function paintTempMark(a, b) {
    clearTempMark();
    const s = Math.min(a, b), e = Math.max(a, b);
    for (let i = s; i <= e; i++) { const sp = spanByIdx[i]; if (sp) sp.classList.add('marking'); }
    lastTempRange = { s, e };
    markCur = { start: s, end: e };
  }
  function startMarking() {
    marking = true;
    touchMode = 'marking';
    clog('marcar INICIADO en palabra ' + touchStartPt.i + (pencilMode ? ' (lápiz instantáneo)' : ' (pulsación larga)'));
    suppressSel = true; // que la selección nativa no interfiera mientras marcamos
    window.getSelection().removeAllRanges();
    hideToolbar();
    markStartIdx = touchStartPt.i;
    paintTempMark(markStartIdx, markStartIdx);
    if (navigator.vibrate) navigator.vibrate(10);
  }
  function cancelMarking() {
    marking = false;
    touchMode = null;
    clearTempMark();
    markCur = null;
    setTimeout(() => { suppressSel = false; }, 150);
  }
  let noteTimer = null, justLongPressedAt = 0, justMarkedAt = 0;
  /* v168: anti-doble-toque — dos toques discretos (~300ms) en la misma palabra
     sin marcar publicaban dos subrayados idénticos (el segundo no ve la marca
     del primero porque aún no se pintó). Se recuerda el último toque-marca. */
  let lastTapMark = { i: -1, at: 0 };
  parasEl.addEventListener('touchstart', (e) => {
    if (!pencilMode) return; // lápiz apagado: solo lectura
    if (e.touches.length !== 1) { cancelMarking(); return; }
    if (!parasEl.dataset.tsLogged) { parasEl.dataset.tsLogged = '1'; clog('touchstart en texto (iOS toca la sala)'); }
    const w = e.target.closest && e.target.closest('.w');
    if (!w) return;
    const t = e.touches[0];
    touchStartPt = { x: t.clientX, y: t.clientY, i: +w.dataset.i };
    touchMode = 'maybe';
    // Mantener sobre TU propio subrayado: abre opciones (nota). Tocar = borrar párrafo.
    const h = cover.get(+w.dataset.i);
    if (h && h.name === displayName()) {
      const sx = t.clientX, sy = t.clientY;
      touchStartPt.sx = sx; touchStartPt.sy = sy;
      noteTimer = setTimeout(() => {
        noteTimer = null;
        justLongPressedAt = Date.now();
        const rect = w.getBoundingClientRect();
        showToolbar({ start: h.start, end: h.end }, rect, 'highlight');
        touchMode = 'notepop';
      }, 500);
    }
    // Sin temporizador para marcar: la dirección del arrastre decide (instantáneo)
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (noteTimer) {
      const t = e.touches[0];
      if (Math.hypot(t.clientX - touchStartPt.sx, t.clientY - touchStartPt.sy) > 12) {
        clearTimeout(noteTimer); noteTimer = null; // era arrastre, no mantener
      }
    }
    if (touchMode === 'maybe' && pencilMode) {
      const t = e.touches[0];
      const dx = t.clientX - touchStartPt.x, dy = t.clientY - touchStartPt.y;
      const adx = Math.abs(dx), ady = Math.abs(dy);
      // Gana el eje dominante: horizontal = marcar (aunque baje de línea),
      // vertical = desplazar. Sin esperas.
      if (adx > 15 && adx >= ady) {
        startMarking(); // a marcar / a borrar
      } else if (ady > 15 && ady > adx) {
        touchMode = 'scroll'; // la página se desplaza sola
      }
      return;
    }
    if (touchMode === 'marking' && marking) {
      if (e.touches.length !== 1) { cancelMarking(); return; } // segundo dedo: cancelar
      e.preventDefault(); // no hacer scroll mientras se marca el pasaje
      const t = e.touches[0];
      const el = document.elementFromPoint(t.clientX, t.clientY);
      const w = el && el.closest ? el.closest('.w') : null;
      if (w) paintTempMark(markStartIdx, +w.dataset.i);
    }
  }, { passive: false });
  document.addEventListener('touchcancel', () => {
    if (noteTimer) { clearTimeout(noteTimer); noteTimer = null; }
    cancelMarking();
  });
  document.addEventListener('touchend', (e) => {
    if (noteTimer) { clearTimeout(noteTimer); noteTimer = null; }
    if (touchMode === 'notepop') { touchMode = null; touchStartPt = null; return; } // se abrió con mantener
    const wasMarking = marking;
    const r = markCur;
    cancelMarking();
    if (!wasMarking || !r) return; // fue un toque o un scroll: no guardar nada
    // ¿se movió el dedo lo suficiente? si no, fue un toque (el click abre el popup)
    let moved = false;
    if (e.changedTouches.length && touchStartPt) {
      const t = e.changedTouches[0];
      moved = Math.hypot(t.clientX - touchStartPt.x, t.clientY - touchStartPt.y) > 10;
    }
    touchStartPt = null;
    if (!moved && r.start === r.end) return;
    // Lápiz: al soltar, el subrayado queda guardado de una vez (permanente)
    clog('lápiz: subrayado directo ' + r.start + '-' + r.end);
    justMarkedAt = Date.now(); // evita que el click posterior marque de más
    postHighlight(r);
  });

  // Modelo simple de toques (lápiz activado):
  // - Tocar palabra sin marcar → la marca al instante.
  // - Tocar TU subrayado → borra TODAS tus marcas del párrafo.
  // - Tocar subrayado ajeno → popup (ver notas).
  // - Mantener tu subrayado → popup (agregar nota).
  document.addEventListener('click', (e) => {
    if (!pencilMode) return;
    if (Date.now() - justMarkedAt < 600) return; // recién marcado con arrastre
    if (Date.now() - justLongPressedAt < 800) return; // recién abierto con mantener
    if (e.target.closest('#toolbar') || e.target.closest('#notepop') || e.target.closest('#viewNotePop')) return;
    // Si hay un popup abierto, el toque solo lo cierra
    if (!$('toolbar').classList.contains('hidden') || !$('notepop').classList.contains('hidden') || !$('viewNotePop').classList.contains('hidden')) {
      hideToolbar(); hideNotepop(); hideViewNote();
      return;
    }
    const w = e.target.closest && e.target.closest('.w');
    if (!w || !window.getSelection().isCollapsed) return;
    const i = +w.dataset.i;
    const h = cover.get(i);
    if (h && h.name === displayName()) {
      // Borrar todo lo mío en este párrafo
      const p = w.closest('p');
      let ps = i, pe = i;
      if (p) p.querySelectorAll('.w').forEach((el) => {
        const j = +el.dataset.i; if (j < ps) ps = j; if (j > pe) pe = j;
      });
      if (navigator.vibrate) navigator.vibrate(30);
      // v139: sin toast aquí — eraseInRange ya avisa con honestidad
      // ('Subrayado borrado' en éxito, error de conexión si falla)
      eraseInRange({ start: ps, end: pe });
      return;
    }
    if (h) { // subrayado ajeno: ver sus notas si las hay
      const rect = w.getBoundingClientRect();
      const rangeNotes = notes.filter((n) => n.start <= h.end && n.end >= h.start);
      if (rangeNotes.length) {
        showViewNote(rangeNotes[rangeNotes.length - 1], rect); // la más reciente
        return;
      }
      showToolbar({ start: h.start, end: h.end }, rect, 'highlight');
      return;
    }
    // Tocar palabra con nota (sin subrayado): ver la nota más reciente
    {
      const wordNotes = notes.filter((n) => i >= n.start && i <= n.end);
      if (wordNotes.length) {
        showViewNote(wordNotes[wordNotes.length - 1], w.getBoundingClientRect());
        return;
      }
    }
    // Tocar palabra suelta: marcarla al instante
    // v168: si se tocó la misma palabra hace <1.2s, es doble-toque accidental —
    // el primer toque ya publicó la marca (aún sin pintar). No duplicar.
    if (i === lastTapMark.i && Date.now() - lastTapMark.at < 1200) return;
    // v175: la palabra ya está en camino al servidor (tinta provisional
    // visible) — no publicar de nuevo mientras se confirma
    if (pendingAt(i)) return;
    lastTapMark = { i, at: Date.now() };
    postHighlight({ start: i, end: i });
  });

  [$('toolbar'), $('notepop')].forEach((el) => {
    el.addEventListener('mousedown', () => { suppressSel = true; });
    el.addEventListener('mouseup', () => { setTimeout(() => { suppressSel = false; }, 60); });
    el.addEventListener('touchstart', () => { suppressSel = true; }, { passive: true });
    el.addEventListener('touchend', () => { setTimeout(() => { suppressSel = false; }, 60); });
  });

  $('btnHighlight').onclick = () => {
    clog('tap Subrayar: pendingRange=' + (pendingRange ? pendingRange.start + '-' + pendingRange.end : 'null'));
    if (!pendingRange) return;
    postHighlight(pendingRange);
    window.getSelection().removeAllRanges();
    hideToolbar();
  };
  $('btnNote').onclick = () => {
    if (!pendingRange) return;
    const { start, end } = pendingRange;
    const words = [];
    for (let i = start; i <= end; i++) words.push(spanByIdx[i].textContent);
    $('noteQuote').textContent = '“' + words.join(' ').slice(0, 120) + '”';
    const tb = $('toolbar').getBoundingClientRect();
    const np = $('notepop');
    np.style.left = clampPopupX(tb.left, 340) + 'px';
    np.style.top = clampPopupY(tb.bottom + 8, 280) + 'px'; // .notepop es position:fixed
    np.classList.remove('hidden');
    hideToolbar();
    setTimeout(() => $('noteText').focus(), 50);
  };
  $('btnRemove').onclick = async () => {
    const hid = $('toolbar').dataset.hid;
    if (hid) {
      /* v176: por netPost (outbox) como el resto de los borrados (v174) —
         en señal débil se encola y reintenta solo al reconectar */
      const r = await netPost(roomBase() + '/del', { kind: 'highlight', id: hid }, null);
      if (r.ok || r.queued || r.status === 404) {
        highlights = highlights.filter((h) => h.id !== hid); repaintAll();
        if (r.queued) toast(t('actQueued'));
      } else {
        toast(t('hlEraseErr'));
      }
    }
    window.getSelection().removeAllRanges();
    hideToolbar();
  };
  $('noteText').addEventListener('input', () => { $('noteCount').textContent = String($('noteText').value.length); });
  $('noteCancel').onclick = () => { hideNotepop(); window.getSelection().removeAllRanges(); };
  $('vnoteClose').onclick = () => { hideViewNote(); };
  $('noteSave').onclick = async () => {
    const text = $('noteText').value.trim();
    if (!text || !pendingRange) { hideNotepop(); return; }
    const { start, end } = pendingRange;
    const roomId = myRoom; // v177: no reabrir el popup si cambió de sala/libro mientras volaba el POST
    hideNotepop();
    window.getSelection().removeAllRanges();
    pendingRange = null;
    // v145: si falla la red, la nota se encola y se envía sola al reconectar
    const r = await netPost(roomBase() + '/note', { start, end, text }, (s) => {
      if (s.note && !notes.some((n) => n.id === s.note.id)) {
        notes.push(s.note);
        renderNotes();
        paintNoteMarks();
        paintNoteBadges(); // v68
        toast(s.note.code ? t('noteSaved', { code: s.note.code }) : t('noteSavedPlain'));
      }
    });
    if (r.queued) toast(t('actQueued'));
    else if (!r.ok) {
      toast(t('noteErr'));
      // v177: error DURO del servidor (p.ej. 400 bad-range porque el texto del
      // libro cambió) — la nota NO quedó encolada. Reabrir el popup con el
      // texto intacto en vez de perderlo.
      if (myRoom === roomId && document.body.classList.contains('in-room')) {
        pendingRange = { start, end };
        reopenNotepop(start, end, text);
      }
    }
  };
}

/* ------------------------------- red (HTTP) ------------------------------ */
/* Sin WebSockets: el cliente publica con POST y sondea el estado de la sala.
 * Son peticiones HTTPS cortas: funcionan sobre cualquier conexión. */
let netOnline = false;

async function apiPost(path, body) {
  const r = await fetchTimeout(path, 15000, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: displayName(), color: myColor, ...(body || {}) }),
  });
  if (!r.ok) throw new Error('http ' + r.status);
  return r.json();
}
const roomBase = () => '/api/rooms/' + encodeURIComponent(myRoom);

/* v118: avisos de conexión con anti-rebote (señal débil en escuelas):
   solo avisa si la caída dura más de 5s, y la recuperación solo si estuvo caída */
let offlineSince = 0, offlineToastTimer = null;
function setOnline(on) {
  const was = netOnline;
  netOnline = on;
  const d = $('netdot');
  if (d) {
    d.classList.toggle('off', !on);
    d.title = on ? t('netOnlineTitle') : t('netOfflineTitle');
  }
  if (!on && was) {
    offlineSince = Date.now();
    clearTimeout(offlineToastTimer);
    offlineToastTimer = setTimeout(() => { if (!netOnline) toast(t('netOffline')); }, 5000);
  } else if (on && !was) {
    clearTimeout(offlineToastTimer);
    if (offlineSince && Date.now() - offlineSince >= 5000) toast(t('netBack'));
    offlineSince = 0;
    /* v163: al recuperar la conexión, reintentar rangos de párrafos pendientes
       sin esperar a que el usuario haga scroll */
    bookParaFailAt = 0; // v168: volvió la red — se acabó el cooldown del sentinel
    try {
      if (currentBook && currentBook.id && paraQueue.length < bookParaTotal && !bookParaLoading) {
        setTimeout(() => { try { paintMoreOrFetch(); } catch (e) {} }, 800);
      }
    } catch (e) {}
  }
}

/* v145 — outbox: en señal débil, los POST que fallan POR RED se encolan y se
   reintentan solos al recuperar la conexión (antes el gesto se perdía para
   siempre con solo un toast). Los errores HTTP (4xx/5xx) nunca se reintentan:
   son validación, no red. Idempotencia vía `cid`: si el POST original sí llegó
   al servidor pero se perdió la respuesta, el reintento no duplica. */
let outbox = [];
let flushingOutbox = false;
const OUTBOX_MAX = 100;
/* v151: el outbox sobrevive a recargas/pestañas muertas (iOS descarta pestañas
   en segundo plano; el toast "se guardará al reconectar" ahora sí es verdad).
   Solo se persiste lo serializable: el `apply` (función) se reconstruye al
   vaciar la cola según el kind derivado de la ruta. */
const OUTBOX_KEY = 'tj_outbox';
function outboxKindOf(path) {
  const m = /\/api\/rooms\/[^/]+\/(highlight|note|chat|reaction|board|del|hand|boardClear)$/.exec(String(path || '')); // v174: +del · v176: +hand +boardClear
  return m ? m[1] : '';
}
function persistOutbox() {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox.map((it) => ({
      path: it.path, body: it.body, room: it.room, kind: it.kind || outboxKindOf(it.path), color: it.color || null,
    }))));
  } catch (e) { /* almacenamiento lleno o bloqueado: la cola en memoria sigue viva */ }
}
function restoreOutbox() {
  try {
    const raw = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]');
    if (!Array.isArray(raw)) return;
    for (const it of raw) {
      if (!it || typeof it.path !== 'string' || !it.body || typeof it.body !== 'object') continue;
      if (outbox.length >= OUTBOX_MAX) break;
      outbox.push({ path: it.path, body: it.body, room: it.room || null, kind: it.kind || outboxKindOf(it.path), color: it.color || null, apply: null });
    }
    if (outbox.length) clog('outbox: restaurados ' + outbox.length + ' gestos pendientes');
  } catch (e) { /* JSON corrupto: arrancar con cola vacía */ }
}
/* Reconstruye el `apply` original para un gesto restaurado (mismo efecto que
   el cierre creado en el call-site: pintar la marca/nota/mensaje o sondear). */
function outboxApplyFor(item) {
  switch (item.kind) {
    case 'highlight': return (s) => {
      if (s.highlight) {
        // v177: retirar la tinta provisional restaurada tras una recarga — el
        // apply original (postHighlight) ya no existe en esta sesión
        clearPendingMark(s.highlight.start, s.highlight.end);
        if (!highlights.some((h) => h.id === s.highlight.id)) {
          highlights.push(s.highlight);
          paintHighlight(s.highlight);
          showUndoPill(s.highlight.id);
        }
      }
    };
    case 'note': return (s) => {
      if (s.note && !notes.some((n) => n.id === s.note.id)) {
        notes.push(s.note);
        renderNotes();
        paintNoteMarks();
        paintNoteBadges();
        toast(s.note.code ? t('noteSaved', { code: s.note.code }) : t('noteSavedPlain'));
      }
    };
    case 'chat': return (s) => {
      if (s.msg && !chat.some((m) => m.id === s.msg.id)) {
        chat.push(s.msg);
        if (chat.length > 50) chat = chat.slice(-50);
        /* v173: solo MI mensaje cuenta como visto (+1). Antes chatSeen =
           chat.length borraba el (N) de mensajes ajenos no leídos cuando el
           mensaje encolado se enviaba al reconectar. */
        chatSeen += 1;
        renderChat();
      }
    };
    case 'board': return (s) => {
      if (s && s.ok && Array.isArray(s.board)) {
        const edit = $('boardEdit');
        if (edit && edit.value.trim() === item.body.text) edit.value = ''; // no borrar un mensaje nuevo
        board = s.board; renderBoard();
      }
    };
    case 'reaction': return () => { pollState(); };
    case 'del': return () => { // v174: borrado de subrayado encolado que se envía tras recarga
      const id = item.body && item.body.id;
      if (id && item.body.kind === 'highlight') {
        highlights = highlights.filter((h) => h.id !== id);
        repaintAll();
      } else if (id && item.body.kind === 'note') { // v176: borrado de nota encolado
        notes = notes.filter((n) => n.id !== id);
        renderNotes(); paintNoteMarks(); paintNoteBadges();
      }
    };
    case 'hand': return (s) => { // v176: mano encolada que se envía al reconectar
      if (s && s.ok) { hands = s.hands || []; renderHands(); renderRoster(); }
    };
    case 'boardClear': return (s) => { // v176: limpiado de pizarra encolado
      if (s && s.ok) { board = []; renderBoard(); }
    };
    default: return null;
  }
}
function initOutbox() { restoreOutbox(); }
function makeCid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
/* apiPost lanza Error('http NNN') cuando el servidor respondió; cualquier otro
   error es fallo de red de bajo nivel (timeout, abort, TypeError). */
function isHttpErr(e) {
  return !!(e && typeof e.message === 'string' && e.message.indexOf('http ') === 0);
}
/* netPost(path, body, apply): como apiPost, pero ante fallo de red encola el
   gesto para reintentarlo al reconectar. apply(s) fusiona la respuesta exitosa
   (pintar la marca, mostrar la nota…). Devuelve {ok, queued}. */
async function netPost(path, body, apply, extra) {
  const payload = { ...(body || {}), cid: makeCid() };
  try {
    const s = await apiPost(path, payload);
    if (s && s.ok) {
      if (apply) apply(s);
      setOnline(true);
      return { ok: true, queued: false, cid: payload.cid };
    }
    return { ok: false, queued: false, cid: payload.cid };
  } catch (e) {
    /* v174: exponer el código HTTP — el /del trata 404 como "ya borrado"
       (éxito), así que los callers necesitan el status. */
    const hm = String((e && e.message) || '').match(/^http (\d+)/);
    if (hm) return { ok: false, queued: false, status: Number(hm[1]), cid: payload.cid }; // 4xx/5xx: no reintentar
    if (outbox.length >= OUTBOX_MAX) outbox.shift(); // tope de seguridad
    /* v177: `extra` lleva datos solo-locales del gesto (p.ej. el color de la
       tinta) que NO viajan al servidor pero se necesitan al restaurar la cola
       tras una recarga. */
    outbox.push({ path, body: payload, apply, room: myRoom, kind: outboxKindOf(path), color: (extra && extra.color) || null });
    persistOutbox(); // v151: la cola sobrevive a recargas
    setOnline(false);
    return { ok: false, queued: true, cid: payload.cid };
  }
}
/* Vacía la cola en orden tras recuperar la red. Cada gesto se envía a SU sala
   (la ruta quedó fija al encolarse); el apply local solo corre si seguimos en
   esa sala — si el usuario cambió de sala, el gesto ya quedó guardado y se verá
   al volver. */
async function flushOutbox() {
  if (flushingOutbox || !outbox.length) return;
  flushingOutbox = true;
  try {
    while (outbox.length) {
      const item = outbox[0];
      const apply = item.apply || outboxApplyFor(item); // v151: gesto restaurado tras recarga
      let s;
      try {
        s = await apiPost(item.path, item.body);
      } catch (e) {
        if (isHttpErr(e)) { outbox.shift(); persistOutbox(); continue; } // 4xx: descartar, no reintentar
        break; // sigue sin red: el resto queda encolado
      }
      outbox.shift();
      persistOutbox(); // v151
      if (s && s.ok && apply && item.room === myRoom) {
        try { apply(s); } catch (e2) { /* no romper el flush */ }
      }
    }
  } finally {
    flushingOutbox = false;
  }
}

let lastStateSig = '';
let lastRosterSig = '';
let lastFollowSig = '';
function applyState(s) {
  if (!s || s.ok === false) return;
  // Optimización: si nada cambió desde el último poll, no re-renderizar
  try {
    // v132 — el roster (posición de lectura de cada uno, actualizada en cada
    // heartbeat/scroll) sale de la firma principal: antes, cualquier scroll de
    // otro lector disparaba repaintAll() completo (~512k palabras en v130).
    // v156 — lo mismo para follow: el profesor reporta su scroll cada ~500ms
    // con "Sígueme" activo; antes cada cambio de follow.pos disparaba
    // repaintAll() + reconstrucción de chat/notas en todos los alumnos.
    const sig = JSON.stringify([s.highlights, s.notes, s.board, s.para, s.chat, s.reactions, s.hands, s.switchTo]);
    const fsig = JSON.stringify(s.follow || null);
    if (sig === lastStateSig) {
      // Solo cambió el roster: actualizar presencia sin repintar todo el libro
      const rsig = JSON.stringify(s.roster || []);
      if (rsig !== lastRosterSig) {
        lastRosterSig = rsig;
        try { renderRoster(s.roster || []); } catch (e) { /* presencia es cosmética */ }
      }
      // Solo cambió follow: actualizar seguimiento sin repintar nada más
      if (fsig !== lastFollowSig) {
        lastFollowSig = fsig;
        follow = s.follow || { active: false, pos: 0, ts: 0, name: '' };
        try { renderFollow(); } catch (e) { /* seguimiento es cosmético */ }
      }
      return;
    }
    lastStateSig = sig;
    lastFollowSig = fsig;
    lastRosterSig = JSON.stringify(s.roster || []);
  } catch (e) { /* si falla el diff, renderizar normal */ }
  highlights = s.highlights || [];
  notes = s.notes || [];
  board = Array.isArray(s.board) ? s.board : [];
  follow = s.follow || { active: false, pos: 0, ts: 0, name: '' };
  if (s.para) roomPara = s.para;
  chat = s.chat || [];
  reactions = s.reactions || [];
  const prevHands = new Set(hands.map((h) => h.name));
  hands = s.hands || [];
  repaintAll();
  renderNotes();
  renderRoster(s.roster || []);
  renderBoard();
  renderFollow();
  renderChat();
  renderReactions();
  renderHands();
  renderSwitchBookBtn();
  renderParaBar();
  checkPara(s);
  checkSwitchTo(s);
  // Avisar al profesor de manos nuevas
  if (isTeacher) {
    hands.forEach((h) => {
      if (!prevHands.has(h.name) && h.name !== displayName().replace(/^🎓 /, '')) {
        toast('✋ ' + capFor(h.color) + h.name + ' levantó la mano');
      }
    });
  }
}

/* ------------------------- pizarra compartida ------------------------- */
/* v85: TODOS los de la sala pueden escribir. Cada entrada queda con el
   nombre y color de su autor; el profesor sale en negro con 🎓. */
let board = [];

function relTime(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 10) return t('relNow');
  const ps = (n) => (n === 1 ? '' : 's');
  if (s < 60) return t('relSecs', { n: s, ps: ps(s) });
  const m = Math.floor(s / 60);
  if (m < 60) return t('relMins', { n: m, ps: ps(m) });
  const h = Math.floor(m / 60);
  if (h < 24) return t('relHours', { n: h, ps: ps(h) });
  const d = Math.floor(h / 24);
  return t('relDays', { n: d, ps: ps(d) });
}

let boardSeenMaxTs = 0; // v87: para animar solo los mensajes nuevos
function renderBoard() {
  const edit = $('boardEdit'), view = $('boardView'), meta = $('boardMeta'), clear = $('boardClear'), send = $('boardSend');
  if (!edit) return;
  // v85: el input es visible para TODOS (no solo el profesor)
  edit.classList.remove('hidden');
  if (send) send.classList.remove('hidden');
  clear.classList.toggle('hidden', !isTeacher || !board.length);
  const entries = Array.isArray(board) ? board : [];
  if (!entries.length) {
    view.innerHTML = '<span class="board-empty">' + t('boardEmpty') + '</span>';
    boardSeenMaxTs = 0;
  } else {
    const firstLoad = boardSeenMaxTs === 0;
    view.innerHTML = entries.map((e) => {
      const col = COLORS[e.color] || COLORS.azul;
      const who = e.color === 'negro' ? '🎓 ' + esc(e.name) : esc(e.name);
      const isNew = !firstLoad && e.ts > boardSeenMaxTs; // v87: animación de entrada
      return `<div class="board-entry${isNew ? ' board-new' : ''}" style="border-left-color:${col}">` +
        `<div class="board-entry-head"><span class="dot" style="background:${col}"></span><b>${who}</b>` +
        `<span class="board-entry-ts">${relTime(e.ts)}</span></div>` +
        `<div class="board-entry-text" style="color:${col}">${esc(e.text)}</div></div>`;
    }).join('');
    boardSeenMaxTs = Math.max(...entries.map((e) => e.ts || 0));
  }
  meta.textContent = entries.length ? t('boardCount', { n: entries.length, ps: entries.length === 1 ? '' : 's' }) : '';
}

/* v85: enviar como entrada discreta (botón o Enter).
   v139: el texto solo se limpia tras confirmar el envío en el servidor;
   si falla la red, el texto se conserva para reintentarlo (señal débil). */
function sendBoard() {
  const edit = $('boardEdit');
  if (!edit) return;
  const text = (edit.value || '').trim();
  if (!text) return;
  // v158: si falla la red, el mensaje se encola y se envía solo al reconectar
  // (como el chat y las marcas). El texto solo se borra tras confirmar.
  netPost(roomBase() + '/board', { text }, (s) => {
    if (s && s.ok && Array.isArray(s.board)) {
      if (edit.value.trim() === text) edit.value = ''; // no borrar un mensaje nuevo
      board = s.board; renderBoard();
    }
  }).then((r) => {
    if (r.queued) toast(t('actQueued'));
    else if (!r.ok) toast(t('boardErr')); // respuesta no válida: el texto se conserva
  });
}

function initBoard() {
  const edit = $('boardEdit'), clear = $('boardClear'), send = $('boardSend');
  if (!edit) return;
  const doSend = () => sendBoard();
  if (send) send.onclick = doSend;
  edit.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
  });
  if (clear) clear.onclick = async () => {
    if (!isTeacher) return;
    if (!confirm(t('boardConfirm'))) return;
    /* v176: el limpiado va por netPost (outbox) como el envío de texto (v158) —
       en señal débil se encola y se ejecuta solo al reconectar */
    const r = await netPost(roomBase() + '/boardClear', {}, (s) => {
      if (s && s.ok) { board = []; renderBoard(); }
    });
    if (r.queued) toast(t('actQueued'));
    else if (!r.ok) toast(t('boardCleanErr'));
  };
  renderBoard();
}

/* ------------------------- 👀 Sígueme ------------------------- */
/* El profesor activa "Sígueme" y la pantalla de todos sigue su scroll. */
let follow = { active: false, pos: 0, ts: 0, name: '' };
let iFollow = false;          // yo (estudiante) estoy siguiendo ahora
let iUnfollowed = false;      // yo dejé de seguir manualmente (no re-activar solo)
let followScrolling = false;  // scroll programático en curso (no cuenta como manual)
let followInitDone = false;

function followPos() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
}

function followScrollTo() {
  if (!iFollow || isTeacher || currentView !== 'room') return;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  if (max <= 0) return;
  const target = Math.round(follow.pos * max);
  if (Math.abs(window.scrollY - target) < 40) return; // ya estoy ahí
  followScrolling = true;
  try { window.scrollTo({ top: target, behavior: 'smooth' }); }
  catch (e) { window.scrollTo(0, target); }
  setTimeout(() => { followScrolling = false; }, 900);
}

function renderFollow() {
  const btn = $('followBtn'), pill = $('followPill');
  if (btn) {
    btn.classList.toggle('hidden', !isTeacher);
    btn.classList.toggle('on', !!follow.active);
    btn.title = follow.active ? t('followOnTip') : t('followOffTip');
  }
  if (isTeacher) { if (pill) pill.classList.add('hidden'); return; }
  if (!follow.active || currentView !== 'room') {
    iFollow = false;
    iUnfollowed = false; // reset: la próxima activación sí sigue
    if (pill) pill.classList.add('hidden');
    return;
  }
  // Solo auto-activo si el usuario no dejó de seguir manualmente
  if (!iFollow && !iUnfollowed) iFollow = true; // el profesor lo activó → empiezo a seguir
  if (pill) {
    pill.classList.remove('hidden');
    // Texto según estado: siguiendo o no
    pill.innerHTML = iFollow ? t('followPillOn') : t('followPillOff');
  }
  followScrollTo();
}

function initFollow() {
  const btn = $('followBtn');
  const pill = $('followPill');
  // Tocar la píldora vuelve a seguir al profesor
  if (pill && !pill.dataset.followBound) {
    pill.dataset.followBound = '1';
    pill.onclick = () => {
      if (follow.active && !iFollow && currentView === 'room') {
        iFollow = true;
        iUnfollowed = false;
        toast(t('followBack'));
        renderFollow();
      }
    };
  }
  if (btn) btn.onclick = () => {
    if (!isTeacher) return;
    const activating = !follow.active;
    const body = activating ? { active: true, pos: followPos() } : { active: false };
    apiPost(roomBase() + '/follow', body)
      .then((s) => {
        if (s && s.ok && s.follow) { follow = s.follow; renderFollow(); }
        if (activating) toast(t('followActivated'));
      })
      .catch(() => toast(t('followErr')));
  };
  if (!followInitDone) {
    followInitDone = true;
    let sendTimer = null;
    window.addEventListener('scroll', () => {
      if (isTeacher) {
        // el profesor reporta su posición (debounce 500ms tras detenerse)
        clearTimeout(sendTimer);
        sendTimer = setTimeout(() => {
          if (isTeacher && follow.active && currentView === 'room') {
            apiPost(roomBase() + '/follow', { active: true, pos: followPos() })
              .then((s) => { if (s && s.ok && s.follow) follow = s.follow; })
              .catch(() => {});
          }
        }, 500);
      } else if (iFollow && !followScrolling && currentView === 'room') {
        // el estudiante se movió por su cuenta → deja de seguir (una sola vez)
        iFollow = false;
        iUnfollowed = true; // no re-activar automáticamente
        toast(t('followLeft'));
        renderFollow();
      }
    }, { passive: true });
  }
  renderFollow();
}

/* ------------------------- 📖 Párrafo de clase (v81) ------------------------- */
/* El profesor (tinta negra 🎓) mueve el párrafo; todos lo ven sincronizado.
   Regla permanente: cada quien escribe con SU color; el profesor SIEMPRE negro. */
let roomPara = { idx: 0, ts: 0 };
let lastParaTs = 0;
/* v168: el aviso "el profesor movió el párrafo" se limita a 1 cada 6s — el
   profesor puede pasar 20 párrafos seguidos y cada toast era distinto
   ("párrafo 3 de 40", "párrafo 4 de 40"…), así que la deduplicación de
   toasts nunca los colapsaba. La barra ya muestra el dato en pantalla. */
let lastParaToastAt = 0;

function paraCount() {
  return document.querySelectorAll('#paras p[data-para]').length;
}
function paraLabel() {
  /* v163: el total viene del meta y es estable; sin meta no se muestra
     número (antes adivinaba con lo pintado y brincaba). */
  if (!(totalParas > 0)) return t('paraDash');
  const i = Math.min(roomPara.idx, totalParas - 1);
  return t('paraOf', { i: i + 1, n: totalParas });
}
function renderParaBar() {
  const bar = $('paraBar');
  if (!bar) return;
  const show = currentView === 'room' && (isTeacher || roomPara.ts > 0);
  bar.classList.toggle('hidden', !show);
  if (!show) return;
  /* v163: límites con el total del meta (estable), no con lo pintado */
  const n = totalParas > 0 ? totalParas : 0;
  const i = n > 0 ? Math.min(roomPara.idx, n - 1) : 0;
  $('paraLabel').textContent = paraLabel();
  const prev = $('paraPrev'), next = $('paraNext');
  if (isTeacher) {
    prev.classList.remove('hidden'); next.classList.remove('hidden');
    prev.disabled = i <= 0; next.disabled = n > 0 && i >= n - 1;
  } else {
    prev.classList.add('hidden'); next.classList.add('hidden');
  }
}
function setRoomPara(idx) {
  if (!isTeacher) return;
  /* v163: el límite es el total del meta (estable); lo que falte se descarga
     solo vía ensureParaRendered en focusPara */
  const n = totalParas > 0 ? totalParas : paraCount();
  idx = Math.max(0, Math.min(n - 1, idx));
  if (idx >= queuePos && queuePos < paraQueue.length) renderMoreParas(null, CHUNK_NEXT); // v146: no frenar al avanzar
  if (idx === roomPara.idx && roomPara.ts > 0) return;
  apiPost(roomBase() + '/para', { idx })
    .then(async (s) => {
      if (s && s.ok && s.para) { roomPara = s.para; lastParaTs = s.para.ts; await focusPara(roomPara.idx, true); renderParaBar(); renderBoardMode(); }
    })
    .catch(() => toast(t('paraErr')));
}
/* Resalta el párrafo actual para todos y lo muestra en modo pizarra */
async function focusPara(idx, smooth) {
  await ensureParaRendered(idx); // v146: pintar hasta el párrafo antes de enfocarlo (v162: descarga si falta)
  document.querySelectorAll('#paras p[data-para]').forEach((p) => {
    p.classList.toggle('para-focus', Number(p.dataset.para) === idx);
  });
  const pEl = document.querySelector('#paras p[data-para="' + idx + '"]');
  if (pEl && !document.body.classList.contains('board-mode-on')) {
    try { pEl.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' }); }
    catch (e) { pEl.scrollIntoView(); }
  }
  renderBoardMode();
}
function checkPara(s) {
  const pa = s && s.para;
  if (!pa || !pa.ts) return;
  if (pa.ts <= lastParaTs) return;
  lastParaTs = pa.ts;
  roomPara = pa;
  renderParaBar();
  focusPara(pa.idx, true).catch(() => {});
  if (!isTeacher) {
    /* v168: toast limitado a 1 cada 6s + pulso visual en la barra (que ya
       muestra "párrafo X de Y" de forma permanente) */
    const now = Date.now();
    if (now - lastParaToastAt >= 6000) {
      lastParaToastAt = now;
      toast(t('paraTeacherMoved') + paraLabel().toLowerCase());
    }
    const bar = $('paraBar');
    if (bar) {
      bar.classList.remove('flash'); void bar.offsetWidth; bar.classList.add('flash');
      setTimeout(() => { try { bar.classList.remove('flash'); } catch (e) {} }, 700);
    }
  }
}
function initParaBar() {
  const prev = $('paraPrev'), next = $('paraNext');
  if (prev) prev.onclick = () => setRoomPara(roomPara.idx - 1);
  if (next) next.onclick = () => setRoomPara(roomPara.idx + 1);
  renderParaBar();
}

/* ------------------------- 🖥️ Modo pizarra (v81) ------------------------- */
/* Vista limpia: SOLO la pizarra blanca, con el párrafo actual grande y claro. */
function renderBoardMode() {
  const panel = $('boardMode');
  if (!panel || !document.body.classList.contains('board-mode-on')) return;
  const n = paraCount();
  const idx = Math.min(roomPara.idx, Math.max(0, n - 1));
  const src = document.querySelector('#paras p[data-para="' + idx + '"]');
  const body = $('boardModeText');
  if (src && body) {
    // Clona el párrafo real: conserva los colores de tinta de cada persona
    body.innerHTML = '';
    const clone = src.cloneNode(true);
    clone.removeAttribute('id');
    body.appendChild(clone);
  }
  $('boardModeLabel').textContent = paraLabel();
  const prev = $('boardModePrev'), next = $('boardModeNext');
  if (prev && next) {
    const tShow = isTeacher;
    prev.classList.toggle('hidden', !tShow);
    next.classList.toggle('hidden', !tShow);
    if (tShow) { prev.disabled = idx <= 0; next.disabled = n > 0 && idx >= n - 1; }
  }
}
function setBoardMode(on) {
  document.body.classList.toggle('board-mode-on', !!on);
  const panel = $('boardMode');
  if (panel) panel.classList.toggle('hidden', !on);
  if (on) { renderBoardMode(); }
  const btn = $('boardModeBtn');
  if (btn) btn.classList.toggle('on', !!on);
}
function initBoardMode() {
  const btn = $('boardModeBtn');
  if (btn) btn.onclick = () => setBoardMode(!document.body.classList.contains('board-mode-on'));
  const exit = $('boardModeExit');
  if (exit) exit.onclick = () => setBoardMode(false);
  const prev = $('boardModePrev'), next = $('boardModeNext');
  if (prev) prev.onclick = () => setRoomPara(roomPara.idx - 1);
  if (next) next.onclick = () => setRoomPara(roomPara.idx + 1);
}

/* ------------------------- 📚 Cambiar libro ------------------------- */
/* El profesor cambia el texto de la sala; los demás lo siguen automáticamente. */
let lastSwitchTs = 0;
function renderSwitchBookBtn() {
  const btn = $('switchBookBtn');
  if (btn) btn.classList.toggle('hidden', !isTeacher || currentView !== 'room');
}
function openSwitchBookModal() {
  if (!isTeacher) return;
  const list = $('switchBookList');
  list.innerHTML = '';
  const books = libBooksCache || [];
  if (!books.length) {
    list.innerHTML = '<p class="join-note">' + t('noBooksYet') + '</p>';
  }
  books.forEach((b) => {
    const isCur = currentBook && currentBook.id === b.id;
    const item = document.createElement('button');
    item.className = 'switchbook-item' + (isCur ? ' current' : '');
    item.innerHTML = `<span class="swb-emoji">📖</span><span><span class="swb-title">${esc(b.title)}</span><br><span class="swb-author creator-link" data-creator="${esc(b.author)}">${esc(b.author)}</span></span>` +
      (isCur ? '<span style="margin-left:auto">✓</span>' : '');
    item.onclick = () => switchToBook(b);
    list.appendChild(item);
  });
  $('switchBookClose').onclick = () => $('switchBookPop').classList.add('hidden');
  $('switchBookPop').classList.remove('hidden');
}
async function switchToBook(b) {
  if (!isTeacher || !b) return;
  $('switchBookPop').classList.add('hidden');
  if (currentBook && currentBook.id === b.id) { toast('Ya están leyendo este libro'); return; }
  const oldRoom = myRoom;
  try {
    await apiPost('/api/rooms/' + encodeURIComponent(oldRoom) + '/switch', { bookId: b.id, title: b.title });
  } catch (e) { /* seguir de todos modos */ }
  lastSwitchTs = Date.now();
  toast('📚 Cambiando a "' + b.title + '"');
  openBook(b.id, false);
}
function initSwitchBook() {
  const btn = $('switchBookBtn');
  if (btn) btn.onclick = openSwitchBookModal;
  renderSwitchBookBtn();
}
/* Si el profesor cambió el libro, seguirlo automáticamente */
function checkSwitchTo(s) {
  const sw = s && s.switchTo;
  if (!sw || !sw.bookId || !sw.ts) return;
  if (sw.ts <= lastSwitchTs) return;
  if (sw.bookId === myRoom) return;
  lastSwitchTs = sw.ts;
  toast(t('paraTeacherBook') + (sw.title || t('otherBook')) + '"');
  openBook(sw.bookId, false);
}

/* ------------------------- 💬 Chat de la sala ------------------------- */
let chat = [];
let chatTab = 'notes'; // 'notes' | 'chat'
let chatSeen = 0;

function renderChat() {
  const box = $('chatBox');
  if (!box) return;
  /* v169: si estás viendo la pestaña del chat, los mensajes que llegan por el
     poll ya los viste — no deben contar como "no leídos" al cambiar de pestaña */
  if (chatTab === 'chat') chatSeen = chat.length;
  const unread = chat.length - chatSeen;
  $('chatCount').textContent = (chatTab !== 'chat' && unread > 0) ? `(${unread})` : '';
  // v158: no arrastrar al final si el lector está viendo mensajes viejos —
  // cada re-render del poll lo devolvía abajo aunque estuviera leyendo arriba.
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  if (!chat.length) {
    box.innerHTML = '<p class="chat-empty-board">' + t('chatEmpty') + '</p>';
    return;
  }
  box.innerHTML = '';
  chat.forEach((m) => {
    const ink = COLORS[m.color] || COLORS.azul;
    const div = document.createElement('div');
    div.className = 'chat-msg' + (m.name === displayName() ? ' mine' : '');
    div.innerHTML =
      `<span class="chat-author" style="color:${ink}"><span class="dot" style="background:${ink}"></span>${capFor(m.color)}${esc(m.name)}<span class="chat-ts">${relTime(m.ts)}</span></span>` +
      `<span class="chat-text" style="color:${ink}">${esc(m.text)}</span>`;
    box.appendChild(div);
  });
  if (nearBottom) box.scrollTop = box.scrollHeight;
}

function setMarginTab(t) {
  chatTab = t;
  $('tabNotes').classList.toggle('on', t === 'notes');
  $('tabChat').classList.toggle('on', t === 'chat');
  $('notes').classList.toggle('hidden', t !== 'notes');
  $('chatPanel').classList.toggle('hidden', t !== 'chat');
  if (t === 'chat') { chatSeen = chat.length; }
  renderChat();
}

function sendChat() {
  const input = $('chatInput');
  const text = (input.value || '').trim();
  if (!text) return;
  input.value = '';
  // v145: si falla la red, el mensaje se encola y se envía solo al reconectar
  netPost(roomBase() + '/chat', { text: text.slice(0, 300) }, (s) => {
    if (s.msg && !chat.some((m) => m.id === s.msg.id)) {
      chat.push(s.msg);
      if (chat.length > 50) chat = chat.slice(-50);
      /* v173: +1 en vez de =chat.length (ver outboxApplyFor): no borrar el
         (N) de mensajes ajenos que llegaron mientras tanto. */
      chatSeen += 1;
      renderChat();
    }
  }).then((r) => {
    if (r.queued) toast(t('actQueued'));
    // v154: si el servidor lo rechaza (4xx), el texto vuelve a la caja (patrón pizarra v139)
    else if (!r.ok) { input.value = text; toast(t('chatErr')); }
  });
}

function initChat() {
  if ($('tabNotes')) $('tabNotes').onclick = () => setMarginTab('notes');
  if ($('tabChat')) $('tabChat').onclick = () => setMarginTab('chat');
  if ($('chatSend')) $('chatSend').onclick = sendChat;
  if ($('chatInput')) $('chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); sendChat(); }
  });
  renderChat();
}

/* ------------------------- 😮 Reacciones ------------------------- */
/* Reacciones rápidas sobre palabras. Solo con lápiz (igual que las marcas). */
let reactions = [];

function renderReactions() {
  document.querySelectorAll('.rx-badge').forEach((b) => b.remove());
  if (!Array.isArray(reactions) || !reactions.length) return;
  const groups = {};
  reactions.forEach((r) => {
    const k = r.start + '|' + r.emoji;
    if (!groups[k]) groups[k] = { start: r.start, emoji: r.emoji, names: [] };
    groups[k].names.push(r.name);
  });
  const me = displayName();
  Object.values(groups).forEach((g) => {
    const sp = spanByIdx[g.start];
    if (!sp || sp.querySelector('.rx-badge')) return;
    const badge = document.createElement('sup');
    badge.className = 'rx-badge' + (g.names.includes(me) ? ' mine' : '');
    badge.textContent = g.emoji + (g.names.length > 1 ? g.names.length : '');
    badge.title = g.names.join(', ');
    badge.onclick = (e) => { e.stopPropagation(); toggleReaction(g.start, g.emoji); };
    sp.appendChild(badge);
  });
}

let rxLastTap = { key: '', at: 0 }; // v177: anti-doble-toque (mismo patrón v168 del marcado)
function toggleReaction(start, emoji) {
  // v177: dos toques rápidos en la insignia alternaban agregar+quitar (cada
  // POST lleva cid distinto y el servidor alterna en cada uno) — el segundo
  // toque dentro de 1s se ignora. Era el único gesto sin esta protección.
  const key = start + ':' + emoji, now = Date.now();
  if (key === rxLastTap.key && now - rxLastTap.at < 1000) return;
  rxLastTap = { key, at: now };
  // v145: si falla la red, la reacción se encola y se envía sola al reconectar
  netPost(roomBase() + '/reaction', { start, emoji }, () => { pollState(); })
    .then((r) => {
      if (r.queued) toast(t('actQueued'));
      else if (!r.ok) toast(t('reactErr'));
    });
}

function initReactions() {
  document.querySelectorAll('#rxRow .rx-btn').forEach((b) => {
    b.onclick = () => {
      if (!pendingRange) { hideNotepop(); return; }
      const start = pendingRange.start;
      hideNotepop();
      window.getSelection().removeAllRanges();
      pendingRange = null;
      toggleReaction(start, b.dataset.emoji);
    };
  });
}

/* ------------------------- ✋ Levantar la mano ------------------------- */
let hands = [];

function myHandUp() {
  const me = displayName().replace(/^🎓 /, '');
  return hands.some((h) => h.name === me);
}

function renderHands() {
  const btn = $('handBtn');
  if (btn) {
    const show = !isTeacher && currentView === 'room';
    btn.classList.toggle('hidden', !show);
    btn.classList.toggle('on', myHandUp());
    btn.title = myHandUp() ? t('handUp') : t('handDown');
  }
}

function initHands() {
  const btn = $('handBtn');
  if (btn) btn.onclick = async () => {
    const up = !myHandUp();
    /* v176: la mano va por netPost (outbox) — en señal débil se encola y se
       envía sola al reconectar en vez de perderse con un toast. El servidor
       es idempotente (levantar dos veces = una; bajar dos veces = una). */
    const r = await netPost(roomBase() + '/hand', { up }, (s) => {
      if (s && s.ok) { hands = s.hands || []; renderHands(); renderRoster(); }
    });
    if (r.ok) { toast(up ? t('handRaised') : t('handLowered')); setOnline(true); } // v127: solo confirmar lo que el servidor aceptó
    else if (r.queued) toast(t('actQueued'));
    else toast(t('handErr'));
  };
}

/* La presencia muestra ✋ en quien tenga la mano levantada.
   El profesor toca el chip para bajarla. */
function paintHandsInRoster() {
  const box = $('presence');
  if (!box || !Array.isArray(hands)) return;
  const handNames = new Set(hands.map((h) => h.name));
  box.querySelectorAll('.chip').forEach((chip) => {
    const name = (chip.dataset.name || '').replace(/^🎓 /, '');
    if (handNames.has(name)) {
      chip.classList.add('hand-up');
      if (!chip.querySelector('.hand-ico')) {
        const ico = document.createElement('span');
        ico.className = 'hand-ico';
        ico.textContent = '✋';
        chip.prepend(ico);
      }
      if (isTeacher) {
        chip.style.cursor = 'pointer';
        chip.title = t('handLower') + name;
        chip.onclick = async () => {
          /* v176: por netPost (outbox) — en señal débil se encola y reintenta solo */
          const r = await netPost(roomBase() + '/hand', { up: false, target: name }, (s) => {
            if (s && s.ok) { hands = s.hands || []; renderHands(); renderRoster(); }
          });
          if (r.queued) toast(t('actQueued'));
          else if (!r.ok) toast(t('handLowerErr')); // v174: clave i18n (antes español hardcodeado)
        };
      }
    }
  });
}

/* v127: guardia anti-apilamiento — en señal débil un poll puede tardar hasta 10s;
   sin esto los polls se enciman y un estado viejo puede "resucitar" una marca
   recién deshecha (applyState reemplaza todo). */
let pollInFlight = false;
async function pollState() {
  if (pollInFlight) return;
  pollInFlight = true;
  try {
    const r = await fetchTimeout(roomBase() + '/state', 10000, { cache: 'no-store' });
    if (!r.ok) throw new Error('http ' + r.status);
    applyState(await r.json());
    if (!netOnline) clog('red: en línea');
    setOnline(true);
    flushOutbox(); // v145: reintentar gestos encolados en señal débil (sin await: tiene su propio guardia)
  } catch (e) {
    if (netOnline) clog('red: sin conexión, reintentando…');
    setOnline(false);
  } finally {
    pollInFlight = false;
  }
}

/* v175 — marca provisional ("guardando…"): en señal débil el POST /highlight
   puede tardar segundos y el usuario cree que el gesto se perdió (y lo repite).
   Al publicar, el rango se pinta al instante con tinta clara + borde punteado
   (SIN animación: nada se mueve solo) hasta que el servidor confirma la marca
   real, el gesto queda encolado o falla. Puramente visual: no entra en
   `cover` ni en `highlights` hasta la confirmación. */
let pendingMarks = []; // {start, end, color}
function paintPendingVisual(p) {
  const base = COLORS[p.color] || COLORS.azul;
  for (let i = p.start; i <= p.end; i++) {
    const s = spanByIdx[i];
    if (!s || s.classList.contains('mk')) continue; // la marca real manda
    s.classList.add('mk-pending');
    s.style.setProperty('--pend-c', base);
    s.style.background = hexA(base, 0.16);
  }
}
function paintPendingMark(r, color) {
  const p = { start: r.start, end: r.end, color };
  pendingMarks.push(p);
  paintPendingVisual(p);
}
function pendingAt(i) {
  return pendingMarks.some((p) => i >= p.start && i <= p.end);
}
function clearPendingMark(start, end) {
  pendingMarks = pendingMarks.filter((p) => !(p.start === start && p.end === end));
  for (let i = start; i <= end; i++) {
    const s = spanByIdx[i];
    if (!s) continue;
    s.classList.remove('mk-pending');
    s.style.setProperty('--pend-c', '');
    // no pisar la tinta de una marca real ni de otro provisional que se solape
    if (!s.classList.contains('mk') && !pendingAt(i)) s.style.background = '';
  }
}
function clearAllPendingMarks() {
  pendingMarks = [];
  spanByIdx.forEach((s) => {
    if (!s) return;
    s.classList.remove('mk-pending');
    s.style.setProperty('--pend-c', '');
    if (!s.classList.contains('mk')) s.style.background = '';
  });
}
/* v177: tras entrar a un libro, repintar las marcas encoladas que sobrevivieron
   a una recarga (initOutbox las restaura pero nada las pintaba: el usuario las
   creía perdidas y repetía el gesto). Los trozos que aún no bajaron se pintan
   solos al cargar (renderMoreParas -> repaintAll -> pendingMarks). También
   ofrece deshacerlas con la píldora (se oculta sola a los 6s, como siempre). */
function repaintQueuedMarks() {
  if (!outbox.length || !spanByIdx.length) return;
  let n = 0;
  for (const it of outbox) {
    if (it.kind !== 'highlight' || it.room !== myRoom) continue;
    const b = it.body || {};
    if (typeof b.start !== 'number' || typeof b.end !== 'number') continue;
    paintPendingMark({ start: b.start, end: b.end }, it.color || 'azul');
    if (b.cid) {
      undoStack.push({ q: b.cid, start: b.start, end: b.end });
      if (undoStack.length > 5) undoStack.shift();
      n++;
    }
  }
  if (n) renderUndoPill();
}
/* Publica un subrayado. v145: si falla la red, el gesto se encola y se reintenta
   solo al reconectar (outbox) — ya no se pierde con solo un toast.
   v175: pinta la marca provisional al instante — se ve aunque el POST tarde. */
async function postHighlight(range) {
  paintPendingMark(range, myColor);
  const r = await netPost(roomBase() + '/highlight', range, (s) => {
    if (s.highlight && !highlights.some((h) => h.id === s.highlight.id)) {
      highlights.push(s.highlight);
      paintHighlight(s.highlight);
      showUndoPill(s.highlight.id); // v118: deshacer la última marca (toques accidentales en móvil)
    }
    // v175: el servidor confirmó (o devolvió la marca ya existente por dedupe
    // v156) — se retira lo provisional y queda la tinta real
    if (s.highlight) clearPendingMark(s.highlight.start, s.highlight.end);
  }, { color: myColor }); // v177: el color viaja solo-local en la cola (no al servidor)
  if (r.queued) {
    toast(t('actQueued')); // lo provisional sigue visible hasta que se envíe al reconectar
    showUndoPill({ q: r.cid, start: range.start, end: range.end }); // v177: se puede cancelar lo encolado
  }
  else if (!r.ok) { clearPendingMark(range.start, range.end); toast(t('hlSaveErr')); }
  return r.ok;
}

/* v121: píldora "↩ Deshacer" con pila — tras marcar, cada toque deshace UNA marca
   más (hasta 5 recientes). Vive 6s y el temporizador se refresca con cada marca
   nueva. Si el id ya no existe (se borró con otro gesto), se descarta en silencio. */
let undoPillEl = null, undoPillTimer = null, undoStack = [];
function showUndoPill(hlId) {
  // v177: la entrada puede ser un id confirmado {id} o una marca aún encolada
  // {q: cid, start, end} (sin id en el servidor: se cancela de la cola local)
  undoStack.push(typeof hlId === 'object' ? hlId : { id: hlId });
  if (undoStack.length > 5) undoStack.shift();
  renderUndoPill();
}
function renderUndoPill() {
  hideUndoPillEl();
  if (!undoStack.length) return;
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'undo-pill';
  el.textContent = undoStack.length > 1 ? t('undoMarkN', { n: undoStack.length }) : t('undoMark');
  el.onclick = async () => {
    const e = undoStack.pop();
    if (e && e.q) {
      /* v177: cancelar una marca AÚN ENCOLADA — no existe en el servidor, solo
         se saca de la cola local y se limpia su tinta provisional. */
      const ix = outbox.findIndex((it) => it.kind === 'highlight' && it.body && it.body.cid === e.q);
      if (ix >= 0) { outbox.splice(ix, 1); persistOutbox(); }
      clearPendingMark(e.start, e.end);
      if (navigator.vibrate) navigator.vibrate(15);
      toast(t('markUndone'));
      renderUndoPill(); // sigue ofreciendo deshacer las anteriores, o se oculta
      return;
    }
    const id = e && e.id;
    /* v174: el borrado va por netPost (outbox) — en señal débil se encola y
       se reintenta solo al reconectar en vez de perderse con un toast de error.
       404 = el id ya se borró con otro gesto: confirmar en silencio. */
    const r = await netPost(roomBase() + '/del', { kind: 'highlight', id }, null);
    if (navigator.vibrate) navigator.vibrate(15);
    if (r.ok || r.queued || r.status === 404) {
      highlights = highlights.filter((h) => h.id !== id);
      repaintAll();
      toast(r.queued ? t('actQueued') : t('markUndone'));
    } else {
      // error HTTP real (no reintentable): devolver el intento a la pila y avisar
      undoStack.push({ id });
      toast(t('hlDelErr'));
    }
    renderUndoPill(); // sigue ofreciendo deshacer las anteriores, o se oculta
  };
  document.body.appendChild(el);
  undoPillEl = el;
  undoPillTimer = setTimeout(() => { undoStack = []; hideUndoPillEl(); }, 6000);
}
function hideUndoPillEl() {
  clearTimeout(undoPillTimer);
  undoPillTimer = null;
  if (undoPillEl) { undoPillEl.remove(); undoPillEl = null; }
}
function hideUndoPill() { undoStack = []; hideUndoPillEl(); }

/* Borra mis subrayados que se solapen con el rango dado */
async function eraseInRange(range) {
  const mine = highlights.filter((h) =>
    h.name === displayName() && h.start <= range.end && h.end >= range.start);
  if (!mine.length) return;
  clog('borrador: borrando ' + mine.length + ' marca(s)');
  const deletedIds = new Set(), queuedIds = new Set();
  // v156: borrados en paralelo — antes en serie, con red caída un párrafo con
  // N marcas propias tardaba N×15s sin feedback antes del toast de error.
  // v174: por netPost — en señal débil se encolan y se reintentan solos al
  // reconectar en vez de perderse; 404 = ya borrado (éxito).
  await Promise.all(mine.map(async (h) => {
    const r = await netPost(roomBase() + '/del', { kind: 'highlight', id: h.id }, null);
    if (r.queued) queuedIds.add(h.id);
    else if (r.ok || r.status === 404) deletedIds.add(h.id);
  }));
  const doneIds = new Set([...deletedIds, ...queuedIds]);
  if (doneIds.size) {
    highlights = highlights.filter((h) => !doneIds.has(h.id));
    repaintAll();
    toast(queuedIds.size ? t('actQueued')
      : doneIds.size === 1 ? t('markErased') : t('marksErased', { n: doneIds.size }));
  } else {
    toast(t('hlDelErr'));
  }
  // netPost ya gestionó el estado de red de cada intento; aquí solo el
  // veredicto final: verde si algo se confirmó, rojo solo si todo quedó encolado
  if (deletedIds.size) setOnline(true);
  else if (queuedIds.size) setOnline(false);
}

let netInitDone = false;
function initNet() {
  if (!netInitDone) {
    netInitDone = true;
    setInterval(() => { if (!document.hidden && currentView === 'room') pollState(); }, 2500); // novedades de los demás (pausado si la pestaña está oculta o fuera de la sala)
    // v158: se eliminó el ping de presencia de 15s — el latido de párrafo de
    // 8s ya mantiene la presencia viva; era un POST redundante en señal débil.
    // v68: latido de párrafo visible (cada 8s) para la presencia viva 👁
    setInterval(() => {
      if (document.hidden || currentView !== 'room') return;
      try { apiPost(roomBase() + '/ping', { para: currentParaIdx() }).catch(() => {}); } catch (e) {}
    }, 8000);
    $('copyRoom').onclick = async () => {
      // v72: comparte el enlace completo (?sala=CODIGO) en vez de solo el código:
      // quien lo toca entra directo a la sala (patrón de compartido tipo Wattpad).
      const link = location.origin + '/?sala=' + encodeURIComponent(myRoom);
      try {
        await navigator.clipboard.writeText(link);
        toast(t('roomLinkCopied'));
      } catch (e) {
        toast(t('roomLinkManual') + link); // el lector lo puede dictar o escribir
      }
      clog('enlace copiado/mostrado: ' + link);
    };
    // v94: 🚪 Salir explícito — único que cierra la sesión de la sala
    const erb = $('exitRoomBtn');
    if (erb && !erb.dataset.wired) { erb.dataset.wired = '1'; erb.onclick = exitRoom; }
  }
  joinRoom();
}
/* Entrar (o re-entrar) a la sala actual: registra presencia y trae el estado */
function joinRoom() {
  boardSeenMaxTs = 0; // v87: resetear animación de pizarra al entrar a la sala
  /* v173: el contador de chat visto es por sala — sin esto heredaba el valor
     de la sala anterior y los mensajes previos nunca mostraban su (N). */
  chatSeen = 0;
  lastParaEyesSig = ''; // v173: forzar re-pintado de presencia en la sala nueva
  apiPost(roomBase() + '/join', {})
    .then((s) => {
      if (s.room) { myRoom = s.room; updateRoomLabel(); }
      // v83: el servidor verifica color y rol (anti-suplantación de profesor)
      if (s.you) {
        if (s.you.color && s.you.color !== myColor) {
          myColor = s.you.color;
          localStorage.setItem('tj_color', myColor);
          if (typeof buildSwatches === 'function') buildSwatches();
        }
        const serverTeacher = !!s.you.isTeacher;
        if (isTeacher && !serverTeacher) {
          // Otro reclamó el negro primero: degradar a estudiante en esta sala
          isTeacher = false;
          try { localStorage.setItem('tj_teacher', '0'); } catch (e) {}
          if (typeof buildSwatches === 'function') buildSwatches();
          toast(t('joinTeacherExists'));
        } else if (!isTeacher && serverTeacher) {
          isTeacher = true;
          try { localStorage.setItem('tj_teacher', '1'); } catch (e) {}
        }
      }
      /* v169: sincronizar en silencio el párrafo del profesor ANTES de
         applyState — en carga fresca lastParaTs=0 y un para guardado de una
         sesión anterior disparaba toast + auto-scroll por un movimiento
         pasado. La barra sigue mostrando dónde está el profesor; el toast
         solo salta por movimientos nuevos mientras estás dentro. */
      if (s.para && s.para.ts) { lastParaTs = s.para.ts; roomPara = s.para; }
      applyState(s);
      setOnline(true);
      clog('red: dentro de ' + myRoom);    })
    .catch(() => { setOnline(false); toast(t('enterErr')); });
  pollState();
}
function updateRoomLabel() {
  // Indicador de QUÉ se está leyendo: 📝 libro de creador · 📜 clásico gratis · 📄 muestra
  const typeBadge = readingType === 'classic' ? t('tileClassic')
    : readingType === 'book' ? t('tileCreatorBook')
    : t('tileSample');
  if (currentBook) {
    $('roomLabel').innerHTML = esc(currentBook.title) + typeBadge;
    $('backBtn').classList.remove('hidden');
    $('copyRoom').classList.add('hidden');
  } else {
    let code = $('roomCode');
    if (!code) {
      $('roomLabel').innerHTML = t('roomName') + ' <b id="roomCode">' + esc(myRoom || '····') + '</b>' + typeBadge;
      code = $('roomCode');
    } else {
      $('roomLabel').innerHTML = t('roomName') + ' <b id="roomCode">' + esc(myRoom) + '</b>' + typeBadge;
    }
    $('backBtn').classList.remove('hidden'); // ← siempre visible en la sala: vuelve sin perder tu nombre/color
    $('copyRoom').classList.remove('hidden');
  }
}

/* ------------------------------ boot -------------------------------- */
let selInitDone = false;
let readingType = 'sample'; // 'sample' | 'book' | 'classic': qué se está leyendo
/* v148: limpia todo rastro de texto/párrafos de la sala (regla permanente:
   la sala con código es SOLO pizarra + chat, sin historia). */
function clearRoomText() {
  const paras = $('paras');
  if (chunkObs) { try { chunkObs.disconnect(); } catch (e) {} chunkObs = null; }
  chunkSentinel = null;
  if (paras) paras.innerHTML = '';
  spanByIdx.length = 0;
  cover.clear();
  highlights = [];
  notes = [];
  pendingMarks = []; // v175: sin texto no hay tinta provisional
  paraQueue = []; queuePos = 0; wordBase = 0; totalParas = 0; wordCount = 0;
  bookParaTotal = 0; bookParaLoading = null; // v162: sin libro no hay rangos pendientes
  bookParaFailAt = 0; // v168: sin libro no hay cooldown de rangos
  const ct = $('chapterTitle'); if (ct) ct.textContent = '';
  const bl = $('bookLine'); if (bl) bl.textContent = '';
  const sn = $('sampleNote'); if (sn) sn.textContent = '';
  renderNotes();
}
async function boot() {
  clog('boot: entrando a la sala ' + myRoom + ', UA=' + navigator.userAgent.slice(0, 80));
  currentBook = null;
  readingType = 'sample';
  document.body.classList.remove('book-room'); // v124: sala con código = solo pizarra (v107); el texto vive en las salas de libros
  updateRoomLabel();
  clearRoomText(); // v148: en sala nueva/código NO se descarga ni pinta ningún párrafo ni historia
  if (!selInitDone) { selInitDone = true; initSelection(); }
  initNet();
}
/* Entrar a leer un libro: mismo lector, texto del libro, marcas propias del libro.
   v162: recibe el META (pequeño); los párrafos llegan por rangos desde
   /api/books/:id/paras para que el libro abra hasta en señal débil. */
async function bootBook(meta, push) {
  // v172: la píldora "↩ Deshacer" no sobrevive al cambiar de libro — su id
  // pertenece a la sala anterior y el /del iría a la sala nueva (404 que se
  // "confirmaba" en silencio sin borrar la marca vieja). Tampoco se hereda
  // el párrafo del profesor del libro anterior.
  hideUndoPill();
  clearAllPendingMarks(); // v175: lo provisional es de la sala anterior
  lastParaTs = 0; roomPara = { idx: 0, ts: 0 };
  lastRoster = []; // v174: la presencia no se hereda del libro anterior
  myRoom = meta.id; // el id del libro ES su sala de marcas
  currentBook = meta;
  readingType = meta.classic ? 'classic' : 'book';
  document.body.classList.add('book-room'); // v124: en la sala del libro el texto SIEMPRE se muestra (fix "libros vacíos")
  localStorage.setItem('tj_room', myRoom);
  try {

    localStorage.setItem('tj_lastBook', meta.id); // v94: último libro abierto
  } catch (e) {}
  setViewState('room', push);
  updateRoomLabel();
  const ch = (meta.chapters && meta.chapters[0]) || { title: '', paragraphs: 0, images: [] };
  bookParaTotal = ch.paragraphs || 0; // v162: el N total viene del meta
  bookParaFailAt = 0; // v168: libro nuevo — sin cooldown heredado del anterior
  const kindNote = meta.classic
    ? t('classicInfo')
    : meta.price > 0 ? t('bookBoughtInfo') : t('bookFreeInfo');
  // La cáscara del lector se pinta de inmediato (título, lista vacía); el
  // texto llega por rangos y se agrega a la cola existente.
  renderText([], ch.title, meta.title + ' — ' + meta.author, kindNote, ch.images || []);
  totalParas = bookParaTotal;
  // v69: el nombre del creador es tocable (abre su perfil knowledge panel)
  $('bookLine').innerHTML = `${esc(meta.title)} — <span class="creator-link" data-creator="${esc(meta.author)}">${esc(meta.author)}</span>`;
  if (!selInitDone) { selInitDone = true; initSelection(); }
  $('library').classList.add('hidden');
  $('join').classList.add('hidden');
  window.scrollTo(0, 0);
  initNet();
  // v162: primer rango de párrafos — con esto el libro ya se lee; el resto
  // baja solo al hacer scroll (paintMoreOrFetch).
  try {
    const n = await loadMoreBookParas(PARA_FIRST);
    if (n > 0) renderMoreParas(null, CHUNK_FIRST);
    /* v163: sin aviso aquí — loadMoreBookParas avisa una sola vez al final */
  } catch (e) {}
  dismissToast(t('openingBook')); // v163: el libro abrió, fuera el aviso
  setupChunkObserver();
  clog('libro abierto: ' + meta.title + ' (meta+paginado), párrafos=' + bookParaTotal);
  restoreProgress(meta.id);
  renderCreatorStats(meta);
  repaintQueuedMarks(); // v177: gestos encolados que sobrevivieron a una recarga
}

/* ---------------- navegación con History API ----------------
   Cada vista principal deja una entrada en el historial: el botón
   "atrás" del sistema vuelve a la vista anterior en vez de salirse.
   El nombre/color/modo profesor viven en localStorage, no se pierden. */
let currentView = 'library';
function setViewState(view, push) {
  if (push !== false && view && view !== currentView) {
    const st = { tjview: view };
    if (view === 'room') { st.room = myRoom; st.bookId = currentBook ? currentBook.id : null; }
    try { history.pushState(st, ''); } catch (e) {}
  }
  if (view) {
    currentView = view;
    // Rediseño sala: marca en el body + transición de entrada al entrar
    document.body.classList.toggle('in-room', view === 'room');
    if (view === 'room') {
      ['.room-head', 'main.layout'].forEach((sel) => {
        const el = document.querySelector(sel);
        if (el) { el.classList.remove('room-enter'); void el.offsetWidth; el.classList.add('room-enter'); }
      });
    }
  }
}
function hideOverlays() {
  ['library', 'join', 'writing'].forEach((id) => { const el = $(id); if (el) el.classList.add('hidden'); });
  window.scrollTo(0, 0);
}
/* Volver a entrar a la sala al navegar con atrás/adelante del sistema */
function reenterRoom(st) {
  hideOverlays();
  closeDrawer();
  if (st && st.bookId) { openBook(st.bookId, false); return; }
  myRoom = (st && st.room) || localStorage.getItem('tj_room') || '';
  myName = localStorage.getItem('tj_name') || myName || t('joinDefaultName'); // nombre plano: el 🎓 se pinta por color
  currentBook = null;
  updateRoomLabel();
  boot();
}
/* v94: Salir explícito de la sala — único que borra la sesión.
   Sin esto, una recarga auto-reentra a la sala (nada se pierde). */
function exitRoom() {
  try {
    localStorage.removeItem('tj_inRoom');
    localStorage.removeItem('tj_lastBook');
  } catch (e) {}
  hideUndoPill(); // la pila de deshacer no sobrevive el cambio de sala
  clearAllPendingMarks(); // v175: la tinta provisional tampoco sobrevive el cambio de sala
  /* v169: resetear la referencia del párrafo del profesor al salir — cada
     entrada a una sala parte de cero y solo los movimientos nuevos avisan */
  lastParaTs = 0; roomPara = { idx: 0, ts: 0 };
  lastRoster = []; // v174: la presencia no se hereda de la sala anterior
  toast(t('exitedRoom'));
  showLibrary(true);
}
/* v104: auto-rejoin DESACTIVADO — al entrar siempre se muestra la biblioteca.
   El usuario entra a la sala solo poniendo el código en el footer. */
function showViewByName(view, st) {
  if (view === 'writing') showWriting(false);
  else if (view === 'join') goLiveRoom();
  else if (view === 'room') reenterRoom(st);
  else showLibrary(false);
}
/* Botón ← de la sala: usa el historial; si no hay a dónde ir, biblioteca */
function goBack() {
  try {
    if (window.history.length > 1) window.history.back();
    else showLibrary(true);
  } catch (e) { showLibrary(true); }
}
window.addEventListener('popstate', (e) => {
  const imm = $('immersive');
  if (imm && !imm.classList.contains('hidden')) {
    // atrás con la inmersiva abierta: primero se cierra ella
    closeImmersive();
    try { history.pushState({ tjview: currentView }, ''); } catch (err) {}
    return;
  }
  const st = (e.state && e.state.tjview) ? e.state : { tjview: 'library' };
  currentView = st.tjview; // las funciones showX no deben pushear de nuevo
  showViewByName(st.tjview, st);
});

/* ------------------------------- biblioteca ---------------------------- */
let currentBook = null;
const fmtPrice = (cents) => '$' + (cents / 100).toFixed(2); // usado para anuncios y destacados

function syncNameFromLib() {
  const v = $('libNameInput').value.trim().slice(0, 24);
  if (v) { myName = v; localStorage.setItem('tj_name', myName); }
  else if (!myName || myName === t('joinDefaultName')) { myName = t('joinDefaultName'); }
  return myName;
}

/* Solo anuncios REALES: los pagados vigentes + Best Offer. Nada de relleno. */
const AD_BADGE_LABEL = { 'mas-vendido': t('adBadgeBest'), 'famoso': '⭐ Famoso' };
/* Afiliados: recomendados por TintaJunta. Prototipo: los links reales van aquí al activar cuentas de afiliado. */
const AFFILIATES = [
  { emoji: '🎧', img: 'img/ads/beats.jpg', name: 'Beats Solo 4 · Matte Black', descKey: 'affDescBeats', store: 'Amazon', price: '', hue: 270, url: 'https://www.amazon.com/dp/B0CZPLV566?tag=lenynalopez-20' },
  { emoji: '📱', img: 'img/ads/moto-g15.jpg', name: 'Motorola Moto G15 · 4/256 GB', descKey: 'affDescMotoG15', store: 'Amazon', price: '', hue: 210, url: 'https://www.amazon.com/dp/B0DTC17BX1?tag=lenynalopez-20' },
  { emoji: '📱', img: 'img/ads/moto-g56.jpg', name: 'Motorola Moto G56 5G · 8/256 GB', descKey: 'affDescMotoG56', store: 'Amazon', price: '', hue: 160, url: 'https://www.amazon.com/dp/B0F7RHZ9Q4?tag=lenynalopez-20' },
  { emoji: '🎧', img: 'img/ads/pixel-buds.jpg', name: 'Google Pixel Buds Pro 2 · Porcelain', descKey: 'affDescPixelBuds', store: 'Amazon', price: '', hue: 200, url: 'https://www.amazon.com/dp/B0D79QF9RC?tag=lenynalopez-20' },
];
function renderAffiliates() {
  const row = document.getElementById('rowAff');
  if (!row) return;
  row.innerHTML = '';
  AFFILIATES.forEach((a) => {
    const card = document.createElement('div');
    card.className = 'aff-card';
    card.innerHTML =
      `<div class="aff-photo">` +
        (a.img ? `<img src="${esc(a.img)}" alt="${esc(a.name)}" loading="lazy" decoding="async" onerror="this.remove()">` : '') +
        `<span class="aff-emoji">${esc(a.emoji)}</span>` +
        (a.price ? `<div class="aff-price">${esc(a.price)}</div>` : '') +
      `</div>` +
      `<div class="aff-badge">🔗 ${esc(a.store)}</div>` +
      `<div class="aff-name">${esc(a.name)}</div>` +
      `<div class="aff-desc">${esc(t(a.descKey))}</div>` +
      `<button class="aff-cta" type="button">${esc(t('adAffCta'))}</button>`;
    card.onclick = () => {
      if (a.url) window.open(a.url, '_blank', 'noopener');
      else toast(t('adAffNoCfg'));
    };
    row.appendChild(card);
  });
}
let paidAds = [];
let lastFeat = [];
function adCardVisual(emoji, hue, img) {
  // Fondo editorial sobrio para anuncios; foto real si hay (con emoji como respaldo)
  const palettes = [
    ['#2b3a4a', '#1e3a5f'], ['#3a3a3a', '#1a1a1a'], ['#6e5a2e', '#8a5a1e'],
    ['#3d4a3d', '#2c362c'], ['#4a4a5a', '#282832'], ['#5a4a3a', '#33291f'],
  ];
  const [c1, c2] = palettes[Math.abs(hue || 0) % palettes.length];
  const photo = img ? `<img class="ad-photo" src="${esc(img)}" alt="" loading="lazy" onerror="this.remove()">` : '';
  return `<div class="ad-visual" style="background:linear-gradient(150deg,${c1},${c2})">${photo}<span>${esc(emoji)}</span></div>`;
}
async function renderAds() {
  const row = document.getElementById('rowAds');
  if (!row) return;
  // anuncios pagados vigentes desde el servidor
  try {
    const r = await fetch('/api/ads');
    const d = await r.json();
    paidAds = (d.ads || []);
  } catch { paidAds = []; }
  row.innerHTML = '';
  const tiles = [];
  // 0. Best Offer: la comunidad de Alejandro (logo real, solo en su espacio)
  const bo = document.createElement('div');
  bo.className = 'tile';
  bo.innerHTML =
    `<div class="tile-cover"><img src="img/best-offer-logo.jpg" alt="Best Offer" loading="lazy" decoding="async"></div>` +
    `<div class="tile-title">Best Offer</div>` +
    `<div class="tile-sub">${t('adCommunity')} · 8,400+ miembros</div>`;
  bo.onclick = () => showImmersiveBestOffer();
  tiles.push(bo);
  // 1. pagados primero (sin duplicados por id)
  const seenIds = new Set(['BESTOFFER']);
  paidAds.forEach((a) => {
    if (!a || !a.id || seenIds.has(a.id)) return;
    seenIds.add(a.id);
    const mine = a.advertiser === displayName();
    const t = document.createElement('div');
    t.className = 'tile';
    const adVisual = a.photoUrl
      ? `<div class="tile-cover"><img src="${esc(a.photoUrl)}" alt="${esc(a.name)}" loading="lazy"></div>`
      : `<div class="tile-cover" style="background:linear-gradient(150deg,hsl(200,55%,45%),hsl(230,50%,30%))">` +
        `<div style="font-size:44px;text-align:center;position:relative">${esc(a.emoji)}</div></div>`;
    t.innerHTML =
      adVisual +
      `<div class="tile-title">${esc(a.name)}</div>` +
      `<div class="tile-sub">${AD_BADGE_LABEL[a.badge] || ''} · ⏳ ${a.daysLeft}d${mine ? ' · <u>renovar</u>' : ''}</div>`;
    t.onclick = (e) => {
      // si es mío y toco "renovar", abrir renovación; si no, vista inmersiva
      if (mine && e.target.tagName === 'U') { e.stopPropagation(); showAdModal(a); return; }
      showImmersiveAd(a, true);
    };
    tiles.push(t);
  });
  if (!tiles.length) row.innerHTML = '<p class="hrow-empty">' + t('adNone') + '</p>';
  else tiles.forEach((t) => row.appendChild(t));
  renderHero(lastFeat); // incluir anuncios pagados en el carrusel
}
/* ---------- anuncios pagados (cliente) ---------- */
const AD_EMOJI_LIST = ['👓','🎧','💡','📱','💻','🪑','☕','📖','🔦','🎒','⌚','🧴'];
let adPending = null; // {id} si es renovación, null si es nuevo
let adEmoji = AD_EMOJI_LIST[0];
let adPlan = 'week';
async function showAdModal(existing) {
  syncNameFromLib();
  adPending = existing ? { id: existing.id } : null;
  $('adName').value = existing ? existing.name : '';
  $('adUrl').value = existing ? (existing.url || '') : '';
  const adPhotoInput = $('adPhoto');
  if (adPhotoInput) adPhotoInput.value = '';
  adEmoji = (existing && AD_EMOJI_LIST.includes(existing.emoji)) ? existing.emoji : AD_EMOJI_LIST[0];
  adPlan = 'week';
  // selector de emojis
  const box = $('adEmojis');
  box.innerHTML = '';
  AD_EMOJI_LIST.forEach((em) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch emoji-swatch' + (em === adEmoji ? ' sel' : '');
    b.textContent = em;
    b.style.fontSize = '24px';
    b.onclick = () => {
      adEmoji = em;
      box.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('sel', s.textContent === em));
    };
    box.appendChild(b);
  });
  // precios del servidor
  let prices = { day: 199, week: 799, month: 1999 };
  try {
    const r = await fetch('/api/ad-prices');
    const d = await r.json();
    if (d.ok && d.prices) prices = d.prices;
  } catch { /* valores por defecto */ }
  const plans = $('adPlans');
  plans.innerHTML = '';
  [['day', t('planDay'), prices.day], ['week', t('planWeek'), prices.week], ['month', t('planMonth'), prices.month]].forEach(([key, label, cents]) => {
    const row = document.createElement('label');
    row.className = 'plan-row' + (key === adPlan ? ' sel' : '');
    row.innerHTML = `<input type="radio" name="aplan" value="${key}" ${key === adPlan ? 'checked' : ''}>` +
      `<span><b>${label}</b> — ${fmtPrice(cents)}</span>`;
    row.querySelector('input').onchange = () => {
      adPlan = key;
      plans.querySelectorAll('.plan-row').forEach((el) => el.classList.remove('sel'));
      row.classList.add('sel');
    };
    plans.appendChild(row);
  });
  document.querySelectorAll('input[name="abadge"]').forEach((r) => {
    r.checked = existing ? r.value === existing.badge : r.value === 'mas-vendido';
  });
  $('adPop').classList.remove('hidden');
}
async function initAds() {
  $('advertiseBtn').onclick = () => showAdModal(null);
  $('adCancel').onclick = () => { $('adPop').classList.add('hidden'); adPending = null; };
  $('adConfirm').onclick = async () => {
    const name = $('adName').value.trim().slice(0, 60);
    if (!name && !adPending) { toast(t('adNeedName')); return; }
    let adUrl = ($('adUrl').value || '').trim().slice(0, 300);
    if (adUrl && !/^https?:\/\//i.test(adUrl)) adUrl = 'https://' + adUrl;
    const badge = (document.querySelector('input[name="abadge"]:checked') || {}).value || 'mas-vendido';
    syncNameFromLib();
    const adv = displayName();
    if (!adv || adv === t('joinDefaultName')) { toast(t('adNeedUser')); return; }
    // Validar la foto ANTES de cobrar (tras ir a Stripe el archivo ya no estará disponible)
    const photoFile = ($('adPhoto') && $('adPhoto').files[0]) || null;
    if (photoFile) {
      const okType = ['image/jpeg', 'image/png', 'image/webp'].includes(photoFile.type);
      if (!okType) { toast(t('pubPhotoType')); return; }
      if (photoFile.size > 2 * 1024 * 1024) { toast(t('pubPhotoSize')); return; }
      try {
        const dataUrl = await new Promise((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result); fr.onerror = rej;
          fr.readAsDataURL(photoFile);
        });
        sessionStorage.setItem('tj_pending_photo', dataUrl);
      } catch (e) { /* sin foto: el anuncio se crea igual */ }
    } else {
      try { sessionStorage.removeItem('tj_pending_photo'); } catch (e) {}
    }
    $('adConfirm').disabled = true;
    $('adConfirm').textContent = 'Procesando…';
    try {
      // Cobrar con Stripe: redirige; al volver (?pago=ok) initCheckoutReturn crea el anuncio
      await payWithStripe({
        type: 'ad',
        intentParams: { name, emoji: adEmoji, badge, plan: adPlan, advertiser: adv, url: adUrl,
          ...(adPending ? { id: adPending.id } : {}) },
        description: t('adPayTitle', { name: name || t('productWord') }), amountCents: null,
      });
    } catch (e) {
      if (String((e && e.message) || e) !== 'cancelado') toast(t('adPayErr'));
    }
    $('adConfirm').disabled = false;
    $('adConfirm').textContent = 'Pagar y publicar';
  };
}
/* Orden de la lista: popularidad | titulo | precio */
let libSort = 'popularidad';
const LIB_PILLS = ['todos', 'destacados', 'nuevos', 'populares'];
let libPill = localStorage.getItem('tj_pill') || 'todos';
// v100: sanea pills obsoletas (ej. 'gratis' de antes de quitar la venta) — sin pill válida ninguna quedaba activa
if (!LIB_PILLS.includes(libPill)) {
  libPill = 'todos';
  try { localStorage.setItem('tj_pill', 'todos'); } catch (e) {}
}
let libLang = localStorage.getItem('tj_lang') || ''; // '' = todos los idiomas
const LANG_FLAGS = { es: '🇪🇸', en: '🇬🇧', fr: '🇫🇷', pt: '🇵🇹', ar: '🇸🇦', it: '🇮🇹', de: '🇩🇪', ru: '🇷🇺', ja: '🇯🇵', el: '🇬🇷' };
const LANG_NAMES = { es: 'Español', en: 'English', fr: 'Français', pt: 'Português', ar: 'العربية', it: 'Italiano', de: 'Deutsch', ru: 'Русский', ja: '日本語', el: 'Ελληνικά' };
function langName(l) { return LANG_NAMES[(l || 'es').toLowerCase()] || l || 'es'; }
function langBadge(b) {
  const l = b.language || 'es';
  if (l === 'es') return ''; // español es el default, no necesita insignia
  return `<span class="lang-badge" title="${{en:'English',fr:'Français',pt:'Português',ar:'العربية',it:'Italiano',de:'Deutsch',ru:'Русский',ja:'日本語',el:'Ελληνικά'}[l] || l}">${LANG_FLAGS[l] || '🌍'}</span>`;
}
let libQuery = '';
let searchDeb = null; // v173: debounce del filtro de búsqueda
let libBooksCache = []; // todos los libros cargados (para filtrar sin recargar)
/* ------------------------------ ⭐ reseñas ------------------------------
   Estrellas + contador en tarjetas e inmersiva; modal para dejar reseña. */
function ratingText(b) {
  const r = b.rating || { avg: 0, count: 0 };
  return r.count > 0 ? `⭐ ${r.avg} (${r.count})` : t('noReviews');
}
/* ------------------- 🏆 niveles y logros de creador ------------------- */
const levelCache = new Map();
async function fetchLevel(name) {
  if (!name) return null;
  if (levelCache.has(name)) return levelCache.get(name);
  try {
    const r = await fetch('/api/creators/' + encodeURIComponent(name) + '/level', { cache: 'no-store' });
    const d = await r.json();
    if (d && d.ok) { levelCache.set(name, d); return d; }
  } catch (e) {}
  return null;
}
/* Pinta insignias de nivel en [data-level-for] dentro del contenedor dado */
function paintLevelBadges(root) {
  (root || document).querySelectorAll('[data-level-for]').forEach(async (el) => {
    const d = await fetchLevel(el.getAttribute('data-level-for'));
    if (d && d.level) el.textContent = d.level.emoji;
  });
}
function levelSpan(author) {
  return `<span class="lvl-badge" data-level-for="${esc(author)}" title="${t('levelTitle')}"></span>`;
}
async function showAchievements() {
  const name = displayName();
  const body = $('achBody');
  $('achSub').textContent = name && name !== t('joinDefaultName') ? t('achSubName', { name }) : t('achSubPlain');
  body.innerHTML = '<p class="join-note">' + t('loading') + '</p>';
  $('achPop').classList.remove('hidden');
  $('achClose').onclick = () => $('achPop').classList.add('hidden');
  const d = await fetchLevel(name);
  if (!d) { body.innerHTML = '<p class="join-note">' + t('loadErr') + '</p>'; return; }
  body.innerHTML =
    `<div class="ach-level"><span style="font-size:44px">📖</span>` +
    `<div><div style="font-size:18px;font-weight:700">${t('lvlCreator')}</div>` +
    `<div class="join-note" style="margin:4px 0">${t('achBooksNotes', { books: d.books, ps: d.books === 1 ? '' : 's', notes: d.notes })}</div></div></div>` +
    `<div class="ach-grid">` + d.achievements.map((a) =>
      `<div class="ach-item${a.unlocked ? '' : ' locked'}"><span>${a.unlocked ? a.emoji : '🔒'}</span><span>${esc(a.name)}</span></div>`
    ).join('') + `</div>`;
}
/* ---------------- 👤 Perfil de creador — knowledge panel (v69) ----------------
 * Tocar el nombre/avatar de un creador abre su perfil estilo knowledge panel:
 * foto, nombre + ✓, rol, bio, datos, links oficiales, acerca de, libros, stats.
 * El creador edita su perfil desde aquí (solo el dueño, con login de Google). */
const SOCIAL_DEFS = [
  { key: 'instagram', label: 'Instagram', emoji: '📸' },
  { key: 'x', label: 'X', emoji: '𝕏' },
  { key: 'youtube', label: 'YouTube', emoji: '▶️' },
  { key: 'tiktok', label: 'TikTok', emoji: '🎵' },
  { key: 'facebook', label: 'Facebook', emoji: '👍' },
];
function kpInitial(name) {
  const s = String(name || '?').trim();
  return esc(s.charAt(0).toUpperCase() || '?');
}
function creatorPanelHtml(p) {
  const vBadge = p.verified ? '<span class="kp-verified" title="' + t('kpVerified') + '">✓</span>' : '';
  const avatar = p.photo
    ? `<div class="kp-avatar"><img src="${esc(p.photo)}" alt="Foto de ${esc(p.name)}"></div>`
    : `<div class="kp-avatar">${kpInitial(p.name)}</div>`;
  const role = t('kpAuthor', { n: p.books, ps: p.books === 1 ? '' : 's' });
  const since = p.since ? new Date(p.since).toLocaleDateString('es', { month: 'long', year: 'numeric' }) : '';
  const facts =
    (p.location ? `<div class="kp-fact"><b>${t('kpLocation')}</b><span>📍 ${esc(p.location)}</span></div>` : '') +
    (p.website ? `<div class="kp-fact"><b>${t('kpWebsite')}</b><a href="${esc(p.website)}" target="_blank" rel="noopener">${esc(p.website.replace(/^https?:\/\//i, ''))}</a></div>` : '') +
    (since ? `<div class="kp-fact"><b>${t('kpSince')}</b><span>📅 ${esc(since)}</span></div>` : '');
  const links = [];
  if (p.website) links.push(`<a class="kp-link" href="${esc(p.website)}" target="_blank" rel="noopener">${t('kpSiteOfficial')}</a>`);
  (SOCIAL_DEFS || []).forEach((s) => {
    const url = p.socials && p.socials[s.key];
    if (url) links.push(`<a class="kp-link" href="${esc(url)}" target="_blank" rel="noopener">${s.emoji} ${s.label}</a>`);
  });
  const booksHtml = (p.booksList && p.booksList.length)
    ? `<div class="kp-books">` + p.booksList.map((b) =>
        `<div class="kp-book" data-book="${esc(b.id)}">` +
        (b.coverUrl ? `<img src="${esc(b.coverUrl)}" alt="${t('kpCoverAlt', { title: esc(b.title) })}" loading="lazy">`
          : `<div style="aspect-ratio:2/3;${coverStyle(b.id)};position:relative"><div class="cover-title" style="font-size:13px">${esc(b.title)}</div></div>`) +
        `<div class="kp-book-t">${esc(b.title)}</div></div>`
      ).join('') + `</div>`
    : `<p class="join-note" style="margin:6px 0">${t('kpNoBooks')}</p>`;
  return `<div class="kp">` +
    `<div class="kp-head">${avatar}<div><h3 class="kp-name">${esc(p.name)}${vBadge}</h3><div class="kp-role">${esc(role)}</div></div></div>` +
    (p.bio ? `<p class="kp-bio">${esc(p.bio)}</p>` : '') +
    (facts ? `<div class="kp-facts">${facts}</div>` : '') +
    (links.length ? `<div class="kp-links">${links.join('')}</div>` : '') +
    (p.about ? `<div class="kp-sec">Acerca de</div><p class="kp-about">${esc(p.about)}</p>` : '') +
    `<div class="kp-stats">` +
    `<div class="kp-stat"><b>${p.books}</b><span>${t('kpBooks')}</span></div>` +
    `<div class="kp-stat"><b>${p.notes}</b><span>${t('kpNotes')}</span></div>` +
    `</div>` +
    `<div class="kp-sec">${t('kpBooksOf', { name: esc(p.name) })}</div>${booksHtml}` +
    (p.canEdit ? `<button class="btn btn-primary kp-edit" id="kpEditBtn">${t('kpEdit')}</button>` : '') +
    `</div>`;
}
async function showCreatorProfile(name) {
  name = String(name || '').trim();
  if (!name) return;
  const body = $('creatorBody');
  body.innerHTML = '<p class="join-note">' + t('kpLoading') + '</p>';
  $('creatorPop').classList.remove('hidden');
  $('creatorClose').onclick = () => $('creatorPop').classList.add('hidden');
  let p = null;
  try {
    const r = await fetch('/api/creators/' + encodeURIComponent(name) + '/profile', { cache: 'no-store' });
    const d = await r.json();
    if (d && d.ok) p = d.profile;
  } catch (e) { /* sin conexión */ }
  if (!p) { body.innerHTML = '<p class="join-note">' + t('kpErr') + '</p>'; return; }
  body.innerHTML = creatorPanelHtml(p);
  // Libros tocables -> abrir el libro
  body.querySelectorAll('[data-book]').forEach((el) => {
    el.onclick = () => { $('creatorPop').classList.add('hidden'); openBook(el.getAttribute('data-book')); };
  });
  const eb = $('kpEditBtn');
  if (eb) eb.onclick = () => showCreatorEdit(p);
}
function showCreatorEdit(p) {
  const body = $('creatorBody');
  const s = p.socials || {};
  body.innerHTML = `<div class="kp"><div class="kp-sec" style="margin-top:0">${t('kpEditFor')}${esc(p.name)}</div>
  <div class="kp-form">
    <div><label>${t('kpPhotoLbl')}</label>
      <div class="kp-photo-row">
        <div class="kp-avatar" style="width:56px;height:56px;font-size:24px">${p.photo ? `<img src="${esc(p.photo)}" alt="">` : kpInitial(p.name)}</div>
        <input type="file" id="kpPhoto" accept="image/jpeg,image/png,image/webp,image/gif" style="font-size:13px">
      </div></div>
    <div><label>${t('kpBioLbl')}</label><input id="kpBio" maxlength="160" value="${esc(p.bio || '')}" placeholder="${t('kpBioPh')}"></div>
    <div><label>${t('kpLocLbl')}</label><input id="kpLoc" maxlength="60" value="${esc(p.location || '')}" placeholder="${t('kpCityPh')}"></div>
    <div><label>${t('kpWebLbl')}</label><input id="kpWeb" maxlength="120" value="${esc(p.website || '')}" placeholder="https://tusitio.com"></div>
    <div><label>${t('kpSocLbl')}</label><div class="kp-soc">` +
    SOCIAL_DEFS.map((d) =>
      `<input id="kpSoc_${d.key}" maxlength="120" value="${esc(s[d.key] || '')}" placeholder="${d.emoji} ${d.label}">`
    ).join('') + `</div></div>
    <div><label>${t('kpAboutLbl')}</label><textarea id="kpAbout" maxlength="1000" placeholder="${t('kpAboutPh')}">${esc(p.about || '')}</textarea></div>
    <div style="display:flex;gap:8px">
      <button class="btn" id="kpCancel" style="flex:1">${t('btnCancel')}</button>
      <button class="btn btn-primary" id="kpSave" style="flex:2">${t('kpSaveBtn')}</button>
    </div>
  </div></div>`;
  $('kpCancel').onclick = () => showCreatorProfile(p.name);
  $('kpSave').onclick = () => saveCreatorProfile(p.name);
}
async function saveCreatorProfile(name) {
  const btn = $('kpSave');
  btn.disabled = true; btn.textContent = t('kpSaving');
  const socials = {};
  SOCIAL_DEFS.forEach((d) => { socials[d.key] = ($('kpSoc_' + d.key) || {}).value || ''; });
  try {
    // 1. Foto (si eligió una)
    const fi = $('kpPhoto');
    if (fi && fi.files && fi.files[0]) {
      const fd = new FormData();
      fd.append('photo', fi.files[0]);
      const rp = await fetchTimeout('/api/creators/' + encodeURIComponent(name) + '/photo', 30000, { method: 'POST', body: fd });
      const dp = await rp.json().catch(() => ({}));
      if (!dp.ok) throw new Error(dp.error || 'photo-failed');
    }
    // 2. Datos del perfil
    // v164: timeout anti-cuelgue (15s) + aviso honesto si falta login
    const r = await fetchTimeout('/api/creators/' + encodeURIComponent(name) + '/profile', 15000, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bio: $('kpBio').value, location: $('kpLoc').value,
        website: $('kpWeb').value, about: $('kpAbout').value, socials,
      }),
    });
    if (needLogin(r)) { btn.disabled = false; btn.textContent = t('kpSaveBtn'); return; }
    const d = await r.json().catch(() => ({}));
    if (!d.ok) throw new Error(d.error || 'save-failed');
    toast(t('kpSaved'));
    showCreatorProfile(name); // recargar
  } catch (e) {
    const msg = e.message === 'not-owner' ? t('kpOwnerOnly')
      : e.message === 'login' ? t('kpNeedGoogle')
      : e.message === 'too-big' ? t('kpPhotoHeavy')
      : e.message === 'bad-type' ? t('kpPhotoType')
      : t('vrfSaveErr');
    toast(msg);
    btn.disabled = false; btn.textContent = t('kpSaveBtn');
  }
}
/* Tocar el nombre/avatar de un creador abre su perfil (delegado global,
 * fase de captura para ganarle a los onclick de las tarjetas). */
document.addEventListener('click', (e) => {
  const t = e.target && e.target.closest ? e.target.closest('[data-creator]') : null;
  if (!t) return;
  e.preventDefault(); e.stopPropagation();
  showCreatorProfile(t.getAttribute('data-creator'));
}, true);
/* ------------------------- ✅ Verificaciones ------------------------- */
function vRow(emoji, title, desc, statusHtml, formHtml) {
  return `<div class="vrf-row"><div class="vrf-head"><span>${emoji} <b>${title}</b></span>${statusHtml}</div>` +
    `<p class="vrf-desc">${desc}</p>${formHtml || ''}</div>`;
}
function vStatus(state, okText, pendText) {
  if (state === 'ok') return `<span class="vrf-ok">✅ ${okText || t('vrfVerified')}</span>`;
  if (state === 'pending') return `<span class="vrf-pend">⏳ ${pendText || t('vrfInReview')}</span>`;
  if (state === 'rejected') return `<span class="vrf-no">${t('vrfRejected')}</span>`;
  return `<span class="vrf-no">${t('vrfPending')}</span>`;
}
async function showVerifications() {
  const name = displayName();
  const body = $('verifBody');
  body.innerHTML = '<p class="join-note">Cargando…</p>';
  $('verifPop').classList.remove('hidden');
  $('verifClose').onclick = () => $('verifPop').classList.add('hidden');
  let p = null;
  try {
    const r = await fetch('/api/creators/' + encodeURIComponent(name) + '/verification?as=' + encodeURIComponent(name));
    const d = await r.json();
    if (d.ok) p = d.profile;
  } catch (e) {}
  if (!p) { body.innerHTML = '<p class="join-note">' + t('loadErr') + '</p>'; return; }
  const idSt = p.identity && p.identity.status ? p.identity.status : 'none';
  body.innerHTML =
    vRow('✔️', t('vrfRowVerified'), t('vrfRowVerifiedDesc'),
      p.verified ? vStatus('ok') : `<span class="vrf-no">${t('vrfGrantedByAdmin')}</span>`, '') +
    vRow('📝', t('vrfRowOriginality'), t('vrfIdHint'),
      vStatus('ok', t('vrfActive')), '') +
    vRow('🪪', t('vrfRowIdentity'), t('vrfIdDesc'),
      vStatus(idSt === 'approved' ? 'ok' : idSt),
      idSt === 'approved' ? '' :
      `<div class="vrf-form"><input id="vIdName" placeholder="${t('vrfIdNamePh')}" maxlength="80" value="${esc((p.identity && p.identity.fullName) || '')}">` +
      `<input id="vIdDoc" placeholder="${t('vrfDocPh')}" maxlength="40">` +
      `<button class="btn btn-primary" id="vIdSend">${t('vrfSendReview')}</button></div>`) +
    vRow('🔞', t('vrfRowAge'), t('vrfChooseRating'),
      vStatus('ok', t('vrfActive')), '') +
    vRow('🛡️', t('vrfRowPreReview'), t('vrfRowPreReviewDesc'),
      vStatus('ok', t('vrfActive')), '') +
    vRow('📧', t('vrfRowEmail'), t('vrfEmailDesc'),
      vStatus(p.emailVerified ? 'ok' : 'none'),
      p.emailVerified ? `<p class="vrf-done">${esc(p.email || '')}</p>` :
      `<div class="vrf-form"><input id="vEmail" type="email" placeholder="tu@correo.com" maxlength="80" value="${esc(p.email || '')}">` +
      `<button class="btn btn-primary" id="vEmailSend">${t('vrfSendCode')}</button>` +
      `<div id="vEmailCodeWrap" class="hidden"><p class="vrf-code" id="vEmailCode"></p>` +
      `<input id="vEmailCodeIn" placeholder="${t('vrfCodePh')}" maxlength="6" inputmode="numeric">` +
      `<button class="btn btn-primary" id="vEmailVerify">${t('vrfVerifyBtn')}</button></div></div>`) +
    vRow('📱', t('vrfRowPhone'), t('vrfPhoneDesc'),
      vStatus(p.phoneVerified ? 'ok' : 'none'),
      p.phoneVerified ? `<p class="vrf-done">${esc(p.phone || '')}</p>` :
      `<div class="vrf-form"><input id="vPhone" placeholder="+1 555 123 4567" maxlength="20" value="${esc(p.phone || '')}">` +
      `<button class="btn btn-primary" id="vPhoneSend">${t('vrfSendCode')}</button>` +
      `<div id="vPhoneCodeWrap" class="hidden"><p class="vrf-code" id="vPhoneCode"></p>` +
      `<input id="vPhoneCodeIn" placeholder="${t('vrfCodePh')}" maxlength="6" inputmode="numeric">` +
      `<button class="btn btn-primary" id="vPhoneVerify">${t('vrfVerifyBtn')}</button></div></div>`) +
    vRow('🏦', t('vrfRowBank'), t('vrfBankDesc'),
      vStatus(p.bankVerified ? 'ok' : (p.bank ? 'pending' : 'none')),
      p.bankVerified ? `<p class="vrf-done">${esc(p.bank.bank)} ···· ${esc(p.bank.last4)}</p>` :
      `<div class="vrf-form"><input id="vBankName" placeholder="${t('vrfBankNamePh')}" maxlength="60">` +
      `<input id="vBankRout" placeholder="${t('vrfBankRoutPh')}" maxlength="20" inputmode="numeric">` +
      `<input id="vBankAcct" placeholder="${t('vrfBankAcctPh')}" maxlength="30" inputmode="numeric">` +
      `<button class="btn btn-primary" id="vBankSend">${t('vrfSendVerify')}</button></div>`) +
    vRow('🧾', t('vrfRowTax'), t('vrfTaxDesc'),
      vStatus(p.taxDone ? 'ok' : 'none'),
      p.taxDone ? `<p class="vrf-done">${t('vrfTaxDone')}</p>` :
      `<div class="vrf-form"><input id="vTaxName" placeholder="${t('vrfTaxNamePh')}" maxlength="80">` +
      `<input id="vTaxAddr" placeholder="${t('vrfTaxAddrPh')}" maxlength="120">` +
      `<input id="vTaxSsn" placeholder="${t('vrfTaxSsnPh')}" maxlength="4" inputmode="numeric">` +
      `<button class="btn btn-primary" id="vTaxSend">${t('vrfSave')}</button></div>`);
  const post = async (url, data) => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return r.json().catch(() => ({}));
  };
  const enc = encodeURIComponent(name);
  const bind = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
  bind('vIdSend', async () => {
    const d = await post(`/api/creators/${enc}/identity`, { fullName: $('vIdName').value, docId: $('vIdDoc').value });
    toast(d.ok ? t('vrfIdSent') : t('vrfNeedId'));
    if (d.ok) showVerifications();
  });
  bind('vEmailSend', async () => {
    const d = await post(`/api/creators/${enc}/email`, { email: $('vEmail').value });
    if (!d.ok) { toast(t('vrfBadEmail')); return; }
    $('vEmailCodeWrap').classList.remove('hidden');
    $('vEmailCode').textContent = t('vrfCodeSent') + d.code;
  });
  bind('vEmailVerify', async () => {
    const d = await post(`/api/creators/${enc}/email/verify`, { code: $('vEmailCodeIn').value });
    toast(d.ok ? t('vrfEmailOk') : t('vrfBadCode'));
    if (d.ok) showVerifications();
  });
  bind('vPhoneSend', async () => {
    const d = await post(`/api/creators/${enc}/phone`, { phone: $('vPhone').value });
    if (!d.ok) { toast(t('vrfBadPhone')); return; }
    $('vPhoneCodeWrap').classList.remove('hidden');
    $('vPhoneCode').textContent = t('vrfCodeSent') + d.code;
  });
  bind('vPhoneVerify', async () => {
    const d = await post(`/api/creators/${enc}/phone/verify`, { code: $('vPhoneCodeIn').value });
    toast(d.ok ? t('vrfPhoneOk') : t('vrfBadCode'));
    if (d.ok) showVerifications();
  });
  bind('vBankSend', async () => {
    const d = await post(`/api/creators/${enc}/bank`, { bank: $('vBankName').value, routing: $('vBankRout').value, account: $('vBankAcct').value });
    toast(d.ok ? t('vrfBankSent') : t('vrfNeedBank'));
    if (d.ok) showVerifications();
  });
  bind('vTaxSend', async () => {
    const d = await post(`/api/creators/${enc}/tax`, { legalName: $('vTaxName').value, address: $('vTaxAddr').value, ssn4: $('vTaxSsn').value });
    toast(d.ok ? t('vrfTaxOk') : t('vrfNeedFields'));
    if (d.ok) showVerifications();
  });
}
/* ------------------------- 🐛 Reporte de fallos --------------------------
   El usuario reporta lo que no funciona; se guarda en el servidor para
   que Alejandro lo revise en el panel admin. */
const VIEW_LABELS = { library: 'viewLibrary', room: 'viewRoom', join: 'viewJoin', writing: 'viewWriting', immersive: 'viewImmersive' };
function showFeedbackModal() {
  const _vlk = VIEW_LABELS[currentView] || 'viewLibrary';
  const viewName = (currentView && !VIEW_LABELS[currentView]) ? currentView : t(_vlk);
  $('fbPage').value = viewName;
  $('fbMessage').value = '';
  $('fbName').value = (displayName() && displayName() !== t('joinDefaultName')) ? displayName() : '';
  $('feedbackPop').classList.remove('hidden');
  $('fbCancel').onclick = () => $('feedbackPop').classList.add('hidden');
  $('fbSend').onclick = async () => {
    const message = $('fbMessage').value.trim();
    if (!message) { toast(t('fbNeedMsg')); return; }
    $('fbSend').disabled = true;
    try {
      const r = await fetch('/api/feedback', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, page: $('fbPage').value, name: $('fbName').value.trim() }) });
      const d = await r.json().catch(() => ({}));
      if (d && d.ok) {
        $('feedbackPop').classList.add('hidden');
        toast(t('fbSent'));
      } else toast(t('fbErr'));
    } catch (e) { toast(t('fbOffline')); }
    $('fbSend').disabled = false;
  };
}
/* ------------------------- 🛡️ Panel admin ------------------------- */
async function showAdminPanel() {
  const body = $('adminBody');
  body.innerHTML = '<p class="join-note">' + t('loading') + '</p>';
  $('adminPop').classList.remove('hidden');
  $('adminClose').onclick = () => $('adminPop').classList.add('hidden');
  let d = null;
  try {
    const r = await fetch('/api/admin/pending?admin=' + encodeURIComponent(displayName()));
    d = await r.json();
  } catch (e) {}
  if (!d || !d.ok) { body.innerHTML = '<p class="join-note">' + t('admNoAccess') + '</p>'; return; }
  const post = async (url, data) => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return r.json().catch(() => ({}));
  };
  const admin = displayName();
  let html = '';
  html += `<h4>${t('admBooks', { n: d.pendingBooks.length })}</h4>`;
  html += d.pendingBooks.length ? d.pendingBooks.map((b) =>
    `<div class="adm-row"><span><b>${esc(b.title)}</b> · ${esc(b.author)} · ${b.ageRating === '18' ? '+18' : b.ageRating === '13' ? '+13' : t('ageAll')}</span>` +
    `<span><button class="btn btn-primary" data-adm="book-ok" data-id="${esc(b.id)}">${t('admApprove')}</button> ` +
    `<button class="btn" data-adm="book-no" data-id="${esc(b.id)}">${t('admReject')}</button></span></div>`
  ).join('') : '<p class="join-note">' + t('admNothing') + '</p>';
  html += `<h4>${t('admIdentities', { n: d.pendingIdentity.length })}</h4>`;
  html += d.pendingIdentity.length ? d.pendingIdentity.map((c) =>
    `<div class="adm-row"><span><b>${esc(c.name)}</b> · ${esc(c.fullName)} · doc ${esc(c.docId)}</span>` +
    `<span><button class="btn btn-primary" data-adm="id-ok" data-id="${esc(c.name)}">${t('admApprove')}</button> ` +
    `<button class="btn" data-adm="id-no" data-id="${esc(c.name)}">${t('admReject')}</button></span></div>`
  ).join('') : '<p class="join-note">' + t('admNothing') + '</p>';
  html += `<h4>${t('admBanks', { n: d.pendingBank.length })}</h4>`;
  html += d.pendingBank.length ? d.pendingBank.map((c) =>
    `<div class="adm-row"><span><b>${esc(c.name)}</b> · ${esc(c.bank)} ···· ${esc(c.last4)}</span>` +
    `<span><button class="btn btn-primary" data-adm="bank-ok" data-id="${esc(c.name)}">${t('vrfVerifyBtn')}</button></span></div>`
  ).join('') : '<p class="join-note">' + t('admNothing') + '</p>';
  /* 🐛 Reportes de fallos */
  html += `<h4>${t('admBugs')} <span id="fbPendingBadge"></span></h4><div id="fbList"><p class="join-note">${t('loading')}</p></div>`;
  html += `<h4>${t('admVerifyCreator')}</h4><div class="vrf-form"><input id="admVName" placeholder="${t('admCreatorNamePh')}" maxlength="60">` +
    `<button class="btn btn-primary" id="admVTog">${t('admToggleBadge')}</button></div>`;
  body.innerHTML = html;
  loadAdminFeedback();
  body.querySelectorAll('button[data-adm]').forEach((btn) => {
    btn.onclick = async () => {
      const kind = btn.dataset.adm, id = btn.dataset.id;
      let r2;
      if (kind === 'book-ok' || kind === 'book-no')
        r2 = await post('/api/admin/books/' + encodeURIComponent(id) + '/review', { admin, approved: kind === 'book-ok' });
      else if (kind === 'id-ok' || kind === 'id-no')
        r2 = await post('/api/admin/identity/review', { admin, name: id, approved: kind === 'id-ok' });
      else if (kind === 'bank-ok')
        r2 = await post('/api/admin/bank/verify', { admin, name: id, verified: true });
      toast(r2.ok ? t('admDone') : t('admFail'));
      if (r2.ok) { showAdminPanel(); showLibrary(false); }
    };
  });
  const vt = $('admVTog');
  if (vt) vt.onclick = async () => {
    const nm = $('admVName').value.trim();
    if (!nm) { toast(t('admNeedCreator')); return; }
    const r2 = await post('/api/admin/creator/verify', { admin, name: nm, verified: true });
    toast(r2.ok ? t('admVerified', { name: nm }) : t('admFail'));
  };
}
/* 🐛 Carga los reportes de fallos en el panel admin */
async function loadAdminFeedback() {
  const box = $('fbList');
  const badge = $('fbPendingBadge');
  if (!box) return;
  let d = null;
  try {
    const r = await fetch('/api/admin/feedback?admin=' + encodeURIComponent(displayName()));
    d = await r.json();
  } catch (e) {}
  if (!d || !d.ok) { box.innerHTML = '<p class="join-note">No se pudo cargar.</p>'; return; }
  const list = d.feedback || [];
  const nuevos = list.filter((f) => f.status === 'nuevo').length;
  if (badge) badge.textContent = nuevos > 0 ? `(${nuevos} nuevos)` : '';
  if (!list.length) { box.innerHTML = '<p class="join-note">' + t('admNoReports') + '</p>'; return; }
  const stLabel = { nuevo: '🆕 Nuevo', leido: t('admRead'), resuelto: '✅ Resuelto' };
  box.innerHTML = list.map((f) =>
    `<div class="fb-card fb-${f.status}">` +
    `<div class="fb-head"><span class="fb-st">${stLabel[f.status] || f.status}</span>` +
    `<span class="fb-meta">${esc(f.page || '')} · ${esc(f.name || t('anonymous'))} · ${relTime(f.ts)}</span></div>` +
    `<p class="fb-msg">${esc(f.message)}</p>` +
    `<div class="fb-actions">` +
    (f.status !== 'leido' ? `<button class="btn btn-sm" data-fb="leido" data-id="${f.id}">${t('admMarkRead')}</button>` : '') +
    (f.status !== 'resuelto' ? `<button class="btn btn-sm btn-primary" data-fb="resuelto" data-id="${f.id}">Resuelto</button>` : '') +
    `</div></div>`
  ).join('');
  box.querySelectorAll('button[data-fb]').forEach((btn) => {
    btn.onclick = async () => {
      // v158: antes usaba post(), que es local de showAdminPanel() y aquí no
      // existe — pulsar "leído"/"resuelto" lanzaba ReferenceError.
      let r2 = {};
      try {
        const rr = await fetch('/api/admin/feedback/' + encodeURIComponent(btn.dataset.id) + '/status',
          { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin: displayName(), status: btn.dataset.fb }) });
        r2 = await rr.json().catch(() => ({}));
      } catch (e) {}
      toast(r2.ok ? t('admDone') : t('admFail'));
      if (r2.ok) loadAdminFeedback();
    };
  });
}
function ratingHtml(b) {
  return `<span class="tile-rating" data-book="${esc(b.id)}" title="${t('revViewTitle')}">${ratingText(b)}</span>`;
}
let reviewBookId = null, reviewStars = 5;
function showReviewModal(bookId, bookTitle) {
  reviewBookId = bookId; reviewStars = 5;
  $('reviewBookTitle').textContent = bookTitle || '';
  paintReviewStars();
  $('reviewComment').value = '';
  $('reviewPop').classList.remove('hidden');
  loadBookReviews(bookId); // muestra las existentes debajo
}
function paintReviewStars() {
  const el = $('reviewStars');
  el.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const s = document.createElement('button');
    s.type = 'button';
    s.className = 'rstar' + (i <= reviewStars ? ' on' : '');
    s.textContent = '★';
    s.setAttribute('aria-label', i + ' estrellas');
    s.onclick = () => { reviewStars = i; paintReviewStars(); };
    el.appendChild(s);
  }
}
async function loadBookReviews(bookId) {
  const list = $('reviewList');
  list.innerHTML = '<p class="join-note">' + t('revLoading') + '</p>';
  try {
    // v172: timeout anti-cuelgue (10s) — antes el "Cargando reseñas…" quedaba
    // indefinido si la red se colgaba; el POST del mismo modal ya lo tiene (v164)
    const r = await fetchTimeout('/api/books/' + encodeURIComponent(bookId) + '/reviews', 10000, { cache: 'no-store' });
    const d = await r.json();
    if (!d.ok) throw 0;
    if (!d.reviews.length) { list.innerHTML = '<p class="join-note">' + t('revEmpty') + '</p>'; return; }
    list.innerHTML = d.reviews.map((x) =>
      `<div class="review-item"><b>${esc(x.name)}</b> <span class="r-stars">${'★'.repeat(x.stars)}${'☆'.repeat(5 - x.stars)}</span>` +
      (x.comment ? `<p>${esc(x.comment)}</p>` : '') + `</div>`).join('');
  } catch (e) { list.innerHTML = '<p class="join-note">' + t('revErr') + '</p>'; }
}
function initReviews() {
  $('reviewCancel').onclick = () => $('reviewPop').classList.add('hidden');
  $('reviewSave').onclick = async () => {
    if (!reviewBookId) return;
    syncNameFromLib();
    $('reviewSave').disabled = true;
    try {
      // v164: timeout anti-cuelgue (15s) + cid para no duplicar la reseña ante reintento
      const r = await fetchTimeout('/api/books/' + encodeURIComponent(reviewBookId) + '/reviews', 15000, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: myName, stars: reviewStars, comment: $('reviewComment').value.trim(), cid: makeCid() }),
      });
      const d = await r.json();
      if (!d.ok) throw 0;
      toast(t('revThanks'));
      $('reviewPop').classList.add('hidden');
      refreshBookRating(reviewBookId, d.avg, d.count);
    } catch (e) { toast(t('revSaveErr')); }
    $('reviewSave').disabled = false;
  };
}
/* Actualiza el rating en caché y repinta las filas sin recargar */
function refreshBookRating(bookId, avg, count) {
  const b = libBooksCache.find((x) => x.id === bookId);
  if (b) { b.rating = { avg, count }; renderRows(); renderHero(); }
}
/* ------------------------------ 🚩 reportes ------------------------------
   Botón discreto en tarjetas e inmersiva; modal con motivos; 3+ = insignia. */
function reportReasons() {
  return [
    ['no-original', t('repR1')],
    ['copyright', t('repR2')],
    ['dominio-publico', t('repR3')],
    ['copiado', t('repR4')],
    ['otro', t('repROther')],
  ];
}

const REPORT_THRESHOLD = 3;
function reportBadge(b) {
  return (b.reports || 0) >= REPORT_THRESHOLD
    ? `<div class="report-badge">${t('repBadge')}</div>` : '';
}
function reportBtnHtml(b) {
  return `<span class="tile-report" data-book="${esc(b.id)}" title="${t('repBtnTitle')}">🚩</span>`;
}
let reportBookId = null, reportReason = 'no-original';
function showReportModal(bookId, bookTitle) {
  reportBookId = bookId; reportReason = 'no-original';
  $('reportBookTitle').textContent = bookTitle || '';
  $('reportOther').value = '';
  $('reportOtherWrap').classList.add('hidden');
  const box = $('reportReasons');
  box.innerHTML = '';
  reportReasons().forEach(([key, label]) => {
    const row = document.createElement('label');
    row.className = 'plan-row' + (key === reportReason ? ' sel' : '');
    row.innerHTML = `<input type="radio" name="rreason" value="${key}" ${key === reportReason ? 'checked' : ''}>` +
      `<span>${esc(label)}</span>`;
    row.querySelector('input').onchange = () => {
      reportReason = key;
      box.querySelectorAll('.plan-row').forEach((el) => el.classList.remove('sel'));
      row.classList.add('sel');
      $('reportOtherWrap').classList.toggle('hidden', key !== 'otro');
    };
    box.appendChild(row);
  });
  $('reportPop').classList.remove('hidden');
}
function refreshBookReports(bookId, count) {
  const b = libBooksCache.find((x) => x.id === bookId);
  if (b) { b.reports = count; renderRows(); renderHero(); }
}
function initReports() {
  $('reportCancel').onclick = () => $('reportPop').classList.add('hidden');
  $('reportSave').onclick = async () => {
    if (!reportBookId) return;
    syncNameFromLib();
    if (reportReason === 'otro' && !$('reportOther').value.trim()) {
      toast(t('repNeedReason')); return;
    }
    $('reportSave').disabled = true;
    try {
      // v164: timeout anti-cuelgue (15s); el servidor ya dedupea por reportero (409)
      const r = await fetchTimeout('/api/books/' + encodeURIComponent(reportBookId) + '/report', 15000, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: myName, reason: reportReason, text: $('reportOther').value.trim() }),
      });
      const d = await r.json();
      if (!d.ok) {
        if (d.error === 'duplicate') toast(t('repAlready'));
        else throw 0;
      } else {
        toast(d.count >= REPORT_THRESHOLD
          ? t('repSentN') + d.count + '.'
          : t('repSentThanks'));
        refreshBookReports(reportBookId, d.count);
      }
      $('reportPop').classList.add('hidden');
    } catch (e) { toast(t('repErr')); }
    $('reportSave').disabled = false;
  };
}
/* ------------------------------ 📖 continuar leyendo ------------------------------
   Guarda la posición de scroll por libro en localStorage; al abrir, vuelve a ella. */
const progKey = (id) => 'tj_progress_' + id;
const getProgress = (id) => {
  try { return parseInt(localStorage.getItem(progKey(id)) || '0', 10) || 0; }
  catch { return 0; }
};
let progTimer = null;
/* v68 — Tipografía del lector (patrón Kindle/Wattpad): tamaño, espaciado y ancho.
   Se guarda en localStorage y se aplica al artículo de lectura. */
const TYPO_KEY = 'tj_typo_v1';
const typoGet = () => {
  try { return Object.assign({ size: 17, lh: 1.75, w: 'normal' }, JSON.parse(localStorage.getItem(TYPO_KEY) || '{}')); }
  catch (e) { return { size: 17, lh: 1.75, w: 'normal' }; }
};
const typoSet = (t) => { try { localStorage.setItem(TYPO_KEY, JSON.stringify(t)); } catch (e) {} };
function typoApply() {
  const t = typoGet();
  const article = document.querySelector('main.layout article.chapter');
  if (!article) return;
  article.style.setProperty('--read-size', t.size + 'px');
  article.style.setProperty('--read-lh', t.lh);
  article.classList.remove('read-w-narrow', 'read-w-normal', 'read-w-wide');
  article.classList.add('read-w-' + t.w);
  const lbl = $('typoSizeLbl'); if (lbl) lbl.textContent = t.size;
  document.querySelectorAll('#typoLineBtns .btn-chip').forEach((b) =>
    b.classList.toggle('on', Number(b.dataset.lh) === Number(t.lh)));
  document.querySelectorAll('#typoWidthBtns .btn-chip').forEach((b) =>
    b.classList.toggle('on', b.dataset.w === t.w));
}
function initTypo() {
  typoApply();
  $('typoBtn').onclick = () => { typoApply(); $('typoPop').classList.remove('hidden'); };
  $('typoClose').onclick = () => $('typoPop').classList.add('hidden');
  $('typoMinus').onclick = () => { const t = typoGet(); t.size = Math.max(14, t.size - 1); typoSet(t); typoApply(); };
  $('typoPlus').onclick = () => { const t = typoGet(); t.size = Math.min(24, t.size + 1); typoSet(t); typoApply(); };
  $('typoLineBtns').addEventListener('click', (e) => {
    const b = e.target.closest('[data-lh]'); if (!b) return;
    const t = typoGet(); t.lh = Number(b.dataset.lh); typoSet(t); typoApply();
  });
  $('typoWidthBtns').addEventListener('click', (e) => {
    const b = e.target.closest('[data-w]'); if (!b) return;
    const t = typoGet(); t.w = b.dataset.w; typoSet(t); typoApply();
  });
}

/* v68 — Barra de progreso de lectura (patrón Kindle): % leído en tiempo real. */
function initReadProgress() {
  const bar = $('readProgress'), fill = $('readProgressFill'), pct = $('readProgressPct');
  const upd = () => {
    if (currentView !== 'room') { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    fill.style.width = (p * 100).toFixed(1) + '%';
    pct.textContent = Math.round(p * 100) + '%';
  };
  window.addEventListener('scroll', () => requestAnimationFrame(upd), { passive: true });
  setInterval(upd, 2000);
}

const progMetaKey = (id) => 'tj_progmeta_' + id;
/* v68: guarda metadatos del libro junto al progreso para "Seguir leyendo" */
function saveProgressMeta(book) {
  if (!book || !book.id) return;
  try {
    localStorage.setItem(progMetaKey(book.id), JSON.stringify({
      id: book.id, title: book.title, author: book.author,
      cover: book.cover || '', ts: Date.now()
    }));
  } catch (e) {}
}
function getProgressMeta(id) {
  try { return JSON.parse(localStorage.getItem(progMetaKey(id)) || 'null'); }
  catch (e) { return null; }
}
/* v145: limpiar "seguir leyendo" huérfano — progreso de libros que ya no
   existen en el catálogo (la tarjeta sería un callejón sin salida). */
function clearProgress(id) {
  try { localStorage.removeItem(progKey(id)); localStorage.removeItem(progMetaKey(id)); } catch (e) {}
}
function pruneOrphanProgress() {
  try {
    const ids = new Set((libBooksCache || []).map((b) => String(b.id)));
    const dead = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf('tj_progress_') === 0 && !ids.has(k.slice(12))) dead.push(k.slice(12));
    }
    dead.forEach(clearProgress);
    return dead.length;
  } catch (e) { return 0; }
}
function initProgress() {
  window.addEventListener('scroll', () => {
    if (currentView !== 'room' || !myRoom) return;
    clearTimeout(progTimer);
    progTimer = setTimeout(() => {
      try { localStorage.setItem(progKey(myRoom), String(window.scrollY | 0)); } catch (e) {}
      if (currentBook) saveProgressMeta(currentBook);
    }, 800);
  }, { passive: true });
  window.addEventListener('pagehide', () => {
    if (currentView === 'room' && myRoom) {
      try { localStorage.setItem(progKey(myRoom), String(window.scrollY | 0)); } catch (e) {}
    }
  });
}
function restoreProgress(bookId) {
  const y = getProgress(bookId);
  if (y > 120) {
    // v146: pinta por trozos hasta alcanzar la posición guardada, cediendo
    // el hilo entre trozos para no congelar la página.
    // v162: si faltan párrafos, los descarga del servidor por rangos.
    (async () => {
      let guard = 0;
      while (document.documentElement.scrollHeight < y && guard++ < 200) {
        if (queuePos < paraQueue.length) {
          renderMoreParas(null, CHUNK_NEXT);
        } else if (paraQueue.length < bookParaTotal) {
          const n = await loadMoreBookParas();
          if (!n) break;
        } else break;
        await new Promise((r) => setTimeout(r, 0));
      }
      requestAnimationFrame(() => requestAnimationFrame(() => {
        /* v167: avisar solo si de verdad se llegó a la posición guardada. Si la
           descarga falló a mitad (loadMoreBookParas devolvió 0), scrollTo sería
           un no-op silencioso y el aviso mentiría — el 'Tardó demasiado' del
           intento ya avisó con honestidad. */
        if (document.documentElement.scrollHeight >= y) {
          window.scrollTo(0, y);
          toast(t('continueReading'));
        }
      }));
    })();
  }
}
/* ------------------------------ 📊 stats del creador ------------------------------
   Solo el creador del libro ve este panel con marcas, notas y reseñas. */
async function renderCreatorStats(book) {
  const el = $('creatorStats');
  if (!el) return;
  const mine = book && book.author === myName && myName && myName !== t('joinDefaultName');
  if (!mine) { el.classList.add('hidden'); el.innerHTML = ''; return; }
  el.classList.remove('hidden');
  el.innerHTML = '<span class="cs-title">' + t('csTitle') + '</span><span class="cs-loading">' + t('csLoading') + '</span>';
  try {
    const r = await fetch('/api/books/' + encodeURIComponent(book.id) + '/stats', { cache: 'no-store' });
    const d = await r.json();
    if (!d.ok || !d.stats) throw 0;
    const s = d.stats;
    el.innerHTML = `<span class="cs-title">📊 Tu libro</span>` +
      `<span class="cs-num">🎨 <b>${s.marks}</b> ${t('csMarks')}</span>` +
      `<span class="cs-num">💬 <b>${s.notes}</b> ${t('csNotes')}</span>` +
      `<span class="cs-num">⭐ <b>${s.avg || '—'}</b> (${s.reviews})</span>`;
  } catch (e) {
    el.innerHTML = '<span class="cs-title">' + t('csTitle') + '</span><span class="cs-loading">' + t('csOffline') + '</span>';
  }
}
function visibleBooks(list) {
  const q = libQuery.trim().toLowerCase();
  let l = q
    ? list.filter((b) => (b.title + ' ' + b.author).toLowerCase().includes(q))
    : [...list];
  if (libPill === 'destacados') l = l.filter((b) => b.featured);
  else if (libPill === 'nuevos') l = l.filter(isNewBook);
  else if (libPill === 'populares') l = l.filter((b) => popularity(b) > 0);
  if (libLang) l = l.filter((b) => (b.language || 'es') === libLang);
  // v101: español primero, inglés segundo, los demás idiomas después
  l.sort((a, b) => langPriority(a.language) - langPriority(b.language)
    || popularity(b) - popularity(a) || b.createdAt - a.createdAt);
  return l;
}
/* Prioridad de idioma para ordenar: es → en → resto */
function langPriority(lang) {
  const l = (lang || 'es').toLowerCase();
  if (l === 'es') return 0;
  if (l === 'en') return 1;
  return 2;
}
/* Tarjeta de portada para filas horizontales (estilo Tubi) */
function coverTile(b, opts) {
  opts = opts || {};
  const tile = document.createElement('div'); // v101: era `t` y tapaba la función i18n t() → TypeError en clásicos/propios/con portada
  tile.className = 'tile';
  const mine = b.author === displayName() && myName !== t('joinDefaultName');
  const vBadge = b.verifiedAuthor ? '<span class="vbadge" title="' + t('creatorVerifiedTitle') + '">✔️</span>' : '';
  const classicBadge = b.classic ? '<div class="classic-badge">' + t('classicBadge') + '</div>' : '';
  const originalBadge = !b.classic ? '<div class="original-badge">' + t('originalBadge') + '</div>' : '';
  const ageBadge = b.ageRating && b.ageRating !== 'all'
    ? `<div class="age-badge">${b.ageRating === '18' ? '🔞 +18' : '🔞 +13'}</div>` : '';
  const pendBadge = b.status === 'pending' ? '<div class="feat-badge" style="background:#b45309">' + t('reviewBadge') + '</div>' : '';
  const cover = b.coverUrl
    ? `<img src="${esc(b.coverUrl)}" alt="${t('kpCoverAlt', { title: esc(b.title) })}" loading="lazy">`
    : `<div style="position:absolute;inset:0;${coverStyle(b.id)}"></div>`;
  tile.innerHTML =
    `<div class="tile-cover">${cover}` +
    (opts.badge ? `<div class="feat-badge">${opts.badge}</div>` : '') +
    pendBadge + classicBadge + originalBadge + ageBadge + langBadge(b) +
    (getProgress(b.id) > 120 ? `<div class="prog-badge">${t('tileContinue')}</div>` : '') +
    reportBadge(b) +
    (b.coverUrl ? '' : `<div class="cover-title">${esc(b.title)}</div><div class="cover-author creator-link" data-creator="${esc(b.author)}">${esc(b.author)}</div>`) +
    `</div>` +
    `<div class="tile-title">${esc(b.title)} ${vBadge}</div>` +
    `<div class="tile-author">${esc(b.author)} · ${LANG_FLAGS[b.language || 'es'] || '🌍'} ${langName(b.language)}</div>` +
    `<div class="tile-sub">🎨 ${b.marks || 0} · ${ratingHtml(b)}` +
    (mine && !opts.badge ? ` · <u class="tile-feat">⭐ destacar</u>` : '') +
    ` · ${reportBtnHtml(b)}</div>`;
  tile.onclick = (e) => {
    if (e.target.classList && e.target.classList.contains('tile-feat')) {
      e.stopPropagation(); showFeature(b); return;
    }
    if (e.target.classList && e.target.classList.contains('tile-rating')) {
      e.stopPropagation(); showReviewModal(b.id, b.title); return;
    }
    if (e.target.classList && e.target.classList.contains('tile-report')) {
      e.stopPropagation(); showReportModal(b.id, b.title); return;
    }
    opts.onClick ? opts.onClick() : openBook(b.id);
  };
  return tile;
}
/* v157: la animación de entrada de las tarjetas solo corre en la primera
   pintura — en cada re-render (búsqueda, idioma, reseña) las tarjetas
   aparecían/desaparecían con salto visible. */
let rowsFirstPaint = true;
function fillRow(elId, tiles, emptyMsg) {
  const row = document.getElementById(elId);
  if (!row) return;
  row.innerHTML = '';
  if (!tiles.length) {
    row.innerHTML = `<p class="hrow-empty">${emptyMsg}</p>`;
    return;
  }
  tiles.forEach((t, i) => {
    // entrada escalonada: máx 8 tarjetas animadas para no saturar
    if (rowsFirstPaint && i < 8 && !t.classList.contains('tile-enter')) {
      t.classList.add('tile-enter');
      t.style.animationDelay = Math.min(i * 45, 360) + 'ms';
    }
    row.appendChild(t);
  });
}
/* Filas: Destacados / Recomendados (con pills) */
/* v68 — "Seguir leyendo" (patrón Goodreads): la biblioteca abre con tu lectura
   actual, no con un catálogo frío. Lee el progreso guardado en localStorage. */
function renderContinueReading() {
  const sec = $('secContinue'), row = $('continueRow');
  if (!sec || !row) return;
  const items = [];
  try {
    for (let i = 0; i < localStorage.length && items.length < 6; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('tj_progress_')) continue;
      const id = k.slice('tj_progress_'.length);
      const y = parseInt(localStorage.getItem(k) || '0', 10) || 0;
      if (y <= 120) continue;
      const meta = getProgressMeta(id);
      if (!meta) continue;
      items.push({ id, y, meta });
    }
  } catch (e) {}
  items.sort((a, b) => (b.meta.ts || 0) - (a.meta.ts || 0));
  if (!items.length) { sec.classList.add('hidden'); return; }
  sec.classList.remove('hidden');
  row.innerHTML = items.map(({ id, meta }) => `
    <button class="continue-card" data-book="${esc(id)}">
      <span class="continue-cover">${meta.cover
        ? `<img src="${esc(meta.cover)}" alt="" loading="lazy">`
        : `<span class="continue-cover-ph">📖</span>`}</span>
      <span class="continue-info">
        <b>${esc(meta.title || t('libBookWord'))}</b>
        <i>${esc(meta.author || '')}</i>
        <span class="continue-cta">${t('contCta')}</span>
      </span>
    </button>`).join('');
  row.querySelectorAll('.continue-card').forEach((c) =>
    c.addEventListener('click', () => openBook(c.dataset.book, true)));
}

/* v152: intercala idiomas — en Recomendados nunca salen dos libros seguidos
   del mismo idioma (es, en, fr, de… bien mezclados) */
function interleaveByLang(list) {
  const groups = {};
  list.forEach((b) => { const l = b.language || 'es'; (groups[l] = groups[l] || []).push(b); });
  const langs = Object.keys(groups);
  const out = [];
  let last = null;
  while (out.length < list.length) {
    let best = null;
    for (const l of langs) {
      if (l === last || !groups[l].length) continue;
      if (!best || groups[l].length > groups[best].length) best = l;
    }
    if (!best) best = langs.find((l) => groups[l].length); // solo queda el mismo idioma
    if (!best) break;
    out.push(groups[best].shift());
    last = best;
  }
  return out;
}

function renderRows() {
  const feat = libBooksCache.filter((b) => b.featured);
  const secD = document.getElementById('secDestacados');
  if (secD) secD.style.display = feat.length ? '' : 'none';
  fillRow('rowDestacados',
    feat.map((b) => coverTile(b, { badge: '⭐ DESTACADO', onClick: () => showImmersiveBook(b) })),
    '');
  const rec = interleaveByLang(visibleBooks(libBooksCache.filter((b) => !b.featured && !b.classic)));
  fillRow('rowRecomendados',
    rec.map((b) => coverTile(b, {})),
    libQuery ? t('noResults') : t('publishFirst'));
  // ✨ Novedades del mes: clásicos agregados en los últimos 30 días, los últimos primero
  const MONTH_MS = 30 * 24 * 3600 * 1000;
  const nov = libBooksCache.filter((b) => b.classic && (Date.now() - (b.createdAt || 0)) < MONTH_MS)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const secN = document.getElementById('secNovedades');
  if (secN) secN.style.display = nov.length ? '' : 'none';
  fillRow('rowNovedades', nov.map((b) => coverTile(b, { badge: '✨ ' + t('newBadge') })), '');
  // 📜 Clásicos gratis: dominio público, sin creador (v101: es → en → resto)
  const cls = libBooksCache.filter((b) => b.classic)
    .sort((a, b) => langPriority(a.language) - langPriority(b.language)
      || popularity(b) - popularity(a) || b.createdAt - a.createdAt);
  const secC = document.getElementById('secClassics');
  if (secC) secC.style.display = cls.length ? '' : 'none';
  fillRow('rowClassics', cls.map((b) => coverTile(b, {})), '');
  rowsFirstPaint = false; // v157: a partir de aquí, re-renders sin animación
  paintLevelBadges();
}
/* v153: marquesina eliminada a pedido del usuario (ralentizaba la página) */
function initPills() {
  document.querySelectorAll('#pillsRow .pill').forEach((p) => {
    p.classList.toggle('on', p.dataset.pill === libPill);
    p.onclick = () => {
      libPill = p.dataset.pill;
      localStorage.setItem('tj_pill', libPill);
      document.querySelectorAll('#pillsRow .pill').forEach((x) => x.classList.toggle('on', x === p));
      renderRows();
    };
  });
  // v79 — filtro por idioma
  const lf = $('langFilter');
  if (lf) {
    lf.value = libLang;
    lf.onchange = () => {
      libLang = lf.value;
      localStorage.setItem('tj_lang', libLang);
      renderRows();
    };
  }
  // Los títulos de fila con › desplazan su fila (no son decorativos)
  document.querySelectorAll('#library .row-sec').forEach((sec) => {
    const h = sec.querySelector('.row-h2'), row = sec.querySelector('.hrow');
    if (!h || !row || !h.querySelector('.row-more')) return;
    h.style.cursor = 'pointer';
    h.title = 'Toca para desplazar';
    h.onclick = () => {
      const w = row.clientWidth * 0.8;
      const max = row.scrollWidth - row.clientWidth - 8;
      const target = (row.scrollLeft >= max) ? 0 : row.scrollLeft + w;
      row.scrollTo({ left: target, behavior: 'smooth' });
    };
  });
}
/* ---------- vista inmersiva a pantalla completa ---------- */
let immCtaFn = null;
function openImmersive(o) {
  // Guardia: nunca abrir sin contenido real (solo por toque directo del usuario)
  if (!o || (!o.title && !o.visual)) { clog('openImmersive bloqueado: sin contenido'); return; }
  $('immVisual').innerHTML = o.visual || '';
  $('immVisual').style.background = o.bg || '';
  $('immBadge').textContent = o.badge || '';
  $('immTitle').textContent = o.title || '';
  $('immSub').textContent = o.sub || '';
  if (o.subHtml) $('immSub').innerHTML = o.subHtml;
  paintLevelBadges($('immersive'));
  const cta = $('immCta');
  cta.textContent = o.cta || 'Ver';
  immCtaFn = o.onCta || null;
  // etiqueta pequeña opcional (ej. "Anuncio")
  let tag = document.querySelector('.imm-tag');
  if (o.tag) {
    if (!tag) { tag = document.createElement('div'); tag.className = 'imm-tag'; $('immCta').after(tag); }
    tag.textContent = o.tag;
  } else if (tag) tag.remove();
  const im = $('immersive');
  im.classList.remove('hidden');
  im.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';
  paintLevelBadges(im);
}
function closeImmersive() {
  const im = $('immersive');
  im.classList.add('hidden');
  im.setAttribute('hidden', '');
  document.body.style.overflow = '';
  immCtaFn = null;
  const rb = $('immReport');
  if (rb) rb.style.display = 'none'; // el botón 🚩 solo es para libros
}
// Escape cierra la inmersiva o el drawer (v155: también los popups de la sala)
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  // Los popups de la sala van primero: son lo más cercano al foco del lector
  if (!$('notepop').classList.contains('hidden')) { hideNotepop(); return; }
  if (!$('viewNotePop').classList.contains('hidden')) { hideViewNote(); return; }
  if (!$('toolbar').classList.contains('hidden')) { hideToolbar(); return; }
  if (!$('immersive').classList.contains('hidden')) closeImmersive();
  else if ($('drawer') && !$('drawer').classList.contains('hidden')) closeDrawer();
});
/* Anuncio en inmersiva: visual grande, titular, insignia, CTA */
function showImmersiveAd(a, paid) {
  const hue = paid ? 200 : (a.hue || 210);
  const badge = paid
    ? (AD_BADGE_LABEL[a.badge] || 'Patrocinado')
    : ((typeof AD_BADGE_LABEL !== 'undefined' && AD_BADGE_LABEL[a.badge]) || a.badge || 'Espacio disponible');
  const mine = paid && a.advertiser === displayName();
  const visual = a.photoUrl
    ? `<img src="${esc(a.photoUrl)}" alt="${esc(a.name)}" style="width:100%;height:100%;object-fit:cover">`
    : `<span>${esc(a.emoji)}</span>`;
  openImmersive({
    visual,
    bg: a.photoUrl ? '' : `linear-gradient(150deg,hsl(${hue},60%,50%),hsl(${(hue + 40) % 360},55%,30%))`,
    badge,
    title: a.name,
    sub: paid ? t('adDaysLeft', { n: a.daysLeft, ps: a.daysLeft === 1 ? '' : 's' }) : t('adFeatSub'),
    cta: mine ? t('adRenew') : (paid ? t('adBuyNow') : t('adHere')),
    tag: 'ANUNCIO',
    onCta: mine
      ? () => { closeImmersive(); showAdModal(a); }
      : paid
        ? () => {
            const url = String(a.url || '');
            if (/^https?:\/\//i.test(url)) window.open(url, '_blank', 'noopener');
            else toast('Este anunciante aún no tiene tienda vinculada');
          }
        : () => { closeImmersive(); showAdModal(null); },
  });
}
/* Best Offer: la comunidad de Alejandro en inmersiva (logo real, solo en su espacio) */
const BEST_OFFER_URL = 'https://facebook.com/groups/1620696721546400/';
function showImmersiveBestOffer() {
  openImmersive({
    visual: `<img src="img/best-offer-logo.jpg" alt="Best Offer" loading="lazy" decoding="async">`,
    badge: t('adCommunity'),
    title: 'Best Offer',
    sub: t('adBestOfferSub'),
    cta: 'Abrir grupo',
    tag: 'COMUNIDAD',
    onCta: () => { window.open(BEST_OFFER_URL, '_blank', 'noopener'); },
  });
}
/* Libro destacado en inmersiva: portada grande, título, autor, precio, Leer */
function showImmersiveBook(b) {
  const visual = b.coverUrl
    ? `<img src="${esc(b.coverUrl)}" alt="${t('kpCoverAlt', { title: esc(b.title) })}">`
    : `<div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:flex-end;padding:22px;${coverStyle(b.id)}"><div class="cover-title" style="font-size:24px">${esc(b.title)}</div><div class="cover-author">${esc(b.author)}</div></div>`;
  openImmersive({
    visual,
    badge: '⭐ Destacado',
    title: b.title,
    sub: `${b.author}`,
    subHtml: `<span class="creator-link" data-creator="${esc(b.author)}">${esc(b.author)}</span> · <span class="tile-rating" id="immRating">${ratingText(b)}</span>`,
    cta: t('tileReadNow'),
    tag: 'TINTAJUNTA',
    onCta: () => { closeImmersive(); openBook(b.id); },
  });
  const ir = $('immRating');
  /* v169: las estrellas de la inmersiva abrían "Reportar libro" (copy-paste);
     como en las tarjetas, deben abrir las reseñas. El 🚩 discreto sigue
     siendo la vía para reportar. */
  if (ir) ir.onclick = (e) => { e.stopPropagation(); closeImmersive(); showReviewModal(b.id, b.title); };
  // Botón discreto 🚩 Reportar en la inmersiva
  const imm = $('immersive');
  let rb = $('immReport');
  if (!rb) {
    rb = document.createElement('button');
    rb.id = 'immReport';
    rb.className = 'imm-report';
    rb.title = t('repBtnTitle');
    rb.textContent = '🚩';
    imm.appendChild(rb);
  }
  rb.style.display = '';
  rb.onclick = (e) => { e.stopPropagation(); closeImmersive(); showReportModal(b.id, b.title); };
  // v71 — 📤 Compartir en la inmersiva (crecimiento viral)
  let sb = $('immShare');
  if (!sb) {
    sb = document.createElement('button');
    sb.id = 'immShare';
    sb.className = 'imm-share';
    sb.title = t('buyShareTitle');
    sb.textContent = '📤';
    imm.appendChild(sb);
  }
  sb.style.display = '';
  sb.onclick = (e) => { e.stopPropagation(); shareBook(b); };
}
/* ---------- carrusel principal estilo Tubi (100% manual: sin auto-avance) ---------- */
let heroIdx = 0, heroSlides = [], lastHeroRotate = 0;
const isNewBook = (b) => (Date.now() - (b.createdAt || 0)) < 14 * 24 * 3600 * 1000;
/* v165: elección editorial semanal — un libro NUEVO rota cada lunes en el hero.
   "Los nuevos" = los 4 clásicos agregados más recientemente (la última tanda;
   hoy: MSTRKY + Douglass + Da Vinci + Dostoievski). No desplaza destacados
   pagados (van primero, intactos); ocupa el lugar del libro de respaldo
   ("La tinta compartida") cuando no hay de pago. Determinista: misma semana
   = mismo libro, sin temporizadores ni movimiento automático. */
const HERO_WEEK_MS = 7 * 24 * 3600 * 1000;
const HERO_MONDAY0 = Date.UTC(2026, 9, 12); // lunes 2026-10-12 00:00 UTC: las semanas cambian cada lunes
const HERO_NEW_N = 4;
function heroWeeklyPick() {
  const lib = (typeof libBooksCache !== 'undefined' ? libBooksCache : [])
    .filter((b) => b && b.classic && b.createdAt);
  if (!lib.length) return null;
  const byId = (a, b) => (a.id < b.id ? -1 : (a.id > b.id ? 1 : 0));
  const pool = lib.slice()
    .sort((a, b) => (b.createdAt - a.createdAt) || byId(a, b)) // más recientes primero
    .slice(0, HERO_NEW_N)
    .sort((a, b) => (a.createdAt - b.createdAt) || byId(a, b)); // el más antiguo de la tanda abre la rotación
  const weekIdx = Math.floor((Date.now() - HERO_MONDAY0) / HERO_WEEK_MS);
  return pool[((weekIdx % pool.length) + pool.length) % pool.length];
}
function heroSlideBook(b) {
  const bgDiv = b.coverUrl
    ? `<div class="hero-bg" style="background-image:url('${esc(b.coverUrl)}')"></div>`
    : '';
  const bg = b.coverUrl ? '' : coverStyle(b.id);
  const tags = `<div class="hero-tags"><span class="hero-tag">⭐ DESTACADO</span>` +
    (isNewBook(b) ? `<span class="hero-tag">🆕 NUEVO</span>` : '') + `</div>`;
  const meta = `<span class="creator-link" data-creator="${esc(b.author)}">${esc(b.author)}</span> · 🎨 ${b.marks || 0} · 💬 ${b.notes || 0}`;
  const desc = (b.marks || b.notes)
    ? t('communityMarks', { marks: b.marks || 0, notes: b.notes || 0 })
    : `Sé de los primeros en leerlo y marcarlo con tu tinta.`;
  return `<div class="hero-slide" style="${bg}">
    ${bgDiv}
    <div class="hero-shade"></div>
    ${tags}
    <div class="hero-title">${esc(b.title)}</div>
    <div class="hero-sub">${meta}</div>
    <div class="hero-desc">${desc}</div>
    <button class="hero-cta-round" data-book="${b.id}">▶ Leer ahora</button>
  </div>`;
}
function heroSlideAd(a, paid) {
  const badgeTxt = paid ? 'Patrocinado' : ((typeof AD_BADGE_LABEL !== 'undefined' && AD_BADGE_LABEL[a.badge]) || a.badge || 'Espacio disponible');
  // Fondo editorial sobrio para anuncios sin foto
  const bgStyle = a.photoUrl
    ? `background-image:url('${esc(a.photoUrl)}');background-size:cover;background-position:center`
    : `background:linear-gradient(135deg,#2b3a4a 0%,#1e3a5f 55%,#141c28 100%)`;
  const emojiHtml = a.photoUrl ? '' : `<div class="hero-emoji">${esc(a.emoji)}</div>`;
  return `<div class="hero-slide hero-ad" style="${bgStyle}">
    <div class="hero-shade"></div>
    ${emojiHtml}
    <div class="hero-tags"><span class="hero-tag">🛍️ ANUNCIO</span><span class="hero-tag">${esc(badgeTxt)}</span></div>
    <div class="hero-title">${esc(a.name)}</div>
    <div class="hero-sub">${paid ? '⏳ ' + a.daysLeft + ' días en portada' : 'Lo más famoso para leer mejor'}</div>
    <div class="hero-desc">Un anunciante paga por estar aquí. Tócalo para verlo en grande.</div>
  </div>`;
}
function renderHero(featBooks) {
  const car = document.getElementById('heroCarousel');
  const track = document.getElementById('heroTrack');
  const dots = document.getElementById('heroDots');
  if (!car || !track) return;
  heroSlides = [];
  (featBooks || []).slice(0, 3).forEach((b) => heroSlides.push({ html: heroSlideBook(b), book: b }));
  // v165: libro nuevo de la semana (rotación automática cada lunes) tras los destacados de pago
  const weekly = heroWeeklyPick();
  if (weekly && !heroSlides.some((s) => s.book && s.book.id === weekly.id)) {
    heroSlides.push({ html: heroSlideBook(weekly), book: weekly });
  }
  // Garantía editorial: al menos un slide de LIBRO aunque no haya destacados ni novedades
  if (!heroSlides.length && libBooksCache.length) {
    const b = libBooksCache[0];
    heroSlides.push({ html: heroSlideBook(b), book: b });
  }
  paidAds.slice(0, 2).forEach((a) => heroSlides.push({ html: heroSlideAd(a, true), ad: a, adPaid: true }));
  if (!heroSlides.length) { car.classList.add('hidden'); return; }
  car.classList.remove('hidden');
  // v171: conserva la posición manual del usuario entre re-renders (nada se mueve solo):
  // si deslizó al slide 2 y una acción re-renderiza, el hero ya no salta al slide 0.
  heroIdx = Math.max(0, Math.min(heroIdx, heroSlides.length - 1));
  track.innerHTML = heroSlides.map((s) => s.html).join('');
  dots.innerHTML = heroSlides.map((_, i) => `<span class="hero-dot${i === heroIdx ? ' on' : ''}" data-i="${i}"></span>`).join('');
  track.querySelectorAll('.hero-cta-round').forEach((btn) => {
    btn.onclick = (e) => { e.stopPropagation(); openBook(btn.dataset.book); };
  });
  // Tocar un slide abre la vista inmersiva SOLO por toque directo del usuario
  // (guardias anti-deslizamiento y anti-rotación: iOS puede disparar clicks fantasma)
  let heroSwipedAt = 0;
  track.querySelectorAll('.hero-slide').forEach((sl, i) => {
    sl.style.cursor = 'pointer';
    sl.addEventListener('click', () => {
      if (Date.now() - heroSwipedAt < 600) return; // después de deslizar
      if (Date.now() - lastHeroRotate < 600) return; // justo después de rotar
      const s = heroSlides[i];
      if (!s) return;
      if (s.book) showImmersiveBook(s.book);
      else if (s.ad) showImmersiveAd(s.ad, s.adPaid);
    });
  });
  dots.querySelectorAll('.hero-dot').forEach((d) => {
    d.onclick = () => heroGo(+d.dataset.i);
  });
  let sx = null;
  track.ontouchstart = (e) => { sx = e.touches[0].clientX; };
  track.ontouchmove = (e) => {
    if (sx === null) return;
    const dx = e.touches[0].clientX - sx;
    if (Math.abs(dx) > 50) { heroSwipedAt = Date.now(); heroGo(heroIdx + (dx < 0 ? 1 : -1)); sx = null; }
  };
  track.ontouchend = () => { sx = null; };
  // Posición conservada en heroIdx (ver arriba); sincroniza el track sin disparar
  // la guardia anti-rotación de toques (esto no es una rotación, es un re-render).
  track.style.transform = `translateX(-${heroIdx * 100}%)`;
  paintLevelBadges(car);
}
function heroGo(i) {
  const track = document.getElementById('heroTrack');
  if (!track || !heroSlides.length) return;
  heroIdx = (i + heroSlides.length) % heroSlides.length;
  lastHeroRotate = Date.now();
  track.style.transform = `translateX(-${heroIdx * 100}%)`;
  document.querySelectorAll('#heroDots .hero-dot').forEach((d, j) =>
    d.classList.toggle('on', j === heroIdx));
}
const popularity = (b) => (b.marks || 0) + (b.notes || 0) * 2;

/* ---------------- Google AdSense ----------------
   Slots en la página principal (biblioteca). NUNCA en la sala de lectura.
   ADSENSE_CLIENT vacío → placeholder discreto "Espacio publicitario".
   Con Publisher ID → carga el script de AdSense y renderiza anuncios reales. */
let adsenseLoaded = false;
function renderAdSenseSlots() {
  const slots = document.querySelectorAll('.adsense-slot');
  if (!slots.length) return;
  if (!ADSENSE_CLIENT) {
    // Sin Publisher ID: placeholder discreto para que Alejandro vea dónde van
    const label = (typeof t === 'function') ? t('adsensePh') : 'Espacio publicitario';
    slots.forEach((s) => {
      s.innerHTML = '<span class="adsense-ph">' + esc(label) + '</span>';
    });
    return;
  }
  // Con Publisher ID: anuncios reales de Google
  if (!adsenseLoaded) {
    adsenseLoaded = true;
    // v140: el script ya va estático en <head> (verificación AdSense); no duplicar
    if (!document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]')) {
      const sc = document.createElement('script');
      sc.async = true;
      sc.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(ADSENSE_CLIENT);
      sc.crossOrigin = 'anonymous';
      document.head.appendChild(sc);
    }
  }
  slots.forEach((s) => {
    if (s.dataset.adsDone) return;
    s.dataset.adsDone = '1';
    s.innerHTML = '<ins class="adsbygoogle" style="display:block" data-ad-client="' + esc(ADSENSE_CLIENT) + '" data-ad-format="auto" data-full-width-responsive="true"></ins>';
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); }
    catch (e) { /* AdSense aún cargando */ }
  });
  // v141: si el anuncio no se llenó (sitio aún sin aprobar por Google,
  // bloqueador de anuncios o fallo de red), colapsar el slot en vez de
  // dejar un hueco vacío en la biblioteca. Revisión única por carga.
  if (!window.__adsCollapseDone) {
    window.__adsCollapseDone = true;
    setTimeout(() => {
      document.querySelectorAll('.adsense-slot').forEach((s) => {
        const ins = s.querySelector('ins.adsbygoogle');
        if (!ins || ins.getAttribute('data-ad-status') !== 'filled') s.style.display = 'none';
      });
    }, 6000);
  }
}

async function showLibrary(push) {
  setViewState('library', push);
  document.body.classList.remove('book-room'); // v124: limpieza al volver a la biblioteca
  const lib = $('library');
  lib.classList.remove('hidden');
  lib.classList.remove('view-enter'); void lib.offsetWidth; lib.classList.add('view-enter');
  $('join').classList.add('hidden');
  $('writing').classList.add('hidden');
  closeDrawer();
  currentBook = null;
  renderContinueReading(); // v68: tu lectura actual, primero
  // skeleton mientras carga (nunca en blanco)
  renderHeroSkeleton();
  try {
    // v135: reintentos automáticos — si la señal es débil o el servidor
    // se está reiniciando por una actualización, reintenta solo antes de
    // mostrar el error (antes fallaba al primer intento de 10s).
    let r = null, lastErr = null;
    for (let intento = 0; intento < 3 && !r; intento++) {
      try {
        const rr = await fetchTimeout('/api/books', 10000);
        if (!rr.ok) throw new Error('http ' + rr.status);
        r = rr;
      } catch (e) {
        lastErr = e;
        if (intento < 2) await new Promise((res) => setTimeout(res, 2500));
      }
    }
    if (!r) throw lastErr || new Error('net');
    const d = await r.json();
    libBooksCache = d.books || [];
    window.__tjBooksReady = true; // v71: deep link ?libro=ID puede abrir
    if (pruneOrphanProgress()) renderContinueReading(); // v145: sin tarjetas huérfanas
    const feat = libBooksCache.filter((b) => b.featured);
    renderHero(feat); // carrusel manual: destacados + anuncios
    lastFeat = feat;
    renderRows();
    renderAdSenseSlots(); // Google Ads: solo en la biblioteca, nunca en la sala
    paintLevelBadges($('heroCarousel'));
  } catch (e) {
    $('heroCarousel').classList.add('hidden');
    libError('No se pudo cargar la biblioteca. Revisa tu conexión.', () => showLibrary(false));
  }
}
/* Skeleton del hero mientras carga */
function renderHeroSkeleton() {
  const car = document.getElementById('heroCarousel');
  const track = document.getElementById('heroTrack');
  const dots = document.getElementById('heroDots');
  if (!car || !track) return;
  car.classList.remove('hidden');
  track.innerHTML = '<div class="hero-slide hero-skeleton"><div class="hero-shade"></div><div class="skel-line" style="width:60%"></div><div class="skel-line" style="width:40%"></div></div>';
  if (dots) dots.innerHTML = '';
}
/* Fila estilo IMDb: ránking, portada pequeña, título y datos. */
/* Portada: si el creador subió una imagen se usa; si no, la automática. */
function coverInner(b, small) {
  if (b.coverUrl) {
    return `<img src="${esc(b.coverUrl)}" alt="${t('kpCoverAlt', { title: esc(b.title) })}" class="cover-img" loading="lazy">`;
  }
  if (small) return `<span>${esc(b.title.slice(0, 2).toUpperCase())}</span>`;
  return `<div class="cover-title">${esc(b.title)}</div><div class="cover-author">${esc(b.author)}</div><div class="cover-imprint">TINTAJUNTA</div>`;
}
function bookRow(b, rank) {
  const row = document.createElement('div');
  row.className = 'book-row';
  const mine = b.author === displayName() && myName !== t('joinDefaultName');
  const act = popularity(b);
  row.innerHTML =
    `<div class="rank-badge">#${rank}</div>` +
    `<div class="row-cover" style="${b.coverUrl ? '' : coverStyle(b.id)}">${coverInner(b, true)}</div>` +
    `<div class="row-main">` +
      `<div class="row-title">${esc(b.title)}</div>` +
      `<div class="row-meta"><span class="creator-link" data-creator="${esc(b.author)}">${esc(b.author)}</span> · 🎨 ${b.marks || 0} · 💬 ${b.notes || 0}` +
      `</div>` +
    `</div>` +
    `<button class="info-btn" data-act="info" title="${t('libViewRecord')}">i</button>` +
    `<button class="btn row-btn" data-act="open">${t('libReadBtn')}</button>` +
    (mine ? `<button class="linklike" data-act="feature" title="${t('tileFeatureTitle')}">⭐</button>` : '');
  row.querySelector('[data-act="open"]').onclick = () => openBook(b.id);
  row.querySelector('[data-act="info"]').onclick = () => openBook(b.id);
  const fbtn = row.querySelector('[data-act="feature"]');
  if (fbtn) fbtn.onclick = (e) => { e.stopPropagation(); showFeature(b); };
  row.querySelector('.row-cover').onclick = () => openBook(b.id);
  return row;
}
/* Tarjeta con portada grande (sección Destacados). */
/* Portada automática: 4 variantes editoriales por libro + textura sutil. Sin subir imágenes. */
function coverStyle(id) {
  // Paleta editorial sofisticada — nada de tonos brillantes infantiles
  const palettes = [
    ['#1e3a5f', '#142a45', '#0f2033'],  // azul tinta
    ['#2b2b2b', '#1a1a1a', '#0f0f0f'],  // carbón
    ['#8a5a1e', '#6e4715', '#54360f'],  // dorado apagado
    ['#3d4a3d', '#2c362c', '#1e251e'],  // verde bosque apagado
    ['#5a4a3a', '#453a2e', '#33291f'],  // tierra cálida
    ['#4a4a5a', '#383844', '#282832'],  // gris pizarra
  ];
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % palettes.length;
  const [c1, c2, c3] = palettes[h];
  const dots = 'radial-gradient(rgba(255,255,255,.06) 1px, transparent 1.6px) 0 0/14px 14px';
  const g = `linear-gradient(150deg,${c1} 0%,${c2} 65%,${c3} 100%)`;
  return `background:${dots},${g}`;
}
function bookCard(b, isFeat) {
  const card = document.createElement('div');
  card.className = 'book-card' + (isFeat ? ' book-feat' : '');
  const mine = b.author === displayName() && myName !== t('joinDefaultName');
  // Actividad de la comunidad en este libro (la cuenta la envía el servidor)
  const activity = (b.marks || b.notes)
    ? `<p class="book-activity">🎨 ${b.marks || 0} · 💬 ${b.notes || 0}</p>`
    : '';
  card.innerHTML =
    `<div class="book-cover" style="${b.coverUrl ? '' : coverStyle(b.id)}">` +
    (isFeat ? '<div class="feat-badge">⭐ DESTACADO</div>' : '') +
    coverInner(b, false) + `</div>` +
    `<div class="book-info">` +
    `<div class="book-foot">${activity}</div>` +
    `<button class="btn" data-act="open">${t('libReadBtn')}</button>` +
    (mine && !isFeat ? `<button class="linklike" data-act="feature">⭐ Destacar</button>` : '') +
    `</div>`;
  card.querySelector('[data-act="open"]').onclick = () => openBook(b.id);
  const fbtn = card.querySelector('[data-act="feature"]');
  if (fbtn) fbtn.onclick = (e) => { e.stopPropagation(); showFeature(b); };
  // Tocar la portada también abre el libro
  card.querySelector('.book-cover').onclick = () => openBook(b.id);
  return card;
}

/* v157: toques repetidos sobre el mismo libro mientras carga no lanzan
   fetches paralelos (cada fallo era un aviso apilado). */
const openingBooks = new Set();
let openBookSeq = 0; // v167: número de secuencia — la última apertura pedida gana
async function openBook(id, push) {
  const mySeq = ++openBookSeq; // v167: si el usuario toca otro libro mientras
  // este carga (señal débil: el meta tarda 15s+reintento), la apertura vieja
  // se retira en silencio en vez de pisar el libro que sí se pidió al final.
  syncNameFromLib();
  if (openingBooks.has(id)) return;
  openingBooks.add(id);
  /* v163: el aviso solo si tarda — desde caché el libro abre al instante y
     no necesita aviso (antes se apilaba con "Conexión recuperada", etc.). */
  let openToastT = null;
  try { openToastT = setTimeout(() => toast(t('openingBook')), 300); } catch (e) {}
  const clearOpenToast = () => { try { if (openToastT) clearTimeout(openToastT); } catch (e) {} };
  /* v162: primero el META (pocos KB); el texto completo (~3MB) es lo que
     mataba la apertura en señal débil. Errores distintos para diagnósticos
     distintos: 404 = no existe, timeout = tardó demasiado, resto = red. */
  let meta = null, failKind = 'net';
  const cacheId = String(id || '').toUpperCase(); // v163: clave de caché normalizada
  try {
    /* v163: meta desde caché primero — sin red también abre */
    try {
      const cm = await idbCache.get('meta', cacheId);
      if (cm && cm.meta) meta = cm.meta;
    } catch (e) {}
    if (!meta) {
      for (let intento = 0; intento < 2 && !meta; intento++) {
        try {
          const r = await fetchTimeout('/api/books/' + encodeURIComponent(id) + '/meta', 15000);
          if (r.status === 404) { failKind = 'missing'; break; }
          if (!r.ok) throw r.status;
          const d = await r.json();
          if (!d.ok || !d.meta) throw 'bad-meta';
          meta = d.meta;
        } catch (e) {
          if (failKind === 'missing') break;
          failKind = (e && e.name === 'AbortError') ? 'timeout' : 'net';
          if (intento === 0) await new Promise((res) => setTimeout(res, 1200));
        }
      }
      if (meta) { try { idbCache.put('meta', { id: cacheId, meta, ts: Date.now() }); } catch (e) {} }
    } else {
      /* v167: el meta vino de caché — revalidar la huella en segundo plano.
         Sin esto, un texto actualizado en el servidor (merge-books) nunca
         llegaría a quien ya abrió el libro una vez: "si hubo caché, la red
         ni se toca" era verdad también para el meta fresco. */
      revalidateBookMeta(cacheId, meta);
    }
    if (!meta) throw failKind;
  } catch (e) {
    clearOpenToast();
    dismissToast(t('openingBook'));
    if (mySeq !== openBookSeq) return; // v167: apertura vieja, silencio
    if (failKind === 'missing') { clearProgress(id); toast(t('bookNotFound')); } // v145: el libro ya no existe, no dejar tarjeta huérfana
    else if (failKind === 'timeout') toast(t('bookTimeout'));
    else toast(t('buyLoadErr'));
    return;
  } finally {
    openingBooks.delete(id);
  }
  clearOpenToast();
  if (mySeq !== openBookSeq) return; // v167: otra apertura tomó el control
  // Todos los libros son gratis: se abren directo
  // Advertencia de contenido adulto
  if (meta.ageRating === '18' && !sessionStorage.getItem('tj_age_ok_' + meta.id)) {
    dismissToast(t('openingBook'));
    $('ageText').textContent = t('buyRated18', { title: meta.title });
    $('agePop').classList.remove('hidden');
    $('ageCancel').onclick = () => $('agePop').classList.add('hidden');
    $('ageConfirm').onclick = () => {
      $('agePop').classList.add('hidden');
      if (mySeq !== openBookSeq) return; // v167: la confirmación tardía no pisa
      sessionStorage.setItem('tj_age_ok_' + meta.id, '1');
      bootBook(meta, push);
    };
    return;
  }
  bootBook(meta, push);
}
/* v167: revalidación silenciosa del meta cuando se abrió desde caché.
   Compara contentHash con el servidor; si el texto cambió, purga los rangos
   cacheados y avisa para reabrir (no se recarga a mitad de lectura: la vista
   actual sigue intacta, nada se pierde). Sin red falla en silencio. */
async function revalidateBookMeta(cacheId, cachedMeta) {
  try {
    const r = await fetchTimeout('/api/books/' + encodeURIComponent(cacheId) + '/meta', 8000);
    if (!r.ok) return;
    const d = await r.json();
    const fresh = d && d.ok && d.meta;
    if (!fresh) return;
    if (fresh.contentHash && cachedMeta.contentHash && fresh.contentHash !== cachedMeta.contentHash) {
      try { await idbCache.delBook('paras', cacheId); } catch (e) {}
      try { await idbCache.put('meta', { id: cacheId, meta: fresh, ts: Date.now() }); } catch (e) {}
      if (currentBook && currentBook.id === cacheId) toast(t('bookUpdated'));
    } else if (fresh.contentHash && !cachedMeta.contentHash) {
      try { await idbCache.put('meta', { id: cacheId, meta: fresh, ts: Date.now() }); } catch (e) {}
    }
  } catch (e) { /* sin red: la caché sigue valiendo, sin aviso */ }
}

/* Pagos reales con Stripe. En la versión real aquí va Stripe */
let featurePending = null, featurePlan = 'week';

/* ---------- Stripe: helper de pago con tarjeta ---------- */
let stripeJs = null, stripeCard = null, stripeKeyCache = null;
/* v144: Stripe solo se descarga cuando alguien va a pagar (ya no bloquea el arranque) */
function loadStripeScript() {
  return new Promise((resolve, reject) => {
    if (typeof Stripe !== 'undefined') return resolve();
    if (document.querySelector('script[data-stripe-js]')) {
      // Ya en camino: esperar a que cargue
      const t = setInterval(() => {
        if (typeof Stripe !== 'undefined') { clearInterval(t); resolve(); }
      }, 100);
      setTimeout(() => { clearInterval(t); reject(new Error('stripe-js-missing')); }, 15000);
      return;
    }
    const sc = document.createElement('script');
    sc.src = 'https://js.stripe.com/v3/';
    sc.async = true;
    sc.dataset.stripeJs = '1';
    sc.onload = resolve;
    sc.onerror = () => reject(new Error('stripe-js-missing'));
    document.head.appendChild(sc);
  });
}
async function getStripeJs() {
  if (stripeJs) return stripeJs;
  if (typeof Stripe === 'undefined') await loadStripeScript();
  if (typeof Stripe === 'undefined') throw new Error('stripe-js-missing');
  if (!stripeKeyCache) {
    const r = await fetch('/api/stripe-key');
    const d = await r.json().catch(() => ({}));
    if (!d.ok || !d.enabled || !d.publishableKey) throw new Error('stripe-disabled');
    stripeKeyCache = d.publishableKey;
  }
  stripeJs = Stripe(stripeKeyCache);
  return stripeJs;
}
/* Flujo de pago: crea la Checkout Session en el servidor y redirige a Stripe.
 * Guarda el pago pendiente en localStorage; al volver de Stripe (?pago=ok),
 * initCheckoutReturn() lo finaliza. Devuelve el sessionId. */
function payWithStripe({ type, intentParams, description, amountCents }) {
  return new Promise(async (resolve, reject) => {
    // 1. Crear la Checkout Session en el servidor
    let intent;
    try {
      const r = await fetch('/api/payments/intent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...intentParams }),
      });
      intent = await r.json();
      if (!intent.ok || !intent.checkoutUrl) throw new Error(intent.error || 'intent-failed');
    } catch (e) { reject(e); return; }
    // 2. Guardar el pendiente y redirigir a Stripe Checkout (página segura de Stripe)
    try {
      localStorage.setItem('tj_pending_session', intent.sessionId);
      localStorage.setItem('tj_pending_payment', JSON.stringify({ type, params: intentParams || {}, ts: Date.now() }));
    } catch (e) {}
    window.location.href = intent.checkoutUrl;
    // La promesa se resuelve al volver de Stripe (ver initCheckoutReturn)
    setTimeout(() => resolve(intent.sessionId), 1000);
  });
}
/* Al volver de Stripe Checkout (?pago=ok / ?pago=cancelado), finaliza el pago pendiente */
async function initCheckoutReturn() {
  let q;
  try { q = new URLSearchParams(location.search); } catch (e) { return; }
  const pago = q.get('pago');
  if (pago !== 'ok' && pago !== 'cancelado') return;
  try { history.replaceState(null, '', location.pathname); } catch (e) {}
  const clearPending = () => {
    try {
      localStorage.removeItem('tj_pending_session');
      localStorage.removeItem('tj_pending_payment');
      sessionStorage.removeItem('tj_pending_photo');
    } catch (e) {}
  };
  if (pago === 'cancelado') { clearPending(); toast('Pago cancelado'); return; }
  let pend = null, sid = null;
  try {
    pend = JSON.parse(localStorage.getItem('tj_pending_payment') || 'null');
    sid = localStorage.getItem('tj_pending_session');
  } catch (e) {}
  clearPending();
  if (!pend || !sid || !pend.params || (Date.now() - (pend.ts || 0)) > 24 * 3600e3) {
    toast('✅ Pago recibido'); return;
  }
  try {
    if (pend.type === 'feature') await finalizeFeature(pend.params.bookId, pend.params.plan, pend.params.author, sid);
    else if (pend.type === 'ad') await finalizeAd(pend.params, sid);
    else toast('✅ Pago recibido');
  } catch (e) {
    clog('finalize pago falló: ' + (e && e.message));
    toast('No se pudo confirmar el pago');
  }
}
/* Finaliza un destacado al volver de Stripe */
async function finalizeFeature(bookId, plan, author, sessionId) {
  // v164: timeout anti-cuelgue (20s); claimPayment en el servidor ya evita doble cobro
  const r = await fetchTimeout('/api/books/' + encodeURIComponent(bookId) + '/feature', 20000, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, author, sessionId }),
  });
  if (needLogin(r)) return; // 401: aviso honesto, sin doble toast
  const d = await r.json().catch(() => ({}));
  if (!d.ok) throw new Error(d.error || 'feature-failed');
  toast('⭐ ¡Tu libro está destacado en portada!');
  try { showLibrary(false); } catch (e) {}
}
/* Finaliza un anuncio pagado al volver de Stripe (sube la foto si se eligió una) */
async function finalizeAd(params, sessionId) {
  // v164: timeout anti-cuelgue (20s) + cid para no duplicar el anuncio ante reintento
  const r = await fetchTimeout('/api/ads', 20000, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, sessionId, cid: makeCid() }),
  });
  if (needLogin(r)) return; // 401: aviso honesto, sin doble toast
  const d = await r.json().catch(() => ({}));
  if (!d.ok) throw new Error(d.error || 'ad-failed');
  const adId = (d.ad && d.ad.id) || params.id;
  let photoData = null;
  try { photoData = sessionStorage.getItem('tj_pending_photo'); } catch (e) {}
  if (photoData && adId) {
    try {
      const blob = await (await fetch(photoData)).blob();
      const fd = new FormData();
      fd.append('photo', blob, 'foto.jpg');
      fd.append('advertiser', params.advertiser);
      await fetchTimeout('/api/ads/' + encodeURIComponent(adId) + '/photo', 30000, { method: 'POST', body: fd });
    } catch (e) { /* la foto es opcional */ }
  }
  toast(params.id ? t('adRenewed') : t('adOk'));
  try { renderAds(); } catch (e) {}
}
/* Modal para destacar un libro propio en portada */
async function showFeature(b) {
  syncNameFromLib();
  featurePending = b;
  featurePlan = 'week';
  $('featureBookTitle').textContent = b.title;
  // precios del servidor
  let prices = { day: 199, week: 799, month: 1999 };
  try {
    const r = await fetch('/api/feature-prices');
    const d = await r.json();
    if (d.ok && d.prices) prices = d.prices;
  } catch (e) { /* usar valores por defecto */ }
  const plans = $('featurePlans');
  plans.innerHTML = '';
  [['day', t('planDay'), prices.day], ['week', t('planWeek'), prices.week], ['month', t('planMonth'), prices.month]].forEach(([key, label, cents]) => {
    const row = document.createElement('label');
    row.className = 'plan-row' + (key === featurePlan ? ' sel' : '');
    row.innerHTML = `<input type="radio" name="fplan" value="${key}" ${key === featurePlan ? 'checked' : ''}>` +
      `<span><b>${label}</b> — ${fmtPrice(cents)}</span>`;
    row.querySelector('input').onchange = () => {
      featurePlan = key;
      plans.querySelectorAll('.plan-row').forEach((el) => el.classList.remove('sel'));
      row.classList.add('sel');
    };
    plans.appendChild(row);
  });
  $('featurePop').classList.remove('hidden');
}
/* v71 — 📤 Compartir libro: Web Share API con respaldo a portapapeles.
 * El link lleva ?libro=ID para abrir el libro directo al entrar. */
async function shareBook(book) {
  if (!book) return;
  const url = location.origin + '/?libro=' + encodeURIComponent(book.id);
  const text = t('shareText', { title: book.title, author: book.author });
  try {
    if (navigator.share) {
      await navigator.share({ title: book.title, text, url });
      return;
    }
    throw new Error('no-share');
  } catch (e) {
    if (e && e.name === 'AbortError') return; // el usuario canceló
    try {
      await navigator.clipboard.writeText(text + '\n' + url);
      toast('📋 Enlace copiado — pégalo donde quieras');
    } catch (ce) {
      prompt('Copia el link:', url);
    }
  }
}
/* v79 — 🎨 Creador de portadas para publicar libros.
 * Paletas editoriales + textura + vista previa en vivo → render a canvas → blob para subir. */
let generatedCoverBlob = null;
const COVER_PALETTES = [
  { name: t('palInkBlue'),  c: ['#1e3a5f', '#142a45', '#0f2033'] },
  { name: t('palCharcoal'),      c: ['#2b2b2b', '#1a1a1a', '#0f0f0f'] },
  { name: t('palGold'),      c: ['#8a5a1e', '#6e4715', '#54360f'] },
  { name: t('palForest'),      c: ['#3d4a3d', '#2c362c', '#1e251e'] },
  { name: t('palEarth'),      c: ['#5a4a3a', '#453a2e', '#33291f'] },
  { name: t('palSlate'),     c: ['#4a4a5a', '#383844', '#282832'] },
];
let coverMakerState = { pal: 0, pat: 'dots' };
function coverMakerCSS(pal, pat) {
  const [c1, c2, c3] = COVER_PALETTES[pal].c;
  let tex = '';
  if (pat === 'dots') tex = 'radial-gradient(rgba(255,255,255,.07) 1px, transparent 1.6px) 0 0/14px 14px,';
  else if (pat === 'lines') tex = 'repeating-linear-gradient(45deg, rgba(255,255,255,.04) 0 2px, transparent 2px 12px),';
  return `background:${tex}linear-gradient(150deg,${c1} 0%,${c2} 65%,${c3} 100%)`;
}
function updateCoverPreview() {
  const pv = $('coverPreview');
  if (!pv) return;
  pv.style.cssText = coverMakerCSS(coverMakerState.pal, coverMakerState.pat) +
    ';aspect-ratio:2/3;border-radius:6px;overflow:hidden;position:relative;display:flex;flex-direction:column;justify-content:flex-end;padding:12px;box-shadow:0 2px 8px rgba(0,0,0,.2)';
  const pvTitle = ($('pubTitle') && $('pubTitle').value.trim()) || t('pubYourTitle');
  $('coverPreviewTitle').textContent = pvTitle;
  $('coverPreviewAuthor').textContent = (typeof myName !== 'undefined' && myName !== t('joinDefaultName')) ? myName : t('pubYourName');
}
function renderCoverToBlob() {
  return new Promise((resolve) => {
    const W = 600, H = 900;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    const [c1, c2, c3] = COVER_PALETTES[coverMakerState.pal].c;
    const g = x.createLinearGradient(0, 0, W * 0.7, H);
    g.addColorStop(0, c1); g.addColorStop(0.65, c2); g.addColorStop(1, c3);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // textura
    x.fillStyle = 'rgba(255,255,255,.06)';
    if (coverMakerState.pat === 'dots') {
      for (let i = 14; i < W; i += 42) for (let j = 14; j < H; j += 42) { x.beginPath(); x.arc(i, j, 3, 0, 7); x.fill(); }
    } else if (coverMakerState.pat === 'lines') {
      x.strokeStyle = 'rgba(255,255,255,.05)'; x.lineWidth = 4;
      for (let i = -H; i < W; i += 36) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + H, H); x.stroke(); }
    }
    // franja decorativa
    x.fillStyle = 'rgba(255,255,255,.14)'; x.fillRect(48, H - 260, 90, 6);
    // título + autor
    const title = ($('pubTitle') && $('pubTitle').value.trim()) || t('pubYourTitle');
    const author = (typeof myName !== 'undefined' && myName !== t('joinDefaultName')) ? myName : t('pubYourName');
    x.fillStyle = '#fff'; x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 8;
    x.font = '800 54px Georgia, serif';
    wrapText(x, title, 48, H - 210, W - 96, 66);
    x.shadowBlur = 0; x.font = '400 30px -apple-system, sans-serif';
    x.fillStyle = 'rgba(255,255,255,.88)';
    x.fillText(author, 48, H - 70, W - 96);
    cv.toBlob((b) => resolve(b), 'image/jpeg', 0.9);
  });
}
function wrapText(x, text, px, py, maxW, lh) {
  const words = text.split(' '); let line = '', y = py;
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (x.measureText(t).width > maxW && line) { x.fillText(line, px, y, maxW); line = w; y += lh; }
    else line = t;
    if (y > py + lh * 5) break;
  }
  x.fillText(line, px, y, maxW);
}
function initCoverMaker() {
  const tog = $('coverMakerToggle'), panel = $('coverMakerPanel');
  if (!tog || !panel || tog.dataset.init) return;
  tog.dataset.init = '1';
  tog.onclick = () => { panel.classList.toggle('hidden'); updateCoverPreview(); };
  // paletas
  const pw = $('coverPalettes');
  COVER_PALETTES.forEach((p, i) => {
    const s = document.createElement('button');
    s.type = 'button'; s.className = 'pal-swatch' + (i === 0 ? ' on' : '');
    s.title = p.name;
    s.style.background = `linear-gradient(150deg,${p.c[0]},${p.c[1]} 60%,${p.c[2]})`;
    s.onclick = () => {
      coverMakerState.pal = i;
      pw.querySelectorAll('.pal-swatch').forEach((el, j) => el.classList.toggle('on', j === i));
      updateCoverPreview();
    };
    pw.appendChild(s);
  });
  // patrones
  $('coverPatterns').querySelectorAll('.pat-btn').forEach((b) => {
    b.onclick = () => {
      coverMakerState.pat = b.dataset.pat;
      $('coverPatterns').querySelectorAll('.pat-btn').forEach((el) => el.classList.toggle('on', el === b));
      updateCoverPreview();
    };
  });
  // vista previa en vivo al escribir el título
  if ($('pubTitle')) $('pubTitle').addEventListener('input', updateCoverPreview);
  // usar portada generada
  $('coverUseBtn').onclick = async () => {
    const st = $('coverMakerStatus');
    st.textContent = t('pubCoverGen');
    try {
      const blob = await renderCoverToBlob();
      if (!blob) { st.textContent = '❌ No se pudo generar'; return; }
      generatedCoverBlob = new File([blob], 'portada.jpg', { type: 'image/jpeg' });
      st.textContent = t('pubCoverOk');
      toast('✅ Portada creada — lista para publicar');
    } catch (e) { st.textContent = '❌ Error al generar'; }
  };
}
function initLibrary() {
  buildSwatchesInto($('libSwatches'));
  $('libNameInput').value = myName === t('joinDefaultName') ? '' : myName;
  $('libNameInput').addEventListener('change', syncNameFromLib);
  // Modo profesor: tinta negra siempre, selector bloqueado
  const tc = $('teacherCheck');
  if (tc) {
    tc.checked = isTeacher;
    tc.onchange = () => {
      isTeacher = tc.checked;
      localStorage.setItem('tj_teacher', isTeacher ? '1' : '0');
      if (isTeacher) { myColor = 'negro'; localStorage.setItem('tj_color', 'negro'); }
      buildSwatchesInto($('libSwatches'));
      renderBoard();
      renderFollow();
      renderSwitchBookBtn();
      renderHands();
      toast(isTeacher ? t('teacherMode') : t('studentMode'));
    };
  }
  $('liveRoomBtn').onclick = goLiveRoom;
  $('backBtn').onclick = () => { goBack(); };
  $('publishBtn').onclick = () => {
    syncNameFromLib();
    $('pubTitle').value = '';
    $('pubText').value = '';
    $('pubCover').value = '';
    generatedCoverBlob = null;
    const st = $('coverMakerStatus'); if (st) st.textContent = '';
    const panel = $('coverMakerPanel'); if (panel) panel.classList.add('hidden');
    $('publishPop').classList.remove('hidden');
  };
  $('pubCancel').onclick = () => $('publishPop').classList.add('hidden');
  /* v79 — creador de portadas */
  initCoverMaker();
  $('pubSave').onclick = async () => {
    const title = $('pubTitle').value.trim();
    const price = 0; // todos los libros son gratis
    const text = $('pubText').value.trim();
    const ageRating = ($('pubAge') && $('pubAge').value) || 'all';
    if (!title || !text) { toast('Ponle título y texto a tu libro'); return; }
    // validar portada en el cliente (obligatoria, tipo y 2MB) — v79: acepta portada generada
    const coverFile = $('pubCover').files[0] || generatedCoverBlob || null;
    if (!coverFile) { toast('La portada es obligatoria — súbela o créala con 🎨'); return; }
    if (!$('pubContract').checked) { toast('Debes aceptar el contrato de publicación'); return; }
    if (coverFile) {
      const okType = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(coverFile.type);
      if (!okType) { toast('La portada debe ser JPG, PNG, WebP o GIF'); return; }
      if (coverFile.size > 2 * 1024 * 1024) { toast('La portada no puede pasar de 2MB'); return; }
    }
    $('pubSave').disabled = true;
    try {
      // v164: timeout anti-cuelgue (20s) + cid para no duplicar ante reintento tras timeout
      const pubCid = makeCid();
      const r = await fetchTimeout('/api/books', 20000, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, author: myName, price, text, ageRating, cid: pubCid }),
      });
      if (needLogin(r)) { $('pubSave').disabled = false; return; }
      const d = await r.json().catch(() => ({}));
      if (!d.ok) {
        if (d.error === 'plagiarism') { toast(`⚠️ Este texto coincide ${d.score || 70}% con otro libro — debe ser original`); }
        else if (d.error === 'too-long') { toast('⚠️ Máximo 500 párrafos por libro — acorta el texto'); }
        else toast('No se pudo publicar el libro');
        $('pubSave').disabled = false; return;
      }
      // subir portada si eligió una
      if (coverFile) {
        const fd = new FormData();
        fd.append('cover', coverFile);
        fd.append('author', myName);
        const cr = await fetchTimeout('/api/books/' + encodeURIComponent(d.book.id) + '/cover', 30000, {
          method: 'POST', body: fd,
        });
        const cd = await cr.json().catch(() => ({}));
        if (!cd.ok) toast('Libro publicado, pero la portada no se pudo subir');
      }
      // subir fotos del libro si eligió
      const imgFiles = ($('pubImages') && $('pubImages').files) || [];
      if (imgFiles.length) {
        const fd2 = new FormData();
        let okImg = 0;
        for (const f of imgFiles) {
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 2 * 1024 * 1024) continue;
          fd2.append('images', f); okImg++;
        }
        if (okImg) {
          fd2.append('author', myName);
          const ir = await fetchTimeout('/api/books/' + encodeURIComponent(d.book.id) + '/images', 30000, { method: 'POST', body: fd2 });
          const id2 = await ir.json().catch(() => ({}));
          if (!id2.ok) toast('Libro publicado, pero algunas fotos no se pudieron subir');
        }
      }
      $('pubCover').value = '';
      if ($('pubImages')) $('pubImages').value = '';
      $('publishPop').classList.add('hidden');
      if (d.status === 'pending') toast('📝 Libro enviado a revisión — saldrá en la biblioteca cuando sea aprobado');
      else toast('¡Libro publicado!');
      showLibrary(false);
    } catch (e) { toast('No se pudo publicar el libro'); }
    $('pubSave').disabled = false;
  };
  /* Destacar libro en portada (anuncio pagado del creador) */
  $('featureCancel').onclick = () => { $('featurePop').classList.add('hidden'); featurePending = null; };
  $('featureConfirm').onclick = async () => {
    if (!featurePending || !featurePlan) return;
    const b = featurePending, plan = featurePlan;
    $('featureConfirm').disabled = true;
    try {
      // Cobrar con Stripe: redirige; al volver (?pago=ok) initCheckoutReturn activa el destacado
      await payWithStripe({
        type: 'feature', intentParams: { bookId: b.id, plan, author: myName },
        description: `Destacar "${b.title}"`, amountCents: null,
      });
    } catch (e) {
      if (String((e && e.message) || e) !== 'cancelado') toast(t('adPayErr'));
    }
    $('featureConfirm').disabled = false;
  };
  // arranque: la biblioteca es el estado inicial del historial (no se pushea)
  try { history.replaceState({ tjview: 'library' }, ''); } catch (e) {}
  currentView = 'library';
  showLibrary(false);
}

/* ---------- Login con Google ---------- */
let tjUser = null, tjGoogleEnabled = false, tjAuthChecked = false;
function googleLogin() {
  if (tjAuthChecked && !tjGoogleEnabled) {
    toast('🔐 El login con Google no está disponible en este servidor');
    return;
  }
  location.href = '/api/auth/google';
}
function googleLogout() {
  fetch('/api/auth/logout', { method: 'POST' }).then(() => location.reload());
}
async function checkAuth() {
  try {
    const r = await fetch('/api/auth/me');
    const d = await r.json();
    tjUser = d.user || null;
    tjGoogleEnabled = !!d.googleEnabled;
    tjAuthChecked = true;
    const btn = document.querySelector('#drawer button[data-go="google-login"]');
    if (btn) {
      btn.onclick = () => {
        closeDrawer();
        if (tjUser) { if (confirm(t('logoutOf') + (tjUser.name || tjUser.email) + '?')) googleLogout(); }
        else googleLogin();
      };
      if (tjUser) {
        btn.innerHTML = '👤 ' + esc(tjUser.name || tjUser.email || t('myAccount'));
      } else if (tjGoogleEnabled) {
        btn.innerHTML = t('googleLogin');
      } else {
        btn.style.display = 'none';
      }
    }
    // Avisar si el login fue exitoso o falló (viene del callback)
    const q = new URLSearchParams(location.search);
    if (q.get('login') === 'ok') { toast('✅ Sesión iniciada con Google'); history.replaceState(null, '', '/'); }
    else if (q.get('login') === 'error') { toast('❌ Error al entrar con Google'); history.replaceState(null, '', '/'); }
  } catch (e) {}
}
/* Si el servidor pide login (401), redirige a Google (si está disponible) */
function needLogin(res) {
  if (res && res.status === 401) {
    if (tjAuthChecked && !tjGoogleEnabled) {
      toast('🔐 Esta acción necesita login con Google (no disponible en este servidor)');
      return true;
    }
    googleLogin(); return true;
  }
  return false;
}

/* ---------- barra IMDb: drawer, búsqueda, vista ---------- */
function openDrawer() {
  const d = $('drawer'), s = $('drawerScrim');
  d.classList.remove('hidden'); d.removeAttribute('hidden');
  s.classList.remove('hidden'); s.removeAttribute('hidden');
  // v132 — El botón "🌙 Tema" del drawer solo actúa en la sala de lectura (el
  // tema claro/oscuro aplica al lector; la biblioteca tiene su diseño oscuro
  // fijo). Ocultarlo fuera de la sala evita un control con feedback falso.
  const tdb = d.querySelector('button[data-go="theme"]');
  if (tdb) tdb.style.display = (typeof currentView !== 'undefined' && currentView === 'room') ? '' : 'none';
  // El botón de revisión solo lo ve el admin (Alejandro)
  const ab = $('adminBtn');
  if (ab) {
    const show = displayName() === 'Lenyn Escobar';
    ab.classList.toggle('hidden', !show);
    if (!show) ab.setAttribute('hidden', ''); else ab.removeAttribute('hidden');
    if (show) refreshAdminBadge();
  }
}
/* 🐛 Contador de reportes nuevos en el botón admin */
async function refreshAdminBadge() {
  const ab = $('adminBtn');
  if (!ab) return;
  try {
    const r = await fetch('/api/admin/pending?admin=' + encodeURIComponent(displayName()));
    const d = await r.json();
    if (d && d.ok) {
      const n = (d.pendingFeedback || 0) + d.pendingBooks.length + d.pendingIdentity.length + d.pendingBank.length;
      ab.textContent = n > 0 ? t('dwAdminN', { n }) : t('dwAdmin');
    }
  } catch (e) {}
}
function closeDrawer() {
  const d = $('drawer'), s = $('drawerScrim');
  d.classList.add('hidden'); d.setAttribute('hidden', '');
  s.classList.add('hidden'); s.setAttribute('hidden', '');
}
function goLiveRoom(roomCode) {
  syncNameFromLib();
  closeDrawer();
  $('library').classList.add('hidden');
  $('writing').classList.add('hidden');
  $('nameInput').value = myName === t('joinDefaultName') ? '' : myName;
  // Sala privada: el código viene del campo discreto del footer o del deep link (?sala=CODIGO).
  // Si se pasa código explícito úsalo; si no, conserva el myRoom ya fijado (deep link).
  // Sin código no hay default: el campo sale vacío y nadie entra sin el código exacto.
  if (roomCode) {
    const rc = normalizeRoomClient(roomCode);
    if (rc) myRoom = rc;
  }
  const ri = $('roomInput'); if (ri) ri.value = myRoom || '';
  const j = $('join');
  j.classList.remove('hidden');
  j.classList.remove('view-enter'); void j.offsetWidth; j.classList.add('view-enter');
}
function initImdbBar() {
  // Drawer y scrim al body: fuera del #library con scroll (z-index global correcto)
  ['drawer', 'drawerScrim'].forEach((id) => {
    const el = document.getElementById(id);
    if (el && el.parentNode !== document.body) document.body.appendChild(el);
  });
  $('menuBtn').onclick = openDrawer;
  $('drawerScrim').onclick = closeDrawer;
  $('drawer').querySelectorAll('button[data-go]').forEach((b) => {
    b.onclick = () => {
      const go = b.dataset.go;
      if (go === 'library') showLibrary();
      else if (go === 'write') showWriting();
      else if (go === 'live') goLiveRoom();
      else if (go === 'publish') { closeDrawer(); syncNameFromLib(); $('publishPop').classList.remove('hidden'); }
      else if (go === 'ad') { closeDrawer(); showAdModal(null); }
      else if (go === 'achievements') { closeDrawer(); showAchievements(); }
      else if (go === 'profile') { closeDrawer(); showCreatorProfile(displayName()); }
      else if (go === 'verify') { closeDrawer(); syncNameFromLib(); showVerifications(); }
      else if (go === 'admin') { closeDrawer(); showAdminPanel(); }
      else if (go === 'feedback') { closeDrawer(); showFeedbackModal(); }
      else if (go === 'google-login') { closeDrawer(); googleLogin(); }
      else if (go === 'theme') { closeDrawer(); toggleTheme(); }
    };
  });
  // buscar: filtra en vivo
  $('searchToggle').onclick = () => {
    const sb = $('searchBar');
    sb.classList.toggle('hidden');
    if (!sb.classList.contains('hidden')) $('searchInput').focus();
    else { $('searchInput').value = ''; libQuery = ''; renderRows(); }
  };
  $('searchInput').addEventListener('input', (e) => {
    libQuery = e.target.value;
    /* v173: debounce 200ms — renderRows() reconstruye todas las filas por
       tecla; en teléfonos débiles el tecleo se trababa. El render final es
       idéntico. */
    clearTimeout(searchDeb);
    searchDeb = setTimeout(renderRows, 200);
  });
  $('enterBtn').onclick = goLiveRoom;
  // Campo discreto "Código de sala" en el footer — única entrada pública a la sala privada
  const frc = $('footerRoomCode'), frg = $('footerRoomGo');
  const footerRoomGo = () => {
    const code = frc ? frc.value.trim() : '';
    if (!code) { if (frc) frc.focus(); return; }
    const rc = normalizeRoomClient(code);
    if (!rc) { toast(t('joinBadCode')); return; }
    goLiveRoom(rc);
  };
  if (frg) frg.onclick = footerRoomGo;
  if (frc) frc.addEventListener('keydown', (e) => { if (e.key === 'Enter') footerRoomGo(); });
  const ff = $('footerFeedback');
  if (ff) ff.onclick = (e) => { e.preventDefault(); showFeedbackModal(); };
  /* v77 — Login Google visible en header */
  initHeaderAuth();
  /* i18n — selector de idioma ES/EN */
  try { initLangUI(); } catch (e) {}
  window.addEventListener('uilang', () => {
    try { renderRows(); } catch (e) {}
    try { if (typeof renderAds === 'function') renderAds(); } catch (e) {}
    try { if (typeof renderHero === 'function') renderHero(); } catch (e) {}
    try { if (typeof updateRoomLabel === 'function') updateRoomLabel(); } catch (e) {}
    try { if (typeof renderTools === 'function') renderTools(); } catch (e) {}
    try { if (typeof showLibrary === 'function' && !document.getElementById('library').classList.contains('hidden')) showLibrary(false); } catch (e) {}
  });
  // vista inmersiva
  $('immClose').onclick = closeImmersive;
  $('immCta').onclick = () => { if (immCtaFn) immCtaFn(); };
  $('immersive').addEventListener('click', (e) => {
    if (e.target === $('immersive')) closeImmersive(); // tocar el fondo cierra
  });
}
/* Tema claro/oscuro (también desde el drawer) */
function toggleTheme() {
  const cur = localStorage.getItem('tj_theme') || 'light';
  localStorage.setItem('tj_theme', cur === 'dark' ? 'light' : 'dark');
  applyTheme();
  const tb = document.querySelector('#drawer button[data-go="theme"]');
  if (tb) tb.textContent = (localStorage.getItem('tj_theme') === 'dark' ? '☀️' : '🌙') + t('themeLabel');
}

/* ---------- ✍️ Escribir ---------- */
async function showWriting(push) {
  setViewState('writing', push);
  closeDrawer();
  $('library').classList.add('hidden');
  $('join').classList.add('hidden');
  const w = $('writing');
  w.classList.remove('hidden');
  w.classList.remove('view-enter'); void w.offsetWidth; w.classList.add('view-enter');
  renderWritings();
}
async function renderWritings() {
  const box = $('wrList');
  box.innerHTML = '<p class="join-sub">Cargando…</p>';
  try {
    const r = await fetch('/api/writings');
    const d = await r.json();
    const list = d.writings || [];
    if (!list.length) { box.innerHTML = '<p class="join-sub">' + t('wrEmpty') + '</p>'; return; }
    box.innerHTML = '';
    list.forEach((w, i) => {
      const row = document.createElement('div');
      row.className = 'book-row wr-item';
      row.innerHTML =
        `<div class="rank-badge">#${i + 1}</div>` +
        `<div class="row-main"><div class="row-title">✍️ ${esc(w.title)}</div>` +
        `<div class="row-meta">${esc(w.author)} · ${esc(w.preview)}${w.preview.length >= 140 ? '…' : ''}</div></div>` +
        `<button class="btn row-btn">${t('libReadBtn')}</button>`;
      row.querySelector('button').onclick = () => openWriting(w.id);
      row.querySelector('.row-main').onclick = () => openWriting(w.id);
      box.appendChild(row);
    });
  } catch (e) { box.innerHTML = '<p class="join-sub">No se pudieron cargar.</p>'; }
}
async function openWriting(id) {
  try {
    const r = await fetch('/api/writings/' + encodeURIComponent(id));
    const d = await r.json();
    if (!d.ok) throw 0;
    $('readTitle').textContent = d.writing.title;
    $('readAuthor').textContent = d.writing.author;
    $('readText').textContent = d.writing.text;
    $('readPop').classList.remove('hidden');
  } catch (e) { toast('No se pudo abrir el escrito'); }
}
function initWriting() {
  $('wrSave').onclick = async () => {
    syncNameFromLib();
    const title = $('wrTitle').value.trim();
    const text = $('wrText').value.trim();
    if (!title || !text) { toast('Ponle título y texto'); return; }
    $('wrSave').disabled = true;
    try {
      // v164: timeout anti-cuelgue (15s) + cid para no duplicar ante reintento tras timeout
      const r = await fetchTimeout('/api/writings', 15000, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, text, author: myName, cid: makeCid() }),
      });
      if (needLogin(r)) { $('wrSave').disabled = false; return; }
      const d = await r.json();
      if (!d.ok) throw 0;
      $('wrTitle').value = ''; $('wrText').value = '';
      toast('✍️ Escrito guardado');
      renderWritings();
    } catch (e) { toast('No se pudo guardar'); }
    $('wrSave').disabled = false;
  };
  $('readClose').onclick = () => $('readPop').classList.add('hidden');
}

/* v71 — Deep link ?libro=ID: abrir un libro directo desde un link compartido.
   v72 — Deep link ?sala=CODIGO: entrar directo a la sala en vivo desde un link
   compartido (lo deja en la pantalla de entrada con el código ya puesto;
   el visitante solo escribe su nombre y entra — sin login, sin fricción). */
async function initDeepLink() {
  try { localStorage.removeItem('tj_inRoom'); } catch (e) {} // v104: flag obsoleto, siempre mostrar biblioteca
  try {
    const q = new URLSearchParams(location.search);
    // v72: enlace a sala en vivo
    const sala = normalizeRoomClient(q.get('sala') || '');
    if (sala) {
      try { localStorage.setItem('tj_room', sala); } catch (e) {}
      myRoom = sala;
      const ri = $('roomInput'); if (ri) ri.value = sala;
      history.replaceState(null, '', '/');
      goLiveRoom();
      myRoom = sala;
      if (ri) ri.value = sala;
      return;
    }
    const id = (q.get('libro') || '').toUpperCase().trim();
    if (!id) return;
    // Espera a que la biblioteca cargue los libros
    for (let i = 0; i < 40 && !window.__tjBooksReady; i++) await new Promise(r => setTimeout(r, 250));
    history.replaceState(null, '', '/');
    openBook(id, true);
  } catch (e) { clog('deep-link: ' + (e && e.message)); }
}

/* Bienvenida: solo la primera visita. Explica qué es TintaJunta en 10 segundos.
   v147: ahora también pide nombre + código de sala para entrar directo;
   la X cierra sin entrar. La decisión se guarda en localStorage y no vuelve
   a salir aunque la página se actualice. */
function initWelcome() {
  const pop = $('welcomePop');
  if (!pop) return;
  const done = () => {
    // v151: guardar también el nombre escrito — antes se perdía en silencio si
    // se cerraba con la X o "Entendido" en vez de "Entrar a la sala"
    try {
      const nm = $('welcomeName').value.trim().slice(0, 24);
      if (nm) localStorage.setItem('tj_name', nm);
      localStorage.setItem('tj_welcomed', '1');
    } catch (e) {}
    pop.classList.add('hidden');
  };
  // v149: ?welcome=1 fuerza ver el anuncio (para probarlo sin borrar datos)
  // v151: anclado para no matchear ?welcome=10 o ?welcome=1x
  const forceWel = /[?&]welcome=1(?:&|$)/.test(location.search);
  try {
    if (!forceWel && localStorage.getItem('tj_welcomed')) return;
  } catch (e) { if (!forceWel) return; }
  pop.classList.remove('hidden');
  // Nombre guardado de antes, si existe
  try {
    const sn = localStorage.getItem('tj_name');
    if (sn) $('welcomeName').value = sn;
  } catch (e) {}
  $('welcomeOk').onclick = done;
  $('welcomeX').onclick = done;
  const go = () => {
    const code = $('welcomeCode').value.trim();
    if (!normalizeRoomClient(code)) { toast(t('joinNeedCode')); return; } // no cerrar si el código está mal
    const ji = $('joinBtn'), ni = $('nameInput'), ri = $('roomInput');
    if (!ji || !ni || !ri) { done(); return; }
    ni.value = $('welcomeName').value.trim().slice(0, 24);
    ri.value = code;
    done();
    ji.click(); // reutiliza el flujo de entrada existente
  };
  $('welcomeJoin').onclick = go;
  $('welcomeCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  $('welcomeName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('welcomeCode').focus(); });
}

/* Cada init aislado: si uno falla, los demás siguen funcionando */
[['initJoin', initJoin], ['initLibrary', initLibrary], ['initCheckoutReturn', initCheckoutReturn], ['initAds', initAds],
 ['renderAds', renderAds], ['renderAffiliates', renderAffiliates],
 ['initImdbBar', initImdbBar], ['initWriting', initWriting],
 ['initPills', initPills],
 ['initBoard', initBoard], ['initFollow', initFollow], ['initWelcome', initWelcome],
['initOutbox', initOutbox],
 ['initReviews', initReviews], ['initProgress', initProgress], ['initReports', initReports],
 ['initTypo', initTypo], ['initReadProgress', initReadProgress],
 ['initChat', initChat], ['initReactions', initReactions], ['initHands', initHands],
 ['initSwitchBook', initSwitchBook], ['checkAuth', checkAuth],
 ['initParaBar', initParaBar], ['initBoardMode', initBoardMode],
 ['initDeepLink', initDeepLink]].forEach(([name, fn]) => {
  try {
    const r = fn();
    if (r && r.catch) r.catch((e) => clog('INIT-FAIL ' + name + ': ' + (e && e.message)));
  } catch (e) { clog('INIT-FAIL ' + name + ': ' + (e && e.message)); }
});
