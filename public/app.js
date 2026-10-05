/* TintaJunta · prototipo — lógica de la sala en vivo (cliente) */
'use strict';

/* ============ Google AdSense ============
 * Alejandro: pega aquí tu Publisher ID cuando Google apruebe la cuenta.
 * Formato: 'ca-pub-XXXXXXXXXXXXXXXX'
 * Vacío ('') = muestra placeholder "Espacio publicitario" en los slots.
 * NO se muestran anuncios dentro de la sala de lectura (regla permanente).
 */
const ADSENSE_CLIENT = '';

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
let myRoom = 'SALA';

/* Normaliza un código de sala igual que el servidor (null si inválido) */
function normalizeRoomClient(raw) {
  const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  if (!code) return 'SALA';
  if (code.length < 4) return null;
  return code;
}
myRoom = normalizeRoomClient(localStorage.getItem('tj_room')) || 'SALA';
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
  $('roomInput').value = myRoom === 'SALA' ? '' : myRoom;
  const doJoin = () => {
    myName = $('nameInput').value.trim().slice(0, 24) || t('joinDefaultName');
    const rc = normalizeRoomClient($('roomInput').value);
    if ($('roomInput').value.trim() && !rc) {
      toast(t('joinBadCode'));
      return;
    }
    myRoom = rc || 'SALA';
    localStorage.setItem('tj_name', myName);
    localStorage.setItem('tj_color', myColor);
    localStorage.setItem('tj_room', myRoom);
    try { localStorage.setItem('tj_inRoom', '1'); } catch (e) {} // v94: sesión activa — auto-reentrar si recarga
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
    try { localStorage.setItem('tj_inRoom', '1'); } catch (e) {} // v94: sesión activa
    $('join').classList.add('hidden');
    setViewState('room', true);
    boot();
  };
  $('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') doJoin(); });
  $('roomInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') doJoin(); });
}

