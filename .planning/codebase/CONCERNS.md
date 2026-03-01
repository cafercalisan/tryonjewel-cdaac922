# TryOnJewel — Codebase Concerns

> Generated: 2026-03-01
> Purpose: Prioritize refactoring, security hardening, and stability improvements.

---

## 1. Technical Debt

### 1.1 Massive Single-File Backend (Critical)

**File:** `api/generate-jewelry.ts` — **2,309 lines**

This is the single most pressing debt item in the codebase. The file contains:
- 27 hardcoded editorial scenes (lines 28–88)
- 8 color grade modifiers (lines 93–99)
- 8 character personas (lines 240–385)
- 5 outfit archetypes (lines 187–238)
- 11 product-type pose libraries (lines 390–494)
- 6 prompt builder functions (lines 582–1086)
- The `arrayBufferToBase64` utility (line 1088)
- Jewelry analysis logic (lines 1481–1611)
- The `generateSingleImage` retry loop (lines 1134–1220)
- The `processGeneration` background worker (lines 1343–2112)
- The main HTTP handler (lines 2117–2309)

Everything lives in one module. Any change to prompts, personas, or business logic touches the same file as the HTTP handler. This makes the file hard to test in isolation, hard to review in PRs, and risky to edit.

**Recommended split:**
- `api/_prompts/scenes.ts` — editorial scene pool + color grades
- `api/_prompts/personas.ts` — character personas + outfit pool
- `api/_prompts/builders.ts` — prompt builder functions
- `api/_lib/gemini.ts` — `callGeminiImageGeneration`, `generateSingleImage`, `arrayBufferToBase64`
- `api/_lib/analyzer.ts` — jewelry analysis + style reference analysis
- `api/generate-jewelry.ts` — handler + `processGeneration` only (~300 lines)

---

### 1.2 Duplicated Base64 Conversion Code

**Files:** `api/generate-video.ts` lines 153–158, `api/generate-design.ts` lines 62–67, `api/generate-jewelry.ts` function `arrayBufferToBase64` (line 1088)

Three separate implementations of `ArrayBuffer → base64` conversion exist. The `generate-video.ts` version uses the naive character-by-character loop (O(n) string concatenation). The `generate-jewelry.ts` version uses chunked `String.fromCharCode.apply` (correct). The `generate-design.ts` version also uses chunked apply. Only the video file has the slow version.

**Risk:** The naive loop in `generate-video.ts` (lines 153–158) will stack-overflow on large video binary inputs if `btoa` buffer is ever large.

---

### 1.3 Duplicated Auth Pattern in `generate-video.ts`

**File:** `api/generate-video.ts` lines 97–102

```typescript
const token = authHeader.replace('Bearer ', '');
const { data: { user }, error: userError } = await supabase.auth.getUser(token);
```

This manual auth pattern is duplicated across `generate-video.ts` and `check-video-status.ts`. The shared `authenticateUser` helper in `api/_lib/auth.ts` already exists and is used correctly in `generate-jewelry.ts`, `generate-design.ts`, `generate-model.ts`, and `admin-set-credits.ts`. These two video files bypass the helper for no apparent reason, making auth inconsistent.

---

### 1.4 Hardcoded Magic Numbers Throughout

| Location | Value | What It Is |
|---|---|---|
| `api/generate-jewelry.ts:17` | `1.5 * 1024 * 1024` | Max image size |
| `api/generate-jewelry.ts:2217` | `const creditsNeeded = 10` | Credit cost for image gen |
| `api/generate-video.ts:113` | `const VIDEO_CREDIT_COST = 200` | Credit cost for video |
| `api/check-video-status.ts:9` | `const VIDEO_CREDIT_COST = 200` | Same constant, duplicated |
| `api/generate-jewelry.ts:2182` | `3 * 60 * 1000` | Stuck job timeout (3 min) |
| `src/pages/Generate.tsx:287` | `const creditsNeeded = 10` | Credit cost, duplicated client-side |
| `src/pages/Generate.tsx:188` | `5 * 60 * 1000` | Polling timeout (5 min) |
| `api/generate-jewelry.ts:1146` | `[0, 3000, 5000]` | Retry delays |
| `src/lib/getSignedImageUrl.ts:7` | `60 * 60 * 1000` | Cache duration |
| `api/generate-jewelry.ts:1203` | `7 * 24 * 60 * 60` | Signed URL TTL (7 days) |

