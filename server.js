'use strict';
/* ============================================================================
 * TintaJunta — prototipo de la sala de lectura en vivo (servidor)
 *
 * Múltiples salas identificadas por código ("SALA" es la principal). Los
 * visitantes entran con un nombre, un color de tinta y un código de sala,
 * subrayan pasajes y dejan notas al margen. La comunicación es HTTP puro
 * (sin WebSockets): el cliente publica sus marcas con POST y sondea el
 * estado de la sala cada pocos segundos. Todo se guarda en data/rooms.json.
 *
 * Biblioteca: los creadores publican libros originales (POST /api/books);
 * cada libro tiene su propio espacio de marcas (el ID del libro es su
 * código de sala). Pagos simulados (Stripe va en la versión real).
 * Ver README.md.
 * ========================================================================== */

const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const session = require('express-session');
const authGoogle = require('./server/auth-google');

const PORT = process.env.PORT || 8787;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'room.json');   // formato antiguo (una sala)
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json'); // formato actual (salas por código)

/* Colores de tinta clásicos permitidos */
const COLORS = {
  azul:    '#1e40af',
  rojo:    '#b91c1c',
  verde:   '#166534',
  ambar:   '#b45309',
  violeta: '#6d28d9',
  negro:   '#111827',
};
const DEFAULT_COLOR = 'azul';
/* Precio mínimo de un libro de pago (en centavos). $0 = gratis. */
const MIN_BOOK_PRICE = 199;
const MAX_RANGE = 500;     // palabras máximas por subrayado / nota
const MAX_NOTE_LEN = 140;  // caracteres máximos por nota corta

/* Códigos cortos de nota (ej: N-7X2): alfabeto sin ambigüedades (sin 0/O, 1/I/L) */
const NOTE_CODE_ALPHA = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
function genNoteCode(used) {
  for (let t = 0; t < 50; t++) {
    let c = 'N-';
    for (let i = 0; i < 3; i++) c += NOTE_CODE_ALPHA[Math.floor(Math.random() * NOTE_CODE_ALPHA.length)];
    if (!used.has(c)) { used.add(c); return c; }
  }
  return 'N-' + Date.now().toString(36).toUpperCase().slice(-4); // respaldo
}
/* Migra notas viejas sin código: les asigna uno único por sala */
function ensureNoteCodes(st) {
  const used = new Set(st.notes.map((n) => n.code).filter(Boolean));
  let changed = false;
  for (const n of st.notes) {
    if (!n.code) { n.code = genNoteCode(used); changed = true; }
  }
  return changed;
}

/* ------------------------------ salas ---------------------------------- */
/* Texto de muestra ORIGINAL del prototipo (no es de ningún libro).
 * Sirve para probar la sala en vivo sin abrir un libro. */
const CHAPTER_TITLE = 'Texto de muestra';
const BOOK_LINE = 'Muestra del prototipo — abre un libro para leer de verdad';
const SAMPLE_NOTE = 'Este es un texto de muestra original, solo para probar las marcas. Abre un libro de la biblioteca para leer de verdad.';
const PARAGRAPHS = [
  'Esto es un texto de muestra. Sirve para probar cómo se marca, cómo se deja una nota al margen y cómo se ve la tinta de los demás.',
  'Activa el lápiz ✏️ y arrastra sobre las palabras para marcarlas con tu color. Toca una marca tuya para borrarla.',
  'En el margen puedes dejar ideas que todos verán. El profesor escribe con tinta negra y su nombre lleva 🎓.',
  'Cuando quieras leer de verdad, vuelve a la biblioteca y abre un libro: de un creador o un clásico gratis. Todo lo que marques allí también se comparte en vivo.',
];

/* Índice global de palabras: WORDS[i] = { t: 'palabra', p: nº de párrafo } */
const WORDS = [];
PARAGRAPHS.forEach((text, p) => {
  text.split(/\s+/).forEach((t) => { if (t.length) WORDS.push({ t, p }); });
});

const MAIN_ROOM = 'SALA';
const rooms = new Map(); // código -> { seq, highlights, notes }

/* Normaliza un código de sala: mayúsculas, solo alfanumérico, 4-12 caracteres.
 * Vacío => sala principal. Devuelve null si el código es inválido. */
function normalizeRoom(raw) {
  const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  if (!code) return MAIN_ROOM;
  if (code.length < 4) return null;
  return code;
}
/* Código aleatorio de 6 letras (sin I/O para evitar confusiones) */
function genRoomCode() {
  const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do {
    code = '';
    for (let i = 0; i < 6; i++) code += ABC[Math.floor(Math.random() * ABC.length)];
  } while (rooms.has(code));
  return code;
}
function getRoom(code) {
  if (!rooms.has(code)) rooms.set(code, { seq: 1, highlights: [], notes: [], board: [], // v85: lista de entradas [{text,name,color,ts}] — todos escriben
    follow: { active: false, pos: 0, ts: 0, name: '' },
    para: { idx: 0, ts: 0 }, // v81: párrafo de clase (lo controla el profesor)
    teacher: null, // v83: { name } — el profesor verificado de la sala (anti-suplantación)
    chat: [], reactions: [], hands: [], switchTo: null });
  const st = rooms.get(code);
  if (ensureNoteCodes(st)) save();
  return st;
}
/* v83: verifica que el usuario sea el profesor registrado de la sala.
   El color negro por sí solo NO basta — cualquiera podría enviarlo por API. */
function isRoomTeacher(code, name) {
  const st = rooms.get(code);
  return !!(st && st.teacher && st.teacher.name && st.teacher.name === name);
}
/* v83: registra al profesor si la sala no tiene uno; rechaza suplantadores */
function claimTeacher(code, name, color) {
  const st = getRoom(code);
  if (color !== 'negro') return color; // no reclama ser profesor
  if (!st.teacher) { st.teacher = { name, ts: Date.now() }; save(); return 'negro'; }
  if (st.teacher.name === name) return 'negro'; // es el profesor registrado
  return 'azul'; // suplantador: se le asigna color por defecto
}
/* Las manos levantadas expiran solas tras 2 minutos */
const HAND_MS = 2 * 60 * 1000;
function pruneHands(st) {
  if (!Array.isArray(st.hands)) st.hands = [];
  const before = st.hands.length;
  st.hands = st.hands.filter((h) => h && (Date.now() - (Number(h.ts) || 0)) < HAND_MS);
  return st.hands.length !== before;
}

/* ------------------------------ persistencia ---------------------------- */
function loadRooms() {
  try {
    const raw = fs.readFileSync(ROOMS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      for (const [code, st] of Object.entries(parsed)) {
        if (/^[A-Z0-9]{4,12}$/.test(code) && st && Array.isArray(st.highlights) && Array.isArray(st.notes)) {
          const seq = Math.floor(Number(st.seq));
          const braw = st.board;
          // v85: migra formato antiguo {text,name,ts} a lista de entradas
          const barr = Array.isArray(braw) ? braw
            : (braw && braw.text ? [{ text: String(braw.text).slice(0, 500), name: String(braw.name || ''), color: 'negro', ts: Number(braw.ts) || 0 }] : []);
          const f = st.follow && typeof st.follow === 'object' ? st.follow : {};
          const pa = st.para && typeof st.para === 'object' ? st.para : {};
          rooms.set(code, { seq: seq > 0 ? seq : 1, highlights: st.highlights, notes: st.notes,
            board: barr.filter((e) => e && e.text).slice(-20),
            follow: { active: !!f.active, pos: Math.min(1, Math.max(0, Number(f.pos) || 0)), ts: Number(f.ts) || 0, name: String(f.name || '') },
            para: { idx: Math.max(0, Math.floor(Number(pa.idx) || 0)), ts: Number(pa.ts) || 0 },
            chat: Array.isArray(st.chat) ? st.chat.slice(-50) : [],
            reactions: Array.isArray(st.reactions) ? st.reactions : [],
            hands: Array.isArray(st.hands) ? st.hands : [] });
          if (ensureNoteCodes(rooms.get(code))) save();
        }
      }
      console.log(`[tintajunta] salas recuperadas: ${rooms.size}`);
      return;
    }
  } catch { /* sin archivo de salas: intentar migración */ }
  // Migración: la antigua sala única (data/room.json) pasa a ser la sala "SALA"
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.highlights) && Array.isArray(parsed.notes)) {
      const seq = Math.floor(Number(parsed.seq));
      rooms.set(MAIN_ROOM, {
        seq: seq > 0 ? seq : 1, highlights: parsed.highlights, notes: parsed.notes,
        board: [], // v85: lista de entradas — todos escriben
        follow: { active: false, pos: 0, ts: 0, name: '' },
        para: { idx: 0, ts: 0 },
        chat: [], reactions: [], hands: [],
      });
      console.log(`[tintajunta] migrada la sala única a código "${MAIN_ROOM}": ${parsed.highlights.length} subrayados, ${parsed.notes.length} notas`);
      return;
    }
  } catch { /* nada que migrar */ }
  console.log('[tintajunta] sin estado previo: empezando de cero');
}
loadRooms();

/* ------------------------------ libros ---------------------------------- */
/* Cada libro tiene su propio espacio de marcas: el id del libro ES el código
 * de sala donde se guardan sus subrayados y notas. Así leer un libro es igual
 * que estar en una sala, pero con el texto del libro. */
const BOOKS_FILE = path.join(DATA_DIR, 'books.json');
const books = new Map(); // id -> { id, title, author, price, chapters, createdAt }

