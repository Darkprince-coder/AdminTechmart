// src/context/AuthContext.jsx  (ADMIN PROJECT — drop-in replacement)
// Fixes:
// 1. onAuthStateChange fires INITIAL_SESSION on mount causing double fetchProfile
// 2. fetchProfile failure left app spinning forever
// 3. fetchProfile was recreated every render causing potential loops

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session,  setSession]  = useState(undefined); // undefined = still checking
  const [profile,  setProfile]  = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError,   setProfileError]   = useState(false);

  // Track whether we've already handled the initial session
  // so onAuthStateChange INITIAL_SESSION doesn't cause a double-fetch
  const initialHandled = useRef(false);

  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError(false);
    try {
      const { data, error } = await supabase.rpc('get_my_profile');
      if (error) throw error;
      const p = data?.[0] ?? null;
      setProfile(p);
      if (!p) {
        // Authenticated but no profile row yet — not a crash, just unprovisioned
        console.warn('No user_profiles row found for this user.');
      }
    } catch (err) {
      console.error('Profile fetch error:', err.message);
      setProfile(null);
      setProfileError(true);
    } finally {
      setProfileLoading(false);
    }
  }, []); // stable — no external deps

  useEffect(() => {
    // Get the initial session once
    supabase.auth.getSession().then(({ data: { session } }) => {
      initialHandled.current = true;
      setSession(session);
      if (session?.user) fetchProfile();
      else setSession(null); // explicitly null (not undefined) when logged out
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Skip the INITIAL_SESSION event — already handled above
        if (event === 'INITIAL_SESSION') return;

        setSession(session);
        if (session?.user) {
          fetchProfile();
        } else {
          setProfile(null);
          setProfileError(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = async (email, password) =>
    supabase.auth.signInWithPassword({ email, password });

  const signOut = async () => {
    setProfile(null);
    setProfileError(false);
    await supabase.auth.signOut();
  };

  const isAdmin   = profile?.role === 'admin';
  const isManager = profile?.role === 'manager';
  const shopId    = profile?.shop_id ?? null;

  // loading = true only while session state is genuinely unknown
  // Once session is known (null or object), and profile fetch is done, loading = false
  const loading = session === undefined || (!!session && profileLoading);

  return (
    <AuthContext.Provider value={{
      session,
      profile,
      profileError,
      isAdmin,
      isManager,
      shopId,
      loading,
      signIn,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
