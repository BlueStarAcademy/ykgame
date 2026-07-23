import type { SitePoint } from "../siteLayout";
import {
  resolveSportsMeetMission,
  type DeepPartialMission,
  type SportsMeetMissionBalance,
} from "./missionBalance";
import { weekIndexFromWeekKey, getSportsMeetWeekKey } from "./weekKey";

export type SportsMeetStageKind = "drive" | "dig" | "crash" | "hill";

export type SportsMeetPatternId = 0 | 1 | 2 | 3 | 4;

export type SportsMeetZoneLayout = {
  dig: SitePoint;
  crash: SitePoint;
  hill: SitePoint;
};

export type SportsMeetPattern = {
  id: SportsMeetPatternId;
  code: string;
  nameKo: string;
  stageOrder: readonly [
    SportsMeetStageKind,
    SportsMeetStageKind,
    SportsMeetStageKind,
    SportsMeetStageKind,
  ];
  /** Polyline for course-clear stars (world XZ). */
  drivePath: readonly SitePoint[];
  /** Work-zone centers for this week's layout. Dig stays near dump truck. */
  zones: SportsMeetZoneLayout;
  missionOverride?: DeepPartialMission;
};

const CLASSIC_S_PATH: SitePoint[] = [
  [-20, -30],
  [-8, -18],
  [6, -28],
  [18, -12],
  [8, 2],
  [22, 8],
];

const WIDE_LOOP_PATH: SitePoint[] = [
  [-28, -28],
  [-10, -36],
  [12, -32],
  [28, -18],
  [22, 0],
  [4, 10],
  [-12, 4],
];

const TIGHT_ZIG_PATH: SitePoint[] = [
  [-16, -26],
  [-4, -14],
  [-14, -4],
  [0, 6],
  [-10, 16],
  [8, 20],
];

const MIRROR_DRIVE_PATH: SitePoint[] = [
  [40, -20],
  [55, -8],
  [70, -22],
  [85, -5],
  [95, 15],
  [80, 28],
];

/** Dig stays near dump (~33,-12) so soil unload stays fair across patterns. */
const ZONES_CLASSIC: SportsMeetZoneLayout = {
  dig: [18, 2],
  crash: [108, 12],
  hill: [22, 112],
};

const ZONES_WIDE: SportsMeetZoneLayout = {
  dig: [18, 2],
  crash: [100, 48],
  hill: [55, 118],
};

const ZONES_TIGHT: SportsMeetZoneLayout = {
  dig: [18, 2],
  crash: [72, 18],
  hill: [38, 88],
};

/** Crash/hill swapped (north asphalt, east rocks). */
const ZONES_MIRROR: SportsMeetZoneLayout = {
  dig: [18, 2],
  crash: [36, 108],
  hill: [108, 28],
};

export const SPORTS_MEET_PATTERNS: readonly SportsMeetPattern[] = [
  {
    id: 0,
    code: "classic_s",
    nameKo: "클래식 S",
    stageOrder: ["drive", "dig", "crash", "hill"],
    drivePath: CLASSIC_S_PATH,
    zones: ZONES_CLASSIC,
  },
  {
    id: 1,
    code: "wide_loop",
    nameKo: "와이드 루프",
    stageOrder: ["drive", "dig", "crash", "hill"],
    drivePath: WIDE_LOOP_PATH,
    zones: ZONES_WIDE,
  },
  {
    id: 2,
    code: "reverse_work",
    nameKo: "리버스 워크",
    stageOrder: ["hill", "crash", "dig", "drive"],
    drivePath: CLASSIC_S_PATH,
    zones: ZONES_CLASSIC,
  },
  {
    id: 3,
    code: "tight_zigzag",
    nameKo: "타이트 지그재그",
    stageOrder: ["drive", "crash", "dig", "hill"],
    drivePath: TIGHT_ZIG_PATH,
    zones: ZONES_TIGHT,
  },
  {
    id: 4,
    code: "mirror_reverse",
    nameKo: "미러 리버스",
    stageOrder: ["hill", "dig", "crash", "drive"],
    drivePath: MIRROR_DRIVE_PATH,
    zones: ZONES_MIRROR,
  },
] as const;

export const SPORTS_MEET_PATTERN_COUNT = SPORTS_MEET_PATTERNS.length;

export function resolveSportsMeetPatternId(weekKey: string): SportsMeetPatternId {
  const idx = weekIndexFromWeekKey(weekKey);
  return (Math.abs(idx) % SPORTS_MEET_PATTERN_COUNT) as SportsMeetPatternId;
}

export function getSportsMeetPattern(
  weekKey = getSportsMeetWeekKey(),
): SportsMeetPattern {
  const id = resolveSportsMeetPatternId(weekKey);
  return SPORTS_MEET_PATTERNS[id]!;
}

export function getSportsMeetPatternById(id: number): SportsMeetPattern | null {
  if (!Number.isInteger(id) || id < 0 || id >= SPORTS_MEET_PATTERN_COUNT) {
    return null;
  }
  return SPORTS_MEET_PATTERNS[id as SportsMeetPatternId]!;
}

export function getSportsMeetMissionForWeek(
  weekKey = getSportsMeetWeekKey(),
): SportsMeetMissionBalance {
  return resolveSportsMeetMission(getSportsMeetPattern(weekKey).missionOverride);
}

export const STAGE_LABEL_KO: Record<SportsMeetStageKind, string> = {
  drive: "주행",
  dig: "흙 하역",
  crash: "아스팔트",
  hill: "돌 하역",
};

export function formatStageOrderKo(
  order: readonly SportsMeetStageKind[],
): string {
  return order.map((s) => STAGE_LABEL_KO[s]).join("→");
}
