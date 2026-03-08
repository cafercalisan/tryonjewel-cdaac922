# TryOnJewel — v1 Requirements

## v1 Requirements

### Security (Phase 1 — Critical)

- [x] **SEC-01**: API key not stored in any database column or returned in any API response
- [x] **SEC-02**: `api/generate-video.ts` and `api/check-video-status.ts` use shared `authenticateUser` helper; return 401 on auth failure
- [x] **SEC-03**: Credit deduction and job insertion occur atomically — no credits deducted without a corresponding job record
- [x] **SEC-04**: `jewelry-images` Supabase storage bucket is private; signed URLs used for all access

### Bug Fixes (Phase 2 — Zoom/Resize)

- [x] **BUG-01**: PremiumHero canvas resize handler debounced — no beam regeneration on every resize event
- [x] **BUG-02**: InfiniteProductShowcase resize handler debounced — no excessive re-renders during window resize
- [x] **BUG-03**: use-mobile hook uses matchMedia result instead of redundant window.innerWidth check
- [x] **BUG-04**: All responsive components handle zoom in/out without layout breaks or JS errors

### Performance (Phase 3 — Image Loading)

- [ ] **PERF-01**: All non-critical images use `loading="lazy"` (Gallery, Dashboard, Results, BeforeAfter)
- [ ] **PERF-02**: ProgressiveImage component supports lazy loading with blur-up placeholder
- [ ] **PERF-03**: Lightbox/modal images load optimized resolution first, full-res on demand
- [ ] **PERF-04**: Critical images (hero, above-fold) use preloading (`<link rel="preload">` or equivalent)
- [ ] **PERF-05**: Image components use `decoding="async"` where appropriate

### Hetzner Migration (Phase 4 — Server)

- [ ] **MIG-01**: Docker containerization — Dockerfile for frontend build + Node.js API server
- [ ] **MIG-02**: Vercel serverless functions converted to Express/Fastify routes on Hetzner
- [ ] **MIG-03**: Nginx reverse proxy configured for frontend + API routing
- [ ] **MIG-04**: Environment variables and secrets managed on Hetzner (Supabase, Google API keys)
- [ ] **MIG-05**: CI/CD pipeline for automated deployment to Hetzner

## v2 Requirements (deferred)

- Payment integration (Stripe credit purchase)
- Social sharing (Instagram/Twitter)
- Mobile PWA
- White-label B2B widget
- REF-01..04: Monolith refactoring (deferred from v1 Phase 2)
- TEST-01..03: Test infrastructure (deferred from v1 Phase 2)
- GAL-01..05: User galleries (deferred from v1 Phase 3)
- TPL-01..04: Design templates/presets (deferred from v1 Phase 4)
- VID-01..03: Video improvements (deferred from v1 Phase 4)

## Out of Scope

- Real-time multiplayer/collab features — not relevant to use case
- On-device AI processing — requires Gemini API
- Custom model training — cost-prohibitive

## Traceability

| Phase | Requirements |
|-------|-------------|
| Phase 1: Security Hardening | SEC-01, SEC-02, SEC-03, SEC-04 |
| Phase 2: Bug Fixes (Zoom/Resize) | BUG-01, BUG-02, BUG-03, BUG-04 |
| Phase 3: Performance (Image Loading) | PERF-01, PERF-02, PERF-03, PERF-04, PERF-05 |
| Phase 4: Hetzner Migration | MIG-01, MIG-02, MIG-03, MIG-04, MIG-05 |
