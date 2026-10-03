/* TintaJunta · Preparación Stripe (NO ACTIVO en el prototipo)
 *
 * Este archivo deja lista la estructura para pagos reales con Stripe.
 * Hoy todo es SIMULADO: createPaymentIntent() devuelve { simulated: true }
 * sin llamar a ninguna API externa y sin pedir claves.
 *
 * PARA ACTIVAR EN LA VERSIÓN REAL (checklist):
 *  1. Crear cuenta en https://stripe.com y obtener:
 *     - STRIPE_SECRET_KEY  (sk_live_... — SOLO en el servidor, nunca en el cliente)
 *     - STRIPE_PUBLISHABLE_KEY (pk_live_... — esta sí va en el cliente para Stripe.js)
 *     - STRIPE_WEBHOOK_SECRET (whsec_... — para verificar webhooks)
 *  2. Guardarlas como variables de entorno en el hosting (NO en el código):
 *       STRIPE_SECRET_KEY=sk_live_...
 *  3. npm install stripe
 *  4. Reemplazar el cuerpo de createPaymentIntent() por la versión real
 *     (está comentada más abajo).
 *  5. En server.js, cambiar los endpoints simulados para que llamen a
 *     createPaymentIntent() y confirmen el pago vía webhook antes de
 *     activar la compra/destacado/anuncio:
 *       - POST /api/books/:id/feature  (destacar libro: $4.99/día, $24.99/semana)
 *       - POST /api/books/:id/buy      (comprar libro — cuando exista)
 *       - POST /api/ads                (anuncio pagado: $2.99/día, $14.99/semana)
 *  6. Crear el webhook POST /webhooks/stripe que verifica la firma con
 *     STRIPE_WEBHOOK_SECRET y solo entonces marca el pago como completado.
 *
 * REGLA DE ORO: jamás poner sk_live en el cliente, en git, ni en logs.
 */
'use strict';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || null; // ← aquí lee la clave real cuando exista

/**
 * Crea una intención de pago.
 * @param {number} amount   Monto en centavos (ej. 299 = $2.99)
 * @param {string} currency Moneda ISO (ej. 'usd')
 * @param {string} description Descripción para el recibo (ej. 'Anuncio "Lentes" — plan día')
 * @returns {Promise<{simulated:boolean, ok:boolean, ...}>}
 */
async function createPaymentIntent(amount, currency = 'usd', description = '') {
  // ── MODO PROTOTIPO: pago simulado, no se cobra nada ──
  return {
    simulated: true,
    ok: true,
    amount,
    currency,
    description,
    note: 'Prototipo: en la versión real aquí se crea el PaymentIntent con Stripe.',
  };

  /* ── MODO REAL (descomentar cuando haya claves) ──
  const Stripe = require('stripe');
  const stripe = Stripe(STRIPE_SECRET_KEY);
  const pi = await stripe.paymentIntents.create({
    amount,           // centavos
    currency,         // 'usd'
    description,      // aparece en el dashboard de Stripe
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
  });
  return { simulated: false, ok: true, clientSecret: pi.client_secret, id: pi.id };
  ─────────────────────────────────────────────────── */
}

/* Precios del prototipo (centavos), espejo de server.js — la fuente real
 * de precios siempre debe estar en el servidor, nunca confiar en el cliente. */
const PRICES = {
  featureBook: { day: 499, week: 2499 },   // destacar libro: $4.99/día, $24.99/semana
  ad:          { day: 299, week: 1499 },    // anuncio: $2.99/día, $14.99/semana
};

module.exports = { createPaymentIntent, PRICES, STRIPE_SECRET_KEY: !!STRIPE_SECRET_KEY };
