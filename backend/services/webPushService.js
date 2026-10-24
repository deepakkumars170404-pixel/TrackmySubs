import webpush from "web-push";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_FILE = path.join(__dirname, "../webpush_subscriptions.json");

export const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  "BCJZvfWUoVHXIttPLGFjq3t9w2YktWlWGLvmOkyRuW9EuZ5xgIDBY6C10zu5YkIl1hvt8Mo74moXJWCa1_s13D8";

export const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  "1ubylJzdjFfgasRO515rsUzbQ4o9YOTGJSa9NgYTccQ";

export const VAPID_EMAIL =
  process.env.VAPID_EMAIL || "mailto:notifications@trackmysubs.com";

// Configure web-push with VAPID keys
try {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log("🔔 W3C WebPush (VAPID) engine configured successfully.");
} catch (err) {
  console.error("VAPID config error:", err);
}

// In-memory subscriptions store
let subscriptions = [];

// Load persisted subscriptions from disk if available
try {
  if (fs.existsSync(STORAGE_FILE)) {
    const raw = fs.readFileSync(STORAGE_FILE, "utf8");
    subscriptions = JSON.parse(raw);
    console.log(`📱 Loaded ${subscriptions.length} active Web Push subscription(s) from storage.`);
  }
} catch {
  subscriptions = [];
}

function persistSubscriptions() {
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(subscriptions, null, 2), "utf8");
  } catch (err) {
    console.warn("Failed to persist push subscriptions to disk:", err);
  }
}

/**
 * Register or update a browser's Web Push subscription
 */
export function savePushSubscription(subscription, metadata = {}) {
  if (!subscription || !subscription.endpoint) return false;

  const existingIndex = subscriptions.findIndex((s) => s.endpoint === subscription.endpoint);
  const entry = {
    ...subscription,
    updatedAt: new Date().toISOString(),
    userAgent: metadata.userAgent || "Desktop Browser",
    deviceType: metadata.deviceType || "desktop",
  };

  if (existingIndex >= 0) {
    subscriptions[existingIndex] = entry;
  } else {
    subscriptions.push(entry);
  }

  persistSubscriptions();
  console.log(`📱 Web Push client registered! Total active push clients: ${subscriptions.length}`);
  return true;
}

/**
 * Get all active subscriptions
 */
export function getActiveSubscriptions() {
  return subscriptions;
}

/**
 * Dispatches real Web Push notification to all registered browsers via Google / Microsoft Push Network
 */
export async function dispatchWebPush({
  title = "🔔 TrackmySubs: Renewal Day Alert!",
  body = "A subscription is renewing today! Check your billing details.",
  icon = "/file.svg",
  url = "/calendar",
}) {
  if (subscriptions.length === 0) {
    console.log("ℹ️ No active Web Push subscriptions found.");
    return {
      success: true,
      delivered: 0,
      mode: "no_subscribers",
      message: "No active push subscriptions yet. Allow push notifications in TrackmySubs first.",
    };
  }

  const payload = JSON.stringify({
    title,
    body,
    icon,
    badge: "/file.svg",
    vibrate: [200, 100, 200, 100, 200],
    sound: "/sounds/renewal-chime.wav",
    silent: false,
    requireInteraction: true,
    data: {
      url,
      timestamp: Date.now(),
    },
  });

  const active = [...subscriptions];
  let delivered = 0;
  let expired = 0;

  for (const sub of active) {
    try {
      await webpush.sendNotification(sub, payload);
      delivered++;
      console.log(`🚀 Real Web Push delivered to ${sub.endpoint.slice(0, 35)}...`);
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription expired or unsubscribed
        subscriptions = subscriptions.filter((s) => s.endpoint !== sub.endpoint);
        expired++;
      } else {
        console.warn("WebPush dispatch note:", err.message);
      }
    }
  }

  if (expired > 0) {
    persistSubscriptions();
  }

  return {
    success: delivered > 0 || subscriptions.length === 0,
    delivered,
    expired,
    total: subscriptions.length,
    message: `Dispatched to ${delivered} active browser(s) via Web Push!`,
  };
}

/**
 * Schedules a delayed push dispatch on the server
 * Runs on the Node.js server thread, completely independent of the browser tab!
 */
export function scheduleDelayedPush({
  delaySeconds = 10,
  title,
  body,
  icon,
  url,
}) {
  console.log(`⏳ Server scheduled push countdown started: ${delaySeconds}s (you can close your browser tab now)...`);

  setTimeout(async () => {
    console.log(`⏰ Server countdown finished (${delaySeconds}s elapsed). Sending real Web Push to browser...`);
    await dispatchWebPush({
      title: title || "🔔 TrackmySubs: Renewal Day Alert!",
      body: body || "YouTube Premium renews today (₹299). This alert fired while your tab was CLOSED!",
      icon: icon || "/file.svg",
      url: url || "/calendar",
    });
  }, delaySeconds * 1000);
}

