import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateFloodPushUnits,
  FLOOD_BASE_PUSH_UNITS,
  FLOOD_INCINERATOR_BASE_CAPACITY,
  floodBurnDurationSec,
  floodCleaningMasterMult,
  floodIncineratorCapacity,
  FLOOD_MIN_BURN_SEC,
  FLOOD_RECOVERY_UNLOCK_LEVEL,
} from "./balance";

describe("floodRecovery/balance", () => {
  it("unlocks at level 23", () => {
    assert.equal(FLOOD_RECOVERY_UNLOCK_LEVEL, 23);
  });

  it("keeps base push at 500 for stock chassis", () => {
    const base = {
      strength: 12,
      agility: 12,
      stamina: 12,
      endurance: 12,
      balance: 12,
      technique: 12,
    };
    assert.equal(
      calculateFloodPushUnits({
        chassisStats: base,
        baseChassisStats: base,
      }),
      FLOOD_BASE_PUSH_UNITS,
    );
  });

  it("increases push with each of the six abilities", () => {
    const base = {
      strength: 10,
      agility: 10,
      stamina: 10,
      endurance: 10,
      balance: 10,
      technique: 10,
    };
    const boosted = {
      strength: 20,
      agility: 20,
      stamina: 20,
      endurance: 20,
      balance: 20,
      technique: 20,
    };
    const push = calculateFloodPushUnits({
      chassisStats: boosted,
      baseChassisStats: base,
    });
    assert.ok(push > FLOOD_BASE_PUSH_UNITS);
  });

  it("applies cleaning master +5% per level up to 10", () => {
    assert.equal(floodCleaningMasterMult(0), 1);
    assert.equal(floodCleaningMasterMult(1), 1.05);
    assert.equal(floodCleaningMasterMult(10), 1.5);
    assert.equal(floodCleaningMasterMult(99), 1.5);
    const base = {
      strength: 10,
      agility: 10,
      stamina: 10,
      endurance: 10,
      balance: 10,
      technique: 10,
    };
    const withMaster = calculateFloodPushUnits({
      chassisStats: base,
      baseChassisStats: base,
      cleaningMasterLevel: 10,
    });
    assert.equal(withMaster, Math.floor(FLOOD_BASE_PUSH_UNITS * 1.5));
  });

  it("reduces burn time with floor", () => {
    assert.ok(floodBurnDurationSec(0) > FLOOD_MIN_BURN_SEC);
    assert.equal(floodBurnDurationSec(10), 4);
    assert.equal(floodBurnDurationSec(99), 4);
    assert.ok(floodBurnDurationSec(10) >= FLOOD_MIN_BURN_SEC);
  });

  it("expands incinerator capacity by 500 up to 5 levels", () => {
    assert.equal(floodIncineratorCapacity(0), FLOOD_INCINERATOR_BASE_CAPACITY);
    assert.equal(
      floodIncineratorCapacity(5),
      FLOOD_INCINERATOR_BASE_CAPACITY + 2500,
    );
    assert.equal(
      floodIncineratorCapacity(99),
      FLOOD_INCINERATOR_BASE_CAPACITY + 2500,
    );
  });
});