/* ------------------------------ capítulo ------------------------------ */
function renderText(paragraphs, chapterTitle, bookLine, sampleNote, images) {
  $('chapterTitle').textContent = chapterTitle;
  $('bookLine').textContent = bookLine || '';
  $('sampleNote').textContent = sampleNote || '';
  const paras = $('paras');
  paras.innerHTML = '';
  spanByIdx.length = 0;
  cover.clear();
  highlights = [];
  notes = [];
  if (typeof myPage !== 'undefined') myPage = null; // nuevo texto → reiniciar página local
  renderPageNav();
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
  let idx = 0;
  let pi = 0;
  paragraphs.forEach((text) => {
    const p = document.createElement('p');
    p.dataset.para = pi++; // v68: índice de párrafo para presencia viva y notas
    String(text).split(/\s+/).forEach((t) => {
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
    paras.appendChild(p);
  });
  wordCount = idx;
  renderNotes();
  /* v78: transición suave al pintar un capítulo */
  paras.classList.remove('fade-in');
  void paras.offsetWidth;
  paras.classList.add('fade-in');
}
async function loadText() {
  const r = await fetch('/api/text');
  const data = await r.json();
  renderText(data.paragraphs, data.chapterTitle, data.bookLine, data.sampleNote);
}

/* ------------------------------ pintado ------------------------------- */
function paintHighlight(h) {
  for (let i = h.start; i <= h.end; i++) {
    cover.set(i, h);
    const s = spanByIdx[i];
    if (!s) continue;
    s.style.background = hexA(COLORS[h.color] || COLORS.azul, 0.34);
    s.classList.add('mk');
    s.title = `${capFor(h.color)}${h.name} · ${colorName(h.color)}`;
  }
}
function repaintAll() {
  cover.clear();
  spanByIdx.forEach((s) => { s.style.background = ''; s.title = ''; s.classList.remove('has-note'); s.classList.remove('mk'); s.style.setProperty('--note-c', ''); });
  highlights.forEach(paintHighlight);
  paintNoteMarks();
  paintNoteBadges(); // v68
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
    b.onclick = () => {
      apiPost(roomBase() + '/del', { kind: 'note', id: b.dataset.id })
        .then(() => { notes = notes.filter((n) => n.id !== b.dataset.id); renderNotes(); paintNoteMarks(); })
        .catch(() => toast(t('noteDelErr')));
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
function renderRoster(roster) {
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
function renderParaPresence(roster) {
  const paras = $('paras');
  if (!paras || currentView !== 'room') return;
  paras.querySelectorAll('.para-eyes').forEach((e) => e.remove());
  const mine = (myName || '').trim();
  const byPara = {};
  (roster || []).forEach((p) => {
    if ((p.name || '').trim() === mine) return;
    const pi = Number(p.para);
    if (!Number.isFinite(pi) || pi < 0) return;
    (byPara[pi] = byPara[pi] || []).push(p);
  });
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
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  $('toasts').appendChild(t);
  setTimeout(() => t.remove(), 3200);
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
  const x = Math.min(Math.max(8, anchorRect.left + anchorRect.width / 2 - 120), window.innerWidth - 250);
  const y = Math.max(8, anchorRect.top - 56); // .toolbar es position:fixed -> coordenadas de viewport
  tb.style.left = x + 'px';
  tb.style.top = y + 'px';
}
function hideToolbar() { $('toolbar').classList.add('hidden'); pendingRange = null; }
function hideNotepop() { $('notepop').classList.add('hidden'); $('noteText').value = ''; $('noteCount').textContent = '0'; }
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
  p.style.left = Math.min(Math.max(8, anchorRect.left + anchorRect.width / 2 - 170), window.innerWidth - 360) + 'px';
  p.style.top = Math.min(anchorRect.bottom + 8, window.innerHeight - 300) + 'px'; // .notepop es position:fixed
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
  function clearTempMark() { spanByIdx.forEach((s) => s.classList.remove('marking')); }
  function paintTempMark(a, b) {
    clearTempMark();
    const s = Math.min(a, b), e = Math.max(a, b);
    for (let i = s; i <= e; i++) { const sp = spanByIdx[i]; if (sp) sp.classList.add('marking'); }
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
      eraseInRange({ start: ps, end: pe });
      toast(t('paraCleaned'));
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
    np.style.left = Math.min(Math.max(8, tb.left), window.innerWidth - 360) + 'px';
    np.style.top = Math.min(tb.bottom + 8, window.innerHeight - 280) + 'px'; // .notepop es position:fixed
    np.classList.remove('hidden');
    hideToolbar();
    setTimeout(() => $('noteText').focus(), 50);
  };
  $('btnRemove').onclick = () => {
    const hid = $('toolbar').dataset.hid;
    if (hid) {
      apiPost(roomBase() + '/del', { kind: 'highlight', id: hid })
        .then(() => { highlights = highlights.filter((h) => h.id !== hid); repaintAll(); })
        .catch(() => toast(t('hlEraseErr')));
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
    hideNotepop();
    window.getSelection().removeAllRanges();
    pendingRange = null;
    try {
      const s = await apiPost(roomBase() + '/note', { start, end, text });
      if (s && s.ok && s.note && !notes.some((n) => n.id === s.note.id)) {
        notes.push(s.note);
        renderNotes();
        paintNoteMarks();
        paintNoteBadges(); // v68
        toast(s.note.code ? t('noteSaved', { code: s.note.code }) : t('noteSavedPlain'));
      }
      setOnline(true);
    } catch (e) {
      setOnline(false);
      toast(t('noteErr'));
    }
  };
}

/* ------------------------------- red (HTTP) ------------------------------ */
/* Sin WebSockets: el cliente publica con POST y sondea el estado de la sala.
 * Son peticiones HTTPS cortas: funcionan sobre cualquier conexión. */
let netOnline = false;

async function apiPost(path, body) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: displayName(), color: myColor, ...(body || {}) }),
  });
  if (!r.ok) throw new Error('http ' + r.status);
  return r.json();
}
const roomBase = () => '/api/rooms/' + encodeURIComponent(myRoom);

function setOnline(on) {
  netOnline = on;
  const d = $('netdot');
  if (d) {
    d.classList.toggle('off', !on);
    d.title = on ? t('netOnlineTitle') : t('netOfflineTitle');
  }
}

