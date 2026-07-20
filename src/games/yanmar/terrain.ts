import {
  applyCrashAsphaltPad,
  applyExpansionRoads,
  applyTruckDeparturePad,
  applyZoneMoundHeight,
  computeBaseTerrainHeight,
} from "./terrainShapes";
import {
  getGridSizeForTier,
  getMapTierForLevel,
  type MapTier,
} from "./mapTier";

export const GRID_SIZE = 64;
export const CELL_SIZE = 2;
export const DIG_ZONE_CAPACITY_UNITS = 8000;
export const DIG_ZONE_CAPACITY_MIN = 8000;
export const DIG_ZONE_CAPACITY_MAX = 8000;
export const DIG_ZONE_CAPACITY_STEP = 100;
export const DIG_ZONE_COUNT = 2;
export const DIG_ZONE_RESPAWN_MS = 60 * 1000;
/** 아스팔트·돌 구역: 이탈 후(또는 전량 소진 후) 풀 리젠까지 대기. */
export const CRASH_ZONE_RESPAWN_MS = 5 * 60 * 1000;
export const CRASH_TILE_MAX_HP = 2000;
export const CRASH_HIT_DAMAGE = 10;
/** 활성 아스팔트 타일 상단이 sampleHeight 위로 올라온 높이 (풀 HP). CrashZoneDecor와 동기. */
export const CRASH_ASPHALT_SURFACE_TOP = 0.22;
/** 타일 파괴 진행에 따라 상단이 내려가는 최대량. */
export const CRASH_ASPHALT_SURFACE_SINK = 0.1;
/** 아스팔트 박스 중심 Y (풀 HP 기준, sampleHeight 상대). */
export const CRASH_ASPHALT_BOX_CENTER_Y = 0.12;
export const CRASH_ASPHALT_BOX_THICKNESS = 0.2;
export const HAUL_TRUCK_COOLDOWN_SEC = 300;
export const HAUL_TRUCK_CAPACITY = 5;
/** 돌트럭 시동·출발·복귀 주차 시간 (흙트럭과 동일). */
export const HAUL_TRUCK_ENGINE_START_SEC = 2.2;
export const HAUL_TRUCK_DEPART_SEC = 5.8;
export const HAUL_TRUCK_ARRIVE_SEC = 10;
export const HILL_BOULDER_COUNT = 5;
/** 돌 구역: 이탈 후(또는 전량 반출 후) 풀 리젠까지 대기. */
export const HILL_ZONE_RESPAWN_MS = 300 * 1000;
/** 채취량은 유지하되 화면에 보이는 지형 침하는 완만하게 제한한다. */
const DIG_TERRAIN_DEFORMATION_SCALE = 0.16;
const DIG_TERRAIN_MAX_DEPTH = 0.28;

export interface DigZone {
  id: string;
  x: number;
  z: number;
  radius: number;
  capacityUnits: number;
  remainingUnits: number;
  active: boolean;
  depletedAt: number | null;
  respawnAt: number | null;
}

export interface CrashTile {
  id: string;
  row: number;
  col: number;
  hp: number;
  maxHp: number;
  active: boolean;
}

export interface CrashZone {
  id: string;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
  active: boolean;
  tiles: CrashTile[];
  clearedAt: number | null;
  respawnAt: number | null;
}

export interface HillBoulder {
  id: string;
  x: number;
  z: number;
  active: boolean;
  delivered: boolean;
  /** 집어서 구역 밖으로 반출되었거나 트럭에 적재됨. */
  extracted: boolean;
  /** 0~1 — 클수록 밀착감↓ (비주얼 스케일과 동기). */
  size: number;
  /** 0~1 — 둥글수록 밀착감↓. */
  roundness: number;
  /** 기하 중심 대비 무게중심 X 오프셋. */
  comOffsetX: number;
  /** 기하 중심 대비 무게중심 Z 오프셋. */
  comOffsetZ: number;
}

/** PremiumBoulder와 동일한 월드 스케일 (size 0→0.55, 1→0.9). */
export function hillBoulderVisualScale(size: number): number {
  return 0.55 + Math.max(0, Math.min(1, size)) * 0.35;
}

export function createHillBoulderAttrs(index: number): Pick<
  HillBoulder,
  "size" | "roundness" | "comOffsetX" | "comOffsetZ"
> {
  const size = (index % 5) / 4;
  const roundness = index % 2;
  const comOffsetX = (((index * 17) % 7) / 7) * 0.35 - 0.175;
  const comOffsetZ = (((index * 29) % 7) / 7) * 0.35 - 0.175;
  return { size, roundness, comOffsetX, comOffsetZ };
}

export interface HaulTruckState {
  phase: "ready" | "engineStart" | "departing" | "cooldown" | "arriving";
  loadCount: number;
  cooldownRemaining: number;
  phaseElapsed: number;
}

export interface HillZone {
  id: string;
  centerX: number;
  centerZ: number;
  radius: number;
  dropX: number;
  dropZ: number;
  active: boolean;
  boulders: HillBoulder[];
  haulTruck: HaulTruckState;
  clearedAt: number | null;
  respawnAt: number | null;
}

export interface TerrainData {
  heights: Float32Array;
  baseHeights: Float32Array;
  digZones: DigZone[];
  crashZone: CrashZone | null;
  hillZone: HillZone | null;
  mapTier: MapTier;
  dynamicDigZones: boolean;
  gridSizeX: number;
  gridSizeZ: number;
  cellSize: number;
  originX: number;
  originZ: number;
}

export function getMapWorldBounds(terrain: TerrainData) {
  return {
    minX: terrain.originX,
    maxX: terrain.originX + terrain.gridSizeX * terrain.cellSize,
    minZ: terrain.originZ,
    maxZ: terrain.originZ + terrain.gridSizeZ * terrain.cellSize,
  };
}

