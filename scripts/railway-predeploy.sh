#!/usr/bin/env sh
set -e

echo "==> Running database migrations..."
npx prisma migrate deploy

echo "==> Seeding admin account (idempotent)..."
npm run db:seed

echo "==> Deploy prep complete."
