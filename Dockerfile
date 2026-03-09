FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN npm run build:server

FROM node:20-alpine
WORKDIR /app

# Install nginx
RUN apk add --no-cache nginx

# Copy frontend build
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy API server build and dependencies
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Copy nginx config
COPY nginx.conf /etc/nginx/http.d/default.conf

# Copy startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 80

CMD ["/start.sh"]
