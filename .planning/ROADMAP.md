# TryOnJewel — Roadmap

**4 phases** | **18 requirements mapped** | All v1 requirements covered ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|-----------------|
| 1 | Security Hardening | Complete | 2026-03-01 | 4 |
| 2 | Bug Fixes (Zoom/Resize) | Fix zoom/resize crashes and layout breaks | BUG-01..04 | 4 |
| 3 | Performance (Image Loading) | Fast, fluid image loading with lazy load and optimization | PERF-01..05 | 5 |
| 4 | Hetzner Migration | Move from Vercel to self-hosted Hetzner with Docker + Nginx | MIG-01..05 | 5 |

---

## Phase 1: Security Hardening

**Goal:** Fix all critical security vulnerabilities identified in codebase map before shipping new features.

**Requirements:** SEC-01, SEC-02, SEC-03, SEC-04

**Plans:**
4/4 plans complete

**Success Criteria:**
1. Google API key does not appear in any `video_url` stored in `processing_jobs`
2. `POST /api/generate-video` and `GET /api/check-video-status` return 401 (not 500) for unauthenticated requests
3. If job insert throws, credits are automatically refunded (no phantom deductions)
4. All images in `jewelry-images` bucket require signed URL to access (no public read)

---

## Phase 2: Bug Fixes (Zoom/Resize)

**Goal:** Fix all zoom/resize related page crashes and layout breaks so the app works flawlessly at any zoom level.

**Requirements:** BUG-01, BUG-02, BUG-03, BUG-04

**Plans:** 1/1 plans complete
- [x] 02-01-PLAN.md — Debounce resize handlers, fix use-mobile hook, audit zoom robustness

**Success Criteria:**
1. PremiumHero canvas handles rapid resize without jank or beam regeneration storms
2. InfiniteProductShowcase handles resize without excessive re-renders
3. Browser zoom from 50% to 200% causes no JS errors or layout breaks
4. All responsive breakpoints transition smoothly without flicker

---

## Phase 3: Performance (Image Loading)

**Goal:** Dramatically improve image loading speed — lazy load off-screen images, optimize previews, preload critical assets.

**Requirements:** PERF-01, PERF-02, PERF-03, PERF-04, PERF-05

**Success Criteria:**
1. Gallery, Dashboard, Results pages use lazy loading for off-screen images
2. ProgressiveImage shows blur placeholder while loading, transitions smoothly
3. Lightbox loads optimized preview first, full-res on zoom/demand
4. Above-fold hero images are preloaded — LCP < 2.5s on 4G
5. All image elements use `decoding="async"` where appropriate

---

## Phase 4: Hetzner Migration

**Goal:** Migrate entire stack (frontend + API) from Vercel to a self-hosted Hetzner VPS with Docker and Nginx.

**Requirements:** MIG-01, MIG-02, MIG-03, MIG-04, MIG-05

**Success Criteria:**
1. Frontend builds and serves from Docker container on Hetzner
2. All API endpoints work as Express/Fastify routes (no Vercel serverless dependency)
3. Nginx routes `/api/*` to backend, `/*` to frontend static files
4. All environment variables configured and secrets secured on Hetzner
5. Push to main triggers automated build and deploy to Hetzner
