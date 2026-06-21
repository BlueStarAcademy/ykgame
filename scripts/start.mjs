#!/usr/bin/env node
const { spawn } = require("node:child_process");

const port = process.env.PORT || "3000";

if (!process.env.AUTH_URL && process.env.RAILWAY_PUBLIC_DOMAIN) {
  process.env.AUTH_URL = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
}

const child = spawn(
  "npx",
  ["next", "start", "-H", "0.0.0.0", "-p", port],
  { stdio: "inherit", shell: true, env: process.env },
);

child.on("exit", (code) => process.exit(code ?? 0));
