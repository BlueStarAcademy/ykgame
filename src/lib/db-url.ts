/** Next.js production build 중에는 DB 연결이 필요 없음 */
const BUILD_PLACEHOLDER_URL =
  "postgresql://build:build@127.0.0.1:5432/build?schema=public";

function isProductionBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

function isBuildPlaceholder(url: string | undefined): boolean {
  return url === BUILD_PLACEHOLDER_URL;
}

function buildFromPgEnv(): string | undefined {
  const { PGUSER, PGPASSWORD, PGHOST, PGPORT, PGDATABASE } = process.env;
  if (!PGHOST || !PGUSER || !PGPASSWORD || !PGDATABASE) return undefined;

  const port = PGPORT || "5432";
  return `postgresql://${PGUSER}:${encodeURIComponent(PGPASSWORD)}@${PGHOST}:${port}/${PGDATABASE}`;
}

function pickFirstUrl(candidates: Array<string | undefined>): string | undefined {
  for (const url of candidates) {
    if (url && !isBuildPlaceholder(url)) return url;
  }
  return undefined;
}

function railwaySetupHint(): string {
  return (
    "Railway Variables에 Postgres 연결이 필요합니다.\n" +
    "  1. ykgame-web 서비스 → Variables → New Variable → Add Reference\n" +
    "  2. Postgres 서비스 선택 → DATABASE_URL 참조 추가\n" +
    "  3. AUTH_SECRET도 직접 입력 (openssl rand -base64 32)\n" +
    "  (서비스 이름이 Postgres가 아니면 ${{서비스이름.DATABASE_URL}} 형식 사용)"
  );
}

/**
 * Railway Postgres 연결 URL resolver.
 *
 * - Railway 배포: DATABASE_URL (postgres.railway.internal) 사용
 * - 로컬 개발: DATABASE_PUBLIC_URL (proxy.rlwy.net) 사용
 */
export function getDatabaseUrl(): string {
  const onRailway = Boolean(process.env.RAILWAY_ENVIRONMENT);
  const internal = process.env.DATABASE_URL;
  const publicUrl = process.env.DATABASE_PUBLIC_URL;
  const fromPg = buildFromPgEnv();

  if (onRailway) {
    const url = pickFirstUrl([
      internal,
      process.env.DATABASE_PRIVATE_URL,
      process.env.POSTGRES_URL,
      fromPg,
      publicUrl,
    ]);

    if (url) return url;

    throw new Error(
      "Railway에서 DATABASE_URL이 비어 있습니다.\n" + railwaySetupHint(),
    );
  }

  if (publicUrl) return publicUrl;

  if (internal && !internal.includes("railway.internal")) {
    return internal;
  }

  if (internal?.includes("railway.internal")) {
    throw new Error(
      "로컬에서는 Railway internal URL에 접속할 수 없습니다. " +
        ".env에 DATABASE_PUBLIC_URL(Railway Postgres → Connect → Public URL)을 설정하세요.",
    );
  }

  const fallback = pickFirstUrl([
    fromPg,
    process.env.DATABASE_PRIVATE_URL,
    process.env.POSTGRES_URL,
  ]);
  if (fallback) return fallback;

  if (isProductionBuildPhase() || isBuildPlaceholder(internal)) {
    return BUILD_PLACEHOLDER_URL;
  }

  if (internal) return internal;

  throw new Error("DATABASE_URL 또는 DATABASE_PUBLIC_URL 환경 변수가 필요합니다.");
}

/** pre-deploy 스크립트용 — URL 존재 여부만 검사 */
export function assertDatabaseUrlConfigured(): void {
  getDatabaseUrl();
}
