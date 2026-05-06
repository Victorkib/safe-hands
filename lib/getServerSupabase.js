/**
 * Server-Side Supabase Client Factory
 * Creates authenticated Supabase clients for API routes using cookies.
 *
 * Usage:
 *   import { getServerSupabase, requireAuth } from '@/lib/getServerSupabase';
 *
 *   export async function GET(request) {
 *     const supabase = await getServerSupabase(request);
 *     const { data: { user } } = await supabase.auth.getUser();
 *     // ... your authenticated logic
 *   }
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Create a cookie-based Supabase server client.
 * Accepts an optional request arg for backward compatibility.
 * @param {Request} [_request] - Next.js request object (unused, kept for compat)
 * @returns {Promise<Object>} Authenticated Supabase client
 */
export async function getServerSupabase(_request) {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Ignored when called from a Server Component where cookies are read-only.
        }
      },
    },
  });
}

/**
 * Get the current authenticated user from request cookies
 * @param {Request} [_request] - Next.js request object (optional, for compat)
 * @returns {Promise<Object>} User object
 * @throws {Error} If not authenticated
 */
export async function requireAuth(_request) {
  const supabase = await getServerSupabase(_request);
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
      const supabase = await getServerSupabase(request);
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
      const supabase = await getServerSupabase(request);
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
          { status: 403 }
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
