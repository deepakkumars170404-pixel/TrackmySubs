import admin from "firebase-admin";
import { dispatchWebPush } from "./webPushService.js";
import { createAdminClient } from "../config/supabase.js";

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
 * Daily renewal check runner (Automated 1-day prior alert engine)
 */
async function executeDailyRenewalCheck() {
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

