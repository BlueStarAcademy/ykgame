#!/usr/bin/env node
/**
 * Create N staging test accounts and print K6_SESSION_COOKIES_JSON (no secrets
 * other than session cookies needed for load testing).
 *
 * Usage:
 *   node scripts/create-staging-load-cookies.mjs
 * Env:
 *   K6_BASE_URL (default https://ykgame-staging.up.railway.app)
 *   LOAD_ACCOUNT_COUNT (default 20)
 *   LOAD_ACCOUNT_PREFIX (default loadccu)
 */
import { writeFileSync } from "node:fs";

const baseUrl = (process.env.K6_BASE_URL || "https://ykgame-staging.up.railway.app").replace(
  /\/$/,
  "",
);
const startFrom = Math.max(1, Number(process.env.LOAD_ACCOUNT_START || 1));
const count = Math.max(1, Math.min(500, Number(process.env.LOAD_ACCOUNT_COUNT || 20)));
const prefix = process.env.LOAD_ACCOUNT_PREFIX || "loadccu";
const password = process.env.LOAD_ACCOUNT_PASSWORD || "LoadTest1!";
const append = process.env.LOAD_COOKIES_APPEND === "1";

function parseSetCookie(headerValue) {
  if (!headerValue) return [];
  // undici/fetch may join multiple set-cookie; Node 22 getSetCookie preferred
  return Array.isArray(headerValue) ? headerValue : [headerValue];
}

function cookieHeaderFromResponses(responses) {
  const jar = new Map();
  for (const res of responses) {
    const cookies =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : parseSetCookie(res.headers.get("set-cookie"));
    for (const raw of cookies) {
      const first = raw.split(";")[0];
      const eq = first.indexOf("=");
      if (eq <= 0) continue;
      jar.set(first.slice(0, eq), first.slice(eq + 1));
    }
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function signup(loginId, email) {
  const res = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      loginId,
      email,
      password,
      passwordConfirm: password,
    }),
  });
  if (res.ok) return true;
  const body = await res.text();
  // already exists is fine
  if (res.status === 409 || /already|존재|duplicate/i.test(body)) return false;
  throw new Error(`signup ${loginId} failed: ${res.status} ${body.slice(0, 200)}`);
}

async function loginCookie(loginId) {
  const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
  if (!csrfRes.ok) throw new Error(`csrf failed: ${csrfRes.status}`);
  const { csrfToken } = await csrfRes.json();
  const csrfCookies = cookieHeaderFromResponses([csrfRes]);

  const body = new URLSearchParams({
    csrfToken,
    loginId,
    password,
    callbackUrl: `${baseUrl}/home`,
    json: "true",
  });

  const loginRes = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: csrfCookies,
    },
    body,
    redirect: "manual",
  });

  const cookie = cookieHeaderFromResponses([csrfRes, loginRes]);
  if (!/session-token=/i.test(cookie)) {
    // Some Auth.js deployments set the session on a follow-up redirect hop.
    const location = loginRes.headers.get("location");
    if (location && loginRes.status >= 300 && loginRes.status < 400) {
      const followUrl = new URL(location, baseUrl).toString();
      const followRes = await fetch(followUrl, {
        headers: { cookie },
        redirect: "manual",
      });
      const followed = cookieHeaderFromResponses([csrfRes, loginRes, followRes]);
      if (/session-token=/i.test(followed)) {
        return followed
          .split("; ")
          .filter((p) => /session-token|csrf-token/i.test(p))
          .join("; ");
      }
    }
    const names = cookie
      .split("; ")
      .map((p) => p.split("=")[0])
      .filter(Boolean)
      .join(",");
    throw new Error(
      `login ${loginId} missing session cookie: ${loginRes.status} cookies=[${names}]`,
    );
  }

  return cookie
    .split("; ")
    .filter((p) => /session-token|csrf-token/i.test(p))
    .join("; ");
}

async function main() {
  const outPath = process.env.LOAD_COOKIES_OUT || "scripts/load/.staging-cookies.json";
  const cookies = append
    ? JSON.parse(await import("node:fs").then((fs) => fs.readFileSync(outPath, "utf8")))
    : [];
  if (!Array.isArray(cookies)) {
    throw new Error("Existing cookie file is not a JSON array");
  }

  for (let i = startFrom; i < startFrom + count; i += 1) {
    const id = `${prefix}${String(i).padStart(2, "0")}`;
    const email = `${id}@ykgame.loadtest`;
    await signup(id, email);
    const cookie = await loginCookie(id);
    cookies.push(cookie);
    process.stderr.write(`ok ${id} (total ${cookies.length})\n`);
  }

  const json = JSON.stringify(cookies);
  writeFileSync(outPath, json, "utf8");
  process.stderr.write(`wrote ${outPath} (${cookies.length} cookies)\n`);
  console.log(`K6_SESSION_COOKIES_JSON_FILE=${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
