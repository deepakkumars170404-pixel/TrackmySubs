import express from "express";
import nodemailer from "nodemailer";
import { registerToken, getRegisteredTokens, sendRenewalNotification } from "../services/fcmService.js";
import {
  VAPID_PUBLIC_KEY,
  savePushSubscription,
  getActiveSubscriptions,
  dispatchWebPush,
  scheduleDelayedPush,
} from "../services/webPushService.js";
import { createAdminClient } from "../config/supabase.js";

const router = express.Router();

// GET /api/notifications/vapid-key - Get public VAPID key for web push subscription
router.get("/vapid-key", (req, res) => {
  res.json({
    success: true,
    publicKey: VAPID_PUBLIC_KEY,
  });
});

// POST /api/notifications/webpush-subscribe - Register standard browser Web Push subscription
router.post("/webpush-subscribe", (req, res) => {
  const { subscription, userAgent, deviceType } = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ success: false, message: "Valid push subscription is required." });
  }

  const saved = savePushSubscription(subscription, { userAgent, deviceType });
  res.json({
    success: saved,
    message: saved ? "Web Push subscription saved successfully." : "Failed to save push subscription.",
    totalActive: getActiveSubscriptions().length,
  });
});

// POST /api/notifications/fcm-token - Register FCM device token
router.post("/fcm-token", (req, res) => {
  const { token, userAgent, deviceType } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: "Token is required." });
  }

  const registered = registerToken(token, { userAgent, deviceType });
  res.json({
    success: registered,
    message: registered ? "Device token registered successfully." : "Failed to register token.",
    totalDevices: getRegisteredTokens().length,
  });
});

// GET /api/notifications/status - Check notification service status and subscriber counts
router.get("/status", (req, res) => {
  const fcmTokens = getRegisteredTokens();
  const webPushSubs = getActiveSubscriptions();
  res.json({
    success: true,
    services: ["W3C Web Push (VAPID)", "Firebase Cloud Messaging (FCM)"],
    webPushSubscribers: webPushSubs.length,
    fcmSubscribers: fcmTokens.length,
    totalDevices: webPushSubs.length + fcmTokens.length,
    fcmConfigured: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_PROJECT_ID),
  });
});

// POST /api/notifications/test-fcm - Test FCM push dispatch
router.post("/test-fcm", async (req, res) => {
  const { token, title, body } = req.body;
  const targetTokens = token ? [token] : null;

  const result = await sendRenewalNotification({
    title: title || "🔔 TrackmySubs: Renewal Day Alert!",
    body: body || "YouTube Premium renews today (₹299). This push arrived via Google Firebase Cloud Messaging!",
    targetTokens,
    data: {
      url: "/calendar",
      subName: "YouTube Premium",
      cost: "299",
    },
  });

  res.json(result);
});

// POST /api/notifications/test-closed-tab - Schedules a real push that arrives after closing the browser tab
router.post("/test-closed-tab", (req, res) => {
  const { delaySeconds = 10, title, body } = req.body;

  scheduleDelayedPush({
    delaySeconds,
    title: title || "🔔 TrackmySubs: 1-Day Prior Renewal Alert!",
    body: body || "A subscription is renewing tomorrow! This alert fired while your tab was CLOSED & mobile screen was OFF!",
    icon: "/favicon.ico",
    url: "/calendar",
  });

  res.json({
    success: true,
    delaySeconds,
    message: `Server push timer started for ${delaySeconds}s! Close your browser tab now or turn off your mobile screen.`,
  });
});

// POST /api/notifications/test-delayed - Alias for test-closed-tab
router.post("/test-delayed", (req, res) => {
  const { delaySeconds = 10, title, body } = req.body;

  scheduleDelayedPush({
    delaySeconds,
    title,
    body,
    icon: "/favicon.ico",
    url: "/calendar",
  });

  res.json({
    success: true,
    delaySeconds,
    message: `Server countdown started! Close your browser tab now or lock mobile screen. Alert will arrive in ${delaySeconds} seconds.`,
  });
});