export function createTerrain(
  originX = -48,
  originZ = -48,
  dynamicDigZones = false,
  playerLevel = 1,
): TerrainData {
  const mapTier = getMapTierForLevel(playerLevel);
  const { gridSizeX, gridSizeZ } = getGridSizeForTier(mapTier);
  const heights = new Float32Array(gridSizeX * gridSizeZ);
  const digZones = dynamicDigZones
    ? createRandomDigZones(originX, originZ, gridSizeX, gridSizeZ)
    : [createDigZone("practice-dig", DIG_ZONE.x, DIG_ZONE.z)];
  const crashZone = mapTier >= 2 ? createCrashZone() : null;
  const hillZone = mapTier >= 3 ? createHillZone() : null;
  for (let gz = 0; gz < gridSizeZ; gz++) {
    for (let gx = 0; gx < gridSizeX; gx++) {
      const idx = gz * gridSizeX + gx;
      const wx = originX + (gx + 0.5) * CELL_SIZE;
      const wz = originZ + (gz + 0.5) * CELL_SIZE;
      const zone =
        digZones.find((item) => distance(wx, wz, item.x, item.z) < item.radius) ?? null;
      let next = applyTruckDeparturePad(
        wx,
        wz,
        computeBaseTerrainHeight(wx, wz, zone, {
          x: DUMP_ZONE.x,
          z: DUMP_ZONE.z,
          radius: DUMP_ZONE.radius + 4,
        }),
        {
          groupX: DUMP_TRUCK.groupX,
          groupZ: DUMP_TRUCK.groupZ,
          rotation: DUMP_TRUCK.rotation,
        },
      );
      if (mapTier >= 2 && crashZone) {
        next = applyExpansionRoads(wx, wz, next, mapTier);
        next = applyCrashAsphaltPad(wx, wz, next, crashZone);
      }
      if (mapTier >= 3 && hillZone) {
        next = applyExpansionRoads(wx, wz, next, mapTier);
      }
      heights[idx] = next;
    }
  }
  return {
    heights,
    baseHeights: heights.slice(),
    digZones,
    crashZone,
    hillZone,
    mapTier,
    dynamicDigZones,
    gridSizeX,
    gridSizeZ,
    cellSize: CELL_SIZE,
    originX,
    originZ,
  };
}

export function expandTerrainForLevel(
  current: TerrainData,
  playerLevel: number,
): TerrainData {
  const nextTier = getMapTierForLevel(playerLevel);
  if (nextTier <= current.mapTier) return current;
  const expanded = createTerrain(
    current.originX,
    current.originZ,
    current.dynamicDigZones,
    playerLevel,
  );
  expanded.digZones = cloneDigZones(current.digZones);
  const copyX = Math.min(current.gridSizeX, expanded.gridSizeX);
  const copyZ = Math.min(current.gridSizeZ, expanded.gridSizeZ);
  for (let gz = 0; gz < copyZ; gz++) {
    for (let gx = 0; gx < copyX; gx++) {
      const from = gz * current.gridSizeX + gx;
      const to = gz * expanded.gridSizeX + gx;
      expanded.heights[to] = current.heights[from];
      expanded.baseHeights[to] = current.baseHeights[from];
    }
  }
  rebakeSpecialSiteSurfaces(expanded);
  return expanded;
}

export function rebakeSpecialSiteSurfaces(terrain: TerrainData) {
  for (let gz = 0; gz < terrain.gridSizeZ; gz++) {
    for (let gx = 0; gx < terrain.gridSizeX; gx++) {
      const index = gz * terrain.gridSizeX + gx;
      const wx = terrain.originX + (gx + 0.5) * terrain.cellSize;
      const wz = terrain.originZ + (gz + 0.5) * terrain.cellSize;
      let current = terrain.heights[index];
      let base = terrain.baseHeights[index];
      if (terrain.mapTier >= 2) {
        current = applyExpansionRoads(wx, wz, current, terrain.mapTier);
        base = applyExpansionRoads(wx, wz, base, terrain.mapTier);
        if (terrain.crashZone) {
          current = applyCrashAsphaltPad(wx, wz, current, terrain.crashZone);
          base = applyCrashAsphaltPad(wx, wz, base, terrain.crashZone);
        }
      }
      terrain.heights[index] = current;
      terrain.baseHeights[index] = base;
    }
  }
  flattenStoneZoneHeights(terrain);
}

/** Strip legacy hill elevation so the stone zone sits on flat ground. */
export function flattenStoneZoneHeights(terrain: TerrainData) {
  const zone = terrain.hillZone;
  if (!zone) return;
  const influence = zone.radius + 8;
  const dumpPad = {
    x: DUMP_ZONE.x,
    z: DUMP_ZONE.z,
    radius: DUMP_ZONE.radius + 4,
  };
  const truckPad = {
    groupX: DUMP_TRUCK.groupX,
    groupZ: DUMP_TRUCK.groupZ,
    rotation: DUMP_TRUCK.rotation,
  };
  for (let gz = 0; gz < terrain.gridSizeZ; gz++) {
    for (let gx = 0; gx < terrain.gridSizeX; gx++) {
      const index = gz * terrain.gridSizeX + gx;
      const wx = terrain.originX + (gx + 0.5) * terrain.cellSize;
      const wz = terrain.originZ + (gz + 0.5) * terrain.cellSize;
      if (distance(wx, wz, zone.centerX, zone.centerZ) >= influence) continue;
      const digZone =
        terrain.digZones.find(
          (item) => distance(wx, wz, item.x, item.z) < item.radius,
        ) ?? null;
      let next = applyTruckDeparturePad(
        wx,
        wz,
        computeBaseTerrainHeight(wx, wz, digZone, dumpPad),
        truckPad,
      );
      if (terrain.mapTier >= 2) {
        next = applyExpansionRoads(wx, wz, next, terrain.mapTier);
        if (terrain.crashZone) {
          next = applyCrashAsphaltPad(wx, wz, next, terrain.crashZone);
        }
      }
      const dug = Math.max(0, terrain.baseHeights[index] - terrain.heights[index]);
      terrain.baseHeights[index] = next;
      terrain.heights[index] = Math.max(0, next - dug);
    }
  }
}

export function worldToCell(
  terrain: TerrainData,
  wx: number,
  wz: number,
): { gx: number; gz: number } | null {
  const gx = Math.floor((wx - terrain.originX) / terrain.cellSize);
  const gz = Math.floor((wz - terrain.originZ) / terrain.cellSize);
  if (gx < 0 || gz < 0 || gx >= terrain.gridSizeX || gz >= terrain.gridSizeZ) {
    return null;
  }
  return { gx, gz };
}

export function getHeight(terrain: TerrainData, gx: number, gz: number): number {
  return terrain.heights[gz * terrain.gridSizeX + gx];
}

