import assert from "node:assert/strict";
import test from "node:test";
import {
  parseRewardEventId,
  parseScoreSessionId,
} from "../src/lib/request-idempotency";

test("reward event IDs are trimmed and constrained", () => {
  assert.equal(parseRewardEventId(" dump:session-1.2 "), "dump:session-1.2");
  assert.equal(parseRewardEventId(""), null);
  assert.equal(parseRewardEventId("contains spaces"), null);
  assert.equal(parseRewardEventId("x".repeat(129)), null);
  assert.equal(parseRewardEventId(42), null);
});

test("score session IDs use the same transport-safe format", () => {
  assert.equal(parseScoreSessionId("session_01-abc"), "session_01-abc");
  assert.equal(parseScoreSessionId(undefined), null);
  assert.equal(parseScoreSessionId("slash/not-allowed"), null);
});

// RewardEvent replay and concurrent score insertion require PostgreSQL advisory
// locks, transactions, and unique indexes. They are intentionally left to DB
// integration tests when a disposable test database is available.
