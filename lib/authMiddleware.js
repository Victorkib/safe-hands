/**
 * @deprecated This file is DEPRECATED and should NOT be used.
 *
 * The manual JWT verification approach used here is unnecessary.
 * Supabase already handles JWT verification through its client.
 *
 * ✅ USE INSTEAD: lib/getServerSupabase.js
 *
 * Example migration:
 *
 * BEFORE (old way - DON'T USE):
 * ```javascript
 * import { requireAuth } from '@/lib/authMiddleware';
 *
 * export const GET = requireAuth(async (request) => {
 *   const user = request.user;
 *   // ...
 * });
 * ```
 *
 * AFTER (new way - USE THIS):
 * ```javascript
 * import { getServerSupabase, withAuth } from '@/lib/getServerSupabase';
 *
 * // Option 1: Using withAuth wrapper
 * export const GET = withAuth(async (request) => {
 *   const user = request.user;
 *   const supabase = request.supabase;
 *   // ...
 * });
 *
 * // Option 2: Direct usage
 * export async function GET(request) {
 *   const supabase = getServerSupabase(request);
 *   const { data: { user } } = await supabase.auth.getUser();
 *   // ...
 * }
 * ```
 *
 * Benefits of new approach:
 * - Uses Supabase's built-in auth (no manual JWT verification)
 * - Simpler code, less boilerplate
 * - More maintainable
 * - Properly handles token refresh
 */

// Keep this file for reference, but mark as deprecated
export const DEPRECATED = true;
export const DEPRECATION_MESSAGE = 'Use lib/getServerSupabase.js instead';

// Original code below - DO NOT USE
/*
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { supabaseAdmin } from './supabaseClient.js';

// ... original implementation ...
*/

export default {
  DEPRECATED,
  DEPRECATION_MESSAGE,
  message: 'This module is deprecated. Use lib/getServerSupabase.js instead.',
};
