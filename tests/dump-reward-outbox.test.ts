import assert from "node:assert/strict";
import test from "node:test";
import {
  dumpRewardOutboxStorageKey,
  isValidDumpRewardOutboxBatch,
  mergeDumpRewardOutbox,
  parseDumpRewardOutbox,
  removeDumpRewardOutboxBatch,
  serializeDumpRewardOutbox,
  type DumpRewardOutboxBatch,
} from "../src/games/yanmar/dumpRewardOutbox";

const first: DumpRewardOutboxBatch = {
  eventId: "dump:first",
  chunkCount: 2,
  optimisticStars: 5,
  optimisticXp: 20,
  optimisticScore: 100,
  createdAt: 1000,
};

test("dump outbox serializes and parses valid batches", () => {
  assert.deepEqual(parseDumpRewardOutbox(serializeDumpRewardOutbox([first])), [
    first,
  ]);
  assert.deepEqual(parseDumpRewardOutbox("not json"), []);
  assert.deepEqual(parseDumpRewardOutbox(JSON.stringify({ batch: first })), []);
});

test("dump outbox validation rejects unsafe or oversized batches", () => {
  assert.equal(isValidDumpRewardOutboxBatch(first), true);
  assert.equal(
    isValidDumpRewardOutboxBatch({ ...first, eventId: "bad id" }),
    false,
  );
  assert.equal(
    isValidDumpRewardOutboxBatch({ ...first, chunkCount: 21 }),
    false,
  );
  assert.equal(
    isValidDumpRewardOutboxBatch({ ...first, optimisticStars: -1 }),
    false,
  );
});

test("dump outbox merge replaces retries without changing event identity", () => {
  const updated = { ...first, chunkCount: 3, optimisticScore: 150 };
  const second = { ...first, eventId: "dump:second", createdAt: 2000 };
  assert.deepEqual(mergeDumpRewardOutbox([first, second], updated), [
    updated,
    second,
  ]);
});

test("dump outbox removes only the acknowledged batch", () => {
  const second = { ...first, eventId: "dump:second", createdAt: 2000 };
  assert.deepEqual(removeDumpRewardOutboxBatch([first, second], first.eventId), [
    second,
  ]);
});

test("dump outbox storage is isolated by user", () => {
  assert.notEqual(
    dumpRewardOutboxStorageKey("user-a"),
    dumpRewardOutboxStorageKey("user-b"),
  );
});
