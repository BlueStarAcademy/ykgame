import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  resolveLoadEnv,
  validateLoadEnvironment,
} from "./load-config.mjs";

const smoke = process.argv.includes("--smoke");
const env = { ...process.env };

if (smoke) {
  env.K6_SMOKE = "true";
  env.K6_STAGE_DURATION ??= "5s";
  env.K6_SOAK_DURATION ??= "10s";
  env.K6_RAMP_DOWN_DURATION ??= "5s";
  env.K6_BURST_START_TIME ??= "5s";
  env.K6_BURST_DURATION ??= "10s";
  env.K6_THINK_TIME_SECONDS ??= "0.2";
}

try {
  validateLoadEnvironment(
    resolveLoadEnv(env, (path) => readFileSync(path, "utf8")),
  );
} catch (error) {
  console.error(`k6 preflight failed: ${error.message}`);
  process.exit(1);
}

// Do not forward multi-KB cookie JSON through the Windows environment block.
const k6Env = { ...env };
delete k6Env.K6_SESSION_COOKIES_JSON;

const result = spawnSync("k6", ["run", "scripts/load/mixed.js"], {
  cwd: process.cwd(),
  env: k6Env,
  shell: false,
  stdio: "inherit",
});

if (result.error) {
  console.error(`Unable to start k6: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
