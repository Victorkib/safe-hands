/**
 * Server-Side Supabase Client Factory
 * Creates authenticated Supabase clients for API routes
 *
 * Usage:
 *   import { getServerSupabase, requireAuth } from '@/lib/getServerSupabase';
 *
 *   export async function GET(request) {
 *     const supabase = getServerSupabase(request);
 *     const { data: { user } } = await supabase.auth.getUser();
 *     // ... your authenticated logic
 *   }
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Extract access token from request Authorization header
 * @param {Request} request - Next.js request object
 * @returns {string|null} Access token or null
 */
function extractToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Create an authenticated Supabase client for server-side use
 * @param {Request} request - Next.js request object
 * @returns {Object} Authenticated Supabase client
 * @throws {Error} If no valid token found
 */
export function getServerSupabase(request) {
  const token = extractToken(request);

  if (!token) {
    throw new Error('No valid Authorization header found');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Get the current authenticated user from request
 * @param {Request} request - Next.js request object
 * @returns {Promise<Object>} User object
 * @throws {Error} If not authenticated
 */
export async function requireAuth(request) {
  const supabase = getServerSupabase(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Not authenticated');
  }

  return user;
}

/**
 * Middleware wrapper for API routes that requires authentication
 * @param {Function} handler - API route handler
 * @returns {Function} Wrapped handler with user attached
 */
export function withAuth(handler) {
  return async (request) => {
    try {
      const supabase = getServerSupabase(request);
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Attach user and supabase to request
      request.user = user;
      request.supabase = supabase;

      return handler(request);
    } catch (error) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  };
}

/**
 * Middleware wrapper that requires specific role
 * @param {string[]} allowedRoles - Array of allowed roles
 * @param {Function} handler - API route handler
 * @returns {Function} Wrapped handler
 */
export function withRole(allowedRoles, handler) {
  return async (request) => {
    try {
      const supabase = getServerSupabase(request);
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Get user role from users table
      const { data: userProfile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!userProfile || !allowedRoles.includes(userProfile.role)) {
        return Response.json(
          { error: 'Forbidden: Insufficient permissions' },
          { status: 403 },
        );
      }

      // Attach user, supabase, and role to request
      request.user = user;
      request.supabase = supabase;
      request.userRole = userProfile.role;

      return handler(request);
    } catch (error) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  };
}

export default {
  getServerSupabase,
  requireAuth,
  withAuth,
  withRole,
};
