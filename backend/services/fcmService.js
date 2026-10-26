import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dispatchWebPush } from "./webPushService.js";
import { createAdminClient } from "../config/supabase.js";
import { sendEmail } from "./emailService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Firebase Cloud Messaging (FCM) Backend Service
 * Handles device registration, push message dispatch, and scheduled renewal alerts
 */

// In-memory token store (synchronized with Supabase when available)
const registeredTokens = new Map(); // token -> { addedAt, userAgent, deviceType }

let fcmAdminInitialized = false;

// Initialize Firebase Admin SDK
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    fcmAdminInitialized = true;
    console.log("✅ Firebase Admin SDK initialized successfully via FIREBASE_SERVICE_ACCOUNT_JSON.");
  } else if (process.env.FIREBASE_PROJECT_ID) {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
    fcmAdminInitialized = true;
    console.log(`✅ Firebase Admin SDK initialized for project: ${process.env.FIREBASE_PROJECT_ID}`);
  } else {
    console.log("ℹ️ Firebase Admin SDK running in Developer/Local mode. Ready for custom service account.");
  }
} catch (err) {
  console.warn("⚠️ Firebase Admin initialization notice:", err.message);
}

/**
 * Register a device FCM token
 */
export function registerToken(token, metadata = {}) {
  if (!token || typeof token !== "string") return false;

  registeredTokens.set(token, {
    addedAt: new Date().toISOString(),
    userAgent: metadata.userAgent || "Unknown device",
    deviceType: metadata.deviceType || "web",
  });

  console.log(`📱 FCM Device registered. Total active devices: ${registeredTokens.size}`);
  return true;
}

/**
 * Get all registered device tokens
 */
export function getRegisteredTokens() {
  return Array.from(registeredTokens.keys());
}

/**
 * Send an FCM Renewal Push Notification to all registered devices (Web & Mobile)
 */
export async function sendRenewalNotification({
  title = "🔔 TrackmySubs: Renewal Day Alert!",
  body = "A subscription is due for renewal today! Click to view.",
  data = {},
  targetTokens = null,
}) {
  const tokens = targetTokens || getRegisteredTokens();

  if (tokens.length === 0) {
    return {
      success: true,
      delivered: 0,
      mode: "no_devices",
      message: "No device tokens registered yet. Click 'Allow Push' on your web or mobile app first.",
    };
  }

  // Construct official FCM Multicast Message with mobile sound configuration
  const messagePayload = {
    notification: {
      title,
      body,
    },
    data: {
      url: data.url || "/calendar",
      subName: data.subName || "Subscription",
      cost: String(data.cost || "0"),
      timestamp: new Date().toISOString(),
    },
    webpush: {
      headers: {
        Urgency: "high",
      },
      notification: {
        title,
        body,
        icon: "/file.svg",
        badge: "/file.svg",
        sound: "/sounds/renewal-chime.wav",
        silent: false,
        requireInteraction: true,
        tag: "trackmysubs-renewal-alert",
      },
      fcmOptions: {
        link: data.url || "/calendar",
      },
    },
    android: {
      priority: "high",
      notification: {
        title,
        body,
        sound: "default",
        channelId: "renewal_alerts",
      },
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
          badge: 1,
        },
      },
    },
  };

  if (fcmAdminInitialized) {
    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        ...messagePayload,
      });

      console.log(`🚀 FCM Push dispatched: ${response.successCount} succeeded, ${response.failureCount} failed.`);
      return {
        success: true,
        delivered: response.successCount,
        failed: response.failureCount,
        mode: "live_fcm",
        message: `Dispatched to ${response.successCount} active device(s)!`,
      };
    } catch (err) {
      console.error("FCM dispatch error:", err);
      return {
        success: false,
        error: err.message,
        mode: "live_fcm_error",
      };
    }
  } else {
    // Developer simulation mode (logs payload and simulates delivery)
    console.log(`[FCM Simulation] Dispatched to ${tokens.length} device(s):`, {
      title,
      body,
      tokensCount: tokens.length,
    });

    return {
      success: true,
      delivered: tokens.length,
      mode: "simulation",
      message: `[FCM Ready] Push prepared and simulated for ${tokens.length} registered device(s). Add FIREBASE_SERVICE_ACCOUNT_JSON to .env for production credentials.`,
    };
  }
}

