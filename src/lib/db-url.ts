/** Next.js production build / prisma generate 중에는 DB 연결이 필요 없음 */
const BUILD_PLACEHOLDER_URL =
  "postgresql://build:build@127.0.0.1:5432/build?schema=public";

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

type GetDatabaseUrlOptions = {
  /** false: prisma generate 등 DB 미연결 단계용 placeholder 허용 */
  required?: boolean;
};

/**
 * Railway Postgres 연결 URL resolver.
 *
 * - Railway 배포: DATABASE_URL (postgres.railway.internal) 사용
 * - 로컬 개발: DATABASE_PUBLIC_URL (proxy.rlwy.net) 사용
 */
export function getDatabaseUrl(options: GetDatabaseUrlOptions = {}): string {
  const { required = false } = options;
  const onRailway = Boolean(process.env.RAILWAY_ENVIRONMENT);
  const internal = process.env.DATABASE_URL;
  const publicUrl = process.env.DATABASE_PUBLIC_URL;
  const fromPg = buildFromPgEnv();

  const resolved = pickFirstUrl([
    onRailway ? internal : undefined,
    publicUrl,
    !onRailway ? internal : undefined,
    process.env.DATABASE_PRIVATE_URL,
    process.env.POSTGRES_URL,
    fromPg,
    onRailway ? publicUrl : undefined,
  ]);

  if (resolved) return resolved;

  if (internal?.includes("railway.internal") && !onRailway) {
    throw new Error(
      "로컬에서는 Railway internal URL에 접속할 수 없습니다. " +
        ".env에 DATABASE_PUBLIC_URL(Railway Postgres → Connect → Public URL)을 설정하세요.",
    );
  }

  if (!required) return BUILD_PLACEHOLDER_URL;

  if (onRailway) {
    throw new Error(
      "Railway에서 DATABASE_URL이 비어 있습니다.\n" + railwaySetupHint(),
    );
  }

  throw new Error("DATABASE_URL 또는 DATABASE_PUBLIC_URL 환경 변수가 필요합니다.");
}

/** pre-deploy / 런타임 DB 연결 — 실제 URL 필수 */
export function assertDatabaseUrlConfigured(): void {
  getDatabaseUrl({ required: true });
}
