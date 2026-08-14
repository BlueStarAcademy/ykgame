import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { leaveChatChannel } from "@/lib/chat/presence";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { connectionId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  await leaveChatChannel({
    userId: session.user.id,
    connectionId:
      typeof body.connectionId === "string" ? body.connectionId : undefined,
  });

  return NextResponse.json({ ok: true });
}
