import {
  CHAT_CHANNEL_CAPACITY,
  CHAT_CHANNEL_MAX,
  CHAT_CHANNEL_MIN,
  CHAT_COOLDOWN_MS,
  CHAT_PRESENCE_TTL_MS,
  isValidChatChannel,
} from "@/lib/chat-constants";
import { nextAutoChannels } from "@/lib/chat/presence-order";

type PresenceEntry = {
  channel: number;
  connectionId: string;
  expiresAt: number;
};

type MemoryRuntime = {
  presence: Map<string, PresenceEntry>;
  members: Map<number, Map<string, number>>;
  cooldown: Map<string, number>;
};

const globalMemory = globalThis as typeof globalThis & {
  __ykgameChatPresenceMemory?: MemoryRuntime;
};

function runtime(): MemoryRuntime {
  if (!globalMemory.__ykgameChatPresenceMemory) {
    globalMemory.__ykgameChatPresenceMemory = {
      presence: new Map(),
      members: new Map(),
      cooldown: new Map(),
    };
  }
  return globalMemory.__ykgameChatPresenceMemory;
}

function now() {
  return Date.now();
}

function pruneExpired() {
  const rt = runtime();
  const t = now();
  for (const [userId, entry] of rt.presence) {
    if (entry.expiresAt > t) continue;
    rt.presence.delete(userId);
    const members = rt.members.get(entry.channel);
    members?.delete(userId);
  }
  for (const [userId, until] of rt.cooldown) {
    if (until <= t) rt.cooldown.delete(userId);
  }
}

function memberSet(channel: number): Map<string, number> {
  const rt = runtime();
  let set = rt.members.get(channel);
  if (!set) {
    set = new Map();
    rt.members.set(channel, set);
  }
  return set;
}

function touchMember(channel: number, userId: string, expiresAt: number) {
  memberSet(channel).set(userId, expiresAt);
}

function removeMember(channel: number, userId: string) {
  memberSet(channel).delete(userId);
}

function liveCount(channel: number): number {
  const t = now();
  const set = memberSet(channel);
  for (const [userId, expiresAt] of set) {
    if (expiresAt <= t) set.delete(userId);
  }
  return set.size;
}

export function memoryJoinChatChannel(options: {
  userId: string;
  connectionId: string;
  preferredChannel?: number;
  explicitChannel?: number;
}):
  | { ok: true; channel: number; count: number }
  | {
      ok: false;
      reason: "full" | "all_full";
      channel?: number;
      count?: number;
    } {
  pruneExpired();
  const rt = runtime();
  const expiresAt = now() + CHAT_PRESENCE_TTL_MS;
  const prev = rt.presence.get(options.userId);

  const tryJoin = (channel: number) => {
    const already = memberSet(channel).has(options.userId);
    const count = liveCount(channel);
    if (!already && count >= CHAT_CHANNEL_CAPACITY) return null;
    if (prev && prev.channel !== channel) {
      removeMember(prev.channel, options.userId);
    }
    touchMember(channel, options.userId, expiresAt);
    rt.presence.set(options.userId, {
      channel,
      connectionId: options.connectionId,
      expiresAt,
    });
    return { ok: true as const, channel, count: liveCount(channel) };
  };

  const explicit = options.explicitChannel ?? 0;
  if (explicit !== 0) {
    if (!isValidChatChannel(explicit)) {
      return { ok: false, reason: "full", channel: explicit };
    }
    const joined = tryJoin(explicit);
    if (joined) return joined;
    if (prev) {
      touchMember(prev.channel, options.userId, expiresAt);
      rt.presence.set(options.userId, {
        ...prev,
        connectionId: options.connectionId,
        expiresAt,
      });
    } else {
      rt.presence.delete(options.userId);
    }
    return {
      ok: false,
      reason: "full",
      channel: explicit,
      count: liveCount(explicit),
    };
  }

  const preferred = options.preferredChannel ?? CHAT_CHANNEL_MIN;
  for (const channel of nextAutoChannels(
    preferred,
    CHAT_CHANNEL_MIN,
    CHAT_CHANNEL_MAX,
  )) {
    const joined = tryJoin(channel);
    if (joined) return joined;
  }

  if (prev) {
    touchMember(prev.channel, options.userId, expiresAt);
    rt.presence.set(options.userId, {
      ...prev,
      connectionId: options.connectionId,
      expiresAt,
    });
  } else {
    rt.presence.delete(options.userId);
  }
  return { ok: false, reason: "all_full" };
}

export function memoryHeartbeatChatPresence(options: {
  userId: string;
  connectionId: string;
}):
  | { ok: true; channel: number; count: number }
  | { ok: false; reason: "missing" | "stale" } {
  pruneExpired();
  const rt = runtime();
  const entry = rt.presence.get(options.userId);
  if (!entry) return { ok: false, reason: "missing" };
  if (entry.connectionId !== options.connectionId) {
    return { ok: false, reason: "stale" };
  }
  const expiresAt = now() + CHAT_PRESENCE_TTL_MS;
  entry.expiresAt = expiresAt;
  entry.connectionId = options.connectionId;
  touchMember(entry.channel, options.userId, expiresAt);
  return {
    ok: true,
    channel: entry.channel,
    count: liveCount(entry.channel),
  };
}

export function memoryLeaveChatChannel(options: {
  userId: string;
  connectionId?: string;
}): void {
  pruneExpired();
  const rt = runtime();
  const entry = rt.presence.get(options.userId);
  if (!entry) return;
  if (options.connectionId && entry.connectionId !== options.connectionId) {
    return;
  }
  removeMember(entry.channel, options.userId);
  rt.presence.delete(options.userId);
}

export function memoryGetUserChatChannel(userId: string): number | null {
  pruneExpired();
  const entry = runtime().presence.get(userId);
  if (!entry) return null;
  return isValidChatChannel(entry.channel) ? entry.channel : null;
}

export function memoryGetChannelMemberCount(channel: number): number | null {
  if (!isValidChatChannel(channel)) return null;
  pruneExpired();
  return liveCount(channel);
}

export function memoryTryConsumeChatCooldown(userId: string): {
  allowed: boolean;
} {
  pruneExpired();
  const rt = runtime();
  const until = rt.cooldown.get(userId);
  const t = now();
  if (until && until > t) return { allowed: false };
  rt.cooldown.set(userId, t + CHAT_COOLDOWN_MS);
  return { allowed: true };
}