let lastStateSig = '';
function applyState(s) {
  if (!s || s.ok === false) return;
  // Optimización: si nada cambió desde el último poll, no re-renderizar
  try {
    const sig = JSON.stringify([s.highlights, s.notes, s.board, s.follow, s.para, s.chat, s.reactions, s.hands, s.roster, s.switchTo]);
    if (sig === lastStateSig) return;
    lastStateSig = sig;
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

/* v85: enviar como entrada discreta (botón o Enter) */
function sendBoard() {
  const edit = $('boardEdit');
  if (!edit) return;
  const text = (edit.value || '').trim();
  if (!text) return;
  edit.value = '';
  apiPost(roomBase() + '/board', { text })
    .then((s) => { if (s && s.ok && Array.isArray(s.board)) { board = s.board; renderBoard(); } })
    .catch(() => toast(t('boardErr')));
}

function initBoard() {
  const edit = $('boardEdit'), clear = $('boardClear'), send = $('boardSend');
  if (!edit) return;
  const doSend = () => sendBoard();
  if (send) send.onclick = doSend;
  edit.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
  });
  if (clear) clear.onclick = () => {
    if (!isTeacher) return;
    if (!confirm(t('boardConfirm'))) return;
    apiPost(roomBase() + '/boardClear', {})
      .then((s) => { if (s && s.ok) { board = []; renderBoard(); } })
      .catch(() => toast(t('boardCleanErr')));
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

function paraCount() {
  return document.querySelectorAll('#paras p[data-para]').length;
}
function paraLabel() {
  const n = paraCount();
  const i = Math.min(roomPara.idx, Math.max(0, n - 1));
  return n > 0 ? t('paraOf', { i: i + 1, n }) : t('paraDash');
}
function renderParaBar() {
  const bar = $('paraBar');
  if (!bar) return;
  const show = currentView === 'room' && (isTeacher || roomPara.ts > 0);
  bar.classList.toggle('hidden', !show);
  if (!show) return;
  const n = paraCount();
  const i = Math.min(roomPara.idx, Math.max(0, n - 1));
  $('paraLabel').textContent = paraLabel();
  const prev = $('paraPrev'), next = $('paraNext');
  if (isTeacher) {
    prev.classList.remove('hidden'); next.classList.remove('hidden');
    prev.disabled = i <= 0; next.disabled = n > 0 && i >= n - 1;
  } else {
    prev.classList.add('hidden'); next.classList.add('hidden');
  }
  renderPageNav();
}
function setRoomPara(idx) {
  if (!isTeacher) return;
  const n = paraCount();
  idx = Math.max(0, Math.min(n - 1, idx));
  if (idx === roomPara.idx && roomPara.ts > 0) return;
  apiPost(roomBase() + '/para', { idx })
    .then((s) => {
      if (s && s.ok && s.para) { roomPara = s.para; lastParaTs = s.para.ts; focusPara(roomPara.idx, true); renderParaBar(); renderBoardMode(); }
    })
    .catch(() => toast(t('paraErr')));
}
/* Resalta el párrafo actual para todos y lo muestra en modo pizarra */
function focusPara(idx, smooth) {
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
  myPage = null; // el profesor se movió → vuelvo a seguir la sala
  renderParaBar();
  focusPara(pa.idx, true);
  if (!isTeacher) toast(t('paraTeacherMoved') + paraLabel().toLowerCase());
}
function initParaBar() {
  const prev = $('paraPrev'), next = $('paraNext');
  if (prev) prev.onclick = () => setRoomPara(roomPara.idx - 1);
  if (next) next.onclick = () => setRoomPara(roomPara.idx + 1);
  const pagePrev = $('pagePrev'), pageNext = $('pageNext');
  if (pagePrev) pagePrev.onclick = () => pageNavTo(-1);
  if (pageNext) pageNext.onclick = () => pageNavTo(1);
  renderParaBar();
}

/* ------------------------- 📄 Paginación inferior ------------------------- */
/* Botones "← Anterior / Siguiente →" al final de la lectura — visibles para TODOS.
   El profesor mueve el párrafo COMPARTIDO (setRoomPara); el estudiante solo mueve
   su propia vista (local), sin cambiar lo que ve la sala. */
let myPage = null; // índice local del estudiante (null = seguir el de la sala)
function pageNavTo(delta) {
  const n = paraCount();
  if (n <= 0) return;
  if (isTeacher) { setRoomPara(roomPara.idx + delta); return; }
  if (myPage === null) myPage = Math.min(roomPara.idx, Math.max(0, n - 1));
  myPage = Math.max(0, Math.min(n - 1, myPage + delta));
  focusPara(myPage, true);
  renderPageNav();
}
function renderPageNav() {
  const nav = $('pageNav');
  if (!nav) return;
  const n = paraCount();
  const show = currentView === 'room' && n > 0;
  nav.classList.toggle('hidden', !show);
  if (!show) return;
  const i = isTeacher ? Math.min(roomPara.idx, Math.max(0, n - 1))
                      : (myPage === null ? Math.min(roomPara.idx, Math.max(0, n - 1)) : myPage);
  $('pagePrev').disabled = i <= 0;
  $('pageNext').disabled = i >= n - 1;
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
  const unread = chat.length - chatSeen;
  $('chatCount').textContent = (chatTab !== 'chat' && unread > 0) ? `(${unread})` : '';
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
  box.scrollTop = box.scrollHeight;
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
  apiPost(roomBase() + '/chat', { text: text.slice(0, 300) })
    .then((s) => {
      if (s && s.ok && s.msg && !chat.some((m) => m.id === s.msg.id)) {
        chat.push(s.msg);
        if (chat.length > 50) chat = chat.slice(-50);
        chatSeen = chat.length;
        renderChat();
      }
      setOnline(true);
    })
    .catch(() => { setOnline(false); toast(t('chatErr')); });
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

function toggleReaction(start, emoji) {
  apiPost(roomBase() + '/reaction', { start, emoji })
    .then((s) => { if (s && s.ok) pollState(); setOnline(true); })
    .catch(() => { setOnline(false); toast(t('reactErr')); });
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
  if (btn) btn.onclick = () => {
    const up = !myHandUp();
    apiPost(roomBase() + '/hand', { up })
      .then((s) => {
        if (s && s.ok) { hands = s.hands || []; renderHands(); renderRoster(); }
        toast(up ? t('handRaised') : t('handLowered'));
        setOnline(true);
      })
      .catch(() => { setOnline(false); toast(t('handErr')); });
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
        chip.onclick = () => {
          apiPost(roomBase() + '/hand', { up: false, target: name })
            .then((s) => { if (s && s.ok) { hands = s.hands || []; renderHands(); renderRoster(); } })
            .catch(() => toast('No se pudo bajar la mano'));
        };
      }
    }
  });
}