`VIDEO_CREDIT_COST = 200` is defined in both `generate-video.ts` (line 113) and `check-video-status.ts` (line 9). If the price changes, both files must be updated atomically. A shared constants file would eliminate this.

---

### 1.5 Untracked `wp-blog-generator` Directory

**File:** `wp-blog-generator/generate-blogs.ts`

This directory is an unrelated tool for a different business ("Istanbul Aslan Hamal" — a moving company). It is committed alongside the TryOnJewel codebase, contains hardcoded company data (phone: `0541 684 85 18`, URL: `istanbulaslanhamal.com`), and creates confusion about what is part of the product. It should be extracted into a separate repository.

---

### 1.6 Dead Migration — Screenshots Committed

**File:** `Ekran Resmi 2026-02-18 16.14.35.png`

A screenshot is present at the repository root and tracked in git (`?? "Ekran Resmi 2026-02-18 16.14.35.png"` in git status). While currently untracked, it should not be committed.

---

### 1.7 Supabase Edge Functions Are Stale Dead Code

**Directory:** `supabase/functions/`

Six edge functions exist (`generate-jewelry`, `generate-video`, `check-video-status`, `generate-design`, `generate-model`, `admin-set-credits`) that mirror the Vercel API functions. These were likely the original Lovable/Supabase deployment. They appear to be abandoned since migration to Vercel serverless, but they remain in the repository and create confusion about which code is actually deployed. They should be deleted or clearly archived.

---

## 2. Security Concerns

### 2.1 Storage Bucket Is Fully Public

**Migration:** `supabase/migrations/20260108202024_eb87e2f3-1e19-4cd0-8f96-0d6e738c2a1f.sql` line 2

```sql
UPDATE storage.buckets SET public = true WHERE id = 'jewelry-images';
```

The `jewelry-images` bucket is set to fully public. This means:
- Any user's original uploaded jewelry photos are publicly accessible if someone knows or guesses the storage path.
- Storage paths follow a predictable pattern: `{userId}/originals/{timestamp}-{index}.{ext}` — the user ID is a UUID, timestamp is ms epoch, so paths are guessable with enough information.
- The initial migration (line 134 of `20260107201226_*.sql`) created storage policies that restricted access to the owner. The subsequent public-bucket migration effectively nullified those policies for SELECT.

The intent was to allow generated images to be publicly viewable, but this was solved by making the entire bucket public rather than using signed URLs for originals and public URLs only for generated outputs.

---

### 2.2 CORS Wildcard on All API Routes

**File:** `api/_lib/cors.ts` line 4

```typescript
'Access-Control-Allow-Origin': '*',
```

All API routes accept requests from any origin. For a production SaaS with authentication and credit-based billing, this should be restricted to the production domain. An attacker could cross-site request forged calls from any page the user visits.

---

### 2.3 Admin Email Hardcoded in Migration

**File:** `supabase/migrations/20260213000000_assign_admin_role.sql` lines 3–4

```sql
WHERE email = 'cafercalisann@gmail.com'
```

The admin email is committed to version control. While the migration is idempotent, exposing the admin account email in a public or shared repository leaks information useful for targeted attacks.

---

### 2.4 `supabase: any` Type Throughout API Code

**Files:** `api/generate-jewelry.ts` (14 occurrences), `api/check-video-status.ts` (1), `api/generate-video.ts` (2), others

