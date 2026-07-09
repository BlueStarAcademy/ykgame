#!/usr/bin/env sh
set -e

BUILD_PLACEHOLDER="postgresql://build:build@127.0.0.1:5432/build"

is_placeholder_url() {
  case "$1" in
    "$BUILD_PLACEHOLDER"|"$BUILD_PLACEHOLDER?schema=public")
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

if [ -z "$DATABASE_URL" ] && [ -z "$DATABASE_PUBLIC_URL" ] && [ -z "$PGHOST" ]; then
  echo "ERROR: DATABASE_URL is not configured."
  echo ""
  echo "Railway Dashboard → ykgame-web → Variables:"
  echo "  1. New Variable → Add Reference"
  echo "  2. Postgres 서비스 → DATABASE_URL 선택"
  echo "  3. AUTH_SECRET 직접 입력 (openssl rand -base64 32)"
  echo ""
  echo "Postgres 서비스 이름이 'Postgres'가 아니면 Reference에서 실제 서비스명을 선택하세요."
  exit 1
fi

if [ -n "$DATABASE_URL" ] && is_placeholder_url "$DATABASE_URL"; then
  echo "ERROR: DATABASE_URL이 빌드용 placeholder입니다. Railway Variables에서 Postgres Reference를 추가하세요."
  echo "  예: DATABASE_URL = \${{Postgres.DATABASE_URL}}"
  exit 1
fi

echo "==> Resolving database URL..."
export DATABASE_URL="$(npx tsx scripts/resolve-db-url.ts)"

if is_placeholder_url "$DATABASE_URL"; then
  echo "ERROR: 유효한 DATABASE_URL을 찾지 못했습니다."
  echo "Railway Variables에 Postgres → DATABASE_URL Reference가 연결되어 있는지 확인하세요."
  exit 1
fi

echo "==> Running database migrations..."
attempt=1
max_attempts=5
while [ "$attempt" -le "$max_attempts" ]; do
  if npx prisma migrate deploy; then
    break
  fi

  if [ "$attempt" -eq "$max_attempts" ]; then
    echo "ERROR: prisma migrate deploy failed after ${max_attempts} attempts."
    exit 1
  fi

  echo "Migration attempt ${attempt} failed. Retrying in 5s..."
  sleep 5
  attempt=$((attempt + 1))
done

echo "==> Seeding admin account (idempotent)..."
npm run db:seed

echo "==> Verifying admin login..."
npx tsx scripts/verify-admin-login.ts

echo "==> Deploy prep complete (rev: e704ce4+)."
