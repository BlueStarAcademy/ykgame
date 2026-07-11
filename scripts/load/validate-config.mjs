import { validateLoadEnvironment } from "./load-config.mjs";

try {
  const config = validateLoadEnvironment(process.env);
  console.log(
    `k6 preflight passed: target=${config.baseUrl}, authenticatedSessions=${config.cookies.length}`,
  );
} catch (error) {
  console.error(`k6 preflight failed: ${error.message}`);
  process.exitCode = 1;
}
