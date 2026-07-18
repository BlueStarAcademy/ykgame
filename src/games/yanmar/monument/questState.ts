import type { MonumentQuestMetric } from "./types";
import {
  MONUMENT_BUILD_QUESTS,
  MONUMENT_DAILY_QUEST_COUNT,
  MONUMENT_QUEST_POOL,
  MONUMENT_SIGN,
} from "./catalog";
import type { MonumentQuestDef } from "./types";

const STORAGE_PREFIX = "ykgame:yanmar:monument-quests:v1";

function dayKeyKst(now = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface MonumentQuestProgressItem {
  id: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

export interface MonumentQuestState {
  ownerId: string;
  dayKey: string;
  build: Record<string, MonumentQuestProgressItem>;
  daily: MonumentQuestDef[];
  dailyProgress: Record<string, MonumentQuestProgressItem>;
}

function storageKey(ownerId: string) {
  return `${STORAGE_PREFIX}:${ownerId}`;
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rollDailyQuests(dayKey: string, ownerId: string): MonumentQuestDef[] {
  const rand = mulberry32(hashSeed(`${dayKey}:${ownerId}:monument`));
  const pool = [...MONUMENT_QUEST_POOL];
  const picked: MonumentQuestDef[] = [];
  for (let i = 0; i < MONUMENT_DAILY_QUEST_COUNT && pool.length > 0; i++) {
    const idx = Math.floor(rand() * pool.length);
    const base = pool.splice(idx, 1)[0]!;
    picked.push({
      ...base,
      id: `monument-daily-${dayKey}-${i}-${base.metric}`,
    });
  }
  return picked;
}

function emptyBuildProgress(): Record<string, MonumentQuestProgressItem> {
  const out: Record<string, MonumentQuestProgressItem> = {};
  for (const q of MONUMENT_BUILD_QUESTS) {
    out[q.id] = {
      id: q.id,
      progress: 0,
      completed: false,
      claimed: false,
    };
  }
  return out;
}

export function createMonumentQuestState(ownerId: string): MonumentQuestState {
  const dayKey = dayKeyKst();
  const daily = rollDailyQuests(dayKey, ownerId);
  const dailyProgress: Record<string, MonumentQuestProgressItem> = {};
  for (const q of daily) {
    dailyProgress[q.id] = {
      id: q.id,
      progress: 0,
      completed: false,
      claimed: false,
    };
  }
  return {
    ownerId,
    dayKey,
    build: emptyBuildProgress(),
    daily,
    dailyProgress,
  };
}

export function loadMonumentQuestState(ownerId: string): MonumentQuestState {
  if (typeof window === "undefined") return createMonumentQuestState(ownerId);
  try {
    const raw = window.localStorage.getItem(storageKey(ownerId));
    if (!raw) return createMonumentQuestState(ownerId);
    const parsed = JSON.parse(raw) as MonumentQuestState;
    if (!parsed || parsed.ownerId !== ownerId) {
      return createMonumentQuestState(ownerId);
    }
    const today = dayKeyKst();
    if (parsed.dayKey !== today) {
      const next = createMonumentQuestState(ownerId);
      next.build = parsed.build ?? emptyBuildProgress();
      return next;
    }
    if (!parsed.build) parsed.build = emptyBuildProgress();
    return parsed;
  } catch {
    return createMonumentQuestState(ownerId);
  }
}

export function saveMonumentQuestState(state: MonumentQuestState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(state.ownerId), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function pushMonumentQuestProgress(
  state: MonumentQuestState,
  metric: MonumentQuestMetric,
  amount: number,
): MonumentQuestState {
  if (amount <= 0) return state;
  let changed = false;
  const build = { ...state.build };
  for (const q of MONUMENT_BUILD_QUESTS) {
    if (q.metric !== metric) continue;
    const item = build[q.id];
    if (!item || item.completed) continue;
    const progress = Math.min(q.target, item.progress + amount);
    build[q.id] = {
      ...item,
      progress,
      completed: progress >= q.target,
    };
    changed = true;
  }

  const dailyProgress = { ...state.dailyProgress };
  for (const q of state.daily) {
    if (q.metric !== metric) continue;
    const item = dailyProgress[q.id];
    if (!item || item.completed || item.claimed) continue;
    const progress = Math.min(q.target, item.progress + amount);
    dailyProgress[q.id] = {
      ...item,
      progress,
      completed: progress >= q.target,
    };
    changed = true;
  }

  if (!changed) return state;
  return { ...state, build, dailyProgress };
}

export function markMonumentDailyClaimed(
  state: MonumentQuestState,
  questId: string,
): MonumentQuestState {
  const item = state.dailyProgress[questId];
  if (!item) return state;
  return {
    ...state,
    dailyProgress: {
      ...state.dailyProgress,
      [questId]: { ...item, claimed: true },
    },
  };
}

export function areBuildQuestsComplete(state: MonumentQuestState): boolean {
  return MONUMENT_BUILD_QUESTS.every((q) => state.build[q.id]?.completed);
}

export function isInMonumentRange(posX: number, posZ: number): boolean {
  const dx = posX - MONUMENT_SIGN.x;
  const dz = posZ - MONUMENT_SIGN.z;
  return dx * dx + dz * dz <= MONUMENT_SIGN.radius * MONUMENT_SIGN.radius;
}
