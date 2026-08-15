import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MASTER_OPTION_POOL } from "./gearCatalog";
import type { MasterOptionInst } from "./gearGenerate";
import {
  applyMasterScoreXpBonus,
  applySportsMeetStarRewardBonus,
} from "./gearService";
import { calculateFinalYanmarStats } from "./gearStats";
import { SPORTS_MEET_SPEED_BUFF_MS } from "./sportsMeet/coursePickups";
import {
  beginSportsMeetRun,
  collectSportsMeetSpeedBuff,
} from "./sportsMeet/runState";
import { getSportsMeetWeekKey } from "./sportsMeet/weekKey";

function master(
  key: MasterOptionInst["key"],
  value: number,
  extras: Partial<MasterOptionInst> = {},
): MasterOptionInst {
  return {
    key,
    value,
    label: key,
    hideValue: false,
    isPercent: true,
    isDropRateBonus: false,
    ...extras,
  };
}

describe("flood/sports master option bonuses", () => {
  it("exposes 27 master options including flood, sports-meet, and dismantle keys", () => {
    assert.equal(MASTER_OPTION_POOL.length, 27);
    const keys = new Set(MASTER_OPTION_POOL.map((d) => d.key));
    for (const key of [
      "floodWorkScorePct",
      "floodWorkXpPct",
      "floodWorkGearDrop",
      "floodBurnScore",
      "floodBurnGearDrop",
      "floodBladePushPct",
      "sportsMeetDriveSpeedPct",
      "sportsMeetSpeedBuffDurationPct",
      "sportsMeetStarRewardPct",
      "sportsMeetDigFillPct",
      "sportsMeetCrashHitPct",
      "dismantleJackpotChancePct",
      "dismantleJackpotCoreBonusPct",
    ] as const) {
      assert.ok(keys.has(key), `missing ${key}`);
    }
    const chance = MASTER_OPTION_POOL.find(
      (d) => d.key === "dismantleJackpotChancePct",
    );
    const coreBonus = MASTER_OPTION_POOL.find(
      (d) => d.key === "dismantleJackpotCoreBonusPct",
    );
    assert.equal(chance?.min, 10);
    assert.equal(chance?.max, 20);
    assert.equal(coreBonus?.min, 20);
    assert.equal(coreBonus?.max, 50);
  });

  it("applies dismantle jackpot chance and core bonus from equipped masters", () => {
    const stats = calculateFinalYanmarStats({
      chassisId: "ViO17_1",
      equipped: [
        {
          slot: "ARM",
          durability: 100,
          data: {
            slot: "ARM",
            grade: "MASTER",
            enhanceLevel: 0,
            mainOption: { key: "endurance", value: 10, baseAtLevel: 10 },
            subOptions: [],
            masterOption: master("dismantleJackpotChancePct", 15),
          },
        },
        {
          slot: "BOOM",
          durability: 100,
          data: {
            slot: "BOOM",
            grade: "MASTER",
            enhanceLevel: 0,
            mainOption: { key: "strength", value: 10, baseAtLevel: 10 },
            subOptions: [],
            masterOption: master("dismantleJackpotCoreBonusPct", 40),
          },
        },
      ],
    });
    assert.equal(stats.dismantleJackpotChanceBonusPct, 15);
    assert.equal(stats.dismantleJackpotCoreBonusPct, 40);
  });

  it("boosts flood collect/grapple score and xp from floodWork masters", () => {
    const masters = {
      floodWorkScorePct: master("floodWorkScorePct", 50),
      floodWorkXpPct: master("floodWorkXpPct", 40),
      hillDumpScorePct: master("hillDumpScorePct", 50),
    };
    const collect = applyMasterScoreXpBonus(
      "flood",
      1000,
      1000,
      masters,
      "collect",
    );
    assert.equal(collect.score, 1500);
    assert.equal(collect.xp, 1400);

    const grapple = applyMasterScoreXpBonus(
      "flood",
      1000,
      1000,
      masters,
      "grapple",
    );
    assert.equal(grapple.score, 1500);
    assert.equal(grapple.xp, 1400);

    // Hill masters must not affect flood rewards.
    const noFlood = applyMasterScoreXpBonus(
      "flood",
      1000,
      1000,
      { hillDumpScorePct: master("hillDumpScorePct", 50) },
      "collect",
    );
    assert.equal(noFlood.score, 1000);
    assert.equal(noFlood.xp, 1000);
  });

  it("adds flat floodBurnScore on burn and leaves xp unchanged", () => {
    const masters = {
      floodBurnScore: master("floodBurnScore", 2000, {
        isPercent: false,
      }),
      floodWorkXpPct: master("floodWorkXpPct", 50),
    };
    const burn = applyMasterScoreXpBonus("flood", 2500, 3000, masters, "burn");
    assert.equal(burn.score, 4500);
    assert.equal(burn.xp, 3000);
  });

  it("applies sports-meet star reward percent", () => {
    assert.equal(applySportsMeetStarRewardBonus(20, 0), 20);
    assert.equal(applySportsMeetStarRewardBonus(20, 40), 28);
    assert.equal(applySportsMeetStarRewardBonus(15, 20), 18);
  });

  it("multiplies flood blade push by floodBladePushPct", () => {
    const boomBase = {
      slot: "BOOM" as const,
      durability: 100,
      data: {
        slot: "BOOM" as const,
        grade: "MASTER" as const,
        enhanceLevel: 0,
        mainOption: {
          key: "strength" as const,
          value: 10,
          baseAtLevel: 10,
        },
        subOptions: [],
        masterOption: master("sportsMeetStarRewardPct", 20),
      },
    };
    const baseline = calculateFinalYanmarStats({
      chassisId: "ViO17_1",
      equipped: [boomBase],
    });
    const withPush = calculateFinalYanmarStats({
      chassisId: "ViO17_1",
      equipped: [
        {
          ...boomBase,
          data: {
            ...boomBase.data,
            masterOption: master("floodBladePushPct", 20),
          },
        },
      ],
    });
    assert.equal(
      withPush.floodPushUnits,
      Math.floor(baseline.floodPushUnits * 1.2),
    );
  });

  it("bakes sports-meet master multipliers into final stats", () => {
    const stats = calculateFinalYanmarStats({
      chassisId: "ViO17_1",
      equipped: [
        {
          slot: "TRACK",
          durability: 100,
          data: {
            slot: "TRACK",
            grade: "MASTER",
            enhanceLevel: 0,
            mainOption: { key: "agility", value: 10, baseAtLevel: 10 },
            subOptions: [],
            masterOption: master("sportsMeetDriveSpeedPct", 10),
          },
        },
        {
          slot: "BUCKET",
          durability: 100,
          data: {
            slot: "BUCKET",
            grade: "MASTER",
            enhanceLevel: 0,
            mainOption: { key: "stamina", value: 10, baseAtLevel: 10 },
            subOptions: [],
            masterOption: master("sportsMeetDigFillPct", 20),
          },
        },
        {
          slot: "BREAKER",
          durability: 100,
          data: {
            slot: "BREAKER",
            grade: "MASTER",
            enhanceLevel: 0,
            mainOption: { key: "technique", value: 10, baseAtLevel: 10 },
            subOptions: [],
            masterOption: master("sportsMeetCrashHitPct", 25),
          },
        },
        {
          slot: "ARM",
          durability: 100,
          data: {
            slot: "ARM",
            grade: "MASTER",
            enhanceLevel: 0,
            mainOption: { key: "endurance", value: 10, baseAtLevel: 10 },
            subOptions: [],
            masterOption: master("sportsMeetSpeedBuffDurationPct", 30),
          },
        },
        {
          slot: "GRAPPLE",
          durability: 100,
          data: {
            slot: "GRAPPLE",
            grade: "MASTER",
            enhanceLevel: 0,
            mainOption: { key: "balance", value: 10, baseAtLevel: 10 },
            subOptions: [],
            masterOption: master("sportsMeetStarRewardPct", 40),
          },
        },
      ],
    });
    assert.equal(stats.sportsMeetDriveSpeedMult, 1.1);
    assert.equal(stats.sportsMeetDigFillMult, 1.2);
    assert.equal(stats.sportsMeetCrashHitMult, 1.25);
    assert.equal(stats.sportsMeetSpeedBuffDurationMult, 1.3);
    assert.equal(stats.sportsMeetStarRewardPct, 40);
  });

  it("extends sports-meet speed buff duration when durationMs is provided", () => {
    const weekKey = getSportsMeetWeekKey();
    let run = beginSportsMeetRun("practice", weekKey, () => 0, null);
    run = {
      ...run,
      phase: "racing",
      raceStartedAtMs: Date.now(),
      speedBuffs: [
        {
          id: "course-speed-0",
          x: 0,
          z: 0,
          y: 0,
          collected: false,
        },
      ],
    };
    const now = 1_000_000;
    const next = collectSportsMeetSpeedBuff(
      run,
      "course-speed-0",
      now,
      SPORTS_MEET_SPEED_BUFF_MS * 1.3,
    );
    assert.equal(
      next.speedBuffUntilMs,
      now + Math.round(SPORTS_MEET_SPEED_BUFF_MS * 1.3),
    );
  });
});
