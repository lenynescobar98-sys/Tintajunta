'use strict';
/* Verificación E2E por polling HTTP a través de la URL pública.
 * Habla engine.io (long-polling) + socket.io a mano con fetch, que sí usa
 * el proxy de salida. Es la misma ruta que usaría un navegador si el
 * WebSocket no estuviera disponible.
 *
 * Uso: PUBLIC_URL=https://xxx.loca.lt node test/e2e-public-polling.js
 */
const BASE = (process.env.PUBLIC_URL || 'https://tiny-otter-33.loca.lt').replace(/\/$/, '');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (label, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}`);
  if (!cond) failures++;
};

// Decodifica paquetes engine.io (formato texto): "4<tipo>datos"
function decodePackets(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    // engine.io v4 polling usa paquetes separados; en texto plano vienen concatenados
    // Formato: <len>:<packet> o paquetes simples. Para v4 sin b64: cada paquete es "XY..."
    // Simplificación: partir por el patrón de inicio de paquete socket.io "42" / "43" / "44"
    break;
  }
  return out;
}

async function eioHandshake() {
  const r = await fetch(`${BASE}/socket.io/?EIO=4&transport=polling`);
  const text = await r.text();
  const m = text.match(/^0(\{.*\})$/s);
  if (!m) throw new Error('handshake inesperado: ' + text.slice(0, 80));
  const sid = JSON.parse(m[1]).sid;
  return sid;
}

function makeSession(sid) {
  let seq = 0;
  const session = {
    sid,
    inbox: [],
    async post(packet) {
      const r = await fetch(`${BASE}/socket.io/?EIO=4&transport=polling&sid=${sid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: packet,
      });
      if (!r.ok) throw new Error('POST falló: ' + r.status);
    },
    // long-poll: espera hasta ~25s por datos (un abort = sin datos, reintentar)
    async pollOnce(timeoutMs = 30000) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const r = await fetch(`${BASE}/socket.io/?EIO=4&transport=polling&sid=${sid}`, { signal: ctrl.signal });
        const text = await r.text();
        return parsePollBody(text);
      } catch {
        return [];
      } finally {
        clearTimeout(t);
      }
    },
  };
  return session;
}

// Hace long-poll en bucle hasta ver un evento que cumpla pred (o agotar timeout).
async function waitForEvent(session, pred, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const packets = await session.pollOnce(12000);
    for (const p of packets) {
      if (p.type === 'event' && pred(p.data)) return p;
    }
  }
  return null;
}

// Parsea cuerpo de polling: paquetes engine.io separados por \x1e (record separator).
function parsePollBody(text) {
  return text.split('').filter(Boolean).map((p) => {
    let m;
    if ((m = p.match(/^42(?:(\d+),)?(\[.*\])$/s))) {
      return { type: 'event', ackId: m[1], data: JSON.parse(m[2]) };
    }
    if ((m = p.match(/^43(\d+),(\[.*\])$/s))) {
      return { type: 'ack', ackId: m[1], data: JSON.parse(m[2]) };
    }
    if (p === '2') return { type: 'ping' };
    if (p.startsWith('40')) return { type: 'connect-ack' };
    return { type: 'other', raw: p.slice(0, 60) };
  });
}

async function main() {
  console.log('BASE:', BASE);

  // --- cliente A ---
  const sidA = await eioHandshake();
  check('A: handshake polling OK', !!sidA);
  const a = makeSession(sidA);
  await a.post('40'); // socket.io connect
  await a.post('42["join",{"name":"Alejandro","color":"azul"}]');

  // --- cliente B ---
  const sidB = await eioHandshake();
  check('B: handshake polling OK', !!sidB);
  const b = makeSession(sidB);
  await b.post('40');
  await b.post('42["join",{"name":"Invitado","color":"rojo"}]');

  // A subraya; B lo ve en vivo (poll en bucle, como hace socket.io)
  const hPromise = waitForEvent(b,
    (d) => d[0] === 'highlight:new' && d[1].name === 'Alejandro' && d[1].text === 'En un lugar de la',
    30000);
  await a.post('42["highlight",{"start":0,"end":4}]');
  const h = await hPromise;
  check('B recibe el subrayado de A en vivo (polling)', !!h);
  if (h) console.log('   ->', JSON.stringify(h.data[1].text), 'por', h.data[1].name, '[' + h.data[1].color + ']');

  // B deja una nota; A la ve en vivo
  const nPromise = waitForEvent(a,
    (d) => d[0] === 'note:new' && d[1].name === 'Invitado' && d[1].text === 'Hola desde polling',
    30000);
  await b.post('42["note",{"start":5,"end":7,"text":"Hola desde polling"}]');
  const n = await nPromise;
  check('A recibe la nota de B en vivo (polling)', !!n);
  if (n) console.log('   ->', JSON.stringify(n.data[1].text), 'por', n.data[1].name);

  console.log(failures === 0 ? 'E2E POLLING PÚBLICO: TODO OK' : 'E2E POLLING PÚBLICO: FALLÓ');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.log('ERROR:', e.message); process.exit(1); });
