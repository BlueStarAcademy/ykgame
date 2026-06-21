#!/usr/bin/env sh
set -e

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

echo "==> Running database migrations..."
npx prisma migrate deploy

echo "==> Seeding admin account (idempotent)..."
npm run db:seed

echo "==> Deploy prep complete."
