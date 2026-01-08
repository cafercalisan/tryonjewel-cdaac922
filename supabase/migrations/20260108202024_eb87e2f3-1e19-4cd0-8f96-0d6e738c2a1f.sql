-- Make the jewelry-images bucket public so generated images can be viewed
UPDATE storage.buckets SET public = true WHERE id = 'jewelry-images';