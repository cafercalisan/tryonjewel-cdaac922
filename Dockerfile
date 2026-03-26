# ── Stage 1: Frontend + Legacy Express ──
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm run build:server

# ── Stage 2: NestJS Backend ──
FROM node:20-alpine AS nest-builder
WORKDIR /backend
RUN apk add --no-cache python3 make g++
COPY backend/package*.json ./
RUN npm ci
COPY backend/ .
RUN npx nest build

# ── Stage 3: Runtime ──
FROM node:20-alpine
WORKDIR /app

# Install nginx, bcrypt native deps, and create run directory
RUN apk add --no-cache nginx python3 make g++ && mkdir -p /run/nginx

# Copy frontend build
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy legacy API server build and dependencies
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
RUN npm ci --omit=dev

# Copy NestJS backend build and dependencies
COPY --from=nest-builder /backend/dist ./backend/dist
COPY --from=nest-builder /backend/package.json ./backend/
COPY --from=nest-builder /backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev

# Copy nginx config
COPY nginx.conf /etc/nginx/http.d/default.conf

# Copy startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 80

CMD ["/start.sh"]
