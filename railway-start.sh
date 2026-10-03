#!/bin/bash
# TintaJunta — script de arranque para producción (Railway)
# 1. Monta el volumen persistente para data/ y uploads/
# 2. Siembra los JSON iniciales la primera vez
# 3. Arranca el servidor
set -e
cd "$(dirname "$0")"

VOLUME="${RAILWAY_VOLUME_MOUNT_PATH:-/data}"
echo "[tintajunta] Volumen persistente: $VOLUME"

# --- data/*.json (usa DATA_DIR que server.js ya respeta) ---
mkdir -p "$VOLUME/data"
if [ -z "$(ls -A "$VOLUME/data" 2>/dev/null)" ]; then
  echo "[tintajunta] Sembrando data/ inicial en el volumen..."
  cp -r data/. "$VOLUME/data"/
else
  echo "[tintajunta] data/ ya existe en el volumen, no se toca."
fi
export DATA_DIR="$VOLUME/data"

# --- uploads: public/covers, public/ads, public/pageimg -> volumen ---
for d in covers ads pageimg; do
  mkdir -p "$VOLUME/$d"
  if [ ! -L "public/$d" ]; then
    if [ -d "public/$d" ]; then
      # conserva archivos empaquetados (ej. best-offer-logo.jpg)
      cp -rn "public/$d/." "$VOLUME/$d/" 2>/dev/null || true
      rm -rf "public/$d"
    fi
    ln -s "$VOLUME/$d" "public/$d"
    echo "[tintajunta] public/$d -> $VOLUME/$d"
  fi
done

# public/img tiene el logo de Best Offer empaquetado; se sirve directo del repo
echo "[tintajunta] Arrancando servidor..."
exec node server.js
