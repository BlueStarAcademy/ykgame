import assert from "node:assert/strict";
import test from "node:test";
import {
  CHAT_BODY_MAX_LENGTH,
  CHAT_CHANNEL_MAX,
  CHAT_CHANNEL_MIN,
  clampChatBody,
  isValidChatChannel,
} from "../src/lib/chat-constants";
import { nextAutoChannels } from "../src/lib/chat/presence";
import {
  chatChannelMembersKey,
  chatCooldownKey,
  chatPubSubChannel,
  chatUserPresenceKey,
} from "../src/lib/redis-keys";

test("chat channel validation accepts 1..100 only", () => {
  assert.equal(isValidChatChannel(1), true);
  assert.equal(isValidChatChannel(100), true);
  assert.equal(isValidChatChannel(0), false);
  assert.equal(isValidChatChannel(101), false);
  assert.equal(isValidChatChannel(1.5), false);
  assert.equal(isValidChatChannel("1"), false);
});

test("auto channel order starts at preferred then wraps", () => {
  assert.deepEqual(nextAutoChannels(1, 1, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(nextAutoChannels(3, 1, 5), [3, 4, 5, 1, 2]);
  assert.deepEqual(nextAutoChannels(99, CHAT_CHANNEL_MIN, CHAT_CHANNEL_MAX).slice(0, 3), [
    99,
    100,
    1,
  ]);
});

test("chat body clamp rejects empty and overlong", () => {
  assert.equal(clampChatBody("  hello  "), "hello");
  assert.equal(clampChatBody("   "), null);
  assert.equal(clampChatBody("a".repeat(CHAT_BODY_MAX_LENGTH + 1)), null);
  assert.equal(clampChatBody("a".repeat(CHAT_BODY_MAX_LENGTH))?.length, CHAT_BODY_MAX_LENGTH);
});

test("chat redis keys stay namespaced", () => {
  assert.equal(chatChannelMembersKey("ykgame", 7), "ykgame:v1:chat:ch:7:members");
  assert.match(chatUserPresenceKey("ykgame", "user-1"), /^ykgame:v1:chat:presence:/);
  assert.match(chatCooldownKey("ykgame", "user-1"), /^ykgame:v1:chat:cd:/);
  assert.equal(chatPubSubChannel("ykgame"), "ykgame:v1:chat:pubsub");
});

test("master enhance announce condition helpers", () => {
  const shouldAnnounce = (
    success: boolean,
    grade: string,
    before: number,
    after: number,
  ) => success && grade === "MASTER" && before === 9 && after === 10;

  assert.equal(shouldAnnounce(true, "MASTER", 9, 10), true);
  assert.equal(shouldAnnounce(true, "PRECISION", 9, 10), false);
  assert.equal(shouldAnnounce(false, "MASTER", 9, 10), false);
  assert.equal(shouldAnnounce(true, "MASTER", 8, 9), false);
});

test("sports meet takeover only when displacing another player", () => {
  function isTakeover(
    previousLeaderUserId: string | null,
    newLeaderUserId: string,
    actorUserId: string,
  ) {
    return (
      previousLeaderUserId != null &&
      previousLeaderUserId !== actorUserId &&
      newLeaderUserId === actorUserId
    );
  }

  assert.equal(isTakeover("a", "b", "b"), true);
  assert.equal(isTakeover(null, "b", "b"), false);
  assert.equal(isTakeover("b", "b", "b"), false);
  assert.equal(isTakeover("a", "a", "b"), false);
});
