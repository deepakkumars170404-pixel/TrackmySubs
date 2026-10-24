import imaps from "imap-simple";
import { simpleParser } from "mailparser";
import { createAdminClient } from "../config/supabase.js";

// Brand details lookup for detected subscriptions
const BRAND_METADATA = {
  "Netflix": {
    color: "#E50914",
    logo: "https://assets.nflxext.com/ffe/siteui/common/icons/nficon2016.ico",
    tier: "Standard HD (2 Screens)"
  },
  "Spotify": {
    color: "#1DB954",
    logo: "https://open.spotifycdn.com/cdn/images/favicon.0f31d2ea.ico",
    tier: "Premium Monthly"
  },
  "Prime Video": {
    color: "#00A8E1",
    logo: "https://m.media-amazon.com/images/G/01/digital/video/web/logo-min-remake.png",
    tier: "Amazon Prime Annual"
  },
  "MyJio": {
    color: "#0A2885",
    logo: "https://www.jio.com/favicon.ico",
    tier: "Prepaid 2GB/Day · 28 Days"
  },
  "Jio + Sun NXT": {
    color: "#E50914",
    logo: "https://www.jio.com/favicon.ico",
    tier: "Standard 1.5GB/Day · 56 Days"
  },
  "Jio + Disney+ Hotstar": {
    color: "#0A2885",
    logo: "https://www.jio.com/favicon.ico",
    tier: "Standard 1.5GB/Day · 56 Days"
  },
  "Airtel Thanks": {
    color: "#E40000",
    logo: "https://www.airtel.in/favicon.ico",
    tier: "Unlimited 5G · 28 Days"
  },
  "YouTube Premium": {
    color: "#FF0000",
    logo: "https://www.youtube.com/s/desktop/d743f786/img/favicon.ico",
    tier: "Family Plan · Monthly"
  },
  "Apple iCloud+": {
    color: "#000000",
    logo: "https://www.apple.com/favicon.ico",
    tier: "50 GB Storage Monthly"
  },
  "Google One": {
    color: "#4285F4",
    logo: "https://www.google.com/favicon.ico",
    tier: "100 GB Storage Annual"
  },
  "Google Gemini Advanced": {
    color: "#4285F4",
    logo: "https://www.google.com/favicon.ico",
    tier: "Advanced Monthly"
  },
  "Disney+ Hotstar": {
    color: "#0F1014",
    logo: "https://www.hotstar.com/assets/c570e62a02dd0400999c60f476d0144f.svg",
    tier: "Super Annual (2 Screens)"
  },
  "Canva Pro": {
    color: "#00C4CC",
    logo: "https://www.canva.com/favicon.ico",
    tier: "Pro Team Design"
  },
  "Duolingo Super": {
    color: "#58CC02",
    logo: "https://d35aaqx5ub95lt.cloudfront.net/favicon.ico",
    tier: "Super Monthly"
  },
  "ZEE5 Premium": {
    color: "#8230C6",
    logo: "https://www.zee5.com/favicon.ico",
    tier: "Premium All-Access"
  },
  "ChatGPT Plus": {
    color: "#10A37F",
    logo: "https://chatgpt.com/favicon.ico",
    tier: "Plus Subscription (GPT-4o)"
  },
  "GitHub Copilot": {
    color: "#24292F",
    logo: "https://github.com/favicon.ico",
    tier: "Copilot Pro Individual"
  }
};

