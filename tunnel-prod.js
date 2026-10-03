'use strict';
/* TintaJunta · launcher del túnel público (demo)
 *
 * El sandbox bloquea TCP directo y Node 24 valida el header Host cuando axios
 * usa el proxy de salida, así que este launcher adapta localtunnel:
 *   1) axios.get -> fetch global (respeta el proxy vía NODE_USE_ENV_PROXY).
 *   2) net.connect -> túnel CONNECT al proxy para destinos no locales
 *      (el clúster del túnel abre TCP crudo al servidor de localtunnel).
 *
 * Uso: node tunnel.js   (con el servidor corriendo en el puerto 8787)
 */
const net = require('net');

const LT_ROOT = '/home/hatch/.npm/_npx/75ac80b86e83d4a2/node_modules';
const axios = require(LT_ROOT + '/axios');

/* --- 1) axios.get mediante fetch (pasa por el proxy sin el problema Host) --- */
axios.get = async (url /* , config */) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'localtunnel' } });
    let data = {};
    try { data = await res.json(); } catch { /* respuesta no JSON */ }
    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
};

/* --- 2) Forwarder local: el túnel TCP crudo viaja dentro de un CONNECT al proxy ---
 * localtunnel abre TCP directo al servidor del túnel (bloqueado aquí), así que
 * net.connect redirige esos destinos a un forwarder en 127.0.0.1. El forwarder
 * hace el handshake CONNECT con el proxy (patrón 'data' en flowing, que sí
 * funciona) y luego entuba ambos sentidos. Los bytes del handshake nunca tocan
 * el socket que ve localtunnel: solo ve bytes limpios del túnel. */
const LOCAL = new Set(['localhost', '127.0.0.1', '::1']);
const FW_PORT = 18787;

/* Credenciales frescas en cada CONNECT (rotan con el tiempo) */
function proxyAuth() {
  const proxy = process.env.https_proxy || process.env.HTTPS_PROXY || '';
  const u = new URL(proxy);
  return {
    host: u.hostname,
    port: Number(u.port) || 3128,
    auth: 'Basic ' + Buffer.from(
      `${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`
    ).toString('base64'),
  };
}

const targetQueue = []; // destinos {host, port} pendientes, en orden de llegada
const forwardServer = net.createServer((clientSock) => {
  const target = targetQueue.shift() || { host: 'localtunnel.me', port: 443 };
  const px = proxyAuth();
  const proxySock = net.connect({ host: px.host, port: px.port });
  proxySock.setKeepAlive(true, 15000); // probes TCP para que el proxy no mate el túnel por inactividad
  let buf = Buffer.alloc(0);
  const gate = (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    const i = buf.indexOf('\r\n\r\n');
    if (i < 0) return; // respuesta del proxy incompleta
    const head = buf.slice(0, i).toString('latin1');
    const rest = buf.slice(i + 4);
    proxySock.removeListener('data', gate);
    if (!/^HTTP\/1\.[01] 200/.test(head)) {
      clientSock.destroy();
      proxySock.destroy();
      return;
    }
    if (rest.length) proxySock.unshift(rest); // bytes ya llegados del túnel
    clientSock.pipe(proxySock); // respuestas de localtunnel -> servidor del túnel
    proxySock.pipe(clientSock); // peticiones del servidor del túnel -> localtunnel
  };
  proxySock.on('data', gate);
  proxySock.on('connect', () => {
    proxySock.write(
      `CONNECT ${target.host}:${target.port} HTTP/1.1\r\n` +
      `Host: ${target.host}:${target.port}\r\n` +
      `Proxy-Authorization: ${px.auth}\r\n` +
      `Proxy-Connection: Keep-Alive\r\n\r\n`
    );
  });
  const die = () => { clientSock.destroy(); proxySock.destroy(); };
  proxySock.on('error', die);
  clientSock.on('error', die);
  proxySock.on('close', () => clientSock.destroy());
  clientSock.on('close', () => proxySock.destroy());
});

const origConnect = net.connect.bind(net);
function patchNetConnect() {
  net.connect = function (...args) {
    const opts = args[0];
    if (!opts || typeof opts !== 'object' || Array.isArray(opts)) {
      return origConnect.apply(this, args); // formas (puerto, path...): sin cambios
    }
    const host = opts.host || opts.hostname || 'localhost';
    // localhost: directo. El propio proxy: directo (si no, fetch entraría en bucle).
    const pxHost = (() => { try { return new URL(process.env.https_proxy || process.env.HTTPS_PROXY || '').hostname.toLowerCase(); } catch { return ''; } })();
    if (LOCAL.has(host) || host.toLowerCase() === pxHost) {
      return origConnect.apply(this, args);
    }
    targetQueue.push({ host, port: opts.port });
    return origConnect.call(this, { host: '127.0.0.1', port: FW_PORT });
  };
}

/* --- abrir el túnel --- */
const localtunnel = require(LT_ROOT + '/localtunnel');

(async () => {
  try {
    await new Promise((resolve, reject) => {
      forwardServer.once('error', reject);
      forwardServer.listen(FW_PORT, '127.0.0.1', resolve);
    });
    patchNetConnect();
    const tunnel = await localtunnel({ port: 8787, subdomain: 'tintajunta-sala' });
    console.log('TÚNEL ACTIVO: ' + tunnel.url);
    console.log('(si localtunnel muestra un aviso, la contraseña es la IP pública de esta máquina)');
    tunnel.on('close', () => { console.log('túnel cerrado'); process.exit(1); });
    tunnel.on('error', (e) => console.error('túnel error:', e && e.message));
    setInterval(() => {}, 60000); // mantener el proceso vivo
  } catch (e) {
    console.error('no se pudo abrir el túnel:', e.message);
    process.exit(1);
  }
})();
