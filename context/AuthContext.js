'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        // Get current user
        const {
          data: { user: authUser },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          console.error('[v0] Auth error:', userError);
          setError(userError);
          if (isMounted) setLoading(false);
          return;
        }

        if (authUser && isMounted) {
          setUser(authUser);

          // Guard against undefined authUser.id which would trigger
          // a REST call like id=eq.undefined and cause 400 (invalid uuid)
          if (!authUser.id) {
            console.warn(
              '[v0] Auth user present but missing id; skipping profile fetch',
            );
            if (isMounted) setLoading(false);
            return;
          }

          // Fetch user profile relying on RLS (avoids id=eq.undefined issues)
          // RLS limits non-admins to only their own row, admins can see all.
          // maybeSingle() prevents 400 on empty and returns null instead.
          const { data: profileData, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single();

          if (profileError) {
            console.error('[v0] Profile fetch error:', profileError);
          } else if (isMounted) {
            setProfile(profileData);
          }
        }

        if (isMounted) setLoading(false);
      } catch (err) {
        console.error('[v0] Initialize auth error:', err);
        if (isMounted) {
          setError(err);
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      // Supabase onAuthStateChange provides a session, not a user
      const authUser = session?.user ?? null;

      if (authUser?.id) {
        setUser(authUser);

        // Fetch profile when auth state changes
        try {
          const { data: profileData, error: profileErr } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single();

          if (profileErr) {
            console.warn(
              '[v0] Profile fetch on auth change failed:',
              profileErr.message,
            );
          } else if (profileData) {
            setProfile(profileData);
          }
        } catch (e) {
          console.warn(
            '[v0] Profile fetch on auth change threw:',
            e?.message || e,
          );
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
