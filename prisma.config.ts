import "dotenv/config";
import { defineConfig } from "prisma/config";
import { getDatabaseUrl } from "./src/lib/db-url";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // prisma generate는 DB 연결 불필요 — placeholder 허용
    url: getDatabaseUrl({ required: false }),
  },
});
