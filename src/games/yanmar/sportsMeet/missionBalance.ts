import { deterministicRewardInRange } from "../worldPickups";

/** Tunable sports-meet mission quotas — edit here to rebalance. */

export const SPORTS_MEET_MISSION_DEFAULTS = {
  drive: {
    /** Stars required per drive leg (course has multiple drive stages). */
    starCount: 12,
    speedBuffCount: 4,
  },
  dig: {
    digPileCapacity: 15_000,
    dumpTruckCapacity: 15_000,
  },
  crash: {
    asphaltTileCount: 3,
  },
  hill: {
    boulderCount: 3,
    successfulDumpsRequired: 3,
    /** 적재 실패 시 동일 돌 재사용 확률 (1 = 100%) */
    failedLoadReuseChance: 1,
  },
} as const;

/** Ranked-mode course star currency grant (per pickup). */
export const SPORTS_MEET_STAR_REWARD_MIN = 20;
export const SPORTS_MEET_STAR_REWARD_MAX = 60;

export type SportsMeetMissionBalance = {
  drive: {
    starCount: number;
    speedBuffCount: number;
  };
  dig: {
    digPileCapacity: number;
    dumpTruckCapacity: number;
  };
  crash: {
    asphaltTileCount: number;
  };
  hill: {
    boulderCount: number;
    successfulDumpsRequired: number;
    failedLoadReuseChance: number;
  };
};

export type DeepPartialMission = {
  drive?: Partial<SportsMeetMissionBalance["drive"]>;
  dig?: Partial<SportsMeetMissionBalance["dig"]>;
  crash?: Partial<SportsMeetMissionBalance["crash"]>;
  hill?: Partial<SportsMeetMissionBalance["hill"]>;
};

export function resolveSportsMeetMission(
  override?: DeepPartialMission | null,
): SportsMeetMissionBalance {
  const d = SPORTS_MEET_MISSION_DEFAULTS;
  return {
    drive: { ...d.drive, ...override?.drive },
    dig: { ...d.dig, ...override?.dig },
    crash: { ...d.crash, ...override?.crash },
    hill: { ...d.hill, ...override?.hill },
  };
}

/** Compact mission summary for mode / rankings panels. */
export function formatSportsMeetMissionSummaryKo(
  mission: SportsMeetMissionBalance = SPORTS_MEET_MISSION_DEFAULTS,
): string {
  return `별${mission.drive.starCount}×4 · 덤프${mission.dig.dumpTruckCapacity} · 파쇄${mission.crash.asphaltTileCount} · 돌${mission.hill.successfulDumpsRequired} · 수해소각500`;
}

/** Idempotent reward event id for a ranked course-star pickup. */
export function sportsMeetStarEventId(runId: string, starId: string) {
  return `sm-star:${runId}:${starId}`;
}

/** Ranked course-star amount from eventId — must match server grant. */
export function sportsMeetStarRewardFromEventId(eventId: string) {
  return deterministicRewardInRange(
    eventId,
    SPORTS_MEET_STAR_REWARD_MIN,
    SPORTS_MEET_STAR_REWARD_MAX,
  );
}

/** @deprecated Prefer sportsMeetStarRewardFromEventId so toast matches server. */
export function rollSportsMeetStarReward() {
  return (
    SPORTS_MEET_STAR_REWARD_MIN +
    Math.floor(
      Math.random() *
        (SPORTS_MEET_STAR_REWARD_MAX - SPORTS_MEET_STAR_REWARD_MIN + 1),
    )
  );
}
