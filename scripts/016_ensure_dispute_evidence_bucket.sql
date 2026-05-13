-- Ensure storage bucket for dispute/delivery evidence exists (public URLs used by the app).
-- Run once in the Supabase SQL editor for the Safe Hands project.
-- You can also create the bucket in Dashboard → Storage with the same name and MIME allowlist.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dispute-evidence',
  'dispute-evidence',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
