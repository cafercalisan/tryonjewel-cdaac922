---
phase: 01-security-hardening
plan: 01
subsystem: api
tags: [security, google-api, supabase-storage, signed-url, credits]

# Dependency graph
requires: []
provides:
  - Video URL storage path that never contains Google API key
  - Proper error handling and credit refund on Supabase upload failure
  - Signed URL (7-day) instead of public URL for stored videos
affects:
  - 01-security-hardening (subsequent plans rely on private bucket assumption)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Use createSignedUrl (not getPublicUrl) for video storage to avoid leaking bucket exposure"
    - "Fail-fast in upload path: throw on any error, handle in single catch block"
    - "On upload failure: refund credits (non-admin) + status='error', never fall through to raw URI"

key-files:
  created: []
  modified:
    - api/check-video-status.ts

key-decisions:
  - "Use 7-day signed URLs for video (matching generate-jewelry.ts pattern) — getPublicUrl would expose bucket publicly"
  - "Single catch block wraps entire download+upload flow so any failure triggers refund, not silent fallback"
  - "GOOGLE_API_KEY is passed only in HTTP fetch headers/query, never persisted to database"

requirements-completed:
  - SEC-01

# Metrics
duration: 5min
completed: 2026-03-01
---

# Phase 1 Plan 01: Strip API Key from Stored Video URL — Summary

**Eliminated raw Google URI storage fallback in check-video-status.ts: replaced getPublicUrl with createSignedUrl and converted silent upload-failure fallthrough into error+credit-refund path**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-01T00:00:00Z
- **Completed:** 2026-03-01T00:05:00Z
- **Tasks:** 1 (01-A)
- **Files modified:** 1

## Accomplishments

- Google API key can no longer appear in any `videos.video_url` database value
- Raw transient Google storage URIs are no longer persisted to the database under any code path
- When Supabase storage fails, non-admin users receive a credit refund and the video record is marked `error` (not `completed`)
- Video URLs stored in DB are now 7-day Supabase signed URLs (containing `token=`), not public bucket URLs

## Task Commits

1. **Task 01-A: Replace fallback storage of raw Google URI with error + credit refund** - `29cb9f4` (fix)

**Plan metadata:** (see docs commit below)

## Files Created/Modified

- `api/check-video-status.ts` — Replaced lines 104–126: fail-fast download+upload, createSignedUrl on success, refund+error on any failure

## Decisions Made

- Used `createSignedUrl` with `7 * 24 * 60 * 60` seconds (7 days) — consistent with `generate-jewelry.ts` line 1204 pattern; `getPublicUrl` would be wrong once the bucket is made private in Plan 04.
- Consolidated into a single try/catch wrapping the entire fetch+upload+signedUrl flow so every failure mode (download error, storage error, URL generation error) goes through the same refund path.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 01 complete. `api/check-video-status.ts` is clean: no API key in DB paths, no raw Google URIs stored.
- Ready for Plan 02 (next security hardening task).

---
*Phase: 01-security-hardening*
*Completed: 2026-03-01*
