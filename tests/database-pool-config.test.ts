import assert from "node:assert/strict";
import test from "node:test";
import {
  DATABASE_POOL_LIMITS,
  getDatabasePoolConfig,
  parseBoundedInteger,
} from "../src/lib/database-pool-config";

test("bounded integer parser applies defaults and floors finite values", () => {
  const range = { defaultValue: 20, min: 5, max: 50 };

  assert.equal(parseBoundedInteger(undefined, range), 20);
  assert.equal(parseBoundedInteger("", range), 20);
  assert.equal(parseBoundedInteger("not-a-number", range), 20);
  assert.equal(parseBoundedInteger("12.9", range), 12);
});

test("bounded integer parser clamps unsafe values", () => {
  const range = { defaultValue: 20, min: 5, max: 50 };

  assert.equal(parseBoundedInteger("-1", range), 5);
  assert.equal(parseBoundedInteger("999", range), 50);
  assert.equal(parseBoundedInteger("Infinity", range), 20);
});

test("database pool config parses all supported environment variables", () => {
  const config = getDatabasePoolConfig({
    DATABASE_POOL_MAX: "24",
    DATABASE_POOL_CONNECTION_TIMEOUT_MS: "7000",
    DATABASE_POOL_IDLE_TIMEOUT_MS: "45000",
  });

  assert.deepEqual(config, {
    max: 24,
    connectionTimeoutMillis: 7_000,
    idleTimeoutMillis: 45_000,
  });
});

test("database pool config enforces documented timeout limits", () => {
  const config = getDatabasePoolConfig({
    DATABASE_POOL_CONNECTION_TIMEOUT_MS: "10",
    DATABASE_POOL_IDLE_TIMEOUT_MS: "999999",
  });

  assert.equal(
    config.connectionTimeoutMillis,
    DATABASE_POOL_LIMITS.connectionTimeoutMs.min,
  );
  assert.equal(
    config.idleTimeoutMillis,
    DATABASE_POOL_LIMITS.idleTimeoutMs.max,
  );
});
