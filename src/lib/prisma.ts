import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getDatabasePoolConfig } from "./database-pool-config";
import { getDatabaseUrl } from "./db-url";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: pg.Pool | undefined;
  dbUrl: string | undefined;
};

export type DatabasePoolStats = {
  initialized: boolean;
  total: number;
  idle: number;
  waiting: number;
  max: number;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
};

/** 현재 pool 상태만 읽으며 Prisma 또는 DB 연결을 초기화하지 않는다. */
export function getDatabasePoolStats(): DatabasePoolStats {
  const pool = globalForPrisma.pgPool;
  const config = getDatabasePoolConfig();
  if (!pool) {
    return {
      initialized: false,
      total: 0,
      idle: 0,
      waiting: 0,
      max: config.max,
      connectionTimeoutMs: config.connectionTimeoutMillis,
      idleTimeoutMs: config.idleTimeoutMillis,
    };
  }

  return {
    initialized: true,
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    max: pool.options.max ?? config.max,
    connectionTimeoutMs:
      pool.options.connectionTimeoutMillis ?? config.connectionTimeoutMillis,
    idleTimeoutMs: pool.options.idleTimeoutMillis ?? config.idleTimeoutMillis,
  };
}

function createPrismaClient(connectionString: string) {
  const poolConfig = getDatabasePoolConfig();
  const useSsl =
    connectionString.includes("proxy.rlwy.net") ||
    connectionString.includes("rlwy.net");

  const pool = new pg.Pool({
    connectionString,
    ...poolConfig,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  });

  globalForPrisma.pgPool = pool;
  globalForPrisma.dbUrl = connectionString;

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

function isStalePrismaClient(client: PrismaClient): boolean {
  const delegates = client as PrismaClient & {
    rewardEvent?: unknown;
    userMail?: unknown;
  };
  return delegates.userMail == null || delegates.rewardEvent == null;
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