The Supabase client is typed as `any` in all function signatures (e.g., `generateSingleImage`'s `supabase: any` parameter). This disables TypeScript checking for all database interactions — no compile-time errors if a wrong table name, column, or method is used. This is a correctness risk for billing-critical operations like credit deduction.

---

### 2.5 Custom Prompt Injection Risk

**File:** `api/generate-jewelry.ts` line 2172

```typescript
const validatedCustomPrompt = isSinglePackage && typeof customPrompt === 'string' ? customPrompt.trim().substring(0, 500) : undefined;
```

The custom prompt is length-limited to 500 characters but its content is not sanitized beyond trimming. It is embedded directly into the AI generation prompt at line 976–977:

```typescript
USER CREATIVE DIRECTION:
${customText}
```

A carefully crafted prompt could attempt to override earlier instructions (prompt injection). The AI model's behavior is not fully deterministic, and adversarial inputs could cause it to ignore the ANTI-HALLUCINATION or FORBIDDEN clauses, potentially producing inappropriate content that bypasses content safety billing refund logic.

---

### 2.6 Credit Deduction Race Condition

**File:** `api/generate-jewelry.ts` lines 2220–2234

Credits are deducted via a database RPC call, then a job is created, then `waitUntil(processGeneration(...))` is called. If the handler crashes between credit deduction and job creation (e.g., `throw jobError` at line 2273), credits are deducted but no refund happens — the user loses credits with no generation. The credit deduction should be part of the same database transaction as job creation, or a compensating refund should run in the catch block at the handler level (not just in `processGeneration`).

---

## 3. Performance Issues

### 3.1 `generate-jewelry.ts` Loads 2,309 Lines on Every Cold Start

Because all prompt data, persona definitions, and scene pools are inline constants in the main handler file, every Vercel cold start parses and compiles ~2,300 lines. While V8 is fast, the module initialization time adds to cold start latency for a function already configured with 300s max duration. Separating prompt data into imported modules would allow Vercel to tree-shake and cache modules more efficiently.

---

### 3.2 Sequential Image Downloading Before Generation

**File:** `api/generate-jewelry.ts` lines 1455–1467

```typescript
for (const url of imageUrls) {
  const resp = await fetch(url);
  ...
}
```

Multiple product images are fetched sequentially. For the multi-image case (up to 4 images), this adds avoidable latency. `Promise.all` would parallelize downloads.

---

### 3.3 Signed URL Expiry Mismatch (7-Day vs 2-Hour)

**File:** `api/generate-jewelry.ts` line 1203

```typescript
.createSignedUrl(filePath, 7 * 24 * 60 * 60)  // 7 days
```

**File:** `src/lib/getSignedImageUrl.ts` line 110

```typescript
.createSignedUrl(filePath, 2 * 60 * 60)  // 2 hours
```

The server generates 7-day signed URLs for the initial result. The client-side re-signing utility generates 2-hour URLs. The cache duration is 1 hour. This inconsistency means results stored in the database have a 7-day URL, but after that expires the client will attempt to re-sign — adding a round-trip to every gallery load. More importantly, the client-side signed URL cache (`signedUrlCache`) is a module-level `Map`, meaning it is never garbage collected and grows indefinitely during a user session.

---

### 3.4 Double Polling on the Videos Page

**File:** `src/pages/Videos.tsx` lines 46–54 and `src/hooks/useVideoStatusPolling.ts`

The `Videos` page refetches the video list from Supabase every 10 seconds via React Query's `refetchInterval`. It also instantiates `useVideoStatusPolling`, which calls `check-video-status` (a Vercel API route) every 8 seconds per active video. For a user with 3 processing videos, this creates 3 × (10s Supabase poll + 8s API poll) = 6 concurrent polling streams. Both mechanisms update different state paths. The API polling then calls `queryClient.invalidateQueries` which triggers the Supabase poll again immediately, creating a feedback loop.

---

### 3.5 Unrevoked Object URLs in Gallery

**File:** `src/pages/Gallery.tsx`

When images are loaded into the gallery via `URL.createObjectURL`, the object URLs are never revoked on unmount. This is a memory leak for users browsing large galleries. `Generate.tsx` correctly revokes on `removeImage` (line 269) but the gallery does not apply the same cleanup.

---

### 3.6 `compressImage.ts` Recursive Quality Loop

**File:** `src/lib/compressImage.ts` lines 49–74

The compression function uses a recursive approach (`tryCompress` calling itself) with quality decremented by 0.1 each iteration. At minimum quality of 0.5, this is at most 5 recursion levels, which is fine. However, this runs `canvas.toBlob` asynchronously inside each recursive call, making the stack trace in error cases opaque. A `while` loop with `await new Promise` would be cleaner and would stop the call stack from accumulating.

---

## 4. Error Handling Gaps

### 4.1 Silent Failure When Job Insert Fails (After Credits Deducted)

**File:** `api/generate-jewelry.ts` lines 2258–2274

```typescript
const { data: jobRecord, error: jobError } = await supabase
  .from('processing_jobs')
  .insert({ ... })
  .single();

if (jobError) throw jobError;
```

If the job insert fails, the catch block at lines 2304–2308 returns a 500 error. But the credit deduction at lines 2220–2234 already committed. There is no refund call in the outer handler catch block — only in `processGeneration`'s catch. The user loses credits and receives a 500.

---

### 4.2 `processGeneration` Error Does Not Re-Throw to Vercel

**File:** `api/generate-jewelry.ts` lines 2087–2111

`processGeneration` runs via `waitUntil()`. Any unhandled rejection inside it is silently swallowed by Vercel. The function catches errors, updates the DB, and returns. But if the DB update itself fails (network issue), neither the job record nor the image record gets updated to `failed` status, and the polling will hang until the client's 5-minute timeout.

---

### 4.3 `analyzeStyleReference` Returns `null` Silently

**File:** `api/generate-jewelry.ts` lines 1264–1341

If the style reference analysis fails, `styleAnalysis` is `null`. The `buildStyleTransferPrompt` function (line 992) accepts `styleAnalysis: StyleReferenceAnalysis | null` and degrades gracefully with empty blocks. This is good, but the generation continues silently as if analysis succeeded. There is no user-facing message that the style reference could not be read, so the user may get an unexpected result without knowing why.

---

### 4.4 Video Upload Failure Falls Back to Direct API URL

**File:** `api/check-video-status.ts` lines 121–126

```typescript
if (!uploadError) {
  // use Supabase URL
}
// fallback:
await supabase.from('videos').update({ status: 'completed', video_url: videoUri, ... })
```

If the Supabase upload of the video fails, the code falls back to storing the raw Google API URI (including the API key in the query string: `${videoUri}&key=${GOOGLE_API_KEY}` at line 106). If this URL is stored in the database and later exposed to users, the Google API key is leaked.

---

### 4.5 Auth Error in `generate-video.ts` Does Not Follow Shared Pattern

**File:** `api/generate-video.ts` lines 97–103

When authentication fails, the function throws `new Error('Invalid authentication')` which is caught by the outer catch at line 252 and returned as a 500. The correct HTTP code for auth failure is 401. The shared `authenticateUser` helper returns the correct `{ status: 401 }` but is not used here.

---

### 4.6 `check-video-status.ts` Does Not Handle Missing `operation_id`

**File:** `api/check-video-status.ts` lines 57–59

```typescript
if (!video.operation_id) {
  return sendCorsResponse(res, 200, { success: true, status: video.status, message: 'Video generation starting...' });
}
```

If the video has `status: 'processing'` but no `operation_id` (can happen if `generate-video.ts` fails after DB update but before storing the operation name), polling will return a permanent `200 + "starting..."` — the client will poll forever until timeout, never receiving an error state.

---

## 5. Fragile Areas

### 5.1 Complex `waitUntil` Background Processing

**File:** `api/generate-jewelry.ts` lines 2279–2295

The entire `processGeneration` function runs as a Vercel `waitUntil` background task. This is correct for Vercel's serverless model, but it creates invisible failure modes:
- If the Vercel function instance is reclaimed before `processGeneration` completes, partial work is lost with no notification.
- The 300-second `maxDuration` config applies to the total HTTP lifetime, but `waitUntil` has its own undocumented deadline. For 6-image generation sets, the total wall time can approach or exceed this limit.
- There is no resumption mechanism. If generation halts mid-way, completed images are not saved until the final commit at line 2072–2083.

---

### 5.2 Retry Logic Tied to Temperature Escalation

**File:** `api/generate-jewelry.ts` lines 1146–1148

```typescript
const temperatures = [startTemperature, startTemperature + 0.05, startTemperature + 0.1];
const delays = [0, 3000, 5000];
```

On retry, the temperature is increased. This means a failed generation is retried with a more random/creative prompt — which is not the right fix for API errors (rate limiting, transient 5xx). Temperature escalation is only appropriate for content filter blocks. For network errors or quota limits, the temperature change is irrelevant and wastes a retry slot.

---

### 5.3 Video URL Extraction Uses 6 Fallback Paths

**File:** `api/check-video-status.ts` lines 97–102

```typescript
const videoUri = operationData.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
                 operationData.response?.generatedVideos?.[0]?.video?.uri ||
                 operationData.response?.predictions?.[0]?.video?.uri ||
                 operationData.result?.generatedVideos?.[0]?.video?.uri ||
                 operationData.result?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
                 operationData.response?.video?.uri;
```

Six different response schema attempts to extract the video URI reveals that the Google Veo API response format has changed or is unstable. This chain is fragile — if the API adds a seventh format, videos fail silently. There is no logging of which path matched, making debugging difficult.

---

### 5.4 Stuck Job Auto-Cleanup Runs on Every Request

**File:** `api/generate-jewelry.ts` lines 2177–2200

The auto-cleanup query runs synchronously at the start of every `generate-jewelry` invocation. For a user making many requests, this query (`SELECT id FROM processing_jobs WHERE user_id = $1 AND status IN (...) AND updated_at < $2`) runs on every call. It should either run as a Supabase scheduled function (pg_cron) or be rate-limited per-user with a timestamp check.

---

### 5.5 Admin Role Check Inconsistency

Two different mechanisms are used to check admin status:

1. **`api/` functions**: `supabase.rpc('has_role', { _user_id: userId, _role: 'admin' })` — server-side RPC
2. **`src/hooks/useIsAdmin.ts` lines 13–19**: Direct table query `FROM user_roles WHERE user_id = $1 AND role = 'admin'`
3. **`src/pages/Generate.tsx` lines 201–211**: `supabase.rpc('has_role', ...)` — RPC

Three different patterns for the same check. If the `user_roles` table schema or the `has_role` RPC changes, each must be updated separately.

---

### 5.6 Veo 2.0 Fallback Changes Video Type

**File:** `api/generate-video.ts` lines 211–240

When Veo 3.1 fails, the fallback uses Veo 2.0 **text-to-video** (no image input). This changes the generation from image-to-video to text-to-video without any user notification. The resulting video may look completely different from the source image. The fallback is noted in the status message `'Video oluşturuluyor (Veo 2.0)...'` but the user interface does not surface this distinction.

---

## 6. Missing Features / Incomplete Implementations

### 6.1 `processing_jobs` Schema Has Unused Columns

**File:** `src/integrations/supabase/types.ts` lines 66–101

The `processing_jobs` table has columns `partial_refund_amount`, `refunded`, and `failed_image_indices` defined in the schema but never written to by the application code. These suggest a partial refund system was planned (refund proportionally for each failed image out of 3) but was never completed. Currently, it's all-or-nothing: zero images → full refund, 1+ images → no refund.

---

### 6.2 `PremiumHeroDemo.tsx` Is a Demo Page Exposed in Production

**File:** `src/pages/PremiumHeroDemo.tsx`

A demo/development page exists at what appears to be a routable path. If it is registered in the router, it is accessible to end users in production. This page exists for testing the animated hero background shader.

---

### 6.3 No Rate Limiting on API Endpoints

None of the Vercel API functions implement rate limiting. A user could spam the `generate-jewelry` endpoint before the active-job check (which only blocks a second request if the first is still `pending/generating`). For `generate-video`, `generate-model`, and `generate-design`, there is no concurrency check at all — a user can trigger multiple parallel generations and exhaust credits faster than the UI expects, or intentionally exhaust the Google API quota for all users.

---

### 6.4 No Cleanup of Orphaned Original Images in Storage

When a user uploads images and a generation fails (pre-job-creation), the uploaded originals at `{userId}/originals/{timestamp}-{i}.{ext}` remain in Supabase Storage with no database record pointing to them. Over time, storage accumulates orphaned files. There is no cleanup job or retention policy.

---

### 6.5 Scene Table Is Only Partially Used

**File:** `src/pages/Generate.tsx` lines 191–198

Scenes are fetched from the `scenes` database table and used in the UI. However, the actual image generation in `processGeneration` (the Master package path) uses the **hardcoded scene pool** in `api/generate-jewelry.ts` (the `EDITORIAL_SCENE_POOL` constant), not the database scenes. The database scenes are only used for the old single-scene package flow. This creates a split where database scene management has no effect on the core generation product.

---

### 6.6 `GOOGLE_VEO_API_KEY` Is Not in `.env.example`

**File:** `api/generate-video.ts` line 92

```typescript
const GOOGLE_API_KEY = process.env.GOOGLE_VEO_API_KEY || process.env.GOOGLE_API_KEY;
```

The code accepts `GOOGLE_VEO_API_KEY` as a separate key but this variable is not documented in `.env.example`. A developer setting up the project would not know this variable exists.

---

## 7. Scalability Concerns

### 7.1 One Job Per User At a Time — Global Bottleneck

**File:** `api/generate-jewelry.ts` lines 2203–2211

```typescript
if (activeJobs && activeJobs > 0) {
  return sendCorsResponse(res, 409, { error: 'Zaten devam eden bir üretim var.' });
}
```

Only one generation job per user is allowed at any time. For a single user this is fine, but the check is done with a `SELECT COUNT(*) FROM processing_jobs WHERE user_id = $1 AND status IN (...)`. Under high concurrency (many users), this query runs on every generation request. For a growing user base this will become a hot query. Indexed at `idx_processing_jobs_user_status` (migration line 49), but the index covers `(user_id, status)` — efficient.

---

### 7.2 In-Memory Signed URL Cache Is Per-Instance

**File:** `src/lib/getSignedImageUrl.ts` lines 4–7

The `signedUrlCache` is a module-level `Map`. In the browser (frontend), this is fine — it persists for the session. But the cache has no maximum size and no eviction policy. A user opening hundreds of gallery images generates hundreds of cache entries that are never evicted until page refresh.

---

### 7.3 `processGeneration` Holds Memory for Full Duration

All base64-encoded images are loaded into memory simultaneously during `processGeneration`. For 4 uploaded images at 1.5MB each, this is 6MB of base64 in the function's heap (base64 expansion ~33%). For 6 generation steps, each prompt string is ~15–20KB. While individual amounts are manageable, for a function running 300s this memory is never freed until function teardown.

The code does null out the inline image data after extraction (line 1183: `part.inlineData.data = null`), which is good practice. But `styleReferenceBase64` and `base64Images` remain allocated for the entire function lifetime regardless of how many images were processed.

---

### 7.4 No Webhook or Push Notification for Job Completion

Job completion is communicated entirely through polling (`setInterval` at 2 seconds in `Generate.tsx`). Supabase Realtime subscriptions would allow server-push notification of job state changes, eliminating polling overhead and reducing the client-to-server request rate under load.

---

## 8. Code Smells

### 8.1 `sendCorsResponse` Duplicates CORS Header Setting

**File:** `api/_lib/cors.ts` lines 9–13 and 16–20

Both `handleCors` and `sendCorsResponse` set CORS headers. Additionally, every handler manually calls `Object.entries(corsHeaders).forEach(...)` at the top before calling `sendCorsResponse`. CORS headers are being set twice on every response. The `handleCors` function exists but is not used in any handler — only `sendCorsResponse` and the manual loop are used.

---

### 8.2 `getImages` Optional Method Pattern

**File:** `api/generate-jewelry.ts` line 2025

```typescript
const images = (ms as any).getImages ? (ms as any).getImages() : base64Images;
```

The `masterSteps` array has objects where only the `editorial` step has a `getImages` method. The rest fall back to `base64Images`. This is accessed via `as any` with a duck-type check. The proper solution is to include `getImages` as a required method on all steps, or use a discriminated union type. The `as any` cast here disables TypeScript entirely for this dispatch.

---

### 8.3 Mixed Turkish/English in User-Facing Error Messages

**Files:** `api/generate-jewelry.ts`, `api/generate-video.ts`, `api/check-video-status.ts`

Error messages are inconsistently localized. Some are Turkish (user-facing), some English (for server logs that look like user errors), and some mixed:

- Turkish: `"Yetersiz kredi. 200 kredi gerekli."` (generate-video.ts:128)
- English: `"Video ID is required"` (generate-video.ts:106) — this surfaces to the user on bad requests
- English: `"Authorization required"` (generate-video.ts:98) — surfaces to the user
- Mixed: `"Operation not found. Credits refunded."` (check-video-status.ts:72) — English error with Turkish implication

There is no i18n layer — all strings are hardcoded. Any localization change requires touching multiple files.

---

### 8.4 `Generate.tsx` at 964 Lines

**File:** `src/pages/Generate.tsx` — **964 lines**

The Generate page combines: file upload logic, image compression, polling state management, form validation, admin detection, style reference handling, retry logic, and JSX rendering. It should be decomposed into a container component + custom hooks (`useGenerationForm`, `useGenerationPolling`).

---

### 8.5 `Results.tsx` Has an Inline Lightbox

**File:** `src/pages/Results.tsx`

A lightbox implementation (zoom, keyboard nav, pan) is written inline in the Results page. The same lightbox is reimplemented in `Gallery.tsx` and `src/components/ui/image-lightbox.tsx` already exists. Three lightbox implementations exist in the codebase.

---

### 8.6 Stale Scenes in Database vs Hardcoded Scenes in API

The `scenes` database table (first populated in `20260107201226_*.sql` with 8 scenes) and the hardcoded `EDITORIAL_SCENE_POOL` in `generate-jewelry.ts` (27 scenes) describe two different scene taxonomies. The UI renders scenes from the database. The generation uses the hardcoded pool. When a user selects `editorial`, `ecommerce`, `model`, `macro`, `model_closeup`, or `model_lifestyle` (hardcoded keys), those labels reference `masterSteps` in the API — not the DB scenes at all. The database scenes are effectively unused for the main product flow.

---

## Priority Matrix

| # | Concern | Severity | Effort |
|---|---|---|---|
| 2.4 | API key potentially leaked in video URL fallback | Critical | Low |
| 2.6 | Credit deduction race condition (credits lost, no refund) | High | Medium |
| 2.1 | Public storage bucket exposes original user uploads | High | Medium |
| 4.1 | Silent credit loss when job insert fails | High | Low |
| 4.4 | Google API key appended to stored video URL | High | Low |
| 1.1 | 2,309-line monolith API file | High | High |
| 1.3 | Auth bypass in video endpoints | Medium | Low |
| 1.2 | Duplicate base64 slow loop in generate-video | Medium | Low |
| 1.4 | Duplicated credit cost constants | Medium | Low |
| 6.3 | No rate limiting on API endpoints | Medium | Medium |
| 5.1 | `waitUntil` failure modes | Medium | High |
| 3.4 | Double polling loop on Videos page | Medium | Low |
| 6.4 | Orphaned original images in storage | Low | Medium |
| 8.1 | CORS headers set twice per response | Low | Low |
| 1.5 | wp-blog-generator in wrong repository | Low | Low |
