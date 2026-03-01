---
phase: 01
plan: 04
subsystem: storage-security
tags: [storage, security, signed-urls, migration]
requires: [01-PLAN.md]
provides: [private-bucket, signed-urls-everywhere]
affects: [api/generate-design.ts, supabase/migrations]
tech-stack:
  added: []
  patterns: [signed-url-delivery]
key-files:
  created:
    - supabase/migrations/20260301000000_make_bucket_private.sql
  modified:
    - api/generate-design.ts
key-decisions:
  - Set jewelry-images bucket to private (public = false) to re-activate existing RLS policies
  - Use 7-day createSignedUrl in generate-design.ts matching the expiry used in generate-jewelry.ts
  - Nullify stale public video_url values in processing_jobs to prevent broken links post-migration
requirements-completed:
  - SEC-04
duration: 1 min
completed: 2026-03-01T14:39:13Z
---

# Phase 1 Plan 04: Make `jewelry-images` Bucket Private + Signed URLs Everywhere Summary

Private storage enforced via SQL migration setting `public = false` on the `jewelry-images` bucket, and the last remaining `getPublicUrl` call in `api/generate-design.ts` replaced with `createSignedUrl` (7-day expiry).

**Duration:** ~1 min | **Start:** 2026-03-01T14:38:28Z | **End:** 2026-03-01T14:39:13Z | **Tasks:** 2 | **Files:** 2

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 04-A | Create migration to set bucket private + nullify stale video_url | 2252dac |
| 04-B | Replace getPublicUrl with createSignedUrl in generate-design.ts | 78c0dbd |

## What Was Built

### Task 04-A — Migration: Make Bucket Private

Created `supabase/migrations/20260301000000_make_bucket_private.sql`:

1. Sets `public = false` on the `jewelry-images` bucket — re-activates existing RLS policies that were previously bypassed when the bucket was public
2. NULLs out any `processing_jobs.video_url` values lacking a `token=` query param (stale public URLs that would serve 403 after the bucket goes private)

The existing RLS policies from migration `20260107201226_*.sql` are correct and comprehensive:
- Owner-scoped INSERT, SELECT, DELETE for user paths
- "Generated images are publicly readable" policy for `generated/` paths

### Task 04-B — generate-design.ts: getPublicUrl → createSignedUrl

Replaced lines 228–234 in `api/generate-design.ts`:

**Before:**
```typescript
const { data: { publicUrl } } = supabase.storage
  .from('jewelry-images')
  .getPublicUrl(fileName);
return sendCorsResponse(res, 200, { success: true, designUrl: publicUrl });
```

**After:**
```typescript
const { data: signedUrlData, error: signedUrlError } = await supabase.storage
  .from('jewelry-images')
  .createSignedUrl(fileName, 7 * 24 * 60 * 60); // 7-day signed URL

if (signedUrlError || !signedUrlData?.signedUrl) {
  console.error('Failed to create signed URL for design:', signedUrlError);
  return sendCorsResponse(res, 500, { error: 'Failed to generate design URL' });
}
return sendCorsResponse(res, 200, { success: true, designUrl: signedUrlData.signedUrl });
```

## Verification Results

- `grep "public = false" supabase/migrations/20260301000000_make_bucket_private.sql` → 1 match ✓
- `grep -rn "getPublicUrl" api/` → no output (clean) ✓
- `grep -n "createSignedUrl" api/generate-design.ts` → 1 match at line 230 ✓
- IDE diagnostics: no TypeScript errors ✓

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

All 4 plans in Phase 01-security-hardening are now complete. Phase is ready for transition to Phase 02 (Refactor & Testing).

## Self-Check: PASSED

- `supabase/migrations/20260301000000_make_bucket_private.sql` exists on disk ✓
- `api/generate-design.ts` uses `createSignedUrl` (no `getPublicUrl`) ✓
- `git log --oneline --grep="01-04"` returns 2 commits ✓