export function digAt(
  terrain: TerrainData,
  wx: number,
  wz: number,
  radius: number,
  amount: number,
): number {
  const cell = worldToCell(terrain, wx, wz);
  if (!cell) return 0;
  const activeZone = getActiveDigZoneAt(terrain, wx, wz);
  if (!activeZone) return 0;

  let dug = 0;
  const rCells = Math.ceil(radius / terrain.cellSize);

  for (let dz = -rCells; dz <= rCells; dz++) {
    for (let dx = -rCells; dx <= rCells; dx++) {
      const gx = cell.gx + dx;
      const gz = cell.gz + dz;
      if (gx < 0 || gz < 0 || gx >= terrain.gridSizeX || gz >= terrain.gridSizeZ) continue;

      const dist = Math.sqrt(dx * dx + dz * dz) * terrain.cellSize;
      if (dist > radius) continue;

      const idx = gz * terrain.gridSizeX + gx;
      const take = amount * (1 - dist / radius);
      const minVisualHeight = terrain.baseHeights[idx] - DIG_TERRAIN_MAX_DEPTH;
      const visualTake = Math.min(
        take * DIG_TERRAIN_DEFORMATION_SCALE,
        Math.max(0, terrain.heights[idx] - minVisualHeight),
      );
      terrain.heights[idx] -= visualTake;
      dug += take;
    }
  }
  return dug;
}

/** Consume Dig zone soil in the same units as bucket/truck load. */
export function consumeDigZoneUnits(
  terrain: TerrainData,
  wx: number,
  wz: number,
  units: number,
): number {
  if (!terrain.dynamicDigZones || units <= 0) return 0;
  const zone = getActiveDigZoneAt(terrain, wx, wz);
  if (!zone) return 0;
  const consumed = Math.min(zone.remainingUnits, units);
  zone.remainingUnits = Math.max(0, zone.remainingUnits - consumed);
  if (zone.remainingUnits <= 0 && zone.active) {
    depleteDigZone(terrain, zone);
  }
  return consumed;
}

export function sampleHeight(terrain: TerrainData, wx: number, wz: number): number {
  const fx = (wx - terrain.originX) / terrain.cellSize - 0.5;
  const fz = (wz - terrain.originZ) / terrain.cellSize - 0.5;
  if (
    fx < -0.5 ||
    fz < -0.5 ||
    fx > terrain.gridSizeX - 0.5 ||
    fz > terrain.gridSizeZ - 0.5
  ) {
    return 0;
  }
  const clampedFx = Math.max(0, Math.min(terrain.gridSizeX - 1, fx));
  const clampedFz = Math.max(0, Math.min(terrain.gridSizeZ - 1, fz));
  const x0 = Math.floor(clampedFx);
  const z0 = Math.floor(clampedFz);
  const x1 = Math.min(terrain.gridSizeX - 1, x0 + 1);
  const z1 = Math.min(terrain.gridSizeZ - 1, z0 + 1);
  const tx = clampedFx - x0;
  const tz = clampedFz - z0;
  const h00 = getHeight(terrain, x0, z0);
  const h10 = getHeight(terrain, x1, z0);
  const h01 = getHeight(terrain, x0, z1);
  const h11 = getHeight(terrain, x1, z1);
  const top = h00 + (h10 - h00) * tx;
  const bottom = h01 + (h11 - h01) * tx;
  return top + (bottom - top) * tz;
}

/** 굴착·덤프 구역 (확장 맵 기준) */
export const DIG_ZONE = { x: 4, z: 18, radius: 12 };

/**
 * 덤프트럭 주차 패드 지형 높이 (applyTruckDeparturePad target).
 * PremiumDumpTruckModel: bodyY 0.78 + wheelCenter 0.4 − radius 0.52 = 휠 바닥 로컬 0.66
 */
export const DUMP_TRUCK_GROUND_Y = 0.71;
export const DUMP_TRUCK_BODY_LOCAL_Y = 0.78;
export const DUMP_TRUCK_WHEEL_CENTER_LOCAL_Y = 0.4;
export const DUMP_TRUCK_WHEEL_RADIUS = 0.52;
export const DUMP_TRUCK_WHEEL_BOTTOM_LOCAL_Y =
  DUMP_TRUCK_BODY_LOCAL_Y +
  DUMP_TRUCK_WHEEL_CENTER_LOCAL_Y -
  DUMP_TRUCK_WHEEL_RADIUS;
/** outer group world Y — 휠이 주차 패드에 닿도록 */
export const DUMP_TRUCK_GROUP_Y =
  DUMP_TRUCK_GROUND_Y - DUMP_TRUCK_WHEEL_BOTTOM_LOCAL_Y;

/** DumpTruck.tsx 외부 group — ExcavatorScene 3D 모델과 동일 */
export const DUMP_TRUCK = {
  groupX: 33.27,
  groupZ: -12.68,
  rotation: -0.36,
  /** inner group 0.3 + bed deck mesh -0.65 */
  bedLocalX: -0.35,
  bedLocalZ: 0,
  bedWidth: 5.2,
  bedDepth: 2.86,
  /** 버킷 접점이 칸 안인지 판정 (여유 있게 — 쉬운 난이도) */
  margin: 0.45,
  /** 버킷을 펼 때 차체 위치 여유 */
  bodyMargin: 0.85,
  /**
   * 적재함 덱 상단 월드 Y
   * groupY + bodyY + DumpBed(1.05) + floor(-0.36) + halfH(0.08)
   */
  bedDeckWorldY:
    DUMP_TRUCK_GROUP_Y + DUMP_TRUCK_BODY_LOCAL_Y + 1.05 - 0.36 + 0.08,
  /** 칸 위에서 하역 판정 최소 높이 (덱 대비) — 트럭 위로 암을 올려야 함 */
  dumpMinHeightAboveDeck: 0.95,
} as const;

/**
 * 돌트럭 주차 — 돌지역 중심(22,112)에서 남동쪽으로 약간 떨어진 하역장.
 * rotation +π/2 → 모델 전방(로컬 +X)이 월드 −Z(남쪽), 퇴장로·진입로와 일치.
 */
export const HAUL_TRUCK = {
  groupX: 42,
  groupZ: 100,
  rotation: Math.PI / 2,
} as const;

/** 트럭 고체 껍데기 — 칸 내부 공동은 비움 (하역 공간) */
export const DUMP_TRUCK_SOLID = {
  centerLocalX: -0.08,
  centerLocalZ: 0,
  halfX: 3.4,
  halfZ: 1.85,
  minY: DUMP_TRUCK_GROUND_Y + 0.08,
  maxY: DUMP_TRUCK_GROUP_Y + DUMP_TRUCK_BODY_LOCAL_Y + 2.55,
  cavityHalfX: DUMP_TRUCK.bedWidth / 2 - 0.18,
  cavityHalfZ: DUMP_TRUCK.bedDepth / 2 - 0.15,
  cavityMinY: DUMP_TRUCK.bedDeckWorldY - 0.55,
  cavityMaxY: DUMP_TRUCK.bedDeckWorldY + 1.15,
} as const;

