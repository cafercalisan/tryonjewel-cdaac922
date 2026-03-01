# TryOnJewel — v1 Requirements

## v1 Requirements

### Security (Phase 1 — Critical)

- [x] **SEC-01**: API key not stored in any database column or returned in any API response
- [x] **SEC-02**: `api/generate-video.ts` and `api/check-video-status.ts` use shared `authenticateUser` helper; return 401 on auth failure
- [x] **SEC-03**: Credit deduction and job insertion occur atomically — no credits deducted without a corresponding job record
- [x] **SEC-04**: `jewelry-images` Supabase storage bucket is private; signed URLs used for all access

### Refactor (Phase 2 — Technical Debt)

- [ ] **REF-01**: `api/generate-jewelry.ts` split into ≤5 focused modules (scene engine, prompt builder, image processor, job manager, HTTP handler)
- [ ] **REF-02**: `VIDEO_CREDIT_COST` defined in one shared location, imported by both video endpoints
- [ ] **REF-03**: Base64 conversion consolidated into one utility in `api/_lib/`
- [ ] **REF-04**: Rate limiting middleware applied to all `api/` endpoints (max requests per user/IP per minute)

### Test Infrastructure (Phase 2)

- [ ] **TEST-01**: Vitest + Testing Library installed and configured
- [ ] **TEST-02**: Unit tests for `api/_lib/` utilities (cors, auth, supabase)
- [ ] **TEST-03**: Unit tests for core business logic (credit deduction, job status transitions)

### User Galleries (Phase 3)

- [ ] **GAL-01**: User can view all their generated images on a `/gorsellerim` gallery page
- [ ] **GAL-02**: User can mark any generated image as favorite
- [ ] **GAL-03**: User can filter gallery by favorites
- [ ] **GAL-04**: User can delete their own generated images
- [ ] **GAL-05**: Gallery persists across sessions (stored in Supabase)

### Design Templates / Presets (Phase 4)

- [ ] **TPL-01**: User can select from preset scene styles (e.g. "Studio White", "Editorial Dark", "Nature Outdoor") when generating
- [ ] **TPL-02**: Presets are stored in Supabase `scenes` table and loaded dynamically
- [ ] **TPL-03**: User can save their own custom preset configurations
- [ ] **TPL-04**: Admin can add/edit/disable presets via admin panel

### Video Improvements (Phase 4)

- [ ] **VID-01**: Video generation supports professional angle/shot framing options (close-up, medium shot, wide angle)
- [ ] **VID-02**: User can select camera movement style (static, slow zoom, orbital)
- [ ] **VID-03**: Video prompt builder uses selected angle + movement to construct Veo prompt

## v2 Requirements (deferred)

- Payment integration (Stripe credit purchase)
- Social sharing (Instagram/Twitter)
- Mobile PWA
- White-label B2B widget

## Out of Scope

- Real-time multiplayer/collab features — not relevant to use case
- On-device AI processing — requires Gemini API
- Custom model training — cost-prohibitive

## Traceability

| Phase | Requirements |
|-------|-------------|
| Phase 1: Security Hardening | SEC-01, SEC-02, SEC-03, SEC-04 |
| Phase 2: Refactor & Testing | REF-01, REF-02, REF-03, REF-04, TEST-01, TEST-02, TEST-03 |
| Phase 3: User Galleries | GAL-01, GAL-02, GAL-03, GAL-04, GAL-05 |
| Phase 4: Templates & Video | TPL-01, TPL-02, TPL-03, TPL-04, VID-01, VID-02, VID-03 |
