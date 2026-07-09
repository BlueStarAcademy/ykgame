import {
  DUMP_TRUCK_LANE_END_OFFSET,
  dumpTruckOffsetToWorld,
} from "./dumpTruckLane";

export type DumpTruckPhase = "ready" | "engineStart" | "departing" | "cooldown" | "arriving";

export interface DumpTruckPose {
  groupX: number;
  groupZ: number;
  present: boolean;
  /** 주차 기준 rotation 에 더해지는 요(Y) — 복귀 시 회전 */
  rotationYOffset: number;
}

export interface DumpTruckRuntimeState {
  phase: DumpTruckPhase;
  fillUnits: number;
  cooldownRemaining: number;
  /** 주차 위치 기준, 도로 진행 방향(+local X) 거리 — 0=주차, LANE_END=도로 끝 */
  offsetLocalX: number;
  rotationYOffset: number;
  phaseElapsed: number;
}

export const DUMP_TRUCK_ENGINE_START_DURATION_SEC = 2.2;
export const DUMP_TRUCK_DEPART_DURATION_SEC = 5.8;
export const DUMP_TRUCK_ARRIVE_DURATION_SEC = 10;
const ENGINE_START_DURATION = DUMP_TRUCK_ENGINE_START_DURATION_SEC;
const DEPART_DURATION = DUMP_TRUCK_DEPART_DURATION_SEC;
const ARRIVE_DURATION = DUMP_TRUCK_ARRIVE_DURATION_SEC;
const LANE_END_OFFSET = DUMP_TRUCK_LANE_END_OFFSET;

/** 복귀: 도로 끝 유턴 → 도로 따라 진입 → 제자리 정렬 */
const ARRIVE_TURN_END = 0.28;
const ARRIVE_DRIVE_END = 0.86;

export function createDumpTruckState(): DumpTruckRuntimeState {
  return {
    phase: "ready",
    fillUnits: 0,
    cooldownRemaining: 0,
    offsetLocalX: 0,
    rotationYOffset: 0,
    phaseElapsed: 0,
  };
}

