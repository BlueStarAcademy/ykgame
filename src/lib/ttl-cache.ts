/** Process-local TTL cache for hot read paths (single-instance Railway). */
export function createTtlCache<T>(ttlMs: number) {
  const store = new Map<string, { value: T; expiresAt: number }>();

  return {
    get(key: string): T | undefined {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key: string, value: T) {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    },
    delete(key: string) {
      store.delete(key);
    },
  };
}
