import type { SitePoint } from "../siteLayout";
import {
  resolveSportsMeetMission,
  type DeepPartialMission,
  type SportsMeetMissionBalance,
} from "./missionBalance";
import { weekIndexFromWeekKey, getSportsMeetWeekKey } from "./weekKey";

export type SportsMeetStageKind =
  | "drive"
  | "dig"
  | "crash"
  | "hill"
  | "flood";

export type SportsMeetPatternId = 0 | 1 | 2 | 3 | 4;

export type SportsMeetZoneLayout = {
  dig: SitePoint;
  crash: SitePoint;
  hill: SitePoint;
  flood: SitePoint;
};

/**
 * Linear sports-meet course:
 * drive → dig → drive → crash → drive → hill → drive → flood → drive(finish).
 * `drivePaths` has one polyline per drive stage (in order).
 * The last drive path is a short finish sprint after flood.
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
  "flood",
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
 * Long half-map routes: SW start → dig/dump → SE/E crash → NW hill → finish.
 * Dig stays near dump truck so soil unload stays fair.
 * Arena usable ≈ [-43, 139]; keep ~8u margin from walls.
 */
const LINEAR_ZONES: SportsMeetZoneLayout = {
  dig: [18, 2],
  crash: [120, 36],
  hill: [-8, 118],
  flood: [84, 118],
};

/** SW paddock with switchbacks into dig. */
const LINEAR_DRIVE_1: SitePoint[] = [
  [-36, -36],
  [-20, -38],
  [-4, -32],
  [12, -38],
  [28, -28],
  [16, -16],
  [0, -22],
  [-16, -12],
  [-4, -2],
  [8, -2],
];

/** dig exit → south loop → east zigzags → crash. */
const LINEAR_DRIVE_2: SitePoint[] = [
  [28, 0],
  [40, -18],
  [56, -36],
  [72, -30],
  [88, -38],
  [104, -24],
  [118, -10],
  [108, 8],
  [92, 20],
  [76, 8],
  [60, 22],
  [78, 34],
  [96, 22],
  [112, 30],
  [118, 36],
];

/** crash → west across midfield with S-curves → hill. */
const LINEAR_DRIVE_3: SitePoint[] = [
  [120, 48],
  [108, 62],
  [90, 52],
  [72, 68],
  [54, 54],
  [36, 70],
  [18, 56],
  [0, 72],
  [-18, 58],
  [-32, 74],
  [-20, 90],
  [0, 84],
  [16, 98],
  [0, 110],
  [-10, 116],
];

/**
 * hill → midfield loop → NE flood approach (stars guide the line like other legs).
 * Keep clear of walls (~8u) and avoid scribbling on the north rim.
 * Finish sprint after flood is a separate short path outside the flood radius.
 */
const LINEAR_DRIVE_4: SitePoint[] = [
  [-12, 116],
  [-28, 92],
  [-18, 66],
  [10, 50],
  [42, 58],
  [74, 48],
  [102, 62],
  [118, 86],
  [108, 112],
  [84, 124],
];

/** After flood: 5m straight finish outside flood radius (center [84,118], r=22). */
const LINEAR_DRIVE_FINISH: SitePoint[] = [
  [84, 88],
  [84, 83],
];

const LINEAR_PATHS = [
  LINEAR_DRIVE_1,
  LINEAR_DRIVE_2,
  LINEAR_DRIVE_3,
  LINEAR_DRIVE_4,
  LINEAR_DRIVE_FINISH,
] as const;

/** Wider arcs — same zones, bigger amplitude. */
const WIDE_DRIVE_1: SitePoint[] = [
  [-38, -38],
  [-22, -40],
  [-2, -34],
  [16, -40],
  [32, -30],
  [20, -14],
  [2, -24],
  [-18, -14],
  [-6, 0],
  [10, -2],
];
const WIDE_DRIVE_2: SitePoint[] = [
  [30, -2],
  [44, -20],
  [60, -38],
  [78, -32],
  [94, -40],
  [110, -26],
  [122, -8],
  [112, 12],
  [94, 24],
  [74, 10],
  [56, 26],
  [80, 38],
  [100, 24],
  [116, 34],
  [120, 38],
];
const WIDE_DRIVE_3: SitePoint[] = [
  [122, 50],
  [108, 66],
  [88, 54],
  [68, 72],
  [48, 56],
  [28, 74],
  [8, 58],
  [-12, 76],
  [-30, 62],
  [-36, 80],
  [-22, 96],
  [-2, 88],
  [18, 102],
  [2, 114],
  [-10, 118],
];
const WIDE_DRIVE_4: SitePoint[] = [
  [-14, 118],
  [-34, 94],
  [-26, 66],
  [4, 46],
  [40, 54],
  [78, 44],
  [108, 58],
  [122, 84],
  [110, 112],
  [86, 126],
];
const WIDE_DRIVE_FINISH: SitePoint[] = [
  [84, 88],
  [84, 83],
];

