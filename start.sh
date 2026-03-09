#!/bin/sh

# Start API server in background
node dist-server/server.js &

# Start nginx in foreground
nginx -g "daemon off;"
