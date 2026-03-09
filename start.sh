#!/bin/sh

MAX_RESTARTS=5
RESTART_DELAY=2
restart_count=0

start_node() {
  echo "Starting Node.js API server (attempt $((restart_count + 1))/$MAX_RESTARTS)..."
  node dist-server/server.js
  return $?
}

# Start nginx in background
nginx -g "daemon off;" &
NGINX_PID=$!

# Node.js restart loop
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

# If node loop ends, kill nginx too
kill $NGINX_PID 2>/dev/null
wait $NGINX_PID 2>/dev/null
