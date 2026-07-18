import http from "k6/http";
import { check, fail, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import {
  resolveLoadEnv,
  validateLoadEnvironment,
} from "./load-config.mjs";

const loadConfig = (() => {
  try {
    const env = resolveLoadEnv(__ENV, (path) => open(path));
    return { value: validateLoadEnvironment(env), error: null };
  } catch (error) {
    return { value: null, error: error.message };
  }
})();

const smoke = __ENV.K6_SMOKE === "true";
const stageDuration = __ENV.K6_STAGE_DURATION || "5m";
const soakDuration = __ENV.K6_SOAK_DURATION || "60m";
const rampDownDuration = __ENV.K6_RAMP_DOWN_DURATION || "5m";
const burstStartTime = __ENV.K6_BURST_START_TIME || "20m";
const burstDuration = __ENV.K6_BURST_DURATION || "2m";
const thinkTimeSeconds = Number(__ENV.K6_THINK_TIME_SECONDS || "1");
const replayRate = Number(__ENV.K6_REPLAY_RATE || "0.05");

const dumpDuration = new Trend("dump_duration", true);
const dumpFailures = new Rate("dump_failures");
const rankingDuration = new Trend("ranking_duration", true);
const rankingFailures = new Rate("ranking_failures");
const scoreDuration = new Trend("score_duration", true);
const scoreFailures = new Rate("score_failures");
const dumpRateLimited = new Counter("dump_rate_limited");

const normalStatuses = http.expectedStatuses({ min: 200, max: 399 });
const rateLimitStatuses = http.expectedStatuses(
  { min: 200, max: 399 },
  429,
);

export const options = {
  scenarios: {
    mixed_load: {
      executor: "ramping-vus",
      exec: "mixedScenario",
      startVUs: 0,
      stages: [
        { duration: stageDuration, target: smoke ? 1 : 100 },
        { duration: stageDuration, target: smoke ? 3 : 300 },
        { duration: stageDuration, target: smoke ? 5 : 500 },
        { duration: stageDuration, target: smoke ? 10 : 1000 },
        { duration: soakDuration, target: smoke ? 10 : 1000 },
        { duration: rampDownDuration, target: 0 },
      ],
      gracefulRampDown: "30s",
      tags: { workload: "mixed" },
    },
    dump_burst: {
      executor: "constant-vus",
      exec: "dumpBurst",
      vus: smoke ? 2 : 200,
      duration: burstDuration,
      startTime: burstStartTime,
      gracefulStop: "10s",
      tags: { workload: "rate_limit" },
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<300", "p(99)<1000"],
    dump_duration: ["p(95)<300", "p(99)<1000"],
    dump_failures: ["rate<0.01"],
    ranking_duration: ["p(95)<300", "p(99)<1000"],
    ranking_failures: ["rate<0.01"],
    score_duration: ["p(95)<300", "p(99)<1000"],
    score_failures: ["rate<0.01"],
  },
};

export function setup() {
  if (loadConfig.error) fail(loadConfig.error);
  return { sessionCount: loadConfig.value.cookies.length };
}

function uuidV4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

function requestParams(route, allowRateLimit = false) {
  const cookies = loadConfig.value.cookies;
  const cookie = cookies[(__VU - 1) % cookies.length];
  return {
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    tags: { route },
    responseCallback: allowRateLimit ? rateLimitStatuses : normalStatuses,
  };
}

function accepted(response, allowRateLimit = false) {
  return (
    (response.status >= 200 && response.status < 400) ||
    (allowRateLimit && response.status === 429)
  );
}

function record(response, route, allowRateLimit = false) {
  const ok = accepted(response, allowRateLimit);
  const tags = { route };
  if (route === "dump") {
    dumpDuration.add(response.timings.duration, tags);
    dumpFailures.add(!ok, tags);
    if (response.status === 429) dumpRateLimited.add(1, tags);
  } else if (route === "ranking") {
    rankingDuration.add(response.timings.duration, tags);
    rankingFailures.add(!ok, tags);
  } else if (route === "score") {
    scoreDuration.add(response.timings.duration, tags);
    scoreFailures.add(!ok, tags);
  }
  check(response, { [`${route} returned an accepted status`]: () => ok });
  return ok;
}

function postWithStableId(url, body, route, allowRateLimit = false) {
  const encoded = JSON.stringify(body);
  const params = requestParams(route, allowRateLimit);
  let response = http.post(url, encoded, params);
  record(response, route, allowRateLimit);

  // Transport/server retries and sampled idempotency replays deliberately reuse
  // the exact sessionId/eventId contained in body.
  if (response.status >= 500 || Math.random() < replayRate) {
    response = http.post(url, encoded, params);
    record(response, route, allowRateLimit);
  }
}

function submitScore() {
  const sessionId = uuidV4();
  postWithStableId(
    `${loadConfig.value.baseUrl}/api/scores`,
    {
      gameId: "yanmar",
      progress: 1,
      playTime: 60,
      timeLeft: 0,
      arcadeScore: 1000 + Math.floor(Math.random() * 9000),
      mode: "game",
      sessionId,
    },
    "score",
  );
}

function submitDump(chunkCount, allowRateLimit = false) {
  const eventId = uuidV4();
  postWithStableId(
    `${loadConfig.value.baseUrl}/api/rewards/yanmar-dump`,
    { chunkCount, eventId },
    "dump",
    allowRateLimit,
  );
}

function readRanking() {
  const response = http.get(
    `${loadConfig.value.baseUrl}/api/rankings/yanmar`,
    requestParams("ranking"),
  );
  record(response, "ranking");
}

function readOther() {
  const path = Math.random() < 0.5 ? "/api/health" : "/api/user/profile";
  const response = http.get(
    `${loadConfig.value.baseUrl}${path}`,
    requestParams("other"),
  );
  check(response, {
    "health/other returned success": (result) =>
      result.status >= 200 && result.status < 400,
  });
}

export function mixedScenario() {
  const choice = Math.random();
  if (choice < 0.35) submitDump(1);
  else if (choice < 0.7) submitScore();
  else if (choice < 0.9) readRanking();
  else readOther();
  sleep(Number.isFinite(thinkTimeSeconds) ? Math.max(0, thinkTimeSeconds) : 1);
}

export function dumpBurst() {
  submitDump(20, true);
  sleep(Number.isFinite(thinkTimeSeconds) ? Math.max(0, thinkTimeSeconds) : 1);
}