function genBookId() {
  const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let id;
  do {
    id = '';
    for (let i = 0; i < 6; i++) id += ABC[Math.floor(Math.random() * ABC.length)];
  } while (books.has(id) || rooms.has(id));
  return id;
}
function loadBooks() {
  try {
    const raw = fs.readFileSync(BOOKS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const b of parsed) {
        if (b && b.id && b.title && Array.isArray(b.chapters) && b.chapters.length) {
          if (typeof b.sales !== 'number') b.sales = 0; // migración: ventas
          books.set(b.id, b);
        }
      }
      console.log(`[tintajunta] libros cargados: ${books.size}`);
      return;
    }
  } catch { /* sin archivo: sembrar ejemplos */ }
  seedBooks();
}
function saveBooks() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(BOOKS_FILE, JSON.stringify([...books.values()]));
  } catch (e) { console.error('[tintajunta] error guardando libros:', e.message); }
}
function seedBooks() {
  // Solo libros de muestra ORIGINALES. Nada de obras comerciales ni de
  // dominio público ajenas: TintaJunta solo publica libros originales
  // de sus creadores.
  const oid = genBookId();
  books.set(oid, {
    id: oid, title: 'La tinta compartida', author: 'TintaJunta',
    price: 299, createdAt: Date.now(), status: 'approved', ageRating: 'all',
    chapters: [{ title: 'Manifiesto', paragraphs: [
      'Hay libros que se leen a solas, en silencio, con la lámpara encendida hasta tarde. Y hay libros que piden compañía: una frase que te obliga a levantar la vista y decir "mira esto".',
      'Este es un libro de los segundos. Cada vez que un pasaje te mueva algo, márcalo con tu tinta. Tu color quedará junto al de quienes pasaron antes, y junto al de quienes vendrán después.',
      'Al margen puedes dejar una idea, una pregunta, una risa. El margen es la plaza del pueblo: todos pasan, todos leen, todos dejan algo.',
      'Nadie puede borrar lo que otro marcó. Tu tinta es tuya. Pero todos pueden verla, porque leer juntos es eso: pensar en voz alta, con colores.',
      'Bienvenido a la sala. Elige tu tinta y empieza.',
    ] }],
  });
  const fid = genBookId();
  books.set(fid, {
    id: fid, title: 'El faro de las palabras', author: 'TintaJunta',
    price: 0, createdAt: Date.now(), status: 'approved', ageRating: 'all',
    chapters: [{ title: 'Capítulo 1 — La torre', paragraphs: [
      'En lo alto del acantilado había un faro que nadie encendía desde hacía años. Su guardián, un hombre callado llamado Tomás, no cuidaba la luz: cuidaba las palabras.',
      'Cada noche subía los ciento doce escalones con un cuaderno bajo el brazo y escribía lo que el mar le dictaba. Decía que las olas hablaban en frases cortas, como si no quisieran cansarse.',
      'Una tarde de octubre llegó una niña con una pregunta que Tomás no supo responder: "¿Para qué sirven las palabras que nadie lee?" El guardián la miró largo rato y después le entregó el cuaderno.',
      'La niña leyó en voz alta hasta que se puso el sol. Cuando terminó, el faro —sin que nadie lo tocara— encendió su luz por primera vez en veinte años.',
      'Tomás sonrió. Había entendido al fin: las palabras guardadas son faros apagados. Solo se encienden cuando alguien las lee.',
    ] }],
  });
  const cid = genBookId();
  books.set(cid, {
    id: cid, title: 'Cartas a un lector', author: 'TintaJunta',
    price: 0, createdAt: Date.now(), status: 'approved', ageRating: 'all',
    chapters: [{ title: 'Primera carta', paragraphs: [
      'Querido lector: te escribo esta carta sin saber tu nombre, porque los libros también son cartas que tardan años en llegar.',
      'Quiero contarte algo que descubrí tarde: leer no es pasar los ojos por las palabras. Leer es detenerse. Es volver atrás. Es discutir con el autor en el margen, aunque él ya no pueda responderte.',
      'Por eso me gusta la idea de leer acompañado. Cuando marcas una frase, le estás diciendo a un desconocido: "esto me pasó a mí también". Y ese desconocido, en algún lugar, siente que no está solo.',
      'Así que toma tu color y marca sin miedo. El libro aguanta. Las ideas crecen cuando se comparten.',
      'Nos vemos en el margen.',
    ] }],
  });
  saveBooks();
  console.log(`[tintajunta] libros de ejemplo sembrados: ${books.size}`);
}
loadBooks();

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(ROOMS_FILE, JSON.stringify(Object.fromEntries(rooms)));
    } catch (e) {
      console.error('[tintajunta] error guardando salas:', e.message);
    }
  }, 250);
}

/* --------------------------------- servidor ----------------------------- */
const app = express();
/* Webhook de Stripe: necesita el cuerpo CRUDO para verificar la firma.
 * Se registra ANTES de express.json(). */
const stripePay = require('./server/stripe-payments');
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), (req, res) => {
  const v = stripePay.verifyWebhook(req);
  if (!v.ok) return res.status(400).json({ ok: false, error: v.error });
  const event = v.event;
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    const done = completeStripePayment(pi.id, pi.metadata || {});
    console.log('[tintajunta] webhook pago', pi.id, done ? 'completado' : 'sin acción pendiente');
  }
  res.json({ ok: true, received: true });
});
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '256kb' }));
/* Sesiones (login con Google). La sesión identifica al usuario por req.session.user */
app.set('trust proxy', 1);
app.use(session({
  secret: process.env.SESSION_SECRET || 'tintajunta-dev-secret-cambiar-en-prod',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: 'auto', httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 },
}));
const requireLogin = authGoogle.requireLogin();
/* ---------- Login con Google ---------- */
app.get('/api/auth/google', (req, res) => {
  if (!authGoogle.isConfigured()) return res.status(503).json({ ok: false, error: 'google-auth-no-configurado' });
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;
  res.redirect(authGoogle.getAuthUrl(state));
});
app.get('/api/auth/google/callback', async (req, res) => {
  try {
    if (!req.query.state || req.query.state !== req.session.oauthState)
      return res.status(403).send('state inválido (CSRF)');
    delete req.session.oauthState;
    const { profile } = await authGoogle.handleCallback(req.query.code);
    upsertUser(profile);
    req.session.user = { sub: profile.sub, email: profile.email, name: profile.name, picture: profile.picture };
    res.redirect('/?login=ok');
  } catch (e) {
    console.error('[tintajunta] error login Google:', e.message);
    res.redirect('/?login=error');
  }
});
app.get('/api/auth/me', (req, res) => {
  res.json({ ok: true, user: (req.session && req.session.user) || null, googleEnabled: authGoogle.isConfigured() });
});
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});
/* Usuarios registrados (por sub de Google). Persistidos en data/users.json */
const USERS_FILE = path.join(DATA_DIR, 'users.json');
function loadUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch (e) { return {}; }
}
function upsertUser(profile) {
  const users = loadUsers();
  const u = users[profile.sub] || { sub: profile.sub, createdAt: Date.now() };
  u.email = profile.email; u.name = profile.name; u.picture = profile.picture;
  u.lastLogin = Date.now();
  users[profile.sub] = u;
  try { fs.writeFileSync(USERS_FILE, JSON.stringify(users)); } catch (e) {}
  return u;
}
/* Clave pública de Stripe para el cliente (la secreta jamás sale del servidor) */
app.get('/api/stripe-key', (req, res) => {
  res.json({ ok: true, enabled: stripePay.isEnabled(), publishableKey: stripePay.publishableKey || null });
});
/* Versión del código desplegado: para verificar QUÉ versión está viva sin adivinar.
 * Railway inyecta RAILWAY_GIT_COMMIT_SHA / RAILWAY_GIT_BRANCH en cada deploy. */
const APP_VERSION = (() => {
  try { return require('./package.json').version || '0.0.0'; } catch (e) { return '0.0.0'; }
})();
const BOOT_TIME = new Date().toISOString();
app.get('/api/version', (req, res) => {
  res.json({
    ok: true,
    version: APP_VERSION,
    commit: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'local',
    branch: process.env.RAILWAY_GIT_BRANCH || 'master',
    environment: process.env.RAILWAY_ENVIRONMENT || 'development',
    startedAt: BOOT_TIME,
    node: process.version,
    stripe: { enabled: stripePay.isEnabled() },
    googleAuth: { configured: authGoogle.isConfigured() },
  });
});
/* Crea un PaymentIntent para una acción de pago. El cliente confirma con Stripe.js
 * y luego llama al endpoint original con { paymentIntentId } para finalizar. */
const pendingStripe = new Map(); // paymentIntentId -> { type, data, amount, ts }
app.post('/api/payments/intent', async (req, res) => {
  if (!stripePay.isEnabled()) return res.status(503).json({ ok: false, error: 'stripe-disabled' });
  try {
    const body = req.body || {};
    const type = String(body.type || '');
    let amount = 0, description = '', data = {};
    if (type === 'buy') {
      const b = books.get(String(body.bookId || '').toUpperCase());
      if (!b) return res.status(404).json({ ok: false, error: 'not-found' });
      amount = b.price; description = `Compra "${b.title}"`;
      data = { type, bookId: b.id };
    } else if (type === 'feature') {
      const b = books.get(String(body.bookId || '').toUpperCase());
      if (!b) return res.status(404).json({ ok: false, error: 'not-found' });
      const plan = String(body.plan || '');
      if (!FEATURE_PRICES[plan]) return res.status(400).json({ ok: false, error: 'bad-plan' });
      const author = cleanName(body.author);
      if (b.author !== author) return res.status(403).json({ ok: false, error: 'not-owner' });
      amount = FEATURE_PRICES[plan]; description = `Destacar "${b.title}" (${plan})`;
      data = { type, bookId: b.id, plan, author };
    } else if (type === 'ad') {
      const plan = String(body.plan || '');
      if (!AD_PRICES[plan]) return res.status(400).json({ ok: false, error: 'bad-plan' });
      const advertiser = cleanName(body.advertiser);
      if (!advertiser) return res.status(400).json({ ok: false, error: 'bad-advertiser' });
      amount = AD_PRICES[plan]; description = `Anuncio (${plan})`;
      data = { type, plan, advertiser, name: String(body.name || '').slice(0, 60),
        emoji: String(body.emoji || ''), badge: String(body.badge || ''),
        url: String(body.url || '').slice(0, 300), id: String(body.id || '').toUpperCase() };
    } else {
      return res.status(400).json({ ok: false, error: 'bad-type' });
    }
    if (!(amount > 0)) return res.status(400).json({ ok: false, error: 'free' });
    const pi = await stripePay.createPaymentIntent(amount, 'usd', description, { tj_type: type });
    if (!pi.ok) return res.status(500).json({ ok: false, error: pi.error || 'stripe-error' });
    pendingStripe.set(pi.id, { ...data, amount, ts: Date.now() });
    // limpieza de pendientes viejos (1h)
    for (const [k, v] of pendingStripe) if (Date.now() - v.ts > 3600e3) pendingStripe.delete(k);
    res.json({ ok: true, clientSecret: pi.clientSecret, paymentIntentId: pi.id, amount });
  } catch (e) {
    console.error('[tintajunta] intent error:', e.message);
    res.status(500).json({ ok: false, error: 'stripe-error' });
  }
});
app.get('/api/text', (req, res) => res.json({
  chapterTitle: CHAPTER_TITLE, bookLine: BOOK_LINE, sampleNote: SAMPLE_NOTE,
  paragraphs: PARAGRAPHS, wordCount: WORDS.length,
}));
app.get('/api/state', (req, res) => {
  const code = normalizeRoom(req.query.room) || MAIN_ROOM;
  const st = getRoom(code);
  res.json({ room: code, highlights: st.highlights, notes: st.notes,
    board: Array.isArray(st.board) ? st.board : [] });
});
/* Genera un código de sala nuevo y único */
app.get('/api/room/new', requireLogin, (req, res) => {
  const code = genRoomCode();
  getRoom(code);
  save();
  res.json({ code });
});
/* ------------------------------ libros API ------------------------------ */
/* Precios de destacados (prototipo; en la versión real los define el creador/admin) */
const FEATURE_PRICES = { day: 199, week: 799, month: 1999 }; // centavos: $1.99/día, $7.99/semana, $19.99/mes
const FEATURE_MS = { day: 24 * 3600 * 1000, week: 7 * 24 * 3600 * 1000, month: 30 * 24 * 3600 * 1000 };
const isFeatured = (b) => !!(b.featured && b.featured.until > Date.now());
/* Catálogo: ficha de cada libro (sin el texto completo).
 * Incluye cuántas marcas y notas tiene cada libro (sus salas comparten el id),
 * para que la biblioteca muestre la actividad de la comunidad. */
