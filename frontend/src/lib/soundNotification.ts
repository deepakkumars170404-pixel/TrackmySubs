/**
 * Free Web & Mobile App Notification & Sound Engine
 * Provides:
 * 1. Offline, zero-dependency mobile notification chime via HTML5 Web Audio API & Audio file
 * 2. Background Service Worker native push & system notifications (Windows, Android, Mac, iOS PWA)
 * 3. Works even when the user is NOT inside the webpage (tab minimized, switched to another app, or device locked)
 */

let lastDispatchedTimestamp = 0;

/**
 * Register Service Worker for background notifications outside the webpage
 */
export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }

  return navigator.serviceWorker
    .register("/sw.js")
    .then((registration) => {
      return registration;
    })
    .catch((err) => {
      console.warn("Service Worker registration notice:", err);
      return null;
    });
}

// Auto-register service worker in browser environment
if (typeof window !== "undefined") {
  if (document.readyState === "complete") {
    registerServiceWorker();
  } else {
    window.addEventListener("load", () => registerServiceWorker());
  }
}

/**
 * Plays an authentic, pleasant mobile notification chime.
 * Supports crystal two-tone, metallic bell, and digital pulsar tones with customizable volume.
 */
export function playMobileNotificationSound(
  tone: "chime" | "bell" | "digital" = "chime",
  volume: number = 0.9
): void {
  if (typeof window === "undefined") return;

  // 1. Play synthesizer chime via Web Audio (instant, zero delay)
  synthesizeChime(tone, volume);

  // 2. Play WAV chime file fallback if chime selected
  if (tone === "chime") {
    try {
      const audio = new Audio("/sounds/renewal-chime.wav");
      audio.volume = Math.max(0.1, Math.min(1.0, volume));
      audio.play().catch(() => {});
    } catch {
      // Synth chime already played
    }
  }
}

/**
 * Synthesizes high-fidelity alert chime via HTML5 Web Audio API
 */
function synthesizeChime(tone: "chime" | "bell" | "digital" = "chime", volume: number = 0.9): void {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();

    const startTones = () => {
      try {
        const now = ctx.currentTime;
        const gainVal = Math.max(0.1, Math.min(1.0, volume));

        if (tone === "bell") {
          // Classic Metallic Bell Chime (880 Hz + 1760 Hz shimmer)
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = "sine";
          osc1.frequency.setValueAtTime(880, now);
          gain1.gain.setValueAtTime(0.4 * gainVal, now);
          gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.start(now);
          osc1.stop(now + 0.8);

          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = "triangle";
          osc2.frequency.setValueAtTime(1760, now + 0.05);
          gain2.gain.setValueAtTime(0.3 * gainVal, now + 0.05);
          gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(now + 0.05);
          osc2.stop(now + 0.9);
        } else if (tone === "digital") {
          // Futuristic Digital Pulsar (2200 Hz -> 2600 Hz swift chirp)
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(2200, now);
          osc.frequency.exponentialRampToValueAtTime(2640, now + 0.15);
          gain.gain.setValueAtTime(0.35 * gainVal, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.3);
        } else {
          // Default Crystal Two-Tone Chime: E6 (1318.5 Hz) -> A6 (1760.0 Hz)
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = "sine";
          osc1.frequency.setValueAtTime(1318.5, now);
          gain1.gain.setValueAtTime(0.4 * gainVal, now);
          gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.start(now);
          osc1.stop(now + 0.35);

          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = "sine";
          osc2.frequency.setValueAtTime(1760.0, now + 0.12);
          gain2.gain.setValueAtTime(0.45 * gainVal, now + 0.12);
          gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(now + 0.12);
          osc2.stop(now + 0.6);
        }
      } catch (err) {
        console.warn("Oscillator start note:", err);
      }
    };

    if (ctx.state === "suspended") {
      ctx.resume().then(() => startTones()).catch(() => startTones());
    } else {
      startTones();
    }
  } catch (err) {
    console.warn("Mobile chime sound note:", err);
  }
}

/**
 * Request native browser/app notification permission
 * Supports both Promise and Callback styles for maximum browser compatibility
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }

  if (Notification.permission === "granted") {
    return "granted";
  }

  try {
    let perm: NotificationPermission = Notification.permission;
    // Callback style for older browsers + promise for modern browsers
    const result = await new Promise<NotificationPermission>((resolve) => {
      try {
        const p = Notification.requestPermission((res) => {
          resolve(res);
        });
        if (p && typeof p.then === "function") {
          p.then(resolve).catch(() => resolve(Notification.permission));
        }
      } catch {
        resolve(Notification.permission);
      }
    });

    return result || Notification.permission;
  } catch {
    return Notification.permission || "denied";
  }
}

/**
 * Flashes the tab title to grab user attention when outside the webpage or in another tab
 */