async function pollState() {
  try {
    const r = await fetch(roomBase() + '/state', { cache: 'no-store' });
    if (!r.ok) throw new Error('http ' + r.status);
    applyState(await r.json());
    if (!netOnline) clog('red: en línea');
    setOnline(true);
  } catch (e) {
    if (netOnline) clog('red: sin conexión, reintentando…');
    setOnline(false);
  }
}

/* Publica un subrayado y lo pinta de inmediato (optimista) */
async function postHighlight(range) {
  try {
    const s = await apiPost(roomBase() + '/highlight', range);
    if (s && s.ok && s.highlight && !highlights.some((h) => h.id === s.highlight.id)) {
      highlights.push(s.highlight);
      paintHighlight(s.highlight);
    }
    setOnline(true);
    return true;
  } catch (e) {
    setOnline(false);
    toast(t('hlSaveErr'));
    return false;
  }
}

/* Borra mis subrayados que se solapen con el rango dado */
async function eraseInRange(range) {
  const mine = highlights.filter((h) =>
    h.name === displayName() && h.start <= range.end && h.end >= range.start);
  if (!mine.length) return;
  clog('borrador: borrando ' + mine.length + ' marca(s)');
  const deletedIds = new Set();
  for (const h of mine) {
    try {
      await apiPost(roomBase() + '/del', { kind: 'highlight', id: h.id });
      deletedIds.add(h.id); // solo los que sí se borraron en el servidor
    } catch (e) { /* seguir con las demás */ }
  }
  if (deletedIds.size) {
    highlights = highlights.filter((h) => !deletedIds.has(h.id));
    repaintAll();
    toast(deletedIds.size === 1 ? 'Subrayado borrado' : deletedIds.size + ' subrayados borrados');
  } else {
    toast(t('hlDelErr'));
  }
  setOnline(deletedIds.size > 0);
}

let netInitDone = false;
function initNet() {
  if (!netInitDone) {
    netInitDone = true;
    setInterval(() => { if (!document.hidden && currentView === 'room') pollState(); }, 2500); // novedades de los demás (pausado si la pestaña está oculta o fuera de la sala)
    setInterval(() => { if (!document.hidden && currentView === 'room') apiPost(roomBase() + '/ping', {}).catch(() => {}); }, 15000); // presencia
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
      applyState(s);
      setOnline(true);
      clog('red: dentro de ' + myRoom);
    })
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
      $('roomLabel').innerHTML = t('roomName') + ' <b id="roomCode">SALA</b>' + typeBadge;
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
async function boot() {
  clog('boot: entrando a la sala ' + myRoom + ', UA=' + navigator.userAgent.slice(0, 80));
  currentBook = null;
  readingType = 'sample';
  updateRoomLabel();
  await loadText();
  clog('texto cargado, palabras=' + wordCount);
  if (!selInitDone) { selInitDone = true; initSelection(); }
  initNet();
}
/* Entrar a leer un libro: mismo lector, texto del libro, marcas propias del libro */
async function bootBook(book, push) {
  myRoom = book.id; // el id del libro ES su sala de marcas
  currentBook = book;
  readingType = book.classic ? 'classic' : 'book';
  localStorage.setItem('tj_room', myRoom);
  try {
    localStorage.setItem('tj_inRoom', '1'); // v94: sesión activa — auto-reentrar si recarga
    localStorage.setItem('tj_lastBook', book.id); // v94: último libro abierto
  } catch (e) {}
  setViewState('room', push);
  updateRoomLabel();
  const ch = book.chapters[0];
  const kindNote = book.classic
    ? t('classicInfo')
    : book.price > 0 ? t('bookBoughtInfo') : t('bookFreeInfo');
  renderText(ch.paragraphs, ch.title, book.title + ' — ' + book.author, kindNote, ch.images || []);
  // v69: el nombre del creador es tocable (abre su perfil knowledge panel)
  $('bookLine').innerHTML = `${esc(book.title)} — <span class="creator-link" data-creator="${esc(book.author)}">${esc(book.author)}</span>`;
  clog('libro cargado: ' + book.title + ', palabras=' + wordCount);
  if (!selInitDone) { selInitDone = true; initSelection(); }
  $('library').classList.add('hidden');
  $('join').classList.add('hidden');
  window.scrollTo(0, 0);
  initNet();
  restoreProgress(book.id);
  renderCreatorStats(book);
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
  myRoom = (st && st.room) || localStorage.getItem('tj_room') || 'SALA';
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
  toast(t('exitedRoom'));
  showLibrary(true);
}
/* v94: Auto-reentrar a la sala si había sesión activa al recargar.
   La página nunca expulsa sola: solo el botón 🚪 Salir cierra la sesión. */