/**
 * Choice 2 Targeted Email Reminders:
 * - If Shared (Used by Everyone/Family) -> All connected members receive reminder
 * - If Specific Member (e.g. Rajkumar) -> That specific member gets it + Owner gets a copy
 */
export async function dispatchTargetedRenewalEmails(renewingSubs) {
  if (!renewingSubs || renewingSubs.length === 0) return { deliveredCount: 0, summary: [] };

  let members = [];
  try {
    const dataDir = path.resolve(__dirname, "../data");
    const membersFile = path.join(dataDir, "members.json");
    if (fs.existsSync(membersFile)) {
      members = JSON.parse(fs.readFileSync(membersFile, "utf-8"));
    }
  } catch (e) {
    console.warn("[Renewal Alert] Note loading members:", e.message);
  }

  const ownerEmail = (process.env.ADMIN_EMAIL || process.env.SMTP_USER || "deepakkumars170404@gmail.com").toLowerCase().trim();
  const ownerMember = members.find(m => m.role === "Owner") || { name: "Deepak Kumar", email: ownerEmail };

  let totalDelivered = 0;
  const dispatchSummary = [];

  for (const sub of renewingSubs) {
    const who = (sub.who_uses_it || "Everyone").trim();
    const isShared = who.toLowerCase() === "everyone" || who.toLowerCase().includes("family");

    // Choice 2 targeting:
    const targetEmails = new Set();

    if (isShared) {
      members.forEach(m => {
        if (m.email && m.email.includes("@")) targetEmails.add(m.email.toLowerCase().trim());
      });
      targetEmails.add(ownerEmail);
    } else {
      const matched = members.find(m =>
        m.name?.toLowerCase().includes(who.toLowerCase()) ||
        who.toLowerCase().includes(m.name?.toLowerCase()) ||
        m.email?.toLowerCase() === who.toLowerCase()
      );

      if (matched && matched.email && matched.email.includes("@")) {
        targetEmails.add(matched.email.toLowerCase().trim());
      }
      // Owner/Admin always receives a copy so bills are never missed!
      targetEmails.add(ownerEmail);
    }

    const recipientList = Array.from(targetEmails);
    const subCost = Number(sub.cost || 0);
    const formattedCost = `₹${subCost.toLocaleString("en-IN")}`;
    const nextDate = sub.next_billing_date || "Tomorrow";

    for (const recipient of recipientList) {
      const isOwner = recipient === ownerEmail;

      let headline = `Renewal Reminder: ${sub.name}`;
      let note = "";

      if (isShared) {
        headline = `Shared Plan Renewal: ${sub.name}`;
        note = `This is a shared family subscription used by Everyone.`;
      } else if (isOwner && who.toLowerCase() !== ownerMember.name.toLowerCase()) {
        headline = `Member Renewal Alert: ${sub.name} (${who})`;
        note = `This subscription is used by <strong>${who}</strong>. As household owner, you are receiving this copy so payment and card limits are verified.`;
      } else {
        headline = `Your Subscription Renews: ${sub.name}`;
        note = `This subscription is assigned to you (<strong>${who}</strong>).`;
      }

      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #ffffff; color: #1e293b; border-radius: 16px; border: 1px solid #e2e8f0;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; padding: 6px 14px; background: #eef2ff; color: #4f46e5; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
              TrackmySubs · 1-Day Prior Alert
            </div>
            <h1 style="color: #0f172a; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">${headline}</h1>
          </div>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin-bottom: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;">
              <div>
                <h2 style="color: #0f172a; font-size: 17px; margin: 0 0 4px 0; font-weight: 700;">${sub.name}</h2>
                <span style="color: #64748b; font-size: 12px;">${sub.billing_cycle ? sub.billing_cycle.toUpperCase() : 'MONTHLY'} · Assigned to: <strong>${who}</strong></span>
              </div>
              <div style="font-size: 22px; font-weight: 800; color: #4f46e5; font-family: monospace;">
                ${formattedCost}
              </div>
            </div>

            <div style="font-size: 13px; color: #475569; line-height: 1.6;">
              <p style="margin: 0 0 8px 0;">📅 <strong>Next Billing Date:</strong> ${nextDate}</p>
              <p style="margin: 0 0 8px 0;">💳 <strong>Auto-Renew:</strong> Active</p>
              <p style="margin: 0; font-size: 12px; color: #64748b;">${note}</p>
            </div>
          </div>

          <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 12px 16px; margin-bottom: 24px; font-size: 12px; color: #92400e; line-height: 1.5;">
            ℹ️ <strong>AutoPay Notice:</strong> Please ensure your linked bank account or card has sufficient balance prior to tomorrow's charge to avoid service disruption.
          </div>

          <div style="text-align: center; margin-bottom: 16px;">
            <a href="https://trackmysubs-pro.vercel.app/calendar" style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 10px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">
              View in Calendar Hub →
            </a>
          </div>

          <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 24px 0 0 0;">
            Sent by TrackmySubs · Dedicated Household & Business Subscription Hub
          </p>
        </div>
      `;

      try {
        await sendEmail({
          to: recipient,
          subject: `⏰ Renewal Alert: ${sub.name} renews tomorrow (${formattedCost}) · TrackmySubs`,
          html: emailHtml,
          text: `TrackmySubs: ${sub.name} (${formattedCost}) is renewing on ${nextDate}. Used by: ${who}. View calendar: https://trackmysubs-pro.vercel.app/calendar`
        });
        totalDelivered++;
        dispatchSummary.push({ sub: sub.name, who, recipient });
      } catch (err) {
        console.warn(`[Renewal Alert] Failed delivery to ${recipient}:`, err.message);
      }
    }
  }

  return { deliveredCount: totalDelivered, summary: dispatchSummary };
}

