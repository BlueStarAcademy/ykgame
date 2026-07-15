import { prisma } from "@/lib/prisma";
import { getRedisConfig } from "@/lib/redis-config";
import { shopBuffKey } from "@/lib/redis-keys";
import { runRedisCommand } from "@/lib/redis";
import { isShopItemId, type ShopItemId } from "./shopCatalog";

const GAME_ID = "yanmar";

/** Persist purchased buff — DB is source of truth; Redis is optional cache. */
export async function persistShopBuff(
  userId: string,
  itemId: ShopItemId,
  expiresAtMs: number,
): Promise<void> {
  const expiresAt = new Date(expiresAtMs);
  await prisma.userShopBuff.upsert({
    where: {
      userId_gameId_itemId: { userId, gameId: GAME_ID, itemId },
    },
    create: { userId, gameId: GAME_ID, itemId, expiresAt },
    update: { expiresAt },
  });

  const config = getRedisConfig();
  if (!config.enabled) return;
  const ttlMs = Math.max(1000, expiresAtMs - Date.now());
  await runRedisCommand("shop_buff_set", async (client) => {
    const key = shopBuffKey(config.prefix, userId);
    await client.hSet(key, itemId, String(expiresAtMs));
    const ttl = await client.pTTL(key);
    if (ttl < ttlMs) {
      await client.pExpire(key, ttlMs);
    }
  });
}

/** Active shop buff ids for reward/stats paths (DB primary). */
export async function loadActiveShopBuffIds(
  userId: string,
  now = Date.now(),
): Promise<ShopItemId[]> {
  const nowDate = new Date(now);
  const rows = await prisma.userShopBuff.findMany({
    where: {
      userId,
      gameId: GAME_ID,
      expiresAt: { gt: nowDate },
    },
    select: { itemId: true },
  });

  // Best-effort prune of expired rows
  void prisma.userShopBuff
    .deleteMany({
      where: { userId, gameId: GAME_ID, expiresAt: { lte: nowDate } },
    })
    .catch(() => undefined);

  const fromDb = rows
    .map((r) => r.itemId)
    .filter((id): id is ShopItemId => isShopItemId(id));

  if (fromDb.length > 0) return fromDb;

  // Fallback: Redis cache if DB empty (e.g. mid-migration client still using redis-only)
  const config = getRedisConfig();
  if (!config.enabled) return [];
  const result = await runRedisCommand("shop_buff_get", async (client) => {
    const key = shopBuffKey(config.prefix, userId);
    return client.hGetAll(key);
  });
  if (!result.available) return [];
  const active: ShopItemId[] = [];
  for (const [id, raw] of Object.entries(result.value)) {
    if (!isShopItemId(id)) continue;
    const expiresAt = Number(raw);
    if (!Number.isFinite(expiresAt) || expiresAt <= now) continue;
    active.push(id);
  }
  return active;
}
