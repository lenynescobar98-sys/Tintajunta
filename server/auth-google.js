'use strict';
/* ============================================================================
 * TintaJunta · Preparación Login con Google (NO ACTIVO en el prototipo)
 *
 * Este archivo deja lista la estructura para "Entrar con Google" con OAuth 2.0.
 * Hoy NO hace nada real: si las credenciales no están configuradas, cada
 * función lanza un Error('google-auth-no-configurado') en vez de llamar a
 * Google. El prototipo sigue SIN login (los visitantes entran solo con nombre).
 *
 * MODELO DE AUTH DE TINTAJUNTA (regla permanente 2026-10-03):
 *   - NECESITAN login con Google: quien CREA una sala, los CREADORES que
 *     publican libros, y los LECTORES de biblioteca que marcan libros.
 *   - NO necesitan login: los ALUMNOS que entran a una sala en vivo — solo
 *     escriben su nombre (sin fricción, sin cuenta).
 *   Ver loginRequiredFor() más abajo: codifica esta regla en un solo lugar.
 *
 * PARA ACTIVAR EN LA VERSIÓN REAL (checklist):
 *  1. Alejandro crea el proyecto y las credenciales en Google Cloud Console
 *     (paso a paso en GOOGLE-OAUTH-SETUP.md) y obtiene:
 *       - GOOGLE_CLIENT_ID     (....apps.googleusercontent.com)
 *       - GOOGLE_CLIENT_SECRET (GOCSPX-... — SOLO en el servidor, nunca en el cliente)
 *  2. Guardarlas como variables de entorno en el hosting (NO en el código):
 *       GOOGLE_CLIENT_ID=....apps.googleusercontent.com
 *       GOOGLE_CLIENT_SECRET=GOCSPX-...
 *       GOOGLE_REDIRECT_URI=https://tintajunta.com/api/auth/google/callback
 *  3. npm install google-auth-library   (ya está en package.json, solo instalar)
 *  4. En server.js, montar las rutas (ejemplo comentado al final de este archivo):
 *       GET  /api/auth/google          -> redirige a getAuthUrl()
 *       GET  /api/auth/google/callback -> handleCallback() + crear sesión
 *       GET  /api/auth/me              -> devuelve el usuario de la sesión
 *       POST /api/auth/logout          -> cierra sesión
 *  5. Proteger en server.js los endpoints que requieren login usando
 *     requireLogin() de este módulo:
 *       - crear sala, publicar libro, destacar, anunciar, comprar
 *       - marcar libros en la BIBLIOTECA (no en la sala en vivo de alumnos)
 *     La sala en vivo de alumnos (join con solo nombre) NO se protege.
 * ========================================================================== */

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI || 'https://tintajunta.com/api/auth/google/callback';

// Scopes mínimos: identidad básica. NO pedimos más permisos de los necesarios.
const SCOPES = ['openid', 'email', 'profile'];

