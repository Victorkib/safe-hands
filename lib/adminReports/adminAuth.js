import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/apiAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * @param {Request} request
 * @returns {Promise<{ user: object } | { response: Response }>}
 */
export async function requireAdmin(request) {
  const { user } = await getAuthenticatedUser(request);
  if (!user) {
    return { response: unauthorizedResponse() };
  }

  const { data: profile, error } = await supabase
    .from('users')
    .select('id, role, email, full_name')
    .eq('id', user.id)
    .single();

  if (error || profile?.role !== 'admin') {
    return {
      response: Response.json({ error: 'Admin access required' }, { status: 403 }),
    };
  }

  return { user, profile, supabase };
}

export function getReportSupabase() {
  return supabase;
}
