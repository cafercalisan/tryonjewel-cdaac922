---
wave: 2
depends_on:
  - 01-PLAN.md
files_modified:
  - supabase/migrations/20260301000000_make_bucket_private.sql
  - api/generate-design.ts
autonomous: true
requirements:
  - SEC-04
---

# Plan 04: Make `jewelry-images` Bucket Private + Signed URLs Everywhere

## Goal

The `jewelry-images` Supabase Storage bucket is currently fully public (`public = true`), set by migration `20260108202024_eb87e2f3-1e19-4cd0-8f96-0d6e738c2a1f.sql`. This means any user's uploaded originals are accessible to anyone who knows or can guess the storage path. The original RLS policies from the first migration (owner-only SELECT, "Generated images are publicly readable") were neutralized when the bucket was made public, since a public bucket bypasses all RLS policies for reads.

This plan:
1. Creates a new migration that sets the bucket to private (`public = false`)
2. Updates `api/generate-design.ts` to use a signed URL instead of `getPublicUrl`
3. Notes that `api/check-video-status.ts` already uses `getPublicUrl` which is fixed by Plan 01 (that plan already switches to `createSignedUrl`)

The frontend already uses `src/lib/getSignedImageUrl.ts` to generate signed URLs for all image display. The `generate-jewelry.ts` API already stores signed URLs (7-day expiry via `createSignedUrl`). The only remaining server-side caller of `getPublicUrl` on `jewelry-images` is `api/generate-design.ts` line 228–230.

## Context

**Storage path taxonomy:**
- `{userId}/originals/{timestamp}-{index}.{ext}` — uploaded originals (user uploads in Generate.tsx)
- `{userId}/style-references/{timestamp}.{ext}` — style reference uploads (Generate.tsx)
- `{userId}/generated/{imageRecordId}-{index}.png` — AI-generated images (generate-jewelry.ts)
- `{userId}/designs/{timestamp}.png` — marketing design outputs (generate-design.ts)
- `videos/{videoId}.mp4` — completed video files (check-video-status.ts)

**Existing RLS policies** (from the first migration `20260107201226_*.sql` lines 128–142):
- `"Users can upload their own jewelry images"` — INSERT WHERE first folder = auth.uid() ✓
- `"Users can view their own jewelry images"` — SELECT WHERE first folder = auth.uid() ✓
- `"Users can delete their own jewelry images"` — DELETE WHERE first folder = auth.uid() ✓
- `"Generated images are publicly readable"` — SELECT WHERE second folder = 'generated' ✓

These policies are correct in intent. Making the bucket private re-activates them. However:
- The `videos/` path (no user prefix, pattern `videos/{videoId}.mp4`) does not match `auth.uid()::text = (storage.foldername(name))[1]` since the first folder is `"videos"`, not the user's UUID. The signed URL approach bypasses this — videos will be served via signed URLs, not RLS-scoped reads.
- The frontend `Generate.tsx` uploads originals and style references via the anon client with the user's JWT, relying on RLS. This works correctly with the owner-scoped SELECT policy.
- The `src/lib/getSignedImageUrl.ts` uses `createSignedUrl` which works with a private bucket (signed URLs bypass RLS by design — they are pre-authorized).

**No frontend display code uses `getPublicUrl` directly.** All frontend image display goes through `getSignedImageUrl.ts`. ✓

## Tasks

