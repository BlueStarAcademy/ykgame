import { WORKSHOP_UPGRADE_COSTS_MAX10 } from "../workshop/economy";
import {
  MONUMENT_BASE_INTERVAL_MS,
  MONUMENT_BASE_STORAGE,
  MONUMENT_MIN_INTERVAL_MS,
  MONUMENT_SPEED_REDUCTION_SEC,
  MONUMENT_STORAGE_BONUS,
  type MonumentUpgradeKey,
} from "./types";

export function getMonumentUpgradeCost(
  _upgradeKey: MonumentUpgradeKey,
  currentLevel: number,
): number | null {
  if (currentLevel < 0 || currentLevel >= WORKSHOP_UPGRADE_COSTS_MAX10.length) {
    return null;
  }
  return WORKSHOP_UPGRADE_COSTS_MAX10[currentLevel]!;
}

export function monumentStorageCap(storageLevel: number): number {
  let cap = MONUMENT_BASE_STORAGE;
  const lv = Math.max(0, Math.min(10, Math.floor(storageLevel)));
  for (let i = 0; i < lv; i++) {
    cap += MONUMENT_STORAGE_BONUS[i]!;
  }
  return cap;
}

export function monumentIntervalMs(speedLevel: number): number {
  let ms = MONUMENT_BASE_INTERVAL_MS;
  const lv = Math.max(0, Math.min(10, Math.floor(speedLevel)));
  for (let i = 0; i < lv; i++) {
    ms -= MONUMENT_SPEED_REDUCTION_SEC[i]! * 1000;
  }
  return Math.max(MONUMENT_MIN_INTERVAL_MS, ms);
}

export function computeProducedStars(opts: {
  stored: number;
  storageLevel: number;
  speedLevel: number;
  prodUpdatedAt: Date | null;
  now?: Date;
}): { stored: number; produced: number; nextUpdatedAt: Date } {
  const now = opts.now ?? new Date();
  const cap = monumentStorageCap(opts.storageLevel);
  const interval = monumentIntervalMs(opts.speedLevel);
  if (!opts.prodUpdatedAt || opts.stored >= cap) {
    return {
      stored: Math.min(cap, opts.stored),
      produced: 0,
      nextUpdatedAt: opts.prodUpdatedAt ?? now,
    };
  }
  const elapsed = now.getTime() - opts.prodUpdatedAt.getTime();
  if (elapsed < interval) {
    return {
      stored: opts.stored,
      produced: 0,
      nextUpdatedAt: opts.prodUpdatedAt,
    };
  }
  const ticks = Math.floor(elapsed / interval);
  const room = Math.max(0, cap - opts.stored);
  const produced = Math.min(room, ticks);
  const consumedMs = produced * interval;
  return {
    stored: opts.stored + produced,
    produced,
    nextUpdatedAt: new Date(opts.prodUpdatedAt.getTime() + consumedMs),
  };
}
