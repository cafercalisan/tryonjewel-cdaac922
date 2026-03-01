-- Make jewelry-images bucket private so all access requires auth or signed URLs.
-- The existing RLS policies (owner SELECT, owner INSERT, owner DELETE, generated public)
-- are already in place from the initial migration and are re-activated by this change.
-- All server-side image delivery uses signed URLs (createSignedUrl) — see generate-jewelry.ts.
-- The "Generated images are publicly readable" RLS policy allows the frontend to read
-- generated paths directly with a valid JWT, but generated images are primarily accessed
-- via signed URLs returned from the API.
UPDATE storage.buckets SET public = false WHERE id = 'jewelry-images';

-- Nullify any existing video_url values that are public (no signed token).
-- Affected records will re-generate on next user poll or can be ignored (old completed jobs).
UPDATE processing_jobs
SET video_url = NULL
WHERE video_url IS NOT NULL
  AND video_url NOT LIKE '%token=%';
