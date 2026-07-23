import {
  buildCourseStars,
  buildSpeedBuffPickups,
  distanceXZ,
  SPORTS_MEET_COUNTDOWN_MS,
  SPORTS_MEET_PICKUP_RADIUS,
  SPORTS_MEET_SPEED_BUFF_MS,
} from "./coursePickups";
import {
  getDrivePathForStage,
  getSportsMeetFinishGate,
  getSportsMeetMissionForWeek,
  getSportsMeetPattern,
  isSportsMeetFinishDriveStage,
  sportsMeetDriveStarQuota,
  type SportsMeetPattern,
  type SportsMeetStageKind,
} from "./patterns";
import type { SportsMeetMissionBalance } from "./missionBalance";
import { getSportsMeetStartPaddock } from "./startPaddock";
import {
  createInitialSportsMeetRunState,
  type SportsMeetPlayMode,
  type SportsMeetRunState,
  type SportsMeetSplit,
} from "./types";

function rebuildDriveStars(
  state: SportsMeetRunState,
  pattern: SportsMeetPattern,
  heightAt: (x: number, z: number) => number,
): SportsMeetRunState {
  const quota = sportsMeetDriveStarQuota(
    state.mission,
    state.stageOrder,
    state.stageIndex,
  );
  if (quota <= 0) {
    return {
      ...state,
      courseStars: [],
      starsCollected: 0,
    };
  }
  const path = getDrivePathForStage(pattern, state.stageIndex);
  return {
    ...state,
    courseStars: buildCourseStars(
      path,
      quota,
      heightAt,
      `course-star-s${state.stageIndex}`,
    ),
    starsCollected: 0,
  };
}

export function beginSportsMeetRun(
  playMode: SportsMeetPlayMode,
  weekKey: string,
  heightAt: (x: number, z: number) => number,
  runId: string | null,
): SportsMeetRunState {
  const pattern = getSportsMeetPattern(weekKey);
  const mission = getSportsMeetMissionForWeek(weekKey);
  let state = createInitialSportsMeetRunState(
    playMode,
    pattern,
    mission,
    weekKey,
  );
  state.runId = runId;
  state = rebuildDriveStars(state, pattern, heightAt);
  // Speed buffs once along the full corridor for the whole run.
  state.speedBuffs = buildSpeedBuffPickups(
    pattern.drivePath,
    mission,
    heightAt,
  );
  return state;
}

/** Rebuild stars when entering a drive leg (after stage advance). */
export function prepareSportsMeetStageContent(
  state: SportsMeetRunState,
  pattern: SportsMeetPattern,
  heightAt: (x: number, z: number) => number,
): SportsMeetRunState {
  const stage = state.stageOrder[state.stageIndex];
  if (stage !== "drive") return state;
  const quota = sportsMeetDriveStarQuota(
    state.mission,
    state.stageOrder,
    state.stageIndex,
  );
  if (
    state.courseStars.length === quota &&
    state.starsCollected === 0 &&
    (quota === 0 || state.courseStars.every((s) => !s.collected))
  ) {
    return state;
  }
  return rebuildDriveStars(state, pattern, heightAt);
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

  const nextStage = state.stageOrder[nextIndex]!;
  let next: SportsMeetRunState = {
    ...state,
    splits,
    stageIndex: nextIndex,
  };

  // Per-stage progress — multiple drive legs need fresh star counters.
  if (nextStage === "drive") {
    next = {
      ...next,
      starsCollected: 0,
      courseStars: [],
    };
  } else if (nextStage === "dig") {
    next = {
      ...next,
      dumpFillUnits: 0,
      dumpDeparted: false,
    };
  } else if (nextStage === "crash") {
    next = { ...next, asphaltBroken: 0 };
  } else if (nextStage === "hill") {
    next = { ...next, rocksDumped: 0 };
  }

  return next;
}

export function collectSportsMeetStar(
  state: SportsMeetRunState,
  starId: string,
  now = Date.now(),
): SportsMeetRunState {
  if (state.phase !== "racing") return state;
  if (state.stageOrder[state.stageIndex] !== "drive") return state;
  const quota = sportsMeetDriveStarQuota(
    state.mission,
    state.stageOrder,
    state.stageIndex,
  );
  if (quota <= 0) return state;
  const stars = state.courseStars.map((s) =>
    s.id === starId && !s.collected ? { ...s, collected: true } : s,
  );
  const starsCollected = stars.filter((s) => s.collected).length;
  let next: SportsMeetRunState = { ...state, courseStars: stars, starsCollected };
  if (starsCollected >= quota) {
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
  pattern?: SportsMeetPattern,
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
  if (pattern) {
    next = tryCrossSportsFinishGate(next, pattern, posX, posZ, now);
  }
  return next;
}

/** Finish sprint: crossing the FINISH gate stops the clock. */
export function tryCrossSportsFinishGate(
  state: SportsMeetRunState,
  pattern: SportsMeetPattern,
  posX: number,
  posZ: number,
  now = Date.now(),
): SportsMeetRunState {
  if (state.phase !== "racing") return state;
  if (!isSportsMeetFinishDriveStage(state.stageOrder, state.stageIndex)) {
    return state;
  }
  const gate = getSportsMeetFinishGate(pattern);
  if (distanceXZ(posX, posZ, gate.x, gate.z) > gate.radius) return state;
  return advanceStage(state, "drive", now);
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
  stageIndex = 0,
): { x: number; z: number; heading?: number } {
  switch (stage) {
    case "drive": {
      // First leg starts inside the locked start paddock.
      if (stageIndex === 0) {
        const paddock = getSportsMeetStartPaddock(pattern);
        return {
          x: paddock.centerX,
          z: paddock.centerZ,
          heading: paddock.heading,
        };
      }
      const path = getDrivePathForStage(pattern, stageIndex);
      const p = path[0];
      if (!p) return { x: -18, z: -22 };
      const next = path[1];
      const heading =
        next != null
          ? Math.atan2(next[0] - p[0], next[1] - p[1])
          : undefined;
      return { x: p[0], z: p[1], heading };
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
