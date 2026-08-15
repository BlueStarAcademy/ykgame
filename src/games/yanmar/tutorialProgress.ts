import type { GearSlot, ItemGrade } from "./gearCatalog";

export const TUTORIAL_STEP_IDS = [
  "travel",
  "boom",
  "arm",
  "swing",
  "bucket",
  "breaker",
  "grapple",
  "blade",
] as const;

export type TutorialStepId = (typeof TUTORIAL_STEP_IDS)[number];

/** Gear drop from early control tutorials. */
export type TutorialGearRewardDef = {
  kind: "gear";
  slot: GearSlot;
  grade: ItemGrade;
};

/** Currency / ticket / star grant. */
export type TutorialCurrencyRewardDef = {
  kind: "currency";
  stars?: number;
  enhanceCores?: number;
  gachaTicketsStandard?: number;
  gachaTicketsPremium?: number;
};

export type TutorialRewardDef =
  | TutorialGearRewardDef
  | TutorialCurrencyRewardDef;

export const TUTORIAL_REWARDS: Partial<
  Record<TutorialStepId, TutorialRewardDef>
> = {
  travel: { kind: "gear", slot: "TRACK", grade: "NORMAL" },
  boom: { kind: "gear", slot: "BOOM", grade: "NORMAL" },
  arm: { kind: "gear", slot: "ARM", grade: "NORMAL" },
  swing: { kind: "currency", stars: 100 },
  bucket: { kind: "gear", slot: "BUCKET", grade: "NORMAL" },
  breaker: { kind: "gear", slot: "BREAKER", grade: "ENHANCED" },
  grapple: { kind: "gear", slot: "GRAPPLE", grade: "PRECISION" },
  blade: { kind: "currency", stars: 300 },
};

export function hasTutorialReward(stepId: TutorialStepId): boolean {
  return Boolean(TUTORIAL_REWARDS[stepId]);
}

export function isGearTutorialReward(
  reward: TutorialRewardDef,
): reward is TutorialGearRewardDef {
  return reward.kind === "gear";
}

export function isCurrencyTutorialReward(
  reward: TutorialRewardDef,
): reward is TutorialCurrencyRewardDef {
  return reward.kind === "currency";
}

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

/**
 * 숫자 알림: 해금되어 실행 가능하고, 보상을 아직 수령하지 않은 튜토리얼 수.
 * 클리어 여부와 무관 — 잠긴 항목·수령 완료는 제외.
 */
export function countUnclaimedTutorialRewardNotices(
  state: YanmarTutorialState,
  unlockedStepIds: ReadonlySet<TutorialStepId>,
): number {
  const claimed = new Set(state.claimed);
  let count = 0;
  for (const stepId of TUTORIAL_STEP_IDS) {
    if (!TUTORIAL_REWARDS[stepId]) continue;
    if (!unlockedStepIds.has(stepId)) continue;
    if (claimed.has(stepId)) continue;
    count += 1;
  }
  return count;
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