export function dumpTruckLocalToWorld(
  localX: number,
  localZ: number,
  groupX: number = DUMP_TRUCK.groupX,
  groupZ: number = DUMP_TRUCK.groupZ,
) {
  const cos = Math.cos(DUMP_TRUCK.rotation);
  const sin = Math.sin(DUMP_TRUCK.rotation);
  return {
    x: groupX + localX * cos + localZ * sin,
    z: groupZ - localX * sin + localZ * cos,
  };
}

export function dumpTruckBedCenterWorld(
  groupX: number = DUMP_TRUCK.groupX,
  groupZ: number = DUMP_TRUCK.groupZ,
) {
  return dumpTruckLocalToWorld(DUMP_TRUCK.bedLocalX, DUMP_TRUCK.bedLocalZ, groupX, groupZ);
}

export function worldToDumpTruckLocal(
  wx: number,
  wz: number,
  groupX: number = DUMP_TRUCK.groupX,
  groupZ: number = DUMP_TRUCK.groupZ,
) {
  const cos = Math.cos(DUMP_TRUCK.rotation);
  const sin = Math.sin(DUMP_TRUCK.rotation);
  const dx = wx - groupX;
  const dz = wz - groupZ;
  return {
    x: dx * cos - dz * sin,
    z: dx * sin + dz * cos,
  };
}

export function dumpTruckBedDeckWorldY() {
  return DUMP_TRUCK.bedDeckWorldY;
}

export function isInDumpTruckSolidVolume(
  wx: number,
  wy: number,
  wz: number,
  groupX: number = DUMP_TRUCK.groupX,
  groupZ: number = DUMP_TRUCK.groupZ,
): boolean {
  if (wy < DUMP_TRUCK_SOLID.minY || wy > DUMP_TRUCK_SOLID.maxY) return false;
  const local = worldToDumpTruckLocal(wx, wz, groupX, groupZ);
  const hullX = local.x - DUMP_TRUCK_SOLID.centerLocalX;
  const hullZ = local.z - DUMP_TRUCK_SOLID.centerLocalZ;
  if (Math.abs(hullX) > DUMP_TRUCK_SOLID.halfX || Math.abs(hullZ) > DUMP_TRUCK_SOLID.halfZ) {
    return false;
  }
  const bedRelX = local.x - DUMP_TRUCK.bedLocalX;
  const bedRelZ = local.z - DUMP_TRUCK.bedLocalZ;
  const inBedCavity =
    wy >= DUMP_TRUCK_SOLID.cavityMinY &&
    wy <= DUMP_TRUCK_SOLID.cavityMaxY &&
    Math.abs(bedRelX) <= DUMP_TRUCK_SOLID.cavityHalfX &&
    Math.abs(bedRelZ) <= DUMP_TRUCK_SOLID.cavityHalfZ;
  return !inBedCavity;
}

export function clampToDumpTruckBed(
  wx: number,
  wz: number,
  inset = 0.08,
  groupX: number = DUMP_TRUCK.groupX,
  groupZ: number = DUMP_TRUCK.groupZ,
) {
  const local = worldToDumpTruckLocal(wx, wz, groupX, groupZ);
  const relX = local.x - DUMP_TRUCK.bedLocalX;
  const relZ = local.z - DUMP_TRUCK.bedLocalZ;
  const halfW = Math.max(0.4, DUMP_TRUCK.bedWidth / 2 - inset);
  const halfD = Math.max(0.3, DUMP_TRUCK.bedDepth / 2 - inset);
  const clampedRelX = Math.max(-halfW, Math.min(halfW, relX));
  const clampedRelZ = Math.max(-halfD, Math.min(halfD, relZ));
  return dumpTruckLocalToWorld(
    DUMP_TRUCK.bedLocalX + clampedRelX,
    DUMP_TRUCK.bedLocalZ + clampedRelZ,
    groupX,
    groupZ,
  );
}

const _dumpBedCenter = dumpTruckBedCenterWorld();

/** 하역 접근·내비 — 트럭 적재함 중심 기준 */
export const DUMP_ZONE = {
  x: _dumpBedCenter.x,
  z: _dumpBedCenter.z,
  radius: 5.4,
};

export function isNearDumpTruck(
  wx: number,
  wz: number,
  centerX: number = DUMP_ZONE.x,
  centerZ: number = DUMP_ZONE.z,
) {
  return Math.hypot(wx - centerX, wz - centerZ) < DUMP_ZONE.radius + 7;
}

/** 트럭 group 배치 + 칸 치수 (씬·디버그 오버레이) */
export const DUMP_TRUCK_BED = {
  x: DUMP_TRUCK.groupX,
  z: DUMP_TRUCK.groupZ,
  rotation: DUMP_TRUCK.rotation,
  width: DUMP_TRUCK.bedWidth,
  depth: DUMP_TRUCK.bedDepth,
  margin: DUMP_TRUCK.margin,
  centerX: _dumpBedCenter.x,
  centerZ: _dumpBedCenter.z,
  bedLocalX: DUMP_TRUCK.bedLocalX,
  bedLocalZ: DUMP_TRUCK.bedLocalZ,
};

function distance(ax: number, az: number, bx: number, bz: number) {
  return Math.sqrt((ax - bx) ** 2 + (az - bz) ** 2);
}

export function randomDigCapacityUnits() {
  return DIG_ZONE_CAPACITY_UNITS;
}

export function digZoneLabel(zoneId: string, index = 0) {
  const match = zoneId.match(/(\d+)\s*$/);
  const n = match ? Number(match[1]) : index + 1;
  if (n === 1) return "굴착 I";
  if (n === 2) return "굴착 II";
  return `굴착 ${n}`;
}

export function getDigZoneRespawnEtaSec(zone: DigZone, now = Date.now()) {
  if (zone.active || zone.respawnAt == null) return 0;
  return Math.max(0, (zone.respawnAt - now) / 1000);
}

export function isCrashZoneFull(zone: CrashZone | null | undefined): boolean {
  if (!zone?.active) return false;
  return zone.tiles.every((tile) => tile.active && tile.hp >= tile.maxHp);
}

/**
 * Migrate persisted crash tiles onto the current `CRASH_TILE_MAX_HP`.
 * Preserves remaining HP ratio so a balance bump (e.g. 1000→2000) applies to
 * restored sessions instead of keeping the old maxHp forever.
 */
