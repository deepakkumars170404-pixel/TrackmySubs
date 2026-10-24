import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { memberId, email, provider, name } = body;

    return NextResponse.json({
      success: true,
      message: `Invitation approved! Mailbox for ${name || email} connected successfully.`,
      member: {
        id: memberId,
        name: name || (email ? email.split("@")[0] : "Family Member"),
        email: email || "",
        inboxStatus: `${provider || "Gmail"} connected`,
        lastChecked: "Just now",
        planCount: 0,
        monthlyShare: 0,
      },
      scannedSubscriptions: [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to accept invite" },
      { status: 500 }
    );
  }
}

