---
wave: 1
depends_on: []
files_modified:
  - api/check-video-status.ts
autonomous: true
requirements:
  - SEC-01
---

# Plan 01: Strip API Key from Stored Video URL

## Goal

The Google API key must never appear in any database column. Currently, when Supabase video upload fails, the raw Google download URI (which includes `&key=<GOOGLE_API_KEY>` appended at line 106) is stored directly into `videos.video_url`. Any future read of that row leaks the API key to whoever receives the URL.

## Context

**File:** `api/check-video-status.ts`

The leak path is:

1. Line 106: `const videoResponse = await fetch(`${videoUri}&key=${GOOGLE_API_KEY}`);`
   — `videoUri` is the bare Google storage URI; the key is appended here only to authenticate the download fetch. This is correct.

2. Lines 121–126: If `uploadError` is truthy (Supabase upload failed), execution falls through to the catch-block bypass:
   ```typescript
   await supabase.from('videos').update({ status: 'completed', video_url: videoUri, ... }).eq('id', videoId);
   ```
   `videoUri` here is the raw bare URI from the operation response — it does NOT contain the key. The `fetch` on line 106 added the key inline to the fetch call only.

   **But wait:** Re-reading line 106 carefully, `videoUri` itself is the base URI (from operationData). The string `${videoUri}&key=${GOOGLE_API_KEY}` is only constructed as the fetch argument, not stored in `videoUri`. So `videoUri` itself is clean.

3. **The actual leak:** Line 116 uses `getPublicUrl` for the Supabase-uploaded copy, which is correct. Line 125 stores `videoUri` (bare Google URI) as fallback. This is a different security issue — users get a temporary Google signed URI that may expire — but the API key is NOT embedded in `videoUri`.

4. **The REAL risk confirmed by CONCERNS.md section 4.4:** "If Supabase upload fails, the code falls back to storing the raw Google API URI (including the API key in the query string: `${videoUri}&key=${GOOGLE_API_KEY}` at line 106)."

   Looking more carefully: `videoUri` as extracted from `operationData` at lines 97–102 is the bare URI. Line 106 constructs `${videoUri}&key=${GOOGLE_API_KEY}` **only for the fetch call**. The variable `videoUri` itself is never mutated to include the key.

   However: the fallback at line 125 stores `videoUri` (the raw Google URI) which may require the key to access. This is a usability problem (URL goes stale) but not a key leak per se.

   **The correct fix:** Regardless of whether the key is literally in `videoUri`, storing any Google transient URI is wrong. On upload failure, the handler should mark status as `error` (not `completed`) and refund credits rather than store a useless or potentially key-bearing URL.

## Tasks

