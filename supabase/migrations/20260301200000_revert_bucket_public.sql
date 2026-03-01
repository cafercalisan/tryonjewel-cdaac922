-- Revert bucket to public: frontend anon client cannot create signed URLs on private buckets.
-- RLS policies still protect upload/delete operations.
-- Generated images already have a "publicly readable" SELECT policy.
UPDATE storage.buckets SET public = true WHERE id = 'jewelry-images';
