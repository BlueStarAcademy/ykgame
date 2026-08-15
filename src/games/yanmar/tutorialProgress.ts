import type { GearSlot, ItemGrade } from "./gearCatalog";

export const TUTORIAL_STEP_IDS = [
  "travel",
  "boom",
  "arm",
  "bucket",
  "breaker",
  "grapple",
  "gearDismantle",
  "gearEnhance",
  "gearSynth",
] as const;

export type TutorialStepId = (typeof TUTORIAL_STEP_IDS)[number];

export interface TutorialRewardDef {
  slot: GearSlot;
  grade: ItemGrade;
}

export const TUTORIAL_REWARDS: Partial<
  Record<TutorialStepId, TutorialRewardDef>
> = {
  travel: { slot: "TRACK", grade: "NORMAL" },
  boom: { slot: "BOOM", grade: "NORMAL" },
  arm: { slot: "ARM", grade: "NORMAL" },
  bucket: { slot: "BUCKET", grade: "NORMAL" },
  breaker: { slot: "BREAKER", grade: "ENHANCED" },
  grapple: { slot: "GRAPPLE", grade: "PRECISION" },
};

export interface YanmarTutorialState {
  introDone: boolean;
  completed: TutorialStepId[];
  claimed: TutorialStepId[];
  seenNew: TutorialStepId[];
}

export const EMPTY_YANMAR_TUTORIAL: YanmarTutorialState = {
  introDone: false,
  completed: [],
  claimed: [],
  seenNew: [],
};

function asIdList(value: unknown): TutorialStepId[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(TUTORIAL_STEP_IDS);
  const out: TutorialStepId[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string" || !allowed.has(item) || seen.has(item)) {
      continue;
    }
    seen.add(item);
    out.push(item as TutorialStepId);
  }
  return out;
}

export function parseYanmarTutorialState(
  raw: unknown,
): YanmarTutorialState {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_YANMAR_TUTORIAL };
  }
  const rec = raw as Record<string, unknown>;
  return {
    introDone: rec.introDone === true,
    completed: asIdList(rec.completed),
    claimed: asIdList(rec.claimed),
    seenNew: asIdList(rec.seenNew),
  };
}

export function withCompletedStep(
  state: YanmarTutorialState,
  stepId: TutorialStepId,
): YanmarTutorialState {
  if (state.completed.includes(stepId)) return state;
  return { ...state, completed: [...state.completed, stepId] };
}

export function withClaimedStep(
  state: YanmarTutorialState,
  stepId: TutorialStepId,
): YanmarTutorialState {
  if (state.claimed.includes(stepId)) return state;
  return { ...state, claimed: [...state.claimed, stepId] };
}

export function withSeenNew(
  state: YanmarTutorialState,
  ids: readonly TutorialStepId[],
): YanmarTutorialState {
  const next = new Set(state.seenNew);
  let changed = false;
  for (const id of ids) {
    if (!next.has(id)) {
      next.add(id);
      changed = true;
    }
  }
  if (!changed) return state;
  return { ...state, seenNew: [...next] };
}

export function grandfatherIntroIfPlayed(
  state: YanmarTutorialState,
  totalXp: number,
): YanmarTutorialState {
  if (state.introDone || totalXp <= 0) return state;
  return { ...state, introDone: true };
}

/** Completed steps with a reward that has not been claimed yet. */
export function countClaimableTutorialRewards(
  state: YanmarTutorialState,
): number {
  const claimed = new Set(state.claimed);
  let count = 0;
  for (const stepId of state.completed) {
    if (!TUTORIAL_REWARDS[stepId] || claimed.has(stepId)) continue;
    count += 1;
  }
  return count;
}
