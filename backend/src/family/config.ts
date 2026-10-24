if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class DummyWebSocket {};
}

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
  'https://giuftrigtoackyrfbacw.supabase.co';

const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpdWZ0cmlndG9hY2t5cmZiYWN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1Nzk5NDksImV4cCI6MjEwODE1NTk0OX0.4YlWVmgKdYtGGDhRbsUr6w4jdOL67I6Z8Tta0bg80eM';

const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpdWZ0cmlndG9hY2t5cmZiYWN3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjU3OTk0OSwiZXhwIjoyMTA4MTU1OTQ5fQ.UUjogJoGc_94SqlKcaaHdQKtp_eE1MCe4_i5lqj8690';

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  supabaseUrl,
  supabaseAnonKey,
  supabaseServiceRoleKey,
  defaultHouseholdId: process.env.DEFAULT_HOUSEHOLD_ID || 'household-kumar-family'
};

let adminClientInstance: SupabaseClient | null = null;

/**
 * Returns a Supabase Admin Client using the service role key or anon key.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (!adminClientInstance) {
    const currentUrl = process.env.SUPABASE_URL || config.supabaseUrl;
    const currentKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      config.supabaseServiceRoleKey ||
      config.supabaseAnonKey;
    adminClientInstance = createClient(currentUrl, currentKey, {
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
