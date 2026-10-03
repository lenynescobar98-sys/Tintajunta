'use strict';
/* Verificación E2E del WebSocket a través de la URL pública.
 * Habla engine.io + socket.io a mano sobre un WebSocket que sí usa el proxy
 * de salida (el cliente XHR de socket.io-client no lo usa y por eso fallaba
 * desde este sandbox; un navegador real no pasa por este proxy).
 *
 * Uso: PUBLIC_URL=https://tintajunta-demo.loca.lt node test/e2e-public-ws.js
 */
const WebSocket = require('ws');
const { HttpsProxyAgent } = require('https-proxy-agent');

const URL = process.env.PUBLIC_URL || 'https://tintajunta-demo.loca.lt';
const WS_URL = URL.replace(/^http/, 'ws') + '/socket.io/?EIO=4&transport=websocket';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (label, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}`);
  if (!cond) failures++;
};

function makeClient(name, color) {
  return new Promise((resolve, reject) => {
    const agent = new HttpsProxyAgent(process.env.https_proxy || process.env.HTTPS_PROXY);
    const ws = new WebSocket(WS_URL, { agent });
    const client = {
      ws, name, color, sid: null,
      highlights: [], notes: [], roster: [],
      sendEngine: (data) => ws.send(data),
      emit: (event, data, ack) => {
        const id = Math.floor(Math.random() * 1e9);
        client.sendEngine(`42${JSON.stringify([event, data])}`.replace('42[', `42${id},[`));
        // socket.io v5: 42<ackId>,["event",data]
        if (ack) client.pendingAcks.set(id, ack);
      },
      pendingAcks: new Map(),
      waitFor: (pred, timeout = 15000) => new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error('timeout esperando evento')), timeout);
        client.waiters.push({ pred, res: (v) => { clearTimeout(t); res(v); } });
      }),
      waiters: [],
      close: () => ws.close(),
    };
    const notify = (msg) => {
      for (let i = client.waiters.length - 1; i >= 0; i--) {
        let v;
        try { v = msg.pred(msg); } catch { v = null; }
        if (v) { client.waiters.splice(i, 1); v.res(v); }
      }
    };
    ws.on('open', () => {});
    ws.on('error', (e) => reject(new Error('ws error: ' + e.message)));
    ws.on('message', (raw) => {
      const m = raw.toString();
      if (m.startsWith('0')) { /* open packet */ }
      else if (m === '2') client.sendEngine('3'); // ping -> pong
      else if (m.startsWith('42')) {
        // 42<ackId>,["event",data] o 42["event",data]
        const mm = m.match(/^42(?:(\d+),)?(.*)$/);
        if (mm) {
          const ackId = mm[1];
          const arr = JSON.parse(mm[2]);
          const [event, data] = arr;
          if (event === 'state') { client.state = data; notify({ type: 'state', data }); }
          else if (event === 'highlight:new') { client.highlights.push(data); notify({ type: 'highlight:new', data }); }
          else if (event === 'note:new') { client.notes.push(data); notify({ type: 'note:new', data }); }
          else if (event === 'roster') { client.roster = data; notify({ type: 'roster', data }); }
          if (ackId && client.pendingAcks.has(Number(ackId))) {
            client.pendingAcks.get(Number(ackId))(data);
            client.pendingAcks.delete(Number(ackId));
          }
        }
      } else if (m.startsWith('43')) {
        // ack de servidor: 43<ackId>,[data]
        const mm = m.match(/^43(\d+),(.*)$/);
        if (mm && client.pendingAcks.has(Number(mm[1]))) {
          client.pendingAcks.get(Number(mm[1]))(JSON.parse(mm[2])[0]);
          client.pendingAcks.delete(Number(mm[1]));
        }
      }
    });
    // engine.io open -> enviar socket.io connect (paquete 40 -> '0')
    const onOpen = (raw) => {
      if (raw.toString().startsWith('0')) {
        ws.off('message', onOpen);
        client.sendEngine('40'); // socket.io connect
        // esperar el state tras join
        resolve(client);
      }
    };
    ws.on('message', onOpen);
    setTimeout(() => reject(new Error('timeout en handshake')), 20000);
  });
}

(async () => {
  console.log('WS URL:', WS_URL);
  const a = await makeClient('Alejandro', 'azul');
  check('Alejandro conecta por WebSocket público', true);
  const b = await makeClient('Invitado', 'rojo');
  check('Invitado conecta por WebSocket público', true);

  // join (sin ack para simplificar, esperar 'state')
  const stateAP = a.waitFor((m) => (m.type === 'state' ? m : null));
  a.emit('join', { name: 'Alejandro', color: 'azul' });
  const stateA = await stateAP;
  check('Alejandro recibe estado inicial', !!stateA.data);

  const stateBP = b.waitFor((m) => (m.type === 'state' ? m : null));
  b.emit('join', { name: 'Invitado', color: 'rojo' });
  const stateB = await stateBP;
  check('Invitado recibe estado inicial', !!stateB.data);
  check('presencia muestra 2 personas', stateB.data.roster.length === 2);

  // Alejandro subraya -> Invitado lo ve en vivo
  const hP = b.waitFor((m) => (m.type === 'highlight:new' ? m : null));
  a.emit('highlight', { start: 0, end: 4 });
  const h = await hP;
  check('subrayado viaja en vivo por WebSocket público',
    h.data.name === 'Alejandro' && h.data.color === 'azul' && h.data.text === 'En un lugar de la');

  // Invitado deja nota -> Alejandro la ve en vivo
  const nP = a.waitFor((m) => (m.type === 'note:new' ? m : null));
  b.emit('note', { start: 5, end: 7, text: 'Hola desde el túnel' });
  const n = await nP;
  check('nota viaja en vivo por WebSocket público',
    n.data.name === 'Invitado' && n.data.text === 'Hola desde el túnel');

  a.close(); b.close();
  await wait(500);
  console.log(failures === 0 ? 'E2E WS PÚBLICO: TODO OK' : 'E2E WS PÚBLICO: FALLÓ');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('ERROR:', e.message); process.exit(1); });
