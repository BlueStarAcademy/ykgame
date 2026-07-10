import {
  applyCrashAsphaltPad,
  applyExpansionRoads,
  applyHillZoneHeight,
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
export const DIG_ZONE_CAPACITY_UNITS = 3000;
export const DIG_ZONE_CAPACITY_MIN = 3000;
export const DIG_ZONE_CAPACITY_MAX = 5000;
export const DIG_ZONE_CAPACITY_STEP = 100;
export const DIG_ZONE_COUNT = 2;
export const DIG_ZONE_RESPAWN_MS = 5 * 60 * 1000;
export const CRASH_ZONE_RESPAWN_MS = 10 * 60 * 1000;
export const CRASH_TILE_MAX_HP = 1000;
export const CRASH_HIT_DAMAGE = 10;
export const HAUL_TRUCK_COOLDOWN_SEC = 10 * 60;

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
}

export interface HaulTruckState {
  phase: "ready" | "departing" | "cooldown" | "arriving";
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
  boulders: HillBoulder[];
  haulTruck: HaulTruckState;
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
        next = applyHillZoneHeight(wx, wz, next, hillZone);
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
      if (terrain.mapTier >= 3 && terrain.hillZone) {
        current = applyHillZoneHeight(wx, wz, current, terrain.hillZone);
        base = applyHillZoneHeight(wx, wz, base, terrain.hillZone);
      }
      terrain.heights[index] = current;
      terrain.baseHeights[index] = base;
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
      const take = Math.min(amount * (1 - dist / radius), terrain.heights[idx]);
      terrain.heights[idx] -= take;
      dug += take;
    }
  }
  if (terrain.dynamicDigZones && dug > 0) {
    activeZone.remainingUnits = Math.max(0, activeZone.remainingUnits - dug * 95);
    if (activeZone.remainingUnits <= 0 && activeZone.active) {
      depleteDigZone(terrain, activeZone);
    }
  }
  return dug;
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
  /** 적재함 상단 덱 높이 (DumpTruck.tsx 메시: 0.55+0.78+0.30) */
  bedDeckWorldY: 1.63,
  /** 칸 위에서 하역 판정 최소 높이 (덱 대비) */
  dumpMinHeightAboveDeck: -0.4,
} as const;

/** 트럭 고체 껍데기 — 칸 내부 공동은 비움 (하역 공간) */
export const DUMP_TRUCK_SOLID = {
  centerLocalX: -0.12,
  centerLocalZ: 0,
  halfX: 3.22,
  halfZ: 1.62,
  minY: 0.9,
  maxY: 3.12,
  cavityHalfX: DUMP_TRUCK.bedWidth / 2 - 0.18,
  cavityHalfZ: DUMP_TRUCK.bedDepth / 2 - 0.15,
  cavityMinY: 1.05,
  cavityMaxY: 2.82,
} as const;

function dumpTruckLocalToWorld(
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
  const steps =
    Math.floor(
      (DIG_ZONE_CAPACITY_MAX - DIG_ZONE_CAPACITY_MIN) / DIG_ZONE_CAPACITY_STEP,
    ) + 1;
  return DIG_ZONE_CAPACITY_MIN + Math.floor(Math.random() * steps) * DIG_ZONE_CAPACITY_STEP;
}

export function digZoneLabel(zoneId: string, index = 0) {
  const match = zoneId.match(/(\d+)\s*$/);
  const n = match ? Number(match[1]) : index + 1;
  if (n === 1) return "DIG I";
  if (n === 2) return "DIG II";
  return `DIG ${n}`;
}

export function getDigZoneRespawnEtaSec(zone: DigZone, now = Date.now()) {
  if (zone.active || zone.respawnAt == null) return 0;
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
    zones.push(createDigZone(`dig-${i + 1}`, pos.x, pos.z, randomDigCapacityUnits()));
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
    const capacity = randomDigCapacityUnits();
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

function createCrashZone(): CrashZone {
  const cycleId = `crash-${Date.now().toString(36)}-${Math.floor(
    Math.random() * 1_000_000,
  ).toString(36)}`;
  return {
    id: cycleId,
    centerX: 108,
    centerZ: 12,
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

function createHillZone(): HillZone {
  const centerX = 22;
  const centerZ = 112;
  const cycleId = `hill-${Date.now().toString(36)}-${Math.floor(
    Math.random() * 1_000_000,
  ).toString(36)}`;
  return {
    id: cycleId,
    centerX,
    centerZ,
    radius: 25,
    dropX: centerX + 13,
    dropZ: centerZ + 6,
    boulders: Array.from({ length: 15 }, (_, index) => {
      const angle = (index / 15) * Math.PI * 2;
      const ring = 7 + (index % 3) * 3.1;
      return {
        id: `${cycleId}-rock-${index + 1}`,
        x: centerX + Math.cos(angle) * ring,
        z: centerZ + Math.sin(angle) * ring,
        active: true,
        delivered: false,
      };
    }),
    haulTruck: {
      phase: "ready",
      loadCount: 0,
      cooldownRemaining: 0,
      phaseElapsed: 0,
    },
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
  return !!zone && Math.hypot(wx - zone.centerX, wz - zone.centerZ) <= zone.radius + 8;
}

export function updateSpecialZones(
  terrain: TerrainData,
  dt: number,
  now = Date.now(),
  crashRespawnSec = CRASH_ZONE_RESPAWN_MS / 1000,
  haulTruckCooldownSec = HAUL_TRUCK_COOLDOWN_SEC,
) {
  const crash = terrain.crashZone;
  if (crash && !crash.active && crash.clearedAt) {
    crash.respawnAt = crash.clearedAt + crashRespawnSec * 1000;
  }
  if (crash && !crash.active && crash.respawnAt && now >= crash.respawnAt) {
    const next = createCrashZone();
    const offsets = [
      [0, 0],
      [8, 18],
      [16, -14],
    ] as const;
    const offset = offsets[Math.floor(Math.random() * offsets.length)];
    next.centerX += offset[0];
    next.centerZ += offset[1];
    terrain.crashZone = next;
    rebakeSpecialSiteSurfaces(terrain);
  }

  const truck = terrain.hillZone?.haulTruck;
  if (!truck || truck.phase === "ready") return;
  truck.phaseElapsed += dt;
  if (truck.phase === "departing" && truck.phaseElapsed >= 5) {
    truck.phase = "cooldown";
    truck.phaseElapsed = 0;
    truck.cooldownRemaining = haulTruckCooldownSec;
  } else if (truck.phase === "cooldown") {
    truck.cooldownRemaining = Math.max(0, truck.cooldownRemaining - dt);
    if (truck.cooldownRemaining <= 8) {
      truck.phase = "arriving";
      truck.phaseElapsed = 0;
    }
  } else if (truck.phase === "arriving" && truck.phaseElapsed >= 8) {
    truck.phase = "ready";
    truck.phaseElapsed = 0;
    truck.cooldownRemaining = 0;
    truck.loadCount = 0;
    const hill = terrain.hillZone;
    if (hill) {
      hill.boulders = createHillZone().boulders;
    }
  }
}

export function addHaulTruckRock(terrain: TerrainData) {
  const truck = terrain.hillZone?.haulTruck;
  if (!truck || truck.phase !== "ready") return false;
  truck.loadCount = Math.min(10, truck.loadCount + 1);
  if (truck.loadCount >= 10) {
    truck.phase = "departing";
    truck.phaseElapsed = 0;
  }
  return true;
}
