import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

// =============================================================================
// 1. CORS Headers & Standard Response Helpers
// =============================================================================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeRedirect(targetUrl: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      Location: targetUrl,
    },
  });
}

// =============================================================================
// 2. Cryptographic CSRF State Management (HMAC-SHA256)
// Protects against CSRF and binds the flow to the authenticated user & household
// =============================================================================
export interface OAuthStatePayload {
  userId: string;
  householdId: string;
  ts: number;
  nonce: string;
  redirectPath?: string;
}

export async function getHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBuffer(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g) || [];
  return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
}

export async function createSignedState(payload: OAuthStatePayload, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const jsonStr = JSON.stringify(payload);
  const dataB64 = btoa(jsonStr).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const key = await getHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(dataB64));
  const sigHex = bufferToHex(signature);
  return `${dataB64}.${sigHex}`;
}

export async function verifySignedState(
  state: string,
  secret: string
): Promise<{ valid: boolean; payload?: OAuthStatePayload; error?: string }> {
  try {
    const parts = state.split(".");
    if (parts.length !== 2) {
      return { valid: false, error: "Invalid OAuth state format." };
    }
    const [dataB64, sigHex] = parts;
    const key = await getHmacKey(secret);
    const enc = new TextEncoder();
    const sigBuffer = hexToBuffer(sigHex);

    const isValid = await crypto.subtle.verify("HMAC", key, sigBuffer, enc.encode(dataB64));
    if (!isValid) {
      return { valid: false, error: "State signature verification failed. Potential CSRF attack." };
    }

    let base64 = dataB64.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const payload: OAuthStatePayload = JSON.parse(atob(base64));

    if (!payload.userId || !payload.ts) {
      return { valid: false, error: "Malformed state payload." };
    }

    // Expiration check: 15-minute TTL
    const maxAgeMs = 15 * 60 * 1000;
    const now = Date.now();
    if (now - payload.ts > maxAgeMs) {
      return { valid: false, error: "OAuth authorization expired. Please try connecting again." };
    }
    if (payload.ts > now + 60 * 1000) {
      return { valid: false, error: "State timestamp is invalid (in the future)." };
    }

    return { valid: true, payload };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Failed to decode state: ${msg}` };
  }
}

export function resolveSafeRedirect(frontendBase: string, redirectPath?: string, params?: Record<string, string>): string {
  let url: URL;
  try {
    url = new URL(frontendBase);
  } catch {
    url = new URL("http://localhost:3000");
  }

  if (redirectPath && redirectPath.startsWith("/") && !redirectPath.startsWith("//")) {
    url.pathname = redirectPath;
  }

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  return url.toString();
}

// =============================================================================
// 3. Household Resolver
// Looks up the user's household from households or family_members
// =============================================================================
export async function resolveUserHouseholdId(
  supabase: SupabaseClient,
  userId: string,
  passedHouseholdId?: string
): Promise<string> {
  if (passedHouseholdId) {
    // Security verification: ensure user owns or is a member of the passed household
    const { data: owned } = await supabase
      .from("households")
      .select("id")
      .eq("id", passedHouseholdId)
      .eq("owner_id", userId)
      .maybeSingle();

    if (owned?.id) return owned.id;

    const { data: member } = await supabase
      .from("family_members")
      .select("household_id")
      .eq("household_id", passedHouseholdId)
      .eq("user_id", userId)
      .maybeSingle();

    if (member?.household_id) return member.household_id;

    throw new Error("Access denied: You are not authorized for this household.");
  }

  // 1. Check if user owns a household
  const { data: owned } = await supabase
    .from("households")
    .select("id")
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();

  if (owned?.id) return owned.id;

  // 2. Check if user is a member of a household
  const { data: member } = await supabase
    .from("family_members")
    .select("household_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (member?.household_id) return member.household_id;

  // 3. Auto-provision a household if none exists
  const { data: created, error } = await supabase
    .from("households")
    .insert({
      name: "My Household",
      owner_id: userId,
    })
    .select("id")
    .single();

  if (error || !created?.id) {
    throw new Error(`Unable to resolve household for user: ${error?.message || "unknown"}`);
  }

  return created.id;
}

// =============================================================================
// 4. Google OAuth Code Exchange & Token Refresh (Server-side Only)
// Uses existing connected_email_accounts table
// =============================================================================
export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export async function exchangeAuthorizationCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<GoogleTokens> {
  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google token exchange failed (${res.status}): ${errorText}`);
  }

  return await res.json();
}

