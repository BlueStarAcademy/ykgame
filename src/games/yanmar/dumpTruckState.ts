import { DUMP_TRUCK } from "./terrain";

export type DumpTruckPhase = "ready" | "departing" | "cooldown" | "arriving";

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

const DEPART_DISTANCE = 30;
export const DUMP_TRUCK_DEPART_DURATION_SEC = 2.6;
export const DUMP_TRUCK_ARRIVE_DURATION_SEC = 2.2;
const DEPART_DURATION = DUMP_TRUCK_DEPART_DURATION_SEC;
const ARRIVE_DISTANCE = 30;
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
  state.phase = "departing";
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

export function updateDumpTruckState(
  state: DumpTruckRuntimeState,
  dt: number,
  cooldownSec: number,
) {
  state.phaseElapsed += dt;

  if (state.phase === "departing") {
    const t = Math.min(1, state.phaseElapsed / DEPART_DURATION);
    state.offsetLocalX = easeInOut(t) * DEPART_DISTANCE;
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
    if (state.cooldownRemaining <= 0) {
      state.phase = "arriving";
      state.phaseElapsed = 0;
      state.offsetLocalX = -ARRIVE_DISTANCE;
    }
    return;
  }

  if (state.phase === "arriving") {
    const t = Math.min(1, state.phaseElapsed / ARRIVE_DURATION);
    state.offsetLocalX = -ARRIVE_DISTANCE + easeInOut(t) * ARRIVE_DISTANCE;
    if (t >= 1) {
      state.phase = "ready";
      state.phaseElapsed = 0;
      state.offsetLocalX = 0;
      state.fillUnits = 0;
    }
  }
}