/* Config pública: precios mínimos y reglas de la plataforma */
app.get('/api/config', (req, res) => res.json({
  ok: true, minBookPrice: MIN_BOOK_PRICE, minBookPriceLabel: '$' + (MIN_BOOK_PRICE / 100).toFixed(2),
}));
app.get('/api/books', (req, res) => {
  // Solo libros aprobados (los pendientes esperan revisión del admin)
  const as = String(req.query.as || '');
  res.json({ ok: true, books: [...books.values()]
    .filter((b) => (b.status || 'approved') === 'approved' || b.author === as)
    .map((b) => {
    const st = getRoom(b.id);
    const cp = creatorPublic(b.author);
    return {
      id: b.id, title: b.title, author: b.author, price: b.price,
      chapters: b.chapters.length, createdAt: b.createdAt,
      coverUrl: b.coverUrl || null, sales: b.sales || 0,
      status: b.status || 'approved', ageRating: b.ageRating || 'all',
      classic: !!b.classic, language: b.language || 'es',
      verifiedAuthor: !!cp.verified,
      marks: st.highlights.length, notes: st.notes.length,
      rating: reviewSummary(b.id),
      reports: reportCount(b.id),
      featured: isFeatured(b), featuredUntil: isFeatured(b) ? b.featured.until : 0,
    };
  }) });
});
/* Publicar un libro (creador). El texto se separa en párrafos por líneas en blanco.
 * Pasa por revisión anti-plagio y queda "en revisión" hasta que el admin lo aprueba. */
app.post('/api/books', requireLogin, (req, res) => {
  const title = String((req.body && req.body.title) || '').trim().slice(0, 120);
  const author = String((req.body && req.body.author) || '').trim().slice(0, 60) || 'Anónimo';
  const price = Math.max(0, Math.floor(Number((req.body && req.body.price)) || 0));
  if (price > 0 && price < MIN_BOOK_PRICE) return res.status(400).json({ ok: false, error: 'min-price', minPrice: MIN_BOOK_PRICE });
  const text = String((req.body && req.body.text) || '').trim();
  if (!title || !text) return res.status(400).json({ ok: false, error: 'bad-book' });
  const allParas = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (!allParas.length) return res.status(400).json({ ok: false, error: 'bad-book' });
  if (allParas.length > 500) return res.status(400).json({ ok: false, error: 'too-long', max: 500 });
  const paragraphs = allParas.slice(0, 500);
  // Clasificación de edad
  let ageRating = String((req.body && req.body.ageRating) || 'all');
  if (!AGE_RATINGS.includes(ageRating)) ageRating = 'all';
  // Anti-plagio: si >70% del texto ya existe en otros libros, se bloquea
  const orig = originalityCheck(paragraphs.join('\n'));
  if (!orig.ok) return res.status(400).json({ ok: false, error: 'plagiarism', score: orig.score });
  const id = genBookId();
  const book = { id, title, author, price, createdAt: Date.now(), sales: 0,
    status: 'pending', ageRating,
    chapters: [{ title: 'Capítulo 1', paragraphs }] };
  books.set(id, book);
  wordsCache.delete(id); // la caché se reconstruye con el texto real
  saveBooks();
  res.json({ ok: true, status: 'pending', book: { id, title, author, price } });
});
/* Destacar un libro en portada (creador). Con Stripe activo exige pago verificado. */
app.post('/api/books/:id/feature', requireLogin, async (req, res) => {
  const b = books.get(String(req.params.id || '').toUpperCase());
  if (!b) return res.status(404).json({ ok: false, error: 'not-found' });
  const plan = String((req.body && req.body.plan) || '');
  if (!FEATURE_PRICES[plan]) return res.status(400).json({ ok: false, error: 'bad-plan' });
  // Solo el creador puede destacar su propio libro
  const author = cleanName(req.body && req.body.author);
  if (b.author !== author) return res.status(403).json({ ok: false, error: 'not-owner' });
  // Pago real con Stripe (en TEST no se cobra dinero de verdad)
  if (stripePay.isEnabled()) {
    const pid = String((req.body && req.body.paymentIntentId) || '');
    const ok = await verifyStripeFor(pid, FEATURE_PRICES[plan]);
    if (!ok) return res.status(402).json({ ok: false, error: 'payment-required' });
  }
  const now = Date.now();
  const base = isFeatured(b) ? b.featured.until : now; // extiende si ya está destacado
  b.featured = { until: base + FEATURE_MS[plan], plan };
  saveBooks();
  res.json({ ok: true, featured: true, until: b.featured.until, plan,
    price: FEATURE_PRICES[plan] });
});
/* Precios de destacados (para que el cliente los muestre) */
app.get('/api/feature-prices', (req, res) => {
  res.json({ ok: true, prices: FEATURE_PRICES });
});
/* --------------------------- reseñas API --------------------------- */
/* Reseñas de libros (prototipo: sin login, usa el nombre enviado). */
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');
const reviews = new Map(); // bookId -> [{ id, name, stars, comment, ts }]
function loadReviews() {
  try {
    const raw = fs.readFileSync(REVIEWS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      for (const [bid, list] of Object.entries(parsed)) {
        if (Array.isArray(list)) {
          reviews.set(String(bid).toUpperCase(),
            list.filter((r) => r && r.stars >= 1 && r.stars <= 5));
        }
      }
      console.log(`[tintajunta] reseñas cargadas: ${[...reviews.values()].reduce((a, l) => a + l.length, 0)}`);
    }
  } catch { /* sin archivo: empezar vacío */ }
}
function saveReviews() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(Object.fromEntries(reviews)));
  } catch (e) { console.error('[tintajunta] error guardando reseñas:', e.message); }
}
loadReviews();
const reviewSummary = (bid) => {
  const list = reviews.get(String(bid).toUpperCase()) || [];
  if (!list.length) return { avg: 0, count: 0 };
  const avg = list.reduce((a, r) => a + r.stars, 0) / list.length;
  return { avg: Math.round(avg * 10) / 10, count: list.length };
};
app.get('/api/books/:id/reviews', (req, res) => {
  const bid = String(req.params.id || '').toUpperCase();
  const list = (reviews.get(bid) || []).slice().sort((a, b) => b.ts - a.ts);
  res.json({ ok: true, reviews: list, ...reviewSummary(bid) });
});
app.post('/api/books/:id/reviews', (req, res) => {
  const bid = String(req.params.id || '').toUpperCase();
  if (!books.has(bid)) return res.status(404).json({ ok: false, error: 'not-found' });
  const stars = Math.round(Number(req.body && req.body.stars) || 0);
  if (stars < 1 || stars > 5) return res.status(400).json({ ok: false, error: 'bad-stars' });
  const name = cleanName(req.body && req.body.name) || 'Lector';
  const comment = String((req.body && req.body.comment) || '').trim().slice(0, 300);
  const r = { id: 'R' + Date.now().toString(36) + Math.floor(Math.random() * 999),
    bookId: bid, name, stars, comment, ts: Date.now() };
  if (!reviews.has(bid)) reviews.set(bid, []);
  reviews.get(bid).push(r);
  saveReviews();
  res.json({ ok: true, review: r, ...reviewSummary(bid) });
});
/* --------------------------- 🚩 reportes ------------------------------
   Reportes de la comunidad sobre libros que rompen las reglas.
   3+ reportes = insignia "⚠️ Reportado por la comunidad" (la eliminación es del admin). */
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');
const reports = new Map(); // bookId -> [{ id, bookId, reporter, reason, text, ts }]
const REPORT_REASONS = ['no-original', 'copyright', 'dominio-publico', 'copiado', 'otro'];
function loadReports() {
  try {
    const raw = fs.readFileSync(REPORTS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      for (const [bid, list] of Object.entries(parsed)) {
        if (Array.isArray(list)) {
          reports.set(String(bid).toUpperCase(),
            list.filter((r) => r && REPORT_REASONS.includes(r.reason)));
        }
      }
      console.log(`[tintajunta] reportes cargados: ${[...reports.values()].reduce((a, l) => a + l.length, 0)}`);
    }
  } catch { /* sin archivo: empezar vacío */ }
}
function saveReports() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(Object.fromEntries(reports)));
  } catch (e) { console.error('[tintajunta] error guardando reportes:', e.message); }
}
loadReports();
const reportCount = (bid) => (reports.get(String(bid).toUpperCase()) || []).length;
app.get('/api/books/:id/reports/count', (req, res) => {
  const bid = String(req.params.id || '').toUpperCase();
  res.json({ ok: true, count: reportCount(bid) });
});
app.post('/api/books/:id/report', (req, res) => {
  const bid = String(req.params.id || '').toUpperCase();
  if (!books.has(bid)) return res.status(404).json({ ok: false, error: 'not-found' });
  const reason = String((req.body && req.body.reason) || '');
  if (!REPORT_REASONS.includes(reason)) return res.status(400).json({ ok: false, error: 'bad-reason' });
  const reporter = cleanName(req.body && req.body.name);
  const list = reports.get(bid) || [];
  if (list.some((r) => r.reporter === reporter)) {
    return res.status(409).json({ ok: false, error: 'duplicate', count: list.length });
  }
  const text = String((req.body && req.body.text) || '').trim().slice(0, 200);
  const r = { id: 'RP' + Date.now().toString(36) + Math.floor(Math.random() * 999),
    bookId: bid, reporter, reason, text, ts: Date.now() };
  list.push(r);
  reports.set(bid, list);
  saveReports();
  res.json({ ok: true, report: r, count: list.length });
});
/* ---------------------- 🐛 reportes de fallos (feedback) -------------------
   Los usuarios reportan lo que no funciona; Alejandro los revisa en el panel. */
