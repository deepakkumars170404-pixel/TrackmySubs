import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function sendJioHotstarBill() {
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
    const rechargeDate = "22 Oct 2026";
  const renewalDate = "17 Dec 2026";
  const validityDays = 56;
  const amount = "549.00";
  const orderId = `JIO-REC-20261022`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Jio + Disney+ Hotstar Electronic Receipt</title>
</head>
<body style="margin: 0; padding: 20px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
    
    <!-- Top Header Banner -->
    <div style="background: linear-gradient(135deg, #005AA9 0%, #113CCF 100%); padding: 30px 25px; text-align: center; color: #ffffff;">
      <div style="display: inline-block; background: #ffffff; padding: 8px 16px; border-radius: 12px; margin-bottom: 12px;">
        <span style="font-weight: 900; font-size: 18px; color: #005AA9; letter-spacing: 1px;">Jio</span>
        <span style="color: #64748b; font-size: 14px; margin: 0 6px;">+</span>
        <span style="font-weight: 800; font-size: 16px; color: #113CCF;">Disney+ hotstar</span>
      </div>
      <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">Recharge Receipt & Tax Invoice</h1>
      <p style="margin: 6px 0 0; font-size: 13px; color: #e0f2fe;">56 Days Unlimited Pack · Mobile Subscription Confirmed</p>
    </div>

    <!-- Main Content Area -->
    <div style="padding: 25px;">
      
      <!-- Status Badge -->
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 12px 16px; margin-bottom: 20px; display: flex; align-items: center;">
        <span style="color: #16a34a; font-size: 16px; font-weight: bold; margin-right: 8px;">✓</span>
        <span style="color: #15803d; font-size: 13px; font-weight: 600;">Payment Successful via UPI AutoPay · Active on Jio Network</span>
      </div>

      <!-- Key Details Grid -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 10px; background: #f8fafc; border-radius: 10px; width: 50%;">
            <span style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">Payment Account</span><div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 2px;">Verified Account</div>
          </td>
          <td style="width: 10px;"></td>
          <td style="padding: 10px; background: #f8fafc; border-radius: 10px; width: 50%;">
            <span style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">Receipt / Order ID</span>
            <div style="font-size: 13px; font-weight: 700; color: #005AA9; font-family: monospace; margin-top: 2px;">${orderId}</div>
          </td>
        </tr>
        <tr><td style="height: 10px;"></td></tr>
        <tr>
          <td style="padding: 10px; background: #f8fafc; border-radius: 10px;">
            <span style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">Recharge Date</span>
            <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 2px;">${rechargeDate}</div>
          </td>
          <td style="width: 10px;"></td>
          <td style="padding: 10px; background: #eef2ff; border-radius: 10px; border: 1px solid #c7d2fe;">
            <span style="font-size: 11px; color: #4338ca; font-weight: 700; text-transform: uppercase;">Next Renewal Date (56 Days)</span>
            <div style="font-size: 15px; font-weight: 900; color: #3730a3; margin-top: 2px;">${renewalDate}</div>
          </td>
        </tr>
      </table>

      <!-- Line Item Details -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <thead>
          <tr style="background: #f1f5f9; text-align: left; font-size: 11px; color: #475569; text-transform: uppercase;">
            <th style="padding: 12px 14px;">Plan Details</th>
            <th style="padding: 12px 14px; text-align: right;">Amount (INR)</th>
          </tr>
        </thead>
        <tbody style="font-size: 13px; color: #1e293b;">
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px 14px;">
              <strong>Jio Prepaid Plan (1.5 GB/Day, Unlimited Calls)</strong>
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Includes 56 Days Disney+ Hotstar Mobile Subscription</div>
            </td>
            <td style="padding: 12px 14px; text-align: right; font-family: monospace;">₹465.25</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 12px;">
            <td style="padding: 8px 14px;">CGST (9%)</td>
            <td style="padding: 8px 14px; text-align: right; font-family: monospace;">₹41.88</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 12px;">
            <td style="padding: 8px 14px;">SGST (9%)</td>
            <td style="padding: 8px 14px; text-align: right; font-family: monospace;">₹41.87</td>
          </tr>
          <tr style="background: #f8fafc; font-weight: 800; font-size: 16px;">
            <td style="padding: 14px; color: #0f172a;">Total Amount Charged</td>
            <td style="padding: 14px; text-align: right; color: #005AA9; font-family: monospace;">₹${amount}</td>
          </tr>
        </tbody>
      </table>

      

      <!-- Sync Status with App -->
      <div style="background: #e0f2fe; border: 1px solid #bae6fd; border-radius: 12px; padding: 12px 14px; font-size: 12px; color: #0369a1;">
        ⚡ <strong>Live Web App & Calendar Sync:</strong> This subscription and its 56-day renewal date (${renewalDate}) are linked directly to your <strong>Subscriptions Ledger</strong> and <strong>Calendar</strong>.
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; padding: 18px 25px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
      Reliance Jio Infocomm Limited · Billed to ${recipient} · Customer Care: 199 / 1800-889-9999
    </div>
  </div>
</body>
</html>
  `;

  const info = await transporter.sendMail({
    from: `"${process.env.EMAIL_FROM_NAME || 'Subscription Management'}" <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`,
    to: recipient,
    subject: `Your Jio + Disney+ Hotstar Subscription Receipt - ₹549`,
    html: htmlContent,
    text: `Your Jio + Disney+ Hotstar recharge of ₹549 is successful on 22 Oct 2026. Pack validity: 56 days. Next renewal date: 17 Dec 2026. Billed to ${recipient}.`,
  });

  console.log("Jio Hotstar Email Sent Successfully!");
  console.log("Message ID:", info.messageId);
  console.log("Recipient:", recipient);
    console.log("Next Renewal Date (56 Days):", renewalDate);
  return info;
}

sendJioHotstarBill().catch(console.error);
