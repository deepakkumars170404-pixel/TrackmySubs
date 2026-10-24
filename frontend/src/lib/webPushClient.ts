/**
 * Official W3C Web Push (VAPID) Client
 * Enables 100% genuine background notifications & OS chimes
 * even when the website is closed and mobile screen is turned off.
 */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Resilient multi-host fetch helper for notifications API
 */
async function fetchNotifApi(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const hosts: string[] = [];
  if (typeof window !== "undefined") {
    hosts.push(window.location.origin);
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      hosts.push("http://127.0.0.1:5000");
    }
  }
  hosts.push("https://trackmysubs-backend.onrender.com");

  let lastError: any = null;
  for (const host of hosts) {
    try {
      const url = `${host.replace(/\/$/, "")}/api/notifications/${endpoint.replace(/^\//, "")}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        return res;
      }
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("Unable to connect to notification server.");
}

/**
 * Ensures Service Worker is registered and active
 */
export async function getActiveServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    }
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.warn("Service Worker registration error:", err);
    return null;
  }
}

/**
 * Registers device with the backend for real Web Push notifications
 */
export async function registerWebPushSubscription(): Promise<{
  success: boolean;
  subscription?: PushSubscription;
  error?: string;
}> {
  if (typeof window === "undefined" || !("PushManager" in window)) {
    return { success: false, error: "Push messaging is not supported in this browser." };
  }

  // 1. Request notification permission
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { success: false, error: "Notification permission was denied." };
  }

  try {
    const reg = await getActiveServiceWorkerRegistration();
    if (!reg) {
      return { success: false, error: "Service Worker could not be activated." };
    }

    // 2. Fetch VAPID public key from backend
    const vapidRes = await fetchNotifApi("vapid-key");
    const { publicKey } = await vapidRes.json();
    if (!publicKey) {
      throw new Error("Invalid VAPID public key returned.");
    }

    // 3. Unsubscribe any existing subscription created with an older key
    const existingSub = await reg.pushManager.getSubscription();
    if (existingSub) {
      try {
        await existingSub.unsubscribe();
      } catch (unsubErr) {
        console.warn("Unsubscribe existing push note:", unsubErr);
      }
    }

    // 4. Create fresh subscription with current matching VAPID key
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });

    // 5. Send subscription payload to Express backend
    const saveRes = await fetchNotifApi("webpush-subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        userAgent: navigator.userAgent,
        deviceType: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? "mobile" : "desktop",
      }),
    });

    const saveJson = await saveRes.json();
    if (saveJson.success) {
      localStorage.setItem("trackmysubs_webpush_subscribed", "true");
      return { success: true, subscription: sub };
    } else {
      return { success: false, error: saveJson.message || "Failed to save push subscription on server." };
    }
  } catch (err: any) {
    console.error("Web Push registration error:", err);
    return { success: false, error: err?.message || "Failed to register Web Push." };
  }
}

/**
 * Triggers a real server-side push notification with a delay (e.g. 10s)
 * Designed explicitly for testing after CLOSING the localhost browser tab or TURNING OFF mobile screen!
 */
export async function testClosedTabWebPush(delaySeconds: number = 10): Promise<{
  success: boolean;
  message: string;
  delaySeconds: number;
}> {
  // Ensure push is subscribed first
  const regResult = await registerWebPushSubscription();
  if (!regResult.success) {
    return {
      success: false,
      message: `Push registration required: ${regResult.error}`,
      delaySeconds,
    };
  }

  // Trigger delayed server push
  const res = await fetchNotifApi("test-closed-tab", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      delaySeconds,
      title: "🔔 TrackmySubs: 1-Day Prior Renewal Alert!",
      body: `YouTube Premium & Netflix renew tomorrow (₹948). This alert arrived with tab CLOSED & phone screen OFF!`,
    }),
  });

  const json = await res.json();
  return {
    success: json.success,
    message: json.message,
    delaySeconds,
  };
}

/**
 * Dispatches 1-day prior renewal alert for all subscriptions to all registered devices (Web Push + FCM)
 */
export async function trigger1DayAllSubscriptionsPush(subscriptions?: any[], delaySeconds?: number): Promise<{
  success: boolean;
  message: string;
  count?: number;
  totalCost?: number;
}> {
  try {
    const res = await fetchNotifApi("notify-1day-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscriptions: subscriptions || undefined,
        delaySeconds: delaySeconds || undefined,
      }),
    });
    const json = await res.json();
    return {
      success: json.success,
      message: json.message,
      count: json.count,
      totalCost: json.totalCost,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Failed to trigger 1-day alert.",
    };
  }
}

/**
 * Delivers live renewal summary digest to registered email
 */
export async function sendRenewalEmailDigest(email?: string, subscriptions?: any[]): Promise<{
  success: boolean;
  message: string;
  totalCost?: number;
  count?: number;
}> {
  try {
    const res = await fetchNotifApi("test-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email || undefined,
        subscriptions: subscriptions || undefined,
      }),
    });
    const json = await res.json();
    return {
      success: json.success,
      message: json.message,
      totalCost: json.totalCost,
      count: json.count,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Failed to send email digest.",
    };
  }
}