const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.json');
let feedback = []; // [{ id, name, page, message, userAgent, ts, status }]
const FEEDBACK_STATUS = ['nuevo', 'leido', 'resuelto'];
function loadFeedback() {
  try {
    const raw = fs.readFileSync(FEEDBACK_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) feedback = parsed.filter((f) => f && f.message);
    console.log(`[tintajunta] feedback cargado: ${feedback.length}`);
  } catch { /* sin archivo: empezar vacío */ }
}
let feedbackTimer = null;
function saveFeedback() {
  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(feedback));
    } catch (e) { console.error('[tintajunta] error guardando feedback:', e.message); }
  }, 250);
}
loadFeedback();
app.post('/api/feedback', (req, res) => {
  const message = String((req.body && req.body.message) || '').trim().slice(0, 1000);
  if (!message) return res.status(400).json({ ok: false, error: 'empty' });
  const page = String((req.body && req.body.page) || '').trim().slice(0, 60) || 'desconocida';
  const name = String((req.body && req.body.name) || '').trim().slice(0, 40) || 'Anónimo';
  const userAgent = String(req.get('user-agent') || '').slice(0, 200);
  const f = { id: 'FB' + Date.now().toString(36) + Math.floor(Math.random() * 999),
    name, page, message, userAgent, ts: Date.now(), status: 'nuevo' };
  feedback.push(f);
  saveFeedback();
  res.json({ ok: true, id: f.id });
});
app.get('/api/admin/feedback', (req, res) => {
  const admin = String(req.query.admin || '');
  if (!isAdmin(admin)) return res.status(403).json({ ok: false, error: 'not-admin' });
  res.json({ ok: true, feedback: [...feedback].reverse() });
});
app.post('/api/admin/feedback/:id/status', (req, res) => {
  const admin = String((req.body && req.body.admin) || '');
  if (!isAdmin(admin)) return res.status(403).json({ ok: false, error: 'not-admin' });
  const status = String((req.body && req.body.status) || '');
  if (!FEEDBACK_STATUS.includes(status)) return res.status(400).json({ ok: false, error: 'bad-status' });
  const f = feedback.find((x) => x.id === req.params.id);
  if (!f) return res.status(404).json({ ok: false, error: 'not-found' });
  f.status = status;
  saveFeedback();
  res.json({ ok: true, feedback: f });
});
/* Registrar una compra. Con Stripe activo exige paymentIntentId verificado;
 * sin Stripe (o gratis) mantiene el flujo anterior. Suma 1 venta al libro. */
app.post('/api/books/:id/buy', requireLogin, async (req, res) => {
  const bid = String(req.params.id || '').toUpperCase();
  const b = books.get(bid);
  if (!b) return res.status(404).json({ ok: false, error: 'not-found' });
  if (stripePay.isEnabled() && b.price > 0) {
    const pid = String((req.body && req.body.paymentIntentId) || '');
    const ok = await verifyStripeFor(pid, b.price);
    if (!ok) return res.status(402).json({ ok: false, error: 'payment-required' });
  }
  b.sales = (typeof b.sales === 'number' ? b.sales : 0) + 1;
  saveBooks();
  res.json({ ok: true, sales: b.sales });
});
/* Verifica un PaymentIntent contra Stripe: debe existir, estar succeeded y
 * el monto debe coincidir con el esperado. */
async function verifyStripeFor(paymentIntentId, expectedCents) {
  if (!paymentIntentId) return false;
  const v = await stripePay.verifyPaymentIntent(paymentIntentId);
  return v.ok && v.status === 'succeeded' && v.amount === Math.round(expectedCents);
}
/* Completa una acción de pago pendiente (llamado por el webhook de Stripe).
 * Devuelve true si había una acción pendiente y se ejecutó. */
function completeStripePayment(paymentIntentId, metadata) {
  const p = pendingStripe.get(paymentIntentId);
  if (!p) return false;
  pendingStripe.delete(paymentIntentId);
  try {
    if (p.type === 'buy') {
      const b = books.get(p.bookId);
      if (b) { b.sales = (b.sales || 0) + 1; saveBooks(); }
    } else if (p.type === 'feature') {
      const b = books.get(p.bookId);
      if (b && b.author === p.author) {
        const now = Date.now();
        const base = isFeatured(b) ? b.featured.until : now;
        b.featured = { until: base + FEATURE_MS[p.plan], plan: p.plan };
        saveBooks();
      }
    } else if (p.type === 'ad') {
      const now = Date.now();
      if (p.id) {
        const a = ads.get(p.id);
        if (a && a.advertiser === p.advertiser) {
          const base = isAdActive(a) ? a.until : now;
          a.until = base + AD_MS[p.plan]; a.plan = p.plan;
          if (p.url) a.url = p.url;
          saveAds();
        }
      } else if (p.name) {
        const nid = genAdId();
        ads.set(nid, { id: nid, name: p.name, emoji: p.emoji, badge: p.badge,
          plan: p.plan, advertiser: p.advertiser, url: p.url,
          until: now + AD_MS[p.plan], createdAt: now });
        saveAds();
      }
    }
    return true;
  } catch (e) {
    console.error('[tintajunta] completeStripePayment:', e.message);
    return false;
  }
}
/* ------------------- 🏆 niveles y logros de creador ------------------- */
const LEVELS = [
  { min: 100, emoji: '💎', name: 'Diamante' },
  { min: 50,  emoji: '🥇', name: 'Oro' },
  { min: 10,  emoji: '🥈', name: 'Plata' },
  { min: 1,   emoji: '🥉', name: 'Bronce' },
  { min: 0,   emoji: '🌱', name: 'Nuevo' },
];
const ACH_DEFS = [
  { id: 'first-book',  emoji: '📖', name: 'Primera publicación' },
  { id: 'first-sale',  emoji: '💰', name: 'Primera venta' },
  { id: 'sales-10',    emoji: '🔥', name: '10 ventas' },
  { id: 'sales-50',    emoji: '🚀', name: '50 ventas' },
  { id: 'rated-4',     emoji: '⭐', name: '4+ estrellas promedio' },
  { id: 'notes-100',   emoji: '💬', name: '100 notas recibidas' },
];
function creatorLevel(name) {
  const aname = String(name || '').trim();
  // Los clásicos gratis no tienen creador: no cuentan para niveles ni comisiones
  const mine = [...books.values()].filter((b) => b.author === aname && !b.classic);
  const sales = mine.reduce((a, b) => a + (typeof b.sales === 'number' ? b.sales : 0), 0);
  const notes = mine.reduce((a, b) => a + getRoom(b.id).notes.length, 0);
  const rated4 = mine.some((b) => { const r = reviewSummary(b.id); return r.count >= 5 && r.avg >= 4; });
  const level = LEVELS.find((l) => sales >= l.min) || LEVELS[LEVELS.length - 1];
  const nextIdx = LEVELS.findIndex((l) => sales >= l.min) - 1;
  const next = nextIdx >= 0 ? LEVELS[nextIdx] : null;
  const unlocked = {
    'first-book': mine.length >= 1,
    'first-sale': sales >= 1,
    'sales-10': sales >= 10,
    'sales-50': sales >= 50,
    'rated-4': rated4,
    'notes-100': notes >= 100,
  };
  return {
    name: aname, books: mine.length, sales, notes,
    level: { emoji: level.emoji, name: level.name },
    next: next ? { emoji: next.emoji, name: next.name, need: next.min - sales } : null,
    achievements: ACH_DEFS.map((d) => ({ ...d, unlocked: !!unlocked[d.id] })),
  };
}
app.get('/api/creators/:name/level', (req, res) => {
  res.json({ ok: true, ...creatorLevel(req.params.name) });
});
/* ---------------- 👤 Perfil público de creador (v69, estilo knowledge panel) ----
 * GET  /api/creators/:name/profile  -> perfil público + libros + stats + canEdit
 * POST /api/creators/:name/profile  -> actualizar perfil propio (login requerido)
 * POST /api/creators/:name/photo    -> subir foto de perfil (login requerido)   */
