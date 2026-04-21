import { create } from 'zustand';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User } from '../types';

const DEFAULT_AVATAR_COLOR = '#3B82F6';
const AUTH_REQUEST_TIMEOUT_MS = 10000;
const MISSING_SCHEMA_MESSAGE =
  'Supabase schema is not installed for this project. Run the initial migration so the profiles table exists.';
let authListenerInitialized = false;

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
  });

  try {
    return (await Promise.race([promise, timeoutPromise])) as T;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function buildProfileFromAuthUser(
  authUser: SupabaseAuthUser,
  fallbackName?: string
): User {
  const metadata = authUser.user_metadata ?? {};

  return {
    id: authUser.id,
    email: authUser.email ?? '',
    name:
      fallbackName ??
      metadata.name ??
      metadata.full_name ??
      metadata.display_name ??
      'User',
    avatar_color: DEFAULT_AVATAR_COLOR,
    theme: 'light',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function getOrCreateProfile(
  authUser: SupabaseAuthUser,
  fallbackName?: string
): Promise<User> {
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (fetchError) {
    if (isMissingProfilesTableError(fetchError)) {
      throw new Error(MISSING_SCHEMA_MESSAGE);
    }

    throw fetchError;
  }

  if (profile) {
    return profile as User;
  }

  const profileToInsert = buildProfileFromAuthUser(authUser, fallbackName);
  const { data: createdProfile, error: insertError } = await supabase
    .from('profiles')
    .insert(profileToInsert)
    .select('*')
    .single();

  if (insertError) {
    if (isMissingProfilesTableError(insertError)) {
      throw new Error(MISSING_SCHEMA_MESSAGE);
    }

    throw insertError;
  }

  return createdProfile as User;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  hydrated: boolean;
  error: string | null;
  signUp: (email: string, password: string, name: string) => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  hydrated: false,
  error: null,

  hydrate: async () => {
    initializeAuthListener(set);

    if (useAuthStore.getState().hydrated) {
      set({ loading: false });
      return;
    }

    set({ loading: true });
    try {
      const {
        data: { session },
      } = await withTimeout(
        supabase.auth.getSession(),
        AUTH_REQUEST_TIMEOUT_MS,
        'Auth request timed out. Please check your internet or Supabase configuration.'
      );

      if (session?.user) {
        const profile = await withTimeout(
          getOrCreateProfile(session.user),
          AUTH_REQUEST_TIMEOUT_MS,
          'Loading your profile timed out. Please try again.'
        );
        set({ user: profile, error: null });
      } else {
        set({ user: null, error: null });
      }
    } catch (error) {
      console.error('Hydration error:', error);
      const message = error instanceof Error ? error.message : 'Failed to load user';
      set({ user: null, error: message });
    } finally {
      set({ loading: false, hydrated: true });
    }
  },

  signUp: async (email: string, password: string, name: string) => {
    set({ loading: true, error: null });
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getAuthRedirectUrl(),
          data: {
            name,
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      if (data.user && data.session) {
        const profile = await getOrCreateProfile(data.user, name);
        set({ user: profile, error: null });
        return false;
      }

      if (data.user) {
        set({ user: null, error: null });
        return true;
      }

      throw new Error('Sign up succeeded but no user was returned');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signup failed';
      set({ error: message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  signIn: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      const authUser = data.user ?? (await supabase.auth.getUser()).data.user;

      if (authUser) {
        const profile = await getOrCreateProfile(authUser, nameFallback(authUser, email));
        set({ user: profile, error: null });
        return;
      }

      throw new Error('Signed in but could not load the user profile');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign in failed';
      set({ error: message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      set({ user: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign out failed';
      set({ error: message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },
}));

function nameFallback(authUser: SupabaseAuthUser, email: string) {
  const metadata = authUser.user_metadata ?? {};

  return (
    metadata.name ??
    metadata.full_name ??
    metadata.display_name ??
    email.split('@')[0] ??
    'User'
  );
}

function isMissingProfilesTableError(error: { message?: string; code?: string }) {
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    (error.message ?? '').toLowerCase().includes('profiles')
  );
}

function initializeAuthListener(
  set: (partial: Partial<AuthState> | ((state: AuthState) => Partial<AuthState>)) => void
) {
  if (authListenerInitialized) {
    return;
  }

  authListenerInitialized = true;

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      set({ user: null, error: null, loading: false, hydrated: true });
      return;
    }

    if (!session?.user) {
      return;
    }

    if (event === 'INITIAL_SESSION') {
      return;
    }

    // Supabase auth events are processed synchronously. Deferring any follow-up
    // Supabase queries avoids the deadlock described in the official docs.
    setTimeout(() => {
      void (async () => {
        try {
          const profile = await getOrCreateProfile(
            session.user,
            nameFallback(session.user, session.user.email ?? 'User')
          );
          set({ user: profile, error: null });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to load user profile';
          set({ user: null, error: message });
        }
      })();
    }, 0);
  });
}

function getAuthRedirectUrl() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return `${window.location.origin}/`;
}
