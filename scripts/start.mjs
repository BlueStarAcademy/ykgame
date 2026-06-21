#!/usr/bin/env node
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { ensureAuthSecret } from "./ensure-auth-secret.mjs";

const port = process.env.PORT || "3000";
const host = "0.0.0.0";

function missingEnv(name) {
  const value = process.env[name];
  return !value || value.trim() === "";
}

ensureAuthSecret();

const hasDatabase =
  !missingEnv("DATABASE_URL") ||
  !missingEnv("DATABASE_PUBLIC_URL") ||
  !missingEnv("PGHOST");

if (!hasDatabase) {
  console.error("FATAL: DATABASE_URL is not set.");
  console.error("Railway → ykgame-web → Variables → Add Reference → Postgres → DATABASE_URL");
  process.exit(1);
}

if (process.env.RAILWAY_ENVIRONMENT) {
  process.env.AUTH_TRUST_HOST ??= "true";
}

process.env.HOSTNAME = host;

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
