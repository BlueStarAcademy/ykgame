import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isValidChatChannel } from "@/lib/chat-constants";
import {
  listChatHistory,
  listActiveChatNotices,
  pruneExpiredChatMessages,
} from "@/lib/chat/messages";
import { getChannelMemberCount } from "@/lib/chat/presence";

/** Lightweight history refresh (not used for live push). */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const channel = Number(searchParams.get("channel"));
  if (!isValidChatChannel(channel)) {
    return NextResponse.json({ error: "INVALID_CHANNEL" }, { status: 400 });
  }

  void pruneExpiredChatMessages().catch(() => {
    /* ignore prune failures */
  });

  const [notices, messages, memberCount] = await Promise.all([
    listActiveChatNotices(),
    listChatHistory({ channel }),
    getChannelMemberCount(channel),
  ]);

  return NextResponse.json({
    channel,
    notices,
    messages,
    memberCount,
  });
}
