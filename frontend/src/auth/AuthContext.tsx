import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { UserProfile, UserRole } from '../types';
import { isSupabaseConfigured } from '../config/env';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (fullName: string, email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  // Fetch profile from Supabase
  const fetchUserProfile = async (authUser: User): Promise<UserProfile> => {
    try {
      // Query profile matching user_id or id with authUser.id
      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .or(`user_id.eq.${authUser.id},id.eq.${authUser.id}`)
        .maybeSingle();

      if (fetchErr && fetchErr.code !== 'PGRST116') {
        console.warn('[AuthContext] Profile fetch warning:', fetchErr.message);
      }

      if (data) {
        const rawRole = (data.role as string)?.trim().toLowerCase();
        const role: UserRole = rawRole === 'worker' ? 'worker' : 'student';

        return {
          id: data.id || authUser.id,
          fullName: data.full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Canteen User',
          email: data.email || authUser.email || '',
          role: role,
        };
      }

      // If profile row does NOT exist yet in database, insert default student profile for new user
      const fallbackName = authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Student User';
      const fallbackEmail = authUser.email || '';

      const { data: createdData, error: insertErr } = await supabase
        .from('profiles')
        .insert({
          id: authUser.id,
          user_id: authUser.id,
          full_name: fallbackName,
          email: fallbackEmail,
          role: 'student',
        })
        .select('*')
        .maybeSingle();

      if (insertErr) {
        console.warn('[AuthContext] Profile auto-insert notice:', insertErr.message);
      }

      if (createdData) {
        const createdRole = (createdData.role as string)?.trim().toLowerCase() === 'worker' ? 'worker' : 'student';
        return {
          id: createdData.id || authUser.id,
          fullName: createdData.full_name || fallbackName,
          email: createdData.email || fallbackEmail,
          role: createdRole,
        };
      }

      return {
        id: authUser.id,
        fullName: fallbackName,
        email: fallbackEmail,
        role: 'student',
      };
    } catch (err) {
      console.error('[AuthContext] Error fetching profile:', err);
      return {
        id: authUser.id,
        fullName: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Student User',
        email: authUser.email || '',
        role: 'student',
      };
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    const p = await fetchUserProfile(user);
    setProfile(p);
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    // Check active session
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      if (!isMounted) return;
      setSession(currentSession);
      const currentUser = currentSession?.user || null;
      setUser(currentUser);

      if (currentUser) {
        const p = await fetchUserProfile(currentUser);
        if (isMounted) setProfile(p);
      } else {
        if (isMounted) setProfile(null);
      }
      if (isMounted) setLoading(false);
    }).catch(err => {
      console.error('Session restoration error:', err);
      if (isMounted) setLoading(false);
    });

    // Listen to Auth state changes (persistent session restoration, login, logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      const newUser = newSession?.user || null;
      setUser(newUser);

      if (newUser) {
        const p = await fetchUserProfile(newUser);
        if (isMounted) setProfile(p);
      } else {
        if (isMounted) setProfile(null);
      }
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const formatAuthError = (errMessage: string): string => {
    if (errMessage.includes('Failed to fetch') || errMessage.includes('fetch failed')) {
      return 'Network Error: Unable to connect to Supabase. Please verify your internet connection and ensure VITE_SUPABASE_URL in frontend/.env is correct and reachable.';
    }
    if (errMessage.includes('Invalid login credentials')) {
      return 'Invalid email address or password. Please check your credentials and try again.';
    }
    if (errMessage.includes('already registered')) {
      return 'An account with this email address already exists. Please log in instead.';
    }
    return errMessage;
  };

  const signIn = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    setError(null);
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      });

      if (authError) {
        const msg = formatAuthError(authError.message);
        setError(msg);
        setLoading(false);
        return { success: false, error: msg };
      }

      if (data.user) {
        const p = await fetchUserProfile(data.user);
        setProfile(p);
      }
      setLoading(false);
      return { success: true };
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : 'Network error. Please try again.';
      const msg = formatAuthError(rawMsg);
      setError(msg);
      setLoading(false);
      return { success: false, error: msg };
    }
  };

  const signUp = async (
    fullName: string,
    email: string,
    pass: string
  ): Promise<{ success: boolean; error?: string }> => {
    setError(null);
    setLoading(true);
    try {
      if (pass.length < 6) {
        const msg = 'Password must be at least 6 characters long.';
        setError(msg);
        setLoading(false);
        return { success: false, error: msg };
      }

      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: pass,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (authError) {
        const msg = formatAuthError(authError.message);
        setError(msg);
        setLoading(false);
        return { success: false, error: msg };
      }

      if (data.user) {
        const p = await fetchUserProfile(data.user);
        setProfile(p);
      }

      setLoading(false);
      return { success: true };
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : 'Network error. Please try again.';
      const msg = formatAuthError(rawMsg);
      setError(msg);
      setLoading(false);
      return { success: false, error: msg };
    }
  };

  const signOut = async (): Promise<void> => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        error,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
