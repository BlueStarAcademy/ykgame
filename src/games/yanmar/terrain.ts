import {
  applyTruckDeparturePad,
  applyZoneMoundHeight,
  computeBaseTerrainHeight,
} from "./terrainShapes";

export const GRID_SIZE = 64;
export const CELL_SIZE = 2;
export const DIG_ZONE_CAPACITY_UNITS = 3000;
export const DIG_ZONE_CAPACITY_MIN = 3000;
export const DIG_ZONE_CAPACITY_MAX = 5000;
export const DIG_ZONE_CAPACITY_STEP = 100;
export const DIG_ZONE_COUNT = 2;
export const DIG_ZONE_RESPAWN_MS = 5 * 60 * 1000;

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

export interface TerrainData {
  heights: Float32Array;
  baseHeights: Float32Array;
  digZones: DigZone[];
  dynamicDigZones: boolean;
  gridSize: number;
  cellSize: number;
  originX: number;
  originZ: number;
}

export function getMapWorldBounds(terrain: TerrainData) {
  const span = terrain.gridSize * terrain.cellSize;
  return {
    minX: terrain.originX,
    maxX: terrain.originX + span,
    minZ: terrain.originZ,
    maxZ: terrain.originZ + span,
  };
}

export function createTerrain(
  originX = -48,
  originZ = -48,
  dynamicDigZones = false,
): TerrainData {
  const heights = new Float32Array(GRID_SIZE * GRID_SIZE);
  const digZones = dynamicDigZones
    ? createRandomDigZones(originX, originZ)
    : [createDigZone("practice-dig", DIG_ZONE.x, DIG_ZONE.z)];
  for (let gz = 0; gz < GRID_SIZE; gz++) {
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      const idx = gz * GRID_SIZE + gx;
      const wx = originX + (gx + 0.5) * CELL_SIZE;
      const wz = originZ + (gz + 0.5) * CELL_SIZE;
      const zone =
        digZones.find((item) => distance(wx, wz, item.x, item.z) < item.radius) ?? null;
      heights[idx] = applyTruckDeparturePad(
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
    }
  }
  return {
    heights,
    baseHeights: heights.slice(),
    digZones,
    dynamicDigZones,
    gridSize: GRID_SIZE,
    cellSize: CELL_SIZE,
    originX,
    originZ,
  };
}

export function worldToCell(
  terrain: TerrainData,
  wx: number,
  wz: number,
): { gx: number; gz: number } | null {
  const gx = Math.floor((wx - terrain.originX) / terrain.cellSize);
  const gz = Math.floor((wz - terrain.originZ) / terrain.cellSize);
  if (gx < 0 || gz < 0 || gx >= terrain.gridSize || gz >= terrain.gridSize) {
    return null;
  }
  return { gx, gz };
}

export function getHeight(terrain: TerrainData, gx: number, gz: number): number {
  return terrain.heights[gz * terrain.gridSize + gx];
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
      if (gx < 0 || gz < 0 || gx >= terrain.gridSize || gz >= terrain.gridSize) continue;

      const dist = Math.sqrt(dx * dx + dz * dz) * terrain.cellSize;
      if (dist > radius) continue;

      const idx = gz * terrain.gridSize + gx;
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
  const cell = worldToCell(terrain, wx, wz);
  if (!cell) return 0;
  return getHeight(terrain, cell.gx, cell.gz);
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
  ignoreId?: string,
) {
  const span = GRID_SIZE * CELL_SIZE;
  for (let attempt = 0; attempt < 60; attempt++) {
    const x = originX + 12 + Math.random() * (span - 24);
    const z = originZ + 12 + Math.random() * (span - 24);
    const farFromDump = distance(x, z, DUMP_ZONE.x, DUMP_ZONE.z) > DUMP_ZONE.radius + 16;
    const farFromStart = distance(x, z, -18, -22) > 16;
    const farFromOthers = existing.every(
      (zone) => zone.id === ignoreId || distance(x, z, zone.x, zone.z) > 24,
    );
    if (farFromDump && farFromStart && farFromOthers) return { x, z };
  }
  return { x: DIG_ZONE.x, z: DIG_ZONE.z };
}

function createRandomDigZones(originX: number, originZ: number) {
  const zones: DigZone[] = [];
  for (let i = 0; i < DIG_ZONE_COUNT; i++) {
    const pos = randomDigZonePosition(originX, originZ, zones);
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
  for (let gz = 0; gz < terrain.gridSize; gz++) {
    for (let gx = 0; gx < terrain.gridSize; gx++) {
      const idx = gz * terrain.gridSize + gx;
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
  for (let gz = 0; gz < terrain.gridSize; gz++) {
    for (let gx = 0; gx < terrain.gridSize; gx++) {
      const idx = gz * terrain.gridSize + gx;
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
