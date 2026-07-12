import {
  SHOP_ITEMS,
  type ShopItemId,
  isShopItemId,
} from "./shopCatalog";

const STORAGE_PREFIX = "ykgame:yanmar:shop-buffs:v1";
const LOCAL_OWNER = "local";

/** Remaining time at/below which icons fade slightly. */
export const SHOP_BUFF_FADE_REMAINING_MS = 10 * 60 * 1000;
/** Remaining time at/below which icons blink. */
export const SHOP_BUFF_BLINK_REMAINING_MS = 30 * 1000;

export type ActiveShopBuff = {
  id: ShopItemId;
  expiresAt: number;
};

function storageKey(ownerId: string) {
  return `${STORAGE_PREFIX}:${ownerId}`;
}

function isValidBuff(value: unknown): value is ActiveShopBuff {
  if (!value || typeof value !== "object") return false;
  const buff = value as Partial<ActiveShopBuff>;
  return (
    isShopItemId(buff.id) &&
    typeof buff.expiresAt === "number" &&
    Number.isFinite(buff.expiresAt)
  );
}

function catalogOrderIndex(id: ShopItemId) {
  return SHOP_ITEMS.findIndex((item) => item.id === id);
}

export function sortActiveShopBuffs(buffs: ActiveShopBuff[]): ActiveShopBuff[] {
  return [...buffs].sort(
    (a, b) => catalogOrderIndex(a.id) - catalogOrderIndex(b.id),
  );
}

export function pruneExpiredShopBuffs(
  buffs: ActiveShopBuff[],
  now = Date.now(),
): ActiveShopBuff[] {
  return sortActiveShopBuffs(buffs.filter((buff) => buff.expiresAt > now));
}

export function resolveShopBuffOwner(userId?: string | null) {
  return userId?.trim() ? userId : LOCAL_OWNER;
}

export function loadActiveShopBuffs(userId?: string | null): ActiveShopBuff[] {
  const ownerId = resolveShopBuffOwner(userId);
  try {
    const raw = window.localStorage.getItem(storageKey(ownerId));
    if (!raw) {
      if (ownerId === LOCAL_OWNER) return [];
      const local = loadActiveShopBuffs(LOCAL_OWNER);
      if (local.length > 0) saveActiveShopBuffs(ownerId, local);
      return local;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      window.localStorage.removeItem(storageKey(ownerId));
      return [];
    }
    const buffs = parsed.filter(isValidBuff);
    return pruneExpiredShopBuffs(buffs);
  } catch {
    return [];
  }
}

export function saveActiveShopBuffs(
  ownerId: string,
  buffs: ActiveShopBuff[],
) {
  try {
    window.localStorage.setItem(
      storageKey(ownerId),
      JSON.stringify(pruneExpiredShopBuffs(buffs)),
    );
  } catch {
    // Local persistence blocked — keep in-memory state only.
  }
}

/** Activate or refresh a buff timer from now. */
export function activateShopBuff(
  buffs: ActiveShopBuff[],
  id: ShopItemId,
  durationMs: number,
  now = Date.now(),
): ActiveShopBuff[] {
  const expiresAt = now + Math.max(0, durationMs);
  const next = buffs.filter((buff) => buff.id !== id);
  next.push({ id, expiresAt });
  return pruneExpiredShopBuffs(next, now);
}