export function flashTabTitle(alertText = "🔔 RENEWAL ALERT! (1)", originalText = "TrackmySubs — Subscriptions & Licenses Hub") {
  if (typeof window === "undefined") return;

  let count = 0;
  const interval = setInterval(() => {
    document.title = count % 2 === 0 ? alertText : originalText;
    count++;
    if (count > 24) {
      clearInterval(interval);
      document.title = originalText;
    }
  }, 750);

  const handleFocus = () => {
    clearInterval(interval);
    document.title = originalText;
    window.removeEventListener("focus", handleFocus);
  };
  window.addEventListener("focus", handleFocus);
}

/**
 * Dispatches a native OS system notification with sound and vibration.
 * Includes debounce protection and unified tag to prevent duplicate notifications.
 */
export async function sendRenewalNotification({
  title,
  body,
  icon,
  playSound = true,
  url = "/calendar",
}: {
  title: string;
  body: string;
  icon?: string;
  playSound?: boolean;
  url?: string;
}): Promise<boolean> {
  const now = Date.now();
  // Brief debounce protection against rapid multi-clicks
  if (now - lastDispatchedTimestamp < 400) {
    return false;
  }
  lastDispatchedTimestamp = now;

  if (playSound) {
    playMobileNotificationSound();
  }

  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }

  // If permission is still default, request permission immediately
  if (Notification.permission === "default") {
    try {
      await requestNotificationPermission();
    } catch {
      // Continue
    }
  }

  if (Notification.permission !== "granted") {
    return false;
  }

  const notificationOptions = {
    body,
    icon: icon || "/favicon.ico",
    badge: "/favicon.ico",
    tag: "trackmysubs-renewal-alert", // Consistent tag ensures browser collapses duplicates into 1
    silent: false,
    requireInteraction: true,
    data: { url },
  };

  // 1. Try Service Worker registration first (works seamlessly when user is outside the browser/app)
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          ...notificationOptions,
          vibrate: [200, 100, 200, 100, 200],
        } as any);
        return true;
      }
    } catch {
      // Fall through to standard Notification
    }
  }

  // 2. Fallback to standard window Notification
  try {
    const notif = new Notification(title, notificationOptions as NotificationOptions);
    notif.onclick = () => {
      window.focus();
      if (url && typeof window !== "undefined") {
        window.location.href = url;
      }
      notif.close();
    };
    return true;
  } catch (e) {
    console.info("Native notification dispatch note:", e);
    return false;
  }
}

/**
 * Schedules a single notification that fires when the user is OUTSIDE the webpage or app.
 * Only triggers ONCE: delegates to Service Worker if active, with page fallback if not.
 */
export async function scheduleBackgroundRenewalNotification({
  delaySeconds = 5,
  title = "🔔 TrackmySubs: Renewal Day Alert!",
  body = "YouTube Premium renews today (₹299). Please check your payment method.",
  icon,
  url = "/calendar",
}: {
  delaySeconds?: number;
  title?: string;
  body?: string;
  icon?: string;
  url?: string;
}): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // Try requesting permission if currently 'default'
  if ("Notification" in window && Notification.permission === "default") {
    try {
      await requestNotificationPermission();
    } catch {
      // Continue regardless
    }
  }

  const hasSW = "serviceWorker" in navigator && !!navigator.serviceWorker.controller;

  const options = {
    body,
    icon: icon || "/favicon.ico",
    sound: "/sounds/renewal-chime.wav",
    vibrate: [200, 100, 200, 100, 200],
    tag: "trackmysubs-renewal-alert",
    data: { url },
  };

  if (hasSW) {
    // 1. Single execution via Service Worker
    try {
      navigator.serviceWorker.controller!.postMessage({
        type: "SCHEDULE_NOTIFICATION",
        delayMs: delaySeconds * 1000,
        title,
        options,
      });
    } catch (e) {
      console.warn("SW schedule note:", e);
    }

    // Page only flashes tab title when time arrives — DOES NOT send duplicate notification!
    setTimeout(() => {
      flashTabTitle("🔔 (1) RENEWAL ALERT!");
    }, delaySeconds * 1000);
  } else {
    // 2. Fallback execution via Page timer if Service Worker is not active
    setTimeout(() => {
      playMobileNotificationSound();
      flashTabTitle("🔔 (1) RENEWAL ALERT!");
      sendRenewalNotification({
        title,
        body,
        icon,
        playSound: false,
        url,
      });
    }, delaySeconds * 1000);
  }

  return true;
}
