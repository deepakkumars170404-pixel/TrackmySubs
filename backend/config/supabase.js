import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://giuftrigtoackyrfbacw.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpdWZ0cmlndG9hY2t5cmZiYWN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1Nzk5NDksImV4cCI6MjEwODE1NTk0OX0.4YlWVmgKdYtGGDhRbsUr6w4jdOL67I6Z8Tta0bg80eM";
const DEFAULT_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpdWZ0cmlndG9hY2t5cmZiYWN3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjU3OTk0OSwiZXhwIjoyMTA4MTU1OTQ5fQ.UUjogJoGc_94SqlKcaaHdQKtp_eE1MCe4_i5lqj8690";

const url =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  DEFAULT_SUPABASE_URL;

const anonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_ANON_KEY;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  DEFAULT_SERVICE_ROLE_KEY;

export function createUserClient(accessToken) {
  if (!url || !anonKey) {
    throw new Error("Supabase URL and anon/publishable key are required.");
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(accessToken
      ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
      : {})
  });
}

export function createAdminClient() {
  const adminKey = serviceRoleKey || anonKey;
  if (!url || !adminKey) {
    throw new Error("Supabase URL and SUPABASE_SERVICE_ROLE_KEY are required for admin operations.");
  }
  return createClient(url, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}
