#!/usr/bin/env node
import "dotenv/config";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { ensureAuthSecret } from "./ensure-auth-secret.mjs";

ensureAuthSecret({ fatal: false });

if (!process.env.AUTH_SECRET?.trim()) {
  console.error("FATAL: AUTH_SECRET is not set.");
  console.error("");
  console.error("Add to .env:");
  console.error('  AUTH_SECRET="local-dev-secret"');
  console.error("");
  console.error("Or set DATABASE_PUBLIC_URL / DATABASE_URL so a dev secret can be derived.");
  process.exit(1);
}

const nextBin = resolve(process.cwd(), "node_modules/next/dist/bin/next");
const args = process.argv.slice(2);
const child = spawn(process.execPath, [nextBin, "dev", ...args], {
  stdio: "inherit",
  env: process.env,
});

child.on("error", (error) => {
  console.error("Failed to start Next.js dev server:", error);
  process.exit(1);
});

child.on("exit", (code) => process.exit(code ?? 0));
