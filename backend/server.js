import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

// Ensure critical defaults are set so server runs smoothly anywhere
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://giuftrigtoackyrfbacw.supabase.co";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpdWZ0cmlndG9hY2t5cmZiYWN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1Nzk5NDksImV4cCI6MjEwODE1NTk0OX0.4YlWVmgKdYtGGDhRbsUr6w4jdOL67I6Z8Tta0bg80eM";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpdWZ0cmlndG9hY2t5cmZiYWN3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjU3OTk0OSwiZXhwIjoyMTA4MTU1OTQ5fQ.UUjogJoGc_94SqlKcaaHdQKtp_eE1MCe4_i5lqj8690";
process.env.SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
process.env.SMTP_PORT = process.env.SMTP_PORT || "465";
process.env.SMTP_SECURE = process.env.SMTP_SECURE || "true";
process.env.SMTP_USER = process.env.SMTP_USER || "deepakkumars170404@gmail.com";
process.env.SMTP_PASS = process.env.SMTP_PASS || "zckftmtgkvfvrozs";
process.env.EMAIL_FROM = process.env.EMAIL_FROM || "notifications@trackmysubs.com";

import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import householdRoutes from "./routes/householdRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import inboxRoutes from "./routes/inboxRoutes.js";
import { startDailyRenewalCron } from "./services/fcmService.js";
import { startImapBackgroundSync } from "./services/imapService.js";
import { createAdminClient, createUserClient } from "./config/supabase.js";
import { familyRoutes } from "./dist/family/family.routes.js";
import { rateLimit } from "express-rate-limit";

const app = express();
app.set('trust proxy', 1);

// Permissive CORS for development & production
app.use(cors({
  origin: (origin, callback) => {
    callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "20kb" }));

app.use("/api/session", rateLimit({ validate: { xForwardedForHeader: false, trustProxy: false },
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false
}));

app.post("/api/session/anonymous", async (_req, res) => {
  const { data, error } = await createUserClient().auth.signInAnonymously();
  if (error || !data?.user || !data?.session) {
    console.error("Anonymous Supabase session creation failed:", error?.message || "Session was not returned.");
    return res.status(502).json({
      success: false,
      message: "Could not create an anonymous session. Check that anonymous sign-ins are enabled in Supabase."
    });
  }
  return res.status(201).json({
    success: true,
    user: { id: data.user.id },
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at
  });
});

app.post("/api/session/refresh", async (req, res) => {
  const { refreshToken } = req.body || {};
  if (typeof refreshToken !== "string" || !refreshToken.trim()) {
    return res.status(400).json({ success: false, message: "A refresh token is required." });
  }
  const { data, error } = await createUserClient().auth.refreshSession({
    refresh_token: refreshToken.trim()
  });
  if (error || !data?.user || !data?.session) {
    return res.status(401).json({ success: false, message: "Session could not be refreshed. Create a new anonymous session." });
  }
  return res.json({
    success: true,
    user: { id: data.user.id },
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at
  });
});

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Subscription Management API is running (100% Supabase Auth & Database). Open the frontend at http://localhost:3000.",
    health: "/api/health"
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "Subscription Management API is running (100% Supabase)." });
});

// Settings API (reads and persists to Supabase public.user_notification_settings)
app.get("/api/settings", async (req, res) => {
  try {
    const admin = createAdminClient();
    const email = req.query.email || "user@trackmysubs.com";

    const { data: { users } } = await admin.auth.admin.listUsers();
    const user = users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    const userId = user?.id || "3b647ce4-af4d-46e6-99a8-ff2b05f3ce20";

    const { data, error } = await admin
      .from("user_notification_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.json({ success: true, settings: data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/settings", async (req, res) => {
  try {
    const admin = createAdminClient();
    const { email, settings } = req.body || {};
    const targetEmail = email || "user@trackmysubs.com";

    const { data: { users } } = await admin.auth.admin.listUsers();
    const user = users?.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase());
    const userId = user?.id || "3b647ce4-af4d-46e6-99a8-ff2b05f3ce20";

    const payload = {
      user_id: userId,
      one_day_reminder: settings.oneDayRenewalReminder ?? true,
      email_reminders: settings.emailReminders ?? true,
      browser_push: settings.browserPush ?? false,
      automatic_detection_enabled: settings.autoTrackingActive ?? true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await admin
      .from("user_notification_settings")
      .upsert(payload, { onConflict: "user_id" })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.json({ success: true, settings: data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Mount Family Module API (from be-family backend)
app.use("/api/family", familyRoutes);
app.use("/api/v1/family", familyRoutes);
app.use("/api/team", familyRoutes);
app.use("/api/v1/team", familyRoutes);
app.use("/api/members", familyRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/inbox", inboxRoutes);
app.use("/api", householdRoutes);

app.use((err, _req, res, _next) => {
  console.error("Unhandled API error:", err);
  res.status(500).json({ success: false, message: err.message || "Server error. Please try again." });
});

const port = Number(process.env.PORT || 5000);
app.listen(port, "0.0.0.0", () => {
  console.log(`Subscription Management API running at http://localhost:${port}`);
  startDailyRenewalCron();
  startImapBackgroundSync({ intervalMinutes: 15 });
});
