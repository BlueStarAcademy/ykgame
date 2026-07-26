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

/**
 * Linear sports-meet course:
 * drive → dig → drive → crash → drive → hill → drive(finish sprint).
 * `drivePaths` has one polyline per drive stage (in order).
 */
export type SportsMeetPattern = {
  id: SportsMeetPatternId;
  code: string;
  nameKo: string;
  stageOrder: readonly SportsMeetStageKind[];
  /** One path per drive stage occurrence (same count as drive stages). */
  drivePaths: readonly (readonly SitePoint[])[];
  /**
   * Full course polyline (legs joined) — used for speed buffs / track paint.
   * Prefer `drivePaths` for stage waypoints and stars.
   */
  drivePath: readonly SitePoint[];
  /** Work-zone centers. Dig stays near dump truck (~33,-12). */
  zones: SportsMeetZoneLayout;
  missionOverride?: DeepPartialMission;
};

/** Fixed stage sequence for the excavator sports meet. */
export const SPORTS_MEET_LINEAR_STAGE_ORDER = [
  "drive",
  "dig",
  "drive",
  "crash",
  "drive",
  "hill",
  "drive",
] as const satisfies readonly SportsMeetStageKind[];

function joinDrivePaths(
  paths: readonly (readonly SitePoint[])[],
): SitePoint[] {
  const out: SitePoint[] = [];
  for (const path of paths) {
    for (const p of path) {
      const last = out[out.length - 1];
      if (last && last[0] === p[0] && last[1] === p[1]) continue;
      out.push(p);
    }
  }
  return out;
}

/**
 * West→east corridor through dig/dump, then crash, then north to hill.
 * Dig stays near dump truck so soil unload stays fair.
 */
const LINEAR_ZONES: SportsMeetZoneLayout = {
  dig: [18, 2],
  crash: [108, 12],
  hill: [28, 108],
};

const LINEAR_DRIVE_1: SitePoint[] = [
  [-28, -22],
  [-18, -20],
  [-8, -14],
  [2, -6],
  [8, -2],
];

/** dig exit → crash approach with S-curves (stars sit on bends). */
const LINEAR_DRIVE_2: SitePoint[] = [
  [28, 0],
  [38, -12],
  [48, -16],
  [60, 8],
  [72, -10],
  [84, 8],
  [94, 14],
  [100, 12],
];

/** crash exit → hill with sweeping curves. */
const LINEAR_DRIVE_3: SitePoint[] = [
  [108, 28],
  [96, 38],
  [88, 48],
  [106, 60],
  [90, 70],
  [68, 80],
  [48, 92],
  [34, 100],
];

/** hill exit → short finish sprint (no stars). */
const LINEAR_DRIVE_4: SitePoint[] = [
  [22, 116],
  [8, 126],
  [-6, 134],
  [-18, 140],
];

const LINEAR_PATHS = [
  LINEAR_DRIVE_1,
  LINEAR_DRIVE_2,
  LINEAR_DRIVE_3,
  LINEAR_DRIVE_4,
] as const;

/** Slight path wiggles for weekly visual variety — same zones & stage order. */
const WIDE_DRIVE_1: SitePoint[] = [
  [-30, -26],
  [-20, -24],
  [-8, -16],
  [2, -8],
  [10, -2],
];
const WIDE_DRIVE_2: SitePoint[] = [
  [30, -4],
  [42, -16],
  [54, -20],
  [66, 12],
  [78, -8],
  [90, 10],
  [100, 16],
  [104, 12],
];
const WIDE_DRIVE_3: SitePoint[] = [
  [110, 30],
  [96, 40],
  [84, 50],
  [110, 64],
  [92, 74],
  [68, 84],
  [46, 96],
  [32, 104],
];
const WIDE_DRIVE_4: SitePoint[] = [
  [24, 114],
  [10, 124],
  [-4, 132],
  [-16, 138],
];

const TIGHT_DRIVE_1: SitePoint[] = [
  [-24, -18],
  [-14, -16],
  [-4, -10],
  [4, -2],
  [10, 0],
];
const TIGHT_DRIVE_2: SitePoint[] = [
  [26, 2],
  [36, -8],
  [46, -12],
  [58, 6],
  [70, -8],
  [82, 6],
  [92, 12],
  [100, 12],
];
const TIGHT_DRIVE_3: SitePoint[] = [
  [106, 26],
  [94, 36],
  [86, 46],
  [102, 56],
  [86, 66],
  [66, 76],
  [48, 90],
  [36, 98],
];
const TIGHT_DRIVE_4: SitePoint[] = [
  [26, 112],
  [12, 122],
  [-2, 130],
  [-14, 136],
];

const MIRROR_ZONES: SportsMeetZoneLayout = {
  dig: [18, 2],
  crash: [100, 28],
  hill: [42, 112],
};

const MIRROR_DRIVE_1: SitePoint[] = [
  [-26, -20],
  [-16, -18],
  [-4, -12],
  [4, -4],
  [10, -1],
];
const MIRROR_DRIVE_2: SitePoint[] = [
  [28, 4],
  [40, -6],
  [50, -10],
  [62, 18],
  [74, 2],
  [86, 20],
  [94, 30],
  [96, 28],
];
const MIRROR_DRIVE_3: SitePoint[] = [
  [98, 42],
  [84, 52],
  [74, 60],
  [94, 74],
  [78, 84],
  [60, 94],
  [50, 104],
  [44, 108],
];
const MIRROR_DRIVE_4: SitePoint[] = [
  [36, 120],
  [22, 130],
  [8, 138],
  [-4, 144],
];