function creatorCanEdit(req, c) {
  const u = req.session && req.session.user;
  if (!u || !u.sub) return { ok: false, error: 'login' };
  const uname = String(u.name || '').trim().toLowerCase();
  if (uname === 'lenyn escobar') return { ok: true, admin: true }; // admin
  if (c.googleSub) return c.googleSub === u.sub
    ? { ok: true } : { ok: false, error: 'not-owner' };
  // Perfil sin reclamar: solo si el nombre de Google coincide con el del creador
  if (uname && uname === String(c.name).trim().toLowerCase()) return { ok: true, claim: true };
  return { ok: false, error: 'not-owner' };
}
app.get('/api/creators/:name/profile', (req, res) => {
  const c = getCreator(req.params.name);
  if (!c) return res.status(400).json({ ok: false, error: 'bad-name' });
  const lvl = creatorLevel(c.name);
  const myBooks = [...books.values()]
    .filter((b) => b.author === c.name && b.status !== 'pending')
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .map((b) => ({ id: b.id, title: b.title, coverUrl: b.coverUrl || null,
      price: b.price || 0, sales: b.sales || 0 }));
  let since = c.since || 0;
  if (!since) {
    const all = [...books.values()].filter((b) => b.author === c.name);
    if (all.length) since = Math.min(...all.map((b) => b.createdAt || Date.now()));
  }
  const can = creatorCanEdit(req, c);
  res.json({ ok: true, profile: {
    name: c.name, verified: !!c.verified,
    level: lvl.level, books: lvl.books, sales: lvl.sales, notes: lvl.notes,
    bio: c.bio || '', photo: c.photo || '', location: c.location || '',
    website: c.website || '', socials: Object.assign(
      { instagram: '', x: '', youtube: '', tiktok: '', facebook: '' }, c.socials || {}),
    about: c.about || '', since: since || 0,
    booksList: myBooks, canEdit: !!can.ok,
  }});
});
app.post('/api/creators/:name/profile', requireLogin, (req, res) => {
  const c = getCreator(req.params.name);
  if (!c) return res.status(400).json({ ok: false, error: 'bad-name' });
  const can = creatorCanEdit(req, c);
  if (!can.ok) return res.status(403).json({ ok: false, error: can.error || 'not-owner' });
  if (can.claim) c.googleSub = req.session.user.sub; // reclama su perfil
  const b = req.body || {};
  const cleanUrl = (v, max) => {
    let s = String(v || '').trim().slice(0, max || 120);
    if (s && !/^https?:\/\//i.test(s)) s = 'https://' + s;
    return s;
  };
  c.bio = String(b.bio || '').trim().slice(0, 160);
  c.location = String(b.location || '').trim().slice(0, 60);
  c.website = cleanUrl(b.website, 120);
  c.about = String(b.about || '').trim().slice(0, 1000);
  const soc = (b.socials && typeof b.socials === 'object') ? b.socials : {};
  const cleanSoc = {};
  for (const k of ['instagram', 'x', 'youtube', 'tiktok', 'facebook']) cleanSoc[k] = cleanUrl(soc[k], 120);
  c.socials = cleanSoc;
  if (!c.since) c.since = Date.now();
  saveCreators();
  res.json({ ok: true });
});
/* La subida de foto (multer) se define junto a las demás subidas, tras COVER_MIME. */
/* Estadísticas para el creador: marcas + notas + reseñas */
app.get('/api/books/:id/stats', (req, res) => {
  const bid = String(req.params.id || '').toUpperCase();
  const b = books.get(bid);
  if (!b) return res.status(404).json({ ok: false, error: 'not-found' });
  const st = getRoom(bid);
  const rs = reviewSummary(bid);
  res.json({ ok: true, stats: {
    marks: st.highlights.length, notes: st.notes.length,
    reviews: rs.count, avg: rs.avg,
  }});
});
/* --------------------------- anuncios API --------------------------- */
/* Anuncios pagados en "Para leer mejor". Pago simulado en el prototipo
 * (en la versión real aquí va Stripe — ver server/stripe-ready.js). */
const ADS_FILE = path.join(DATA_DIR, 'ads.json');
const ads = new Map(); // id -> { id, name, emoji, badge, plan, advertiser, until, createdAt }
const AD_PRICES = { day: 199, week: 799, month: 1999 }; // centavos: $1.99/día, $7.99/semana, $19.99/mes
const AD_MS = { day: 24 * 3600 * 1000, week: 7 * 24 * 3600 * 1000, month: 30 * 24 * 3600 * 1000 };
const AD_EMOJIS = ['👓','🎧','💡','📱','💻','🪑','☕','📖','🔦','🎒','⌚','🧴'];
const AD_BADGES = ['mas-vendido', 'famoso'];
const isAdActive = (a) => !!(a && a.until > Date.now());
function genAdId() {
  const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let id;
  do {
    id = 'AD';
    for (let i = 0; i < 4; i++) id += ABC[Math.floor(Math.random() * ABC.length)];
  } while (ads.has(id));
  return id;
}
function loadAds() {
  try {
    const raw = fs.readFileSync(ADS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const a of parsed) if (a && a.id && a.name) ads.set(a.id, a);
      console.log(`[tintajunta] anuncios cargados: ${ads.size}`);
    }
  } catch { /* sin archivo: empezar vacío */ }
}
function saveAds() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(ADS_FILE, JSON.stringify([...ads.values()]));
  } catch (e) { console.error('[tintajunta] error guardando anuncios:', e.message); }
}
loadAds();
/* Solo los vigentes, más recientes primero */
app.get('/api/ads', (req, res) => {
  const now = Date.now();
  const list = [...ads.values()]
    .filter((a) => a.until > now)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((a) => ({ id: a.id, name: a.name, emoji: a.emoji, badge: a.badge,
      advertiser: a.advertiser, until: a.until, photoUrl: a.photoUrl || null, url: a.url || '',
      daysLeft: Math.max(1, Math.ceil((a.until - now) / AD_MS.day)) }));
  res.json({ ok: true, ads: list });
});
app.get('/api/ad-prices', (req, res) => {
  res.json({ ok: true, prices: AD_PRICES, emojis: AD_EMOJIS });
});
/* Crear o renovar un anuncio. Con Stripe activo exige pago verificado. */
app.post('/api/ads', requireLogin, async (req, res) => {
  const body = req.body || {};
  const advertiser = cleanName(body.advertiser);
  if (!advertiser) return res.status(400).json({ ok: false, error: 'bad-advertiser' });
  const plan = String(body.plan || '');
  if (!AD_PRICES[plan]) return res.status(400).json({ ok: false, error: 'bad-plan' });
  const badge = String(body.badge || '');
  if (!AD_BADGES.includes(badge)) return res.status(400).json({ ok: false, error: 'bad-badge' });
  const emoji = String(body.emoji || '');
  if (!AD_EMOJIS.includes(emoji)) return res.status(400).json({ ok: false, error: 'bad-emoji' });
  // Pago real con Stripe (en TEST no se cobra dinero de verdad)
  if (stripePay.isEnabled()) {
    const pid = String(body.paymentIntentId || '');
    const ok = await verifyStripeFor(pid, AD_PRICES[plan]);
    if (!ok) return res.status(402).json({ ok: false, error: 'payment-required' });
  }
  const now = Date.now();
  // ¿renovación? solo el anunciante dueño puede extender su anuncio
  const id = String(body.id || '').toUpperCase();
  if (id) {
    const a = ads.get(id);
    if (!a) return res.status(404).json({ ok: false, error: 'not-found' });
    if (a.advertiser !== advertiser) return res.status(403).json({ ok: false, error: 'not-owner' });
    const base = isAdActive(a) ? a.until : now; // extiende si sigue vigente
    a.until = base + AD_MS[plan];
    a.plan = plan;
    let rurl = String(body.url || '').trim().slice(0, 300);
    if (rurl) { if (!/^https?:\/\//i.test(rurl)) rurl = 'https://' + rurl; a.url = rurl; }
    saveAds();
    // En la versión real aquí va Stripe; en el prototipo la compra es simulada
    return res.json({ ok: true, renewed: true, ad: { id: a.id, until: a.until }, price: AD_PRICES[plan] });
  }
  const name = String(body.name || '').trim().slice(0, 60);
  if (!name) return res.status(400).json({ ok: false, error: 'bad-name' });
  let url = String(body.url || '').trim().slice(0, 300);
  if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
  const nid = genAdId();
  const ad = { id: nid, name, emoji, badge, plan, advertiser, url,
    until: now + AD_MS[plan], createdAt: now };
  ads.set(nid, ad);
  saveAds();
  // En la versión real aquí va Stripe; en el prototipo la compra es simulada
  res.json({ ok: true, renewed: false, ad: { id: nid, until: ad.until }, price: AD_PRICES[plan] });
});
/* ------------------------------ escritos ------------------------------ */
/* Página "Escribir": textos personales del prototipo (sin pagos). */
const WRITINGS_FILE = path.join(DATA_DIR, 'writings.json');
const writings = new Map(); // id -> { id, title, text, author, createdAt }
function genWritingId() {
  const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let id;
  do {
    id = 'ES';
    for (let i = 0; i < 4; i++) id += ABC[Math.floor(Math.random() * ABC.length)];
  } while (writings.has(id));
  return id;
}
function loadWritings() {
  try {
    const raw = fs.readFileSync(WRITINGS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const w of parsed) if (w && w.id && w.title) writings.set(w.id, w);
      console.log(`[tintajunta] escritos cargados: ${writings.size}`);
    }
  } catch { /* sin archivo: empezar vacío */ }
}
function saveWritings() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(WRITINGS_FILE, JSON.stringify([...writings.values()]));
  } catch (e) { console.error('[tintajunta] error guardando escritos:', e.message); }
}
loadWritings();
app.get('/api/writings', (req, res) => {
  const list = [...writings.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((w) => ({ id: w.id, title: w.title, author: w.author, createdAt: w.createdAt,
      preview: w.text.slice(0, 140) }));
  res.json({ ok: true, writings: list });
});
app.get('/api/writings/:id', (req, res) => {
  const w = writings.get(String(req.params.id || '').toUpperCase());
  if (!w) return res.status(404).json({ ok: false, error: 'not-found' });
  res.json({ ok: true, writing: w });
});

app.post('/api/writings', requireLogin, (req, res) => {
  const body = req.body || {};
  const title = String(body.title || '').trim().slice(0, 120);
  const text = String(body.text || '').trim().slice(0, 20000);
  const author = cleanName(body.author) || 'Anónimo';
  if (!title || !text) return res.status(400).json({ ok: false, error: 'bad-writing' });
  const id = genWritingId();
  const w = { id, title, text, author, createdAt: Date.now() };
  writings.set(id, w);
  saveWritings();
  res.json({ ok: true, writing: { id, title, author, createdAt: w.createdAt } });
});
app.get('/api/books/:id', (req, res) => {
  const b = books.get(String(req.params.id || '').toUpperCase());
  if (!b) return res.status(404).json({ ok: false, error: 'not-found' });
  res.json({ ok: true, book: b });
});
/* ------------------------ portadas de libros ------------------------ */
/* Subir portada propia (creador). Solo imágenes, máx 2MB. */
const COVERS_DIR = path.join(__dirname, 'public', 'covers');
fs.mkdirSync(COVERS_DIR, { recursive: true });
const COVER_MIME = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const coverUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, COVERS_DIR),
    filename: (req, file, cb) => {
      const id = String(req.params.id || '').toUpperCase().replace(/[^A-Z]/g, '');
      const ext = COVER_MIME[file.mimetype] || '.jpg';
      cb(null, id + ext);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (COVER_MIME[file.mimetype]) cb(null, true);
    else cb(new Error('bad-type'));
  },
});
app.post('/api/books/:id/cover', (req, res) => {
  const b = books.get(String(req.params.id || '').toUpperCase());
  if (!b) return res.status(404).json({ ok: false, error: 'not-found' });
  coverUpload.single('cover')(req, res, (err) => {
    if (err) {
      const code = err.message === 'bad-type' ? 'bad-type' : (err.code === 'LIMIT_FILE_SIZE' ? 'too-big' : 'upload-error');
      return res.status(400).json({ ok: false, error: code });
    }
    if (!req.file) return res.status(400).json({ ok: false, error: 'no-file' });
    // Solo el creador puede subir la portada de su libro (req.body lo llenó multer)
    const author = cleanName(req.body && req.body.author);
    if (b.author !== author) {
      // no es el dueño: borrar el archivo y rechazar
      try { fs.unlinkSync(req.file.path); } catch { /* noop */ }
      return res.status(403).json({ ok: false, error: 'not-owner' });
    }
    // borrar portada anterior si tenía otra extensión
    const base = b.id;
    for (const ext of Object.values(COVER_MIME)) {
      const p = path.join(COVERS_DIR, base + ext);
      if (p !== req.file.path) { try { fs.unlinkSync(p); } catch { /* noop */ } }
    }
    b.coverUrl = '/covers/' + path.basename(req.file.path);
    saveBooks();
    res.json({ ok: true, coverUrl: b.coverUrl });
  });
});
/* --------------------- foto de perfil del creador (v69) --------------------- */
const CREATORIMG_DIR = path.join(__dirname, 'public', 'img', 'creators');
try { fs.mkdirSync(CREATORIMG_DIR, { recursive: true }); } catch { /* noop */ }
const creatorPhotoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, CREATORIMG_DIR),
    filename: (req, file, cb) => {
      const safe = String(req.params.name || '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'creador';
      const ext = COVER_MIME[file.mimetype] || '.jpg';
      cb(null, 'creator-' + safe + ext);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (COVER_MIME[file.mimetype]) cb(null, true);
    else cb(new Error('bad-type'));
  },
});
app.post('/api/creators/:name/photo', requireLogin, (req, res) => {
  const c = getCreator(req.params.name);
  if (!c) return res.status(400).json({ ok: false, error: 'bad-name' });
  const can = creatorCanEdit(req, c);
  if (!can.ok) return res.status(403).json({ ok: false, error: can.error || 'not-owner' });
  creatorPhotoUpload.single('photo')(req, res, (err) => {
    if (err || !req.file) {
      const code = err && err.message === 'bad-type' ? 'bad-type'
        : (err && err.code === 'LIMIT_FILE_SIZE' ? 'too-big' : 'upload-error');
      return res.status(400).json({ ok: false, error: code });
    }
    if (can.claim) c.googleSub = req.session.user.sub; // reclama su perfil
    c.photo = '/img/creators/' + path.basename(req.file.path);
    if (!c.since) c.since = Date.now();
    saveCreators();
    res.json({ ok: true, photo: c.photo });
  });
});
/* --------------------- fotos por página del libro --------------------- */
/* El creador puede añadir fotos a su libro (JPG/PNG/WebP, máx 2MB c/u).
 * Se muestran al leer en la sala en vivo. */
