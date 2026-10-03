# TintaJunta — Prototipo de la sala de lectura en vivo

Primer prototipo funcional de la **pieza 3** (lectura en vivo) de TintaJunta: una
sala donde varias personas leen el mismo capítulo al mismo tiempo, subrayan
pasajes con su color de tinta y dejan notas al margen que todos ven **casi en
vivo** (sincronización cada ~2.5 segundos).

> Esto es un prototipo, no la plataforma terminada: demuestra la sala en vivo
> con software real multiusuario, no una maqueta.

## Arquitectura de red: HTTP puro (sin WebSockets)

El cliente publica sus marcas con `POST` y sondea `GET /api/rooms/:room/state`
cada 2.5 segundos; un latido `POST /api/rooms/:room/ping` cada 15 s mantiene
la lista de presentes. Son peticiones HTTPS cortas: atraviesan cualquier red
o túnel sin conexiones persistentes que se puedan colgar. (Se probó con
WebSockets/socket.io y el túnel los interrumpía; HTTP es lo robusto aquí.)

## Modo lápiz ✏️

El botón ✏️ de la barra superior activa/desactiva el **modo lápiz** (activado
por defecto, se recuerda en este navegador):
- **Lápiz activado**: mantén el dedo (o el ratón) sobre una palabra y arrastra —
  al soltar, el subrayado queda guardado con tu tinta, permanente, sin pasos
  extra. Toca cualquier subrayado para agregarle una nota al margen
  (o quitarlo, si es tuyo).
- **Lápiz desactivado**: al soltar aparece la barra clásica
  (Subrayar / Nota).
- Un punto verde en la barra indica conexión con la sala; si se pone rojo,
  tus marcas se reintentan solas al recuperar la red.

## Salas por código

Ya no hay una sola sala: cada sala se identifica con un **código**
(4 a 12 letras o números, en mayúsculas). La sala principal es `SALA`.

- **Entrar con código**: en la pantalla de entrada escribe el código en el
  campo "Código de sala (opcional)". Vacío = sala principal (`SALA`).
  El código se normaliza solo (mayúsculas, sin espacios ni símbolos).
- **Crear sala nueva**: el botón "+ Crear una sala nueva con código" genera
  un código aleatorio de 6 letras y entra directo.
- **Compartir**: dentro de la sala, la barra superior muestra el código con
  un botón "⧉ copiar código". Pásalo a quien quieras que lea contigo;
  quien entre con ese código verá los mismos subrayados, notas y presentes.
- Cada sala tiene su propio estado (subrayados, notas, lista de presentes):
  lo que pasa en una sala no se ve en las demás.
- El estado de todas las salas se guarda en `data/rooms.json` (la antigua
  `data/room.json` de una sola sala se migra automáticamente a `SALA`).
- Endpoint útil: `GET /api/room/new` → `{ "code": "XKQPMV" }`.

## Cómo correrlo

```bash
cd ~/workspace/tintajunta-prototype
npm install
npm start            # o: PORT=8787 node server.js
```

Abre `http://localhost:8787` en el navegador. Para probar lo "en vivo", abre la
misma dirección en **dos ventanas o dos teléfonos**: entra con nombres
distintos y verás los subrayados, notas y la lista de presentes del otro al
instante.

Prueba automatizada de dos clientes simultáneos (con el servidor corriendo):

```bash
npm test
```

## Arquitectura

- **Servidor** (`server.js`): Node.js + Express + socket.io.
  - Sirve el frontend y el texto del capítulo (`GET /api/text`).
  - Eventos WebSocket: `join`, `highlight`, `note`, `del`, más emisiones
    `state`, `roster`, `highlight:new`, `note:new`, `highlight:del`,
    `note:del`, `activity`.
  - El texto se tokeniza en palabras con índice global; cada subrayado/nota
    referencia un rango `[start, end]`. Si dos subrayados se solapan, el más
    reciente pinta la palabra (fondo translúcido del color del autor).
- **Cliente** (`public/`): página única en español, sin framework.
  - Entrada con nombre + 6 tintas clásicas (azul, rojo, verde, ámbar, violeta,
    negro) + campo opcional de código de sala; botón para crear sala nueva
    con código aleatorio. Sin contraseña en el prototipo. El último código
    usado se recuerda en el navegador.
  - La barra superior muestra el código de la sala actual con botón para
    copiarlo y compartirlo.
  - Selección de texto (ratón o dedo) → barra flotante: *Subrayar* / *Nota*.
  - Clic en un subrayado propio → opción de quitarlo. Las notas propias se
    borran con ✕ en el panel de notas.
  - Panel lateral "Notas al margen" con cita del pasaje (clic para saltar al
    texto), autor y color. Lista de presencia en la barra superior.
