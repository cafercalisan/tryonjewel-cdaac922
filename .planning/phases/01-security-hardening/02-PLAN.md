---
wave: 2
depends_on:
  - 01-PLAN.md
files_modified:
  - api/check-video-status.ts
  - api/generate-video.ts
autonomous: true
requirements:
  - SEC-02
---

# Plan 02: Use Shared `authenticateUser` in Both Video Endpoints

## Goal

Both `api/generate-video.ts` and `api/check-video-status.ts` bypass the shared `authenticateUser` helper in `api/_lib/auth.ts` and implement manual token extraction instead. This means auth failures return 500 (from the outer catch) instead of 401, and the auth logic is not consistent with the other four endpoints. This plan replaces the manual auth pattern in both files with the shared helper.

## Context

**Current broken pattern in both files (generate-video.ts lines 97–102, check-video-status.ts lines 31–36):**
```typescript
const authHeader = req.headers.authorization;
if (!authHeader) throw new Error('Authorization required');

const token = authHeader.replace('Bearer ', '');
const { data: { user }, error: userError } = await supabase.auth.getUser(token);
if (userError || !user) throw new Error('Invalid authentication');
```

When `throw new Error('Authorization required')` or `throw new Error('Invalid authentication')` fires, it is caught by the outer `catch (error)` at the bottom of each handler, which returns `sendCorsResponse(res, 500, { error: ... })`. A 500 for an auth failure is incorrect and leaks implementation details.

**Correct pattern (used in generate-jewelry.ts, generate-design.ts, generate-model.ts, admin-set-credits.ts):**
```typescript
import { authenticateUser } from './_lib/auth.js';

const authResult = await authenticateUser(req);
if ('error' in authResult) {
  return sendCorsResponse(res, authResult.status, { error: authResult.error });
}
const { userId } = authResult;
```

The `authenticateUser` helper (api/_lib/auth.ts) returns `{ userId }` on success or `{ error: string; status: 401 }` on failure. It already handles missing header and invalid token cases.

**Important:** After replacing manual auth in `generate-video.ts`, the `user` object obtained from `supabase.auth.getUser(token)` is used at lines 110, 114, 119, 122, 127, 128, etc. These all reference `user.id`. Replace every `user.id` with `userId` from the `authenticateUser` result.

In `check-video-status.ts`, `user.id` is referenced at lines 45, 50, 70, 85, 92, 128. Replace all with `userId`.

Also: in both files, `supabase` is obtained via `getServiceClient()` before auth. This is fine — the service client is used for DB writes throughout. The `authenticateUser` helper internally uses `getAuthClient()` (user-scoped) for identity verification only. Keep `getServiceClient()` for DB operations.

## Tasks

<tasks>
  <task id="02-A">
    <title>Replace manual auth in generate-video.ts with authenticateUser helper</title>
    <file>api/generate-video.ts</file>
    <description>
      1. Add import at top of file (after existing imports):
         ```typescript
         import { authenticateUser } from './_lib/auth.js';
         ```

      2. Remove lines 97–102 (the manual auth block):
         ```typescript
         const authHeader = req.headers.authorization;
         if (!authHeader) throw new Error('Authorization required');

         const token = authHeader.replace('Bearer ', '');
         const { data: { user }, error: userError } = await supabase.auth.getUser(token);
         if (userError || !user) throw new Error('Invalid authentication');
         ```

      3. Replace with:
         ```typescript
         const authResult = await authenticateUser(req);
         if ('error' in authResult) {
           return sendCorsResponse(res, authResult.status, { error: authResult.error });
         }
         const { userId } = authResult;
         ```

      4. Replace all subsequent occurrences of `user.id` in the handler with `userId`.
         Affected lines (approximate, verify after step 2–3 shift line numbers):
         - `console.log('Starting video generation for user:', user.id)` → `userId`
         - `supabase.rpc('has_role', { _user_id: user.id, ... })` → `userId`
         - `supabase.rpc('deduct_credits', { _user_id: user.id, ... })` → `userId`
         - `supabase.from('videos').update(...).eq('id', videoId)` — these don't reference user.id directly
         - Any other `user.id` references

      5. The `videoId` check at line 106 (`if (!videoId) throw new Error('Video ID is required')`) currently throws and gets caught as a 500. Optionally convert to an explicit return:
         ```typescript
         if (!imageUrl) return sendCorsResponse(res, 400, { error: 'Image URL is required' });
         if (!videoId) return sendCorsResponse(res, 400, { error: 'Video ID is required' });
         ```
         This is a correctness improvement bundled with the auth fix since we're already editing this section.

      6. Remove the now-unused `supabase.auth.getUser` call path. The `supabase` variable (from `getServiceClient()`) is still needed for all DB operations — keep it.
    </description>
  </task>

  <task id="02-B">
    <title>Replace manual auth in check-video-status.ts with authenticateUser helper</title>
    <file>api/check-video-status.ts</file>
    <description>
      1. Add import at top of file (after existing imports):
         ```typescript
         import { authenticateUser } from './_lib/auth.js';
         ```

      2. Remove lines 31–36 (the manual auth block):
         ```typescript
         const authHeader = req.headers.authorization;
         if (!authHeader) throw new Error('Authorization required');

         const token = authHeader.replace('Bearer ', '');
         const { data: { user }, error: userError } = await supabase.auth.getUser(token);
         if (userError || !user) throw new Error('Invalid authentication');
         ```

      3. Replace with:
         ```typescript
         const authResult = await authenticateUser(req);
         if ('error' in authResult) {
           return sendCorsResponse(res, authResult.status, { error: authResult.error });
         }
         const { userId } = authResult;
         ```

      4. Replace all subsequent occurrences of `user.id` in the handler with `userId`.
         Affected locations:
         - `.eq('user_id', user.id)` in the videos query (line ~45) → `userId`
         - `supabase.rpc('has_role', { _user_id: user.id, ... })` (line ~50) → `userId`
         - `refundCredits(supabase, user.id, ...)` (lines ~70, ~85, ~92, ~128) → `userId`

      5. The `videoId` check at line 39 (`if (!videoId) throw new Error('Video ID is required')`) converts to:
         ```typescript
         if (!videoId) return sendCorsResponse(res, 400, { error: 'Video ID is required' });
         ```

      6. Keep the `supabase` variable from `getServiceClient()` — it is still needed for all DB operations.
    </description>
  </task>
</tasks>

## Verification

```bash
# 1. No manual token extraction remains in either video file
grep -n "authHeader.replace\|auth.getUser(token\|throw new Error.*Authorization\|throw new Error.*authentication" \
  api/generate-video.ts api/check-video-status.ts
# Expected: no output

# 2. authenticateUser import is present in both files
grep -n "authenticateUser" api/generate-video.ts api/check-video-status.ts
# Expected: import line + usage line in each file

# 3. No bare user.id references remain (should be userId after replacement)
grep -n "user\.id" api/generate-video.ts api/check-video-status.ts
# Expected: no output

# 4. TypeScript compiles cleanly
npx tsc --noEmit
```

## must_haves

- `POST /api/generate-video` returns HTTP 401 (not 500) when `Authorization` header is missing or token is invalid
- `POST /api/check-video-status` returns HTTP 401 (not 500) when `Authorization` header is missing or token is invalid
- Neither file contains `authHeader.replace('Bearer ', '')` or `supabase.auth.getUser(token)` as manual auth
- Both files import and call `authenticateUser` from `api/_lib/auth.js`
- TypeScript compilation succeeds with no new errors
