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
    "Authenticated load testing requires K6_SESSION_COOKIES_JSON or K6_SESSION_COOKIE.",
  );
}

export function normalizeBaseUrl(value) {
  const raw = value?.trim();
  if (!raw) throw new Error("K6_BASE_URL is required.");

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("K6_BASE_URL must be an absolute http(s) URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("K6_BASE_URL must use http or https.");
  }
  return url.toString().replace(/\/$/, "");
}

export function isProductionTarget(baseUrl, environment = "") {
  const hostname = new URL(baseUrl).hostname.toLowerCase();
  return (
    hostname === "railway.app" ||
    hostname.endsWith(".railway.app") ||
    PRODUCTION_ENVIRONMENTS.has(environment.trim().toLowerCase())
  );
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
