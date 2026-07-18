#!/usr/bin/env node
/**
 * One-shot helper: resolve a failed Prisma migration using DATABASE_PUBLIC_URL
 * when private DATABASE_URL is unreachable from the local machine.
 *
 * Usage:
 *   railway run -s Postgres -e staging -- node scripts/resolve-failed-migration.mjs 20260715190000_gear_inventory_base_40
 */
import { spawnSync } from "node:child_process";

const migration = process.argv[2];
if (!migration) {
  console.error("Usage: node scripts/resolve-failed-migration.mjs <migration_name>");
  process.exit(1);
}

const publicUrl = process.env.DATABASE_PUBLIC_URL?.trim();
const directUrl = process.env.DIRECT_DATABASE_URL?.trim();
const databaseUrl = process.env.DATABASE_URL?.trim();
const url = publicUrl || directUrl || databaseUrl;
if (!url) {
  console.error("No DATABASE_PUBLIC_URL / DIRECT_DATABASE_URL / DATABASE_URL available.");
  process.exit(1);
}

const env = {
  ...process.env,
  DATABASE_URL: url,
  DIRECT_DATABASE_URL: url,
};

const result = spawnSync(
  "npx",
  ["prisma", "migrate", "resolve", "--rolled-back", migration],
  { stdio: "inherit", env, shell: process.platform === "win32" },
);
process.exit(result.status ?? 1);