export async function getValidGoogleAccessToken(
  supabase: SupabaseClient,
  userId: string,
  clientId: string,
  clientSecret: string,
  householdId?: string
): Promise<{ accessToken: string; email: string }> {
  let query = supabase
    .from("connected_email_accounts")
    .select("id, access_token, refresh_token, expires_at, email_address")
    .eq("provider", "Gmail");

  if (householdId) {
    query = query.eq("household_id", householdId);
  } else {
    query = query.eq("user_id", userId);
  }

  const { data: record, error } = await query
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !record) {
    throw new Error("No connected Gmail account found for this household.");
  }

  const expiresAt = record.expires_at ? new Date(record.expires_at).getTime() : 0;
  const now = Date.now();

  // If token is valid for at least 5 minutes, reuse it
  if (expiresAt - now > 5 * 60 * 1000 && record.access_token) {
    return { accessToken: record.access_token, email: record.email_address };
  }

  if (!record.refresh_token) {
    throw new Error("Missing Google refresh token. Please reconnect Gmail to grant offline access.");
  }

  // Refresh access token via Google OAuth endpoint
  const refreshParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: record.refresh_token,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: refreshParams.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to refresh Google token (${res.status}): ${errText}`);
  }

  const refreshed = await res.json();
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  await supabase
    .from("connected_email_accounts")
    .update({
      access_token: refreshed.access_token,
      expires_at: newExpiresAt,
      ...(refreshed.refresh_token ? { refresh_token: refreshed.refresh_token } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", record.id);

  return { accessToken: refreshed.access_token, email: record.email_address };
}

export async function fetchGoogleUserProfile(accessToken: string): Promise<{ email: string; id?: string }> {
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Gmail profile: ${res.statusText}`);
  }

  const data = await res.json();
  return { email: data.emailAddress, id: data.historyId };
}

// =============================================================================
// 5. Gmail Subscription Receipt Detection & Parser
// Matches actual remote detected_subscriptions schema:
// household_id (UUID), provider ('Gmail'), message_id (TEXT), service_name (TEXT),
// amount (NUMERIC, nullable), currency (TEXT, nullable), renewal_date (DATE, nullable),
// confidence (NUMERIC), review_status ('needs_review' | 'added' | 'dismissed'),
// receipt_reference (TEXT), evidence_snippet (TEXT), raw_payload (JSONB)
// =============================================================================
export interface DetectedSubscriptionRow {
  household_id: string;
  provider: string;
  message_id: string;
  service_name: string;
  amount: number | null;
  currency: string | null;
  renewal_date: string | null;
  confidence: number;
  review_status: "needs_review" | "added" | "dismissed";
  receipt_reference: string;
  evidence_snippet?: string;
  raw_payload?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const KNOWN_SERVICES: Array<{ name: string; pattern: RegExp }> = [
  { name: "Netflix", pattern: /netflix/i },
  { name: "Spotify", pattern: /spotify/i },
  { name: "GitHub", pattern: /github/i },
  { name: "AWS", pattern: /amazon web services|aws/i },
  { name: "Google Play", pattern: /google play|youtube premium|google workspace/i },
  { name: "Apple", pattern: /apple\.com|itunes|app store|icloud/i },
  { name: "OpenAI ChatGPT", pattern: /openai|chatgpt/i },
  { name: "Figma", pattern: /figma/i },
  { name: "Notion", pattern: /notion/i },
  { name: "Adobe", pattern: /adobe|creative cloud/i },
  { name: "Microsoft", pattern: /microsoft|office 365|azure/i },
  { name: "Slack", pattern: /slack/i },
  { name: "Zoom", pattern: /zoom/i },
  { name: "DigitalOcean", pattern: /digitalocean/i },
  { name: "Vercel", pattern: /vercel/i },
  { name: "Supabase", pattern: /supabase/i },
  { name: "Canva", pattern: /canva/i },
  { name: "LinkedIn", pattern: /linkedin/i },
  { name: "Dropbox", pattern: /dropbox/i },
  { name: "Disney+", pattern: /disney\+/i },
  { name: "Amazon Prime", pattern: /amazon prime|prime video/i },
];

export function decodeBase64Text(encoded: string): string {
  try {
    const clean = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(clean);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

export function extractBodyText(payload: any): string {
  let body = "";
  if (!payload) return "";

  if (payload.body && payload.body.data) {
    body += " " + decodeBase64Text(payload.body.data);
  }

  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if ((part.mimeType === "text/plain" || part.mimeType === "text/html") && part.body && part.body.data) {
        body += " " + decodeBase64Text(part.body.data);
      } else if (part.parts) {
        body += " " + extractBodyText(part);
      }
    }
  }

  // Strip HTML tags for clean regex pattern matching
  return body.replace(/<[^>]+>/g, " ");
}

export function calculateNextRenewal(startDateStr: string, isYearly: boolean): string {
  try {
    const [year, month, day] = startDateStr.split("-").map(Number);
    if (!year || !month || !day) {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      return d.toISOString().split("T")[0];
    }
    if (isYearly) {
      return `${year + 1}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    } else {
      let nextYear = year;
      let nextMonth = month + 1;
      if (nextMonth > 12) {
        nextYear++;
        nextMonth = 1;
      }
      const lastDayOfNextMonth = new Date(nextYear, nextMonth, 0).getDate();
      const clampedDay = Math.min(day, lastDayOfNextMonth);
      return `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
    }
  } catch {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split("T")[0];
  }
}

export function parseReceipt(
  householdId: string,
  messageId: string,
  subject: string,
  from: string,
  dateHeader: string,
  snippet: string,
  bodyText: string
): DetectedSubscriptionRow | null {
  const combined = `${subject} ${from} ${snippet} ${bodyText}`.slice(0, 10000);

  const isReceipt =
    /receipt|invoice|billed|payment|renewal|renewed|subscription|charge|order confirmation/i.test(
      `${subject} ${snippet}`
    );

  if (!isReceipt) {
    return null;
  }

  // 1. Service Name Detection
  let serviceName = "";
  for (const known of KNOWN_SERVICES) {
    if (known.pattern.test(subject) || known.pattern.test(from) || known.pattern.test(snippet)) {
      serviceName = known.name;
      break;
    }
  }

  if (!serviceName) {
    const fromMatch = from.match(/^"?([^"<]+)"?\s*</);
    serviceName = fromMatch && fromMatch[1].trim() ? fromMatch[1].trim() : "Subscription Receipt";
  }

