import { getQuestDayKey } from "../quests/questState";
import { WORKSHOP_DEFS, WORKSHOP_IDS } from "./catalog";
import type { WorkshopId, WorkshopQuestMetric } from "./types";

const STORAGE_PREFIX = "ykgame:yanmar:workshop-quests:v1";

export interface WorkshopQuestProgressItem {
  id: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
  /** Repeat quests only — how many times claimed this day cycle. */
  claimCount?: number;
}

export interface WorkshopQuestState {
  version: 1;
  dayKey: string;
  ownerId: string;
  byWorkshop: Record<WorkshopId, WorkshopQuestProgressItem[]>;
}

function storageKey(ownerId: string) {
  return `${STORAGE_PREFIX}:${ownerId}`;
}

function createItems(workshopId: WorkshopId): WorkshopQuestProgressItem[] {
  return WORKSHOP_DEFS[workshopId].quests.map((q) => ({
    id: q.id,
    progress: 0,
    completed: false,
    claimed: false,
    claimCount: 0,
  }));
}

export function createWorkshopQuestState(
  ownerId: string,
): WorkshopQuestState {
  return {
    version: 1,
    dayKey: getQuestDayKey(),
    ownerId,
    byWorkshop: {
      dump: createItems("dump"),
      crash: createItems("crash"),
      hill: createItems("hill"),
    },
  };
}

function normalizeState(
  raw: WorkshopQuestState | null,
  ownerId: string,
): WorkshopQuestState {
  const dayKey = getQuestDayKey();
  if (!raw || raw.ownerId !== ownerId || raw.dayKey !== dayKey) {
    return createWorkshopQuestState(ownerId);
  }
  const next = { ...raw, byWorkshop: { ...raw.byWorkshop } };
  for (const id of WORKSHOP_IDS) {
    const defs = WORKSHOP_DEFS[id].quests;
    const existing = next.byWorkshop[id] ?? [];
    const byId = new Map(existing.map((i) => [i.id, i]));
    next.byWorkshop[id] = defs.map((def) => {
      const prev = byId.get(def.id);
      if (prev) return prev;
      return {
        id: def.id,
        progress: 0,
        completed: false,
        claimed: false,
        claimCount: 0,
      };
    });
  }
  return next;
}

export function loadWorkshopQuestState(ownerId: string): WorkshopQuestState {
  if (typeof window === "undefined") {
    return createWorkshopQuestState(ownerId);
  }
  try {
    const raw = window.localStorage.getItem(storageKey(ownerId));
    if (!raw) return createWorkshopQuestState(ownerId);
    return normalizeState(JSON.parse(raw) as WorkshopQuestState, ownerId);
  } catch {
    return createWorkshopQuestState(ownerId);
  }
}

export function saveWorkshopQuestState(state: WorkshopQuestState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(state.ownerId), JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

export function applyWorkshopQuestMetric(
  state: WorkshopQuestState,
  metric: WorkshopQuestMetric,
  amount: number,
): WorkshopQuestState {
  if (!(amount > 0)) return state;
  let changed = false;
  const byWorkshop = { ...state.byWorkshop };

  for (const workshopId of WORKSHOP_IDS) {
    const defs = WORKSHOP_DEFS[workshopId].quests;
    const items = byWorkshop[workshopId].map((item) => {
      const def = defs.find((d) => d.id === item.id);
      if (!def || def.metric !== metric) return item;
      if (def.kind === "daily" && (item.claimed || item.completed)) return item;
      if (def.kind === "repeat" && item.completed && !item.claimed) return item;

      const progress = item.progress + amount;
      const completed = progress >= def.target;
      if (progress === item.progress && completed === item.completed) return item;
      changed = true;
      return {
        ...item,
        progress,
        completed,
        claimed: def.kind === "repeat" ? false : item.claimed,
      };
    });
    byWorkshop[workshopId] = items;
  }

  if (!changed) return state;
  return { ...state, byWorkshop };
}

export function markWorkshopQuestClaimed(
  state: WorkshopQuestState,
  workshopId: WorkshopId,
  questId: string,
): WorkshopQuestState {
  const def = WORKSHOP_DEFS[workshopId].quests.find((q) => q.id === questId);
  if (!def) return state;
  const items = state.byWorkshop[workshopId].map((item) => {
    if (item.id !== questId) return item;
    if (def.kind === "repeat") {
      return {
        ...item,
        progress: 0,
        completed: false,
        claimed: false,
        claimCount: (item.claimCount ?? 0) + 1,
      };
    }
    return { ...item, claimed: true, completed: true };
  });
  return {
    ...state,
    byWorkshop: { ...state.byWorkshop, [workshopId]: items },
  };
}

export function workshopHasClaimable(
  state: WorkshopQuestState,
  workshopId: WorkshopId,
): boolean {
  return countClaimableWorkshopQuests(state, workshopId) > 0;
}

export function countClaimableWorkshopQuests(
  state: WorkshopQuestState,
  workshopId: WorkshopId,
): number {
  const defs = WORKSHOP_DEFS[workshopId].quests;
  return state.byWorkshop[workshopId].filter((item) => {
    const def = defs.find((d) => d.id === item.id);
    if (!def) return false;
    return item.completed && !item.claimed;
  }).length;
}

export function getClaimableWorkshopIds(
  state: WorkshopQuestState,
): WorkshopId[] {
  return WORKSHOP_IDS.filter((id) => workshopHasClaimable(state, id));
}
