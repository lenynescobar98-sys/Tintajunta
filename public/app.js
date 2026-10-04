/* TintaJunta · prototipo — lógica de la sala en vivo (cliente) */
'use strict';

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
/* Nombre visible: el profesor lleva 🎓 para diferenciarse siempre */
const displayName = () => (isTeacher && myName && myName !== 'Lector' ? '🎓 ' + myName : myName);
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
  const t = localStorage.getItem('tj_theme') || 'light';
  document.documentElement.dataset.theme = t === 'dark' ? 'dark' : '';
  const b = document.getElementById('themeBtn');
  if (b) { b.textContent = t === 'dark' ? '☀️' : '🌙'; b.title = t === 'dark' ? 'Tema claro' : 'Tema oscuro cálido'; }
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
    b.title = reserved ? 'Negro — reservado para el profesor 🎓' : COLOR_NAMES[key];
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
    pb.title = pencilMode ? 'Lápiz activado: marca directo con tu tinta' : 'Lápiz desactivado: solo lectura';
  }
  // Sin menús nativos mientras el lápiz maneja los toques
  document.body.classList.toggle('pencil-on', pencilMode);
  const hint = document.querySelector('.hint');
  if (hint) {
    hint.innerHTML = pencilMode
      ? '✏️ <b>Lápiz activado:</b> <b>toca</b> una palabra para marcarla, o desliza para marcar varias. <b>Toca tu subrayado</b> para borrar todo el párrafo. Manténlo presionado para agregarle una nota.'
      : '✏️ <b>Lápiz desactivado:</b> solo lectura — desliza para moverte por el texto sin marcar nada. Activa el lápiz para marcar.';
  }
}
function renderPencilBtn() { renderTools(); } // compatibilidad

function initJoin() {
  buildSwatches();
  renderPencilBtn();
  $('pencilBtn').onclick = () => {
    pencilMode = !pencilMode;
    localStorage.setItem('tj_pencil', pencilMode ? 'on' : 'off');
    renderTools();
    toast(pencilMode ? '✏️ Lápiz activado: marca directo' : 'Lápiz desactivado');
  };
  $('themeBtn').onclick = () => {
    const cur = localStorage.getItem('tj_theme') || 'light';
    localStorage.setItem('tj_theme', cur === 'dark' ? 'light' : 'dark');
    applyTheme();
  };
  $('nameInput').value = myName;
  $('roomInput').value = myRoom === 'SALA' ? '' : myRoom;
  const doJoin = () => {
    myName = $('nameInput').value.trim().slice(0, 24) || 'Lector';
    const rc = normalizeRoomClient($('roomInput').value);
    if ($('roomInput').value.trim() && !rc) {
      toast('El código debe tener de 4 a 12 letras o números');
      return;
    }
    myRoom = rc || 'SALA';
    localStorage.setItem('tj_name', myName);
    localStorage.setItem('tj_color', myColor);
    localStorage.setItem('tj_room', myRoom);
    $('join').classList.add('hidden');
    setViewState('room', true);
    boot();
  };
  $('joinBtn').onclick = doJoin;
  $('createRoomBtn').onclick = async () => {
    myName = $('nameInput').value.trim().slice(0, 24) || 'Lector';
    let code = null;
    try {
      const r = await fetch('/api/room/new');
      const d = await r.json();
      code = d && d.code;
    } catch (e) { /* abajo */ }
    if (!code) { toast('No se pudo crear la sala, intenta de nuevo'); return; }
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
  // Fotos del libro (si tiene): se muestran arriba del texto
  if (images && images.length) {
    const gal = document.createElement('div');
    gal.className = 'book-gallery';
    images.forEach((src) => {
      const img = document.createElement('img');
      img.src = src; img.loading = 'lazy'; img.alt = 'Foto del libro';
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
    s.style.background = hexA(COLORS[h.color] || COLORS.azul, 0.30);
    s.title = `${h.name} · ${COLOR_NAMES[h.color] || h.color}`;
  }
}
function repaintAll() {
  cover.clear();
  spanByIdx.forEach((s) => { s.style.background = ''; s.title = ''; s.classList.remove('has-note'); s.style.setProperty('--note-c', ''); });
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
    b.title = 'Ver notas de este párrafo';
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
    box.innerHTML = '<p class="notes-empty">Aún no hay notas. Selecciona un pasaje y deja la primera.</p>';
    return;
  }
  box.innerHTML = '';
  [...notes].reverse().forEach((n) => {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.style.borderLeftColor = COLORS[n.color] || COLORS.azul;
    card.innerHTML =
      `<div class="note-head">
         <span class="note-author"><span class="dot" style="background:${COLORS[n.color] || COLORS.azul}"></span>${esc(n.name)}${n.code ? `<span class="note-code">${esc(n.code)}</span>` : ''}</span>
         ${n.name === displayName() ? `<button class="note-del" data-id="${n.id}" title="Borrar mi nota">✕</button>` : ''}
       </div>
       <p class="note-quote" data-start="${n.start}" data-end="${n.end}">“${esc(n.quote)}”</p>
       <p class="note-text">${esc(n.text)}</p>`;
    box.appendChild(card);
  });
  box.querySelectorAll('.note-del').forEach((b) => {
    b.onclick = () => {
      apiPost(roomBase() + '/del', { kind: 'note', id: b.dataset.id })
        .then(() => { notes = notes.filter((n) => n.id !== b.dataset.id); renderNotes(); paintNoteMarks(); })
        .catch(() => toast('No se pudo borrar la nota'));
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

/* ----------------------------- presencia ------------------------------ */
function renderRoster(roster) {
  const box = $('presence');
  box.innerHTML = `<span style="opacity:.65">${roster.length} en la sala</span>` +
    roster.map((p) =>
      `<span class="chip" data-name="${esc(p.name)}"><span class="dot" style="background:${COLORS[p.color] || COLORS.azul}"></span>${esc(p.name)}</span>`
    ).join('');
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
    chip.innerHTML = `👁 ${names}${more} <i>lee aquí</i>`;
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
        toast(`📖 ${p.name} está leyendo este párrafo contigo`);
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
  $('vnoteName').textContent = n.name || 'Lector';
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
      toast('Párrafo limpiado');
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
        .catch(() => toast('No se pudo borrar'));
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
        toast(s.note.code ? 'Nota ' + s.note.code + ' guardada' : 'Nota guardada al margen');
      }
      setOnline(true);
    } catch (e) {
      setOnline(false);
      toast('No se pudo guardar la nota — revisa tu conexión');
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
    d.title = on ? 'Conectado a la sala' : 'Sin conexión — reintentando…';
  }
}

let lastStateSig = '';
function applyState(s) {
  if (!s || s.ok === false) return;
  // Optimización: si nada cambió desde el último poll, no re-renderizar
  try {
    const sig = JSON.stringify([s.highlights, s.notes, s.board, s.follow, s.chat, s.reactions, s.hands, s.roster, s.switchTo]);
    if (sig === lastStateSig) return;
    lastStateSig = sig;
  } catch (e) { /* si falla el diff, renderizar normal */ }
  highlights = s.highlights || [];
  notes = s.notes || [];
  board = s.board || { text: '', name: '', ts: 0 };
  follow = s.follow || { active: false, pos: 0, ts: 0, name: '' };
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
  checkSwitchTo(s);
  // Avisar al profesor de manos nuevas
  if (isTeacher) {
    hands.forEach((h) => {
      if (!prevHands.has(h.name) && h.name !== displayName().replace(/^🎓 /, '')) {
        toast('✋ ' + h.name + ' levantó la mano');
      }
    });
  }
}

/* ------------------------- pizarra compartida ------------------------- */
/* Solo el profesor (tinta negra 🎓) escribe; todos la ven en vivo. */
let board = { text: '', name: '', ts: 0 };
let boardTimer = null;

function relTime(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 10) return 'ahora mismo';
  if (s < 60) return 'hace ' + s + ' s';
  const m = Math.floor(s / 60);
  if (m < 60) return 'hace ' + m + ' min';
  const h = Math.floor(m / 60);
  if (h < 24) return 'hace ' + h + ' h';
  return 'hace ' + Math.floor(h / 24) + ' d';
}

function renderBoard() {
  const edit = $('boardEdit'), view = $('boardView'), meta = $('boardMeta'), clear = $('boardClear');
  if (!edit) return;
  const teacher = isTeacher;
  edit.classList.toggle('hidden', !teacher);
  view.classList.toggle('hidden', teacher);
  clear.classList.toggle('hidden', !teacher || !board.text);
  // No pisar lo que el profesor está escribiendo
  if (teacher && document.activeElement !== edit && edit.value !== (board.text || '')) {
    edit.value = board.text || '';
  }
  if (!teacher) {
    view.innerHTML = board.text
      ? '<pre>' + esc(board.text) + '</pre>'
      : '<span class="board-empty">La pizarra está vacía — el profesor aún no escribe nada.</span>';
  }
  meta.textContent = (board.text && board.name) ? '✏️ ' + board.name + ' · ' + relTime(board.ts) : '';
}

/* Guarda con debounce de 500ms tras dejar de escribir */
function saveBoard() {
  const edit = $('boardEdit');
  if (!edit || !isTeacher) return;
  apiPost(roomBase() + '/board', { text: edit.value })
    .then((s) => { if (s && s.ok && s.board) { board = s.board; renderBoard(); } })
    .catch(() => toast('No se pudo guardar la pizarra — revisa tu conexión'));
}

function initBoard() {
  const edit = $('boardEdit'), clear = $('boardClear');
  if (!edit) return;
  edit.addEventListener('input', () => {
    clearTimeout(boardTimer);
    boardTimer = setTimeout(saveBoard, 500);
  });
  clear.onclick = () => {
    if (!confirm('¿Limpiar la pizarra para todos?')) return;
    edit.value = '';
    clearTimeout(boardTimer);
    saveBoard();
  };
  renderBoard();
}

/* ------------------------- 👀 Sígueme ------------------------- */
/* El profesor activa "Sígueme" y la pantalla de todos sigue su scroll. */
let follow = { active: false, pos: 0, ts: 0, name: '' };
let iFollow = false;          // yo (estudiante) estoy siguiendo ahora
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
    btn.title = follow.active
      ? '👀 Sígueme ACTIVADO — tócalo para detener el seguimiento'
      : '👀 Sígueme: la pantalla de todos sigue tu lectura';
  }
  if (isTeacher) { if (pill) pill.classList.add('hidden'); return; }
  if (!follow.active || currentView !== 'room') {
    iFollow = false;
    if (pill) pill.classList.add('hidden');
    return;
  }
  if (!iFollow) iFollow = true; // el profesor lo activó → empiezo a seguir
  if (pill) pill.classList.remove('hidden');
  followScrollTo();
}

function initFollow() {
  const btn = $('followBtn');
  if (btn) btn.onclick = () => {
    if (!isTeacher) return;
    const activating = !follow.active;
    const body = activating ? { active: true, pos: followPos() } : { active: false };
    apiPost(roomBase() + '/follow', body)
      .then((s) => {
        if (s && s.ok && s.follow) { follow = s.follow; renderFollow(); }
        if (activating) toast('👀 Sígueme activado — todos te siguen');
      })
      .catch(() => toast('No se pudo cambiar Sígueme — revisa tu conexión'));
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
        // el estudiante se movió por su cuenta → deja de seguir
        iFollow = false;
        toast('Dejaste de seguir al profesor');
        renderFollow();
      }
    }, { passive: true });
  }
  renderFollow();
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
    list.innerHTML = '<p class="join-note">No hay libros en la biblioteca todavía.</p>';
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
  toast('📚 El profesor cambió a "' + (sw.title || 'otro libro') + '"');
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
    box.innerHTML = '<p class="notes-empty">Aún no hay mensajes. Sé el primero en escribir.</p>';
    return;
  }
  box.innerHTML = '';
  chat.forEach((m) => {
    const div = document.createElement('div');
    div.className = 'chat-msg' + (m.name === displayName() ? ' mine' : '');
    div.innerHTML =
      `<span class="chat-author"><span class="dot" style="background:${COLORS[m.color] || COLORS.azul}"></span>${esc(m.name)}</span>` +
      `<span class="chat-text">${esc(m.text)}</span>` +
      `<span class="chat-ts">${relTime(m.ts)}</span>`;
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
    .catch(() => { setOnline(false); toast('No se pudo enviar — revisa tu conexión'); });
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
    .catch(() => { setOnline(false); toast('No se pudo reaccionar — revisa tu conexión'); });
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
    btn.title = myHandUp() ? '✋ Mano levantada — tócalo para bajarla' : '✋ Levantar la mano';
  }
}

