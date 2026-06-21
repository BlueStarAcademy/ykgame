/** Railway/로컬 공통 — NextAuth 시크릿 환경 변수 정규화 */
export function ensureAuthSecret() {
  const auth = process.env.AUTH_SECRET?.trim();
  const legacy = process.env.NEXTAUTH_SECRET?.trim();

  if (!auth && legacy) {
    process.env.AUTH_SECRET = legacy;
  }

  if (!process.env.AUTH_SECRET?.trim()) {
    console.error("FATAL: AUTH_SECRET is not set.");
    console.error("");
    console.error("Railway Dashboard → ykgame-web 서비스 → Variables 탭:");
    console.error("  1. New Variable");
    console.error("  2. Name: AUTH_SECRET");
    console.error("  3. Value: openssl rand -base64 32 로 생성한 값");
    console.error("");
    console.error("(Postgres 서비스가 아닌 웹 서비스에 설정해야 합니다.)");
    process.exit(1);
  }
}
