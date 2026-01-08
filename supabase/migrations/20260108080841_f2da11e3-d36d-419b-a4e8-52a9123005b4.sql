-- Make the jewelry-images bucket private for original images
UPDATE storage.buckets SET public = false WHERE id = 'jewelry-images';

-- Drop existing storage policies
DROP POLICY IF EXISTS "Users can upload their own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for generated images" ON storage.objects;

-- Create policies for private bucket with signed URL access
CREATE POLICY "Users can upload their own images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'jewelry-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'jewelry-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'jewelry-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow service role to manage all files (for edge function)
CREATE POLICY "Service role can manage all files"
ON storage.objects FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');