/**
 * Daily renewal check runner (Automated 1-day prior alert engine)
 */
export async function executeDailyRenewalCheck() {
  console.log("⏰ Running daily 1-day prior renewal check across active accounts...");
  try {
    const admin = createAdminClient();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];

    const { data: renewingSubs, error } = await admin
      .from("subscriptions")
      .select("*")
      .eq("status", "active")
      .or(`next_billing_date.eq.${tomorrow},next_billing_date.eq.${today}`);

    if (error) {
      console.info("Daily renewal query note:", error.message);
    }

    if (renewingSubs && renewingSubs.length > 0) {
      const names = renewingSubs.map(s => s.name).join(", ");
      const total = renewingSubs.reduce((sum, s) => sum + (Number(s.cost) || 0), 0);
      const title = `🔔 1-Day Prior Alert: ${renewingSubs.length} Subscriptions Renewing!`;
      const body = `${names} (Total ₹${total}). Sent even when website is closed & mobile screen is off!`;

      await dispatchWebPush({
        title,
        body,
        icon: "/favicon.ico",
        url: "/calendar",
      });

      await sendRenewalNotification({
        title,
        body,
        data: { url: "/calendar", count: String(renewingSubs.length), totalCost: String(total) }
      });
      console.log(`🚀 Automated 1-day renewal push dispatched for ${renewingSubs.length} subscription(s)!`);

      // Dispatch Choice 2 Targeted Email Reminders
      const emailResult = await dispatchTargetedRenewalEmails(renewingSubs);
      console.log(`📧 Targeted renewal emails delivered to ${emailResult.deliveredCount} recipient(s)!`);
    }
  } catch (err) {
    console.warn("Daily renewal check note:", err.message);
  }
}

export function startDailyRenewalCron(intervalHours = 24) {
  console.log(`⏰ FCM & WebPush Background Renewal Scheduler initialized (interval: ${intervalHours}h).`);

  // Run initial check after 10 seconds, then every 24 hours
  setTimeout(executeDailyRenewalCheck, 10000);

  setInterval(executeDailyRenewalCheck, intervalHours * 60 * 60 * 1000);
}

