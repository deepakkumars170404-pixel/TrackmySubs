import { Resend } from "resend";
import nodemailer from "nodemailer";

let cachedNodemailerTransporter = null;

function getNodemailerTransporter() {
  if (cachedNodemailerTransporter) return cachedNodemailerTransporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

  if (user && pass) {
    cachedNodemailerTransporter = nodemailer.createTransport({
      host: host || "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user, pass }
    });
    return cachedNodemailerTransporter;
  }
  return null;
}

export async function sendEmail({ to, subject, html, text }) {
  const senderName = process.env.EMAIL_FROM_NAME || "TrackmySubs";
  const defaultFrom = process.env.EMAIL_FROM || "notifications@trackmysubs.com";
  const replyTo = process.env.ADMIN_EMAIL || "deepakkumars170404@gmail.com";

  // 1. Try Resend first if API key is present (best for custom domain reputation & hiding personal address)
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY.replace(/^["']|["']$/g, ""));

    // Attempt with configured EMAIL_FROM
    try {
      const fromAddress = defaultFrom.includes("@") ? defaultFrom : "onboarding@resend.dev";
      const { data, error } = await resend.emails.send({
        from: `${senderName} <${fromAddress}>`,
        to: [to],
        reply_to: replyTo,
        subject,
        html,
        text
      });

      if (!error && data?.id) {
        console.log(`[Email Service] Sent via Resend to ${to}. ID: ${data.id}`);
        return { success: true, provider: "resend", messageId: data.id };
      }

      if (error) {
        console.warn(`[Email Service] Resend first attempt failed: ${error.message}`);
        // If domain is unverified, try falling back to onboarding@resend.dev
        if (fromAddress !== "onboarding@resend.dev") {
          console.log("[Email Service] Retrying with onboarding@resend.dev...");
          const retryResp = await resend.emails.send({
            from: `${senderName} <onboarding@resend.dev>`,
            to: [to],
            reply_to: replyTo,
            subject,
            html,
            text
          });

          if (!retryResp.error && retryResp.data?.id) {
            console.log(`[Email Service] Sent via Resend (onboarding) to ${to}. ID: ${retryResp.data.id}`);
            return { success: true, provider: "resend", messageId: retryResp.data.id };
          }
        }
      }
    } catch (resendCatchErr) {
      console.error("[Email Service] Resend exception:", resendCatchErr.message);
    }
  }

  // 2. Try Nodemailer if SMTP configured (uses domain sender and replyTo: admin)
  const smtpTransporter = getNodemailerTransporter();
  if (smtpTransporter) {
    try {
      const info = await smtpTransporter.sendMail({
        from: `"${senderName}" <${defaultFrom}>`,
        replyTo,
        to,
        subject,
        html,
        text
      });
      console.log(`[Email Service] Sent via SMTP to ${to}. MessageId: ${info.messageId}`);
      return { success: true, provider: "smtp", messageId: info.messageId };
    } catch (smtpErr) {
      console.error("[Email Service] SMTP error:", smtpErr.message);
    }
  }

  return { success: false, error: "No working email transport configured." };
}

export async function sendPasswordResetOtp({ to, otp, resetLink }) {
  console.log(`\n========================================`);
  console.log(`🔑 [PASSWORD RESET OTP]`);
  console.log(`To: ${to}`);
  console.log(`OTP Code: ${otp}`);
  console.log(`Reset Link: ${resetLink}`);
  console.log(`========================================\n`);

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #ffffff; color: #1e293b; border-radius: 16px; border: 1px solid #e2e8f0;">
      <div style="text-align: center; margin-bottom: 28px;">
        <h1 style="color: #4f46e5; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">TrackmySubs</h1>
        <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Household & Personal Subscription Tracker</p>
      </div>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; text-align: center;">
        <h2 style="color: #0f172a; font-size: 18px; margin: 0 0 12px 0;">Password Reset Request</h2>
        <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
          Use the one-time verification code below to reset your password. This code will expire in 15 minutes.
        </p>

        <div style="background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 14px; margin: 0 auto 20px auto; display: inline-block;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #4f46e5; font-family: monospace;">${otp}</span>
        </div>

        <p style="color: #64748b; font-size: 13px; margin: 0 0 20px 0;">
          Or click the button below to reset directly:
        </p>

        <div>
          <a href="${resetLink}" style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 10px 24px; border-radius: 8px;">
            Reset Password
          </a>
        </div>
      </div>

      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 24px;">
        If you did not request a password reset, please ignore this email or contact support.
      </p>
    </div>
  `;

  const text = `TrackmySubs Password Reset\n\nYour one-time verification code (OTP) is: ${otp}\n\nOr open this link to reset: ${resetLink}\n\nIf you did not request this, please ignore this email.`;

  return sendEmail({
    to,
    subject: "TrackmySubs: Your Password Reset Verification Code",
    html,
    text
  });
}

export async function sendPasswordResetConfirmation({ to }) {
  console.log(`\n========================================`);
  console.log(`✅ [PASSWORD RESET SUCCESS CONFIRMATION]`);
  console.log(`To: ${to}`);
  console.log(`========================================\n`);

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #ffffff; color: #1e293b; border-radius: 16px; border: 1px solid #e2e8f0;">
      <div style="text-align: center; margin-bottom: 28px;">
        <h1 style="color: #4f46e5; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">TrackmySubs</h1>
        <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Household & Personal Subscription Tracker</p>
      </div>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; text-align: center;">
        <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: rgba(16, 185, 129, 0.1); border-radius: 50%; margin-bottom: 16px;">
          <span style="color: #10b981; font-size: 24px;">✓</span>
        </div>
        <h2 style="color: #0f172a; font-size: 18px; margin: 0 0 12px 0;">Password Reset Successful</h2>
        <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
          Your TrackmySubs password has been successfully updated. You can now use your new password to log in.
        </p>
        <p style="color: #ef4444; font-size: 13px; margin: 0;">
          If you did not authorize this change, please contact our support team immediately.
        </p>
      </div>

      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 24px;">
        © TrackmySubs. All rights reserved.
      </p>
    </div>
  `;

  const text = `TrackmySubs: Your password has been successfully updated.\n\nYou can now log in with your new password.\n\nIf you did not authorize this change, please contact our support team immediately.`;

  return sendEmail({
    to,
    subject: "TrackmySubs: Your Password Was Successfully Reset",
    html,
    text
  });
}
