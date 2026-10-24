/**
 * Firebase Cloud Messaging (FCM) Client for Web & Future Mobile Apps
 * Handles device token generation, background service worker registration,
 * and push messaging when the app/browser is completely closed.
 */

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported, Messaging } from "firebase/messaging";
import { playMobileNotificationSound } from "./soundNotification";

// Default/Demo configuration or environment variables
export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDummyKeyForFCMSetupTrackmySubs",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "trackmysubs-notifications.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "trackmysubs-notifications",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "trackmysubs-notifications.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "109876543210",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:109876543210:web:abcdef123456",
  vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "BPE...dummyVapidKey...",
};

export function isRealFirebaseConfig(config: typeof DEFAULT_FIREBASE_CONFIG): boolean {
  if (!config.apiKey || config.apiKey.includes("DummyKey")) return false;
  if (!config.projectId || config.projectId === "trackmysubs-notifications") return false;
  return true;
}

export function getActiveFirebaseConfig() {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("trackmysubs_custom_fcm_config");
    if (saved) {
      try {
        return { ...DEFAULT_FIREBASE_CONFIG, ...JSON.parse(saved) };
      } catch {
        // Fallback
      }
    }
  }
  return DEFAULT_FIREBASE_CONFIG;
}

export function saveCustomFirebaseConfig(config: Partial<typeof DEFAULT_FIREBASE_CONFIG>) {
  if (typeof window !== "undefined") {
    const current = getActiveFirebaseConfig();
    const updated = { ...current, ...config };
    localStorage.setItem("trackmysubs_custom_fcm_config", JSON.stringify(updated));
    return updated;
  }
  return DEFAULT_FIREBASE_CONFIG;
}

let firebaseAppInstance: FirebaseApp | null = null;
let messagingInstance: Messaging | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === "undefined") return null;

  try {
    const config = getActiveFirebaseConfig();
    if (!isRealFirebaseConfig(config)) {
      return null;
    }

    if (!getApps().length) {
      firebaseAppInstance = initializeApp(config);
    } else {
      firebaseAppInstance = getApp();
    }
    return firebaseAppInstance;
  } catch (err) {
    console.warn("FCM FirebaseApp init note:", err);
    return null;
  }
}

/**
 * Request device token from Google FCM and register it with the backend
 */
export async function registerFcmDeviceToken(): Promise<{
  success: boolean;
  token?: string;
  isDemo?: boolean;
  error?: string;
}> {
  if (typeof window === "undefined") {
    return { success: false, error: "Window is not defined" };
  }

  const config = getActiveFirebaseConfig();

  // If using placeholder dummy keys, run in instant Demo Token mode (avoids Google 400 Invalid API Key error)
  if (!isRealFirebaseConfig(config)) {
    const demoToken = `fcm_demo_token_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
    localStorage.setItem("trackmysubs_fcm_token", demoToken);

    // Sync with backend
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
    try {
      await fetch(`${backendUrl}/api/notifications/fcm-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: demoToken,
          userAgent: navigator.userAgent,
          deviceType: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? "mobile" : "desktop",
        }),
      });
    } catch {
      // Backend sync note
    }

    return {
      success: true,
      token: demoToken,
      isDemo: true,
    };
  }

  // Real Firebase Config provided: register with Google live servers
  const supported = await isSupported();
  if (!supported) {
    return { success: false, error: "Firebase Messaging is not supported in this browser." };
  }

  try {
    const app = getFirebaseApp();
    if (!app) {
      return { success: false, error: "Failed to initialize Firebase app. Check your API key." };
    }

    // Register official Firebase Service Worker
    const swUrl = `/firebase-messaging-sw.js?config=${encodeURIComponent(JSON.stringify(config))}`;
    const swRegistration = await navigator.serviceWorker.register(swUrl);

    messagingInstance = getMessaging(app);

    // Request token with VAPID key
    const token = await getToken(messagingInstance, {
      vapidKey: config.vapidKey !== "BPE...dummyVapidKey..." ? config.vapidKey : undefined,
      serviceWorkerRegistration: swRegistration,
    });

    if (token) {
      localStorage.setItem("trackmysubs_fcm_token", token);

      // Send token to our Express backend
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
      try {
        await fetch(`${backendUrl}/api/notifications/fcm-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            userAgent: navigator.userAgent,
            deviceType: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? "mobile" : "desktop",
          }),
        });
      } catch (backendErr) {
        console.warn("Backend token sync note:", backendErr);
      }

      return { success: true, token, isDemo: false };
    } else {
      return { success: false, error: "No registration token returned from Firebase." };
    }
  } catch (err: any) {
    console.warn("FCM Token generation error:", err);
    return {
      success: false,
      error: err?.message || "Failed to retrieve live FCM token from Google.",
    };
  }
}

/**
 * Setup foreground listener for real-time renewal push messages
 */
export function setupFcmForegroundListener(onReceiveMessage?: (payload: any) => void) {
  if (typeof window === "undefined") return;

  const config = getActiveFirebaseConfig();
  if (!isRealFirebaseConfig(config)) return;

  isSupported().then((supported) => {
    if (!supported) return;

    const app = getFirebaseApp();
    if (!app) return;

    try {
      const messaging = getMessaging(app);
      onMessage(messaging, (payload) => {
        // Play mobile notification chime
        playMobileNotificationSound();

        if (onReceiveMessage) {
          onReceiveMessage(payload);
        }
      });
    } catch (e) {
      console.warn("Foreground message setup note:", e);
    }
  });
}

/**
 * Triggers a test push from the backend via FCM
 */
export async function sendTestFcmPushFromBackend(token?: string): Promise<{ success: boolean; message: string }> {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
  const targetToken = token || (typeof window !== "undefined" ? localStorage.getItem("trackmysubs_fcm_token") : null);

  try {
    const res = await fetch(`${backendUrl}/api/notifications/test-fcm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: targetToken }),
    });

    const data = await res.json();

    // In both live and demo mode, ring the mobile notification chime!
    playMobileNotificationSound();

    return data;
  } catch (err: any) {
    // If backend isn't reached, play chime locally as fallback
    playMobileNotificationSound();
    return {
      success: true,
      message: "Local test chime played! (Backend server might be restarting).",
    };
  }
}

/**
 * Tells the backend to fire a push in 10 seconds, giving the user time to close the browser tab completely
 */
export async function triggerDelayedCloseTabTest(delaySeconds = 10): Promise<{ success: boolean; message: string }> {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
  try {
    const res = await fetch(`${backendUrl}/api/notifications/test-delayed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delaySeconds }),
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Failed to contact backend.",
    };
  }
}
