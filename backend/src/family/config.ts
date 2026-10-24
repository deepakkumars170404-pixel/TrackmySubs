import dotenv from 'dotenv';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Load .env from backend directory, root, or cwd
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

export interface AppConfig {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  defaultHouseholdId: string;
}

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://rezhfgedjeucljtnsptw.supabase.co';

const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  '';

const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  '';

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  supabaseUrl,
  supabaseAnonKey,
  supabaseServiceRoleKey,
  defaultHouseholdId:
    process.env.DEFAULT_HOUSEHOLD_ID || '11111111-1111-1111-1111-111111111111'
};

let adminClientInstance: SupabaseClient | null = null;

/**
 * Returns a Supabase Admin Client using the service role key or anon key.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (!adminClientInstance) {
    const key = config.supabaseServiceRoleKey || config.supabaseAnonKey;
    if (!config.supabaseUrl || !key) {
      console.warn(
        '[Supabase] Warning: SUPABASE_URL or API Key is missing. Check your .env file.'
      );
    }
    adminClientInstance = createClient(config.supabaseUrl, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }
  return adminClientInstance;
}

/**
 * Creates a user-scoped Supabase client that forwards the incoming user JWT token,
 * guaranteeing that Supabase Row Level Security (RLS) policies are respected.
 */
export function createUserClient(token: string): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