<tasks>
  <task id="01-A">
    <title>Replace fallback storage of raw Google URI with error + credit refund</title>
    <file>api/check-video-status.ts</file>
    <description>
      At lines 121–126 in `api/check-video-status.ts`, when Supabase upload fails (the `uploadError` path or the outer catch `uploadErr`), the code currently falls through to store the raw Google URI in `videos.video_url` and return `status: 'completed'`. This raw URI is transient (Google access tokens expire) and depending on the response schema could include auth credentials.

      Replace this fallback with proper error handling:
      1. In the catch block at line 121 (`catch (uploadErr)`), after logging the error, do NOT fall through.
      2. Call `refundCredits(supabase, user.id, VIDEO_CREDIT_COST)` if `!isAdminUser`.
      3. Update the video record: `status: 'error'`, `error_message: 'Video yüklenemedi, krediniz iade edildi.'`
      4. Return `sendCorsResponse(res, 200, { success: true, status: 'error', errorMessage: '...', refunded: !isAdminUser })`
      5. Remove lines 125–126 entirely (the fallback `update` + `return` that stores `videoUri`).

      **Before (lines 104–126):**
      ```typescript
      if (videoUri) {
        try {
          const videoResponse = await fetch(`${videoUri}&key=${GOOGLE_API_KEY}`);
          if (videoResponse.ok) {
            const videoBlob = await videoResponse.arrayBuffer();
            const storagePath = `videos/${videoId}.mp4`;

            const { error: uploadError } = await supabase.storage
              .from('jewelry-images')
              .upload(storagePath, videoBlob, { contentType: 'video/mp4', upsert: true });

            if (!uploadError) {
              const { data: publicUrlData } = supabase.storage.from('jewelry-images').getPublicUrl(storagePath);
              await supabase.from('videos').update({ status: 'completed', video_url: publicUrlData.publicUrl, error_message: null }).eq('id', videoId);
              return sendCorsResponse(res, 200, { success: true, status: 'completed', videoUrl: publicUrlData.publicUrl });
            }
          }
        } catch (uploadErr) {
          console.error('Error uploading video:', uploadErr);
        }

        await supabase.from('videos').update({ status: 'completed', video_url: videoUri, error_message: null }).eq('id', videoId);
        return sendCorsResponse(res, 200, { success: true, status: 'completed', videoUrl: videoUri });
      }
      ```

      **After:**
      ```typescript
      if (videoUri) {
        try {
          const videoResponse = await fetch(`${videoUri}&key=${GOOGLE_API_KEY}`);
          if (!videoResponse.ok) {
            throw new Error(`Video download failed: ${videoResponse.status}`);
          }
          const videoBlob = await videoResponse.arrayBuffer();
          const storagePath = `videos/${videoId}.mp4`;

          const { error: uploadError } = await supabase.storage
            .from('jewelry-images')
            .upload(storagePath, videoBlob, { contentType: 'video/mp4', upsert: true });

          if (uploadError) {
            throw new Error(`Storage upload failed: ${uploadError.message}`);
          }

          const { data: signedUrlData } = await supabase.storage
            .from('jewelry-images')
            .createSignedUrl(storagePath, 7 * 24 * 60 * 60);

          const videoUrl = signedUrlData?.signedUrl;
          if (!videoUrl) throw new Error('Could not generate signed URL for video');

          await supabase.from('videos').update({ status: 'completed', video_url: videoUrl, error_message: null }).eq('id', videoId);
          return sendCorsResponse(res, 200, { success: true, status: 'completed', videoUrl });
        } catch (uploadErr) {
          console.error('Error uploading video:', uploadErr);
          if (!isAdminUser) await refundCredits(supabase, user.id, VIDEO_CREDIT_COST);
          await supabase.from('videos').update({
            status: 'error',
            error_message: 'Video depolanamadı, krediniz iade edildi.',
          }).eq('id', videoId);
          return sendCorsResponse(res, 200, { success: true, status: 'error', errorMessage: 'Video upload failed. Credits refunded.', refunded: !isAdminUser });
        }
      }
      ```

      Note: The video URL stored is now a 7-day signed URL (matching the pattern used in `generate-jewelry.ts` line 1204). The Google API key is never stored anywhere.

      Also note: `getPublicUrl` was previously used at line 116. Since the bucket is being made private in Plan 04, signed URLs must be used here. Use `createSignedUrl` with `7 * 24 * 60 * 60` seconds.
    </description>
  </task>
</tasks>

## Verification

```bash
# After applying this plan:

# 1. Grep confirms no stored raw Google URI path remains
grep -n "video_url: videoUri" api/check-video-status.ts
# Expected: no output

# 2. Grep confirms no getPublicUrl used for video storage path
grep -n "getPublicUrl" api/check-video-status.ts
# Expected: no output

# 3. Grep confirms GOOGLE_API_KEY is only used in fetch call, never in DB update
grep -n "GOOGLE_API_KEY" api/check-video-status.ts
# Expected: lines for process.env access and the fetch URL only — no .update() calls containing it

# 4. TypeScript compiles cleanly
npx tsc --noEmit
```

## must_haves

- `GOOGLE_API_KEY` value does not appear in any string passed to `supabase.from('videos').update()`
- Raw Google URI (`videoUri`) is not stored in `videos.video_url` under any code path
- When Supabase upload fails, credits are refunded (if non-admin) and status is `error`, not `completed`
- Stored video URL is a Supabase signed URL (contains `token=` not `key=`)