function makePattern(
  id: SportsMeetPatternId,
  code: string,
  nameKo: string,
  paths: readonly (readonly SitePoint[])[],
  zones: SportsMeetZoneLayout,
): SportsMeetPattern {
  return {
    id,
    code,
    nameKo,
    stageOrder: SPORTS_MEET_LINEAR_STAGE_ORDER,
    drivePaths: paths,
    drivePath: joinDrivePaths(paths),
    zones,
  };
}

export const SPORTS_MEET_PATTERNS: readonly SportsMeetPattern[] = [
  makePattern(0, "linear_classic", "직선 클래식", LINEAR_PATHS, LINEAR_ZONES),
  makePattern(
    1,
    "linear_wide",
    "직선 와이드",
    [WIDE_DRIVE_1, WIDE_DRIVE_2, WIDE_DRIVE_3, WIDE_DRIVE_4],
    LINEAR_ZONES,
  ),
  makePattern(
    2,
    "linear_tight",
    "직선 타이트",
    [TIGHT_DRIVE_1, TIGHT_DRIVE_2, TIGHT_DRIVE_3, TIGHT_DRIVE_4],
    LINEAR_ZONES,
  ),
  makePattern(
    3,
    "linear_sweep",
    "직선 스윕",
    [LINEAR_DRIVE_1, WIDE_DRIVE_2, TIGHT_DRIVE_3, LINEAR_DRIVE_4],
    LINEAR_ZONES,
  ),
  makePattern(
    4,
    "linear_mirror",
    "직선 미러",
    [MIRROR_DRIVE_1, MIRROR_DRIVE_2, MIRROR_DRIVE_3, MIRROR_DRIVE_4],
    MIRROR_ZONES,
  ),
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

/** How many drive stages appear before (and including) `stageIndex`. */
export function driveLegIndexAtStage(
  stageOrder: readonly SportsMeetStageKind[],
  stageIndex: number,
): number {
  let driveIdx = -1;
  for (let i = 0; i <= stageIndex && i < stageOrder.length; i++) {
    if (stageOrder[i] === "drive") driveIdx += 1;
  }
  return Math.max(0, driveIdx);
}

/** Final short drive to the FINISH gate (no course stars). */
export function isSportsMeetFinishDriveStage(
  stageOrder: readonly SportsMeetStageKind[],
  stageIndex: number,
) {
  return (
    stageOrder[stageIndex] === "drive" &&
    stageIndex === stageOrder.length - 1
  );
}

export function sportsMeetDriveStarQuota(
  mission: SportsMeetMissionBalance,
  stageOrder: readonly SportsMeetStageKind[],
  stageIndex: number,
) {
  if (stageOrder[stageIndex] !== "drive") return 0;
  if (isSportsMeetFinishDriveStage(stageOrder, stageIndex)) return 0;
  return mission.drive.starCount;
}

export function getDrivePathForStage(
  pattern: SportsMeetPattern,
  stageIndex: number,
): readonly SitePoint[] {
  const stage = pattern.stageOrder[stageIndex];
  if (stage !== "drive") {
    return pattern.drivePaths[0] ?? pattern.drivePath;
  }
  const leg = driveLegIndexAtStage(pattern.stageOrder, stageIndex);
  return pattern.drivePaths[leg] ?? pattern.drivePath;
}

/** World pose for the arena FINISH gate (end of final drive path). */
export function getSportsMeetFinishGate(pattern: SportsMeetPattern) {
  const path =
    pattern.drivePaths[pattern.drivePaths.length - 1] ?? pattern.drivePath;
  const end = path[path.length - 1] ?? ([0, 0] as SitePoint);
  const prev = path[path.length - 2] ?? end;
  // Face the approaching machine (toward previous path point).
  const rotationY = Math.atan2(prev[0] - end[0], prev[1] - end[1]);
  return {
    x: end[0],
    z: end[1],
    rotationY,
    radius: 4.2,
  } as const;
}

/** Track segments for arena paint: drive legs + connectors into work zones. */
export function getSportsMeetTrackSegments(
  pattern: SportsMeetPattern,
): Array<{ from: SitePoint; to: SitePoint }> {
  const segs: Array<{ from: SitePoint; to: SitePoint }> = [];
  const pushPath = (path: readonly SitePoint[]) => {
    for (let i = 0; i < path.length - 1; i++) {
      segs.push({ from: path[i]!, to: path[i + 1]! });
    }
  };

  const dig = pattern.zones.dig;
  const crash = pattern.zones.crash;
  const hill = pattern.zones.hill;
  const p0 = pattern.drivePaths[0];
  const p1 = pattern.drivePaths[1];
  const p2 = pattern.drivePaths[2];
  const p3 = pattern.drivePaths[3];

  if (p0) {
    pushPath(p0);
    const end = p0[p0.length - 1];
    if (end) segs.push({ from: end, to: dig });
  }
  segs.push({ from: dig, to: [33.27, -12.68] });
  if (p1) {
    const start = p1[0];
    if (start) segs.push({ from: dig, to: start });
    pushPath(p1);
    const end = p1[p1.length - 1];
    if (end) segs.push({ from: end, to: crash });
  }
  if (p2) {
    const start = p2[0];
    if (start) segs.push({ from: crash, to: start });
    pushPath(p2);
    const end = p2[p2.length - 1];
    if (end) segs.push({ from: end, to: hill });
  }
  if (p3) {
    const start = p3[0];
    if (start) segs.push({ from: hill, to: start });
    pushPath(p3);
  }

  return segs;
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
  return order
    .map((s, i) =>
      isSportsMeetFinishDriveStage(order, i) ? "골인" : STAGE_LABEL_KO[s],
    )
    .join("→");
}
