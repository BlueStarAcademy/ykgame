import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getDatabaseUrl } from "./db-url";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: pg.Pool | undefined;
  dbUrl: string | undefined;
};

function createPrismaClient(connectionString: string) {
  const useSsl =
    connectionString.includes("proxy.rlwy.net") ||
    connectionString.includes("rlwy.net");

  const pool = new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  });

  globalForPrisma.pgPool = pool;
  globalForPrisma.dbUrl = connectionString;

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

function isStalePrismaClient(client: PrismaClient): boolean {
  const delegate = (client as PrismaClient & { userMail?: unknown }).userMail;
  return delegate == null;
}

function getPrismaClient(): PrismaClient {
  const connectionString = getDatabaseUrl({ required: true });

  if (
    globalForPrisma.prisma &&
    globalForPrisma.dbUrl === connectionString &&
    !isStalePrismaClient(globalForPrisma.prisma)
  ) {
    return globalForPrisma.prisma;
  }

  if (globalForPrisma.pgPool) {
    void globalForPrisma.pgPool.end();
  }

  globalForPrisma.prisma = createPrismaClient(connectionString);
  return globalForPrisma.prisma;
}

/** 빌드 시점 import만으로 DB 연결을 시도하지 않도록 지연 초기화 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});
