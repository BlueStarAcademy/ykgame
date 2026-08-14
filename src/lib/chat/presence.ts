import { getRedisConfig } from "@/lib/redis-config";
import {
  CHAT_CHANNEL_CAPACITY,
  CHAT_CHANNEL_MAX,
  CHAT_CHANNEL_MIN,
  CHAT_COOLDOWN_MS,
  CHAT_PRESENCE_TTL_MS,
  isValidChatChannel,
} from "@/lib/chat-constants";
import {
  chatChannelMembersKey,
  chatCooldownKey,
  chatUserPresenceKey,
} from "@/lib/redis-keys";
import { runRedisCommand } from "@/lib/redis";

/**
 * Atomic join / switch.
 * ARGV: userId, connectionId, preferredChannel (0 = auto from 1),
 *       explicitChannel (0 = auto fill), capacity, ttlMs, channelMin, channelMax
 * Returns: { ok, channel, count, reason }
 *
 * When explicitChannel > 0, only that channel is attempted.
 * Otherwise tries preferredChannel..max then wraps from min..preferred-1.
 */
const JOIN_SCRIPT = `
local userId = ARGV[1]
local connectionId = ARGV[2]
local preferred = tonumber(ARGV[3])
local explicit = tonumber(ARGV[4])
local capacity = tonumber(ARGV[5])
local ttlMs = tonumber(ARGV[6])
local channelMin = tonumber(ARGV[7])
local channelMax = tonumber(ARGV[8])
local presenceKey = KEYS[1]
local memberPrefix = KEYS[2]

local function mkey(ch)
  return memberPrefix .. ":" .. tostring(ch) .. ":members"
end

local prev = redis.call("HGET", presenceKey, "channel")
if prev then
  redis.call("SREM", mkey(tonumber(prev)), userId)
end

local function try_join(ch)
  local key = mkey(ch)
  local count = redis.call("SCARD", key)
  local already = redis.call("SISMEMBER", key, userId)
  if already == 1 or count < capacity then
    redis.call("SADD", key, userId)
    redis.call("PEXPIRE", key, ttlMs)
    redis.call("HSET", presenceKey, "channel", ch, "connectionId", connectionId)
    redis.call("PEXPIRE", presenceKey, ttlMs)
    return { 1, ch, redis.call("SCARD", key), "ok" }
  end
  return nil
end

if explicit > 0 then
  local result = try_join(explicit)
  if result then return result end
  if prev then
    redis.call("SADD", mkey(tonumber(prev)), userId)
    redis.call("HSET", presenceKey, "channel", prev, "connectionId", connectionId)
    redis.call("PEXPIRE", presenceKey, ttlMs)
    redis.call("PEXPIRE", mkey(tonumber(prev)), ttlMs)
  else
    redis.call("DEL", presenceKey)
  end
  return { 0, explicit, redis.call("SCARD", mkey(explicit)), "full" }
end

local start = preferred
if start < channelMin or start > channelMax then start = channelMin end
for ch = start, channelMax do
  local result = try_join(ch)
  if result then return result end
end
for ch = channelMin, start - 1 do
  local result = try_join(ch)
  if result then return result end
end

if prev then
  redis.call("SADD", mkey(tonumber(prev)), userId)
  redis.call("HSET", presenceKey, "channel", prev, "connectionId", connectionId)
  redis.call("PEXPIRE", presenceKey, ttlMs)
  redis.call("PEXPIRE", mkey(tonumber(prev)), ttlMs)
else
  redis.call("DEL", presenceKey)
end
return { 0, 0, 0, "all_full" }
`;

const HEARTBEAT_SCRIPT = `
local presenceKey = KEYS[1]
local memberPrefix = KEYS[2]
local userId = ARGV[1]
local connectionId = ARGV[2]
local ttlMs = tonumber(ARGV[3])
local data = redis.call("HMGET", presenceKey, "channel", "connectionId")
local channel = data[1]
local storedConn = data[2]
if not channel then
  return { 0, 0, "missing" }
end
if storedConn and storedConn ~= connectionId then
  return { 0, tonumber(channel), "stale" }
end
local mkey = memberPrefix .. ":" .. channel .. ":members"
redis.call("SADD", mkey, userId)
redis.call("PEXPIRE", mkey, ttlMs)
redis.call("HSET", presenceKey, "channel", channel, "connectionId", connectionId)
redis.call("PEXPIRE", presenceKey, ttlMs)
return { 1, tonumber(channel), redis.call("SCARD", mkey) }
`;

const LEAVE_SCRIPT = `
local presenceKey = KEYS[1]
local memberPrefix = KEYS[2]
local userId = ARGV[1]
local connectionId = ARGV[2]
local data = redis.call("HMGET", presenceKey, "channel", "connectionId")
local channel = data[1]
local storedConn = data[2]
if not channel then
  return { 0, 0 }
end
if connectionId ~= "" and storedConn and storedConn ~= connectionId then
  return { 0, tonumber(channel) }
end
local mkey = memberPrefix .. ":" .. channel .. ":members"
redis.call("SREM", mkey, userId)
redis.call("DEL", presenceKey)
return { 1, tonumber(channel), redis.call("SCARD", mkey) }
`;

function memberKeyPrefix(prefix: string): string {
  return `${prefix}:v1:chat:ch`;
}

export type ChatJoinResult =
  | { ok: true; channel: number; count: number }
  | { ok: false; reason: "full" | "all_full" | "unavailable"; channel?: number; count?: number };

