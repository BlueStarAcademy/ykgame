import { parseBoundedInteger } from "@/lib/database-pool-config";

export const REDIS_LIMITS = {
  connectTimeoutMs: { defaultValue: 1_500, min: 250, max: 5_000 },
  commandTimeoutMs: { defaultValue: 750, min: 100, max: 3_000 },
  reconnectAttempts: { defaultValue: 3, min: 0, max: 10 },
  rateCapacity: { defaultValue: 20, min: 1, max: 200 },
} as const;

const SAFE_PREFIX = /^[A-Za-z0-9_-]{1,32}$/;

function parseBoundedNumber(
  rawValue: string | undefined,
  range: { defaultValue: number; min: number; max: number },
): number {
  if (rawValue == null || rawValue.trim() === "") return range.defaultValue;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return range.defaultValue;
  return Math.min(range.max, Math.max(range.min, parsed));
}

export type RedisConfig = {
  enabled: boolean;
  url?: string;
  prefix: string;
  connectTimeoutMs: number;
  commandTimeoutMs: number;
  reconnectAttempts: number;
  rateCapacity: number;
  rateRefillPerSecond: number;
};

export function getRedisConfig(
  env: Readonly<Partial<NodeJS.ProcessEnv>> = process.env,
): RedisConfig {
  const url = env.REDIS_URL?.trim();
  const requestedPrefix = env.REDIS_PREFIX?.trim() || "ykgame";
  return {
    enabled: Boolean(url),
    ...(url ? { url } : {}),
    prefix: SAFE_PREFIX.test(requestedPrefix) ? requestedPrefix : "ykgame",
    connectTimeoutMs: parseBoundedInteger(
      env.REDIS_CONNECT_TIMEOUT_MS,
      REDIS_LIMITS.connectTimeoutMs,
    ),
    commandTimeoutMs: parseBoundedInteger(
      env.REDIS_COMMAND_TIMEOUT_MS,
      REDIS_LIMITS.commandTimeoutMs,
    ),
    reconnectAttempts: parseBoundedInteger(
      env.REDIS_RECONNECT_ATTEMPTS,
      REDIS_LIMITS.reconnectAttempts,
    ),
    rateCapacity: parseBoundedInteger(
      env.DUMP_RATE_LIMIT_CAPACITY,
      REDIS_LIMITS.rateCapacity,
    ),
    rateRefillPerSecond: parseBoundedNumber(
      env.DUMP_RATE_LIMIT_REFILL_PER_SEC,
      { defaultValue: 5, min: 0.1, max: 100 },
    ),
  };
}
