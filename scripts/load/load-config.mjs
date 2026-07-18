const PRODUCTION_ENVIRONMENTS = new Set(["prod", "production"]);

export function parseSessionCookies(env) {
  const json = env.K6_SESSION_COOKIES_JSON?.trim();
  const single = env.K6_SESSION_COOKIE?.trim();

  if (json) {
    let parsed;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error(
        "K6_SESSION_COOKIES_JSON must be a JSON array of Cookie header strings.",
      );
    }
    if (
      !Array.isArray(parsed) ||
      parsed.length === 0 ||
      parsed.some((cookie) => typeof cookie !== "string" || !cookie.trim())
    ) {
      throw new Error(
        "K6_SESSION_COOKIES_JSON must be a non-empty JSON array of non-empty Cookie header strings.",
      );
    }
    return parsed.map((cookie) => cookie.trim());
  }

  if (single) return [single];
  throw new Error(
    "Authenticated load testing requires K6_SESSION_COOKIES_JSON, K6_SESSION_COOKIES_JSON_FILE, or K6_SESSION_COOKIE.",
  );
}

function parseHttpUrl(raw) {
  // k6's JS runtime does not provide the WHATWG URL global.
  if (typeof URL === "function") {
    try {
      return new URL(raw);
    } catch {
      return null;
    }
  }
  const match = String(raw)
    .trim()
    .match(/^(https?):\/\/([^/?#:]+)(?::(\d+))?(\/[^?#]*)?/i);
  if (!match) return null;
  return {
    protocol: `${match[1].toLowerCase()}:`,
    hostname: match[2].toLowerCase(),
    pathname: match[4] || "/",
    href: String(raw).trim(),
  };
}

export function normalizeBaseUrl(value) {
  const raw = value?.trim();
  if (!raw) throw new Error("K6_BASE_URL is required.");

  const url = parseHttpUrl(raw);
  if (!url) {
    throw new Error("K6_BASE_URL must be an absolute http(s) URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("K6_BASE_URL must use http or https.");
  }
  return String(raw).replace(/\/$/, "");
}

export function isProductionTarget(baseUrl, environment = "") {
  const url = parseHttpUrl(baseUrl);
  const hostname = url?.hostname?.toLowerCase?.() ?? "";
  return (
    hostname === "railway.app" ||
    hostname.endsWith(".railway.app") ||
    PRODUCTION_ENVIRONMENTS.has(environment.trim().toLowerCase())
  );
}

/** Merge cookie file contents into an env object (Node fs or k6 open). */
export function resolveLoadEnv(env, readFile) {
  const next = { ...env };
  const file = next.K6_SESSION_COOKIES_JSON_FILE?.trim();
  if (file && !next.K6_SESSION_COOKIES_JSON?.trim()) {
    next.K6_SESSION_COOKIES_JSON = readFile(file);
  }
  return next;
}

export function validateLoadEnvironment(env) {
  const baseUrl = normalizeBaseUrl(env.K6_BASE_URL);
  const cookies = parseSessionCookies(env);
  if (
    isProductionTarget(baseUrl, env.K6_TARGET_ENV) &&
    env.K6_ALLOW_PRODUCTION !== "true"
  ) {
    throw new Error(
      "Production load testing is blocked. Set K6_ALLOW_PRODUCTION=true only after explicit approval.",
    );
  }
  return { baseUrl, cookies };
}