const PAGEIMG_DIR = path.join(__dirname, 'public', 'pageimg');
fs.mkdirSync(PAGEIMG_DIR, { recursive: true });
const pageImgUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, PAGEIMG_DIR),
    filename: (req, file, cb) => {
      const id = String(req.params.id || '').toUpperCase().replace(/[^A-Z]/g, '');
      const ext = COVER_MIME[file.mimetype] || '.jpg';
      cb(null, id + '-' + Date.now() + '-' + Math.floor(Math.random() * 1000) + ext);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (COVER_MIME[file.mimetype]) cb(null, true);
    else cb(new Error('bad-type'));
  },
});
app.post('/api/books/:id/images', (req, res) => {
  const b = books.get(String(req.params.id || '').toUpperCase());
  if (!b) return res.status(404).json({ ok: false, error: 'not-found' });
  pageImgUpload.array('images', 10)(req, res, (err) => {
    if (err) {
      const code = err.message === 'bad-type' ? 'bad-type' : (err.code === 'LIMIT_FILE_SIZE' ? 'too-big' : 'upload-error');
      return res.status(400).json({ ok: false, error: code });
    }
    if (!req.files || !req.files.length) return res.status(400).json({ ok: false, error: 'no-file' });
    const author = cleanName(req.body && req.body.author);
    if (b.author !== author) {
      for (const f of req.files) { try { fs.unlinkSync(f.path); } catch { /* noop */ } }
      return res.status(403).json({ ok: false, error: 'not-owner' });
    }
    if (!b.chapters[0].images) b.chapters[0].images = [];
    for (const f of req.files) b.chapters[0].images.push('/pageimg/' + path.basename(f.path));
    saveBooks();
    res.json({ ok: true, images: b.chapters[0].images });
  });
});
/* ------------------------- fotos de anuncios ------------------------- */
/* JPG/PNG/WebP, máx 2MB — igual que las portadas de libros */
const ADS_IMG_DIR = path.join(__dirname, 'public', 'ads');
fs.mkdirSync(ADS_IMG_DIR, { recursive: true });
const AD_IMG_MIME = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const adPhotoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, ADS_IMG_DIR),
    filename: (req, file, cb) => {
      const id = String(req.params.id || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const ext = AD_IMG_MIME[file.mimetype] || '.jpg';
      cb(null, id + ext);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (AD_IMG_MIME[file.mimetype]) cb(null, true);
    else cb(new Error('bad-type'));
  },
});
app.post('/api/ads/:id/photo', (req, res) => {
  const a = ads.get(String(req.params.id || '').toUpperCase());
  if (!a) return res.status(404).json({ ok: false, error: 'not-found' });
  adPhotoUpload.single('photo')(req, res, (err) => {
    if (err) {
      const code = err.message === 'bad-type' ? 'bad-type' : (err.code === 'LIMIT_FILE_SIZE' ? 'too-big' : 'upload-error');
      return res.status(400).json({ ok: false, error: code });
    }
    if (!req.file) return res.status(400).json({ ok: false, error: 'no-file' });
    // Solo el anunciante dueño puede subir la foto
    const advertiser = cleanName(req.body && req.body.advertiser);
    if (a.advertiser !== advertiser) {
      try { fs.unlinkSync(req.file.path); } catch { /* noop */ }
      return res.status(403).json({ ok: false, error: 'not-owner' });
    }
    // borrar foto anterior si tenía otra extensión
    for (const ext of Object.values(AD_IMG_MIME)) {
      const p = path.join(ADS_IMG_DIR, a.id + ext);
      if (p !== req.file.path) { try { fs.unlinkSync(p); } catch { /* noop */ } }
    }
    a.photoUrl = '/ads/' + path.basename(req.file.path);
    saveAds();
    res.json({ ok: true, photoUrl: a.photoUrl });
  });
});
/* Diagnóstico remoto del prototipo: el cliente envía líneas de registro */
app.post('/api/clog', (req, res) => {
  try {
    const line = `[client ${new Date().toISOString()}] ${String((req.body && req.body.msg) || '').slice(0, 500)}`;
    fs.appendFileSync('/tmp/tintajunta-client.log', line + '\n');
  } catch { /* no romper la sala por un log */ }
  res.sendStatus(200);
});
/* ------------------------- API HTTP (sin WebSockets) ---------------------- */
/* El cliente publica con POST y sondea GET /api/rooms/:room/state cada 2.5s.
 * La presencia se mantiene con latidos (ping); un barrendero elimina a los
 * ausentes. Todo son peticiones HTTPS cortas: atraviesan cualquier túnel. */

const presence = new Map(); // "ROOM::nombre" -> { name, color, room, para, lastSeen }
const PRESENCE_TTL = 45000;
const pkey = (room, name) => room + '::' + name;
// v68: la presencia incluye el párrafo que cada lector está viendo (para la
// "efervescencia colectiva": ver dónde leen los demás en tiempo real).
function touchPresence(room, name, color, para) {
  const p = Number(para);
  presence.set(pkey(room, name), { name, color, room,
    para: Number.isFinite(p) && p >= 0 ? Math.floor(p) : -1,
    lastSeen: Date.now() });
}
function roster(room) {
  const now = Date.now();
  const out = [];
  for (const p of presence.values()) {
    if (p.room === room && now - p.lastSeen < PRESENCE_TTL)
      out.push({ name: p.name, color: p.color, para: p.para });
  }
  return out;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, p] of presence) if (now - p.lastSeen >= PRESENCE_TTL) presence.delete(k);
}, 30000).unref();

const cleanName = (n) => String(n || '').trim().slice(0, 24) || 'Lector';
const cleanColor = (c) => (COLORS[c] ? c : DEFAULT_COLOR);

/* Palabras de una sala: si el código es un libro, usa su texto; si no, la muestra fija.
 * Se cachea por código para no reconstruir en cada validación. */
const wordsCache = new Map(); // código -> [{ t, p }]
function wordsForRoom(code) {
  if (wordsCache.has(code)) return wordsCache.get(code);
  const b = books.get(String(code || '').toUpperCase());
  let words;
  if (b && b.chapters) {
    words = [];
    b.chapters.forEach((ch) => {
      (ch.paragraphs || []).forEach((text, p) => {
        String(text).split(/\s+/).forEach((t) => { if (t.length) words.push({ t, p }); });
      });
    });
  } else {
    words = WORDS;
  }
  wordsCache.set(code, words);
  return words;
}

function validRange(code, start, end) {
  const W = wordsForRoom(code);
  start = Math.floor(Number(start));
  end = Math.floor(Number(end));
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start > end) [start, end] = [end, start];
  if (start < 0 || end >= W.length) return null;
  if (end - start + 1 > MAX_RANGE) return null;
  return { start, end };
}
const passageText = (code, start, end) => wordsForRoom(code).slice(start, end + 1).map((w) => w.t).join(' ');

function roomOf(req, res) {
  const code = normalizeRoom(req.params.room);
  if (!code) { res.status(400).json({ ok: false, error: 'bad-room' }); return null; }
  return code;
}
function userOf(req) {
  return { name: cleanName(req.body && req.body.name), color: cleanColor(req.body && req.body.color) };
}

