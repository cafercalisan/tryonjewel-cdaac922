FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm run build:server

FROM node:20-alpine
WORKDIR /app

# Install nginx and create run directory
RUN apk add --no-cache nginx && mkdir -p /run/nginx

# Copy frontend build
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy API server build and dependencies
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
RUN npm ci --omit=dev

# Copy nginx config
COPY nginx.conf /etc/nginx/http.d/default.conf

# Copy startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["/start.sh"]