const SERVICE_RULES = [
  { keywords: ["sunnxt", "sun nxt", "jio sunnxt", "jio + sun nxt"], canonical: "Jio + Sun NXT", defaultValidity: 56 },
  { keywords: ["jio hotstar", "jio+hotstar", "hotstar jio"], canonical: "Jio + Disney+ Hotstar", defaultValidity: 56 },
  { keywords: ["myjio", "reliance jio", "jio recharge", "jio fiber", "jio"], canonical: "MyJio", defaultValidity: 28 },
  { keywords: ["airtel", "airtel thanks"], canonical: "Airtel Thanks", defaultValidity: 28 },
  { keywords: ["gemini", "google gemini"], canonical: "Google Gemini Advanced", defaultValidity: 30 },
  { keywords: ["google one", "google storage"], canonical: "Google One", defaultValidity: 365 },
  { keywords: ["youtube premium", "youtube music"], canonical: "YouTube Premium", defaultValidity: 30 },
  { keywords: ["netflix"], canonical: "Netflix", defaultValidity: 30 },
  { keywords: ["spotify"], canonical: "Spotify", defaultValidity: 30 },
  { keywords: ["prime video", "amazon prime"], canonical: "Prime Video", defaultValidity: 365 },
  { keywords: ["hotstar", "disney+ hotstar"], canonical: "Disney+ Hotstar", defaultValidity: 92 },
  { keywords: ["apple", "icloud", "itunes"], canonical: "Apple iCloud+", defaultValidity: 30 },
  { keywords: ["canva"], canonical: "Canva Pro", defaultValidity: 30 },
  { keywords: ["duolingo"], canonical: "Duolingo Super", defaultValidity: 30 },
  { keywords: ["zee5"], canonical: "ZEE5 Premium", defaultValidity: 92 },
  { keywords: ["chatgpt", "openai"], canonical: "ChatGPT Plus", defaultValidity: 30 },
  { keywords: ["copilot", "github copilot"], canonical: "GitHub Copilot", defaultValidity: 30 }
];

function getImapConfig() {
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const password = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  const host = process.env.IMAP_HOST || "imap.gmail.com";
  const port = Number(process.env.IMAP_PORT || 993);

  if (!user || !password) return null;

  return {
    imap: {
      user,
      password,
      host,
      port,
      tls: true,
      authTimeout: 12000,
      tlsOptions: { rejectUnauthorized: false }
    }
  };
}

/**
 * Extracts numeric price from text (₹ or Rs or INR)
 */
function extractAmount(text) {
  if (!text) return null;
  // Strip out email addresses and URLs first to prevent digits in usernames (e.g. deepakkumars170404@gmail.com) from being treated as amounts
  const sanitized = text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, " ")
    .replace(/https?:\/\/\S+/g, " ");

  const matchInr = sanitized.match(/(?:₹|rs\.?|inr|\$)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
  if (matchInr && matchInr[1]) {
    const val = parseFloat(matchInr[1].replace(/,/g, ""));
    if (!isNaN(val) && val > 0 && val < 100000) return Math.round(val);
  }
  const matchCharged = sanitized.match(/(?:amount|charged|recharge|debited|paid|price|fee)\s*(?:of|is)?\s*[:\s]*([0-9,]+(?:\.[0-9]{1,2})?)/i);
  if (matchCharged && matchCharged[1]) {
    const val = parseFloat(matchCharged[1].replace(/,/g, ""));
    if (!isNaN(val) && val > 0 && val < 100000) return Math.round(val);
  }
  return null;
}

/**
 * Extracts validity days from text
 */
function extractValidityDays(text, defaultDays = 30) {
  if (!text) return defaultDays;
  const match = text.match(/(?:validity|valid for|pack validity|pack of|plan for)[:\s]*(\d+)\s*days?/i) ||
                text.match(/(\d+)\s*days?\s*(?:validity|pack|plan)/i) ||
                text.match(/\b(28|56|84|90|92|365)\s*days?\b/i);
  if (match && match[1]) {
    const d = parseInt(match[1], 10);
    if (!isNaN(d) && d > 0 && d <= 730) return d;
  }
  return defaultDays;
}

/**
 * Adds exact days to a date string using UTC arithmetic with 0 timezone drift
 */