/* Entrar (o volver) a la sala: registra presencia y devuelve el estado */
app.post('/api/rooms/:room/join', (req, res) => {
  const code = roomOf(req, res); if (!code) return;
  const u = userOf(req);
  const verifiedColor = claimTeacher(code, u.name, u.color); // v83: anti-suplantación
  touchPresence(code, u.name, verifiedColor);
  const st = getRoom(code);
  pruneHands(st);
  res.json({ ok: true, room: code, highlights: st.highlights, notes: st.notes,
    board: Array.isArray(st.board) ? st.board : [],
    para: st.para || { idx: 0, ts: 0 },
    chat: st.chat || [], reactions: st.reactions || [], hands: st.hands || [],
    roster: roster(code), you: { name: u.name, color: verifiedColor, room: code } });
});
/* Latido de presencia (el cliente lo llama cada ~15s; incluye el párrafo visible) */
app.post('/api/rooms/:room/ping', (req, res) => {
  const code = roomOf(req, res); if (!code) return;
  const u = userOf(req);
  touchPresence(code, u.name, u.color, req.body && req.body.para);
  res.json({ ok: true });
});
/* Estado completo de la sala (el cliente lo sondea cada ~2.5s) */
app.get('/api/rooms/:room/state', (req, res) => {
  const code = roomOf(req, res); if (!code) return;
  const st = getRoom(code);
  pruneHands(st);
  // switchTo expira a los 5 minutos (señal transitoria)
  let sw = st.switchTo || null;
  if (sw && (Date.now() - (Number(sw.ts) || 0)) > 5 * 60 * 1000) { sw = null; st.switchTo = null; }
  res.json({ ok: true, room: code, highlights: st.highlights, notes: st.notes,
    board: Array.isArray(st.board) ? st.board : [],
    follow: st.follow || { active: false, pos: 0, ts: 0, name: '' },
    para: st.para || { idx: 0, ts: 0 },
    chat: st.chat || [], reactions: st.reactions || [], hands: st.hands || [],
    switchTo: sw,
    roster: roster(code) });
});
/* 📖 Párrafo de clase: solo el profesor (tinta negra) mueve el párrafo para todos */
app.post('/api/rooms/:room/para', (req, res) => {
  const code = roomOf(req, res); if (!code) return;
  const u = userOf(req);
  touchPresence(code, u.name, u.color);
  if (!isRoomTeacher(code, u.name)) return res.status(403).json({ ok: false, error: 'solo-profesor' });
  const st = getRoom(code);
  let idx = Math.floor(Number(req.body && req.body.idx));
  if (!isFinite(idx) || idx < 0) idx = 0;
  st.para = { idx, ts: Date.now() };
  save();
  res.json({ ok: true, para: st.para });
});
/* 📚 Cambiar libro: solo el profesor puede mover a todos a otro libro */
app.post('/api/rooms/:room/switch', (req, res) => {
  const code = roomOf(req, res); if (!code) return;
  const u = userOf(req);
  touchPresence(code, u.name, u.color);
  if (!isRoomTeacher(code, u.name)) return res.status(403).json({ ok: false, error: 'solo-profesor' });
  const st = getRoom(code);
  const bookId = String((req.body && req.body.bookId) || '').slice(0, 64);
  const title = String((req.body && req.body.title) || '').slice(0, 120);
  if (!bookId) return res.status(400).json({ ok: false, error: 'sin-libro' });
  st.switchTo = { bookId, title, ts: Date.now() };
  st.para = { idx: 0, ts: Date.now() }; // v81: al cambiar de libro, el párrafo vuelve al inicio
  save();
  res.json({ ok: true, switchTo: st.switchTo });
});
/* 💬 Chat de la sala: mensajes cortos, últimos 50 */
app.post('/api/rooms/:room/chat', (req, res) => {
  const code = roomOf(req, res); if (!code) return;
  const u = userOf(req);
  touchPresence(code, u.name, u.color);
  const st = getRoom(code);
  const text = String((req.body && req.body.text) || '').trim().slice(0, 300);
  if (!text) return res.status(400).json({ ok: false, error: 'empty' });
  const msg = { id: 'c' + (st.seq++), name: u.name, color: u.color, text, ts: Date.now() };
  st.chat.push(msg);
  if (st.chat.length > 50) st.chat = st.chat.slice(-50);
  save();
  res.json({ ok: true, msg });
});
/* 😮 Reacciones rápidas sobre palabras: toggle por usuario+emoji+palabra */
const RX_EMOJIS = ['❤️', '😮', '👏', '🤔', '⭐'];
app.post('/api/rooms/:room/reaction', (req, res) => {
  const code = roomOf(req, res); if (!code) return;
  const u = userOf(req);
  touchPresence(code, u.name, u.color);
  const st = getRoom(code);
  const emoji = String((req.body && req.body.emoji) || '');
  const start = Math.floor(Number(req.body && req.body.start));
  if (!RX_EMOJIS.includes(emoji) || !isFinite(start) || start < 0) {
    return res.status(400).json({ ok: false, error: 'bad-reaction' });
  }
  if (!Array.isArray(st.reactions)) st.reactions = [];
  const i = st.reactions.findIndex((r) => r.start === start && r.emoji === emoji && r.name === u.name);
  let added = true;
  if (i >= 0) {
    st.reactions.splice(i, 1); // toggle: ya reaccioné así → quitar
    added = false;
  } else {
    st.reactions.push({ id: 'r' + (st.seq++), name: u.name, color: u.color, start, emoji, ts: Date.now() });
  }
  save();
  res.json({ ok: true, added });
});
/* ✋ Levantar/bajar la mano (se baja sola tras 2 min) */
app.post('/api/rooms/:room/hand', (req, res) => {
  const code = roomOf(req, res); if (!code) return;
  const u = userOf(req);
  touchPresence(code, u.name, u.color);
  const st = getRoom(code);
  pruneHands(st);
  const up = !!(req.body && req.body.up);
  const target = String((req.body && req.body.target) || '').trim() || u.name;
  const isTeacher = isRoomTeacher(code, u.name);
  if (up) {
    if (!st.hands.some((h) => h.name === u.name)) {
      st.hands.push({ name: u.name, color: u.color, ts: Date.now() });
    }
  } else {
    // bajar la propia, o el profesor baja cualquiera
    if (target !== u.name && !isTeacher) return res.status(403).json({ ok: false, error: 'not-owner' });
    st.hands = st.hands.filter((h) => h.name !== target);
  }
  save();
  res.json({ ok: true, hands: st.hands });
});
/* 👀 Sígueme: solo el profesor (tinta negra) activa y reporta su posición */
app.post('/api/rooms/:room/follow', (req, res) => {
  const code = roomOf(req, res); if (!code) return;
  const u = userOf(req);
  touchPresence(code, u.name, u.color);
  if (!isRoomTeacher(code, u.name)) return res.status(403).json({ ok: false, error: 'solo-profesor' });
  const st = getRoom(code);
  const active = !!(req.body && req.body.active);
  let pos = Number(req.body && req.body.pos);
  if (!isFinite(pos)) pos = 0;
  pos = Math.min(1, Math.max(0, pos));
  st.follow = { active, pos, ts: Date.now(), name: u.name };
  save();
  res.json({ ok: true, follow: st.follow });
});
/* Pizarra compartida (v85): TODOS los de la sala pueden escribir.
   Cada entrada queda con el nombre y color de su autor. El profesor sale en negro con 🎓. */
app.post('/api/rooms/:room/board', (req, res) => {
  const code = roomOf(req, res); if (!code) return;
  const u = userOf(req);
  const verifiedColor = claimTeacher(code, u.name, u.color); // v83: anti-suplantación
  touchPresence(code, u.name, verifiedColor);
  const st = getRoom(code);
  const text = String((req.body && req.body.text) || '').slice(0, 500);
  if (!text.trim()) return res.status(400).json({ ok: false, error: 'texto-vacio' });
  if (!Array.isArray(st.board)) st.board = [];
  st.board.push({ text: text.trim(), name: u.name, color: verifiedColor, ts: Date.now() });
  if (st.board.length > 20) st.board = st.board.slice(-20);
  save();
  res.json({ ok: true, board: st.board });
});
/* Limpiar la pizarra: solo el profesor */
app.post('/api/rooms/:room/boardClear', (req, res) => {
  const code = roomOf(req, res); if (!code) return;
  const u = userOf(req);
  if (!isRoomTeacher(code, u.name)) return res.status(403).json({ ok: false, error: 'solo-profesor' });
  const st = getRoom(code);
  st.board = [];
  save();
  res.json({ ok: true, board: [] });
});
/* Subrayar un pasaje */
app.post('/api/rooms/:room/highlight', (req, res) => {
  const code = roomOf(req, res); if (!code) return;
  const u = userOf(req);
  touchPresence(code, u.name, u.color);
  const st = getRoom(code);
  const r = validRange(code, req.body && req.body.start, req.body && req.body.end);
  if (!r) return res.status(400).json({ ok: false, error: 'bad-range' });
  const rec = { id: 'h' + (st.seq++), name: u.name, color: u.color,
    start: r.start, end: r.end, text: passageText(code, r.start, r.end), ts: Date.now() };
  st.highlights.push(rec);
  save();
  res.json({ ok: true, highlight: rec });
});
/* Nota al margen */
app.post('/api/rooms/:room/note', (req, res) => {
  const code = roomOf(req, res); if (!code) return;
  const u = userOf(req);
  touchPresence(code, u.name, u.color);
  const st = getRoom(code);
  const r = validRange(code, req.body && req.body.start, req.body && req.body.end);
  const text = String((req.body && req.body.text) || '').trim().slice(0, MAX_NOTE_LEN);
  if (!r || !text) return res.status(400).json({ ok: false, error: 'bad-note' });
  const rec = { id: 'n' + (st.seq++), name: u.name, color: u.color,
    start: r.start, end: r.end, quote: passageText(code, r.start, r.end).slice(0, 140),
    text, ts: Date.now(),
    code: genNoteCode(new Set(st.notes.map((n) => n.code).filter(Boolean))) };
  st.notes.push(rec);
  save();
  res.json({ ok: true, note: rec });
});
/* Borrar marca propia */
app.post('/api/rooms/:room/del', (req, res) => {
  const code = roomOf(req, res); if (!code) return;
  const u = userOf(req);
  touchPresence(code, u.name, u.color);
  const st = getRoom(code);
  const kind = req.body && req.body.kind;
  const id = req.body && req.body.id;
  const list = kind === 'highlight' ? st.highlights : kind === 'note' ? st.notes : null;
  if (!list) return res.status(400).json({ ok: false });
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return res.status(404).json({ ok: false });
  if (list[i].name !== u.name) return res.status(403).json({ ok: false, error: 'not-owner' });
  list.splice(i, 1);
  save();
  res.json({ ok: true });
});

/* --------------------------- verificaciones -------------------------------
 * Las 9 verificaciones de TintaJunta. Los creadores acumulan verificaciones
 * en su perfil; el admin (Alejandro) aprueba lo que requiere revisión.
 * En el prototipo los códigos de email/teléfono se muestran en pantalla;
 * en la versión real se envían por email/SMS. */
const CREATORS_FILE = path.join(DATA_DIR, 'creators.json');
const creators = new Map(); // nombre -> perfil de verificaciones
const ADMIN_NAME = 'Lenyn Escobar';
const isAdmin = (n) => String(n || '').trim() === ADMIN_NAME;

function getCreator(name) {
  const n = String(name || '').trim().slice(0, 60);
  if (!n) return null;
  if (!creators.has(n)) {
    creators.set(n, { name: n, verified: false,
      identity: { status: 'none' },           // none|pending|approved|rejected
      email: '', emailVerified: false, emailCode: '',
      phone: '', phoneVerified: false, phoneCode: '',
      bank: null, bankVerified: false,        // { bank, routing, last4 }
      tax: null, taxDone: false,              // { legalName, address, ssn4 }
      /* v69 — perfil público estilo knowledge panel */
      bio: '',                                // bio corta (160)
      photo: '',                              // URL de la foto (/img/creators/…)
      location: '',                           // ubicación
      website: '',                            // sitio web oficial
      socials: { instagram: '', x: '', youtube: '', tiktok: '', facebook: '' },
      about: '',                              // bio extendida (1000)
      since: 0,                               // timestamp de primera publicación
      googleSub: '' });                       // cuenta Google vinculada (dueño del perfil)
  }
  return creators.get(n);
}
function saveCreators() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CREATORS_FILE, JSON.stringify([...creators.values()]));
  } catch (e) { console.error('[tintajunta] error guardando creadores:', e.message); }
}
function loadCreators() {
  try {
    const raw = fs.readFileSync(CREATORS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const c of parsed) if (c && c.name) creators.set(c.name, Object.assign(getCreator(c.name), c));
      console.log(`[tintajunta] creadores cargados: ${creators.size}`);
    }
  } catch { /* empezar vacío */ }
}
loadCreators();
function genCode() { return String(Math.floor(100000 + Math.random() * 900000)); } // 6 dígitos
/* Perfil público de verificaciones (sin datos sensibles) */
function creatorPublic(name) {
  const c = getCreator(name);
  if (!c) return { name, verified: false };
  return { name: c.name, verified: !!c.verified,
    identity: c.identity.status, emailVerified: !!c.emailVerified,
    phoneVerified: !!c.phoneVerified, bankVerified: !!c.bankVerified, taxDone: !!c.taxDone };
}
/* Anti-plagio básico: % de fragmentos (5 palabras) del texto nuevo que ya
 * existen en otros libros. >70% => bloqueado. */
