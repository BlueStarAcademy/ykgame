import type { MonumentPhase, MonumentQuestMetric } from "./types";
import {
  MONUMENT_BUILD_QUESTS,
  MONUMENT_DAILY_QUEST_COUNT,
  MONUMENT_QUEST_POOL,
  MONUMENT_REPEAT_ACTIVE_COUNT,
  MONUMENT_REPEAT_QUEST_POOL,
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
  /** KST day when monument became active; null until construction is claimed. */
  activeDayKey: string | null;
  build: Record<string, MonumentQuestProgressItem>;
  daily: MonumentQuestDef[];
  dailyProgress: Record<string, MonumentQuestProgressItem>;
  repeat: MonumentQuestDef[];
  repeatProgress: Record<string, MonumentQuestProgressItem>;
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

function emptyDailyProgress(
  daily: MonumentQuestDef[],
): Record<string, MonumentQuestProgressItem> {
  const out: Record<string, MonumentQuestProgressItem> = {};
  for (const q of daily) {
    out[q.id] = {
      id: q.id,
      progress: 0,
      completed: false,
      claimed: false,
    };
  }
  return out;
}

function emptyRepeatProgress(
  repeat: MonumentQuestDef[],
): Record<string, MonumentQuestProgressItem> {
  const out: Record<string, MonumentQuestProgressItem> = {};
  for (const q of repeat) {
    out[q.id] = {
      id: q.id,
      progress: 0,
      completed: false,
      claimed: false,
    };
  }
  return out;
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

function rollSingleRepeatQuest(
  ownerId: string,
  seed: string,
): MonumentQuestDef {
  const rand = mulberry32(hashSeed(`${ownerId}:${seed}:monument-repeat`));
  const pool = [...MONUMENT_REPEAT_QUEST_POOL];
  const idx = Math.floor(rand() * pool.length);
  const base = pool[idx]!;
  const id = `monument-repeat-${hashSeed(`${ownerId}:${seed}`).toString(36)}`;
  return { ...base, id, kind: "repeat" };
}

function rollRepeatQuests(ownerId: string, count: number): MonumentQuestDef[] {
  const quests: MonumentQuestDef[] = [];
  for (let i = 0; i < count; i++) {
    quests.push(rollSingleRepeatQuest(ownerId, `init-${i}`));
  }
  return quests;
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
  return {
    ownerId,
    dayKey: dayKeyKst(),
    activeDayKey: null,
    build: emptyBuildProgress(),
    daily: [],
    dailyProgress: {},
    repeat: [],
    repeatProgress: {},
  };
}

function trimRepeatQuests(state: MonumentQuestState): MonumentQuestState {
  if (state.repeat.length <= MONUMENT_REPEAT_ACTIVE_COUNT) return state;
  const kept = state.repeat.slice(0, MONUMENT_REPEAT_ACTIVE_COUNT);
  const keptIds = new Set(kept.map((q) => q.id));
  const repeatProgress: Record<string, MonumentQuestProgressItem> = {};
  for (const id of keptIds) {
    const item = state.repeatProgress[id];
    if (item) repeatProgress[id] = item;
  }
  return { ...state, repeat: kept, repeatProgress };
}

function normalizeMonumentQuestState(
  parsed: MonumentQuestState,
  ownerId: string,
): MonumentQuestState {
  if (!parsed.build) parsed.build = emptyBuildProgress();
  if (!parsed.daily) parsed.daily = [];
  if (!parsed.dailyProgress) parsed.dailyProgress = {};
  if (!parsed.repeat) parsed.repeat = [];
  if (!parsed.repeatProgress) parsed.repeatProgress = {};
  if (parsed.activeDayKey === undefined) parsed.activeDayKey = null;

  if (!parsed.activeDayKey) {
    parsed.daily = [];
    parsed.dailyProgress = {};
    parsed.repeat = [];
    parsed.repeatProgress = {};
  }

  parsed.ownerId = ownerId;
  return trimRepeatQuests(parsed);
}

export function loadMonumentQuestState(ownerId: string): MonumentQuestState {
  if (typeof window === "undefined") return createMonumentQuestState(ownerId);
  try {
    const raw = window.localStorage.getItem(storageKey(ownerId));
    if (!raw) return createMonumentQuestState(ownerId);
    const before = JSON.parse(raw) as MonumentQuestState;
    const parsed = normalizeMonumentQuestState(before, ownerId);
    if (!parsed || parsed.ownerId !== ownerId) {
      return createMonumentQuestState(ownerId);
    }
    if ((before.repeat?.length ?? 0) > MONUMENT_REPEAT_ACTIVE_COUNT) {
      saveMonumentQuestState(parsed);
    }
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

/** Activate daily + repeat quests when monument construction is claimed. */
export function activateMonumentQuests(
  state: MonumentQuestState,
): MonumentQuestState {
  const today = dayKeyKst();
  const daily = rollDailyQuests(today, state.ownerId);
  const repeat = rollRepeatQuests(
    state.ownerId,
    MONUMENT_REPEAT_ACTIVE_COUNT,
  );
  return {
    ...state,
    dayKey: today,
    activeDayKey: today,
    daily,
    dailyProgress: emptyDailyProgress(daily),
    repeat,
    repeatProgress: emptyRepeatProgress(repeat),
  };
}

/** Sync quest state when monument is active — handles day rollover and migration. */
export function ensureMonumentQuestsForPhase(
  state: MonumentQuestState,
  phase: MonumentPhase,
): MonumentQuestState {
  if (phase !== "active") return state;
  if (!state.activeDayKey) return activateMonumentQuests(state);

  const trimmed = trimRepeatQuests(state);
  const today = dayKeyKst();
  if (trimmed.dayKey === today) return trimmed;

  const daily = rollDailyQuests(today, trimmed.ownerId);
  return {
    ...trimmed,
    dayKey: today,
    daily,
    dailyProgress: emptyDailyProgress(daily),
  };
}

export function pushMonumentQuestProgress(
  state: MonumentQuestState,
  metric: MonumentQuestMetric,
  amount: number,
  monumentActive: boolean,
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

  if (!monumentActive || !state.activeDayKey) {
    if (!changed) return state;
    return { ...state, build };
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

  const repeatProgress = { ...state.repeatProgress };
  for (const q of state.repeat) {
    if (q.metric !== metric) continue;
    const item = repeatProgress[q.id];
    if (!item || item.completed) continue;
    const progress = Math.min(q.target, item.progress + amount);
    repeatProgress[q.id] = {
      ...item,
      progress,
      completed: progress >= q.target,
    };
    changed = true;
  }

  if (!changed) return state;
  return { ...state, build, dailyProgress, repeatProgress };
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

export function claimMonumentRepeatQuest(
  state: MonumentQuestState,
  questId: string,
): MonumentQuestState | null {
  const quest = state.repeat.find((q) => q.id === questId);
  const item = state.repeatProgress[questId];
  if (!quest || !item || !item.completed) return null;

  const newQuest = rollSingleRepeatQuest(
    state.ownerId,
    `${questId}:${Date.now()}`,
  );
  const repeat = state.repeat.map((q) =>
    q.id === questId ? newQuest : q,
  );
  const repeatProgress = { ...state.repeatProgress };
  delete repeatProgress[questId];
  repeatProgress[newQuest.id] = {
    id: newQuest.id,
    progress: 0,
    completed: false,
    claimed: false,
  };
  return { ...state, repeat, repeatProgress };
}

export function areBuildQuestsComplete(state: MonumentQuestState): boolean {
  return MONUMENT_BUILD_QUESTS.every((q) => state.build[q.id]?.completed);
}

export function isInMonumentRange(posX: number, posZ: number): boolean {
  const dx = posX - MONUMENT_SIGN.x;
  const dz = posZ - MONUMENT_SIGN.z;
  return dx * dx + dz * dz <= MONUMENT_SIGN.radius * MONUMENT_SIGN.radius;
}
