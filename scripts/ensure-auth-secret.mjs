import { createHash } from "node:crypto";

function deriveFromDatabaseUrl() {
  const dbUrl =
    process.env.DATABASE_URL?.trim() ||
    process.env.DATABASE_PUBLIC_URL?.trim() ||
    process.env.DATABASE_PRIVATE_URL?.trim();

  if (!dbUrl) return undefined;

  return createHash("sha256")
    .update(`ykgame-auth-v1:${dbUrl}`)
    .digest("base64");
}

/**
 * NextAuth AUTH_SECRET 정규화.
 * Railway에서 AUTH_SECRET 미설정 시 DATABASE_URL 기반으로 자동 생성합니다.
 */
export function ensureAuthSecret({ fatal = true } = {}) {
  if (!process.env.AUTH_SECRET?.trim() && process.env.NEXTAUTH_SECRET?.trim()) {
    process.env.AUTH_SECRET = process.env.NEXTAUTH_SECRET.trim();
  }

  if (!process.env.AUTH_SECRET?.trim() && process.env.RAILWAY_ENVIRONMENT) {
    const derived = deriveFromDatabaseUrl();
    if (derived) {
      process.env.AUTH_SECRET = derived;
      console.warn(
        "WARN: AUTH_SECRET not set — using auto-derived secret on Railway.",
      );
      console.warn(
        "      Railway → ykgame-web → Variables → AUTH_SECRET 설정을 권장합니다.",
      );
      return true;
    }
  }

  if (!process.env.AUTH_SECRET?.trim()) {
    if (fatal) {
      console.error("FATAL: AUTH_SECRET is not set.");
      console.error("");
      console.error("Railway Dashboard → ykgame-web 서비스 → Variables 탭:");
      console.error("  Name: AUTH_SECRET");
      console.error("  Value: openssl rand -base64 32 로 생성한 값");
      console.error("");
      console.error("(Postgres 서비스가 아닌 웹 서비스에 설정해야 합니다.)");
      process.exit(1);
    }
    return false;
  }

  return true;
}
