import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.resend.com',
  port: parseInt(process.env.SMTP_PORT || '465', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'resend',
    pass: process.env.SMTP_PASS,
  },
});

export async function sendFamilyInviteEmail({ to, name = 'Family Member', inviterName = 'Family Organizer', acceptUrl }) {
  const finalAcceptUrl = acceptUrl || `http://localhost:3000/family?accept=mem-${Date.now()}&email=${encodeURIComponent(to)}`;

  const info = await transporter.sendMail({
    from: `"${process.env.EMAIL_FROM_NAME || 'Subscription Management'}" <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`,
    to,
    subject: `💌 ${inviterName} invited you to join the Family Subscription Hub`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 24px; color: #ffffff; text-align: center;">
          <div style="font-size: 11px; text-transform: uppercase; color: #c7d2fe; font-weight: 700; letter-spacing: 1px;">Kinfolk Family Household</div>
          <h2 style="margin: 8px 0 0; font-size: 20px; color: #ffffff;">You're Invited to ${inviterName}'s Household!</h2>
        </div>
        <div style="padding: 24px; color: #334155;">
          <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
            Hi <strong>${name}</strong>,
          </p>
          <p style="font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
            <strong>${inviterName}</strong> has invited you to join their household on the Subscription Management Hub. You can view shared subscriptions (Netflix, Spotify, Sun NXT, ZEE5) and connect your billing inbox for automatic receipt scanning.
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${finalAcceptUrl}" style="display: inline-block; background: #4f46e5; color: #ffffff; padding: 12px 28px; border-radius: 12px; font-weight: 700; font-size: 14px; text-decoration: none; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">
              Accept Invitation & Connect Inbox
            </a>
          </div>
          <div style="padding: 12px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 12px; color: #64748b; margin-top: 20px;">
            🔒 <strong>Individual privacy:</strong> Only subscription receipts are scanned. Your personal and private emails remain completely confidential.
          </div>
        </div>
      </div>
    `,
  });

  return info;
}

// Test trigger if run directly
if (process.argv[1] && process.argv[1].endsWith('send_invite_email.js')) {
  sendFamilyInviteEmail({
    to: 'deepakkumars170404@gmail.com',
    name: 'DeepakDK',
    inviterName: 'Deepak',
    acceptUrl: 'http://localhost:3000/family?accept=mem-deepakdk&email=deepakkumars170404@gmail.com'
  }).then(info => console.log('Invitation email delivered! MessageId:', info.messageId)).catch(console.error);
}

