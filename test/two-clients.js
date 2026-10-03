/* Prueba de extremo a extremo del prototipo TintaJunta.
 * Simula dos clientes simultáneos (Lucía y Diego): entran a la sala,
 * subrayan, dejan notas, borran, y verifica que ambos vean los cambios
 * del otro en vivo, además de la persistencia en data/room.json.
 *
 * Uso: el servidor debe estar corriendo (npm start). Luego: npm test
 */
'use strict';

const { io } = require('socket.io-client');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8787;
const URL = `http://localhost:${PORT}`;
const DATA_FILE = path.join(__dirname, '..', 'data', 'room.json');

let failures = 0;
function check(label, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}`);
  if (!cond) failures++;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function join(client, name, color) {
  return new Promise((resolve) => {
    client.once('state', (s) => resolve(s));
    client.emit('join', { name, color });
  });
}

(async () => {
  // Empezar con sala limpia para una prueba determinista
  try { fs.unlinkSync(DATA_FILE); } catch { /* no existía */ }

  const a = io(URL);
  const b = io(URL);
  await new Promise((res) => a.on('connect', res));
  await new Promise((res) => b.on('connect', res));
  check('ambos clientes conectan por WebSocket', a.connected && b.connected);

  const evA = [], evB = [];
  for (const [c, ev] of [[a, evA], [b, evB]]) {
    c.on('highlight:new', (d) => ev.push(['highlight:new', d]));
    c.on('note:new', (d) => ev.push(['note:new', d]));
    c.on('highlight:del', (d) => ev.push(['highlight:del', d]));
    c.on('roster', (d) => ev.push(['roster', d]));
  }

  const sA = await join(a, 'Lucía', 'azul');
  check('Lucía recibe estado inicial', sA && Array.isArray(sA.highlights) && sA.highlights.length === 0);
  const sB = await join(b, 'Diego', 'rojo');
  check('Diego recibe estado inicial', sB && Array.isArray(sB.notes) && sB.notes.length === 0);

  await wait(400);
  const lastRosterA = evA.filter((e) => e[0] === 'roster').pop();
  check('presencia: la sala muestra 2 personas', lastRosterA && lastRosterA[1].length === 2);
  check('presencia: colores correctos',
    lastRosterA && lastRosterA[1].some((p) => p.name === 'Lucía' && p.color === 'azul') &&
    lastRosterA[1].some((p) => p.name === 'Diego' && p.color === 'rojo'));

  // Lucía subraya "En un lugar de la" (palabras 0-4)
  const ackH = await new Promise((res) => a.emit('highlight', { start: 0, end: 4 }, res));
  check('subrayado aceptado por el servidor', ackH && ackH.ok && !!ackH.id);
  await wait(400);
  const hA = evA.filter((e) => e[0] === 'highlight:new').pop();
  const hB = evB.filter((e) => e[0] === 'highlight:new').pop();
  check('Lucía ve su propio subrayado en vivo', !!hA);
  check('Diego ve el subrayado de Lucía EN VIVO', !!hB && hB[1].id === hA[1].id);
  check('subrayado con autor y color correctos', hB && hB[1].name === 'Lucía' && hB[1].color === 'azul');
  check('subrayado cubre el pasaje esperado', hB && hB[1].text === 'En un lugar de la');

  // Diego deja una nota al margen
  const ackN = await new Promise((res) =>
    b.emit('note', { start: 10, end: 12, text: '¡Qué comienzo tan memorable!' }, res));
  check('nota aceptada por el servidor', ackN && ackN.ok && !!ackN.id);
  await wait(400);
  const nA = evA.filter((e) => e[0] === 'note:new').pop();
  const nB = evB.filter((e) => e[0] === 'note:new').pop();
  check('Diego ve su propia nota en vivo', !!nB);
  check('Lucía ve la nota de Diego EN VIVO', !!nA && nA[1].id === nB[1].id);
  check('nota con texto y autor correctos',
    nA && nA[1].text === '¡Qué comienzo tan memorable!' && nA[1].name === 'Diego');

  // Validación: rango inválido se rechaza
  const ackBad = await new Promise((res) => a.emit('highlight', { start: 99999, end: 100000 }, res));
  check('rango fuera del texto se rechaza', ackBad && ackBad.ok === false);

  // Lucía borra su subrayado; Diego lo ve desaparecer
  const ackD = await new Promise((res) => a.emit('del', { kind: 'highlight', id: ackH.id }, res));
  check('borrado propio aceptado', ackD && ackD.ok);
  await wait(400);
  const dB = evB.filter((e) => e[0] === 'highlight:del').pop();
  check('Diego ve desaparecer el subrayado en vivo', !!dB && dB[1].id === ackH.id);

  // Diego intenta borrar la nota... es suya, pero probemos propiedad cruzada:
  // Lucía intenta borrar la nota de Diego -> debe fallar
  const ackX = await new Promise((res) => a.emit('del', { kind: 'note', id: ackN.id }, res));
  check('no se puede borrar la nota de otro', ackX && ackX.ok === false);

  // Persistencia en disco
  await wait(600); // dar tiempo al guardado diferido
  let persisted = null;
  try { persisted = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { /* no */ }
  check('estado persistido en data/room.json',
    !!persisted && persisted.notes.some((n) => n.id === ackN.id) &&
    !persisted.highlights.some((h) => h.id === ackH.id));

  a.disconnect();
  b.disconnect();
  await wait(300);

  console.log(failures === 0 ? '\nTODAS LAS PRUEBAS PASARON' : `\n${failures} PRUEBA(S) FALLARON`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error('ERROR en la prueba:', e); process.exit(1); });
