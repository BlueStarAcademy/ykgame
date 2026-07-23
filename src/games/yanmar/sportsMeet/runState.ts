import {
  buildCourseStars,
  buildSpeedBuffPickups,
  distanceXZ,
  SPORTS_MEET_COUNTDOWN_MS,
  SPORTS_MEET_PICKUP_RADIUS,
  SPORTS_MEET_SPEED_BUFF_MS,
} from "./coursePickups";
import {
  getSportsMeetMissionForWeek,
  getSportsMeetPattern,
  type SportsMeetPattern,
  type SportsMeetStageKind,
} from "./patterns";
import type { SportsMeetMissionBalance } from "./missionBalance";
import {
  createInitialSportsMeetRunState,
  type SportsMeetPlayMode,
  type SportsMeetRunState,
  type SportsMeetSplit,
} from "./types";

export function beginSportsMeetRun(
  playMode: SportsMeetPlayMode,
  weekKey: string,
  heightAt: (x: number, z: number) => number,
  runId: string | null,
): SportsMeetRunState {
  const pattern = getSportsMeetPattern(weekKey);
  const mission = getSportsMeetMissionForWeek(weekKey);
  const state = createInitialSportsMeetRunState(
    playMode,
    pattern,
    mission,
    weekKey,
  );
  state.runId = runId;
  state.courseStars = buildCourseStars(pattern.drivePath, mission, heightAt);
  state.speedBuffs = buildSpeedBuffPickups(
    pattern.drivePath,
    mission,
    heightAt,
  );
  return state;
}

export function startSportsMeetCountdown(
  state: SportsMeetRunState,
  now = Date.now(),
): SportsMeetRunState {
  return {
    ...state,
    phase: "countdown",
    countdownEndsAtMs: now + SPORTS_MEET_COUNTDOWN_MS,
  };
}

export function tickSportsMeetCountdown(
  state: SportsMeetRunState,
  now = Date.now(),
): SportsMeetRunState {
  if (state.phase !== "countdown") return state;
  if (now < state.countdownEndsAtMs) return state;
  return {
    ...state,
    phase: "racing",
    raceStartedAtMs: now,
  };
}

export function sportsMeetElapsedMs(
  state: SportsMeetRunState,
  now = Date.now(),
): number {
  if (state.phase === "finished") return state.finalTimeMs;
  if (state.phase !== "racing" || state.raceStartedAtMs <= 0) return 0;
  return Math.max(0, now - state.raceStartedAtMs);
}

function advanceStage(
  state: SportsMeetRunState,
  cleared: SportsMeetStageKind,
  now: number,
): SportsMeetRunState {
  const elapsed = sportsMeetElapsedMs(state, now);
  const splits: SportsMeetSplit[] = [
    ...state.splits,
    { stage: cleared, clearTimeMs: elapsed },
  ];
  const nextIndex = state.stageIndex + 1;
  if (nextIndex >= state.stageOrder.length) {
    return {
      ...state,
      splits,
      stageIndex: nextIndex,
      phase: "finished",
      finalTimeMs: elapsed,
    };
  }
  return {
    ...state,
    splits,
    stageIndex: nextIndex,
  };
}

export function collectSportsMeetStar(
  state: SportsMeetRunState,
  starId: string,
  now = Date.now(),
): SportsMeetRunState {
  if (state.phase !== "racing") return state;
  if (state.stageOrder[state.stageIndex] !== "drive") return state;
  const stars = state.courseStars.map((s) =>
    s.id === starId && !s.collected ? { ...s, collected: true } : s,
  );
  const starsCollected = stars.filter((s) => s.collected).length;
  let next: SportsMeetRunState = { ...state, courseStars: stars, starsCollected };
  if (starsCollected >= state.mission.drive.starCount) {
    next = advanceStage(next, "drive", now);
  }
  return next;
}

export function collectSportsMeetSpeedBuff(
  state: SportsMeetRunState,
  buffId: string,
  now = Date.now(),
): SportsMeetRunState {
  if (state.phase !== "racing") return state;
  const speedBuffs = state.speedBuffs.map((b) =>
    b.id === buffId && !b.collected ? { ...b, collected: true } : b,
  );
  return {
    ...state,
    speedBuffs,
    speedBuffUntilMs: now + SPORTS_MEET_SPEED_BUFF_MS,
  };
}

export function tryCollectNearbySportsPickups(
  state: SportsMeetRunState,
  posX: number,
  posZ: number,
  now = Date.now(),
): SportsMeetRunState {
  if (state.phase !== "racing") return state;
  let next = state;
  if (state.stageOrder[state.stageIndex] === "drive") {
    for (const star of state.courseStars) {
      if (star.collected) continue;
      if (distanceXZ(posX, posZ, star.x, star.z) <= SPORTS_MEET_PICKUP_RADIUS) {
        next = collectSportsMeetStar(next, star.id, now);
      }
    }
  }
  for (const buff of next.speedBuffs) {
    if (buff.collected) continue;
    if (distanceXZ(posX, posZ, buff.x, buff.z) <= SPORTS_MEET_PICKUP_RADIUS) {
      next = collectSportsMeetSpeedBuff(next, buff.id, now);
    }
  }
  return next;
}

export function noteSportsDumpFill(
  state: SportsMeetRunState,
  fillUnits: number,
): SportsMeetRunState {
  if (state.phase !== "racing") return state;
  if (state.stageOrder[state.stageIndex] !== "dig") return state;
  return { ...state, dumpFillUnits: fillUnits };
}

export function noteSportsDumpDepart(
  state: SportsMeetRunState,
  now = Date.now(),
): SportsMeetRunState {
  if (state.phase !== "racing") return state;
  if (state.stageOrder[state.stageIndex] !== "dig") return state;
  if (state.dumpFillUnits < state.mission.dig.dumpTruckCapacity - 0.5) {
    return state;
  }
  const next = { ...state, dumpDeparted: true };
  return advanceStage(next, "dig", now);
}

export function noteSportsAsphaltBreak(
  state: SportsMeetRunState,
  now = Date.now(),
): SportsMeetRunState {
  if (state.phase !== "racing") return state;
  if (state.stageOrder[state.stageIndex] !== "crash") return state;
  const asphaltBroken = state.asphaltBroken + 1;
  let next: SportsMeetRunState = { ...state, asphaltBroken };
  if (asphaltBroken >= state.mission.crash.asphaltTileCount) {
    next = advanceStage(next, "crash", now);
  }
  return next;
}

export function noteSportsRockDump(
  state: SportsMeetRunState,
  now = Date.now(),
): SportsMeetRunState {
  if (state.phase !== "racing") return state;
  if (state.stageOrder[state.stageIndex] !== "hill") return state;
  const rocksDumped = state.rocksDumped + 1;
  let next: SportsMeetRunState = { ...state, rocksDumped };
  if (rocksDumped >= state.mission.hill.successfulDumpsRequired) {
    next = advanceStage(next, "hill", now);
  }
  return next;
}

export function sportsMeetStageWaypoint(
  pattern: SportsMeetPattern,
  stage: SportsMeetStageKind,
): { x: number; z: number } {
  switch (stage) {
    case "drive": {
      const p = pattern.drivePath[0];
      return p ? { x: p[0], z: p[1] } : { x: -18, z: -22 };
    }
    case "dig":
      return { x: pattern.zones.dig[0], z: pattern.zones.dig[1] };
    case "crash":
      return { x: pattern.zones.crash[0], z: pattern.zones.crash[1] };
    case "hill":
      return { x: pattern.zones.hill[0], z: pattern.zones.hill[1] };
  }
}

export type { SportsMeetMissionBalance };
