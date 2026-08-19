export const CHAT_CHANNEL_MIN = 1;
export const CHAT_CHANNEL_MAX = 100;
export const CHAT_CHANNEL_CAPACITY = 100;
export const CHAT_COOLDOWN_MS = 3_000;
export const CHAT_PRESENCE_TTL_MS = 45_000;
/** Keep below Railway's 5-minute no-data cutoff (docs: public networking specs). */
export const CHAT_HEARTBEAT_MS = 15_000;
/**
 * Proactively recycle SSE before Railway's 15-minute max request duration.
 * EventSource also auto-reconnects; this avoids mid-session hard cuts.
 */
export const CHAT_SSE_MAX_MS = 12 * 60 * 1000;
/** Max messages returned for history bootstrap / catch-up within the retention window. */
export const CHAT_HISTORY_LIMIT = 2_000;
/**
 * Keep this many calendar days (Asia/Seoul), including today.
 * On day 4, day-1 messages fall outside the window and are pruned.
 */
export const CHAT_RETENTION_DAYS = 3;
export const CHAT_TZ = "Asia/Seoul";
/** Approximate duration for UI timers; prune/history use calendar-day cutoff. */
export const CHAT_RETENTION_MS = CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
export const CHAT_BODY_MAX_LENGTH = 120;
export const CHAT_WARNING =
  "부적절한 대화는 제재를 받을 수 있습니다.";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function kstCalendarParts(now: number): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CHAT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(now));
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return { year, month, day };
}

/**
 * Start of the oldest calendar day still kept (KST).
 * Example: on Aug 19 KST with 3-day retention → Aug 17 00:00 KST.
 */
export function chatRetentionCutoff(now = Date.now()): Date {
  const { year, month, day } = kstCalendarParts(now);
  // Midnight KST for "today", expressed as UTC millis.
  const startOfTodayKst = Date.UTC(year, month - 1, day) - KST_OFFSET_MS;
  const startOfOldestKeptDay =
    startOfTodayKst - (CHAT_RETENTION_DAYS - 1) * 24 * 60 * 60 * 1000;
  return new Date(startOfOldestKeptDay);
}

export function isWithinChatRetention(
  createdAt: string | number | Date,
  now = Date.now(),
): boolean {
  const ts =
    typeof createdAt === "number"
      ? createdAt
      : createdAt instanceof Date
        ? createdAt.getTime()
        : Date.parse(createdAt);
  if (Number.isNaN(ts)) return false;
  return ts >= chatRetentionCutoff(now).getTime();
}

export function isValidChatChannel(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= CHAT_CHANNEL_MIN &&
    value <= CHAT_CHANNEL_MAX
  );
}

export function clampChatBody(raw: string): string | null {
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  if (trimmed.length > CHAT_BODY_MAX_LENGTH) return null;
  return trimmed;
}
