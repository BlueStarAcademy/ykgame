export type TokenBucketState = {
  tokens: number;
  updatedAtMs: number;
};

export type TokenBucketDecision = TokenBucketState & {
  allowed: boolean;
};

export function calculateTokenBucket(
  previous: TokenBucketState | null,
  nowMs: number,
  cost: number,
  capacity: number,
  refillPerSecond: number,
): TokenBucketDecision {
  const safeNow = Math.max(0, nowMs);
  const elapsedMs = previous
    ? Math.max(0, safeNow - previous.updatedAtMs)
    : 0;
  const available = Math.min(
    capacity,
    (previous?.tokens ?? capacity) + (elapsedMs / 1_000) * refillPerSecond,
  );
  const allowed = cost <= available;
  return {
    allowed,
    tokens: allowed ? available - cost : available,
    updatedAtMs: safeNow,
  };
}
