import { createHash } from "crypto";

/** NextAuth 시크릿 — AUTH_SECRET / NEXTAUTH_SECRET / Railway 자동 파생 */
export function resolveAuthSecret(): string | undefined {
  const auth = process.env.AUTH_SECRET?.trim();
  const legacy = process.env.NEXTAUTH_SECRET?.trim();
  if (auth) return auth;
  if (legacy) return legacy;

  if (process.env.RAILWAY_ENVIRONMENT) {
    const dbUrl =
      process.env.DATABASE_URL?.trim() ||
      process.env.DATABASE_PUBLIC_URL?.trim();
    if (dbUrl) {
      return createHash("sha256")
        .update(`ykgame-auth-v1:${dbUrl}`)
        .digest("base64");
    }
  }

  return undefined;
}

export function ensureAuthSecretEnv(): void {
  const secret = resolveAuthSecret();
  if (secret) {
    process.env.AUTH_SECRET ??= secret;
    process.env.NEXTAUTH_SECRET ??= secret;
  }
}
