/**
 * Shared validation and storage uploads for dispute / delivery evidence images.
 * Uses the `dispute-evidence` bucket (create in Supabase if missing).
 */

import { createHash } from 'node:crypto';

export const ALLOWED_EVIDENCE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** 5MB — reasonable for phone camera JPEGs without paid processing */
export const MAX_EVIDENCE_FILE_BYTES = 5 * 1024 * 1024;

export const MAX_FILES_DISPUTE_CREATE = 3;
export const MAX_FILES_SHIP = 5;
export const MAX_FILES_CONFIRM_DELIVERY = 5;
export const MAX_FILES_DISPUTE_APPEND = 3;

/**
 * @param {File} file
 * @returns {string|null} Error message or null if valid
 */
export function validateEvidenceFile(file) {
  if (!file || typeof file.arrayBuffer !== 'function') {
    return 'Invalid file upload';
  }
  if (!ALLOWED_EVIDENCE_MIME_TYPES.includes(file.type)) {
    return `Invalid file type: ${file.type || 'unknown'}. Only JPEG, PNG, and WebP are allowed.`;
  }
  if (file.size > MAX_EVIDENCE_FILE_BYTES) {
    return `File "${file.name}" exceeds 5MB limit`;
  }
  return null;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} storageClient Service-role Supabase client
 * @param {string} userId Auth user id (folder scoping)
 * @param {File[]} files
 * @param {string} pathPrefix e.g. 'delivery/ship', 'delivery/confirm', 'dispute/create'
 * @param {{ maxFiles?: number }} [opts]
 * @returns {Promise<{ error: string|null, urls: string[] }>}
 */
export async function uploadEvidenceFilesToBucket(
  storageClient,
  userId,
  files,
  pathPrefix,
  opts = {}
) {
  const maxFiles = opts.maxFiles ?? 10;
  const list = (files || []).filter((f) => f && typeof f.arrayBuffer === 'function');

  if (list.length > maxFiles) {
    return { error: `Maximum ${maxFiles} evidence files allowed`, urls: [] };
  }

  const urls = [];
  const seenHashes = new Set();

  for (const file of list) {
    const validationError = validateEvidenceFile(file);
    if (validationError) {
      return { error: validationError, urls: [] };
    }

    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);
    const hash = createHash('sha256').update(buf).digest('hex');
    if (seenHashes.has(hash)) {
      return {
        error: 'Duplicate images detected (same file attached more than once). Use distinct photos.',
        urls: [],
      };
    }
    seenHashes.add(hash);

    const fileExt = file.name.split('.').pop();
    const safeExt = fileExt ? fileExt.toLowerCase() : 'img';
    const objectPath = `${pathPrefix}/${userId}/${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${safeExt}`;

    const { error: uploadError } = await storageClient.storage
      .from('dispute-evidence')
      .upload(objectPath, buf, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return {
        error: uploadError.message || `Failed to upload file: ${file.name}`,
        urls: [],
      };
    }

    const {
      data: { publicUrl },
    } = storageClient.storage.from('dispute-evidence').getPublicUrl(objectPath);
    urls.push(publicUrl);
  }

  return { error: null, urls };
}