/** Tighter wiggles — denser switchbacks on a slightly inward corridor. */
const TIGHT_DRIVE_1: SitePoint[] = [
  [-32, -32],
  [-18, -36],
  [-2, -28],
  [14, -36],
  [24, -24],
  [12, -14],
  [-2, -20],
  [-14, -10],
  [0, -4],
  [8, 0],
];
const TIGHT_DRIVE_2: SitePoint[] = [
  [26, 2],
  [38, -14],
  [52, -32],
  [68, -26],
  [84, -34],
  [98, -20],
  [112, -6],
  [104, 12],
  [88, 18],
  [72, 6],
  [58, 20],
  [74, 32],
  [92, 20],
  [108, 28],
  [116, 34],
];
const TIGHT_DRIVE_3: SitePoint[] = [
  [118, 46],
  [104, 58],
  [88, 48],
  [70, 64],
  [52, 50],
  [34, 66],
  [16, 52],
  [-2, 68],
  [-20, 54],
  [-30, 70],
  [-16, 86],
  [2, 80],
  [14, 94],
  [-2, 108],
  [-8, 114],
];
const TIGHT_DRIVE_4: SitePoint[] = [
  [-10, 114],
  [-24, 90],
  [-14, 66],
  [12, 52],
  [40, 60],
  [68, 50],
  [94, 64],
  [110, 86],
  [98, 108],
  [74, 118],
];
const TIGHT_DRIVE_FINISH: SitePoint[] = [
  [84, 88],
  [84, 83],
];

const MIRROR_ZONES: SportsMeetZoneLayout = {
  dig: [18, 2],
  crash: [112, 52],
  hill: [20, 124],
  flood: [72, 114],
};

/** Mirror: crash sits NE, route fills SE then NW. */
const MIRROR_DRIVE_1: SitePoint[] = [
  [-34, -34],
  [-18, -38],
  [0, -30],
  [18, -38],
  [30, -26],
  [18, -12],
  [0, -20],
  [-14, -8],
  [2, -2],
  [10, 0],
];
const MIRROR_DRIVE_2: SitePoint[] = [
  [28, 4],
  [42, -16],
  [58, -34],
  [76, -22],
  [92, -36],
  [108, -18],
  [120, 0],
  [110, 18],
  [94, 32],
  [78, 18],
  [62, 34],
  [80, 48],
  [98, 36],
  [108, 48],
  [112, 52],
];
const MIRROR_DRIVE_3: SitePoint[] = [
  [110, 64],
  [94, 78],
  [76, 66],
  [58, 82],
  [40, 68],
  [22, 84],
  [4, 70],
  [-16, 86],
  [-30, 100],
  [-14, 112],
  [4, 104],
  [22, 116],
  [18, 122],
];
const MIRROR_DRIVE_4: SitePoint[] = [
  [24, 120],
  [48, 98],
  [40, 70],
  [12, 52],
  [-18, 58],
  [-34, 78],
  [-32, 104],
  [-20, 122],
  [-4, 128],
];
/** After flood (mirror center [72,114]): 5m finish south of the zone. */
const MIRROR_DRIVE_FINISH: SitePoint[] = [
  [72, 84],
  [72, 79],
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
    [WIDE_DRIVE_1, WIDE_DRIVE_2, WIDE_DRIVE_3, WIDE_DRIVE_4, WIDE_DRIVE_FINISH],
    LINEAR_ZONES,
  ),
  makePattern(
    2,
    "linear_tight",
    "직선 타이트",
    [TIGHT_DRIVE_1, TIGHT_DRIVE_2, TIGHT_DRIVE_3, TIGHT_DRIVE_4, TIGHT_DRIVE_FINISH],
    LINEAR_ZONES,
  ),
  makePattern(
    3,
    "linear_sweep",
    "직선 스윕",
    [LINEAR_DRIVE_1, WIDE_DRIVE_2, TIGHT_DRIVE_3, LINEAR_DRIVE_4, LINEAR_DRIVE_FINISH],
    LINEAR_ZONES,
  ),
  makePattern(
    4,
    "linear_mirror",
    "직선 미러",
    [MIRROR_DRIVE_1, MIRROR_DRIVE_2, MIRROR_DRIVE_3, MIRROR_DRIVE_4, MIRROR_DRIVE_FINISH],
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

/** Final drive to the FINISH gate (stars required, then gate). */
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
  // Finish sprint: gate only — no stars on the short 5m leg.
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
  const flood = pattern.zones.flood;
  const p0 = pattern.drivePaths[0];
  const p1 = pattern.drivePaths[1];
  const p2 = pattern.drivePaths[2];
  const p3 = pattern.drivePaths[3];
  const p4 = pattern.drivePaths[4];

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
    const end = p3[p3.length - 1];
    if (end) segs.push({ from: end, to: flood });
  }
  // Finish sprint sits outside the flood pad — connect from flood rim, not through it.
  if (p4) {
    const start = p4[0];
    if (start) segs.push({ from: flood, to: start });
    pushPath(p4);
  }

  return segs;
}

export const STAGE_LABEL_KO: Record<SportsMeetStageKind, string> = {
  drive: "주행",
  dig: "흙 하역",
  crash: "아스팔트",
  hill: "돌 하역",
  flood: "수해복구",
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