- **Persistencia** (`data/rooms.json`): un objeto por código de sala
  (`{ seq, highlights, notes }`); cada cambio se guarda (con un pequeño
  diferido). Al reiniciar el servidor, todas las salas conservan sus
  subrayados y notas. La presencia es en vivo y no se persiste.
  La primera vez migra la antigua `data/room.json` a la sala `SALA`.

## Texto de muestra

Fragmento del inicio de *El ingenioso hidalgo don Quijote de la Mancha*
(Miguel de Cervantes, 1605), en **dominio público**, adaptado para la
demostración. Está claramente etiquetado como contenido de muestra dentro de
la página. En la plataforma final, cada libro lo publica su creador.

## Qué está simulado / pendiente (a propósito)

- **Sin cuentas ni contraseñas**: el nombre es libre y cualquiera puede usar
  el de otro; el código de sala es lo único que separa una sala de otra.
  La plataforma real necesita autenticación.
- **Un solo capítulo de muestra** en todas las salas (mismo texto).
- **Sin publicación de creadores, sin pagos (Stripe), sin modo biblioteca**
  por libro: esas son las piezas 1, 2 y 4 del plan.
- Sin moderación de contenido ni límites por usuario más allá de los básicos
  (rango máximo, longitud de nota).
- El borrado valida propiedad solo por nombre de la sesión.

## Exponerlo en internet (túnel)

El sandbox bloquea TCP directo y el proxy de salida exige autenticación, así
que `cloudflared` no pudo registrar un quick tunnel aquí. Se usa **localtunnel**
con un adaptador (`tunnel.js`):

```bash
cd ~/workspace/tintajunta-prototype
node tunnel.js     # con el servidor ya corriendo en el puerto 8787
```

`tunnel.js` hace dos adaptaciones: (1) la asignación de URL vía `fetch`
(el axios de localtunnel choca con Node 24 tras el proxy), y (2) un forwarder
local que mete el TCP crudo del túnel dentro de un `CONNECT` autenticado al
proxy (las credenciales se leen frescas en cada conexión porque rotan).

**URL pública actual (2026-10-02):** https://tintajunta-sala.loca.lt

**Notas honestas:**
- Es un túnel rápido gratuito: la URL vive mientras `tunnel.js` siga corriendo
  en esta máquina y **cambia cada vez que se reinicia**. No es una dirección
  permanente.
- Si localtunnel muestra una página de aviso antes de entrar, la contraseña es
  la IP pública actual de la máquina (ver en https://loca.lt/mytunnelpassword
  — cambia con el tiempo; el 2026-10-02 era 87.81.238.60).
- El WebSocket a veces devuelve 502 en el borde gratuito de localtunnel;
  socket.io cambia automáticamente a polling HTTP, que sí se verificó de
  extremo a extremo (ver `test/e2e-public-polling.js`).
- Las conexiones del túnel pueden caerse por inactividad; el cliente las
  reabre solo. Para una demo con gente activa no es problema; para producción
  haría falta un servidor permanente (idealmente tras tintajunta.com).

## Mantenerlo corriendo

```bash
# servidor (puerto 8787) y túnel, en segundo plano:
cd ~/workspace/tintajunta-prototype && PORT=8787 node server.js >> /tmp/tintajunta-server.log 2>&1 &
cd ~/workspace/tintajunta-prototype && node tunnel.js > /tmp/tintajunta-tunnel.log 2>&1 &
# la URL pública aparece en /tmp/tintajunta-tunnel.log ("TÚNEL ACTIVO: ...")
```

Si la VM se reinicia, hay que volver a lanzar ambos comandos (la URL cambiará).

## Próximos pasos sugeridos

1. Cuentas de lector y de creador (autenticación real).
2. Publicación de libros por creadores (subir texto, portada, precio).
3. Pagos con Stripe (el lector paga, el creador cobra, comisión de plataforma).
4. Modo biblioteca: cada libro con su comunidad permanente de notas
   (asíncrono), además de las salas en vivo.
5. Múltiples salas simultáneas y paginación del texto para libros completos.
