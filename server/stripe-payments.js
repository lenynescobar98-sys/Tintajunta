/* TintaJunta · Pagos reales con Stripe (modo TEST)
 *
 * Lee STRIPE_SECRET_KEY del entorno. Si no hay clave, los pagos quedan
 * deshabilitados (los endpoints devuelven { ok:false, error:'stripe-disabled' })
 * en vez de simular un cobro.
 *
 * REGLA DE ORO: la secret key jamás va al cliente, a git, ni a logs.
 */
'use strict';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

let stripe = null;
function getStripe() {
  if (stripe) return stripe;
  if (!STRIPE_SECRET_KEY) return null;
  const opts = {};
  // La VM usa proxy: el SDK de Stripe necesita el agente explícito
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || '';
  if (proxyUrl) {
    try {
      const { HttpsProxyAgent } = require('https-proxy-agent');
      opts.httpAgent = new HttpsProxyAgent(proxyUrl);
    } catch (e) { /* sin proxy */ }
  }
  stripe = require('stripe')(STRIPE_SECRET_KEY, opts);
  return stripe;
}
const isEnabled = () => !!STRIPE_SECRET_KEY;

/* Crea un PaymentIntent real. Devuelve { ok, clientSecret, id } */
async function createPaymentIntent(amount, currency = 'usd', description = '', metadata = {}) {
  const s = getStripe();
  if (!s) return { ok: false, error: 'stripe-disabled' };
  const pi = await s.paymentIntents.create({
    amount: Math.round(amount), // centavos, entero
    currency,
    description: String(description).slice(0, 200),
    metadata,
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
  });
  return { ok: true, simulated: false, clientSecret: pi.client_secret, id: pi.id };
}

/* Verifica un PaymentIntent contra la API de Stripe (lado servidor).
 * Devuelve { ok:true, status, amount } si existe. */
async function verifyPaymentIntent(paymentIntentId) {
  const s = getStripe();
  if (!s) return { ok: false, error: 'stripe-disabled' };
  try {
    const pi = await s.paymentIntents.retrieve(String(paymentIntentId));
    return { ok: true, status: pi.status, amount: pi.amount, currency: pi.currency,
      metadata: pi.metadata || {} };
  } catch (e) {
    return { ok: false, error: 'not-found' };
  }
}

/* Verifica la firma de un webhook de Stripe. req.body debe ser el Buffer crudo. */
function verifyWebhook(req) {
  const s = getStripe();
  if (!s || !STRIPE_WEBHOOK_SECRET) return { ok: false, error: 'webhook-not-configured' };
  try {
    const sig = req.headers['stripe-signature'];
    const event = s.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    return { ok: true, event };
  } catch (e) {
    return { ok: false, error: 'bad-signature' };
  }
}

module.exports = {
  isEnabled, getStripe, createPaymentIntent, verifyPaymentIntent, verifyWebhook,
  publishableKey: STRIPE_PUBLISHABLE_KEY,
};
