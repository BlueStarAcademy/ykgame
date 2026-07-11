export const DATABASE_POOL_LIMITS = {
  max: { defaultValue: 20, min: 5, max: 50 },
  connectionTimeoutMs: { defaultValue: 5_000, min: 1_000, max: 30_000 },
  idleTimeoutMs: { defaultValue: 30_000, min: 1_000, max: 300_000 },
} as const;

type IntegerRange = {
  defaultValue: number;
  min: number;
  max: number;
};

export function parseBoundedInteger(
  rawValue: string | undefined,
  range: IntegerRange,
): number {
  if (rawValue == null || rawValue.trim() === "") return range.defaultValue;

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return range.defaultValue;

  return Math.min(range.max, Math.max(range.min, Math.floor(parsed)));
}

export type DatabasePoolConfig = {
  max: number;
  connectionTimeoutMillis: number;
  idleTimeoutMillis: number;
};

export function getDatabasePoolConfig(
  env: Readonly<Partial<NodeJS.ProcessEnv>> = process.env,
): DatabasePoolConfig {
  return {
    max: parseBoundedInteger(env.DATABASE_POOL_MAX, DATABASE_POOL_LIMITS.max),
    connectionTimeoutMillis: parseBoundedInteger(
      env.DATABASE_POOL_CONNECTION_TIMEOUT_MS,
      DATABASE_POOL_LIMITS.connectionTimeoutMs,
    ),
    idleTimeoutMillis: parseBoundedInteger(
      env.DATABASE_POOL_IDLE_TIMEOUT_MS,
      DATABASE_POOL_LIMITS.idleTimeoutMs,
    ),
  };
}