// POST /api/notifications/notify-1day-all - Dispatches 1-day prior renewal alert for all subscriptions to all registered devices (Web Push + FCM)
router.post("/notify-1day-all", async (req, res) => {
  const { subscriptions: clientSubs, delaySeconds } = req.body || {};

  let subs = clientSubs;
  if (!subs || !Array.isArray(subs) || subs.length === 0) {
    try {
      const admin = createAdminClient();
      const { data } = await admin.from("subscriptions").select("*").eq("status", "active");
      if (data && data.length > 0) subs = data;
    } catch {}
  }

  const subsList = subs && subs.length > 0 ? subs : [
    { name: "Netflix Premium", cost: 649 },
    { name: "YouTube Premium", cost: 299 },
    { name: "Spotify Family", cost: 179 }
  ];

  const count = subsList.length;
  const names = subsList.map(s => s.name).join(", ");
  const totalCost = subsList.reduce((sum, s) => sum + (Number(s.cost) || 0), 0);

  const title = `🔔 1-Day Renewal Alert: ${count} Subscriptions Renew Tomorrow!`;
  const body = `${names} (Total ₹${totalCost}). Audio chime & lock-screen alert delivered!`;

  if (typeof delaySeconds === "number" && delaySeconds > 0) {
    scheduleDelayedPush({
      delaySeconds,
      title,
      body,
      icon: "/favicon.ico",
      url: "/calendar",
    });
    return res.json({
      success: true,
      delaySeconds,
      message: `1-day prior renewal alert scheduled in ${delaySeconds}s! Close your tab or lock your mobile screen now.`,
      count,
      totalCost,
    });
  }

  // Instant dispatch
  const webPushRes = await dispatchWebPush({
    title,
    body,
    icon: "/favicon.ico",
    url: "/calendar",
  });

  const fcmRes = await sendRenewalNotification({
    title,
    body,
    data: {
      url: "/calendar",
      count: String(count),
      totalCost: String(totalCost),
    },
  });

  return res.json({
    success: true,
    message: `1-day prior renewal alert dispatched to all active devices (${count} subscriptions, ₹${totalCost})!`,
    delivered: (webPushRes?.delivered || 0) + (fcmRes?.delivered || 0),
    title,
    body,
    count,
    totalCost,
    webPush: webPushRes,
    fcm: fcmRes
  });
});

// POST /api/notifications/test-email - Delivers live renewal summary digest to registered email
router.post("/test-email", async (req, res) => {
  const { email, subscriptions: clientSubs } = req.body || {};
  const recipient = email || process.env.SMTP_USER || "deepakkumars170404@gmail.com";

  let subs = clientSubs;
  if (!subs || !Array.isArray(subs) || subs.length === 0) {
    try {
      const admin = createAdminClient();
      const { data } = await admin.from("subscriptions").select("*").eq("status", "active");
      if (data && data.length > 0) subs = data;
    } catch {}
  }

  const subsList = subs && subs.length > 0 ? subs : [
    { name: "Netflix Premium", cost: 649, billing_cycle: "monthly", next_billing_date: "Tomorrow" },
    { name: "YouTube Premium", cost: 299, billing_cycle: "monthly", next_billing_date: "Tomorrow" },
    { name: "Spotify Family", cost: 179, billing_cycle: "monthly", next_billing_date: "In 2 days" }
  ];

  const totalCost = subsList.reduce((sum, s) => sum + (Number(s.cost) || 0), 0);

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 465),
        secure: true,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      const html = `
        <div style="font-family:Arial,sans-serif;color:#1e293b;max-width:560px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px;background:#ffffff">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
            <div style="width:36px;height:36px;background:linear-gradient(135deg,#4f46e5,#9333ea,#ec4899);border-radius:10px;color:#ffffff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:18px;text-align:center;line-height:36px">T</div>
            <h2 style="color:#0f172a;margin:0;font-size:20px;font-weight:800">TrackmySubs · 1-Day Prior Renewal Summary</h2>
          </div>
          <p style="font-size:14px;color:#475569;margin-bottom:20px">
            Here is your 1-day advance notice for subscriptions scheduled to renew tomorrow. Total upcoming charge: <strong style="color:#0f172a;font-size:16px">₹${totalCost}</strong>.
          </p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:20px 0">
            ${subsList.map(s => `
              <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #e2e8f0">
                <div>
                  <strong style="color:#0f172a;font-size:14px">${s.name}</strong>
                  <div style="color:#64748b;font-size:12px">${s.billing_cycle || 'Monthly'} · Due: ${s.next_billing_date || 'Tomorrow'}</div>
                </div>
                <div style="font-weight:bold;color:#4f46e5;font-size:15px;font-family:monospace">
                  ₹${s.cost}
                </div>
              </div>
            `).join('')}
          </div>
          <p style="font-size:13px;color:#64748b">
            AutoPay reminder: Please ensure your linked bank accounts or cards have sufficient funds before tomorrow's charge.
          </p>
          <p style="margin-top:20px"><a href="https://trackmy-subs.vercel.app/calendar" style="display:inline-block;background:#4f46e5;color:#ffffff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:13px">View in TrackmySubs Calendar &rarr;</a></p>
        </div>
      `;

      await transporter.sendMail({
        from: `"TrackmySubs Notifications" <${process.env.EMAIL_FROM || "notifications@trackmysubs.com"}>`,
        replyTo: process.env.ADMIN_EMAIL || "deepakkumars170404@gmail.com",
        to: recipient,
        subject: `🔔 1-Day Prior Renewal Alert: ${subsList.length} subscriptions renewing tomorrow (₹${totalCost})`,
        html
      });

      return res.json({
        success: true,
        message: `Renewal summary digest successfully delivered to ${recipient} via Gmail SMTP!`,
        totalCost,
        count: subsList.length
      });
    } catch (mailErr) {
      console.warn("Test email digest error:", mailErr.message);
      return res.status(500).json({ success: false, message: mailErr.message });
    }
  }

  return res.json({
    success: true,
    message: `Renewal digest simulated for ${recipient}. Configure SMTP in backend .env to send real mail.`
  });
});

export default router;
