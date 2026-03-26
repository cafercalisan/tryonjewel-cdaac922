#!/bin/sh

# Ensure nginx run directory exists (Alpine requirement)
mkdir -p /run/nginx

MAX_RESTARTS=5
RESTART_DELAY=2

# ── Start nginx ──
nginx -g "daemon off;" &
NGINX_PID=$!
sleep 1

if ! kill -0 $NGINX_PID 2>/dev/null; then
  echo "ERROR: nginx failed to start!"
  nginx -t 2>&1
  exit 1
fi
echo "nginx started (PID $NGINX_PID)"

# ── Start NestJS v2 API ──
echo "Starting NestJS v2 API on port 3002..."
cd /app/backend
API_V2_PORT=3002 node dist/main.js &
NEST_PID=$!
cd /app
sleep 2

if kill -0 $NEST_PID 2>/dev/null; then
  echo "NestJS v2 API started (PID $NEST_PID)"
else
  echo "WARNING: NestJS v2 API failed to start — legacy API only"
fi

# ── Legacy Express restart loop ──
restart_count=0
start_node() {
  echo "Starting legacy API server (attempt $((restart_count + 1))/$MAX_RESTARTS)..."
  node dist-server/server.js
  return $?
}

while [ $restart_count -lt $MAX_RESTARTS ]; do
  start_node
  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 0 ]; then
    echo "Node.js exited cleanly (code 0). Stopping."
    break
  fi

  restart_count=$((restart_count + 1))
  echo "Node.js crashed with exit code $EXIT_CODE. Restart $restart_count/$MAX_RESTARTS..."

  if [ $restart_count -lt $MAX_RESTARTS ]; then
    echo "Waiting ${RESTART_DELAY}s before restart..."
    sleep $RESTART_DELAY
  fi
done

if [ $restart_count -ge $MAX_RESTARTS ]; then
  echo "Node.js crashed $MAX_RESTARTS times. Giving up."
fi

# If legacy node loop ends, kill nest and nginx too
kill $NEST_PID 2>/dev/null
kill $NGINX_PID 2>/dev/null
wait $NEST_PID 2>/dev/null
wait $NGINX_PID 2>/dev/null
