import assert from "node:assert/strict";
import test from "node:test";
import { NextResponse } from "next/server";
import {
  createHotApiLogEntry,
  getHotApiRequestId,
  mergeHotApiMetadata,
  withHotApiObservability,
  writeHotApiLog,
} from "../src/lib/hot-api-observability";

test("hot API logger writes one structured JSON line", () => {
  const entry = createHotApiLogEntry({
    requestId: "request-123",
    route: "/api/scores",
    method: "POST",
    status: 200,
    durationMs: 12.6,
    metadata: {
      outcome: "success",
      batchSize: 1,
      replayed: false,
      duplicate: true,
      rateLimitBypassed: true,
    },
  });
  const lines: string[] = [];

  writeHotApiLog(entry, (line) => lines.push(line));

  assert.equal(lines.length, 1);
  assert.equal(lines[0].includes("\n"), false);
  assert.deepEqual(JSON.parse(lines[0]), {
    event: "hot_api_request",
    requestId: "request-123",
    route: "/api/scores",
    method: "POST",
    status: 200,
    durationMs: 13,
    outcome: "success",
    batchSize: 1,
    replayed: false,
    duplicate: true,
    rateLimitBypassed: true,
  });
});

test("hot API metadata merges defined route observations", () => {
  assert.deepEqual(
    mergeHotApiMetadata(
      { batchSize: 20, outcome: "success", replayed: false },
      {
        outcome: "rate_limited",
        replayed: true,
        duplicate: undefined,
        errorCode: "TOO_MANY_REQUESTS",
      },
    ),
    {
      batchSize: 20,
      outcome: "rate_limited",
      replayed: true,
      errorCode: "TOO_MANY_REQUESTS",
    },
  );
});

test("request IDs only reuse transport-safe header values", () => {
  assert.equal(
    getHotApiRequestId(
      new Request("https://example.test", {
        headers: { "x-request-id": "upstream:request-1" },
      }),
    ),
    "upstream:request-1",
  );

  const generated = getHotApiRequestId(
    new Request("https://example.test", {
      headers: { "x-request-id": "unsafe/request" },
    }),
  );
  assert.match(
    generated,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});

test("wrapper preserves the NextResponse and adds its request ID", async () => {
  const response = NextResponse.json({ ok: true });
  const wrapped = withHotApiObservability(
    "/api/test",
    async (_request, _routeContext: undefined, observation) => {
      observation.setMetadata({ outcome: "success" });
      return response;
    },
  );
  const originalConsoleInfo = console.info;
  console.info = () => {};

  try {
    const actual = await wrapped(
      new Request("https://example.test", {
        headers: { "x-request-id": "request-456" },
      }),
      undefined,
    );
    assert.strictEqual(actual, response);
    assert.equal(actual.headers.get("x-request-id"), "request-456");
  } finally {
    console.info = originalConsoleInfo;
  }
});