export function normalizeCrashZone(zone: CrashZone): CrashZone {
  return {
    ...zone,
    tiles: zone.tiles.map((tile) => {
      const prevMax =
        typeof tile.maxHp === "number" &&
        Number.isFinite(tile.maxHp) &&
        tile.maxHp > 0
          ? tile.maxHp
          : CRASH_TILE_MAX_HP;
      const prevHp =
        typeof tile.hp === "number" && Number.isFinite(tile.hp)
          ? tile.hp
          : prevMax;
      const ratio = tile.active
        ? Math.max(0, Math.min(1, prevHp / prevMax))
        : 0;
      return {
        ...tile,
        maxHp: CRASH_TILE_MAX_HP,
        hp: tile.active ? Math.round(ratio * CRASH_TILE_MAX_HP) : 0,
      };
    }),
  };
}

export function isHillZoneFull(zone: HillZone | null | undefined): boolean {
  if (!zone?.active || zone.boulders.length === 0) return false;
  return zone.boulders.every(
    (rock) => rock.active && !rock.extracted && !rock.delivered,
  );
}

export function getCrashZoneRespawnEtaSec(
  zone: CrashZone | null | undefined,
  now = Date.now(),
) {
  if (!zone || zone.respawnAt == null) return 0;
  if (isCrashZoneFull(zone)) return 0;
  return Math.max(0, (zone.respawnAt - now) / 1000);
}

export function getHillZoneRespawnEtaSec(
  zone: HillZone | null | undefined,
  now = Date.now(),
) {
  if (!zone || zone.respawnAt == null) return 0;
  if (isHillZoneFull(zone)) return 0;
  return Math.max(0, (zone.respawnAt - now) / 1000);
}

function createDigZone(
  id: string,
  x: number,
  z: number,
  capacityUnits = DIG_ZONE_CAPACITY_UNITS,
): DigZone {
  return {
    id,
    x,
    z,
    radius: DIG_ZONE.radius,
    capacityUnits,
    remainingUnits: capacityUnits,
    active: true,
    depletedAt: null,
    respawnAt: null,
  };
}

function randomDigZonePosition(
  originX: number,
  originZ: number,
  existing: DigZone[],
  gridSizeX = GRID_SIZE,
  gridSizeZ = GRID_SIZE,
  ignoreId?: string,
) {
  const spanX = Math.min(GRID_SIZE, gridSizeX) * CELL_SIZE;
  const spanZ = Math.min(GRID_SIZE, gridSizeZ) * CELL_SIZE;
  for (let attempt = 0; attempt < 60; attempt++) {
    const x = originX + 12 + Math.random() * (spanX - 24);
    const z = originZ + 12 + Math.random() * (spanZ - 24);
    const farFromDump = distance(x, z, DUMP_ZONE.x, DUMP_ZONE.z) > DUMP_ZONE.radius + 16;
    const farFromStart = distance(x, z, -18, -22) > 16;
    const farFromOthers = existing.every(
      (zone) => zone.id === ignoreId || distance(x, z, zone.x, zone.z) > 24,
    );
    if (farFromDump && farFromStart && farFromOthers) return { x, z };
  }
  return { x: DIG_ZONE.x, z: DIG_ZONE.z };
}

function createRandomDigZones(
  originX: number,
  originZ: number,
  gridSizeX = GRID_SIZE,
  gridSizeZ = GRID_SIZE,
) {
  const zones: DigZone[] = [];
  for (let i = 0; i < DIG_ZONE_COUNT; i++) {
    const pos = randomDigZonePosition(originX, originZ, zones, gridSizeX, gridSizeZ);
    zones.push(createDigZone(`dig-${i + 1}`, pos.x, pos.z, DIG_ZONE_CAPACITY_UNITS));
  }
  return zones;
}

function dumpPadContext() {
  return {
    x: DUMP_ZONE.x,
    z: DUMP_ZONE.z,
    radius: DUMP_ZONE.radius + 4,
  };
}

function truckPadContext() {
  return {
    groupX: DUMP_TRUCK.groupX,
    groupZ: DUMP_TRUCK.groupZ,
    rotation: DUMP_TRUCK.rotation,
  };
}

function findOverlappingActiveZone(
  terrain: TerrainData,
  wx: number,
  wz: number,
  ignoreId?: string,
) {
  return (
    terrain.digZones.find(
      (item) =>
        item.id !== ignoreId &&
        item.active &&
        distance(wx, wz, item.x, item.z) < item.radius,
    ) ?? null
  );
}

function restoreGroundAtZone(terrain: TerrainData, zone: DigZone) {
  const dumpPad = dumpPadContext();
  const truck = truckPadContext();
  for (let gz = 0; gz < terrain.gridSizeZ; gz++) {
    for (let gx = 0; gx < terrain.gridSizeX; gx++) {
      const idx = gz * terrain.gridSizeX + gx;
      const wx = terrain.originX + (gx + 0.5) * terrain.cellSize;
      const wz = terrain.originZ + (gz + 0.5) * terrain.cellSize;
      if (distance(wx, wz, zone.x, zone.z) >= zone.radius) continue;
      const otherZone = findOverlappingActiveZone(terrain, wx, wz, zone.id);
      const next = applyTruckDeparturePad(
        wx,
        wz,
        computeBaseTerrainHeight(wx, wz, otherZone, dumpPad),
        truck,
      );
      terrain.heights[idx] = next;
      terrain.baseHeights[idx] = next;
    }
  }
}

function addMoundAtZone(terrain: TerrainData, zone: DigZone) {
  for (let gz = 0; gz < terrain.gridSizeZ; gz++) {
    for (let gx = 0; gx < terrain.gridSizeX; gx++) {
      const idx = gz * terrain.gridSizeX + gx;
      const wx = terrain.originX + (gx + 0.5) * terrain.cellSize;
      const wz = terrain.originZ + (gz + 0.5) * terrain.cellSize;
      const next = applyZoneMoundHeight(wx, wz, zone, terrain.heights[idx]);
      terrain.heights[idx] = next;
      terrain.baseHeights[idx] = next;
    }
  }
}

function depleteDigZone(terrain: TerrainData, zone: DigZone, now = Date.now()) {
  restoreGroundAtZone(terrain, zone);
  zone.active = false;
  zone.remainingUnits = 0;
  zone.depletedAt = now;
  zone.respawnAt = now + DIG_ZONE_RESPAWN_MS;
}

export function getActiveDigZones(terrain: TerrainData) {
  return terrain.digZones.filter((zone) => zone.active);
}

