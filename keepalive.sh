#!/bin/bash
# Mantiene vivos el servidor y el túnel de TintaJunta
cd ~/workspace/tintajunta-prototype
while true; do
  if ! curl -s --max-time 5 http://localhost:8787/ > /dev/null 2>&1; then
    echo "[$(date)] servidor caído, reiniciando..." >> /tmp/tj-keepalive.log
    pkill -f "node server[.]js" 2>/dev/null
    (node server.js > /tmp/tj-server.log 2>&1 &)
    sleep 3
  fi
  # El túnel cuenta como caído si no responde O si localtunnel devuelve 5xx
  # ("Tunnel Unavailable"): la conexión TCP puede seguir abierta aunque la
  # sesión del túnel ya murió en el servidor (visto el 2026-10-03: el URL
  # servía 503 durante horas y el chequeo viejo lo veía "sano").
  TUNNEL_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://tintajunta-sala.loca.lt/api/feature-prices 2>/dev/null)
  if [ -z "$TUNNEL_CODE" ] || [ "$TUNNEL_CODE" -ge 500 ]; then
    echo "[$(date)] túnel caído (http $TUNNEL_CODE), reiniciando..." >> /tmp/tj-keepalive.log
    pkill -f "tunnel-prod[.]js" 2>/dev/null
    sleep 2
    (node tunnel-prod.js > /tmp/tj-tunnel.log 2>&1 &)
    # Verificar que el túnel nuevo sí sirve; si sigue en 5xx, un intento más
    sleep 25
    TUNNEL_CODE2=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://tintajunta-sala.loca.lt/api/feature-prices 2>/dev/null)
    if [ -z "$TUNNEL_CODE2" ] || [ "$TUNNEL_CODE2" -ge 500 ]; then
      echo "[$(date)] túnel aún caído tras reinicio (http $TUNNEL_CODE2), reintentando..." >> /tmp/tj-keepalive.log
      pkill -f "tunnel-prod[.]js" 2>/dev/null
      sleep 2
      (node tunnel-prod.js > /tmp/tj-tunnel.log 2>&1 &)
      sleep 10
    fi
  fi
  sleep 60
done
