import assert from "node:assert/strict";
import test from "node:test";
import {
  SESSION_TOUCH_MIN_INTERVAL_MS,
  isSessionActive,
  SESSION_ACTIVE_MS,
} from "../src/lib/session-guard";
import {
  sessionVersionKey,
  seasonDropCouponsKey,
} from "../src/lib/redis-keys";

test("session presence window is five minutes", () => {
  assert.equal(SESSION_ACTIVE_MS, 5 * 60 * 1000);
  const now = Date.now();
  assert.equal(
    isSessionActive({
      sessionVersion: 1,
      sessionLastSeenAt: new Date(now - SESSION_ACTIVE_MS + 1_000),
    }),
    true,
  );
  assert.equal(
    isSessionActive({
      sessionVersion: 1,
      sessionLastSeenAt: new Date(now - SESSION_ACTIVE_MS - 1_000),
    }),
    false,
  );
  assert.equal(
    isSessionActive({ sessionVersion: 1, sessionLastSeenAt: null }),
    false,
  );
});

test("session touch throttle interval is 90 seconds", () => {
  assert.equal(SESSION_TOUCH_MIN_INTERVAL_MS, 90_000);
});

test("session and season-drop Redis keys hide raw identifiers", () => {
  const userId = "user:session@example.test";
  const seasonKey = "2026-3";
  const verKey = sessionVersionKey("custom", userId);
  const dropKey = seasonDropCouponsKey("custom", seasonKey);

  assert.match(verKey, /^custom:v1:session:ver:/);
  assert.match(dropKey, /^custom:v1:coupon:season-drop:/);
  assert.equal(verKey.includes(userId), false);
  assert.equal(dropKey.includes(seasonKey), false);
});
