import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  CHAT_CHANNEL_CAPACITY,
  CHAT_CHANNEL_MIN,
  isValidChatChannel,
} from "@/lib/chat-constants";
import { getChatBootstrap } from "@/lib/chat/messages";
import { getChannelMemberCount, joinChatChannel } from "@/lib/chat/presence";
import { randomUUID } from "node:crypto";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.nickname?.trim()) {
    return NextResponse.json({ error: "NICKNAME_REQUIRED" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const requested = Number(searchParams.get("channel") ?? CHAT_CHANNEL_MIN);
  const connectionId = searchParams.get("connectionId") || randomUUID();

  const join = await joinChatChannel({
    userId: session.user.id,
    connectionId,
    preferredChannel: isValidChatChannel(requested)
      ? requested
      : CHAT_CHANNEL_MIN,
  });

  if (!join.ok) {
    return NextResponse.json(
      {
        error: join.reason === "all_full" ? "ALL_CHANNELS_FULL" : "UNAVAILABLE",
        reason: join.reason,
      },
      { status: join.reason === "unavailable" ? 503 : 409 },
    );
  }

  const bootstrap = await getChatBootstrap({ channel: join.channel });
  return NextResponse.json({
    connectionId,
    channel: join.channel,
    memberCount: bootstrap.memberCount ?? join.count,
    capacity: CHAT_CHANNEL_CAPACITY,
    notices: bootstrap.notices,
    messages: bootstrap.messages,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.nickname?.trim()) {
    return NextResponse.json({ error: "NICKNAME_REQUIRED" }, { status: 403 });
  }

  let body: {
    connectionId?: string;
    channel?: number;
    mode?: "auto" | "explicit";
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const connectionId =
    typeof body.connectionId === "string" && body.connectionId
      ? body.connectionId
      : randomUUID();

  const mode = body.mode === "explicit" ? "explicit" : "auto";
  const channel = body.channel;

  const join =
    mode === "explicit" && isValidChatChannel(channel)
      ? await joinChatChannel({
          userId: session.user.id,
          connectionId,
          explicitChannel: channel,
        })
      : await joinChatChannel({
          userId: session.user.id,
          connectionId,
          preferredChannel: isValidChatChannel(channel)
            ? channel
            : CHAT_CHANNEL_MIN,
        });

  if (!join.ok) {
    const status =
      join.reason === "unavailable"
        ? 503
        : join.reason === "all_full"
          ? 409
          : 409;
    return NextResponse.json(
      {
        error:
          join.reason === "all_full"
            ? "ALL_CHANNELS_FULL"
            : join.reason === "full"
              ? "CHANNEL_FULL"
              : "UNAVAILABLE",
        reason: join.reason,
        channel: join.channel,
        memberCount: join.count,
        capacity: CHAT_CHANNEL_CAPACITY,
      },
      { status },
    );
  }

  const memberCount =
    (await getChannelMemberCount(join.channel)) ?? join.count;
  const bootstrap = await getChatBootstrap({ channel: join.channel });

  return NextResponse.json({
    connectionId,
    channel: join.channel,
    memberCount,
    capacity: CHAT_CHANNEL_CAPACITY,
    notices: bootstrap.notices,
    messages: bootstrap.messages,
  });
}
