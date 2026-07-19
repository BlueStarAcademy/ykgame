#!/usr/bin/env node
/**
 * Create N staging test accounts and write unique session cookies.
 * Re-login always bumps sessionVersion — never append duplicate users.
 *
 * Env:
 *   K6_BASE_URL
 *   LOAD_ACCOUNT_COUNT (default 20, max 500)
 *   LOAD_ACCOUNT_PREFIX (default loadccu)
 *   LOAD_COOKIES_OUT
 */
import { writeFileSync } from "node:fs";

const baseUrl = (process.env.K6_BASE_URL || "https://ykgame-staging.up.railway.app").replace(
  /\/$/,
  "",
);
const count = Math.max(1, Math.min(500, Number(process.env.LOAD_ACCOUNT_COUNT || 20)));
const prefix = process.env.LOAD_ACCOUNT_PREFIX || "loadccu";
const password = process.env.LOAD_ACCOUNT_PASSWORD || "LoadTest1!";
const outPath = process.env.LOAD_COOKIES_OUT || "scripts/load/.staging-cookies.json";

function parseSetCookie(headerValue) {
  if (!headerValue) return [];
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

  let cookie = cookieHeaderFromResponses([csrfRes, loginRes]);
  if (!/session-token=/i.test(cookie)) {
    const location = loginRes.headers.get("location");
    if (location && loginRes.status >= 300 && loginRes.status < 400) {
      const followRes = await fetch(new URL(location, baseUrl).toString(), {
        headers: { cookie },
        redirect: "manual",
      });
      cookie = cookieHeaderFromResponses([csrfRes, loginRes, followRes]);
    }
  }

  if (!/session-token=/i.test(cookie)) {
    throw new Error(`login ${loginId} missing session cookie: ${loginRes.status}`);
  }

  return cookie
    .split("; ")
    .filter((p) => /session-token|csrf-token/i.test(p))
    .join("; ");
}

async function main() {
  const cookies = [];
  for (let i = 1; i <= count; i += 1) {
    const id = `${prefix}${String(i).padStart(3, "0")}`;
    const email = `${id}@ykgame.loadtest`;
    await signup(id, email);
    cookies.push(await loginCookie(id));
    if (i % 25 === 0 || i === count) {
      process.stderr.write(`ok through ${id} (${cookies.length})\n`);
    }
  }
  writeFileSync(outPath, JSON.stringify(cookies), "utf8");
  process.stderr.write(`wrote ${outPath} (${cookies.length} unique cookies)\n`);
  console.log(`K6_SESSION_COOKIES_JSON_FILE=${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
