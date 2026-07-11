import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const prismaCli = path.join(
  process.cwd(),
  "node_modules",
  "prisma",
  "build",
  "index.js",
);

const env = { ...process.env };
const directUrl = env.DIRECT_DATABASE_URL?.trim();

if (directUrl) {
  env.DATABASE_URL = directUrl;
  console.log("Using DIRECT_DATABASE_URL for Prisma CLI.");
} else {
  console.log("DIRECT_DATABASE_URL is not set; Prisma CLI will use DATABASE_URL.");
}

const result = spawnSync(process.execPath, [prismaCli, ...process.argv.slice(2)], {
  env,
  stdio: "inherit",
  shell: false,
});

if (result.error) {
  console.error(`Failed to start Prisma CLI: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
