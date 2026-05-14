-- Same policies as documented in 022_storage_objects_policies_safe_hands.sql
-- INTENDED FOR: local Supabase (CLI / Docker) where your DB role owns storage.objects.
-- ON HOSTED SUPABASE: this will usually fail with ERROR 42501 must be owner of table objects.
-- Use the Dashboard flow described in 022 instead.

-- RLS is already enabled on storage.objects in Supabase; skip ALTER if you get 42501:
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ========== listing-images ==========

DROP POLICY IF EXISTS "safe_hands_listing_images_select" ON storage.objects;
CREATE POLICY "safe_hands_listing_images_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'listing-images');

DROP POLICY IF EXISTS "safe_hands_listing_images_insert" ON storage.objects;
CREATE POLICY "safe_hands_listing_images_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'listing-images'
  AND split_part(name, '/', 1) = auth.uid()::text
);

DROP POLICY IF EXISTS "safe_hands_listing_images_update" ON storage.objects;
CREATE POLICY "safe_hands_listing_images_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'listing-images'
  AND split_part(name, '/', 1) = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'listing-images'
  AND split_part(name, '/', 1) = auth.uid()::text
);

DROP POLICY IF EXISTS "safe_hands_listing_images_delete" ON storage.objects;
CREATE POLICY "safe_hands_listing_images_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'listing-images'
  AND split_part(name, '/', 1) = auth.uid()::text
);

-- ========== dispute-evidence ==========

DROP POLICY IF EXISTS "safe_hands_dispute_evidence_select" ON storage.objects;
CREATE POLICY "safe_hands_dispute_evidence_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'dispute-evidence'
  AND split_part(name, '/', 3) = auth.uid()::text
);

DROP POLICY IF EXISTS "safe_hands_dispute_evidence_insert" ON storage.objects;
CREATE POLICY "safe_hands_dispute_evidence_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'dispute-evidence'
  AND split_part(name, '/', 3) = auth.uid()::text
);

DROP POLICY IF EXISTS "safe_hands_dispute_evidence_update" ON storage.objects;
CREATE POLICY "safe_hands_dispute_evidence_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'dispute-evidence'
  AND split_part(name, '/', 3) = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'dispute-evidence'
  AND split_part(name, '/', 3) = auth.uid()::text
);

DROP POLICY IF EXISTS "safe_hands_dispute_evidence_delete" ON storage.objects;
CREATE POLICY "safe_hands_dispute_evidence_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'dispute-evidence'
  AND split_part(name, '/', 3) = auth.uid()::text
);