function initAutoRejoin() {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('sala') || q.get('libro')) return; // deep link tiene prioridad
    if (localStorage.getItem('tj_inRoom') !== '1') return;
    const savedName = localStorage.getItem('tj_name');
    if (!savedName || savedName === t('joinDefaultName')) return; // sin nombre real, no auto-entrar
    myName = savedName;
    myRoom = localStorage.getItem('tj_room') || 'SALA';
    const lastBook = localStorage.getItem('tj_lastBook');
    // Esperar a que la biblioteca cargue para poder abrir el libro
    const tryRejoin = async () => {
      for (let i = 0; i < 40 && !window.__tjBooksReady; i++) {
        await new Promise(r => setTimeout(r, 250));
      }
      if (lastBook && window.__tjBooksReady && typeof openBook === 'function') {
        const books = (typeof libBooksCache !== 'undefined' && libBooksCache) || [];
        const b = books.find(x => x.id === lastBook);
        if (b) { openBook(b.id, false); toast(t('backToReading')); return; }
      }
      // Sin libro: entrar directo a la sala (sin pantalla de "Entrar")
      $('library').classList.add('hidden');
      $('join').classList.add('hidden');
      setViewState('room', false);
      updateRoomLabel();
      boot();
      toast(t('backToRoom'));
    };
    // Dar tiempo a que los inits terminen
    setTimeout(tryRejoin, 800);
  } catch (e) { /* sin auto-rejoin, flujo normal */ }
}
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
  { emoji: '👓', img: 'img/ads/lentes.jpg', name: 'Lentes luz azul', store: 'Amazon', price: '~$25', hue: 210, url: 'https://www.amazon.com/dp/B0HC11K9C1/ref=cm_sw_r_as_gl_api_gl_i_XQ5REAJQBVWYNPKKKF8G?linkCode=ml1&tag=lenynalopez-20&linkId=3136a4a8563b0fa762bd257308a205ea&gaOptInStatus=true' },
  { emoji: '🎧', img: 'img/ads/audifonos.jpg', name: 'Audífonos bluetooth', store: 'Amazon', price: '~$40', hue: 270, url: 'https://www.amazon.com/dp/B0H7WXNBNV/ref=cm_sw_r_as_gl_api_gl_i_RC1X2MW0SBJ9DJEK0SX8?linkCode=ml1&tag=lenynalopez-20&linkId=6c2fdb71aebaa7f63fe127c69b9ee6f0&gaOptInStatus=true' },
  { emoji: '💡', img: 'img/ads/lampara.jpg', name: 'Lámpara de lectura', store: 'Amazon', price: '~$30', hue: 45, url: 'https://www.amazon.com/dp/B0H6YB4GN7/ref=cm_sw_r_as_gl_api_gl_i_SDGYJ51ATCR9NS1SN7D6?linkCode=ml1&tag=lenynalopez-20&linkId=46fe3a3c2f7473ed3625d2322f55b470&gaOptInStatus=true' },
  { emoji: '📱', img: 'img/ads/ereader.jpg', name: 'E-reader', store: 'Amazon', price: '~$150', hue: 160, url: 'https://www.amazon.com/dp/B0FJ32FWKS/ref=cm_sw_r_as_gl_api_gl_i_HDYB0VVM5GG3MNXQ7NS3?linkCode=ml1&tag=lenynalopez-20&linkId=2ecd0e45383c549ae5b06621aff2f15e&gaOptInStatus=true' },
  { emoji: '☕', img: 'img/ads/taza.jpg', name: 'Taza térmica', store: 'Amazon', price: '~$20', hue: 20, url: 'https://link.amazon/B03uHrImb' },
  { emoji: '🪑', img: 'img/ads/cojin.jpg', name: 'Cojín de lectura', store: 'Amazon', price: '~$35', hue: 120, url: 'https://www.amazon.com/dp/B0DTBKYSHX/ref=cm_sw_r_as_gl_api_gl_i_GSX2NQ5P16XA944E76K9?linkCode=ml1&tag=lenynalopez-20&linkId=3b4379a8eadd66d35e3e00d35f012f84&gaOptInStatus=true' },
];
function renderAffiliates() {
  const row = document.getElementById('rowAff');
  if (!row) return;
  row.innerHTML = '';
  AFFILIATES.forEach((a) => {
    const card = document.createElement('div');
    card.className = 'ad-card';
    card.innerHTML =
      adCardVisual(a.emoji, a.hue, a.img) +
      `<div class="ad-badge">🔗 ${esc(a.store)}</div>` +
      `<div class="ad-name">${esc(a.name)}</div>` +
      `<div class="ad-note">${t('adAffNote', { price: esc(a.price) })}</div>`;
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
function langBadge(b) {
  const l = b.language || 'es';
  if (l === 'es') return ''; // español es el default, no necesita insignia
  return `<span class="lang-badge" title="${{en:'English',fr:'Français',pt:'Português',ar:'العربية',it:'Italiano',de:'Deutsch',ru:'Русский',ja:'日本語',el:'Ελληνικά'}[l] || l}">${LANG_FLAGS[l] || '🌍'}</span>`;
}
let libQuery = '';
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
      const rp = await fetch('/api/creators/' + encodeURIComponent(name) + '/photo', { method: 'POST', body: fd });
      const dp = await rp.json().catch(() => ({}));
      if (!dp.ok) throw new Error(dp.error || 'photo-failed');
    }
    // 2. Datos del perfil
    const r = await fetch('/api/creators/' + encodeURIComponent(name) + '/profile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bio: $('kpBio').value, location: $('kpLoc').value,
        website: $('kpWeb').value, about: $('kpAbout').value, socials,
      }),
    });
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
      const r2 = await post('/api/admin/feedback/' + encodeURIComponent(btn.dataset.id) + '/status',
        { admin: displayName(), status: btn.dataset.fb });
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
    const r = await fetch('/api/books/' + encodeURIComponent(bookId) + '/reviews', { cache: 'no-store' });
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
      const r = await fetch('/api/books/' + encodeURIComponent(reviewBookId) + '/reviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: myName, stars: reviewStars, comment: $('reviewComment').value.trim() }),
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
      const r = await fetch('/api/books/' + encodeURIComponent(reportBookId) + '/report', {
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
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.scrollTo(0, y);
      toast('📖 Continuando donde quedaste');
    }));
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
  const t = document.createElement('div');
  t.className = 'tile';
  const mine = b.author === displayName() && myName !== t('joinDefaultName');
  const vBadge = b.verifiedAuthor ? '<span class="vbadge" title="' + t('creatorVerifiedTitle') + '">✔️</span>' : '';
  const classicBadge = b.classic ? '<div class="classic-badge">' + t('classicBadge') + '</div>' : '';
  const ageBadge = b.ageRating && b.ageRating !== 'all'
    ? `<div class="age-badge">${b.ageRating === '18' ? '🔞 +18' : '🔞 +13'}</div>` : '';
  const pendBadge = b.status === 'pending' ? '<div class="feat-badge" style="background:#b45309">' + t('reviewBadge') + '</div>' : '';
  const cover = b.coverUrl
    ? `<img src="${esc(b.coverUrl)}" alt="${t('kpCoverAlt', { title: esc(b.title) })}" loading="lazy">`
    : `<div style="position:absolute;inset:0;${coverStyle(b.id)}"></div>`;
  t.innerHTML =
    `<div class="tile-cover">${cover}` +
    (opts.badge ? `<div class="feat-badge">${opts.badge}</div>` : '') +
    pendBadge + classicBadge + ageBadge + langBadge(b) +
    (getProgress(b.id) > 120 ? `<div class="prog-badge">${t('tileContinue')}</div>` : '') +
    reportBadge(b) +
    (b.coverUrl ? '' : `<div class="cover-title">${esc(b.title)}</div><div class="cover-author creator-link" data-creator="${esc(b.author)}">${esc(b.author)}</div>`) +
    `</div>` +
    `<div class="tile-title">${esc(b.title)} ${vBadge}</div>` +
    `<div class="tile-sub">🎨 ${b.marks || 0} · ${ratingHtml(b)}` +
    (mine && !opts.badge ? ` · <u class="tile-feat">⭐ destacar</u>` : '') +
    ` · ${reportBtnHtml(b)}</div>`;
  t.onclick = (e) => {
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
  return t;
}
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
    if (i < 8 && !t.classList.contains('tile-enter')) {
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

function renderRows() {
  const feat = libBooksCache.filter((b) => b.featured);
  const secD = document.getElementById('secDestacados');
  if (secD) secD.style.display = feat.length ? '' : 'none';
  fillRow('rowDestacados',
    feat.map((b) => coverTile(b, { badge: '⭐ DESTACADO', onClick: () => showImmersiveBook(b) })),
    '');
  const rec = visibleBooks(libBooksCache.filter((b) => !b.featured && !b.classic));
  fillRow('rowRecomendados',
    rec.map((b) => coverTile(b, {})),
    libQuery ? t('noResults') : t('publishFirst'));
  // 📜 Clásicos gratis: dominio público, sin creador (v101: es → en → resto)
  const cls = libBooksCache.filter((b) => b.classic)
    .sort((a, b) => langPriority(a.language) - langPriority(b.language)
      || popularity(b) - popularity(a) || b.createdAt - a.createdAt);
  const secC = document.getElementById('secClassics');
  if (secC) secC.style.display = cls.length ? '' : 'none';
  fillRow('rowClassics', cls.map((b) => coverTile(b, {})), '');
  renderMarquee();
  paintLevelBadges();
}
/* Marquesina estilo Kanopy: portadas en loop infinito */
let marqueePaused = false;
function renderMarquee() {
  const track = document.getElementById('marqueeTrack');
  const sec = document.getElementById('secMarquee');
  if (!track) return;
  const books = [...libBooksCache].sort((a, b) => popularity(b) - popularity(a));
  if (sec) sec.style.display = books.length ? '' : 'none';
  if (!books.length) { track.innerHTML = ''; return; }
  const one = books.map((b) => {
    const inner = b.coverUrl
      ? `<img src="${esc(b.coverUrl)}" alt="" loading="lazy">`
      : `<div style="position:absolute;inset:0;${coverStyle(b.id)}"></div>`;
    return `<div class="mq-cover" data-book="${b.id}">${inner}</div>`;
  }).join('');
  track.innerHTML = one + one; // duplicado para el loop infinito
  track.classList.toggle('paused', marqueePaused);
  track.querySelectorAll('.mq-cover').forEach((el) => {
    el.onclick = () => openBook(el.dataset.book);
  });
}
function initMarquee() {
  const btn = document.getElementById('marqueePause');
  if (!btn) return;
  btn.onclick = () => {
    marqueePaused = !marqueePaused;
    btn.textContent = marqueePaused ? '▶' : '⏸';
    const track = document.getElementById('marqueeTrack');
    if (track) track.classList.toggle('paused', marqueePaused);
  };
}
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
let immOpenedAt = 0;
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
  heroPause();
  immOpenedAt = Date.now();
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
  heroPlay();
}
// Escape cierra la inmersiva o el drawer
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
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
  if (ir) ir.onclick = (e) => { e.stopPropagation(); closeImmersive(); showReportModal(b.id, b.title); };
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
/* ---------- carrusel principal estilo Tubi (se mueve solo) ---------- */
let heroIdx = 0, heroTimer = null, heroSlides = [], lastHeroRotate = 0;
const isNewBook = (b) => (Date.now() - (b.createdAt || 0)) < 14 * 24 * 3600 * 1000;
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
  // Garantía editorial: al menos un slide de LIBRO aunque no haya destacados
  if (!heroSlides.length && libBooksCache.length) {
    const b = libBooksCache[0];
    heroSlides.push({ html: heroSlideBook(b), book: b });
  }
  paidAds.slice(0, 2).forEach((a) => heroSlides.push({ html: heroSlideAd(a, true), ad: a, adPaid: true }));
  if (!heroSlides.length) { car.classList.add('hidden'); heroPause(); return; }
  car.classList.remove('hidden');
  track.innerHTML = heroSlides.map((s) => s.html).join('');
  dots.innerHTML = heroSlides.map((_, i) => `<span class="hero-dot${i === 0 ? ' on' : ''}" data-i="${i}"></span>`).join('');
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
      if (Date.now() - lastHeroRotate < 600) return; // justo después de rotar solo
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
  track.ontouchstart = (e) => { sx = e.touches[0].clientX; heroPause(); };
  track.ontouchmove = (e) => {
    if (sx === null) return;
    const dx = e.touches[0].clientX - sx;
    if (Math.abs(dx) > 50) { heroSwipedAt = Date.now(); heroGo(heroIdx + (dx < 0 ? 1 : -1)); sx = null; heroPlay(); }
  };
  track.ontouchend = () => { sx = null; heroPlay(); };
  heroIdx = 0;
  heroGo(0);
  heroPlay();
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
function heroPlay() {
  heroPause();
  if (heroSlides.length < 2) return;
  heroTimer = setInterval(() => heroGo(heroIdx + 1), 5000);
}
function heroPause() { if (heroTimer) { clearInterval(heroTimer); heroTimer = null; } }
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
    const sc = document.createElement('script');
    sc.async = true;
    sc.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(ADSENSE_CLIENT);
    sc.crossOrigin = 'anonymous';
    document.head.appendChild(sc);
  }
  slots.forEach((s) => {
    if (s.dataset.adsDone) return;
    s.dataset.adsDone = '1';
    s.innerHTML = '<ins class="adsbygoogle" style="display:block" data-ad-client="' + esc(ADSENSE_CLIENT) + '" data-ad-format="auto" data-full-width-responsive="true"></ins>';
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); }
    catch (e) { /* AdSense aún cargando */ }
  });
}

