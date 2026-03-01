# TryOnJewel — Roadmap

**4 phases** | **20 requirements mapped** | All v1 requirements covered ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|-----------------|
| 1 | Security Hardening | Fix critical vulnerabilities before any new feature | SEC-01..04 | 4 |
| 2 | Refactor & Testing | Reduce tech debt, add test coverage | REF-01..04, TEST-01..03 | 5 |
| 3 | User Galleries | Users can manage and organize their generated images | GAL-01..05 | 4 |
| 4 | Templates & Video | Preset scenes + professional video shot controls | TPL-01..04, VID-01..03 | 5 |

---

## Phase 1: Security Hardening

**Goal:** Fix all critical security vulnerabilities identified in codebase map before shipping new features.

**Requirements:** SEC-01, SEC-02, SEC-03, SEC-04

**Plans:**
1. Fix API key leak in `check-video-status.ts` — strip key before storing URL
2. Add `authenticateUser` to both video endpoints — proper 401 responses
3. Atomic credit+job transaction — refund on insert failure
4. Make storage bucket private — generate signed URLs for all image access

**Success Criteria:**
1. Google API key does not appear in any `video_url` stored in `processing_jobs`
2. `POST /api/generate-video` and `GET /api/check-video-status` return 401 (not 500) for unauthenticated requests
3. If job insert throws, credits are automatically refunded (no phantom deductions)
4. All images in `jewelry-images` bucket require signed URL to access (no public read)

---

## Phase 2: Refactor & Testing

**Goal:** Split the 2309-line monolith, eliminate duplicated code, add rate limiting, and establish a test foundation.

**Requirements:** REF-01, REF-02, REF-03, REF-04, TEST-01, TEST-02, TEST-03

**Plans:**
1. Refactor `api/generate-jewelry.ts` — extract scene engine, prompt builder, image processor, job manager
2. Consolidate shared utilities — single `VIDEO_CREDIT_COST`, single base64 util in `api/_lib/`
3. Rate limiting middleware — `api/_lib/rateLimit.ts`, applied to all endpoints
4. Test infrastructure — Vitest config, first tests for `_lib/` utilities and business logic

**Success Criteria:**
1. `api/generate-jewelry.ts` is <400 lines (handler only); modules in `api/_lib/jewelry/`
2. `VIDEO_CREDIT_COST` imported from one location in both video files
3. `POST /api/generate-jewelry` returns 429 after exceeding rate limit
4. `npm test` passes with ≥10 unit tests covering auth, cors, credit deduction

---

## Phase 3: User Galleries

**Goal:** Users can view, favorite, filter, and delete their generated images in a persistent gallery.

**Requirements:** GAL-01, GAL-02, GAL-03, GAL-04, GAL-05

**Plans:**
1. Supabase migration — add `is_favorite` column to `generated_images`, ensure RLS policies
2. Gallery page `/gorsellerim` — grid view, pagination, image modal
3. Favorite & delete actions — optimistic UI with TanStack Query
4. Gallery filter UI — all / favorites toggle

**Success Criteria:**
1. `/gorsellerim` shows all user's generated images in a grid
2. User can click heart icon to favorite; favorites persist after page reload
3. Filter by favorites shows only favorited images
4. User can delete an image; it disappears from gallery and storage
5. Gallery state persists across sessions (Supabase-backed)

---

## Phase 4: Templates & Video Improvements

**Goal:** Preset scene templates for faster generation + professional camera angle/shot controls for Veo video.

**Requirements:** TPL-01, TPL-02, TPL-03, TPL-04, VID-01, VID-02, VID-03

**Plans:**
1. Connect `scenes` DB table to generation flow — replace hardcoded pool with DB presets
2. Preset UI in Generate page — visual scene selector with thumbnails
3. Custom preset save — user can name and save their current scene config
4. Admin preset management — CRUD in admin panel
5. Video shot controls — angle selector (close-up / medium / wide) + movement (static / zoom / orbital)
6. Veo prompt builder — incorporate angle + movement into generated prompt

**Success Criteria:**
1. Generation page shows ≥5 preset scene options loaded from Supabase `scenes` table
2. Selecting a preset auto-fills scene parameters; generation produces matching style
3. User can save current settings as named preset (stored in Supabase)
4. Admin can add/disable presets from admin panel
5. Video generation page shows angle + movement selectors
6. Generated Veo prompt includes selected angle and movement language
