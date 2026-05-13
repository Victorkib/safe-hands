-- Row Level Security on storage.objects for Safe Hands buckets.
-- Run in Supabase SQL Editor after 021_ensure_all_app_storage_buckets.sql (buckets must exist).
--
-- Your API routes use SUPABASE_SERVICE_ROLE_KEY for uploads/deletes, which bypasses RLS.
-- These policies still matter for: future client-side uploads, tooling that uses the anon key,
-- and defense-in-depth if the Storage API is called with a user JWT.
--
-- Public bucket URLs used in <img src="…"> are usually served without evaluating these SELECT
-- policies; SELECT here mainly scopes list/download when using the JS client with a user session.
--
-- Path conventions (must match app code):
--   listing-images:    "{userId}/{filename}"           → app/api/listings*
--   dispute-evidence:  "{a}/{b}/{userId}/{filename}"   → lib/evidenceUpload.js (e.g. delivery/ship/…)

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

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
-- Third path segment is always the uploader's user id (see evidenceUpload objectPath).

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
