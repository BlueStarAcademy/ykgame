import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { getRedisConfig } from "../src/lib/redis-config";
import {
  dumpRateLimitEventKey,
  dumpRateLimitKey,
  rankingsTopKey,
  seasonDropCouponsKey,
  sessionVersionKey,
  userStatsKey,
} from "../src/lib/redis-keys";
import { calculateTokenBucket } from "../src/lib/token-bucket";
import {
  isRankingEntries,
  isUserGameStats,
} from "../src/lib/ranking-cache-validation";

test("token bucket consumes chunk cost and refills over time", () => {
  const first = calculateTokenBucket(null, 1_000, 12, 20, 5);
  assert.deepEqual(first, {
    allowed: true,
    tokens: 8,
    updatedAtMs: 1_000,
  });

  const limited = calculateTokenBucket(first, 1_200, 10, 20, 5);
  assert.equal(limited.allowed, false);
  assert.equal(limited.tokens, 9);

  const refilled = calculateTokenBucket(limited, 2_000, 10, 20, 5);
  assert.equal(refilled.allowed, true);
  assert.equal(refilled.tokens, 3);
});

test("token bucket caps refill and ignores backwards clocks", () => {
  const capped = calculateTokenBucket(
    { tokens: 2, updatedAtMs: 1_000 },
    100_000,
    1,
    20,
    5,
  );
  assert.equal(capped.tokens, 19);

  const backwards = calculateTokenBucket(
    { tokens: 2, updatedAtMs: 2_000 },
    1_000,
    3,
    20,
    5,
  );
  assert.equal(backwards.allowed, false);
  assert.equal(backwards.tokens, 2);
});

test("Redis config applies defaults, bounds, and safe prefixes", () => {
  assert.deepEqual(
    getRedisConfig({
      REDIS_URL: "",
      REDIS_PREFIX: "bad:prefix",
      DUMP_RATE_LIMIT_CAPACITY: "999",
      DUMP_RATE_LIMIT_REFILL_PER_SEC: "0",
      REDIS_RECONNECT_ATTEMPTS: "-5",
    }),
    {
      enabled: false,
      prefix: "ykgame",
      connectTimeoutMs: 1_500,
      commandTimeoutMs: 750,
      reconnectAttempts: 0,
      rateCapacity: 200,
      rateRefillPerSecond: 0.1,
    },
  );
});

test("Redis keys are versioned and do not expose raw identifiers", () => {
  const userId = "user:private@example.test";
  const eventId = "dump:private-event";
  const rateKey = dumpRateLimitKey("custom", userId);
  const rateEventKey = dumpRateLimitEventKey("custom", userId, eventId);
  const statsKey = userStatsKey("custom", "yanmar", "2026-7", userId, "sum");
  const topKey = rankingsTopKey("custom", "yanmar", "2026-7", 10, "sum");
  const sessionKey = sessionVersionKey("custom", userId);
  const couponKey = seasonDropCouponsKey("custom", "2026-3");

  for (const key of [
    rateKey,
    rateEventKey,
    statsKey,
    topKey,
    sessionKey,
    couponKey,
  ]) {
    assert.match(key, /^custom:v1:/);
    assert.equal(key.includes(userId), false);
    assert.equal(key.includes(eventId), false);
  }
});

test("ranking cache validation accepts safe payloads only", () => {
  assert.equal(
    isRankingEntries([
      {
        rank: 1,
        userId: "user-1",
        nickname: "Player",
        score: 100,
        stars: 3,
        playTime: 60,
      },
    ]),
    true,
  );
  assert.equal(
    isRankingEntries([
      {
        rank: 1,
        userId: "user-1",
        nickname: "Player",
        score: Number.MAX_SAFE_INTEGER + 1,
        stars: 3,
        playTime: 60,
      },
    ]),
    false,
  );
  assert.equal(
    isUserGameStats({
      rank: null,
      bestScore: 0,
      bestStars: 0,
      playTime: 0,
    }),
    true,
  );
  assert.equal(
    isUserGameStats({ rank: 0, bestScore: 1, bestStars: 0, playTime: 0 }),
    false,
  );
});

test(
  "Redis cache integration round-trips JSON",
  { skip: !process.env.REDIS_URL },
  async () => {
    const [{ deleteRedisKeys, readRedisJson, writeRedisJson }, { closeRedis }] =
      await Promise.all([
        import("../src/lib/redis-cache"),
        import("../src/lib/redis"),
      ]);
    const key = `ykgame-test:v1:${randomUUID()}`;
    const validate = (value: unknown): value is { ok: boolean } =>
      Boolean(
        value &&
          typeof value === "object" &&
          (value as { ok?: unknown }).ok === true,
      );
    try {
      assert.equal(await writeRedisJson(key, { ok: true }, 5), true);
      assert.deepEqual(await readRedisJson(key, validate), {
        available: true,
        hit: true,
        value: { ok: true },
      });
      assert.equal(await deleteRedisKeys(key), true);
    } finally {
      await closeRedis();
    }
  },
);
