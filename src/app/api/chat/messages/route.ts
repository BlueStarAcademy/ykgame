import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { CHAT_COOLDOWN_MS } from "@/lib/chat-constants";
import { createUserChatMessage } from "@/lib/chat/messages";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.nickname?.trim()) {
    return NextResponse.json({ error: "NICKNAME_REQUIRED" }, { status: 403 });
  }

  let body: { body?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const result = await createUserChatMessage({
    userId: session.user.id,
    nickname: session.user.nickname,
    body: typeof body.body === "string" ? body.body : "",
  });

  if (!result.ok) {
    const status =
      result.error === "COOLDOWN"
        ? 429
        : result.error === "UNAVAILABLE"
          ? 503
          : result.error === "SANCTIONED"
            ? 403
            : 400;
    return NextResponse.json(
      {
        error: result.error,
        cooldownMs: result.error === "COOLDOWN" ? CHAT_COOLDOWN_MS : undefined,
      },
      { status },
    );
  }

  return NextResponse.json({ message: result.message });
}