export function getActiveDigZoneAt(
  terrain: TerrainData,
  wx: number,
  wz: number,
): DigZone | null {
  return (
    terrain.digZones.find(
      (zone) => zone.active && distance(wx, wz, zone.x, zone.z) < zone.radius,
    ) ?? null
  );
}

export function updateDigZoneRespawns(terrain: TerrainData, now = Date.now()) {
  if (!terrain.dynamicDigZones) return;
  for (const zone of terrain.digZones) {
    if (zone.active || !zone.respawnAt || now < zone.respawnAt) continue;
    const pos = randomDigZonePosition(
      terrain.originX,
      terrain.originZ,
      terrain.digZones,
      terrain.gridSizeX,
      terrain.gridSizeZ,
      zone.id,
    );
    const capacity = DIG_ZONE_CAPACITY_UNITS;
    zone.x = pos.x;
    zone.z = pos.z;
    zone.capacityUnits = capacity;
    zone.remainingUnits = capacity;
    zone.active = true;
    zone.depletedAt = null;
    zone.respawnAt = null;
    addMoundAtZone(terrain, zone);
  }
}

export function cloneDigZones(zones: DigZone[]): DigZone[] {
  return zones.map((zone) => ({ ...zone }));
}

export function applyDigZonesSnapshot(terrain: TerrainData, zones: DigZone[]) {
  terrain.digZones = cloneDigZones(zones);
  updateDigZoneRespawns(terrain);
}

export function isInDumpZone(wx: number, wz: number): boolean {
  const dx = wx - DUMP_ZONE.x;
  const dz = wz - DUMP_ZONE.z;
  return Math.sqrt(dx * dx + dz * dz) < DUMP_ZONE.radius;
}

export function isInDumpTruckBed(
  wx: number,
  wz: number,
  extraMargin = 0,
  groupX: number = DUMP_TRUCK.groupX,
  groupZ: number = DUMP_TRUCK.groupZ,
): boolean {
  const local = worldToDumpTruckLocal(wx, wz, groupX, groupZ);
  const relX = local.x - DUMP_TRUCK.bedLocalX;
  const relZ = local.z - DUMP_TRUCK.bedLocalZ;
  const margin = DUMP_TRUCK.margin + extraMargin;
  return (
    Math.abs(relX) <= DUMP_TRUCK.bedWidth / 2 + margin &&
    Math.abs(relZ) <= DUMP_TRUCK.bedDepth / 2 + margin
  );
}

export function isInDigZone(wx: number, wz: number, terrain?: TerrainData): boolean {
  if (terrain) return getActiveDigZoneAt(terrain, wx, wz) != null;
  const dx = wx - DIG_ZONE.x;
  const dz = wz - DIG_ZONE.z;
  return Math.sqrt(dx * dx + dz * dz) < DIG_ZONE.radius;
}

function createCrashZone(
  centerX = 108,
  centerZ = 12,
): CrashZone {
  const cycleId = `crash-${Date.now().toString(36)}-${Math.floor(
    Math.random() * 1_000_000,
  ).toString(36)}`;
  return {
    id: cycleId,
    centerX,
    centerZ,
    width: 24,
    depth: 24,
    active: true,
    tiles: Array.from({ length: 9 }, (_, index) => ({
      id: `${cycleId}-tile-${index + 1}`,
      row: Math.floor(index / 3),
      col: index % 3,
      hp: CRASH_TILE_MAX_HP,
      maxHp: CRASH_TILE_MAX_HP,
      active: true,
    })),
    clearedAt: null,
    respawnAt: null,
  };
}

function createHillBoulders(
  cycleId: string,
  centerX: number,
  centerZ: number,
  count = HILL_BOULDER_COUNT,
): HillBoulder[] {
  const boulderCount = Math.max(1, Math.floor(count));
  return Array.from({ length: boulderCount }, (_, index) => {
    const angle = (index / boulderCount) * Math.PI * 2 + 0.35;
    // Keep harvestable rocks inside the painted stone ring (radius * 0.55 ≈ 13.75).
    const ring = 5.2 + (index % 3) * 1.8;
    return {
      id: `${cycleId}-rock-${index + 1}`,
      x: centerX + Math.cos(angle) * ring,
      z: centerZ + Math.sin(angle) * ring,
      active: true,
      delivered: false,
      extracted: false,
      ...createHillBoulderAttrs(index),
    };
  });
}

function createHillZone(
  centerX = 22,
  centerZ = 112,
  haulTruck?: HaulTruckState,
  boulderCount = HILL_BOULDER_COUNT,
): HillZone {
  const cycleId = `hill-${Date.now().toString(36)}-${Math.floor(
    Math.random() * 1_000_000,
  ).toString(36)}`;
  return {
    id: cycleId,
    centerX,
    centerZ,
    radius: 25,
    dropX: HAUL_TRUCK.groupX,
    dropZ: HAUL_TRUCK.groupZ,
    active: true,
    boulders: createHillBoulders(cycleId, centerX, centerZ, boulderCount),
    haulTruck: haulTruck
      ? { ...haulTruck }
      : {
          phase: "ready",
          loadCount: 0,
          cooldownRemaining: 0,
          phaseElapsed: 0,
        },
    clearedAt: null,
    respawnAt: null,
  };
}

export function isInCrashZone(
  terrain: TerrainData,
  wx: number,
  wz: number,
): boolean {
  const zone = terrain.crashZone;
  if (!zone?.active) return false;
  return (
    Math.abs(wx - zone.centerX) <= zone.width / 2 &&
    Math.abs(wz - zone.centerZ) <= zone.depth / 2
  );
}

export function getCrashTileAt(
  terrain: TerrainData,
  wx: number,
  wz: number,
): CrashTile | null {
  const zone = terrain.crashZone;
  if (!zone || !isInCrashZone(terrain, wx, wz)) return null;
  const localX = wx - (zone.centerX - zone.width / 2);
  const localZ = wz - (zone.centerZ - zone.depth / 2);
  const col = Math.max(0, Math.min(2, Math.floor((localX / zone.width) * 3)));
  const row = Math.max(0, Math.min(2, Math.floor((localZ / zone.depth) * 3)));
  return zone.tiles.find((tile) => tile.row === row && tile.col === col) ?? null;
}