function originalityCheck(text) {
  const words = String(text || '').toLowerCase().replace(/[^a-záéíóúñü\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
  if (words.length < 20) return { ok: true, score: 0 }; // muy corto: no se puede juzgar
  const shingles = new Set();
  for (let i = 0; i + 5 <= words.length; i++) shingles.add(words.slice(i, i + 5).join(' '));
  if (!shingles.size) return { ok: true, score: 0 };
  const corpus = new Set();
  for (const b of books.values()) {
    for (const ch of (b.chapters || [])) {
      const w = String((ch.paragraphs || []).join(' ')).toLowerCase().replace(/[^a-záéíóúñü\s]/g, ' ').split(/\s+/).filter((x) => x.length > 2);
      for (let i = 0; i + 5 <= w.length; i++) corpus.add(w.slice(i, i + 5).join(' '));
    }
  }
  let hit = 0;
  for (const s of shingles) if (corpus.has(s)) hit++;
  const score = Math.round((hit / shingles.size) * 100);
  return { ok: score <= 70, score };
}
const AGE_RATINGS = ['all', '13', '18'];
function ageLabel(a) { return a === '18' ? '+18' : a === '13' ? '+13' : 'Todos'; }

/* Perfil de verificaciones de un creador */
app.get('/api/creators/:name/verification', (req, res) => {
  const c = getCreator(req.params.name);
  if (!c) return res.status(400).json({ ok: false });
  const own = String((req.query.as || '')).trim() === c.name;
  res.json({ ok: true, profile: Object.assign(creatorPublic(c.name), own ? {
    email: c.email, phone: c.phone,
    bank: c.bank ? { bank: c.bank.bank, routing: c.bank.routing, last4: c.bank.last4 } : null,
    tax: c.tax, identity: c.identity,
  } : {}) });
});
/* Admin: marcar/desmarcar creador verificado ✔️ */
app.post('/api/admin/creator/verify', (req, res) => {
  const admin = String((req.body && req.body.admin) || '');
  if (!isAdmin(admin)) return res.status(403).json({ ok: false, error: 'not-admin' });
  const c = getCreator(req.body && req.body.name);
  if (!c) return res.status(400).json({ ok: false });
  c.verified = !!(req.body && req.body.verified);
  saveCreators();
  res.json({ ok: true, verified: c.verified });
});
/* Creador: enviar identidad (queda pendiente) */
app.post('/api/creators/:name/identity', (req, res) => {
  const c = getCreator(req.params.name);
  if (!c) return res.status(400).json({ ok: false });
  const fullName = String((req.body && req.body.fullName) || '').trim().slice(0, 80);
  const docId = String((req.body && req.body.docId) || '').trim().slice(0, 40);
  if (!fullName || !docId) return res.status(400).json({ ok: false, error: 'bad-identity' });
  c.identity = { status: 'pending', fullName, docId, ts: Date.now() };
  saveCreators();
  res.json({ ok: true, status: 'pending' });
});
/* Admin: aprobar/rechazar identidad */
app.post('/api/admin/identity/review', (req, res) => {
  const admin = String((req.body && req.body.admin) || '');
  if (!isAdmin(admin)) return res.status(403).json({ ok: false, error: 'not-admin' });
  const c = getCreator(req.body && req.body.name);
  if (!c || c.identity.status !== 'pending') return res.status(400).json({ ok: false });
  c.identity.status = (req.body && req.body.approved) ? 'approved' : 'rejected';
  saveCreators();
  res.json({ ok: true, status: c.identity.status });
});
/* Email: pedir código (prototipo: se muestra en pantalla) */
app.post('/api/creators/:name/email', (req, res) => {
  const c = getCreator(req.params.name);
  if (!c) return res.status(400).json({ ok: false });
  const email = String((req.body && req.body.email) || '').trim().slice(0, 80);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ ok: false, error: 'bad-email' });
  c.email = email; c.emailVerified = false; c.emailCode = genCode();
  saveCreators();
  res.json({ ok: true, code: c.emailCode }); // prototipo: el código se muestra en pantalla
});
app.post('/api/creators/:name/email/verify', (req, res) => {
  const c = getCreator(req.params.name);
  if (!c || !c.emailCode) return res.status(400).json({ ok: false });
  if (String((req.body && req.body.code) || '').trim() !== c.emailCode)
    return res.status(400).json({ ok: false, error: 'bad-code' });
  c.emailVerified = true; c.emailCode = '';
  saveCreators();
  res.json({ ok: true });
});
/* Teléfono: igual que email */
app.post('/api/creators/:name/phone', (req, res) => {
  const c = getCreator(req.params.name);
  if (!c) return res.status(400).json({ ok: false });
  const phone = String((req.body && req.body.phone) || '').replace(/[^0-9+]/g, '').slice(0, 20);
  if (phone.replace(/[^0-9]/g, '').length < 7) return res.status(400).json({ ok: false, error: 'bad-phone' });
  c.phone = phone; c.phoneVerified = false; c.phoneCode = genCode();
  saveCreators();
  res.json({ ok: true, code: c.phoneCode }); // prototipo: el código se muestra en pantalla
});
app.post('/api/creators/:name/phone/verify', (req, res) => {
  const c = getCreator(req.params.name);
  if (!c || !c.phoneCode) return res.status(400).json({ ok: false });
  if (String((req.body && req.body.code) || '').trim() !== c.phoneCode)
    return res.status(400).json({ ok: false, error: 'bad-code' });
  c.phoneVerified = true; c.phoneCode = '';
  saveCreators();
  res.json({ ok: true });
});
/* Banco: el creador envía datos, el admin verifica */
app.post('/api/creators/:name/bank', (req, res) => {
  const c = getCreator(req.params.name);
  if (!c) return res.status(400).json({ ok: false });
  const bank = String((req.body && req.body.bank) || '').trim().slice(0, 60);
  const routing = String((req.body && req.body.routing) || '').replace(/[^0-9]/g, '').slice(0, 20);
  const account = String((req.body && req.body.account) || '').replace(/[^0-9]/g, '').slice(0, 30);
  if (!bank || routing.length < 4 || account.length < 4) return res.status(400).json({ ok: false, error: 'bad-bank' });
  c.bank = { bank, routing, last4: account.slice(-4) }; c.bankVerified = false;
  saveCreators();
  res.json({ ok: true, status: 'pending' });
});
app.post('/api/admin/bank/verify', (req, res) => {
  const admin = String((req.body && req.body.admin) || '');
  if (!isAdmin(admin)) return res.status(403).json({ ok: false, error: 'not-admin' });
  const c = getCreator(req.body && req.body.name);
  if (!c || !c.bank) return res.status(400).json({ ok: false });
  c.bankVerified = !!(req.body && req.body.verified);
  saveCreators();
  res.json({ ok: true, bankVerified: c.bankVerified });
});
/* Datos fiscales */
app.post('/api/creators/:name/tax', (req, res) => {
  const c = getCreator(req.params.name);
  if (!c) return res.status(400).json({ ok: false });
  const legalName = String((req.body && req.body.legalName) || '').trim().slice(0, 80);
  const address = String((req.body && req.body.address) || '').trim().slice(0, 120);
  const ssn4 = String((req.body && req.body.ssn4) || '').replace(/[^0-9]/g, '').slice(0, 4);
  if (!legalName || !address || ssn4.length !== 4) return res.status(400).json({ ok: false, error: 'bad-tax' });
  c.tax = { legalName, address, ssn4 }; c.taxDone = true;
  saveCreators();
  res.json({ ok: true });
});
/* Admin: bandeja de revisión (libros + identidades + bancos pendientes) */
app.get('/api/admin/pending', (req, res) => {
  const admin = String(req.query.admin || '');
  if (!isAdmin(admin)) return res.status(403).json({ ok: false, error: 'not-admin' });
  const pendingBooks = [...books.values()].filter((b) => b.status === 'pending')
    .map((b) => ({ id: b.id, title: b.title, author: b.author, price: b.price, ageRating: b.ageRating || 'all', createdAt: b.createdAt }));
  const pendingIdentity = [...creators.values()].filter((c) => c.identity && c.identity.status === 'pending')
    .map((c) => ({ name: c.name, fullName: c.identity.fullName, docId: c.identity.docId }));
  const pendingBank = [...creators.values()].filter((c) => c.bank && !c.bankVerified)
    .map((c) => ({ name: c.name, bank: c.bank.bank, routing: c.bank.routing, last4: c.bank.last4 }));
  const pendingFeedback = feedback.filter((f) => f.status === 'nuevo').length;
  res.json({ ok: true, pendingBooks, pendingIdentity, pendingBank, pendingFeedback });
});
/* Admin: aprobar/rechazar libro */
app.post('/api/admin/books/:id/review', (req, res) => {
  const admin = String((req.body && req.body.admin) || '');
  if (!isAdmin(admin)) return res.status(403).json({ ok: false, error: 'not-admin' });
  const b = books.get(String(req.params.id || '').toUpperCase());
  if (!b || b.status !== 'pending') return res.status(400).json({ ok: false });
  b.status = (req.body && req.body.approved) ? 'approved' : 'rejected';
  saveBooks();
  res.json({ ok: true, status: b.status });
});

const server = app.listen(PORT, () => {
  const commit = (process.env.RAILWAY_GIT_COMMIT_SHA || 'local').slice(0, 7);
  console.log(`[tintajunta] TintaJunta v${APP_VERSION} (commit ${commit}) en http://localhost:${PORT}`);
  console.log(`[tintajunta] entorno: ${process.env.RAILWAY_ENVIRONMENT || 'development'} · rama: ${process.env.RAILWAY_GIT_BRANCH || 'master'} · node ${process.version}`);
  // Diagnóstico de integraciones: avisa CLARO si falta una clave (sin mostrar valores).
  if (stripePay.isEnabled()) {
    console.log('[tintajunta] ✓ Stripe configurado (pagos activos)');
  } else {
    console.warn('[tintajunta] ⚠️  STRIPE_SECRET_KEY no configurada: los PAGOS están DESHABILITADOS (endpoints devuelven stripe-disabled)');
  }
  if (authGoogle.isConfigured()) {
    console.log('[tintajunta] ✓ Login con Google configurado');
  } else {
    console.warn('[tintajunta] ⚠️  GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET no configurados: el LOGIN con Google está DESHABILITADO');
  }
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'tintajunta-dev-secret-cambiar-en-prod') {
    console.warn('[tintajunta] ⚠️  SESSION_SECRET no configurado: usando secreto de desarrollo (cámbialo en producción)');
  }
});
// Las conexiones del túnel quedan abiertas y en espera: que el servidor HTTP
// no las cierre por inactividad (prototipo tras túnel).
server.headersTimeout = 0;
server.requestTimeout = 0;
server.keepAliveTimeout = 0;
