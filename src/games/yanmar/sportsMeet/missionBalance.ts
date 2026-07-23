/** Tunable sports-meet mission quotas — edit here to rebalance. */

export const SPORTS_MEET_MISSION_DEFAULTS = {
  drive: {
    starCount: 10,
    speedBuffCount: 2,
  },
  dig: {
    digPileCapacity: 15_000,
    dumpTruckCapacity: 12_000,
  },
  crash: {
    asphaltTileCount: 12,
  },
  hill: {
    boulderCount: 5,
    successfulDumpsRequired: 5,
    /** 적재 실패 시 동일 돌 재사용 확률 (1 = 100%) */
    failedLoadReuseChance: 1,
  },
} as const;

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
