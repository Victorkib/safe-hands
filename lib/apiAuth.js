import { createClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/getServerSupabase';

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Resolve authenticated user from either:
 * 1) Cookie-based session (preferred), or
 * 2) Bearer token fallback for explicit token clients.
 */
export async function getAuthenticatedUser(request) {
  const cookieSupabase = await getServerSupabase(request);
  const {
    data: { user: cookieUser },
  } = await cookieSupabase.auth.getUser();

  if (cookieUser) {
    return { user: cookieUser, authMethod: 'cookie' };
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, authMethod: null };
  }

  const token = authHeader.substring(7);
  const {
    data: { user: bearerUser },
  } = await serviceSupabase.auth.getUser(token);

  return { user: bearerUser || null, authMethod: bearerUser ? 'bearer' : null };
}

export function unauthorizedResponse() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
