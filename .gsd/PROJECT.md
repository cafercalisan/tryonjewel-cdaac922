# Project

## What This Is

TryOnJewel (Moore Atelier) — Turkish B2B SaaS for jewelry brands. Users upload product photos, select scenes (editorial, e-commerce, model, macro, etc.), and the platform generates professional campaign-quality images and videos using Google Gemini AI. Credit-based pricing (100 free credits on signup, paid tiers up to enterprise).

## Core Value

Upload a jewelry photo → get professional campaign-ready images in seconds, replacing expensive studio/model shoots.

## Current State

Fully functional application deployed on Coolify (Hetzner):
- **18 routes**: Landing, Login, Signup, Dashboard, Generate (v1 + v2 engines), Results, Gallery, ModelGallery, Videos, Studio, Brand, Scenes, Admin, etc.
- **17 API endpoints**: Auth (signup/login/refresh/me), CRUD (scenes/images/videos/profiles/brand-profiles), AI generation (jewelry v1/v2, video, design, model), admin, storage (upload/signed-url)
- **Custom auth**: JWT + bcrypt, no third-party auth provider
- **Storage**: MinIO (S3-compatible) in Docker, replacing prior Supabase storage
- **Database**: PostgreSQL 16 on bare metal, 8 tables (users, profiles, scenes, images, processing_jobs, videos, user_models, brand_profiles)
- **Build**: Clean, ~2.8s, code-split lazy routes

## Architecture / Key Patterns

| Layer | Stack |
|---|---|
| Frontend | Vite + React 18 + TypeScript + Tailwind 3 + shadcn/ui + Framer Motion |
| API | Express server (`server.ts`) wrapping Vercel-style handler functions in `api/` |
| Database | PostgreSQL 16 via `pg` pool (`api/_lib/db.ts`) |
| Storage | MinIO via AWS S3 SDK (`api/_lib/storage.ts`) |
| Auth | Custom JWT (jose + bcrypt) — `api/_lib/auth-local.ts` |
| AI | Google Gemini 3.1 Flash (analysis + image gen) |
| Deploy | Docker (nginx + Node.js) on Coolify/Hetzner |

Key patterns:
- API handlers use Express `(req, res)` signature, registered in `server.ts`
- Frontend calls `/api/*` — nginx proxies to Node.js on port 3001
- `docker-compose.yml` runs MinIO + app container
- Frontend auth via `auth-client.ts` (localStorage tokens, auto-refresh)
- Turkish UI throughout

## Milestone Sequence

- [ ] M001: Hetzner Self-Hosted — Full platform running self-managed on Hetzner (PostgreSQL, MinIO, app, reverse proxy, SSL, backups)
