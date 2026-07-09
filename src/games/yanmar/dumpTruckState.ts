import { DUMP_TRUCK } from "./terrain";

export type DumpTruckPhase = "ready" | "engineStart" | "departing" | "cooldown" | "arriving";

export interface DumpTruckPose {
  groupX: number;
  groupZ: number;
  present: boolean;
}

export interface DumpTruckRuntimeState {
  phase: DumpTruckPhase;
  fillUnits: number;
  cooldownRemaining: number;
  /** 트럭 전방(로컬 +X) 기준 이동 거리 */
  offsetLocalX: number;
  phaseElapsed: number;
}

const DEPART_DISTANCE = 38;
export const DUMP_TRUCK_ENGINE_START_DURATION_SEC = 2.2;
export const DUMP_TRUCK_DEPART_DURATION_SEC = 5.8;
export const DUMP_TRUCK_ARRIVE_DURATION_SEC = 10;
const ENGINE_START_DURATION = DUMP_TRUCK_ENGINE_START_DURATION_SEC;
const DEPART_DURATION = DUMP_TRUCK_DEPART_DURATION_SEC;
const ARRIVE_DISTANCE = 40;
const ARRIVE_DURATION = DUMP_TRUCK_ARRIVE_DURATION_SEC;

export function createDumpTruckState(): DumpTruckRuntimeState {
  return {
    phase: "ready",
    fillUnits: 0,
    cooldownRemaining: 0,
    offsetLocalX: 0,
    phaseElapsed: 0,
  };
}

export function resetDumpTruckState(state: DumpTruckRuntimeState) {
  state.phase = "ready";
  state.fillUnits = 0;
  state.cooldownRemaining = 0;
  state.offsetLocalX = 0;
  state.phaseElapsed = 0;
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/** 출발·주차 — 처음·끝 구간을 더 천천히 */
function easeDepart(t: number) {
  return t * t * (3 - 2 * t);
}

/** 복귀 주차 — 마지막 구간 감속 */
function easeArrive(t: number) {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

export function getDumpTruckPose(state: DumpTruckRuntimeState): DumpTruckPose {
  const cos = Math.cos(DUMP_TRUCK.rotation);
  const sin = Math.sin(DUMP_TRUCK.rotation);
  const worldOffsetX = state.offsetLocalX * cos;
  const worldOffsetZ = -state.offsetLocalX * sin;
  const present = state.phase !== "cooldown";
  return {
    groupX: DUMP_TRUCK.groupX + worldOffsetX,
    groupZ: DUMP_TRUCK.groupZ + worldOffsetZ,
    present,
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
    return { kind: "arriving" as const, t: Math.min(1, state.phaseElapsed / ARRIVE_DURATION) };
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
    state.offsetLocalX = easeDepart(t) * DEPART_DISTANCE;
    if (t >= 1) {
      state.phase = "cooldown";
      state.phaseElapsed = 0;
      state.cooldownRemaining = cooldownSec;
      state.fillUnits = 0;
      state.offsetLocalX = DEPART_DISTANCE;
    }
    return;
  }

  if (state.phase === "cooldown") {
    state.cooldownRemaining = Math.max(0, state.cooldownRemaining - dt);
    if (state.cooldownRemaining <= ARRIVE_DURATION) {
      state.phase = "arriving";
      state.phaseElapsed = ARRIVE_DURATION - state.cooldownRemaining;
      state.offsetLocalX = -ARRIVE_DISTANCE;
    }
    return;
  }

  if (state.phase === "arriving") {
    const t = Math.min(1, state.phaseElapsed / ARRIVE_DURATION);
    state.offsetLocalX = -ARRIVE_DISTANCE + easeArrive(t) * ARRIVE_DISTANCE;
    if (t >= 1) {
      state.phase = "ready";
      state.phaseElapsed = 0;
      state.offsetLocalX = 0;
      state.fillUnits = 0;
    }
  }
}
