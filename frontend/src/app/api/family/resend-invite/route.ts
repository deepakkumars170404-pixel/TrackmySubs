import { NextResponse } from "next/server";
import { sendInviteEmail } from "../email-helper";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { memberId, email, fullName } = body;
    if (!email) {
      return NextResponse.json({ success: false, message: "Email is required" }, { status: 400 });
    }

    const result = await sendInviteEmail({
      to: email.trim(),
      name: fullName || email.split("@")[0],
      memberId: memberId || `mem-${Date.now()}`,
      provider: "Gmail",
    });

    return NextResponse.json({
      success: true,
      delivered: true,
      message: `Confirmation request email delivered to ${email}!`,
      inviteUrl: result.inviteUrl,
    });
  } catch (error: any) {
    console.error("Resend invite error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to resend invitation email" },
      { status: 500 }
    );
  }
}

