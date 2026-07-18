import { prisma } from "@/lib/prisma";
import { deleteRedisKeys, readRedisJson, writeRedisJson } from "@/lib/redis-cache";
import { getRedisConfig } from "@/lib/redis-config";
import { sessionVersionKey } from "@/lib/redis-keys";
import { createTtlCache } from "@/lib/ttl-cache";

/** Presence window for "already logged in" conflict detection. */
export const SESSION_ACTIVE_MS = 5 * 60 * 1000;

/** Skip heartbeat UPDATEs when lastSeen is fresher than this. */
export const SESSION_TOUCH_MIN_INTERVAL_MS = 90_000;

const SESSION_VERSION_TTL_MS = 15_000;
const SESSION_VERSION_TTL_SECONDS = 15;

type SessionPresenceFields = {
  sessionVersion: number;
  sessionLastSeenAt: Date | null;
};

const localSessionVersionCache = createTtlCache<number>(SESSION_VERSION_TTL_MS);

function isSessionVersionNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function cacheKeyForUser(userId: string): string {
  const config = getRedisConfig();
  return sessionVersionKey(config.prefix, userId);
}

async function readCachedSessionVersion(
  userId: string,
): Promise<number | undefined> {
  const sharedKey = cacheKeyForUser(userId);
  const shared = await readRedisJson(sharedKey, isSessionVersionNumber);
  if (shared.available && shared.hit) return shared.value;
  if (!shared.available) {
    return localSessionVersionCache.get(userId);
  }
  return undefined;
}

async function writeCachedSessionVersion(
  userId: string,
  sessionVersion: number,
): Promise<void> {
  localSessionVersionCache.set(userId, sessionVersion);
  const config = getRedisConfig();
  if (!config.enabled) return;
  await writeRedisJson(
    sessionVersionKey(config.prefix, userId),
    sessionVersion,
    SESSION_VERSION_TTL_SECONDS,
  );
}

export async function invalidateSessionVersionCache(
  userId: string,
): Promise<void> {
  localSessionVersionCache.delete(userId);
  const config = getRedisConfig();
  if (!config.enabled) return;
  await deleteRedisKeys(sessionVersionKey(config.prefix, userId));
}

export function isSessionActive(user: SessionPresenceFields): boolean {
  if (!user.sessionLastSeenAt) return false;
  return Date.now() - user.sessionLastSeenAt.getTime() < SESSION_ACTIVE_MS;
}

export async function bumpSessionVersion(userId: string): Promise<number> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      sessionVersion: { increment: 1 },
      sessionLastSeenAt: new Date(),
    },
    select: { sessionVersion: true },
  });
  await writeCachedSessionVersion(userId, updated.sessionVersion);
  return updated.sessionVersion;
}

export async function touchSession(
  userId: string,
  sessionVersion: number,
  options?: { lastSeenAt?: Date | null },
): Promise<boolean> {
  const lastSeenAt = options?.lastSeenAt;
  if (lastSeenAt) {
    const ageMs = Date.now() - lastSeenAt.getTime();
    if (ageMs >= 0 && ageMs < SESSION_TOUCH_MIN_INTERVAL_MS) {
      return true;
    }
  }

  const result = await prisma.user.updateMany({
    where: { id: userId, sessionVersion },
    data: { sessionLastSeenAt: new Date() },
  });
  return result.count > 0;
}

export async function clearSessionPresence(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { sessionLastSeenAt: null },
  });
}

export async function getSessionVersion(userId: string): Promise<number | null> {
  const cached = await readCachedSessionVersion(userId);
  if (cached !== undefined) return cached;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { sessionVersion: true },
  });
  if (!user) return null;
  await writeCachedSessionVersion(userId, user.sessionVersion);
  return user.sessionVersion;
}

export async function isSessionVersionCurrent(
  userId: string,
  sessionVersion: number,
): Promise<boolean> {
  const current = await getSessionVersion(userId);
  return current !== null && current === sessionVersion;
}

export async function assertSessionCurrent(
  userId: string,
  sessionVersion: number | undefined,
): Promise<void> {
  if (typeof sessionVersion !== "number") {
    throw new Error("UNAUTHORIZED");
  }
  const ok = await isSessionVersionCurrent(userId, sessionVersion);
  if (!ok) {
    throw new Error("UNAUTHORIZED");
  }
}