<tasks>
  <task id="04-A">
    <title>Create migration to set bucket to private</title>
    <file>supabase/migrations/20260301000000_make_bucket_private.sql</file>
    <description>
      Create a new SQL migration file at:
      `supabase/migrations/20260301000000_make_bucket_private.sql`

      Content:
      ```sql
      -- Make jewelry-images bucket private so all access requires auth or signed URLs.
      -- The existing RLS policies (owner SELECT, owner INSERT, owner DELETE, generated public)
      -- are already in place from the initial migration and are re-activated by this change.
      -- All server-side image delivery uses signed URLs (createSignedUrl) — see generate-jewelry.ts.
      -- The "Generated images are publicly readable" RLS policy allows the frontend to read
      -- generated paths directly with a valid JWT, but generated images are primarily accessed
      -- via signed URLs returned from the API.
      UPDATE storage.buckets SET public = false WHERE id = 'jewelry-images';
      ```

      Apply this migration to the Supabase project:
      ```bash
      npx supabase db push
      # or if using migrations directly:
      # npx supabase migration up
      ```

      If running locally, the migration will be picked up automatically on next `supabase db reset` or `supabase migration up`.

      **⚠️ Existing data warning:** Any existing `video_url` values in `processing_jobs` that are public Supabase Storage URLs (no `token=` query param) will become inaccessible after this migration. These were generated before Plan 01's signed-URL fix was applied. Add the following NULL-out to the same migration so stale public video URLs don't serve broken links:

      ```sql
      -- Nullify any existing video_url values that are public (no signed token).
      -- Affected records will re-generate on next user poll or can be ignored (old completed jobs).
      UPDATE processing_jobs
      SET video_url = NULL
      WHERE video_url IS NOT NULL
        AND video_url NOT LIKE '%token=%';
      ```
    </description>
  </task>

  <task id="04-B">
    <title>Replace getPublicUrl with createSignedUrl in generate-design.ts</title>
    <file>api/generate-design.ts</file>
    <description>
      `api/generate-design.ts` lines 228–234 currently use `getPublicUrl` to get the URL of the uploaded design image. With a private bucket, this URL will return a 400/403 to any client. Replace with `createSignedUrl`.

      **Before (lines 228–234):**
      ```typescript
      const { data: { publicUrl } } = supabase.storage
        .from('jewelry-images')
        .getPublicUrl(fileName);

      console.log('Design generated and uploaded:', publicUrl);

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

      console.log('Design generated and uploaded:', signedUrlData.signedUrl);

      return sendCorsResponse(res, 200, { success: true, designUrl: signedUrlData.signedUrl });
      ```

      Note: `createSignedUrl` is async and must be awaited. Ensure the surrounding function is already `async` (it is — `handler` is declared as `async function handler(...)`).

      Also note: `fileName` must be a relative path within the bucket (not a full URL). Verify what `fileName` is set to at the upload site (line ~220). It should be a path like `{userId}/designs/{timestamp}.png`. If it is a full Supabase URL, extract just the path portion before calling `createSignedUrl`.
    </description>
  </task>
</tasks>

## Verification

```bash
# 1. Confirm bucket is set to private in new migration
grep -n "public = false" supabase/migrations/20260301000000_make_bucket_private.sql
# Expected: 1 match

# 2. Confirm no getPublicUrl calls remain in any api/ file
grep -rn "getPublicUrl" api/
# Expected: no output

# 3. Confirm generate-design.ts uses createSignedUrl
grep -n "createSignedUrl" api/generate-design.ts
# Expected: 1+ matches

# 4. TypeScript compiles cleanly
npx tsc --noEmit

# 5. Manual verification (requires Supabase environment):
# After migration: attempt to access a storage URL without a token
# curl https://<project>.supabase.co/storage/v1/object/public/jewelry-images/test.png
# Expected: 400 or 403 (not 200)
```

## must_haves

- `jewelry-images` bucket `public` column is `false` after migration runs
- No `getPublicUrl` calls remain in `api/` directory
- `api/generate-design.ts` stores and returns a signed URL (containing `token=`) instead of a public URL
- `api/generate-jewelry.ts` already uses `createSignedUrl` — verify no regression (grep confirms no `getPublicUrl` in that file)
- `api/check-video-status.ts` `getPublicUrl` usage is removed by Plan 01 (Plan 04 executor must verify Plan 01 was applied first, or apply the check-video-status.ts change as part of this plan if Plan 01 has not yet run)
- TypeScript compilation succeeds with no new errors