  // 2. Amount and Currency Detection (Never invent an amount if missing)
  let amount: number | null = null;
  let currency: string | null = null;

  const inrMatch = combined.match(/(?:₹|INR|Rs\.?)\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)/i);
  const usdMatch = combined.match(/(?:\$|USD)\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)/i);
  const eurMatch = combined.match(/(?:€|EUR)\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)/i);
  const gbpMatch = combined.match(/(?:£|GBP)\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)/i);
  const cadMatch = combined.match(/(?:C\$|CAD)\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)/i);
  const audMatch = combined.match(/(?:A\$|AUD)\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)/i);
  const genericMatch = combined.match(/(?:total|amount paid|charged|charge|billed)[:\s]+([0-9]+(?:\.[0-9]{2})?)/i);

  if (inrMatch) {
    amount = parseFloat(inrMatch[1].replace(/,/g, ""));
    currency = "INR";
  } else if (usdMatch) {
    amount = parseFloat(usdMatch[1].replace(/,/g, ""));
    currency = "USD";
  } else if (eurMatch) {
    amount = parseFloat(eurMatch[1].replace(/,/g, ""));
    currency = "EUR";
  } else if (gbpMatch) {
    amount = parseFloat(gbpMatch[1].replace(/,/g, ""));
    currency = "GBP";
  } else if (cadMatch) {
    amount = parseFloat(cadMatch[1].replace(/,/g, ""));
    currency = "CAD";
  } else if (audMatch) {
    amount = parseFloat(audMatch[1].replace(/,/g, ""));
    currency = "AUD";
  } else if (genericMatch) {
    amount = parseFloat(genericMatch[1].replace(/,/g, ""));
    currency = "USD";
  }

  if (amount !== null && (isNaN(amount) || amount <= 0)) {
    amount = null;
  }

  // 3. Receipt Date Header
  let receiptDate = new Date().toISOString().split("T")[0];
  try {
    if (dateHeader) {
      const parsed = new Date(dateHeader);
      if (!isNaN(parsed.getTime())) {
        receiptDate = parsed.toISOString().split("T")[0];
      }
    }
  } catch {
    // Keep fallback
  }

  // 4. Renewal Date Detection (Only set if recurring info exists, never invent values)
  const isYearly = /yearly|annual|annually|per year|\/yr/i.test(combined);
  const isMonthly = /monthly|per month|\/mo|each month|every month|billed monthly/i.test(combined);
  const isRecurring = isYearly || isMonthly || /renewed|renewal|recurring|subscription/i.test(subject);

  let renewalDate: string | null = null;
  if (isRecurring) {
    renewalDate = calculateNextRenewal(receiptDate, isYearly);
  }

  // 5. Confidence Score Assignment
  const hasKnownVendor = KNOWN_SERVICES.some((k) => k.name === serviceName);
  let confidence = 0.5;
  if (hasKnownVendor && amount !== null && renewalDate !== null) {
    confidence = 0.95;
  } else if (hasKnownVendor && amount !== null) {
    confidence = 0.85;
  } else if (hasKnownVendor) {
    confidence = 0.65;
  } else if (amount !== null && renewalDate !== null) {
    confidence = 0.70;
  } else if (amount !== null) {
    confidence = 0.60;
  } else {
    confidence = 0.40;
  }

  // Initial review_status is 'needs_review' so the user can review before adding to subscriptions
  const reviewStatus: "needs_review" = "needs_review";

  const currencySymbol =
    currency === "INR" ? "₹" :
    currency === "EUR" ? "€" :
    currency === "GBP" ? "£" :
    currency === "CAD" ? "C$" :
    currency === "AUD" ? "A$" :
    currency === "USD" ? "$" : "";

  const shortId = messageId.slice(-6);
  const receiptReference = amount !== null
    ? `${serviceName} (${receiptDate}) · ${currencySymbol}${amount.toFixed(2)} [${shortId}]`
    : `${serviceName} (${receiptDate}) · Amount pending [${shortId}]`;

  const evidenceSnippet = `Subject: ${subject} | Date: ${receiptDate} | From: ${from} | Snippet: ${snippet.slice(0, 160)}`;

  return {
    household_id: householdId,
    provider: "Gmail",
    message_id: messageId,
    service_name: serviceName,
    amount,
    currency,
    renewal_date: renewalDate,
    confidence,
    review_status: reviewStatus,
    receipt_reference: receiptReference,
    evidence_snippet: evidenceSnippet,
    raw_payload: {
      subject,
      from,
      dateHeader,
      messageId,
      detectedCurrency: currency,
      detectedAmount: amount,
      isRecurring,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function scanAndSaveSubscriptions(
  supabase: SupabaseClient,
  householdId: string,
  accessToken: string,
  maxResults = 25,
  pageToken?: string,
  dryRun = false
): Promise<{
  scanned: number;
  inserted: number;
  alreadyExisting: number;
  nextPageToken?: string | null;
  items?: DetectedSubscriptionRow[];
}> {
  const query = 'subject:(receipt OR invoice OR subscription OR renewed OR renewal OR "order confirmation" OR billed)';
  let listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${Math.min(maxResults, 50)}`;
  if (pageToken) {
    listUrl += `&pageToken=${encodeURIComponent(pageToken)}`;
  }

  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listRes.ok) {
    throw new Error(`Failed to list Gmail messages (${listRes.status}): ${listRes.statusText}`);
  }

  const listData = await listRes.json();
  const messages: Array<{ id: string; threadId: string }> = listData.messages || [];

  if (messages.length === 0) {
    return { scanned: 0, inserted: 0, alreadyExisting: 0, nextPageToken: null, items: [] };
  }

  // Pre-filter already processed message IDs to respect Gmail API quotas and avoid reprocessing
  const messageIds = messages.map((m) => m.id);
  const { data: existingRows } = await supabase
    .from("detected_subscriptions")
    .select("message_id")
    .eq("household_id", householdId)
    .in("message_id", messageIds);

  const existingMessageIds = new Set((existingRows || []).map((r) => r.message_id));
  const newMessages = messages.filter((m) => !existingMessageIds.has(m.id));

  if (newMessages.length === 0) {
    return {
      scanned: messages.length,
      inserted: 0,
      alreadyExisting: messages.length,
      nextPageToken: listData.nextPageToken || null,
      items: [],
    };
  }

  const detectedItems: DetectedSubscriptionRow[] = [];

  for (const msg of newMessages) {
    try {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      // Handle Gmail API rate limit gracefully
      if (msgRes.status === 429) {
        console.warn("Gmail API rate limit reached (429). Concluding batch early.");
        break;
      }

      if (!msgRes.ok) continue;

      const data = await msgRes.json();
      const headers = data.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

      const subject = getHeader("Subject");
      const from = getHeader("From");
      const dateHeader = getHeader("Date");
      const snippet = data.snippet || "";
      const bodyText = extractBodyText(data.payload);

      const parsed = parseReceipt(householdId, msg.id, subject, from, dateHeader, snippet, bodyText);
      if (parsed) {
        detectedItems.push(parsed);
      }
    } catch (msgErr) {
      console.error(`Error parsing Gmail message ${msg.id}:`, msgErr);
    }
  }

  if (dryRun) {
    return {
      scanned: messages.length,
      inserted: 0,
      alreadyExisting: existingMessageIds.size,
      nextPageToken: listData.nextPageToken || null,
      items: detectedItems,
    };
  }

  if (detectedItems.length === 0) {
    return {
      scanned: messages.length,
      inserted: 0,
      alreadyExisting: existingMessageIds.size,
      nextPageToken: listData.nextPageToken || null,
      items: [],
    };
  }

  // Upsert into detected_subscriptions table
  const { data: insertedData, error: insertError } = await supabase
    .from("detected_subscriptions")
    .upsert(detectedItems, {
      onConflict: "household_id,provider,message_id",
      ignoreDuplicates: true,
    })
    .select("id");

  if (insertError) {
    console.error("Database upsert error on detected_subscriptions:", insertError);
    throw new Error(`Failed to save detected subscriptions: ${insertError.message}`);
  }

  return {
    scanned: messages.length,
    inserted: insertedData ? insertedData.length : 0,
    alreadyExisting: existingMessageIds.size,
    nextPageToken: listData.nextPageToken || null,
    items: detectedItems,
  };
}

// =============================================================================
// 6. Main Request Router
// =============================================================================
Deno.serve(async (req: Request) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Read Secrets (Requirement: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const GOOGLE_REDIRECT_URI =
    Deno.env.get("GOOGLE_REDIRECT_URI") ||
    (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/gmail-oauth-callback` : "");
  const FRONTEND_URL =
    Deno.env.get("FRONTEND_URL") ||
    Deno.env.get("APP_URL") ||
    "http://localhost:3000";

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return errorResponse("Google OAuth credentials (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) are not configured in environment secrets.", 500);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return errorResponse("Supabase service configuration is missing.", 500);
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const url = new URL(req.url);

  // ===========================================================================
  // Flow A: GET /gmail-oauth-callback (Google OAuth Redirect Callback)
  // ===========================================================================
  if (req.method === "GET") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const googleError = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    if (googleError) {
      const redirectUrl = resolveSafeRedirect(FRONTEND_URL, "/autodetect", {
        gmail_status: "error",
        error: googleError,
        message: errorDescription || "Google authorization was not granted.",
      });
      return safeRedirect(redirectUrl);
    }

    if (!code || !state) {
      return errorResponse("Missing required 'code' or 'state' parameters in OAuth callback.", 400);
    }

    // Verify cryptographic state (CSRF Protection)
    const verification = await verifySignedState(state, GOOGLE_CLIENT_SECRET);
    if (!verification.valid || !verification.payload) {
      console.error("CSRF state check rejected:", verification.error);
      const redirectUrl = resolveSafeRedirect(FRONTEND_URL, "/autodetect", {
        gmail_status: "csrf_error",
        message: verification.error || "Security verification failed.",
      });
      return safeRedirect(redirectUrl);
    }

    const { userId, householdId, redirectPath } = verification.payload;

    try {
      // Exchange authorization code for access and refresh tokens
      const tokenData = await exchangeAuthorizationCode(
        code,
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI
      );

      // Fetch user email from Gmail profile
      const userProfile = await fetchGoogleUserProfile(tokenData.access_token);

      // Check existing account record to preserve refresh_token if Google omitted it
      const { data: existingRecord } = await supabaseAdmin
        .from("connected_email_accounts")
        .select("refresh_token")
        .eq("household_id", householdId)
        .eq("email_address", userProfile.email)
        .maybeSingle();

      const resolvedRefreshToken = tokenData.refresh_token || existingRecord?.refresh_token;
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

      // Upsert tokens securely into connected_email_accounts using database unique constraint
      const { error: upsertErr } = await supabaseAdmin
        .from("connected_email_accounts")
        .upsert(
          {
            household_id: householdId,
            user_id: userId,
            email_address: userProfile.email,
            provider: "Gmail",
            access_token: tokenData.access_token,
            refresh_token: resolvedRefreshToken || null,
            expires_at: expiresAt,
            scope: tokenData.scope || "https://www.googleapis.com/auth/gmail.readonly",
            connected_at: new Date().toISOString(),
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "household_id,email_address" }
        );

      if (upsertErr) {
        throw new Error(`Failed to save connected email account: ${upsertErr.message}`);
      }

      // Scan receipts and save to detected_subscriptions (deduplicated by message_id)
      const scanResult = await scanAndSaveSubscriptions(supabaseAdmin, householdId, tokenData.access_token);

      // Safe browser redirect back to frontend (No secrets or tokens exposed)
      const redirectUrl = resolveSafeRedirect(FRONTEND_URL, redirectPath || "/autodetect", {
        gmail_status: "success",
        email: userProfile.email,
        detected: String(scanResult.inserted),
      });

      return safeRedirect(redirectUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("OAuth callback processing error:", msg);
      const redirectUrl = resolveSafeRedirect(FRONTEND_URL, redirectPath || "/autodetect", {
        gmail_status: "error",
        message: "Failed to complete Gmail connection.",
      });
      return safeRedirect(redirectUrl);
    }
  }

  // ===========================================================================
  // Flow B: POST /gmail-oauth-callback (Authenticated App Endpoints)
  // Supported Actions:
  // - 'connect' / 'get_auth_url'
  // - 'connection-status' / 'get_status'
  // - 'sync' / 'sync_receipts'
  // - 'disconnect'
  // - 'list' / 'get_detected'
  // - 'update-review-status'
  // - 'add-to-subscriptions' / 'approve'
  // ===========================================================================
  if (req.method === "POST") {
    try {
      // Validate Supabase User JWT
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return errorResponse("Missing or invalid Authorization header.", 401);
      }

      const jwt = authHeader.replace("Bearer ", "").trim();
      const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(jwt);

      if (authErr || !authData?.user) {
        return errorResponse("Invalid or expired user session.", 401);
      }

      const user = authData.user;
      let body: Record<string, any> = {};
      try {
        body = await req.json();
      } catch {
        // Fallback for empty body
      }

      const action = body.action || "connect";

      // -----------------------------------------------------------------------
      // Action: 'connect' / 'get_auth_url'
      // Initiates the OAuth flow with signed CSRF state and returns consent URL
      // -----------------------------------------------------------------------
      if (action === "connect" || action === "get_auth_url") {
        const redirectPath = typeof body.redirectPath === "string" ? body.redirectPath : "/autodetect";
        const householdId = await resolveUserHouseholdId(supabaseAdmin, user.id, body.householdId);

        const statePayload: OAuthStatePayload = {
          userId: user.id,
          householdId,
          ts: Date.now(),
          nonce: crypto.randomUUID(),
          redirectPath,
        };

        const signedState = await createSignedState(statePayload, GOOGLE_CLIENT_SECRET);

        const scopes = [
          "https://www.googleapis.com/auth/gmail.readonly",
          "https://www.googleapis.com/auth/userinfo.email",
        ].join(" ");

        const authParams = new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          redirect_uri: GOOGLE_REDIRECT_URI,
          response_type: "code",
          scope: scopes,
          access_type: "offline",
          prompt: "consent", // Ensures Google returns refresh_token
          state: signedState,
        });

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`;

        return jsonResponse({
          success: true,
          authUrl,
          householdId,
          redirectUri: GOOGLE_REDIRECT_URI,
        });
      }

      // -----------------------------------------------------------------------
      // Action: 'connection-status' / 'get_status'
      // Returns connection metadata without exposing tokens
      // -----------------------------------------------------------------------
      if (action === "connection-status" || action === "get_status") {
        const householdId = await resolveUserHouseholdId(supabaseAdmin, user.id, body.householdId);

        const { data: record } = await supabaseAdmin
          .from("connected_email_accounts")
          .select("id, email_address, provider, last_synced_at, connected_at")
          .eq("household_id", householdId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return jsonResponse({
          success: true,
          connected: Boolean(record),
          email: record?.email_address || null,
          provider: record?.provider || "Gmail",
          lastSyncedAt: record?.last_synced_at || null,
          connectedAt: record?.connected_at || null,
          householdId,
        });
      }

      // -----------------------------------------------------------------------
      // Action: 'sync' / 'sync_receipts'
      // Manually trigger a Gmail scan with automatic token refresh and pre-filtering
      // -----------------------------------------------------------------------
      if (action === "sync" || action === "sync_receipts") {
        const householdId = await resolveUserHouseholdId(supabaseAdmin, user.id, body.householdId);
        const maxResults = typeof body.maxResults === "number" ? body.maxResults : 25;
        const pageToken = typeof body.pageToken === "string" ? body.pageToken : undefined;

        const { accessToken } = await getValidGoogleAccessToken(
          supabaseAdmin,
          user.id,
          GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET,
          householdId
        );

        const scanResult = await scanAndSaveSubscriptions(
          supabaseAdmin,
          householdId,
          accessToken,
          maxResults,
          pageToken
        );

        await supabaseAdmin
          .from("connected_email_accounts")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("household_id", householdId);

        return jsonResponse({
          success: true,
          scanned: scanResult.scanned,
          inserted: scanResult.inserted,
          alreadyExisting: scanResult.alreadyExisting,
          nextPageToken: scanResult.nextPageToken,
          householdId,
        });
      }

      // -----------------------------------------------------------------------
      // Action: 'preview-scan' / 'preview'
      // Runs a dry-run scan without writing to detected_subscriptions table
      // -----------------------------------------------------------------------
      if (action === "preview-scan" || action === "preview") {
        const householdId = await resolveUserHouseholdId(supabaseAdmin, user.id, body.householdId);
        const maxResults = typeof body.maxResults === "number" ? body.maxResults : 25;
        const pageToken = typeof body.pageToken === "string" ? body.pageToken : undefined;

        const { accessToken } = await getValidGoogleAccessToken(
          supabaseAdmin,
          user.id,
          GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET,
          householdId
        );

        const scanResult = await scanAndSaveSubscriptions(
          supabaseAdmin,
          householdId,
          accessToken,
          maxResults,
          pageToken,
          true // dryRun = true
        );

        return jsonResponse({
          success: true,
          preview: true,
          scanned: scanResult.scanned,
          detected: scanResult.items?.length || 0,
          items: scanResult.items || [],
          alreadyExisting: scanResult.alreadyExisting,
          nextPageToken: scanResult.nextPageToken,
          householdId,
        });
      }

      // -----------------------------------------------------------------------
      // Action: 'disconnect'
      // Revokes the token with Google and removes the record
      // -----------------------------------------------------------------------
      if (action === "disconnect") {
        const householdId = await resolveUserHouseholdId(supabaseAdmin, user.id, body.householdId);

        const { data: record } = await supabaseAdmin
          .from("connected_email_accounts")
          .select("access_token")
          .eq("household_id", householdId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (record?.access_token) {
          try {
            await fetch(`https://oauth2.googleapis.com/revoke?token=${record.access_token}`, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
            });
          } catch {
            // Non-blocking if already revoked
          }
        }

        await supabaseAdmin
          .from("connected_email_accounts")
          .delete()
          .eq("household_id", householdId);

        return jsonResponse({
          success: true,
          message: "Gmail account disconnected successfully.",
          householdId,
        });
      }

      // -----------------------------------------------------------------------
      // Action: 'list' / 'get_detected'
      // Returns detected subscription records for the household
      // -----------------------------------------------------------------------
      if (action === "list" || action === "get_detected") {
        const householdId = await resolveUserHouseholdId(supabaseAdmin, user.id, body.householdId);

        const { data: detected, error: fetchErr } = await supabaseAdmin
          .from("detected_subscriptions")
          .select("*")
          .eq("household_id", householdId)
          .order("created_at", { ascending: false });

        if (fetchErr) throw fetchErr;

        return jsonResponse({
          success: true,
          householdId,
          data: detected || [],
        });
      }

      // -----------------------------------------------------------------------
      // Action: 'update-review-status' / 'review'
      // Updates review_status (enforces 'needs_review', 'added', 'dismissed')
      // -----------------------------------------------------------------------
      if (action === "update-review-status" || action === "update_status" || action === "review") {
        const householdId = await resolveUserHouseholdId(supabaseAdmin, user.id, body.householdId);
        const { id, reviewStatus } = body;

        if (!id || !["needs_review", "added", "dismissed"].includes(reviewStatus)) {
          return errorResponse(
            "Invalid request: 'id' and valid 'reviewStatus' ('needs_review', 'added', 'dismissed') are required.",
            400
          );
        }

        const { error: updateErr } = await supabaseAdmin
          .from("detected_subscriptions")
          .update({
            review_status: reviewStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .eq("household_id", householdId);

        if (updateErr) throw updateErr;

        return jsonResponse({
          success: true,
          message: `Subscription review status updated to '${reviewStatus}'.`,
          householdId,
        });
      }

      // -----------------------------------------------------------------------
      // Action: 'add-to-subscriptions' / 'approve'
      // Converts a reviewed detected subscription into an active household subscription
      // -----------------------------------------------------------------------
      if (action === "add-to-subscriptions" || action === "approve") {
        const householdId = await resolveUserHouseholdId(supabaseAdmin, user.id, body.householdId);
        const detectedId = body.id || body.detectedId;

        if (!detectedId) {
          return errorResponse("Missing required 'id' of detected subscription.", 400);
        }

        // 1. Fetch detected subscription
        const { data: detected, error: fetchErr } = await supabaseAdmin
          .from("detected_subscriptions")
          .select("*")
          .eq("id", detectedId)
          .eq("household_id", householdId)
          .single();

        if (fetchErr || !detected) {
          return errorResponse("Detected subscription not found for this household.", 404);
        }

        // 2. Insert into subscriptions table
        const billingCycle = body.billingCycle || (detected.renewal_date ? "monthly" : "monthly");
        const amount = typeof body.amount === "number" ? body.amount : (detected.amount ?? 0);
        const currency = body.currency || detected.currency || "USD";
        const renewalDate = body.renewalDate || detected.renewal_date || null;

        const { data: newSub, error: subErr } = await supabaseAdmin
          .from("subscriptions")
          .insert({
            household_id: householdId,
            name: detected.service_name,
            provider: detected.provider || "Gmail",
            amount,
            currency,
            billing_cycle: billingCycle,
            renewal_date: renewalDate,
            status: "active",
            created_by: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (subErr) {
          throw new Error(`Failed to create subscription: ${subErr.message}`);
        }

        // 3. Mark detected_subscriptions as 'added'
        await supabaseAdmin
          .from("detected_subscriptions")
          .update({
            review_status: "added",
            updated_at: new Date().toISOString(),
          })
          .eq("id", detectedId);

        return jsonResponse({
          success: true,
          subscriptionId: newSub.id,
          message: `Subscription '${detected.service_name}' successfully added to your household.`,
          householdId,
        });
      }

      // -----------------------------------------------------------------------
      // Action: 'pause-tracking' / 'pause'
      // Pauses tracking for an active subscription or dismisses a detected subscription
      // -----------------------------------------------------------------------
      if (action === "pause-tracking" || action === "pause") {
        const householdId = await resolveUserHouseholdId(supabaseAdmin, user.id, body.householdId);
        const { subscriptionId, id } = body;

        if (subscriptionId) {
          const { error: subErr } = await supabaseAdmin
            .from("subscriptions")
            .update({ status: "paused", updated_at: new Date().toISOString() })
            .eq("id", subscriptionId)
            .eq("household_id", householdId);

          if (subErr) throw subErr;

          return jsonResponse({
            success: true,
            message: "Subscription tracking paused.",
            householdId,
          });
        }

        if (id) {
          const { error: detErr } = await supabaseAdmin
            .from("detected_subscriptions")
            .update({ review_status: "dismissed", updated_at: new Date().toISOString() })
            .eq("id", id)
            .eq("household_id", householdId);

          if (detErr) throw detErr;

          return jsonResponse({
            success: true,
            message: "Detected subscription tracking paused (dismissed).",
            householdId,
          });
        }

        return errorResponse("Missing 'subscriptionId' or 'id' to pause tracking.", 400);
      }

      return errorResponse(
        `Unknown action '${action}'. Supported: 'connect', 'connection-status', 'sync', 'preview-scan', 'list', 'update-review-status', 'add-to-subscriptions', 'pause-tracking', 'disconnect'.`,
        400
      );
    } catch (postErr: unknown) {
      const msg = postErr instanceof Error ? postErr.message : String(postErr);
      console.error("POST action error:", msg);
      return errorResponse(msg, 500);
    }
  }

  return errorResponse("Method not allowed.", 405);
});