function initHands() {
  const btn = $('handBtn');
  if (btn) btn.onclick = () => {
    const up = !myHandUp();
    apiPost(roomBase() + '/hand', { up })
      .then((s) => {
        if (s && s.ok) { hands = s.hands || []; renderHands(); renderRoster(); }
        toast(up ? '✋ Mano levantada' : 'Mano bajada');
        setOnline(true);
      })
      .catch(() => { setOnline(false); toast('No se pudo — revisa tu conexión'); });
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
        chip.title = 'Tocar para bajar la mano de ' + name;
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
    toast('No se pudo guardar el subrayado — revisa tu conexión');
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
    toast('No se pudo borrar — revisa tu conexión');
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
        toast('Enlace de la sala copiado');
      } catch (e) {
        toast('Enlace de la sala: ' + link); // el lector lo puede dictar o escribir
      }
      clog('enlace copiado/mostrado: ' + link);
    };
  }
  joinRoom();
}
/* Entrar (o re-entrar) a la sala actual: registra presencia y trae el estado */
function joinRoom() {
  apiPost(roomBase() + '/join', {})
    .then((s) => {
      if (s.room) { myRoom = s.room; updateRoomLabel(); }
      applyState(s);
      setOnline(true);
      clog('red: dentro de ' + myRoom);
    })
    .catch(() => { setOnline(false); toast('No se pudo entrar, reintentando…'); });
  pollState();
}
function updateRoomLabel() {
  // Indicador de QUÉ se está leyendo: 📝 libro de creador · 📜 clásico gratis · 📄 muestra
  const typeBadge = readingType === 'classic' ? ' 📜 <span class="rtype">Clásico gratis</span>'
    : readingType === 'book' ? ' 📝 <span class="rtype">Libro de creador</span>'
    : ' 📄 <span class="rtype">Texto de muestra</span>';
  if (currentBook) {
    $('roomLabel').innerHTML = esc(currentBook.title) + typeBadge;
    $('backBtn').classList.remove('hidden');
    $('copyRoom').classList.add('hidden');
  } else {
    let code = $('roomCode');
    if (!code) {
      $('roomLabel').innerHTML = 'Sala <b id="roomCode">SALA</b>' + typeBadge;
      code = $('roomCode');
    } else {
      $('roomLabel').innerHTML = 'Sala <b id="roomCode">' + esc(myRoom) + '</b>' + typeBadge;
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
  setViewState('room', push);
  updateRoomLabel();
  const ch = book.chapters[0];
  const kindNote = book.classic
    ? '📜 Clásico de dominio público — gratis para todos. Tus marcas son visibles para todos los lectores.'
    : book.price > 0 ? 'Libro adquirido. Tus marcas son visibles para todos los lectores.' : 'Libro gratuito. Tus marcas son visibles para todos los lectores.';
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
  if (view) currentView = view;
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
  myName = localStorage.getItem('tj_name') || myName || 'Lector'; // sin prefijo 🎓 (ese lo pone displayName)
  currentBook = null;
  updateRoomLabel();
  boot();
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
const ownedBooks = () => {
  try { return JSON.parse(localStorage.getItem('tj_owned') || '[]'); }
  catch { return []; }
};
const isOwned = (id) => ownedBooks().includes(id);
const markOwned = (id) => {
  const o = ownedBooks();
  if (!o.includes(id)) { o.push(id); localStorage.setItem('tj_owned', JSON.stringify(o)); }
};
const fmtPrice = (cents) => '$' + (cents / 100).toFixed(2);

function syncNameFromLib() {
  const v = $('libNameInput').value.trim().slice(0, 24);
  if (v) { myName = v; localStorage.setItem('tj_name', myName); }
  else if (!myName || myName === 'Lector') { myName = 'Lector'; }
  return myName;
}

/* Solo anuncios REALES: los pagados vigentes + Best Offer. Nada de relleno. */
const AD_BADGE_LABEL = { 'mas-vendido': '🔥 Más vendido', 'famoso': '⭐ Famoso' };
/* Afiliados: recomendados por TintaJunta. Prototipo: los links reales van aquí al activar cuentas de afiliado. */
const AFFILIATES = [
  { emoji: '👓', name: 'Lentes luz azul', store: 'Amazon', price: '~$25', hue: 210, url: 'https://www.amazon.com/dp/B0HC11K9C1/ref=cm_sw_r_as_gl_api_gl_i_XQ5REAJQBVWYNPKKKF8G?linkCode=ml1&tag=lenynalopez-20&linkId=3136a4a8563b0fa762bd257308a205ea&gaOptInStatus=true' },
  { emoji: '🎧', name: 'Audífonos bluetooth', store: 'Amazon', price: '~$40', hue: 270, url: 'https://www.amazon.com/dp/B0H7WXNBNV/ref=cm_sw_r_as_gl_api_gl_i_RC1X2MW0SBJ9DJEK0SX8?linkCode=ml1&tag=lenynalopez-20&linkId=6c2fdb71aebaa7f63fe127c69b9ee6f0&gaOptInStatus=true' },
  { emoji: '💡', name: 'Lámpara de lectura', store: 'Amazon', price: '~$30', hue: 45, url: 'https://www.amazon.com/dp/B0H6YB4GN7/ref=cm_sw_r_as_gl_api_gl_i_SDGYJ51ATCR9NS1SN7D6?linkCode=ml1&tag=lenynalopez-20&linkId=46fe3a3c2f7473ed3625d2322f55b470&gaOptInStatus=true' },
  { emoji: '📱', name: 'E-reader', store: 'Amazon', price: '~$150', hue: 160, url: 'https://www.amazon.com/dp/B0FJ32FWKS/ref=cm_sw_r_as_gl_api_gl_i_HDYB0VVM5GG3MNXQ7NS3?linkCode=ml1&tag=lenynalopez-20&linkId=2ecd0e45383c549ae5b06621aff2f15e&gaOptInStatus=true' },
  { emoji: '☕', name: 'Taza térmica', store: 'Amazon', price: '~$20', hue: 20, url: 'https://link.amazon/B03uHrImb' },
  { emoji: '🪑', name: 'Cojín de lectura', store: 'Amazon', price: '~$35', hue: 120, url: 'https://www.amazon.com/dp/B0DTBKYSHX/ref=cm_sw_r_as_gl_api_gl_i_GSX2NQ5P16XA944E76K9?linkCode=ml1&tag=lenynalopez-20&linkId=3b4379a8eadd66d35e3e00d35f012f84&gaOptInStatus=true' },
];
function renderAffiliates() {
  const row = document.getElementById('rowAff');
  if (!row) return;
  row.innerHTML = '';
  AFFILIATES.forEach((a) => {
    const card = document.createElement('div');
    card.className = 'ad-card';
    card.innerHTML =
      adCardVisual(a.emoji, a.hue) +
      `<div class="ad-badge">🔗 ${esc(a.store)}</div>` +
      `<div class="ad-name">${esc(a.name)}</div>` +
      `<div class="ad-note">${esc(a.price)} · Link de afiliado · Toca para ver</div>`;
    card.onclick = () => {
      if (a.url) window.open(a.url, '_blank', 'noopener');
      else toast('Link de afiliado no configurado');
    };
    row.appendChild(card);
  });
}
/* 📅 Eventos: información pública de eventos literarios (GET /api/events).
   Los pagados (paid:true) van primero con insignia "⭐ Patrocinado".
   Sin logos de terceros, sin claims de aval; el link siempre va a la fuente oficial. */
async function renderEvents() {
  const row = document.getElementById('rowEvents');
  if (!row) return;
  let events = [];
  try {
    const r = await fetch('/api/events', { cache: 'no-store' });
    const d = await r.json();
    if (d && d.ok && Array.isArray(d.events)) events = d.events;
  } catch (e) { /* sin conexión: la fila queda vacía */ }
  row.innerHTML = '';
  events.forEach((ev) => {
    const card = document.createElement('div');
    card.className = 'ad-card' + (ev.paid ? ' ad-paid' : '');
    card.innerHTML =
      adCardVisual(ev.emoji || '📅', typeof ev.hue === 'number' ? ev.hue : 200) +
      (ev.paid ? '<div class="ad-badge">⭐ Patrocinado</div>' : '') +
      `<div class="ad-name">${esc(ev.name || 'Evento')}</div>` +
      `<div class="ev-date">${esc(ev.date || '')} · ${esc(ev.place || '')}</div>` +
      `<div class="ad-note">${esc(ev.desc || '')}</div>` +
      `<div class="ev-link">Ver más ↗</div>`;
    card.onclick = () => {
      const url = String(ev.url || '');
      if (ev.example) { toast('Evento de ejemplo — pronto habrá eventos reales aquí'); return; }
      if (/^https?:\/\//i.test(url)) window.open(url, '_blank', 'noopener');
      else toast('Este evento aún no tiene link oficial');
    };
    row.appendChild(card);
  });
}
let paidAds = [];
let lastFeat = [];
function adCardVisual(emoji, hue) {
  return `<div class="ad-visual" style="background:linear-gradient(150deg,hsl(${hue},55%,55%),hsl(${(hue + 30) % 360},50%,35%))"><span>${esc(emoji)}</span></div>`;
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
    `<div class="tile-cover"><img src="img/best-offer-logo.jpg" alt="Best Offer"></div>` +
    `<div class="tile-title">Best Offer</div>` +
    `<div class="tile-sub">⭐ Comunidad · 8,400+ miembros</div>`;
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
  if (!tiles.length) row.innerHTML = '<p class="hrow-empty">Pronto habrá anuncios aquí.</p>';
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
  let prices = { day: 299, week: 1499 };
  try {
    const r = await fetch('/api/ad-prices');
    const d = await r.json();
    if (d.ok && d.prices) prices = d.prices;
  } catch { /* valores por defecto */ }
  const plans = $('adPlans');
  plans.innerHTML = '';
  [['day', 'Por día', prices.day], ['week', 'Por semana', prices.week], ['month', 'Por mes', prices.month]].forEach(([key, label, cents]) => {
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
    if (!name && !adPending) { toast('Ponle un nombre a tu producto'); return; }
    let adUrl = ($('adUrl').value || '').trim().slice(0, 300);
    if (adUrl && !/^https?:\/\//i.test(adUrl)) adUrl = 'https://' + adUrl;
    const badge = (document.querySelector('input[name="abadge"]:checked') || {}).value || 'mas-vendido';
    syncNameFromLib();
    const adv = displayName();
    if (!adv || adv === 'Lector') { toast('Escribe tu nombre primero'); return; }
    $('adConfirm').disabled = true;
    $('adConfirm').textContent = 'Procesando…';
    try {
      // 1. Cobrar con Stripe
      const pid = await payWithStripe({
        type: 'ad',
        intentParams: { name, emoji: adEmoji, badge, plan: adPlan, advertiser: adv, url: adUrl,
          ...(adPending ? { id: adPending.id } : {}) },
        description: `Anunciar "${name || 'producto'}"`, amountCents: null,
      });
      // 2. Crear/renovar el anuncio (el servidor verifica el pago con Stripe)
      const r = await fetch('/api/ads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, emoji: adEmoji, badge, plan: adPlan, advertiser: adv, url: adUrl,
          paymentIntentId: pid, ...(adPending ? { id: adPending.id } : {}) }),
      });
      const d = await r.json();
      if (!d.ok) throw 0;
      // subir foto del producto si eligió una (JPG/PNG/WebP, 2MB)
      const photoFile = $('adPhoto').files[0] || null;
      const adId = (d.ad && d.ad.id) || (adPending && adPending.id);
      if (photoFile && adId) {
        const okType = ['image/jpeg', 'image/png', 'image/webp'].includes(photoFile.type);
        if (!okType) toast('La foto debe ser JPG, PNG o WebP');
        else if (photoFile.size > 2 * 1024 * 1024) toast('La foto no puede pasar de 2MB');
        else {
          const fd = new FormData();
          fd.append('photo', photoFile);
          fd.append('advertiser', adv);
          const pr = await fetch('/api/ads/' + encodeURIComponent(adId) + '/photo', { method: 'POST', body: fd });
          const pd = await pr.json().catch(() => ({}));
          if (!pd.ok) toast('Anuncio creado, pero la foto no se pudo subir');
        }
      }
      $('adPhoto').value = '';
      $('adPop').classList.add('hidden');
      toast(adPending ? '🔄 ¡Anuncio renovado!' : '📢 ¡Tu anuncio está en portada!');
      adPending = null;
      renderAds();
    } catch (e) {
      if (String((e && e.message) || e) !== 'cancelado') toast('No se pudo completar el pago');
    }
    $('adConfirm').disabled = false;
    $('adConfirm').textContent = 'Pagar y publicar';
  };
}
/* Orden de la lista: popularidad | titulo | precio */
let libSort = 'popularidad';
let libPill = localStorage.getItem('tj_pill') || 'todos'; // todos|gratis|destacados|nuevos|populares
let libQuery = '';
let libBooksCache = []; // todos los libros cargados (para filtrar sin recargar)
/* ------------------------------ ⭐ reseñas ------------------------------
   Estrellas + contador en tarjetas e inmersiva; modal para dejar reseña. */
function ratingText(b) {
  const r = b.rating || { avg: 0, count: 0 };
  return r.count > 0 ? `⭐ ${r.avg} (${r.count})` : '☆ Sin reseñas';
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
  return `<span class="lvl-badge" data-level-for="${esc(author)}" title="Nivel de creador"></span>`;
}
async function showAchievements() {
  const name = displayName();
  const body = $('achBody');
  $('achSub').textContent = name && name !== 'Lector' ? name + ' · tu nivel sube con cada libro vendido.' : 'Tu nivel sube con cada libro vendido.';
  body.innerHTML = '<p class="join-note">Cargando…</p>';
  $('achPop').classList.remove('hidden');
  $('achClose').onclick = () => $('achPop').classList.add('hidden');
  const d = await fetchLevel(name);
  if (!d) { body.innerHTML = '<p class="join-note">No se pudo cargar. Revisa tu conexión.</p>'; return; }
  const pct = d.next ? Math.min(100, Math.round((d.sales / (d.sales + d.next.need)) * 100)) : 100;
  body.innerHTML =
    `<div class="ach-level"><span style="font-size:44px">${d.level.emoji}</span>` +
    `<div><div style="font-size:18px;font-weight:700">${d.level.name}</div>` +
    `<div class="join-note" style="margin:4px 0">${d.sales} venta(s) · ${d.books} libro(s) · 💬 ${d.notes} notas</div></div></div>` +
    (d.next
      ? `<div class="ach-next">A <b>${d.next.need}</b> venta(s) de <b>${d.next.emoji} ${d.next.name}</b></div>` +
        `<div class="ach-bar"><div class="ach-fill" style="width:${pct}%"></div></div>`
      : `<div class="ach-next">🏆 ¡Nivel máximo alcanzado!</div>`) +
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
  const vBadge = p.verified ? '<span class="kp-verified" title="Creador verificado">✓</span>' : '';
  const lvl = p.level ? `<span class="kp-level" title="Nivel ${esc(p.level.name)}">${p.level.emoji}</span>` : '';
  const avatar = p.photo
    ? `<div class="kp-avatar"><img src="${esc(p.photo)}" alt="Foto de ${esc(p.name)}"></div>`
    : `<div class="kp-avatar">${kpInitial(p.name)}</div>`;
  const role = `Autor · ${p.books} libro${p.books === 1 ? '' : 's'}`;
  const since = p.since ? new Date(p.since).toLocaleDateString('es', { month: 'long', year: 'numeric' }) : '';
  const facts =
    (p.location ? `<div class="kp-fact"><b>Ubicación</b><span>📍 ${esc(p.location)}</span></div>` : '') +
    (p.website ? `<div class="kp-fact"><b>Sitio web</b><a href="${esc(p.website)}" target="_blank" rel="noopener">${esc(p.website.replace(/^https?:\/\//i, ''))}</a></div>` : '') +
    (since ? `<div class="kp-fact"><b>Publicando desde</b><span>📅 ${esc(since)}</span></div>` : '');
  const links = [];
  if (p.website) links.push(`<a class="kp-link" href="${esc(p.website)}" target="_blank" rel="noopener">🌐 Sitio oficial</a>`);
  (SOCIAL_DEFS || []).forEach((s) => {
    const url = p.socials && p.socials[s.key];
    if (url) links.push(`<a class="kp-link" href="${esc(url)}" target="_blank" rel="noopener">${s.emoji} ${s.label}</a>`);
  });
  const booksHtml = (p.booksList && p.booksList.length)
    ? `<div class="kp-books">` + p.booksList.map((b) =>
        `<div class="kp-book" data-book="${esc(b.id)}">` +
        (b.coverUrl ? `<img src="${esc(b.coverUrl)}" alt="Portada de ${esc(b.title)}" loading="lazy">`
          : `<div style="aspect-ratio:2/3;${coverStyle(b.id)};position:relative"><div class="cover-title" style="font-size:13px">${esc(b.title)}</div></div>`) +
        `<div class="kp-book-t">${esc(b.title)}</div>` +
        `<div class="kp-book-p">${b.price === 0 ? 'Gratis' : fmtPrice(b.price)}</div></div>`
      ).join('') + `</div>`
    : `<p class="join-note" style="margin:6px 0">Aún no tiene libros publicados.</p>`;
  return `<div class="kp">` +
    `<div class="kp-head">${avatar}<div><h3 class="kp-name">${esc(p.name)}${vBadge}${lvl}</h3><div class="kp-role">${esc(role)}</div></div></div>` +
    (p.bio ? `<p class="kp-bio">${esc(p.bio)}</p>` : '') +
    (facts ? `<div class="kp-facts">${facts}</div>` : '') +
    (links.length ? `<div class="kp-links">${links.join('')}</div>` : '') +
    (p.about ? `<div class="kp-sec">Acerca de</div><p class="kp-about">${esc(p.about)}</p>` : '') +
    `<div class="kp-stats">` +
    `<div class="kp-stat"><b>${p.books}</b><span>Libros</span></div>` +
    `<div class="kp-stat"><b>${p.sales}</b><span>Lectores</span></div>` +
    `<div class="kp-stat"><b>${p.notes}</b><span>Notas</span></div>` +
    (p.level ? `<div class="kp-stat"><b>${p.level.emoji}</b><span>${esc(p.level.name)}</span></div>` : '') +
    `</div>` +
    `<div class="kp-sec">Libros de ${esc(p.name)}</div>${booksHtml}` +
    (p.canEdit ? `<button class="btn btn-primary kp-edit" id="kpEditBtn">✏️ Editar mi perfil</button>` : '') +
    `</div>`;
}
async function showCreatorProfile(name) {
  name = String(name || '').trim();
  if (!name) return;
  const body = $('creatorBody');
  body.innerHTML = '<p class="join-note">Cargando perfil…</p>';
  $('creatorPop').classList.remove('hidden');
  $('creatorClose').onclick = () => $('creatorPop').classList.add('hidden');
  let p = null;
  try {
    const r = await fetch('/api/creators/' + encodeURIComponent(name) + '/profile', { cache: 'no-store' });
    const d = await r.json();
    if (d && d.ok) p = d.profile;
  } catch (e) { /* sin conexión */ }
  if (!p) { body.innerHTML = '<p class="join-note">No se pudo cargar el perfil. Revisa tu conexión.</p>'; return; }
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
  body.innerHTML = `<div class="kp"><div class="kp-sec" style="margin-top:0">Editar perfil — ${esc(p.name)}</div>
  <div class="kp-form">
    <div><label>Foto de perfil</label>
      <div class="kp-photo-row">
        <div class="kp-avatar" style="width:56px;height:56px;font-size:24px">${p.photo ? `<img src="${esc(p.photo)}" alt="">` : kpInitial(p.name)}</div>
        <input type="file" id="kpPhoto" accept="image/jpeg,image/png,image/webp,image/gif" style="font-size:13px">
      </div></div>
    <div><label>Bio corta (160)</label><input id="kpBio" maxlength="160" value="${esc(p.bio || '')}" placeholder="Una línea sobre ti"></div>
    <div><label>Ubicación</label><input id="kpLoc" maxlength="60" value="${esc(p.location || '')}" placeholder="Ciudad, País"></div>
    <div><label>Sitio web</label><input id="kpWeb" maxlength="120" value="${esc(p.website || '')}" placeholder="https://tusitio.com"></div>
    <div><label>Redes oficiales</label><div class="kp-soc">` +
    SOCIAL_DEFS.map((d) =>
      `<input id="kpSoc_${d.key}" maxlength="120" value="${esc(s[d.key] || '')}" placeholder="${d.emoji} ${d.label}">`
    ).join('') + `</div></div>
    <div><label>Acerca de (1000)</label><textarea id="kpAbout" maxlength="1000" placeholder="Cuéntales a tus lectores quién eres…">${esc(p.about || '')}</textarea></div>
    <div style="display:flex;gap:8px">
      <button class="btn" id="kpCancel" style="flex:1">Cancelar</button>
      <button class="btn btn-primary" id="kpSave" style="flex:2">💾 Guardar</button>
    </div>
  </div></div>`;
  $('kpCancel').onclick = () => showCreatorProfile(p.name);
  $('kpSave').onclick = () => saveCreatorProfile(p.name);
}
async function saveCreatorProfile(name) {
  const btn = $('kpSave');
  btn.disabled = true; btn.textContent = 'Guardando…';
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
    toast('Perfil actualizado ✅');
    showCreatorProfile(name); // recargar
  } catch (e) {
    const msg = e.message === 'not-owner' ? 'Solo el dueño puede editar este perfil (entra con Google).'
      : e.message === 'login' ? 'Entra con Google para editar tu perfil.'
      : e.message === 'too-big' ? 'La foto es muy pesada (máx 2MB).'
      : e.message === 'bad-type' ? 'La foto debe ser JPG, PNG, WebP o GIF.'
      : 'No se pudo guardar. Revisa tu conexión.';
    toast(msg);
    btn.disabled = false; btn.textContent = '💾 Guardar';
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
  if (state === 'ok') return `<span class="vrf-ok">✅ ${okText || 'Verificado'}</span>`;
  if (state === 'pending') return `<span class="vrf-pend">⏳ ${pendText || 'En revisión'}</span>`;
  if (state === 'rejected') return `<span class="vrf-no">❌ Rechazado</span>`;
  return `<span class="vrf-no">⚪ Pendiente</span>`;
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
  if (!p) { body.innerHTML = '<p class="join-note">No se pudo cargar. Revisa tu conexión.</p>'; return; }
  const idSt = p.identity && p.identity.status ? p.identity.status : 'none';
  body.innerHTML =
    vRow('✔️', 'Creador verificado', 'La insignia azul junto a tu nombre genera confianza.',
      p.verified ? vStatus('ok') : '<span class="vrf-no">⚪ La otorga el administrador</span>', '') +
    vRow('📝', 'Originalidad', 'Cada libro que publicas pasa una revisión anti-plagio automática.',
      vStatus('ok', 'Activa'), '') +
    vRow('🪪', 'Identidad', 'Confirma quién eres con tu nombre completo y documento.',
      vStatus(idSt === 'approved' ? 'ok' : idSt),
      idSt === 'approved' ? '' :
      `<div class="vrf-form"><input id="vIdName" placeholder="Nombre completo" maxlength="80" value="${esc((p.identity && p.identity.fullName) || '')}">` +
      `<input id="vIdDoc" placeholder="Documento de identidad" maxlength="40">` +
      `<button class="btn btn-primary" id="vIdSend">Enviar a revisión</button></div>`) +
    vRow('🔞', 'Clasificación de edad', 'Elige la clasificación al publicar: Todos, +13 o +18.',
      vStatus('ok', 'Activa'), '') +
    vRow('🛡️', 'Revisión previa', 'Tus libros salen en la biblioteca tras la aprobación del administrador.',
      vStatus('ok', 'Activa'), '') +
    vRow('📧', 'Email verificado', 'Confirma tu correo con el código que te mostramos.',
      vStatus(p.emailVerified ? 'ok' : 'none'),
      p.emailVerified ? `<p class="vrf-done">${esc(p.email || '')}</p>` :
      `<div class="vrf-form"><input id="vEmail" type="email" placeholder="tu@correo.com" maxlength="80" value="${esc(p.email || '')}">` +
      `<button class="btn btn-primary" id="vEmailSend">Enviar código</button>` +
      `<div id="vEmailCodeWrap" class="hidden"><p class="vrf-code" id="vEmailCode"></p>` +
      `<input id="vEmailCodeIn" placeholder="Código de 6 dígitos" maxlength="6" inputmode="numeric">` +
      `<button class="btn btn-primary" id="vEmailVerify">Verificar</button></div></div>`) +
    vRow('📱', 'Teléfono verificado', 'Confirma tu número con el código que te mostramos.',
      vStatus(p.phoneVerified ? 'ok' : 'none'),
      p.phoneVerified ? `<p class="vrf-done">${esc(p.phone || '')}</p>` :
      `<div class="vrf-form"><input id="vPhone" placeholder="+1 555 123 4567" maxlength="20" value="${esc(p.phone || '')}">` +
      `<button class="btn btn-primary" id="vPhoneSend">Enviar código</button>` +
      `<div id="vPhoneCodeWrap" class="hidden"><p class="vrf-code" id="vPhoneCode"></p>` +
      `<input id="vPhoneCodeIn" placeholder="Código de 6 dígitos" maxlength="6" inputmode="numeric">` +
      `<button class="btn btn-primary" id="vPhoneVerify">Verificar</button></div></div>`) +
    vRow('🏦', 'Cuenta bancaria', 'Para recibir tus pagos. La verifica el administrador.',
      vStatus(p.bankVerified ? 'ok' : (p.bank ? 'pending' : 'none')),
      p.bankVerified ? `<p class="vrf-done">${esc(p.bank.bank)} ···· ${esc(p.bank.last4)}</p>` :
      `<div class="vrf-form"><input id="vBankName" placeholder="Banco" maxlength="60">` +
      `<input id="vBankRout" placeholder="Número de ruta" maxlength="20" inputmode="numeric">` +
      `<input id="vBankAcct" placeholder="Número de cuenta" maxlength="30" inputmode="numeric">` +
      `<button class="btn btn-primary" id="vBankSend">Enviar a verificación</button></div>`) +
    vRow('🧾', 'Datos fiscales', 'Necesarios para tus pagos como creador.',
      vStatus(p.taxDone ? 'ok' : 'none'),
      p.taxDone ? `<p class="vrf-done">Datos registrados</p>` :
      `<div class="vrf-form"><input id="vTaxName" placeholder="Nombre legal" maxlength="80">` +
      `<input id="vTaxAddr" placeholder="Dirección" maxlength="120">` +
      `<input id="vTaxSsn" placeholder="SSN (últimos 4)" maxlength="4" inputmode="numeric">` +
      `<button class="btn btn-primary" id="vTaxSend">Guardar</button></div>`);
  const post = async (url, data) => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return r.json().catch(() => ({}));
  };
  const enc = encodeURIComponent(name);
  const bind = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
  bind('vIdSend', async () => {
    const d = await post(`/api/creators/${enc}/identity`, { fullName: $('vIdName').value, docId: $('vIdDoc').value });
    toast(d.ok ? '🪪 Identidad enviada a revisión' : 'Completa nombre y documento');
    if (d.ok) showVerifications();
  });
  bind('vEmailSend', async () => {
    const d = await post(`/api/creators/${enc}/email`, { email: $('vEmail').value });
    if (!d.ok) { toast('Revisa el correo ingresado'); return; }
    $('vEmailCodeWrap').classList.remove('hidden');
    $('vEmailCode').textContent = 'Tu código (prototipo): ' + d.code;
  });
  bind('vEmailVerify', async () => {
    const d = await post(`/api/creators/${enc}/email/verify`, { code: $('vEmailCodeIn').value });
    toast(d.ok ? '📧 Email verificado' : 'Código incorrecto');
    if (d.ok) showVerifications();
  });
  bind('vPhoneSend', async () => {
    const d = await post(`/api/creators/${enc}/phone`, { phone: $('vPhone').value });
    if (!d.ok) { toast('Revisa el número ingresado'); return; }
    $('vPhoneCodeWrap').classList.remove('hidden');
    $('vPhoneCode').textContent = 'Tu código (prototipo): ' + d.code;
  });
  bind('vPhoneVerify', async () => {
    const d = await post(`/api/creators/${enc}/phone/verify`, { code: $('vPhoneCodeIn').value });
    toast(d.ok ? '📱 Teléfono verificado' : 'Código incorrecto');
    if (d.ok) showVerifications();
  });
  bind('vBankSend', async () => {
    const d = await post(`/api/creators/${enc}/bank`, { bank: $('vBankName').value, routing: $('vBankRout').value, account: $('vBankAcct').value });
    toast(d.ok ? '🏦 Datos enviados a verificación' : 'Completa banco, ruta y cuenta');
    if (d.ok) showVerifications();
  });
  bind('vTaxSend', async () => {
    const d = await post(`/api/creators/${enc}/tax`, { legalName: $('vTaxName').value, address: $('vTaxAddr').value, ssn4: $('vTaxSsn').value });
    toast(d.ok ? '🧾 Datos fiscales guardados' : 'Completa todos los campos (SSN: 4 dígitos)');
    if (d.ok) showVerifications();
  });
}
/* ------------------------- 🛡️ Panel admin ------------------------- */
async function showAdminPanel() {
  const body = $('adminBody');
  body.innerHTML = '<p class="join-note">Cargando…</p>';
  $('adminPop').classList.remove('hidden');
  $('adminClose').onclick = () => $('adminPop').classList.add('hidden');
  let d = null;
  try {
    const r = await fetch('/api/admin/pending?admin=' + encodeURIComponent(displayName()));
    d = await r.json();
  } catch (e) {}
  if (!d || !d.ok) { body.innerHTML = '<p class="join-note">Sin acceso.</p>'; return; }
  const post = async (url, data) => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return r.json().catch(() => ({}));
  };
  const admin = displayName();
  let html = '';
  html += `<h4>📚 Libros en revisión (${d.pendingBooks.length})</h4>`;
  html += d.pendingBooks.length ? d.pendingBooks.map((b) =>
    `<div class="adm-row"><span><b>${esc(b.title)}</b> · ${esc(b.author)} · ${b.price === 0 ? 'Gratis' : fmtPrice(b.price)} · ${b.ageRating === '18' ? '+18' : b.ageRating === '13' ? '+13' : 'Todos'}</span>` +
    `<span><button class="btn btn-primary" data-adm="book-ok" data-id="${esc(b.id)}">Aprobar</button> ` +
    `<button class="btn" data-adm="book-no" data-id="${esc(b.id)}">Rechazar</button></span></div>`
  ).join('') : '<p class="join-note">Nada pendiente.</p>';
  html += `<h4>🪪 Identidades (${d.pendingIdentity.length})</h4>`;
  html += d.pendingIdentity.length ? d.pendingIdentity.map((c) =>
    `<div class="adm-row"><span><b>${esc(c.name)}</b> · ${esc(c.fullName)} · doc ${esc(c.docId)}</span>` +
    `<span><button class="btn btn-primary" data-adm="id-ok" data-id="${esc(c.name)}">Aprobar</button> ` +
    `<button class="btn" data-adm="id-no" data-id="${esc(c.name)}">Rechazar</button></span></div>`
  ).join('') : '<p class="join-note">Nada pendiente.</p>';
  html += `<h4>🏦 Cuentas bancarias (${d.pendingBank.length})</h4>`;
  html += d.pendingBank.length ? d.pendingBank.map((c) =>
    `<div class="adm-row"><span><b>${esc(c.name)}</b> · ${esc(c.bank)} ···· ${esc(c.last4)}</span>` +
    `<span><button class="btn btn-primary" data-adm="bank-ok" data-id="${esc(c.name)}">Verificar</button></span></div>`
  ).join('') : '<p class="join-note">Nada pendiente.</p>';
  html += `<h4>✔️ Creador verificado</h4><div class="vrf-form"><input id="admVName" placeholder="Nombre del creador" maxlength="60">` +
    `<button class="btn btn-primary" id="admVTog">Otorgar / quitar insignia</button></div>`;
  body.innerHTML = html;
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
      toast(r2.ok ? 'Hecho' : 'No se pudo');
      if (r2.ok) { showAdminPanel(); showLibrary(false); }
    };
  });
  const vt = $('admVTog');
  if (vt) vt.onclick = async () => {
    const nm = $('admVName').value.trim();
    if (!nm) { toast('Escribe el nombre del creador'); return; }
    const r2 = await post('/api/admin/creator/verify', { admin, name: nm, verified: true });
    toast(r2.ok ? `✔️ ${nm} verificado` : 'No se pudo');
  };
}
function ratingHtml(b) {
  return `<span class="tile-rating" data-book="${esc(b.id)}" title="Ver / dejar reseña">${ratingText(b)}</span>`;
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
  list.innerHTML = '<p class="join-note">Cargando reseñas…</p>';
  try {
    const r = await fetch('/api/books/' + encodeURIComponent(bookId) + '/reviews', { cache: 'no-store' });
    const d = await r.json();
    if (!d.ok) throw 0;
    if (!d.reviews.length) { list.innerHTML = '<p class="join-note">Aún no hay reseñas. ¡Sé el primero!</p>'; return; }
    list.innerHTML = d.reviews.map((x) =>
      `<div class="review-item"><b>${esc(x.name)}</b> <span class="r-stars">${'★'.repeat(x.stars)}${'☆'.repeat(5 - x.stars)}</span>` +
      (x.comment ? `<p>${esc(x.comment)}</p>` : '') + `</div>`).join('');
  } catch (e) { list.innerHTML = '<p class="join-note">No se pudieron cargar las reseñas.</p>'; }
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
      toast('¡Gracias por tu reseña! ⭐');
      $('reviewPop').classList.add('hidden');
      refreshBookRating(reviewBookId, d.avg, d.count);
    } catch (e) { toast('No se pudo guardar la reseña — revisa tu conexión'); }
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
const REPORT_REASONS = [
  ['no-original', 'No es un libro original del autor'],
  ['copyright', 'Tiene derechos de autor (es un libro comercial)'],
  ['dominio-publico', 'Es de dominio público'],
  ['copiado', 'Contenido copiado de otro creador'],
  ['otro', 'Otro motivo'],
];
const REPORT_THRESHOLD = 3;
function reportBadge(b) {
  return (b.reports || 0) >= REPORT_THRESHOLD
    ? `<div class="report-badge">⚠️ Reportado por la comunidad</div>` : '';
}
function reportBtnHtml(b) {
  return `<span class="tile-report" data-book="${esc(b.id)}" title="Reportar este libro">🚩</span>`;
}
let reportBookId = null, reportReason = 'no-original';
function showReportModal(bookId, bookTitle) {
  reportBookId = bookId; reportReason = 'no-original';
  $('reportBookTitle').textContent = bookTitle || '';
  $('reportOther').value = '';
  $('reportOtherWrap').classList.add('hidden');
  const box = $('reportReasons');
  box.innerHTML = '';
  REPORT_REASONS.forEach(([key, label]) => {
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
      toast('Escribe el motivo del reporte'); return;
    }
    $('reportSave').disabled = true;
    try {
      const r = await fetch('/api/books/' + encodeURIComponent(reportBookId) + '/report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: myName, reason: reportReason, text: $('reportOther').value.trim() }),
      });
      const d = await r.json();
      if (!d.ok) {
        if (d.error === 'duplicate') toast('Ya reportaste este libro');
        else throw 0;
      } else {
        toast(d.count >= REPORT_THRESHOLD
          ? 'Reporte enviado. Este libro ya tiene ' + d.count + ' reportes.'
          : 'Reporte enviado. Gracias por cuidar la comunidad.');
        refreshBookReports(reportBookId, d.count);
      }
      $('reportPop').classList.add('hidden');
    } catch (e) { toast('No se pudo enviar el reporte — revisa tu conexión'); }
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
  const mine = book && book.author === myName && myName && myName !== 'Lector';
  if (!mine) { el.classList.add('hidden'); el.innerHTML = ''; return; }
  el.classList.remove('hidden');
  el.innerHTML = '<span class="cs-title">📊 Tu libro</span><span class="cs-loading">Cargando…</span>';
  try {
    const r = await fetch('/api/books/' + encodeURIComponent(book.id) + '/stats', { cache: 'no-store' });
    const d = await r.json();
    if (!d.ok || !d.stats) throw 0;
    const s = d.stats;
    el.innerHTML = `<span class="cs-title">📊 Tu libro</span>` +
      `<span class="cs-num">🎨 <b>${s.marks}</b> marcas</span>` +
      `<span class="cs-num">💬 <b>${s.notes}</b> notas</span>` +
      `<span class="cs-num">⭐ <b>${s.avg || '—'}</b> (${s.reviews})</span>`;
  } catch (e) {
    el.innerHTML = '<span class="cs-title">📊 Tu libro</span><span class="cs-loading">Sin conexión</span>';
  }
}
function visibleBooks(list) {
  const q = libQuery.trim().toLowerCase();
  let l = q
    ? list.filter((b) => (b.title + ' ' + b.author).toLowerCase().includes(q))
    : [...list];
  if (libPill === 'gratis') l = l.filter((b) => b.price === 0);
  else if (libPill === 'destacados') l = l.filter((b) => b.featured);
  else if (libPill === 'nuevos') l = l.filter(isNewBook);
  else if (libPill === 'populares') l = l.filter((b) => popularity(b) > 0);
  l.sort((a, b) => popularity(b) - popularity(a) || b.createdAt - a.createdAt);
  return l;
}
/* Tarjeta de portada para filas horizontales (estilo Tubi) */
function coverTile(b, opts) {
  opts = opts || {};
  const t = document.createElement('div');
  t.className = 'tile';
  const owned = b.price === 0 || isOwned(b.id);
  const mine = b.author === displayName() && myName !== 'Lector';
  const vBadge = b.verifiedAuthor ? '<span class="vbadge" title="Creador verificado">✔️</span>' : '';
  const classicBadge = b.classic ? '<div class="classic-badge">📜 Dominio público</div>' : '';
  const ageBadge = b.ageRating && b.ageRating !== 'all'
    ? `<div class="age-badge">${b.ageRating === '18' ? '🔞 +18' : '🔞 +13'}</div>` : '';
  const pendBadge = b.status === 'pending' ? '<div class="feat-badge" style="background:#b45309">⏳ En revisión</div>' : '';
  const cover = b.coverUrl
    ? `<img src="${esc(b.coverUrl)}" alt="Portada de ${esc(b.title)}" loading="lazy">`
    : `<div style="position:absolute;inset:0;${coverStyle(b.id)}"></div>`;
  t.innerHTML =
    `<div class="tile-cover">${cover}` +
    (opts.badge ? `<div class="feat-badge">${opts.badge}</div>` : '') +
    pendBadge + classicBadge + ageBadge +
    (getProgress(b.id) > 120 ? `<div class="prog-badge">📖 Continuar</div>` : '') +
    reportBadge(b) +
    (b.coverUrl ? '' : `<div class="cover-title">${esc(b.title)}</div><div class="cover-author creator-link" data-creator="${esc(b.author)}">${esc(b.author)}</div>`) +
    `</div>` +
    `<div class="tile-title">${esc(b.title)} ${vBadge}</div>` +
    `<div class="tile-sub">${b.price === 0 ? 'Gratis' : owned ? 'Adquirido' : fmtPrice(b.price)} · 🎨 ${b.marks || 0} · ${ratingHtml(b)}` +
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
        <b>${esc(meta.title || 'Libro')}</b>
        <i>${esc(meta.author || '')}</i>
        <span class="continue-cta">Seguir leyendo →</span>
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
    libQuery ? 'Sin resultados para tu búsqueda. Prueba con otro título.' : 'Aún no hay libros aquí — ¡publica el primero con ＋ Publicar libro!');
  // 📜 Clásicos gratis: dominio público, sin creador
  const cls = libBooksCache.filter((b) => b.classic);
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
    sub: paid ? `⏳ ${a.daysLeft} día${a.daysLeft === 1 ? '' : 's'} en portada` : 'Lo más famoso y más vendido para tu momento de lectura.',
    cta: mine ? '🔄 Renovar anuncio' : (paid ? 'Comprar' : 'Anunciar aquí'),
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
    visual: `<img src="img/best-offer-logo.jpg" alt="Best Offer">`,
    badge: '⭐ Comunidad',
    title: 'Best Offer',
    sub: 'Compra y vende con más de 8,400 miembros. El grupo de nuestra comunidad.',
    cta: 'Abrir grupo',
    tag: 'COMUNIDAD',
    onCta: () => { window.open(BEST_OFFER_URL, '_blank', 'noopener'); },
  });
}
/* Libro destacado en inmersiva: portada grande, título, autor, precio, Leer */
function showImmersiveBook(b) {
  const owned = b.price === 0 || isOwned(b.id);
  const visual = b.coverUrl
    ? `<img src="${esc(b.coverUrl)}" alt="Portada de ${esc(b.title)}">`
    : `<div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:flex-end;padding:22px;${coverStyle(b.id)}"><div class="cover-title" style="font-size:24px">${esc(b.title)}</div><div class="cover-author">${esc(b.author)}</div></div>`;
  openImmersive({
    visual,
    badge: '⭐ Destacado',
    title: b.title,
    sub: `${b.author} · ${b.price === 0 ? 'Gratis' : owned ? 'Adquirido' : fmtPrice(b.price)}`,
    subHtml: `<span class="creator-link" data-creator="${esc(b.author)}">${esc(b.author)}</span> ${levelSpan(b.author)} · ${b.price === 0 ? 'Gratis' : owned ? 'Adquirido' : fmtPrice(b.price)} · <span class="tile-rating" id="immRating">${ratingText(b)}</span>`,
    cta: owned ? 'Leer ahora' : 'Ver libro',
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
    rb.title = 'Reportar este libro';
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
    sb.title = 'Compartir este libro';
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
  const owned = b.price === 0 || isOwned(b.id);
  const bgDiv = b.coverUrl
    ? `<div class="hero-bg" style="background-image:url('${esc(b.coverUrl)}')"></div>`
    : '';
  const bg = b.coverUrl ? '' : coverStyle(b.id);
  const tags = `<div class="hero-tags"><span class="hero-tag">⭐ DESTACADO</span>` +
    (isNewBook(b) ? `<span class="hero-tag">🆕 NUEVO</span>` : '') + `</div>`;
  const meta = `<span class="creator-link" data-creator="${esc(b.author)}">${esc(b.author)}</span> ${levelSpan(b.author)} · 🎨 ${b.marks || 0} · 💬 ${b.notes || 0} · ` +
    (b.price === 0 ? 'Gratis' : owned ? 'Adquirido' : fmtPrice(b.price));
  const desc = (b.marks || b.notes)
    ? `La comunidad ya dejó ${b.marks || 0} marcas y ${b.notes || 0} notas en este libro.`
    : `Sé de los primeros en leerlo y marcarlo con tu tinta.`;
  return `<div class="hero-slide" style="${bg}">
    ${bgDiv}
    <div class="hero-shade"></div>
    ${tags}
    <div class="hero-title">${esc(b.title)}</div>
    <div class="hero-sub">${meta}</div>
    <div class="hero-desc">${desc}</div>
    <button class="hero-cta-round" data-book="${b.id}">▶ ${owned ? 'Leer ahora' : 'Ver libro'}</button>
  </div>`;
}
function heroSlideAd(a, paid) {
  const hue = paid ? 200 : (a.hue || 210);
  const badgeTxt = paid ? 'Patrocinado' : ((typeof AD_BADGE_LABEL !== 'undefined' && AD_BADGE_LABEL[a.badge]) || a.badge || 'Espacio disponible');
  const bgStyle = a.photoUrl
    ? `background-image:url('${esc(a.photoUrl)}');background-size:cover;background-position:center`
    : `background:linear-gradient(135deg,hsl(${hue},60%,45%),hsl(${(hue + 40) % 360},55%,28%))`;
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
    return `<img src="${esc(b.coverUrl)}" alt="Portada de ${esc(b.title)}" class="cover-img" loading="lazy">`;
  }
  if (small) return `<span>${esc(b.title.slice(0, 2).toUpperCase())}</span>`;
  return `<div class="cover-title">${esc(b.title)}</div><div class="cover-author">${esc(b.author)}</div><div class="cover-imprint">TINTAJUNTA</div>`;
}
function bookRow(b, rank) {
  const row = document.createElement('div');
  row.className = 'book-row';
  const owned = b.price === 0 || isOwned(b.id);
  const mine = b.author === displayName() && myName !== 'Lector';
  const act = popularity(b);
  row.innerHTML =
    `<div class="rank-badge">#${rank}</div>` +
    `<div class="row-cover" style="${b.coverUrl ? '' : coverStyle(b.id)}">${coverInner(b, true)}</div>` +
    `<div class="row-main">` +
      `<div class="row-title">${esc(b.title)}</div>` +
      `<div class="row-meta"><span class="creator-link" data-creator="${esc(b.author)}">${esc(b.author)}</span> ${levelSpan(b.author)} · 🎨 ${b.marks || 0} · 💬 ${b.notes || 0}` +
      (b.price === 0 ? ' · <span class="free">Gratis</span>' : owned ? ' · Adquirido' : ` · ${fmtPrice(b.price)}`) +
      `</div>` +
    `</div>` +
    `<button class="info-btn" data-act="info" title="Ver ficha">i</button>` +
    `<button class="btn row-btn" data-act="open">${owned ? 'Leer' : 'Ver'}</button>` +
    (mine ? `<button class="linklike" data-act="feature" title="Destacar en portada">⭐</button>` : '');
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
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360;
  const v = h % 4;
  const h2 = (h + 45) % 360, h3 = (h + 90) % 360;
  const dots = 'radial-gradient(rgba(255,255,255,.07) 1px, transparent 1.6px) 0 0/13px 13px';
  const g = [
    `linear-gradient(150deg,hsl(${h},48%,42%) 0%,hsl(${h2},52%,26%) 70%,hsl(${h3},45%,18%) 100%)`,
    `radial-gradient(circle at 25% 12%, hsl(${h},55%,54%) 0%, transparent 58%),linear-gradient(160deg,hsl(${h},50%,38%),hsl(${h2},55%,20%))`,
    `linear-gradient(180deg,hsl(${h},45%,50%) 0%,hsl(${h},45%,50%) 32%,hsl(${h2},50%,26%) 32.5%,hsl(${h3},48%,18%) 100%)`,
    `linear-gradient(115deg,hsl(${h2},55%,30%) 0%,hsl(${h},50%,44%) 55%,hsl(${h3},52%,22%) 100%)`,
  ][v];
  return `background:${dots},${g}`;
}
function bookCard(b, isFeat) {
  const card = document.createElement('div');
  card.className = 'book-card' + (isFeat ? ' book-feat' : '');
  const owned = b.price === 0 || isOwned(b.id);
  const mine = b.author === displayName() && myName !== 'Lector';
  // Actividad de la comunidad en este libro (la cuenta la envía el servidor)
  const activity = (b.marks || b.notes)
    ? `<p class="book-activity">🎨 ${b.marks || 0} · 💬 ${b.notes || 0}</p>`
    : '';
  card.innerHTML =
    `<div class="book-cover" style="${b.coverUrl ? '' : coverStyle(b.id)}">` +
    (isFeat ? '<div class="feat-badge">⭐ DESTACADO</div>' : '') +
    coverInner(b, false) + `</div>` +
    `<div class="book-info">` +
    `<div class="book-foot"><span class="book-price ${b.price === 0 ? 'free' : ''}">` +
    (b.price === 0 ? 'Gratis' : owned ? 'Adquirido' : fmtPrice(b.price)) +
    `</span>${activity}</div>` +
    `<button class="btn" data-act="open">${owned ? 'Leer' : 'Ver'}</button>` +
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
  } catch (e) { toast('No se pudo abrir el libro — revisa tu conexión e intenta de nuevo'); return; }
  if (book.price > 0 && !isOwned(book.id)) { showBuy(book); return; }
  // Advertencia de contenido adulto
  if (book.ageRating === '18' && !sessionStorage.getItem('tj_age_ok_' + book.id)) {
    $('ageText').textContent = `"${book.title}" está clasificado +18 (contenido para adultos).`;
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

/* Pagos reales con Stripe (modo TEST). En la versión real aquí va Stripe */
let buyBookPending = null;
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
/* Flujo de pago: crea el PaymentIntent en el servidor, cobra con la tarjeta,
 * devuelve el paymentIntentId verificado. Lanza Error si falla o se cancela. */
function payWithStripe({ type, intentParams, description, amountCents }) {
  return new Promise(async (resolve, reject) => {
    let stripe;
    try { stripe = await getStripeJs(); }
    catch (e) { reject(new Error('stripe-no-disponible')); return; }
    // 1. Crear el PaymentIntent en el servidor
    let intent;
    try {
      const r = await fetch('/api/payments/intent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...intentParams }),
      });
      intent = await r.json();
      if (!intent.ok || !intent.clientSecret) throw new Error(intent.error || 'intent-failed');
    } catch (e) { reject(e); return; }
    // 2. Mostrar el modal de tarjeta
    $('payDesc').textContent = description;
    $('payAmount').textContent = fmtPrice(intent.amount != null ? intent.amount : amountCents);
    $('payPop').classList.remove('hidden');
    const elements = stripe.elements();
    if (stripeCard) { try { stripeCard.unmount(); } catch (e) {} }
    stripeCard = elements.create('card', { style: { base: { fontSize: '16px' } } });
    stripeCard.mount('#payCard');
    const done = (ok, val) => {
      $('payPop').classList.add('hidden');
      try { stripeCard.unmount(); } catch (e) {}
      stripeCard = null;
      ok ? resolve(val) : reject(val instanceof Error ? val : new Error(String(val || 'cancelado')));
    };
    $('payCancel').onclick = () => done(false, 'cancelado');
    $('payConfirm').onclick = async () => {
      $('payConfirm').disabled = true;
      $('payConfirm').textContent = 'Procesando…';
      try {
        const cr = await stripe.confirmCardPayment(intent.clientSecret, {
          payment_method: { card: stripeCard },
        });
        if (cr.error) throw new Error(cr.error.message || 'pago-rechazado');
        done(true, intent.paymentIntentId);
      } catch (e) { done(false, e); }
      $('payConfirm').disabled = false;
      $('payConfirm').textContent = 'Pagar';
    };
  });
}
/* Modal para destacar un libro propio en portada */
async function showFeature(b) {
  syncNameFromLib();
  featurePending = b;
  featurePlan = 'week';
  $('featureBookTitle').textContent = b.title;
  // precios del servidor
  let prices = { day: 499, week: 2499 };
  try {
    const r = await fetch('/api/feature-prices');
    const d = await r.json();
    if (d.ok && d.prices) prices = d.prices;
  } catch (e) { /* usar valores por defecto */ }
  const plans = $('featurePlans');
  plans.innerHTML = '';
  [['day', 'Por día', prices.day], ['week', 'Por semana', prices.week], ['month', 'Por mes', prices.month]].forEach(([key, label, cents]) => {
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
function showBuy(book) {
  buyBookPending = book;
  $('buyTitle').textContent = book.title;
  $('buyAuthor').innerHTML = `<span class="creator-link" data-creator="${esc(book.author)}">${esc(book.author)}</span>`;
  $('buyPrice').textContent = fmtPrice(book.price);
  $('buyConfirm').textContent = 'Comprar por ' + fmtPrice(book.price);
  $('buyPop').classList.remove('hidden');
}
/* v71 — 📖 Muestra gratis: primeros 3 párrafos en solo lectura (patrón "Look Inside").
 * El lector prueba la escritura antes de comprar; al final, CTA a comprar. */
function showSample(book) {
  const ch = (book.chapters && book.chapters[0]) || {};
  const paras = (ch.paragraphs || []).slice(0, 3);
  $('sampleBookLine').textContent = book.title + ' — ' + book.author;
  $('sampleText').innerHTML = paras.length
    ? paras.map(p => `<p>${esc(p)}</p>`).join('')
    : '<p><i>El creador aún no agregó texto de muestra.</i></p>';
  $('samplePop').classList.remove('hidden');
  $('samplePop').scrollTop = 0;
}
/* v71 — 📤 Compartir libro: Web Share API con respaldo a portapapeles.
 * El link lleva ?libro=ID para abrir el libro directo al entrar. */
async function shareBook(book) {
  if (!book) return;
  const url = location.origin + '/?libro=' + encodeURIComponent(book.id);
  const text = `📚 "${book.title}" de ${book.author} — léelo conmigo en TintaJunta`;
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
      toast('📋 Link copiado — pégalo donde quieras');
    } catch (ce) {
      prompt('Copia el link:', url);
    }
  }
}
/* v71 — 🎉 Post-compra: celebra e invita a leer JUNTOS (el diferenciador).
 * Convierte la compra en una sala en vivo o en invitar amigos. */
let boughtBookPending = null;
function showBought(book) {
  boughtBookPending = book;
  $('boughtBookLine').textContent = book.title + ' — ' + book.author;
  $('boughtPop').classList.remove('hidden');
}
function initLibrary() {
  buildSwatchesInto($('libSwatches'));
  $('libNameInput').value = myName === 'Lector' ? '' : myName;
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
      toast(isTeacher ? '🎓 Modo profesor: tinta negra' : 'Modo estudiante');
    };
  }
  $('liveRoomBtn').onclick = goLiveRoom;
  $('backBtn').onclick = () => { goBack(); };
  $('publishBtn').onclick = () => {
    syncNameFromLib();
    $('pubTitle').value = '';
    $('pubPrice').value = '';
    $('pubText').value = '';
    $('pubCover').value = '';
    $('publishPop').classList.remove('hidden');
  };
  $('pubCancel').onclick = () => $('publishPop').classList.add('hidden');
  $('pubSave').onclick = async () => {
    const title = $('pubTitle').value.trim();
    const price = Math.round((parseFloat($('pubPrice').value) || 0) * 100);
    const text = $('pubText').value.trim();
    const ageRating = ($('pubAge') && $('pubAge').value) || 'all';
    if (!title || !text) { toast('Ponle título y texto a tu libro'); return; }
    if (price > 0 && price < 199) { toast('El precio mínimo es $1.99, o publícalo gratis'); return; }
    // validar portada en el cliente (obligatoria, tipo y 2MB)
    const coverFile = $('pubCover').files[0] || null;
    if (!coverFile) { toast('La portada es obligatoria — súbela para publicar'); return; }
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
        else if (d.error === 'too-long') { toast('⚠️ Máximo 500 páginas por libro — acorta el texto'); }
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
  $('buyCancel').onclick = () => { $('buyPop').classList.add('hidden'); buyBookPending = null; };
  // v71 — muestra gratis, compartir y post-compra
  $('buySample').onclick = () => { if (buyBookPending) { $('buyPop').classList.add('hidden'); showSample(buyBookPending); } };
  $('buyShare').onclick = () => { if (buyBookPending) shareBook(buyBookPending); };
  $('sampleClose').onclick = () => $('samplePop').classList.add('hidden');
  $('sampleBuy').onclick = () => { $('samplePop').classList.add('hidden'); if (buyBookPending) showBuy(buyBookPending); };
  $('boughtShare').onclick = () => { if (boughtBookPending) shareBook(boughtBookPending); };
  $('boughtRead').onclick = () => { const b = boughtBookPending; boughtBookPending = null; $('boughtPop').classList.add('hidden'); if (b) bootBook(b); };
  $('boughtRoom').onclick = () => {
    const b = boughtBookPending; boughtBookPending = null;
    $('boughtPop').classList.add('hidden');
    if (b) { bootBook(b); toast('🔴 Toca "Sala en vivo" para leer juntos en tiempo real'); }
    else goLiveRoom();
  };
  /* Destacar libro en portada (anuncio pagado del creador) */
  $('featureCancel').onclick = () => { $('featurePop').classList.add('hidden'); featurePending = null; };
  $('featureConfirm').onclick = async () => {
    if (!featurePending || !featurePlan) return;
    const b = featurePending, plan = featurePlan;
    $('featureConfirm').disabled = true;
    try {
      // 1. Cobrar con Stripe
      const pid = await payWithStripe({
        type: 'feature', intentParams: { bookId: b.id, plan, author: myName },
        description: `Destacar "${b.title}"`, amountCents: null,
      });
      // 2. Activar el destacado (el servidor verifica el pago con Stripe)
      const r = await fetch('/api/books/' + encodeURIComponent(b.id) + '/feature', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, author: myName, paymentIntentId: pid }),
      });
      const d = await r.json();
      if (!d.ok) throw 0;
      $('featurePop').classList.add('hidden');
      toast('⭐ ¡Tu libro está destacado en portada!');
      featurePending = null;
      showLibrary(false);
    } catch (e) {
      if (String((e && e.message) || e) !== 'cancelado') toast('No se pudo completar el pago');
    }
    $('featureConfirm').disabled = false;
  };
  $('buyConfirm').onclick = async () => {
    if (!buyBookPending) return;
    const b = buyBookPending;
    // Libro gratis: sin pago
    if (!b.price) {
      markOwned(b.id);
      buyBookPending = null;
      $('buyPop').classList.add('hidden');
      toast('¡Libro adquirido!');
      showLibrary(false);
      bootBook(b);
      return;
    }
    $('buyConfirm').disabled = true;
    $('buyConfirm').textContent = 'Procesando…';
    try {
      // 1. Cobrar con Stripe
      const pid = await payWithStripe({
        type: 'buy', intentParams: { bookId: b.id },
        description: `Comprar "${b.title}"`, amountCents: b.price,
      });
      // 2. Registrar la compra (el servidor verifica el pago con Stripe)
      const r = await fetch('/api/books/' + encodeURIComponent(b.id) + '/buy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId: pid }),
      });
      const d = await r.json().catch(() => ({}));
      if (!d.ok) throw new Error(d.error || 'buy-failed');
      markOwned(b.id);
      buyBookPending = null;
      $('buyPop').classList.add('hidden');
      showLibrary(false);
      showBought(b); // v71: celebra e invita a leer juntos en vivo
    } catch (e) {
      if (String(e.message || e) !== 'cancelado') toast('No se pudo completar el pago');
    }
    $('buyConfirm').disabled = false;
    $('buyConfirm').textContent = 'Comprar por ' + fmtPrice(b.price);
  };
  // arranque: la biblioteca es el estado inicial del historial (no se pushea)
  try { history.replaceState({ tjview: 'library' }, ''); } catch (e) {}
  currentView = 'library';
  showLibrary(false);
}

