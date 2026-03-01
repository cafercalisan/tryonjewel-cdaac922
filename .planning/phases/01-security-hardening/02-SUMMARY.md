# Plan 02 Summary: Auth Bypass Fix

**Status:** Complete
**Commit:** 194d725

## What was built

Both video endpoints now use the shared `authenticateUser` helper from `api/_lib/auth.ts` instead of manual JWT token extraction. Unauthenticated requests now return 401 instead of 500.

## Changes

- `api/generate-video.ts` — replaced manual `req.headers.authorization` extraction + `supabase.auth.getUser()` with `authenticateUser(req)`. Input validation returns 400 not throw.
- `api/check-video-status.ts` — same pattern. All `user.id` references updated to `userId`.

## Verification

- Both endpoints return 401 for unauthenticated requests
- TypeScript compiles cleanly
- SEC-02 requirement satisfied
