# Phase 4: Hetzner Migration Plan

## Overview
Vercel + Supabase → Hetzner VPS (Docker + PostgreSQL + Nginx + disk storage)

## User Decisions
- **Sunucu:** Hazır (IP ve SSH erişimi var)
- **DB:** PostgreSQL (self-hosted on Hetzner)
- **Storage:** Sunucu disk + Nginx static file serving

## Architecture

```
                    Hetzner VPS
┌─────────────────────────────────────────┐
│  Nginx (reverse proxy + static files)   │
│    ├── / → Frontend (Vite build)        │
│    ├── /api/* → Express API (Node.js)   │
│    └── /uploads/* → Disk storage        │
│                                         │
│  Express/Fastify API Server             │
│    ├── generate-jewelry                 │
│    ├── generate-design                  │
│    ├── generate-model                   │
│    ├── generate-video                   │
│    ├── check-video-status               │
│    └── admin-set-credits                │
│                                         │
│  PostgreSQL                             │
│    ├── users (auth)                     │
│    ├── images                           │
│    ├── processing_jobs                  │
│    ├── scenes                           │
│    └── credits                          │
│                                         │
│  Disk Storage (/var/www/uploads/)       │
│    ├── {userId}/originals/              │
│    ├── {userId}/generated/              │
│    └── videos/                          │
└─────────────────────────────────────────┘
```

## Migration Steps

### Step 1: Express API Server
- Create `server/` directory with Express app
- Convert each `api/*.ts` Vercel serverless function → Express route
- Replace `api/_lib/supabase.ts` with direct PostgreSQL client (pg/drizzle)
- Replace Supabase Storage calls with local disk read/write
- Keep `api/_lib/auth.ts` → JWT verification against PostgreSQL
- Keep `api/_lib/cors.ts` → Express CORS middleware
- Environment: `DATABASE_URL`, `GOOGLE_API_KEY`, `JWT_SECRET`

### Step 2: PostgreSQL Schema
- Export Supabase schema → create migration SQL
- Tables: users, images, processing_jobs, scenes, credits, profiles
- Auth: Replace Supabase Auth with custom JWT (or use existing Supabase Auth as external service initially)
- RLS → Application-level authorization in Express middleware

### Step 3: Disk Storage
- Upload images to `/var/www/uploads/{userId}/generated/`
- Nginx serves `/uploads/*` as static files (fast, zero-cost)
- Replace all `supabase.storage` calls with `fs.writeFile` + return URL
- Thumbnail generation: sharp library for on-upload resize

### Step 4: Docker Setup
- Multi-stage Dockerfile: build frontend + run API server
- docker-compose.yml: app + PostgreSQL + Nginx
- Volume mounts for uploads and DB data

### Step 5: Nginx Configuration
- SSL (Let's Encrypt / certbot)
- `/` → static frontend files
- `/api/*` → proxy to Express (port 3001)
- `/uploads/*` → static file serving from disk
- Gzip, caching headers

### Step 6: CI/CD
- GitHub Actions: push to main → SSH deploy → docker-compose up
- Or simple git pull + rebuild script

### Step 7: Data Migration
- Export Supabase data → import to PostgreSQL
- Download Supabase Storage files → upload to Hetzner disk
- DNS switch

## Files to Create
- `server/index.ts` - Express entry point
- `server/routes/` - API routes (1:1 from api/)
- `server/lib/db.ts` - PostgreSQL client
- `server/lib/storage.ts` - Disk storage helper
- `server/lib/auth.ts` - JWT auth middleware
- `docker-compose.yml`
- `Dockerfile` (updated: frontend + API)
- `nginx.conf` (updated: reverse proxy + uploads)
- `.github/workflows/deploy.yml`

## What Changes on Frontend
- `VITE_API_URL` → point to Hetzner domain
- Remove Supabase client dependency for storage
- Auth: keep Supabase Auth initially OR migrate to custom JWT

## Priority Order
1. Express API server (core functionality)
2. PostgreSQL schema + migration
3. Docker + Nginx setup
4. Frontend env switch
5. Data migration + DNS
6. CI/CD

## Key Decision: Auth Strategy
Option A (Recommended for Phase 1): Keep Supabase Auth as external service
  - Frontend still uses Supabase JS for login/signup
  - Backend verifies Supabase JWT tokens
  - Zero auth migration needed, focus on API + storage

Option B (Full independence): Custom JWT auth
  - Requires user migration, password reset flow, email verification
  - Much more work, do in a later phase

## Need from User
- [ ] Hetzner IP address
- [ ] SSH access credentials
- [ ] Domain name (for SSL/DNS)
- [ ] Supabase project URL (for data export)