async function showLibrary(push) {
  setViewState('library', push);
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
    const r = await fetchTimeout('/api/books', 10000);
    if (!r.ok) throw new Error('http ' + r.status);
    const d = await r.json();
    libBooksCache = d.books || [];
    window.__tjBooksReady = true; // v71: deep link ?libro=ID puede abrir
    const feat = libBooksCache.filter((b) => b.featured);
    renderHero(feat); // carrusel en movimiento: destacados + anuncios
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
  heroPause();
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

async function openBook(id, push) {
  syncNameFromLib();
  let book;
  try {
    const r = await fetchTimeout('/api/books/' + encodeURIComponent(id), 10000);
    if (!r.ok) throw 0;
    const d = await r.json();
    if (!d.ok) throw 0;
    book = d.book;
  } catch (e) { toast(t('buyLoadErr')); return; }
  // Todos los libros son gratis: se abren directo
  // Advertencia de contenido adulto
  if (book.ageRating === '18' && !sessionStorage.getItem('tj_age_ok_' + book.id)) {
    $('ageText').textContent = t('buyRated18', { title: book.title });
    $('agePop').classList.remove('hidden');
    $('ageCancel').onclick = () => $('agePop').classList.add('hidden');
    $('ageConfirm').onclick = () => {
      sessionStorage.setItem('tj_age_ok_' + book.id, '1');
      $('agePop').classList.add('hidden');
      bootBook(book, push);
    };
    return;
  }
  bootBook(book, push);
}

/* Pagos reales con Stripe. En la versión real aquí va Stripe */
let featurePending = null, featurePlan = 'week';

/* ---------- Stripe: helper de pago con tarjeta ---------- */
let stripeJs = null, stripeCard = null, stripeKeyCache = null;
async function getStripeJs() {
  if (stripeJs) return stripeJs;
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
  const r = await fetch('/api/books/' + encodeURIComponent(bookId) + '/feature', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, author, sessionId }),
  });
  const d = await r.json().catch(() => ({}));
  if (!d.ok) throw new Error(d.error || 'feature-failed');
  toast('⭐ ¡Tu libro está destacado en portada!');
  try { showLibrary(false); } catch (e) {}
}
/* Finaliza un anuncio pagado al volver de Stripe (sube la foto si se eligió una) */
async function finalizeAd(params, sessionId) {
  const r = await fetch('/api/ads', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, sessionId }),
  });
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
      await fetch('/api/ads/' + encodeURIComponent(adId) + '/photo', { method: 'POST', body: fd });
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
      const r = await fetch('/api/books', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, author: myName, price, text, ageRating }),
      });
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
        const cr = await fetch('/api/books/' + encodeURIComponent(d.book.id) + '/cover', {
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
          const ir = await fetch('/api/books/' + encodeURIComponent(d.book.id) + '/images', { method: 'POST', body: fd2 });
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
function goLiveRoom() {
  syncNameFromLib();
  closeDrawer();
  $('library').classList.add('hidden');
  $('writing').classList.add('hidden');
  $('nameInput').value = myName === t('joinDefaultName') ? '' : myName;
  myRoom = 'SALA';
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
    renderRows();
  });
  $('enterBtn').onclick = goLiveRoom;
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
      const r = await fetch('/api/writings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, text, author: myName }),
      });
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