export function resetDumpTruckState(state: DumpTruckRuntimeState) {
  state.phase = "ready";
  state.fillUnits = 0;
  state.cooldownRemaining = 0;
  state.offsetLocalX = 0;
  state.rotationYOffset = 0;
  state.phaseElapsed = 0;
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/** 출발 — 처음·끝 구간을 더 천천히 */
function easeDepart(t: number) {
  return t * t * (3 - 2 * t);
}

/** 복귀 주행 — 마지막 구간 감속 */
function easeArriveDrive(t: number) {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

/** 도로 끝 유턴 */
function easeTurn(t: number) {
  return t * t * (3 - 2 * t);
}

export function getDumpTruckPose(state: DumpTruckRuntimeState): DumpTruckPose {
  const { groupX, groupZ } = dumpTruckOffsetToWorld(state.offsetLocalX);
  const present = state.phase !== "cooldown";
  return {
    groupX,
    groupZ,
    present,
    rotationYOffset: state.rotationYOffset,
  };
}

export function getDumpTruckMotionProgress(state: DumpTruckRuntimeState) {
  if (state.phase === "engineStart") {
    return { kind: "engineStart" as const, t: Math.min(1, state.phaseElapsed / ENGINE_START_DURATION) };
  }
  if (state.phase === "departing") {
    return { kind: "departing" as const, t: Math.min(1, state.phaseElapsed / DEPART_DURATION) };
  }
  if (state.phase === "arriving") {
    const t = Math.min(1, state.phaseElapsed / ARRIVE_DURATION);
    if (t < ARRIVE_TURN_END) {
      return { kind: "arriving" as const, t, sub: "turn" as const };
    }
    if (t < ARRIVE_DRIVE_END) {
      return { kind: "arriving" as const, t, sub: "drive" as const };
    }
    return { kind: "arriving" as const, t, sub: "park" as const };
  }
  return { kind: "idle" as const, t: 0 };
}

export function canDumpTruckAcceptDump(
  state: DumpTruckRuntimeState,
  capacityUnits: number,
): boolean {
  return state.phase === "ready" && state.fillUnits < capacityUnits - 0.5;
}

export function isDumpTruckVisible(state: DumpTruckRuntimeState): boolean {
  return state.phase !== "cooldown";
}

export function getDumpTruckFillRatio(state: DumpTruckRuntimeState, capacityUnits: number) {
  if (capacityUnits <= 0) return 0;
  return Math.min(1, Math.max(0, state.fillUnits / capacityUnits));
}

export function beginDumpTruckDeparture(state: DumpTruckRuntimeState) {
  if (state.phase !== "ready") return;
  state.phase = "engineStart";
  state.phaseElapsed = 0;
}

export function addDumpTruckLoad(
  state: DumpTruckRuntimeState,
  loadUnits: number,
  capacityUnits: number,
) {
  if (state.phase !== "ready") return;
  state.fillUnits = Math.min(capacityUnits, state.fillUnits + loadUnits);
  if (state.fillUnits >= capacityUnits - 0.5) {
    beginDumpTruckDeparture(state);
  }
}

export function formatDumpTruckReturnTime(seconds: number) {
  const total = Math.max(0, Math.ceil(seconds));
  if (total < 60) return `${total}초`;
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function getDumpTruckReturnEtaSec(
  state: DumpTruckRuntimeState,
  cooldownSec: number,
) {
  if (state.phase === "cooldown") return state.cooldownRemaining;
  if (state.phase === "engineStart") {
    const engineLeft = Math.max(0, ENGINE_START_DURATION - state.phaseElapsed);
    return engineLeft + DEPART_DURATION + cooldownSec + ARRIVE_DURATION;
  }
  if (state.phase === "departing") {
    const departLeft = Math.max(0, DEPART_DURATION - state.phaseElapsed);
    return departLeft + cooldownSec + ARRIVE_DURATION;
  }
  if (state.phase === "arriving") {
    return Math.max(0, ARRIVE_DURATION - state.phaseElapsed);
  }
  return 0;
}

export function shouldShowDumpTruckReturnTimer(state: DumpTruckRuntimeState) {
  return (
    state.phase === "engineStart" ||
    state.phase === "departing" ||
    state.phase === "cooldown" ||
    state.phase === "arriving"
  );
}

function applyArrivingMotion(state: DumpTruckRuntimeState, t: number) {
  if (t < ARRIVE_TURN_END) {
    const u = t / ARRIVE_TURN_END;
    state.offsetLocalX = LANE_END_OFFSET;
    state.rotationYOffset = easeTurn(u) * Math.PI;
    return;
  }

  if (t < ARRIVE_DRIVE_END) {
    const u = (t - ARRIVE_TURN_END) / (ARRIVE_DRIVE_END - ARRIVE_TURN_END);
    state.offsetLocalX = LANE_END_OFFSET * (1 - easeArriveDrive(u));
    state.rotationYOffset = Math.PI;
    return;
  }

  const u = (t - ARRIVE_DRIVE_END) / (1 - ARRIVE_DRIVE_END);
  state.offsetLocalX = 0;
  state.rotationYOffset = Math.PI * (1 - easeInOut(u));
}

export function updateDumpTruckState(
  state: DumpTruckRuntimeState,
  dt: number,
  cooldownSec: number,
) {
  state.phaseElapsed += dt;

  if (state.phase === "engineStart") {
    if (state.phaseElapsed >= ENGINE_START_DURATION) {
      state.phase = "departing";
      state.phaseElapsed = 0;
    }
    return;
  }

  if (state.phase === "departing") {
    const t = Math.min(1, state.phaseElapsed / DEPART_DURATION);
    state.offsetLocalX = easeDepart(t) * LANE_END_OFFSET;
    state.rotationYOffset = 0;
    if (t >= 1) {
      state.phase = "cooldown";
      state.phaseElapsed = 0;
      state.cooldownRemaining = cooldownSec;
      state.fillUnits = 0;
      state.offsetLocalX = LANE_END_OFFSET;
      state.rotationYOffset = 0;
    }
    return;
  }

  if (state.phase === "cooldown") {
    state.cooldownRemaining = Math.max(0, state.cooldownRemaining - dt);
    if (state.cooldownRemaining <= ARRIVE_DURATION) {
      state.phase = "arriving";
      state.phaseElapsed = ARRIVE_DURATION - state.cooldownRemaining;
      state.offsetLocalX = LANE_END_OFFSET;
      state.rotationYOffset = 0;
      applyArrivingMotion(state, state.phaseElapsed / ARRIVE_DURATION);
    }
    return;
  }

  if (state.phase === "arriving") {
    const t = Math.min(1, state.phaseElapsed / ARRIVE_DURATION);
    applyArrivingMotion(state, t);
    if (t >= 1) {
      state.phase = "ready";
      state.phaseElapsed = 0;
      state.offsetLocalX = 0;
      state.rotationYOffset = 0;
      state.fillUnits = 0;
    }
  }
}

/**
 * 앱이 닫혀 시뮬레이션 프레임이 실행되지 않은 시간을 상태 머신에 반영한다.
 * 각 phase의 경계까지만 진행해 큰 elapsed 값도 다음 phase로 정확히 넘긴다.
 */
export function fastForwardDumpTruckState(
  state: DumpTruckRuntimeState,
  elapsedSec: number,
  cooldownSec: number,
) {
  let remaining = Math.max(0, elapsedSec);

  while (remaining > 0 && state.phase !== "ready") {
    let untilTransition: number;

    if (state.phase === "engineStart") {
      untilTransition = Math.max(0, ENGINE_START_DURATION - state.phaseElapsed);
    } else if (state.phase === "departing") {
      untilTransition = Math.max(0, DEPART_DURATION - state.phaseElapsed);
    } else if (state.phase === "cooldown") {
      untilTransition = Math.max(0, state.cooldownRemaining - ARRIVE_DURATION);
    } else {
      untilTransition = Math.max(0, ARRIVE_DURATION - state.phaseElapsed);
    }

    const step = Math.min(remaining, Math.max(untilTransition, 0.000_001));
    updateDumpTruckState(state, step, cooldownSec);
    remaining -= step;
  }
}
