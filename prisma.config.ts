import "dotenv/config";
import { defineConfig } from "prisma/config";

function resolveDatabaseUrl(): string {
  const internal = process.env.DATABASE_URL;
  const publicUrl = process.env.DATABASE_PUBLIC_URL;
  const onRailway = Boolean(process.env.RAILWAY_ENVIRONMENT);

  if (onRailway && internal) return internal;
  if (publicUrl) return publicUrl;
  if (internal && !internal.includes("railway.internal")) return internal;
  return internal ?? "";
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: resolveDatabaseUrl(),
  },
});
