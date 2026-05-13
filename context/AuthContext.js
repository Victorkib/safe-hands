'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authState, setAuthState] = useState('initializing');

  useEffect(() => {
    let isMounted = true;
    let recoveryInFlight = false;
    let lastRecoveryAt = 0;

    const withTimeout = async (promise, ms, fallbackMessage) => {
      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(fallbackMessage || 'Operation timed out')),
          ms
        );
      });
      try {
        return await Promise.race([promise, timeoutPromise]);
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const fetchProfileForUser = async (authUser) => {
      if (!authUser?.id) return null;
      const { data: profileData, error: profileError } = await withTimeout(
        supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single(),
        8000,
        'Profile fetch timed out'
      );
      if (profileError) {
        console.warn('[v0] Profile fetch error:', profileError.message);
        return null;
      }
      return profileData || null;
    };

    const applyUserState = async (authUser) => {
      if (!isMounted) return;

      if (!authUser) {
        setUser(null);
        setProfile(null);
        setAuthState('unauthenticated');
        setError(null);
        setLoading(false);
        return;
      }

      setUser(authUser);
      const profileData = await fetchProfileForUser(authUser);
      if (!isMounted) return;

      setProfile(profileData);
      setAuthState('authenticated');
      setError(null);
      setLoading(false);
    };

    const initializeAuth = async () => {
      try {
        setAuthState('initializing');
        setLoading(true);

        // Get current user
        const {
          data: { user: authUser },
          error: userError,
        } = await withTimeout(
          supabase.auth.getUser(),
          8000,
          'Auth initialization timed out'
        );

        if (userError) {
          // No active session is expected for logged-out visitors.
          if (userError?.name === 'AuthSessionMissingError') {
            await applyUserState(null);
            return;
          }
          console.error('[v0] Auth error:', userError);
          setError(userError);
          if (isMounted) {
            setAuthState('error');
            setLoading(false);
          }
          return;
        }

        await applyUserState(authUser || null);
      } catch (err) {
        console.error('[v0] Initialize auth error:', err);
        if (isMounted) {
          setError(err);
          setAuthState('error');
          setLoading(false);
        }
      }
    };

    const refreshAuth = async (reason = 'manual') => {
      if (!isMounted) return;
      const now = Date.now();
      if (recoveryInFlight || now - lastRecoveryAt < 30000) return;

      recoveryInFlight = true;
      lastRecoveryAt = now;

      try {
        setAuthState('recovering');

        const {
          data: { session },
        } = await withTimeout(
          supabase.auth.getSession(),
          8000,
          `Session refresh timed out (${reason})`
        );

        const authUser = session?.user || null;
        await applyUserState(authUser);
      } catch (err) {
        console.error('[v0] Auth recovery failed:', err);
        if (isMounted) {
          setError(err);
          setAuthState('error');
          setLoading(false);
        }
      } finally {
        recoveryInFlight = false;
      }
    };

    initializeAuth();

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      setAuthState('recovering');

      // Supabase onAuthStateChange provides a session, not a user
      const authUser = session?.user ?? null;

      await applyUserState(authUser);
      if (process.env.NODE_ENV !== 'production') {
        console.info('[v0] Auth event:', event);
      }
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshAuth('visibility');
      }
    };

    const handleWindowFocus = () => {
      refreshAuth('focus');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, error, authState }}>
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
