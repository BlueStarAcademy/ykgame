/** Next.js production build 중에는 DB 연결이 필요 없음 */
const BUILD_PLACEHOLDER_URL =
  "postgresql://build:build@127.0.0.1:5432/build?schema=public";

function isProductionBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

/**
 * Railway Postgres 연결 URL resolver.
 *
 * - Railway 배포: DATABASE_URL (postgres.railway.internal) 사용
 * - 로컬 개발: DATABASE_PUBLIC_URL (proxy.rlwy.net) 사용
 */
export function getDatabaseUrl(): string {
  const internal = process.env.DATABASE_URL;
  const publicUrl = process.env.DATABASE_PUBLIC_URL;
  const onRailway = Boolean(process.env.RAILWAY_ENVIRONMENT);

  if (onRailway && internal) {
    return internal;
  }

  if (publicUrl) {
    return publicUrl;
  }

  if (internal && !internal.includes("railway.internal")) {
    return internal;
  }

  if (internal?.includes("railway.internal")) {
    throw new Error(
      "로컬에서는 Railway internal URL에 접속할 수 없습니다. " +
        ".env에 DATABASE_PUBLIC_URL(Railway Postgres → Connect → Public URL)을 설정하세요.",
    );
  }

  if (isProductionBuildPhase()) {
    return BUILD_PLACEHOLDER_URL;
  }

  throw new Error("DATABASE_URL 또는 DATABASE_PUBLIC_URL 환경 변수가 필요합니다.");
}
