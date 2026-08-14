import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  CHAT_HISTORY_LIMIT,
  clampChatBody,
  isValidChatChannel,
} from "@/lib/chat-constants";
import { publishChatEvent } from "@/lib/chat/pubsub";
import type {
  ChatGearSnapshot,
  ChatNotice,
  ChatWireMessage,
} from "@/lib/chat/types";
import {
  getChannelMemberCount,
  getUserChatChannel,
  tryConsumeChatCooldown,
} from "@/lib/chat/presence";

function displayName(nickname: string | null | undefined) {
  const trimmed = nickname?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "익명의 조종사";
}

function toWire(row: {
  id: string;
  kind: "USER" | "SYSTEM";
  channel: number | null;
  userId: string | null;
  nickname: string | null;
  body: string;
  gearSnapshot: unknown;
  createdAt: Date;
}): ChatWireMessage {
  return {
    id: row.id,
    kind: row.kind,
    channel: row.channel,
    userId: row.userId,
    nickname: row.nickname,
    body: row.body,
    gearSnapshot: (row.gearSnapshot as ChatGearSnapshot | null) ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listActiveChatNotices(): Promise<ChatNotice[]> {
  const notices = await prisma.tickerNotice.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, message: true },
  });
  return notices.map((n) => ({
    id: n.id,
    message: n.message.startsWith("[공지]")
      ? n.message
      : `[공지] ${n.message}`,
  }));
}

export async function listChatHistory(options: {
  channel: number;
  afterId?: string | null;
  limit?: number;
}): Promise<ChatWireMessage[]> {
  const limit = Math.min(
    Math.max(1, options.limit ?? CHAT_HISTORY_LIMIT),
    CHAT_HISTORY_LIMIT,
  );

  let afterCreatedAt: Date | null = null;
  if (options.afterId) {
    const anchor = await prisma.chatMessage.findUnique({
      where: { id: options.afterId },
      select: { createdAt: true },
    });
    afterCreatedAt = anchor?.createdAt ?? null;
  }

  const rows = await prisma.chatMessage.findMany({
    where: {
      hidden: false,
      OR: [{ channel: options.channel }, { channel: null }],
      ...(afterCreatedAt
        ? { createdAt: { gt: afterCreatedAt } }
        : {}),
    },
    orderBy: { createdAt: afterCreatedAt ? "asc" : "desc" },
    take: limit,
  });

  const ordered = afterCreatedAt ? rows : rows.reverse();
  return ordered.map(toWire);
}

export async function createUserChatMessage(options: {
  userId: string;
  nickname: string | null;
  body: string;
}): Promise<
  | { ok: true; message: ChatWireMessage }
  | {
      ok: false;
      error:
        | "INVALID_BODY"
        | "NO_CHANNEL"
        | "COOLDOWN"
        | "UNAVAILABLE"
        | "SANCTIONED";
    }
> {
  const body = clampChatBody(options.body);
  if (!body) return { ok: false, error: "INVALID_BODY" };

  const user = await prisma.user.findUnique({
    where: { id: options.userId },
    select: { isActive: true, nickname: true },
  });
  if (!user?.isActive) return { ok: false, error: "SANCTIONED" };

  const channel = await getUserChatChannel(options.userId);
  if (!isValidChatChannel(channel)) return { ok: false, error: "NO_CHANNEL" };

  const cooldown = await tryConsumeChatCooldown(options.userId);
  if (cooldown.unavailable) return { ok: false, error: "UNAVAILABLE" };
  if (!cooldown.allowed) return { ok: false, error: "COOLDOWN" };

  const nickname = displayName(user.nickname ?? options.nickname);
  const row = await prisma.chatMessage.create({
    data: {
      kind: "USER",
      channel,
      userId: options.userId,
      nickname,
      body,
    },
  });
  const message = toWire(row);
  await publishChatEvent({ type: "message", message });
  return { ok: true, message };
}

export async function publishSystemChatMessage(options: {
  body: string;
  channel?: number | null;
  nickname?: string | null;
  userId?: string | null;
  gearSnapshot?: ChatGearSnapshot | null;
}): Promise<ChatWireMessage> {
  const row = await prisma.chatMessage.create({
    data: {
      kind: "SYSTEM",
      channel: options.channel ?? null,
      userId: options.userId ?? null,
      nickname: options.nickname ?? null,
      body: options.body.slice(0, 240),
      gearSnapshot: options.gearSnapshot
        ? (options.gearSnapshot as Prisma.InputJsonValue)
        : undefined,
    },
  });
  const message = toWire(row);
  await publishChatEvent({ type: "message", message });
  return message;
}

export async function hideChatMessage(options: {
  messageId: string;
  adminId: string;
}): Promise<ChatWireMessage | null> {
  const existing = await prisma.chatMessage.findUnique({
    where: { id: options.messageId },
  });
  if (!existing || existing.hidden) return existing ? toWire(existing) : null;

  const row = await prisma.chatMessage.update({
    where: { id: options.messageId },
    data: {
      hidden: true,
      hiddenAt: new Date(),
      hiddenByAdmin: options.adminId,
    },
  });
  await publishChatEvent({
    type: "revoke",
    messageId: row.id,
    channel: row.channel,
  });
  return toWire(row);
}

export async function getChatBootstrap(options: {
  channel: number;
}): Promise<{
  notices: ChatNotice[];
  messages: ChatWireMessage[];
  memberCount: number | null;
  capacity: number;
}> {
  const [notices, messages, memberCount] = await Promise.all([
    listActiveChatNotices(),
    listChatHistory({ channel: options.channel }),
    getChannelMemberCount(options.channel),
  ]);
  return {
    notices,
    messages,
    memberCount,
    capacity: 100,
  };
}

export { displayName };