/** 팁이 타일 경계·시각 오차로 살짝 벗어나도 가까운 활성 아스팔트를 찾는다. */
export function getCrashTileNear(
  terrain: TerrainData,
  wx: number,
  wz: number,
  radius = 0.65,
): CrashTile | null {
  const direct = getCrashTileAt(terrain, wx, wz);
  if (direct?.active) return direct;

  const zone = terrain.crashZone;
  if (!zone?.active || radius <= 0) return direct;

  let best: CrashTile | null = direct?.active ? direct : null;
  let bestDist = Number.POSITIVE_INFINITY;
  const tileW = zone.width / 3;
  const tileD = zone.depth / 3;
  for (const tile of zone.tiles) {
    if (!tile.active) continue;
    const cx = zone.centerX - zone.width / 2 + tileW * (tile.col + 0.5);
    const cz = zone.centerZ - zone.depth / 2 + tileD * (tile.row + 0.5);
    const dx = Math.max(Math.abs(wx - cx) - tileW * 0.5, 0);
    const dz = Math.max(Math.abs(wz - cz) - tileD * 0.5, 0);
    const dist = Math.hypot(dx, dz);
    if (dist <= radius && dist < bestDist) {
      best = tile;
      bestDist = dist;
    }
  }
  return best ?? direct;
}

/** 활성 아스팔트 타일 상단 오프셋. HP가 줄수록 낮아져 브레이커가 박혀 들어가는 느낌을 준다. */
export function getCrashAsphaltSurfaceOffset(tile: CrashTile | null | undefined): number {
  if (!tile?.active) return 0;
  const damage = 1 - tile.hp / Math.max(1, tile.maxHp);
  return CRASH_ASPHALT_SURFACE_TOP - damage * CRASH_ASPHALT_SURFACE_SINK;
}

/** 브레이커/도저 접촉용 높이 — 지형 + 활성 아스팔트 상단. */
export function sampleCrashContactHeight(
  terrain: TerrainData,
  wx: number,
  wz: number,
): number {
  return sampleHeight(terrain, wx, wz) + getCrashAsphaltSurfaceOffset(getCrashTileAt(terrain, wx, wz));
}

/** 팁 근처 활성 타일을 포함한 접촉 높이 (브레이커 판정용). */
export function sampleBreakerContactHeight(
  terrain: TerrainData,
  wx: number,
  wz: number,
  probeRadius = 0.65,
): { height: number; tile: CrashTile | null } {
  const tile = getCrashTileNear(terrain, wx, wz, probeRadius);
  return {
    tile,
    height: sampleHeight(terrain, wx, wz) + getCrashAsphaltSurfaceOffset(tile),
  };
}

export function damageCrashTile(
  terrain: TerrainData,
  tileId: string,
  damage = CRASH_HIT_DAMAGE,
  now = Date.now(),
): { tile: CrashTile; destroyed: boolean; zoneCleared: boolean } | null {
  const zone = terrain.crashZone;
  const tile = zone?.tiles.find((item) => item.id === tileId);
  if (!zone || !tile?.active) return null;
  tile.hp = Math.max(0, tile.hp - damage);
  const destroyed = tile.hp === 0;
  if (destroyed) tile.active = false;
  const zoneCleared = zone.tiles.every((item) => !item.active);
  if (zoneCleared) {
    zone.active = false;
    zone.clearedAt = now;
    zone.respawnAt = now + CRASH_ZONE_RESPAWN_MS;
  }
  return { tile, destroyed, zoneCleared };
}

export function isInHillZone(
  terrain: TerrainData,
  wx: number,
  wz: number,
): boolean {
  const zone = terrain.hillZone;
  if (!zone?.active) return false;
  return Math.hypot(wx - zone.centerX, wz - zone.centerZ) <= zone.radius + 8;
}

export function isInsideHillZoneCore(
  zone: HillZone,
  wx: number,
  wz: number,
): boolean {
  return Math.hypot(wx - zone.centerX, wz - zone.centerZ) <= zone.radius;
}

export function markHillRockExtracted(
  terrain: TerrainData,
  rockId: string,
  now = Date.now(),
): boolean {
  const zone = terrain.hillZone;
  const rock = zone?.boulders.find((item) => item.id === rockId);
  if (!zone?.active || !rock || rock.extracted) return false;
  rock.extracted = true;
  rock.active = false;
  return tryClearHillZone(terrain, now);
}

export function tryClearHillZone(
  terrain: TerrainData,
  now = Date.now(),
): boolean {
  const zone = terrain.hillZone;
  if (!zone?.active) return false;
  if (!zone.boulders.every((rock) => rock.extracted || rock.delivered)) {
    return false;
  }
  zone.active = false;
  zone.clearedAt = now;
  zone.respawnAt = now + HILL_ZONE_RESPAWN_MS;
  return true;
}

/**
 * 돌·아스팔트: 구역에 남아 있어도 플레이어가 나가 있으면 리젠 타이머를 돌리고,
 * 시간이 지나면 100%로 채운다. 구역 안에 있으면(아직 활성일 때) 타이머를 취소한다.
 */
export function updateSpecialZones(
  terrain: TerrainData,
  dt: number,
  now = Date.now(),
  crashRespawnSec = CRASH_ZONE_RESPAWN_MS / 1000,
  haulTruckCooldownSec = HAUL_TRUCK_COOLDOWN_SEC,
  hillBoulderCount = HILL_BOULDER_COUNT,
  playerX?: number,
  playerZ?: number,
) {
  const crash = terrain.crashZone;
  if (crash) {
    const playerInCrash =
      playerX != null &&
      playerZ != null &&
      crash.active &&
      isInCrashZone(terrain, playerX, playerZ);
    if (isCrashZoneFull(crash)) {
      crash.clearedAt = null;
      crash.respawnAt = null;
    } else if (playerInCrash) {
      crash.clearedAt = null;
      crash.respawnAt = null;
    } else {
      if (crash.clearedAt == null) crash.clearedAt = now;
      crash.respawnAt = crash.clearedAt + crashRespawnSec * 1000;
      if (now >= crash.respawnAt) {
        terrain.crashZone = createCrashZone(crash.centerX, crash.centerZ);
        rebakeSpecialSiteSurfaces(terrain);
      }
    }
  }

  const hill = terrain.hillZone;
  if (hill) {
    const playerInHill =
      playerX != null &&
      playerZ != null &&
      hill.active &&
      isInHillZone(terrain, playerX, playerZ);
    if (isHillZoneFull(hill)) {
      hill.clearedAt = null;
      hill.respawnAt = null;
    } else if (playerInHill) {
      hill.clearedAt = null;
      hill.respawnAt = null;
    } else {
      if (hill.clearedAt == null) hill.clearedAt = now;
      hill.respawnAt = hill.clearedAt + HILL_ZONE_RESPAWN_MS;
      if (now >= hill.respawnAt) {
        terrain.hillZone = createHillZone(
          hill.centerX,
          hill.centerZ,
          hill.haulTruck,
          hillBoulderCount,
        );
        rebakeSpecialSiteSurfaces(terrain);
      }
    }
  }

  const truck = terrain.hillZone?.haulTruck;
  if (!truck || truck.phase === "ready") return;
  advanceHaulTruckState(truck, dt, haulTruckCooldownSec);
}