/* Bienvenida: solo la primera visita. Explica qué es TintaJunta en 10 segundos. */
function initWelcome() {
  try {
    if (localStorage.getItem('tj_welcomed')) return;
  } catch (e) { return; }
  const pop = $('welcomePop');
  if (!pop) return;
  pop.classList.remove('hidden');
  $('welcomeOk').onclick = () => {
    try { localStorage.setItem('tj_welcomed', '1'); } catch (e) {}
    pop.classList.add('hidden');
  };
}

/* Cada init aislado: si uno falla, los demás siguen funcionando */
[['initJoin', initJoin], ['initLibrary', initLibrary], ['initCheckoutReturn', initCheckoutReturn], ['initAds', initAds],
 ['renderAds', renderAds], ['renderAffiliates', renderAffiliates],
 ['initImdbBar', initImdbBar], ['initWriting', initWriting],
 ['initPills', initPills], ['initMarquee', initMarquee],
 ['initBoard', initBoard], ['initFollow', initFollow], ['initWelcome', initWelcome],
 ['initReviews', initReviews], ['initProgress', initProgress], ['initReports', initReports],
 ['initTypo', initTypo], ['initReadProgress', initReadProgress],
 ['initChat', initChat], ['initReactions', initReactions], ['initHands', initHands],
 ['initSwitchBook', initSwitchBook], ['checkAuth', checkAuth],
 ['initParaBar', initParaBar], ['initBoardMode', initBoardMode],
 ['initDeepLink', initDeepLink], ['initAutoRejoin', initAutoRejoin]].forEach(([name, fn]) => {
  try {
    const r = fn();
    if (r && r.catch) r.catch((e) => clog('INIT-FAIL ' + name + ': ' + (e && e.message)));
  } catch (e) { clog('INIT-FAIL ' + name + ': ' + (e && e.message)); }
});
