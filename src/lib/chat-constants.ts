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
export const CHAT_HISTORY_LIMIT = 80;
/** Messages older than this are hidden from history and pruned from storage. */
export const CHAT_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;
export const CHAT_BODY_MAX_LENGTH = 120;
export const CHAT_WARNING =
  "부적절한 대화는 제재를 받을 수 있습니다.";

export function chatRetentionCutoff(now = Date.now()): Date {
  return new Date(now - CHAT_RETENTION_MS);
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
