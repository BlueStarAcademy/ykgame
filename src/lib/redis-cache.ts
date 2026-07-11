import { runRedisCommand } from "@/lib/redis";

export type RedisCacheRead<T> =
  | { available: false }
  | { available: true; hit: false }
  | { available: true; hit: true; value: T };

export async function readRedisJson<T>(
  key: string,
  validate: (value: unknown) => value is T,
): Promise<RedisCacheRead<T>> {
  const result = await runRedisCommand("cache_get", (client) => client.get(key));
  if (!result.available) return { available: false };
  if (result.value == null) return { available: true, hit: false };
  try {
    const parsed: unknown = JSON.parse(result.value);
    if (validate(parsed)) return { available: true, hit: true, value: parsed };
  } catch {
    // Treat malformed or stale-schema cache entries as misses.
  }
  await deleteRedisKeys(key);
  return { available: true, hit: false };
}

export async function writeRedisJson(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<boolean> {
  let serialized: string;
  try {
    const encoded = JSON.stringify(value);
    if (typeof encoded !== "string") return false;
    serialized = encoded;
  } catch {
    return false;
  }
  const result = await runRedisCommand("cache_set", (client) =>
    client.set(key, serialized, { EX: ttlSeconds }),
  );
  return result.available;
}

export async function deleteRedisKeys(...keys: string[]): Promise<boolean> {
  if (keys.length === 0) return true;
  const result = await runRedisCommand("cache_delete", (client) =>
    client.del(keys),
  );
  return result.available;
}
