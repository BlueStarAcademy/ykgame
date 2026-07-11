import { getRedisConfig } from "@/lib/redis-config";
import {
  dumpRateLimitEventKey,
  dumpRateLimitKey,
} from "@/lib/redis-keys";
import { runRedisCommand } from "@/lib/redis";

const TOKEN_BUCKET_SCRIPT = `
if redis.call("EXISTS", KEYS[2]) == 1 then
  local existing_tokens = redis.call("HGET", KEYS[1], "tokens")
  return { 1, tostring(existing_tokens or ARGV[1]), 1 }
end
local now = redis.call("TIME")
local now_ms = tonumber(now[1]) * 1000 + math.floor(tonumber(now[2]) / 1000)
local capacity = tonumber(ARGV[1])
local refill = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])
local values = redis.call("HMGET", KEYS[1], "tokens", "updatedAtMs")
local tokens = tonumber(values[1])
local updated_at = tonumber(values[2])
if tokens == nil or updated_at == nil then
  tokens = capacity
  updated_at = now_ms
end
local elapsed = math.max(0, now_ms - updated_at)
tokens = math.min(capacity, tokens + (elapsed / 1000) * refill)
local allowed = 0
if cost <= tokens then
  tokens = tokens - cost
  allowed = 1
  redis.call("SET", KEYS[2], "1", "PX", ttl)
end
redis.call("HSET", KEYS[1], "tokens", tokens, "updatedAtMs", now_ms)
redis.call("PEXPIRE", KEYS[1], ttl)
return { allowed, tostring(tokens), 0 }
`;

export type DumpRateLimitResult = {
  allowed: boolean;
  bypassed: boolean;
  remaining?: number;
};

export async function consumeDumpRateLimit(
  userId: string,
  eventId: string,
  chunkCount: number,
): Promise<DumpRateLimitResult> {
  const config = getRedisConfig();
  if (!config.enabled) return { allowed: true, bypassed: true };

  const ttlMs = Math.max(
    1_000,
    Math.ceil((config.rateCapacity / config.rateRefillPerSecond) * 2_000),
  );
  const key = dumpRateLimitKey(config.prefix, userId);
  const eventKey = dumpRateLimitEventKey(config.prefix, userId, eventId);
  const result = await runRedisCommand("dump_rate_limit", (client) =>
    client.eval(TOKEN_BUCKET_SCRIPT, {
      keys: [key, eventKey],
      arguments: [
        String(config.rateCapacity),
        String(config.rateRefillPerSecond),
        String(chunkCount),
        String(ttlMs),
      ],
    }),
  );
  if (!result.available) return { allowed: true, bypassed: true };

  const reply = result.value;
  if (
    !Array.isArray(reply) ||
    reply.length !== 3 ||
    (Number(reply[0]) !== 0 && Number(reply[0]) !== 1) ||
    !Number.isFinite(Number(reply[1]))
  ) {
    return { allowed: true, bypassed: true };
  }
  return {
    allowed: Number(reply[0]) === 1,
    bypassed: false,
    remaining: Math.max(0, Number(reply[1])),
  };
}
