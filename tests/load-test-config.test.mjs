import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  isProductionTarget,
  parseSessionCookies,
  validateLoadEnvironment,
} from "../scripts/load/load-config.mjs";

test("load test requires an authenticated cookie", () => {
  assert.throws(
    () => validateLoadEnvironment({ K6_BASE_URL: "http://localhost:3000" }),
    /K6_SESSION_COOKIES_JSON, K6_SESSION_COOKIES_JSON_FILE, or K6_SESSION_COOKIE/,
  );
});

test("cookie JSON is non-empty and maps without exposing credentials", () => {
  assert.deepEqual(
    parseSessionCookies({
      K6_SESSION_COOKIES_JSON: '["authjs.session-token=first","token=second"]',
    }),
    ["authjs.session-token=first", "token=second"],
  );
  assert.throws(
    () => parseSessionCookies({ K6_SESSION_COOKIES_JSON: "[]" }),
    /non-empty JSON array/,
  );
  assert.throws(
    () => parseSessionCookies({ K6_SESSION_COOKIES_JSON: '{"cookie":"x"}' }),
    /non-empty JSON array/,
  );
});

test("Railway and explicitly production targets require an approval gate", () => {
  assert.equal(isProductionTarget("https://game.up.railway.app"), true);
  assert.equal(
    isProductionTarget("https://game.example.com", "production"),
    true,
  );
  assert.throws(
    () =>
      validateLoadEnvironment({
        K6_BASE_URL: "https://game.up.railway.app",
        K6_SESSION_COOKIE: "token=test",
      }),
    /K6_ALLOW_PRODUCTION=true/,
  );
  assert.doesNotThrow(() =>
    validateLoadEnvironment({
      K6_BASE_URL: "https://game.up.railway.app",
      K6_SESSION_COOKIE: "token=test",
      K6_ALLOW_PRODUCTION: "true",
    }),
  );
});

test("k6 script parses in Node and retains scale safety requirements", () => {
  const scriptUrl = new URL("../scripts/load/mixed.js", import.meta.url);
  const result = spawnSync(
    process.execPath,
    ["--check", fileURLToPath(scriptUrl)],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);

  const source = readFileSync(scriptUrl, "utf8");
  assert.match(source, /target: smoke \? 10 : 1000/);
  assert.match(source, /vus: smoke \? 2 : 200/);
  assert.match(source, /K6_SOAK_DURATION \|\| "60m"/);
  assert.match(source, /K6_SKIP_BURST/);
  assert.match(source, /http_req_failed: \["rate<0\.01"\]/);
  assert.match(source, /"p\(95\)<300", "p\(99\)<1000"/);
  assert.match(source, /response\.status === 429/);
  assert.match(source, /const (sessionId|eventId) = uuidV4\(\)/);
});
