import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getSportsMeetFinishGate,
  getSportsMeetPatternById,
  isSportsMeetFinishDriveStage,
  SPORTS_MEET_LINEAR_STAGE_ORDER,
  sportsMeetDriveStarQuota,
} from "./patterns";
import { resolveSportsMeetMission } from "./missionBalance";
import {
  beginSportsMeetRun,
  noteSportsFloodIncineratorFill,
  SPORTS_MEET_FLOOD_INCINERATOR_CAPACITY,
} from "./runState";
import { getSportsMeetAllowedAttachment } from "./stageGate";

describe("sports meet flood → finish sprint", () => {
  it("ends with a finish drive after flood", () => {
    assert.deepEqual([...SPORTS_MEET_LINEAR_STAGE_ORDER].slice(-2), [
      "flood",
      "drive",
    ]);
    const finishIndex = SPORTS_MEET_LINEAR_STAGE_ORDER.length - 1;
    assert.equal(
      isSportsMeetFinishDriveStage(SPORTS_MEET_LINEAR_STAGE_ORDER, finishIndex),
      true,
    );
    const mission = resolveSportsMeetMission();
    assert.equal(
      sportsMeetDriveStarQuota(
        mission,
        SPORTS_MEET_LINEAR_STAGE_ORDER,
        finishIndex,
      ),
      0,
    );
  });

  it("places finish gate outside the flood radius", () => {
    for (const id of [0, 1, 2, 3, 4] as const) {
      const pattern = getSportsMeetPatternById(id);
      assert.ok(pattern);
      assert.equal(pattern.drivePaths.length, 5);
      const finish = pattern.drivePaths[4]!;
      assert.equal(finish.length, 2);
      const len = Math.hypot(
        finish[1]![0] - finish[0]![0],
        finish[1]![1] - finish[0]![1],
      );
      assert.ok(Math.abs(len - 5) < 0.05, `finish length ${len}`);
      const gate = getSportsMeetFinishGate(pattern);
      const [fx, fz] = pattern.zones.flood;
      const dist = Math.hypot(gate.x - fx, gate.z - fz);
      // flood radius 22 + gate radius 4.2 ≈ 26.2; keep ≥28 margin.
      assert.ok(dist >= 28, `pattern ${id} gate dist ${dist}`);
    }
  });

  it("clears flood immediately at 500 incinerator units", () => {
    const weekKey = "2026-W01";
    let run = beginSportsMeetRun("practice", weekKey, () => 0.7, null);
    const floodIndex = run.stageOrder.indexOf("flood");
    assert.ok(floodIndex >= 0);
    run = {
      ...run,
      phase: "racing",
      raceStartedAtMs: 1,
      stageIndex: floodIndex,
      floodIncineratorUnits: 0,
    };
    const now = 50_000;
    const next = noteSportsFloodIncineratorFill(
      run,
      SPORTS_MEET_FLOOD_INCINERATOR_CAPACITY,
      now,
    );
    assert.equal(next.stageIndex, floodIndex + 1);
    assert.equal(next.stageOrder[next.stageIndex], "drive");
    assert.equal(
      isSportsMeetFinishDriveStage(next.stageOrder, next.stageIndex),
      true,
    );
  });

  it("locks flood attachment to grapple", () => {
    assert.equal(getSportsMeetAllowedAttachment("flood"), "grapple");
  });
});
