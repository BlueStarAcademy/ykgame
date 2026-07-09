#!/usr/bin/env node
import "dotenv/config";
import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { ensureAuthSecret } from "./ensure-auth-secret.mjs";

const port = process.env.PORT || "3000";
const host = "0.0.0.0";

function missingEnv(name) {
  const value = process.env[name];
  return !value || value.trim() === "";
}

function resolveDatabaseUrl() {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(npx, ["tsx", "scripts/resolve-db-url.ts"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    console.error(result.stderr || result.stdout || "Failed to resolve DATABASE_URL.");
    process.exit(1);
  }

  const url = result.stdout.trim();
  if (!url) {
    console.error("FATAL: DATABASE_URL resolver returned an empty value.");
    process.exit(1);
  }

  process.env.DATABASE_URL = url;

  try {
    const parsed = new URL(url);
    console.log(`Database host: ${parsed.hostname}:${parsed.port || "5432"}${parsed.pathname}`);
  } catch {
    console.log("Database URL resolved.");
  }
}

const hasDatabase =
  !missingEnv("DATABASE_URL") ||
  !missingEnv("DATABASE_PUBLIC_URL") ||
  !missingEnv("PGHOST");

if (!hasDatabase) {
  console.error("FATAL: DATABASE_URL is not set.");
  console.error("Railway → ykgame-web → Variables → Add Reference → Postgres → DATABASE_URL");
  process.exit(1);
}

resolveDatabaseUrl();
ensureAuthSecret();

if (process.env.RAILWAY_ENVIRONMENT) {
  process.env.AUTH_TRUST_HOST ??= "true";

  const domain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (domain && missingEnv("AUTH_URL")) {
    const authUrl = `https://${domain}`;
    process.env.AUTH_URL = authUrl;
    process.env.NEXTAUTH_URL ??= authUrl;
    console.log(`AUTH_URL set to ${authUrl}`);
  }
}

process.env.HOSTNAME = host;

console.log("YKGAME deploy rev: middleware-auth-fix-1");

console.log(`Starting Next.js on ${host}:${port}...`);

const nextBin = resolve(process.cwd(), "node_modules/next/dist/bin/next");

const child = spawn(process.execPath, [nextBin, "start", "-H", host, "-p", port], {
  stdio: "inherit",
  env: process.env,
});

child.on("error", (error) => {
  console.error("Failed to start Next.js:", error);
  process.exit(1);
});

child.on("exit", (code) => process.exit(code ?? 0));

