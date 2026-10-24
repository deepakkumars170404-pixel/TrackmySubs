import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function sendZee5Bill() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.resend.com",
    port: parseInt(process.env.SMTP_PORT || "465", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER || "resend",
      pass: process.env.SMTP_PASS,
    },
  });

  const recipient = "deepakkumars170404@gmail.com";
    const purchaseDate = "22 Oct 2026";
  const renewalDate = "20 Jan 2027";
  const validityDays = 90;
  const amount = "399.00";
  const orderId = `ZEE5-REC-20261022`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>ZEE5 Premium Electronic Receipt & Bill</title>
</head>
<body style="margin: 0; padding: 20px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
    
    <!-- Top Header Banner -->
    <div style="background: linear-gradient(135deg, #7A2672 0%, #4A154B 100%); padding: 30px 25px; text-align: center; color: #ffffff;">
      <div style="display: inline-block; background: #ffffff; padding: 6px 18px; border-radius: 12px; margin-bottom: 12px;">
        <span style="font-weight: 900; font-size: 20px; color: #7A2672; letter-spacing: 1px;">ZEE5</span>
        <span style="font-weight: 800; font-size: 14px; color: #f59e0b; margin-left: 4px;">PREMIUM</span>
      </div>
      <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">Subscription Confirmation & Bill</h1>
      <p style="margin: 6px 0 0; font-size: 13px; color: #fce7f3;">90 Days All-Access Pass · Billed to ${recipient}</p>
    </div>

    <!-- Main Content Area -->
    <div style="padding: 25px;">
      
      <!-- Status Badge -->
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 12px 16px; margin-bottom: 20px; display: flex; align-items: center;">
        <span style="color: #16a34a; font-size: 16px; font-weight: bold; margin-right: 8px;">✓</span>
        <span style="color: #15803d; font-size: 13px; font-weight: 600;">Payment Confirmed via UPI AutoPay · 90 Days Active</span>
      </div>

      <!-- Key Details Grid -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 10px; background: #f8fafc; border-radius: 10px; width: 50%;">
            <span style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">Payment Account</span><div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 2px;">Verified Account</div>
          </td>
          <td style="width: 10px;"></td>
          <td style="padding: 10px; background: #f8fafc; border-radius: 10px; width: 50%;">
            <span style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">Invoice Number</span>
            <div style="font-size: 13px; font-weight: 700; color: #7A2672; font-family: monospace; margin-top: 2px;">${orderId}</div>
          </td>
        </tr>
        <tr><td style="height: 10px;"></td></tr>
        <tr>
          <td style="padding: 10px; background: #f8fafc; border-radius: 10px;">
            <span style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">Purchase Date</span>
            <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 2px;">${purchaseDate}</div>
          </td>
          <td style="width: 10px;"></td>
          <td style="padding: 10px; background: #fae8ff; border-radius: 10px; border: 1px solid #e879f9;">
            <span style="font-size: 11px; color: #86198f; font-weight: 700; text-transform: uppercase;">Next Renewal Date (90 Days)</span>
            <div style="font-size: 15px; font-weight: 900; color: #701a75; margin-top: 2px;">${renewalDate}</div>
          </td>
        </tr>
      </table>

      <!-- Line Item Details -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <thead>
          <tr style="background: #f1f5f9; text-align: left; font-size: 11px; color: #475569; text-transform: uppercase;">
            <th style="padding: 12px 14px;">Plan Description</th>
            <th style="padding: 12px 14px; text-align: right;">Amount (INR)</th>
          </tr>
        </thead>
        <tbody style="font-size: 13px; color: #1e293b;">
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px 14px;">
              <strong>ZEE5 Premium Quarterly Pass (4K UHD · 2 Screens)</strong>
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Validity: 90 Days (22 Oct 2026 to 20 Jan 2027)</div>
            </td>
            <td style="padding: 12px 14px; text-align: right; font-family: monospace;">₹338.14</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 12px;">
            <td style="padding: 8px 14px;">Integrated GST (18%)</td>
            <td style="padding: 8px 14px; text-align: right; font-family: monospace;">₹60.86</td>
          </tr>
          <tr style="background: #f8fafc; font-weight: 800; font-size: 16px;">
            <td style="padding: 14px; color: #0f172a;">Total Amount Paid</td>
            <td style="padding: 14px; text-align: right; color: #7A2672; font-family: monospace;">₹${amount}</td>
          </tr>
        </tbody>
      </table>

      

      <!-- Sync Status with App -->
      <div style="background: #fae8ff; border: 1px solid #f5d0fe; border-radius: 12px; padding: 12px 14px; font-size: 12px; color: #86198f;">
        ⚡ <strong>Live Web App & Calendar Sync:</strong> This subscription and its 90-day renewal date (${renewalDate}) are linked directly to your <strong>Subscriptions Ledger</strong> and <strong>Calendar</strong>.
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; padding: 18px 25px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
      Zee Entertainment Enterprises Limited · Billed to ${recipient} · Support: support@zee5.com
    </div>
  </div>
</body>
</html>
  `;

  const info = await transporter.sendMail({
    from: `"${process.env.EMAIL_FROM_NAME || 'Subscription Management'}" <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`,
    to: recipient,
    subject: `Your ZEE5 Premium Subscription Receipt - ₹399 (90 Days Valid)`,
    html: htmlContent,
    text: `Your ZEE5 Premium subscription of ₹399 is active from 22 Oct 2026. Pack validity: 90 days. Next renewal date: 20 Jan 2027. Billed to ${recipient}.`,
  });

  console.log("ZEE5 Bill Email Sent Successfully!");
  console.log("Message ID:", info.messageId);
  console.log("Recipient:", recipient);
    console.log("Next Renewal Date (90 Days):", renewalDate);
  return info;
}

sendZee5Bill().catch(console.error);
