import { createClient } from "redis";
import { getRedisConfig } from "@/lib/redis-config";

type Client = ReturnType<typeof createClient>;
type RedisRuntime = {
  client?: Client;
  connectPromise?: Promise<Client | null>;
  lastErrorAt?: number;
  errorCount: number;
};

export type RedisState = {
  enabled: boolean;
  status: "disabled" | "idle" | "connecting" | "open" | "ready";
  errorCount: number;
  lastErrorAt?: number;
};

export type RedisCommandResult<T> =
  | { available: true; value: T }
  | { available: false };

const globalRedis = globalThis as typeof globalThis & {
  __ykgameRedisRuntime?: RedisRuntime;
};
const runtime =
  globalRedis.__ykgameRedisRuntime ??
  (globalRedis.__ykgameRedisRuntime = { errorCount: 0 });

function errorMetadata(error: unknown) {
  const candidate = error as { name?: unknown; code?: unknown };
  return {
    errorName:
      typeof candidate?.name === "string" ? candidate.name.slice(0, 64) : "Error",
    errorCode:
      typeof candidate?.code === "string"
        ? candidate.code.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64)
        : undefined,
  };
}

function logRedisError(operation: string, error: unknown): void {
  runtime.errorCount += 1;
  runtime.lastErrorAt = Date.now();
  console.warn(
    JSON.stringify({
      event: "redis_error",
      operation,
      ...errorMetadata(error),
    }),
  );
}

function timeoutAfter<T>(ms: number, label: string): Promise<T> {
  return new Promise((_, reject) => {
    const timer = setTimeout(() => {
      const error = new Error(label);
      error.name = "RedisTimeoutError";
      reject(error);
    }, ms);
    timer.unref?.();
  });
}

function destroyClient(client: Client): void {
  try {
    client.destroy();
  } catch {
    // Already closed.
  }
  if (runtime.client === client) runtime.client = undefined;
}

async function connectRedis(): Promise<Client | null> {
  const config = getRedisConfig();
  if (!config.enabled || !config.url) return null;
  if (runtime.client?.isReady) return runtime.client;
  if (runtime.connectPromise) return runtime.connectPromise;

  const client =
    runtime.client ??
    createClient({
      url: config.url,
      disableOfflineQueue: true,
      socket: {
        connectTimeout: config.connectTimeoutMs,
        reconnectStrategy(retries) {
          if (retries >= config.reconnectAttempts) return false;
          return Math.min(50 * 2 ** retries, 500);
        },
      },
    });
  runtime.client = client;
  client.on("error", (error) => logRedisError("client", error));

  const connecting = (async () => {
    try {
      await Promise.race([
        client.connect(),
        timeoutAfter(config.connectTimeoutMs, "Redis connect timed out"),
      ]);
      return client.isReady ? client : null;
    } catch (error) {
      logRedisError("connect", error);
      destroyClient(client);
      return null;
    } finally {
      runtime.connectPromise = undefined;
    }
  })();
  runtime.connectPromise = connecting;
  return connecting;
}

export async function runRedisCommand<T>(
  operation: string,
  command: (client: Client) => Promise<T>,
): Promise<RedisCommandResult<T>> {
  const config = getRedisConfig();
  if (!config.enabled) return { available: false };
  const client = await connectRedis();
  if (!client) return { available: false };

  try {
    const value = await Promise.race([
      command(client),
      timeoutAfter<T>(config.commandTimeoutMs, "Redis command timed out"),
    ]);
    return { available: true, value };
  } catch (error) {
    logRedisError(operation, error);
    destroyClient(client);
    return { available: false };
  }
}

export function getRedisState(): RedisState {
  const config = getRedisConfig();
  if (!config.enabled) {
    return {
      enabled: false,
      status: "disabled",
      errorCount: runtime.errorCount,
      ...(runtime.lastErrorAt ? { lastErrorAt: runtime.lastErrorAt } : {}),
    };
  }
  const client = runtime.client;
  return {
    enabled: true,
    status: runtime.connectPromise
      ? "connecting"
      : client?.isReady
        ? "ready"
        : client?.isOpen
          ? "open"
          : "idle",
    errorCount: runtime.errorCount,
    ...(runtime.lastErrorAt ? { lastErrorAt: runtime.lastErrorAt } : {}),
  };
}

export async function closeRedis(): Promise<void> {
  const client = runtime.client;
  runtime.client = undefined;
  runtime.connectPromise = undefined;
  if (!client) return;
  try {
    if (client.isOpen) {
      await client.close();
    } else {
      destroyClient(client);
    }
  } catch {
    destroyClient(client);
  }
}
