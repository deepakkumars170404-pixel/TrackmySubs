// @ts-nocheck
// Supabase Edge Function for Settings & Preferences
// Deploy with: supabase functions deploy settings

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const authHeader = req.headers.get('Authorization') ?? '';

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/settings\/?/, '');

    // 1. GET /settings -> Retrieve notification settings
    if (req.method === 'GET' && (!path || path === '/')) {
      let { data, error } = await supabase
        .from('user_notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      // If record does not exist yet, auto-insert default record
      if (!data) {
        const { data: created, error: insertError } = await supabase
          .from('user_notification_settings')
          .insert({
            user_id: user.id,
            one_day_reminder: true,
            email_reminders: true,
            browser_push: false,
            automatic_detection_enabled: true,
          })
          .select('*')
          .single();

        if (insertError) throw insertError;
        data = created;
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. PATCH /settings -> Update notification settings
    if (req.method === 'PATCH' && (!path || path === '/')) {
      const body = await req.json();

      // Normalize snake_case and camelCase
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (body.one_day_reminder !== undefined) updates.one_day_reminder = body.one_day_reminder;
      if (body.oneDayReminder !== undefined) updates.one_day_reminder = body.oneDayReminder;
      if (body.oneDayRenewalReminder !== undefined) updates.one_day_reminder = body.oneDayRenewalReminder;

      if (body.email_reminders !== undefined) updates.email_reminders = body.email_reminders;
      if (body.emailReminders !== undefined) updates.email_reminders = body.emailReminders;

      if (body.browser_push !== undefined) updates.browser_push = body.browser_push;
      if (body.browserPush !== undefined) updates.browser_push = body.browserPush;

      if (body.automatic_detection_enabled !== undefined) updates.automatic_detection_enabled = body.automatic_detection_enabled;
      if (body.automaticDetectionEnabled !== undefined) updates.automatic_detection_enabled = body.automaticDetectionEnabled;
      if (body.autoTrackingActive !== undefined) updates.automatic_detection_enabled = body.autoTrackingActive;

      const { data, error } = await supabase
        .from('user_notification_settings')
        .update(updates)
        .eq('user_id', user.id)
        .select('*')
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. POST /settings/reset -> Reset notification settings to defaults
    if (req.method === 'POST' && path === 'reset') {
      const { data, error } = await supabase
        .from('user_notification_settings')
        .update({
          one_day_reminder: true,
          email_reminders: true,
          browser_push: false,
          automatic_detection_enabled: true,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select('*')
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, message: 'Settings reset to default', data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown internal error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
