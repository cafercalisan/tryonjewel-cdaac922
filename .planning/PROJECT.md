# TryOnJewel — Project Context

## What We're Building

TryOnJewel is an AI-powered jewelry visualization platform. Users upload a photo of themselves or select an AI-generated model, then the system generates photorealistic 4K images of them wearing jewelry — rings, necklaces, earrings — using Google Gemini. A video try-on feature (Veo 3.1) is also available.

**Core value:** Any person can see exactly how a piece of jewelry looks on them before buying, without physical try-on.

## Tech Stack

- **Frontend:** Vite 5 + React 18 + TypeScript + Tailwind 3 + shadcn/ui (Radix UI)
- **Backend:** Vercel Serverless Functions (Node 20, `api/` directory)
- **Database / Auth / Storage:** Supabase (Postgres + Auth + Storage bucket `jewelry-images`)
- **AI:** Google Gemini
  - Analysis: `gemini-2.5-flash` (jewelry photo analysis)
  - Generation: `gemini-3-pro-image-preview` (4K image, 3x retry)
  - Video: `veo-3.1-fast-generate-preview` (primary) + `veo-2.0-generate-001` (fallback)
- **Deploy:** Vercel (frontend SPA + serverless, same domain)

## Key Files

| File | Purpose |
|------|---------|
| `api/generate-jewelry.ts` | Main generation endpoint — 2309 lines, scene pools, retry logic |
| `api/generate-video.ts` | Veo video generation, async LRO |
| `api/check-video-status.ts` | Video polling endpoint |
| `api/generate-model.ts` | Character DNA system, AI model/persona generation |
| `api/generate-design.ts` | Marketing design generation |
| `api/admin-set-credits.ts` | Admin credit management |
| `api/_lib/cors.ts` | CORS helper |
| `api/_lib/auth.ts` | JWT authenticateUser middleware |
| `api/_lib/supabase.ts` | Two client factories (service role vs user-scoped) |
| `src/lib/api.ts` | Frontend `invokeApi()` helper with JWT injection |
| `src/pages/Generate.tsx` | Main generation flow UI |

## Business Context

- Credit-based monetization (image generation costs credits)
- Turkish-language frontend (`/olustur`, `/sonuclar`, `/gorsellerim`)
- Partial success: 1+ of 3 images succeeds = job completed
- Stuck job auto-cleanup: 3 minutes
- Polling interval: 2 seconds, timeout: 5 minutes

## Current State (post-codebase-map)

### Validated (already working)
- ✓ Jewelry image generation (3x 4K, Gemini retry)
- ✓ AI model/character generation (Character DNA system)
- ✓ Video try-on (Veo 3.1 + 2.0 fallback)
- ✓ Credit deduction system
- ✓ Supabase auth + storage
- ✓ Admin credit management
- ✓ Processing jobs queue with polling

### Active (this roadmap)
- [ ] Security: API key leak, auth bypass in video endpoints, credit loss race condition
- [ ] User galleries & favorites
- [ ] Design templates / preset scenes
- [ ] generate-jewelry.ts refactor (2309 lines → modules)
- [ ] Rate limiting on API endpoints
- [ ] Test infrastructure (Vitest)
- [ ] Video improvements: professional angle + shot framing for Veo

### Out of Scope (this milestone)
- Stripe payment integration — deferred
- Mobile app / PWA — deferred
- White-label B2B widget — deferred
- Social sharing — deferred

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vercel serverless over Supabase Edge Functions | Lower latency, better Gemini SDK support, `waitUntil` for parallelism | Done — `supabase/functions/` is legacy dead code |
| Only Gemini (no BytePlus/Seedream fallback) | Simpler, higher quality | Done — 3x retry with temperature escalation |
| 4K native generation | No client-side upscaling needed | Done |
| Polling over webhooks | Simpler architecture for video status | Done — 2s interval, 5min timeout |

## Critical Concerns (from codebase map)

1. **[CRITICAL] API key leak** — `api/check-video-status.ts:106` stores `video_url` with Google API key appended
2. **[CRITICAL] Credit loss** — `api/generate-jewelry.ts:2220-2273` deducts credits before job insert; no refund on insert failure
3. **[CRITICAL] Auth bypass** — `api/generate-video.ts` and `api/check-video-status.ts` bypass `authenticateUser` helper, return 500 on auth failure
4. **[HIGH] Public storage bucket** — `jewelry-images` bucket is fully public; user photos exposed at predictable paths
5. **[MEDIUM] Dead code** — `supabase/functions/` and `wp-blog-generator/` committed to wrong repo

---
*Last updated: 2026-03-01 after initialization*