export type ChatPresenceResult =
  | { ok: true; channel: number; count?: number }
  | { ok: false; reason: "missing" | "stale" | "unavailable" };

export async function joinChatChannel(options: {
  userId: string;
  connectionId: string;
  /** Preferred starting channel for auto placement (default 1). */
  preferredChannel?: number;
  /** Exact channel to join; if full, fails without auto-advance. */
  explicitChannel?: number;
}): Promise<ChatJoinResult> {
  const config = getRedisConfig();
  if (!config.enabled) {
    return { ok: false, reason: "unavailable" };
  }

  const preferred = options.preferredChannel ?? CHAT_CHANNEL_MIN;
  const explicit = options.explicitChannel ?? 0;
  if (explicit !== 0 && !isValidChatChannel(explicit)) {
    return { ok: false, reason: "full", channel: explicit };
  }

  const presenceKey = chatUserPresenceKey(config.prefix, options.userId);
  const result = await runRedisCommand("chat_join", (client) =>
    client.eval(JOIN_SCRIPT, {
      keys: [presenceKey, memberKeyPrefix(config.prefix)],
      arguments: [
        options.userId,
        options.connectionId,
        String(preferred),
        String(explicit),
        String(CHAT_CHANNEL_CAPACITY),
        String(CHAT_PRESENCE_TTL_MS),
        String(CHAT_CHANNEL_MIN),
        String(CHAT_CHANNEL_MAX),
      ],
    }),
  );

  if (!result.available || !Array.isArray(result.value)) {
    return { ok: false, reason: "unavailable" };
  }

  const reply = result.value as unknown[];
  const ok = Number(reply[0]) === 1;
  const channel = Number(reply[1]);
  const count = Number(reply[2]);
  const reason = String(reply[3] ?? (ok ? "ok" : "full"));

  if (ok && isValidChatChannel(channel)) {
    return { ok: true, channel, count };
  }
  if (reason === "all_full") {
    return { ok: false, reason: "all_full" };
  }
  return {
    ok: false,
    reason: "full",
    channel: isValidChatChannel(channel) ? channel : undefined,
    count: Number.isFinite(count) ? count : undefined,
  };
}

export async function heartbeatChatPresence(options: {
  userId: string;
  connectionId: string;
}): Promise<ChatPresenceResult> {
  const config = getRedisConfig();
  if (!config.enabled) return { ok: false, reason: "unavailable" };

  const result = await runRedisCommand("chat_heartbeat", (client) =>
    client.eval(HEARTBEAT_SCRIPT, {
      keys: [
        chatUserPresenceKey(config.prefix, options.userId),
        memberKeyPrefix(config.prefix),
      ],
      arguments: [
        options.userId,
        options.connectionId,
        String(CHAT_PRESENCE_TTL_MS),
      ],
    }),
  );

  if (!result.available || !Array.isArray(result.value)) {
    return { ok: false, reason: "unavailable" };
  }
  const reply = result.value as unknown[];
  if (Number(reply[0]) === 1) {
    return {
      ok: true,
      channel: Number(reply[1]),
      count: Number(reply[2]),
    };
  }
  const reason = String(reply[2] ?? "missing");
  return {
    ok: false,
    reason: reason === "stale" ? "stale" : "missing",
  };
}

export async function leaveChatChannel(options: {
  userId: string;
  connectionId?: string;
}): Promise<void> {
  const config = getRedisConfig();
  if (!config.enabled) return;

  await runRedisCommand("chat_leave", (client) =>
    client.eval(LEAVE_SCRIPT, {
      keys: [
        chatUserPresenceKey(config.prefix, options.userId),
        memberKeyPrefix(config.prefix),
      ],
      arguments: [options.userId, options.connectionId ?? ""],
    }),
  );
}

export async function getUserChatChannel(
  userId: string,
): Promise<number | null> {
  const config = getRedisConfig();
  if (!config.enabled) return null;
  const result = await runRedisCommand("chat_get_presence", (client) =>
    client.hGet(chatUserPresenceKey(config.prefix, userId), "channel"),
  );
  if (!result.available || result.value == null) return null;
  const channel = Number(result.value);
  return isValidChatChannel(channel) ? channel : null;
}

export async function getChannelMemberCount(
  channel: number,
): Promise<number | null> {
  const config = getRedisConfig();
  if (!config.enabled || !isValidChatChannel(channel)) return null;
  const result = await runRedisCommand("chat_channel_count", (client) =>
    client.sCard(chatChannelMembersKey(config.prefix, channel)),
  );
  if (!result.available) return null;
  return Number(result.value);
}

export async function tryConsumeChatCooldown(
  userId: string,
): Promise<{ allowed: boolean; unavailable?: boolean }> {
  const config = getRedisConfig();
  if (!config.enabled) return { allowed: false, unavailable: true };

  const result = await runRedisCommand("chat_cooldown", (client) =>
    client.set(chatCooldownKey(config.prefix, userId), "1", {
      NX: true,
      PX: CHAT_COOLDOWN_MS,
    }),
  );
  if (!result.available) return { allowed: false, unavailable: true };
  return { allowed: result.value === "OK" };
}

/** Exported for unit tests — pure channel selection helper. */
export function nextAutoChannels(
  preferred: number,
  min = CHAT_CHANNEL_MIN,
  max = CHAT_CHANNEL_MAX,
): number[] {
  const start =
    preferred < min || preferred > max ? min : preferred;
  const list: number[] = [];
  for (let ch = start; ch <= max; ch += 1) list.push(ch);
  for (let ch = min; ch < start; ch += 1) list.push(ch);
  return list;
}
