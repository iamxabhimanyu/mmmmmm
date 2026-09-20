import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';

const getEnv = (key: string): string => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key] as string;
    }
  } catch {}
  return '';
};

// Centralized Supabase Configuration using specified environment variables
export const SUPABASE_URL: string =
  getEnv('VITE_SUPABASE_URL') || 'https://lvbtnfszzojsvisroxiq.supabase.co';

export const SUPABASE_PUBLISHABLE_KEY: string =
  getEnv('VITE_SUPABASE_PUBLISHABLE_KEY') ||
  getEnv('VITE_SUPABASE_ANON_KEY') ||
  '';

export const isSupabaseConfigured: boolean = Boolean(
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY.trim().length > 0
);

/**
 * Centralized Supabase Client.
 * Configured with automatic session persistence in localStorage, token auto-refresh,
 * and URL detection for email verification redirects.
 */
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY || 'placeholder-publishable-key-pending-configuration',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'mausam_supabase_auth_session',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  }
);

export type { User, Session };
