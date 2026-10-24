import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseClientOptions {
  supabaseUrl?: string;
  supabaseKey?: string;
  authToken?: string;
}

const DEFAULT_SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://rezhfgedjeucljtnsptw.supabase.co';

const DEFAULT_SUPABASE_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_VWyG4gPFpoAAuHYUhcP46Q_sNJFZ5HN';

/**
 * Creates a configured Supabase client.
 * If authToken is provided, requests will be authenticated under that user session,
 * allowing PostgreSQL Row Level Security (RLS) policies to apply directly.
 */
export function createSettingsSupabaseClient(options?: SupabaseClientOptions): SupabaseClient {
  const url = options?.supabaseUrl || DEFAULT_SUPABASE_URL;
  const key = options?.supabaseKey || DEFAULT_SUPABASE_KEY;

  if (options?.authToken) {
    return createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${options.authToken}`,
        },
      },
    });
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

