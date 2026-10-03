'use strict';
/* Mini forward-proxy local: recibe CONNECT sin auth de Chromium y lo reenvía
 * al proxy de salida del sandbox agregando Proxy-Authorization.
 * Uso: node authproxy.js  (escucha en 127.0.0.1:9999) */
const net = require('net');

function proxyAuth() {
  const u = new URL(process.env.https_proxy || process.env.HTTPS_PROXY);
  return {
    host: u.hostname, port: Number(u.port) || 3128,
    auth: 'Basic ' + Buffer.from(
      `${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`
    ).toString('base64'),
  };
}

const server = net.createServer((client) => {
  let buf = Buffer.alloc(0);
  const onData = (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    const i = buf.indexOf('\r\n\r\n');
    if (i < 0) return;
    client.removeListener('data', onData);
    const head = buf.slice(0, i).toString('latin1');
    const m = head.match(/^(CONNECT|GET|POST|HEAD)\s+(\S+)\s+HTTP\/1\.[01]/);
    if (!m) { client.destroy(); return; }
    const [, method, target] = m;
    const px = proxyAuth();
    const up = net.connect({ host: px.host, port: px.port });
    const done = () => { client.destroy(); up.destroy(); };
    up.on('error', done); client.on('error', done);
    up.on('connect', () => {
      // Reenvía la petición tal cual + auth (quita Proxy-Authorization previo si lo hubiera)
      const lines = head.split('\r\n').filter((l) => !/^proxy-authorization:/i.test(l));
      const outHead = lines.join('\r\n') + `\r\nProxy-Authorization: ${px.auth}\r\n\r\n`;
      up.write(outHead);
      const rest = buf.slice(i + 4);
      if (rest.length) up.write(rest);
      client.pipe(up);
      up.pipe(client);
    });
    up.on('close', () => client.destroy());
    client.on('close', () => up.destroy());
  };
  client.on('data', onData);
  client.on('error', () => {});
});

server.listen(9999, '127.0.0.1', () => console.log('auth-proxy en 127.0.0.1:9999'));
