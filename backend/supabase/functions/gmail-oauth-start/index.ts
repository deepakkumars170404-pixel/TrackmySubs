import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function createSignedState(payload: object, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const jsonStr = JSON.stringify(payload);
  const dataB64 = btoa(jsonStr).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const key = await getHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(dataB64));
  return `${dataB64}.${bufferToHex(signature)}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const GOOGLE_REDIRECT_URI =
    Deno.env.get("GOOGLE_REDIRECT_URI") ||
    (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/gmail-oauth-callback` : "");

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return new Response(JSON.stringify({ error: "Missing Google OAuth credentials in secrets." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Missing Supabase backend configuration secrets." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing or invalid Authorization header." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const jwt = authHeader.replace("Bearer ", "").trim();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: authData, error: authErr } = await supabase.auth.getUser(jwt);

  if (authErr || !authData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized user session." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const user = authData.user;
  const url = new URL(req.url);
  const redirectPath = url.searchParams.get("redirectPath") || "/autodetect";
  let householdId = url.searchParams.get("householdId");

  if (householdId) {
    const { data: owned } = await supabase
      .from("households")
      .select("id")
      .eq("id", householdId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!owned?.id) {
      const { data: member } = await supabase
        .from("family_members")
        .select("household_id")
        .eq("household_id", householdId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!member?.household_id) {
        return new Response(JSON.stringify({ error: "Access denied: Unauthorized household." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
  } else {
    const { data: owned } = await supabase
      .from("households")
      .select("id")
      .eq("owner_id", user.id)
      .limit(1)
      .maybeSingle();

    if (owned?.id) {
      householdId = owned.id;
    } else {
      const { data: member } = await supabase
        .from("family_members")
        .select("household_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      householdId = member?.household_id;
    }
  }

  if (!householdId) {
    const { data: created } = await supabase
      .from("households")
      .insert({ name: "My Household", owner_id: user.id })
      .select("id")
      .single();
    householdId = created?.id;
  }

  const signedState = await createSignedState(
    {
      userId: user.id,
      householdId,
      ts: Date.now(),
      nonce: crypto.randomUUID(),
      redirectPath,
    },
    GOOGLE_CLIENT_SECRET
  );

  const scopes = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
  ].join(" ");

  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: "code",
      scope: scopes,
      access_type: "offline",
      prompt: "consent",
      state: signedState,
    }).toString();

  return new Response(
    JSON.stringify({
      success: true,
      authUrl,
      householdId,
      redirectUri: GOOGLE_REDIRECT_URI,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
