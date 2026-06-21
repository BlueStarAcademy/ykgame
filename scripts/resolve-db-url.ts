import "dotenv/config";
import { getDatabaseUrl } from "../src/lib/db-url";

try {
  process.stdout.write(getDatabaseUrl({ required: true }));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
