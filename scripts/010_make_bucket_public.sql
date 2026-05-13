-- Make listing-images bucket public (bucket must exist first).
-- Prefer scripts/021_ensure_all_app_storage_buckets.sql — it creates listing-images and sets public in one step.
-- Run this in Supabase SQL Editor

UPDATE storage.buckets 
SET public = true 
WHERE name = 'listing-images';

-- Verify the change
SELECT 
  id, 
  name, 
  public, 
  file_size_limit, 
  allowed_mime_types,
  created_at
FROM storage.buckets 
WHERE name = 'listing-images';
