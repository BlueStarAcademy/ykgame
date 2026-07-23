import type { SportsMeetMissionBalance } from "./missionBalance";
import type { SportsMeetPattern, SportsMeetStageKind } from "./patterns";

export type SportsMeetPlayMode = "ranked" | "practice";

export type SportsMeetRunPhase =
  | "idle"
  | "ready"
  | "countdown"
  | "racing"
  | "finished";

export type SportsMeetCourseStar = {
  id: string;
  x: number;
  y: number;
  z: number;
  collected: boolean;
};

export type SportsMeetSpeedBuffPickup = {
  id: string;
  x: number;
  y: number;
  z: number;
  collected: boolean;
};

export type SportsMeetSplit = {
  stage: SportsMeetStageKind;
  clearTimeMs: number;
};

export type SportsMeetRunState = {
  playMode: SportsMeetPlayMode;
  weekKey: string;
  patternId: number;
  patternNameKo: string;
  stageOrder: readonly SportsMeetStageKind[];
  mission: SportsMeetMissionBalance;
  phase: SportsMeetRunPhase;
  stageIndex: number;
  /** Wall-clock ms when racing started (after countdown). */
  raceStartedAtMs: number;
  /** Elapsed ms frozen at finish. */
  finalTimeMs: number;
  countdownEndsAtMs: number;
  courseStars: SportsMeetCourseStar[];
  speedBuffs: SportsMeetSpeedBuffPickup[];
  starsCollected: number;
  dumpFillUnits: number;
  dumpDeparted: boolean;
  asphaltBroken: number;
  rocksDumped: number;
  splits: SportsMeetSplit[];
  runId: string | null;
  speedBuffUntilMs: number;
};

export function createInitialSportsMeetRunState(
  playMode: SportsMeetPlayMode,
  pattern: SportsMeetPattern,
  mission: SportsMeetMissionBalance,
  weekKey: string,
): SportsMeetRunState {
  return {
    playMode,
    weekKey,
    patternId: pattern.id,
    patternNameKo: pattern.nameKo,
    stageOrder: pattern.stageOrder,
    mission,
    phase: "ready",
    stageIndex: 0,
    raceStartedAtMs: 0,
    finalTimeMs: 0,
    countdownEndsAtMs: 0,
    courseStars: [],
    speedBuffs: [],
    starsCollected: 0,
    dumpFillUnits: 0,
    dumpDeparted: false,
    asphaltBroken: 0,
    rocksDumped: 0,
    splits: [],
    runId: null,
    speedBuffUntilMs: 0,
  };
}

export function currentSportsStage(
  state: SportsMeetRunState,
): SportsMeetStageKind | null {
  if (state.phase !== "racing" && state.phase !== "countdown") {
    if (state.phase === "ready") return state.stageOrder[0] ?? null;
  }
  return state.stageOrder[state.stageIndex] ?? null;
}
