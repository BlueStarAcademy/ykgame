/** NextAuth 시크릿 — Edge 호환 (파생은 next.config / start 스크립트에서 수행) */
export function resolveAuthSecret(): string | undefined {
  const auth = process.env.AUTH_SECRET?.trim();
  const legacy = process.env.NEXTAUTH_SECRET?.trim();
  return auth || legacy || undefined;
}

export function ensureAuthSecretEnv(): void {
  const secret = resolveAuthSecret();
  if (secret) {
    process.env.AUTH_SECRET ??= secret;
    process.env.NEXTAUTH_SECRET ??= secret;
  }
}
