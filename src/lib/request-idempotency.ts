const IDEMPOTENCY_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function parseIdempotencyId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return IDEMPOTENCY_ID_PATTERN.test(id) ? id : null;
}

export function parseRewardEventId(value: unknown): string | null {
  return parseIdempotencyId(value);
}

export function parseScoreSessionId(value: unknown): string | null {
  return parseIdempotencyId(value);
}
