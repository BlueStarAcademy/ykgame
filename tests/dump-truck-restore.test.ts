import assert from "node:assert/strict";
import {
  createDumpTruckState,
  canDumpTruckAcceptDump,
  fastForwardDumpTruckState,
  finalizeDumpTruckArrivalIfParked,
  isDumpTruckVisible,
  DUMP_TRUCK_ARRIVE_DURATION_SEC,
} from "../src/games/yanmar/dumpTruckState";

function testParkedArrivalSnapsToReady() {
  const state = createDumpTruckState();
  state.phase = "arriving";
  state.phaseElapsed = DUMP_TRUCK_ARRIVE_DURATION_SEC * 0.9;
  state.offsetLocalX = 0;
  state.rotationYOffset = 0.2;
  finalizeDumpTruckArrivalIfParked(state);
  assert.equal(state.phase, "ready");
  assert.equal(state.fillUnits, 0);
  assert.equal(canDumpTruckAcceptDump(state, 10), true);
}

function testEarlyArrivalStaysArriving() {
  const state = createDumpTruckState();
  state.phase = "arriving";
  state.phaseElapsed = DUMP_TRUCK_ARRIVE_DURATION_SEC * 0.5;
  finalizeDumpTruckArrivalIfParked(state);
  assert.equal(state.phase, "arriving");
  assert.equal(canDumpTruckAcceptDump(state, 10), false);
  assert.equal(isDumpTruckVisible(state), true);
}

function testFastForwardCooldownThenSnap() {
  const state = createDumpTruckState();
  state.phase = "cooldown";
  state.cooldownRemaining = DUMP_TRUCK_ARRIVE_DURATION_SEC + 1;
  // Advance past cooldown into late arriving
  fastForwardDumpTruckState(state, DUMP_TRUCK_ARRIVE_DURATION_SEC + 0.5, 60);
  assert.equal(state.phase, "ready");
  assert.equal(canDumpTruckAcceptDump(state, 10), true);
}

testParkedArrivalSnapsToReady();
testEarlyArrivalStaysArriving();
testFastForwardCooldownThenSnap();
console.log("dump-truck-restore.test.ts: ok");