function isConfigured() {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

function requireConfigured() {
  if (!isConfigured()) {
    throw new Error('google-auth-no-configurado: faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET');
  }
}

// Lazy require: el módulo carga aunque google-auth-library no esté instalada
// (el prototipo no la instala). Solo falla al USAR las funciones sin configurar.
function oauth2Client() {
  requireConfigured();
  const { OAuth2Client } = require('google-auth-library');
  return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

/**
 * getAuthUrl(state) -> string
 * URL de consentimiento de Google. `state` es un token anti-CSRF que el
 * servidor genera por sesión y valida en el callback.
 */
function getAuthUrl(state) {
  const client = oauth2Client();
  return client.generateAuthUrl({
    access_type: 'offline', // para refresh_token (opcional; puede ser 'online')
    prompt: 'select_account', // deja elegir cuenta si tiene varias
    scope: SCOPES,
    state: String(state || ''),
  });
}

/**
 * handleCallback(code) -> Promise<{ tokens, profile }>
 * Intercambia el `code` que Google devuelve en /callback por tokens y
 * devuelve el perfil verificado. Lanza si el code es inválido.
 */
async function handleCallback(code) {
  const client = oauth2Client();
  if (!code) throw new Error('google-auth: falta el parámetro code');
  const { tokens } = await client.getToken(String(code));
  if (!tokens || !tokens.id_token) throw new Error('google-auth: Google no devolvió id_token');
  const profile = await verifyIdToken(tokens.id_token);
  return { tokens, profile };
}

/**
 * verifyIdToken(idToken) -> Promise<{ sub, email, name, picture }>
 * Verifica la firma del id_token contra las claves de Google y que fue
 * emitido para NUESTRO client_id (anti-spoofing). `sub` es el ID único
 * e inmutable del usuario en Google: úsalo como clave del usuario en la BD.
 */
async function verifyIdToken(idToken) {
  const client = oauth2Client();
  const ticket = await client.verifyIdToken({
    idToken: String(idToken),
    audience: GOOGLE_CLIENT_ID,
  });
  const p = ticket.getPayload() || {};
  if (!p.sub) throw new Error('google-auth: id_token sin sub');
  return {
    sub: String(p.sub),
    email: String(p.email || ''),
    emailVerified: Boolean(p.email_verified),
    name: String(p.name || ''),
    picture: String(p.picture || ''),
  };
}

/**
 * loginRequiredFor(action) -> boolean
 * Codifica la regla permanente de TintaJunta en un solo lugar.
 * Acciones: 'create-room' | 'publish-book' | 'feature-book' | 'place-ad' |
 *           'buy-book' | 'library-mark'  -> true  (necesitan login)
 *           'join-room'                   -> false (alumno: solo su nombre)
 */
function loginRequiredFor(action) {
  switch (action) {
    case 'create-room':
    case 'publish-book':
    case 'feature-book':
    case 'place-ad':
    case 'buy-book':
    case 'library-mark':
      return true;
    case 'join-room':
      return false;
    default:
      return true; // ante la duda, pedir login
  }
}

/**
 * requireLogin() -> middleware Express
 * Uso en server.js (versión real):
 *   const { requireLogin } = require('./server/auth-google');
 *   app.post('/api/books', requireLogin(), (req, res) => { ... });
 * Lee req.session.user (la sesión la crea el callback después de verificar).
 */
function requireLogin() {
  return (req, res, next) => {
    if (req.session && req.session.user && req.session.user.sub) return next();
    return res.status(401).json({ ok: false, error: 'login-requerido' });
  };
}

module.exports = {
  SCOPES,
  GOOGLE_REDIRECT_URI,
  isConfigured,
  getAuthUrl,
  handleCallback,
  verifyIdToken,
  loginRequiredFor,
  requireLogin,
};

/* ----------------------------------------------------------------------------
 * EJEMPLO DE RUTAS PARA server.js (versión real — NO activar en prototipo)
 *
 * const session = require('express-session'); // npm install express-session
 * const authGoogle = require('./server/auth-google');
 * const crypto = require('crypto');
 *
 * app.use(session({
 *   secret: process.env.SESSION_SECRET, // generar uno largo y aleatorio
 *   resave: false, saveUninitialized: false,
 *   cookie: { secure: true, httpOnly: true, sameSite: 'lax', maxAge: 30*24*3600e3 },
 * }));
 *
 * // 1. Iniciar login: genera state anti-CSRF y redirige a Google
 * app.get('/api/auth/google', (req, res) => {
 *   const state = crypto.randomBytes(16).toString('hex');
 *   req.session.oauthState = state;
 *   res.redirect(authGoogle.getAuthUrl(state));
 * });
 *
 * // 2. Callback: Google devuelve ?code=...&state=...
 * app.get('/api/auth/google/callback', async (req, res) => {
 *   try {
 *     if (!req.query.state || req.query.state !== req.session.oauthState)
 *       return res.status(403).send('state inválido (CSRF)');
 *     delete req.session.oauthState;
 *     const { profile } = await authGoogle.handleCallback(req.query.code);
 *     // TODO: buscar/crear usuario en BD por profile.sub; guardar rol
 *     // (creador / lector). El rol "alumno de sala" no necesita login.
 *     req.session.user = { sub: profile.sub, email: profile.email,
 *                          name: profile.name, picture: profile.picture };
 *     res.redirect('/'); // o a la página que corresponda
 *   } catch (e) { res.status(500).send('Error de login con Google'); }
 * });
 *
 * app.get('/api/auth/me', (req, res) => {
 *   res.json({ ok: true, user: (req.session && req.session.user) || null });
 * });
 * app.post('/api/auth/logout', (req, res) => {
 *   req.session.destroy(() => res.json({ ok: true }));
 * });
 * -------------------------------------------------------------------------- */