/* ---------- Login con Google ---------- */
let tjUser = null, tjGoogleEnabled = false;
function googleLogin() { location.href = '/api/auth/google'; }
function googleLogout() {
  fetch('/api/auth/logout', { method: 'POST' }).then(() => location.reload());
}
async function checkAuth() {
  try {
    const r = await fetch('/api/auth/me');
    const d = await r.json();
    tjUser = d.user || null;
    tjGoogleEnabled = !!d.googleEnabled;
    const btn = document.querySelector('#drawer button[data-go="google-login"]');
    if (btn) {
      btn.onclick = () => {
        closeDrawer();
        if (tjUser) { if (confirm('¿Cerrar sesión de ' + (tjUser.name || tjUser.email) + '?')) googleLogout(); }
        else googleLogin();
      };
      if (tjUser) {
        btn.innerHTML = '👤 ' + esc(tjUser.name || tjUser.email || 'Mi cuenta');
      } else if (tjGoogleEnabled) {
        btn.innerHTML = '🔐 Entrar con Google';
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
/* Si el servidor pide login (401), redirige a Google */
function needLogin(res) {
  if (res && res.status === 401) { googleLogin(); return true; }
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
  }
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
  $('nameInput').value = myName === 'Lector' ? '' : myName;
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
  if (tb) tb.textContent = (localStorage.getItem('tj_theme') === 'dark' ? '☀️' : '🌙') + ' Tema';
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
    if (!list.length) { box.innerHTML = '<p class="join-sub">Aún no tienes escritos.</p>'; return; }
    box.innerHTML = '';
    list.forEach((w, i) => {
      const row = document.createElement('div');
      row.className = 'book-row wr-item';
      row.innerHTML =
        `<div class="rank-badge">#${i + 1}</div>` +
        `<div class="row-main"><div class="row-title">✍️ ${esc(w.title)}</div>` +
        `<div class="row-meta">${esc(w.author)} · ${esc(w.preview)}${w.preview.length >= 140 ? '…' : ''}</div></div>` +
        `<button class="btn row-btn">Leer</button>`;
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
[['initJoin', initJoin], ['initLibrary', initLibrary], ['initAds', initAds],
 ['renderAds', renderAds], ['renderAffiliates', renderAffiliates],
 ['renderEvents', renderEvents],
 ['initImdbBar', initImdbBar], ['initWriting', initWriting],
 ['initPills', initPills], ['initMarquee', initMarquee],
 ['initBoard', initBoard], ['initFollow', initFollow], ['initWelcome', initWelcome],
 ['initReviews', initReviews], ['initProgress', initProgress], ['initReports', initReports],
 ['initTypo', initTypo], ['initReadProgress', initReadProgress],
 ['initChat', initChat], ['initReactions', initReactions], ['initHands', initHands],
 ['initSwitchBook', initSwitchBook], ['checkAuth', checkAuth],
 ['initDeepLink', initDeepLink]].forEach(([name, fn]) => {
  try {
    const r = fn();
    if (r && r.catch) r.catch((e) => clog('INIT-FAIL ' + name + ': ' + (e && e.message)));
  } catch (e) { clog('INIT-FAIL ' + name + ': ' + (e && e.message)); }
});