/** 한 틱만큼 돌트럭 상태 머신 진행 (phase 경계에서 멈춤). */
export function advanceHaulTruckState(
  truck: HaulTruckState,
  dt: number,
  haulTruckCooldownSec = HAUL_TRUCK_COOLDOWN_SEC,
) {
  if (truck.phase === "ready" || dt <= 0) return;
  truck.phaseElapsed += dt;
  if (truck.phase === "engineStart" && truck.phaseElapsed >= HAUL_TRUCK_ENGINE_START_SEC) {
    truck.phase = "departing";
    truck.phaseElapsed = 0;
  } else if (truck.phase === "departing" && truck.phaseElapsed >= HAUL_TRUCK_DEPART_SEC) {
    truck.phase = "cooldown";
    truck.phaseElapsed = 0;
    truck.cooldownRemaining = haulTruckCooldownSec;
    truck.loadCount = 0;
  } else if (truck.phase === "cooldown") {
    truck.cooldownRemaining = Math.max(0, truck.cooldownRemaining - dt);
    if (truck.cooldownRemaining <= HAUL_TRUCK_ARRIVE_SEC) {
      truck.phase = "arriving";
      truck.phaseElapsed = HAUL_TRUCK_ARRIVE_SEC - truck.cooldownRemaining;
    }
  } else if (truck.phase === "arriving") {
    if (truck.phaseElapsed >= HAUL_TRUCK_ARRIVE_SEC) {
      truck.phase = "ready";
      truck.phaseElapsed = 0;
      truck.cooldownRemaining = 0;
      truck.loadCount = 0;
    }
  }
}

/**
 * 앱/탭이 멈춰 있던 시간을 돌트럭 상태 머신에 반영한다.
 * 각 phase 경계까지만 진행해 큰 elapsed도 다음 phase로 정확히 넘긴다.
 */
export function fastForwardHaulTruckState(
  truck: HaulTruckState,
  elapsedSec: number,
  haulTruckCooldownSec = HAUL_TRUCK_COOLDOWN_SEC,
) {
  let remaining = Math.max(0, elapsedSec);

  while (remaining > 0 && truck.phase !== "ready") {
    let untilTransition: number;

    if (truck.phase === "engineStart") {
      untilTransition = Math.max(0, HAUL_TRUCK_ENGINE_START_SEC - truck.phaseElapsed);
    } else if (truck.phase === "departing") {
      untilTransition = Math.max(0, HAUL_TRUCK_DEPART_SEC - truck.phaseElapsed);
    } else if (truck.phase === "cooldown") {
      untilTransition = Math.max(0, truck.cooldownRemaining - HAUL_TRUCK_ARRIVE_SEC);
    } else {
      untilTransition = Math.max(0, HAUL_TRUCK_ARRIVE_SEC - truck.phaseElapsed);
    }

    const step = Math.min(remaining, Math.max(untilTransition, 0.000_001));
    advanceHaulTruckState(truck, step, haulTruckCooldownSec);
    remaining -= step;
  }
}

export function canHaulTruckAcceptRock(
  truck: HaulTruckState | null | undefined,
  capacity = HAUL_TRUCK_CAPACITY,
) {
  if (!truck || truck.phase !== "ready") return false;
  return truck.loadCount < Math.max(1, Math.floor(capacity));
}

export function getHaulTruckFillRatio(
  truck: HaulTruckState | null | undefined,
  capacity = HAUL_TRUCK_CAPACITY,
) {
  const maxLoad = Math.max(1, Math.floor(capacity));
  if (!truck || maxLoad <= 0) return 0;
  return Math.min(1, Math.max(0, truck.loadCount / maxLoad));
}

export function isHaulTruckVisible(truck: HaulTruckState | null | undefined) {
  return !!truck && truck.phase !== "cooldown";
}

export function shouldShowHaulTruckReturnTimer(
  truck: HaulTruckState | null | undefined,
) {
  return (
    !!truck &&
    (truck.phase === "engineStart" ||
      truck.phase === "departing" ||
      truck.phase === "cooldown" ||
      truck.phase === "arriving")
  );
}

export function getHaulTruckReturnEtaSec(
  truck: HaulTruckState | null | undefined,
  cooldownSec = HAUL_TRUCK_COOLDOWN_SEC,
) {
  if (!truck) return 0;
  if (truck.phase === "cooldown") return truck.cooldownRemaining;
  if (truck.phase === "engineStart") {
    const engineLeft = Math.max(0, HAUL_TRUCK_ENGINE_START_SEC - truck.phaseElapsed);
    return engineLeft + HAUL_TRUCK_DEPART_SEC + cooldownSec + HAUL_TRUCK_ARRIVE_SEC;
  }
  if (truck.phase === "departing") {
    const departLeft = Math.max(0, HAUL_TRUCK_DEPART_SEC - truck.phaseElapsed);
    return departLeft + cooldownSec + HAUL_TRUCK_ARRIVE_SEC;
  }
  if (truck.phase === "arriving") {
    return Math.max(0, HAUL_TRUCK_ARRIVE_SEC - truck.phaseElapsed);
  }
  return 0;
}

export function addHaulTruckRock(
  terrain: TerrainData,
  capacity = HAUL_TRUCK_CAPACITY,
) {
  const truck = terrain.hillZone?.haulTruck;
  if (!canHaulTruckAcceptRock(truck, capacity) || !truck) return false;
  const maxLoad = Math.max(1, Math.floor(capacity));
  truck.loadCount = Math.min(maxLoad, truck.loadCount + 1);
  return true;
}

export function beginHaulTruckDeparture(
  terrain: TerrainData,
  capacity = HAUL_TRUCK_CAPACITY,
) {
  const truck = terrain.hillZone?.haulTruck;
  if (
    !truck ||
    truck.phase !== "ready" ||
    truck.loadCount < Math.max(1, Math.floor(capacity))
  ) {
    return;
  }
  truck.phase = "engineStart";
  truck.phaseElapsed = 0;
}
