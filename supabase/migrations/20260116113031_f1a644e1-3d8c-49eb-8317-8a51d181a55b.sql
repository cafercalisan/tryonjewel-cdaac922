-- Make jewelry-images bucket public so videos can be accessed
UPDATE storage.buckets 
SET public = true 
WHERE id = 'jewelry-images';