function addDaysExact(dateStr, days) {
  const parts = dateStr.split("-").map(Number);
  const baseUtc = Date.UTC(parts[0], parts[1] - 1, parts[2]);
  const targetUtc = new Date(baseUtc + days * 86400000);
  const y = targetUtc.getUTCFullYear();
  const m = String(targetUtc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(targetUtc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Advances expired renewal date forward by integer cycles of validityDays until it is in the future
 */
function getFutureCycleDate(startDateStr, validityDays) {
  const todayStr = new Date().toISOString().slice(0, 10);
  let nextDate = addDaysExact(startDateStr, validityDays);

  let iterations = 0;
  while (nextDate < todayStr && iterations < 50) {
    nextDate = addDaysExact(nextDate, validityDays);
    iterations++;
  }
  return nextDate;
}

/**
 * Parses email subject, sender, and text to extract subscription details
 */
export function parseEmailForSubscription(email) {
  const subject = (email.subject || "").trim();
  const fromText = (email.from?.text || "").trim();
  const bodyText = (email.text || "").trim();
  const combined = `${subject} \n ${fromText} \n ${bodyText}`.toLowerCase();

  // 1. Identify service
  let detectedRule = null;
  for (const rule of SERVICE_RULES) {
    if (rule.keywords.some((kw) => combined.includes(kw))) {
      detectedRule = rule;
      break;
    }
  }

  // If no recognized subscription keyword, return null
  if (!detectedRule) return null;

  // Filter out automated TrackmySubs system notifications or family invitations
  const isInternalAlert =
    /trackmysubs/i.test(fromText) ||
    /notifications@/i.test(fromText) ||
    /action required: confirm subscription/i.test(subject) ||
    /renewal alert/i.test(subject) ||
    /test alert/i.test(subject) ||
    /invitation/i.test(subject);

  if (isInternalAlert) {
    return null;
  }

  // Filter out non-receipt promotional or notification emails unless cost/recharge exists
  const isReceiptLike = /(?:receipt|invoice|recharge|debited|charged|autopay|mandate|order|bill|paid|renew|plan|successful|membership)/i.test(combined);
  const cost = extractAmount(`${subject} \n ${bodyText}`);

  if (!isReceiptLike && !cost) return null;

  const serviceName = detectedRule.canonical;
  const validityDays = extractValidityDays(`${subject} \n ${bodyText}`, detectedRule.defaultValidity);

  // Email date as start date
  const emailDate = email.date ? new Date(email.date) : new Date();
  const startDateStr = isNaN(emailDate.getTime())
    ? new Date().toISOString().slice(0, 10)
    : emailDate.toISOString().slice(0, 10);

  const nextBillingDate = getFutureCycleDate(startDateStr, validityDays);

  const meta = BRAND_METADATA[serviceName] || {
    color: "#4F46E5",
    logo: `https://${serviceName.toLowerCase().replace(/[^a-z]/g, "")}.com/favicon.ico`,
    tier: "Standard Plan"
  };

  const finalCost = cost || (serviceName === "MyJio" ? 349 : serviceName === "Spotify" ? 179 : serviceName === "Netflix" ? 649 : 299);
  const monthlyCost = validityDays >= 300 ? Math.round(finalCost / 12) : finalCost;

  let billingCycle = "monthly";
  if (validityDays >= 300) billingCycle = "yearly";
  else if (validityDays >= 80 && validityDays <= 95) billingCycle = "quarterly";

  return {
    name: serviceName,
    cost: finalCost,
    monthlyCost,
    validityDays,
    billingCycle,
    startDate: startDateStr,
    nextBillingDate,
    planTier: meta.tier,
    brandColor: meta.color,
    iconImage: meta.logo,
    evidenceSubject: subject,
    snippet: bodyText.slice(0, 200).replace(/\s+/g, " ")
  };
}

let lastSyncSummary = {
  lastChecked: null,
  success: false,
  emailsScanned: 0,
  detectedCount: 0,
  addedCount: 0,
  updatedCount: 0,
  items: []
};

/**
 * Scans recent inbox emails via IMAP, extracts subscriptions, and syncs them into Supabase
 */
export async function syncInboxSubscriptions({ maxEmails = 150, userEmail = null, deepScan = true } = {}) {
  const config = getImapConfig();
  if (!config) {
    return {
      success: false,
      message: "IMAP configuration missing. Configure SMTP_USER and SMTP_PASS (Google App Password) in backend/.env"
    };
  }

  const accountEmail = userEmail || config.imap.user;
  console.log(`[IMAP Service] Starting live inbox scan for ${accountEmail}...`);

  let connection = null;
  try {
    connection = await imaps.connect(config);
    const box = await connection.openBox("INBOX");
    const total = box.messages.total;

    if (total === 0) {
      lastSyncSummary = {
        lastChecked: new Date().toISOString(),
        success: true,
        emailsScanned: 0,
        detectedCount: 0,
        addedCount: 0,
        updatedCount: 0,
        items: []
      };
      connection.end();
      return lastSyncSummary;
    }

    const start = Math.max(1, total - (maxEmails - 1));
    const range = `${start}:${total}`;

    // 1. Fetch headers to identify candidate emails fast
    const fetchHeaders = await connection.imap.seq.fetch(range, {
      bodies: "HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)",
      struct: true
    });

    const candidateSeqnos = [];

    await new Promise((resolve) => {
      fetchHeaders.on("message", (msg, seqno) => {
        let buffer = "";
        msg.on("body", (stream) => {
          stream.on("data", (chunk) => (buffer += chunk.toString("utf8")));
          stream.on("end", () => {
            const lower = buffer.toLowerCase();
            const isMatch =
              lower.includes("receipt") ||
              lower.includes("invoice") ||
              lower.includes("recharge") ||
              lower.includes("subscription") ||
              lower.includes("order") ||
              lower.includes("google play") ||
              lower.includes("apple") ||
              lower.includes("netflix") ||
              lower.includes("spotify") ||
              lower.includes("prime") ||
              lower.includes("jio") ||
              lower.includes("airtel") ||
              lower.includes("payment") ||
              lower.includes("renew") ||
              lower.includes("bill");

            if (isMatch) candidateSeqnos.push(seqno);
          });
        });
      });
      fetchHeaders.once("end", resolve);
      fetchHeaders.once("error", resolve);
    });

    console.log(`[IMAP Service] Total messages: ${total}. Scanned range ${range}. Candidate receipts found: ${candidateSeqnos.length}`);

    if (candidateSeqnos.length === 0) {
      connection.end();
      lastSyncSummary = {
        lastChecked: new Date().toISOString(),
        success: true,
        emailsScanned: total - start + 1,
        detectedCount: 0,
        addedCount: 0,
        updatedCount: 0,
        items: []
      };
      return lastSyncSummary;
    }

    // 2. Fetch full body of candidate receipts and parse with mailparser
    // Take the latest 15 candidates to keep sync fast
    const topCandidates = candidateSeqnos.slice(-15);
    const candidateFetch = await connection.imap.seq.fetch(topCandidates, {
      bodies: "",
      markSeen: false
    });

    const detectedSubscriptions = [];

    await new Promise((resolve) => {
      let pending = topCandidates.length;
      candidateFetch.on("message", (msg) => {
        msg.on("body", async (stream) => {
          try {
            const parsedEmail = await simpleParser(stream);
            const detected = parseEmailForSubscription(parsedEmail);
            if (detected) {
              detectedSubscriptions.push(detected);
            }
          } catch (err) {
            console.error("[IMAP Service] mailparser error:", err.message);
          } finally {
            pending--;
            if (pending <= 0) resolve();
          }
        });
      });
      candidateFetch.once("end", () => {
        setTimeout(resolve, 1500);
      });
      candidateFetch.once("error", resolve);
    });

    connection.end();

    // 3. Upsert detected subscriptions into Supabase
    const admin = createAdminClient();
    let addedCount = 0;
    let updatedCount = 0;

    // Fetch existing subscriptions to update instead of creating duplicates
    const { data: existingList } = await admin
      .from("subscriptions")
      .select("id, name, cost, next_billing_date, source, user_id");

    const existingMap = new Map();
    (existingList || []).forEach((s) => {
      existingMap.set(s.name.toLowerCase().trim(), s);
    });

    for (const item of detectedSubscriptions) {
      const key = item.name.toLowerCase().trim();
      const existing = existingMap.get(key);

      const sourceDetail = `Gmail IMAP auto-sync · ${item.validityDays} days valid · ₹${item.cost} · Subj: "${item.evidenceSubject.slice(0, 50)}"`;

      if (existing) {
        // Update existing record (omit generated column renewal_date)
        const { error } = await admin
          .from("subscriptions")
          .update({
            cost: item.cost,
            monthly_cost: item.monthlyCost,
            next_billing_date: item.nextBillingDate,
            source: "receipt",
            source_detail: sourceDetail,
            updated_at: new Date().toISOString()
          })
          .eq("id", existing.id);

        if (!error) updatedCount++;
        else console.error("[IMAP Service] Update subscription error:", error.message);
      } else {
        // Insert new subscription (omit generated column renewal_date)
        const slug = item.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        const newId = `sub-${slug}-${Date.now().toString().slice(-4)}`;

        const { error } = await admin.from("subscriptions").insert({
          id: newId,
          user_id: "3b647ce4-af4d-46e6-99a8-ff2b05f3ce20",
          name: item.name,
          cost: item.cost,
          monthly_cost: item.monthlyCost,
          currency: "INR",
          billing_cycle: item.billingCycle,
          status: "active",
          start_date: item.startDate,
          next_billing_date: item.nextBillingDate,
          auto_renew: true,
          autopay_state: "on",
          who_uses_it: "Everyone",
          payment_method: "AutoPay (Gmail Receipt)",
          source: "receipt",
          source_detail: sourceDetail,
          plan_tier: item.planTier,
          brand_letter: item.name.charAt(0).toUpperCase(),
          brand_color: item.brandColor,
          icon_image: item.iconImage,
          notify_before_days: 1,
          tags: ["Auto-Detected", "Gmail-Sync", item.name],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        if (!error) addedCount++;
        else console.error("[IMAP Service] Insert subscription error:", error.message);
      }
    }

    lastSyncSummary = {
      lastChecked: new Date().toISOString(),
      success: true,
      accountEmail,
      emailsScanned: total - start + 1,
      detectedCount: detectedSubscriptions.length,
      addedCount,
      updatedCount,
      items: detectedSubscriptions
    };

    console.log(`[IMAP Service] Sync finished! Detected: ${detectedSubscriptions.length}, Added: ${addedCount}, Updated: ${updatedCount}`);
    return lastSyncSummary;
  } catch (err) {
    if (connection) {
      try { connection.end(); } catch {}
    }
    console.error("[IMAP Service] Sync exception:", err.message);
    return {
      success: false,
      message: err.message,
      accountEmail
    };
  }
}

export function getLastSyncStatus() {
  const config = getImapConfig();
  return {
    configured: !!config,
    accountEmail: config?.imap?.user || null,
    lastChecked: lastSyncSummary.lastChecked,
    lastSummary: lastSyncSummary
  };
}

/**
 * Starts periodic IMAP background sync (e.g. every 15 minutes)
 */
export function startImapBackgroundSync({ intervalMinutes = 15 } = {}) {
  const config = getImapConfig();
  if (!config) {
    console.log("[IMAP Service] IMAP credentials not configured. Background email sync paused.");
    return;
  }

  console.log(`[IMAP Service] Initializing IMAP background listener for ${config.imap.user} (Interval: ${intervalMinutes} mins)...`);

  // Initial scan 10 seconds after boot
  setTimeout(async () => {
    try {
      await syncInboxSubscriptions({ maxEmails: 50 });
    } catch (err) {
      console.warn("[IMAP Service] Initial boot scan warning:", err.message);
    }
  }, 10000);

  // Periodic recurring check
  const intervalMs = intervalMinutes * 60 * 1000;
  setInterval(async () => {
    try {
      await syncInboxSubscriptions({ maxEmails: 30 });
    } catch (err) {
      console.warn("[IMAP Service] Periodic IMAP sync warning:", err.message);
    }
  }, intervalMs);
}
