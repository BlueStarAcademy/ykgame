import { createHash } from "node:crypto";

const KEY_VERSION = "v1";

function digest(value: string): string {
  return createHash("sha256").update(value).digest("base64url").slice(0, 24);
}

export function redisKey(
  prefix: string,
  namespace: string,
  ...parts: string[]
): string {
  return [prefix, KEY_VERSION, namespace, ...parts.map(digest)].join(":");
}

export function dumpRateLimitKey(prefix: string, userId: string): string {
  return redisKey(prefix, "rate:dump", userId);
}

export function dumpRateLimitEventKey(
  prefix: string,
  userId: string,
  eventId: string,
): string {
  return redisKey(prefix, "rate:dump:event", userId, eventId);
}

export function shopBuffKey(prefix: string, userId: string): string {
  return redisKey(prefix, "yanmar:shopbuff", userId);
}

export function rankingsTopKey(
  prefix: string,
  gameId: string,
  seasonKey: string,
  limit: number,
  mode: string,
): string {
  return redisKey(
    prefix,
    "rank:top",
    gameId,
    seasonKey,
    String(limit),
    mode,
  );
}

export function userStatsKey(
  prefix: string,
  gameId: string,
  seasonKey: string,
  userId: string,
  mode: string,
): string {
  return redisKey(prefix, "rank:user", gameId, seasonKey, userId, mode);
}
