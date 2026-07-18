import { prisma } from "@/lib/prisma";

/** Presence window for "already logged in" conflict detection. */
export const SESSION_ACTIVE_MS = 5 * 60 * 1000;

type SessionPresenceFields = {
  sessionVersion: number;
  sessionLastSeenAt: Date | null;
};

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
  return updated.sessionVersion;
}

export async function touchSession(
  userId: string,
  sessionVersion: number,
): Promise<boolean> {
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
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { sessionVersion: true },
  });
  return user?.sessionVersion ?? null;
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
