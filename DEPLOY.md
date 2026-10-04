# 🚂 DEPLOY — TintaJunta en Railway

Guía para publicar cambios en [tintajunta.com](https://tintajunta.com).
Última actualización: 2026-10-03.

## Cómo funciona

1. El código vive en GitHub: **`lenynescobar98-sys/Tintajunta`**, rama **`master`**.
2. Railway está conectado a ese repo. Cada `git push` a `master` debería desplegar solo.
3. El servidor arranca con `bash railway-start.sh` (monta el volumen persistente en `/data`).

## Publicar un cambio (flujo normal)

```bash
cd ~/workspace/tintajunta-prototype
node --check server.js && node --check public/app.js   # verificar sintaxis
git add -A && git commit -m "descripción del cambio"
git push origin master
```

Espera 2–4 minutos y verifica qué versión está viva:

```
https://tintajunta.com/api/version
```

Debe mostrar el `commit` igual al último de GitHub, con `stripe.enabled: true`
y `googleAuth.configured: true`.

## Si la página NO se actualiza (lo que pasó el 2026-10-03)

**Paso 1 — Ver qué commit está vivo:**
Abre `https://tintajunta.com/api/version` y compara el `commit` con el último
commit en GitHub. Si es más viejo, Railway no jaló lo nuevo.

**Paso 2 — Redeploy manual:**
En la app de Railway → proyecto **TintaJunta** → servicio **Tintajunta** →
pestaña **Deployments** → toca los **tres puntitos ⋮** del deploy activo →
**Redeploy**. Espera 2–4 minutos y vuelve a revisar `/api/version`.

**Paso 3 — Si el redeploy pone el código viejo otra vez:**
El repo se desconectó de GitHub. Arreglarlo:
Railway → servicio **Tintajunta** → **Settings** → **Source** →
verifica que la rama sea **`master`** → desconecta y vuelve a conectar el repo.
Después haz otro **Redeploy** (paso 2).

## Variables de entorno (Railway → servicio → Variables)

| Variable | Para qué | Si falta… |
|---|---|---|
| `STRIPE_SECRET_KEY` | Cobros reales | Pagos deshabilitados (`stripe-disabled`) |
| `STRIPE_PUBLISHABLE_KEY` | Checkout en el navegador | Pagos deshabilitados |
| `STRIPE_WEBHOOK_SECRET` | Confirmar pagos vía webhook | Los pagos se verifican por API (respaldo) |
| `GOOGLE_CLIENT_ID` | Login con Google | Login deshabilitado |
| `GOOGLE_CLIENT_SECRET` | Login con Google | Login deshabilitado |
| `SESSION_SECRET` | Sesiones de usuario | Se usa un secreto de desarrollo (cámbialo) |

El servidor avisa en los logs al arrancar qué integración quedó deshabilitada
(busca `⚠️` en los logs del deploy). Los valores de las claves **jamás** se
muestran en logs ni van al código/git.

## Salud del servicio

Railway verifica `/api/version` como healthcheck en cada deploy.
Si el servidor no responde, Railway lo reinicia solo (hasta 10 intentos).
