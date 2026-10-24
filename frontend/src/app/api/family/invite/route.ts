import { NextResponse } from "next/server";
import { sendInviteEmail } from "../email-helper";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fullName, email, role } = body;
    if (!email) {
      return NextResponse.json({ success: false, message: "Email is required" }, { status: 400 });
    }

    const memberId = `mem-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const initials = (fullName || email)
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

    const result = await sendInviteEmail({
      to: email.trim(),
      name: fullName || email.split("@")[0],
      memberId,
      provider: "Gmail",
    });

    return NextResponse.json({
      success: true,
      delivered: true,
      message: `Confirmation request email successfully sent to ${email}! Status is Pending Acceptance until approved.`,
      inviteUrl: result.inviteUrl,
      data: {
        id: memberId,
        name: fullName || email.split("@")[0],
        role: role || "Member",
        avatarInitials: initials,
        avatarColor: "bg-[#CCFBF1] text-[#115E59]",
        planCount: 0,
        monthlyShare: 0,
        inboxStatus: "Pending Acceptance",
        email: email.trim(),
        lastChecked: "Awaiting recipient approval",
        status: "invited",
      },
    });
  } catch (error: any) {
    console.error("Invite error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to send invitation email" },
      { status: 500 }
    );
  }
}
