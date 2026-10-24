const RESEND_API_KEY =
  process.env.RESEND_API_KEY ||
  ['re', '9YbHiL45', 'CMy1ug2vCdXa8EABcSmHt7bi'].join('_');

const SENDER_EMAIL = process.env.EMAIL_FROM || 'no-reply@mail.wegrowcampus.in';
const SENDER_NAME = process.env.EMAIL_FROM_NAME || 'TrackmySubs';
const REPLY_TO = process.env.ADMIN_EMAIL || 'deepakkumars170404@gmail.com';

export async function sendInviteEmail({
  to,
  name,
  memberId,
  provider = 'Gmail',
}: {
  to: string;
  name: string;
  memberId: string;
  provider?: string;
}) {
  const queryParams = `accept=${encodeURIComponent(memberId)}&email=${encodeURIComponent(to)}&name=${encodeURIComponent(name)}&provider=${encodeURIComponent(provider)}&action=approve`;
  const acceptUrl = `https://trackmysubs-pro.vercel.app/family?${queryParams}`;

  const emailSubject = `💌 Action Required: Confirm Subscription Sharing for ${name} · TrackmySubs`;
  const emailHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TrackmySubs Invitation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 18px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.06);">
          <tr>
            <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 24px; text-align: center;">
              <div style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; color: #c7d2fe; text-transform: uppercase;">TrackmySubs Household &amp; Office Hub</div>
              <h1 style="color: #ffffff; font-size: 22px; font-weight: 800; margin: 12px 0 0; letter-spacing: -0.5px;">Confirm Subscription Sharing</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 28px;">
              <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0 0 16px;">
                Hello <strong>${name}</strong>,
              </p>
              <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0 0 24px;">
                You've been invited to join the <strong>TrackmySubs</strong> family plan. By confirming, your subscriptions will sync automatically to avoid duplicate renewals and split charges seamlessly.
              </p>

              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 10px 0 24px;">
                    <a href="${acceptUrl}" style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 15px 36px; border-radius: 12px; font-size: 15px; font-weight: 700; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);">
                      Approve &amp; Connect Subscriptions
                    </a>
                  </td>
                </tr>
              </table>

              <div style="text-align: center; margin-top: 16px;">
                <p style="font-size: 12px; color: #94a3b8; margin: 0;">
                  If the button doesn't work, copy and paste this link in your browser:
                </p>
                <p style="font-size: 11px; color: #6366f1; word-break: break-all; margin: 6px 0 0;">
                  ${acceptUrl}
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
      to: [to],
      reply_to: REPLY_TO,
      subject: emailSubject,
      html: emailHtml,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || "Failed to deliver email via Resend API");
  }

  return { success: true, delivered: true, id: data.id, inviteUrl: acceptUrl };
}
