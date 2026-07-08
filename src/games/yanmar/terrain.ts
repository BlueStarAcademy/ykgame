export const GRID_SIZE = 48;
export const CELL_SIZE = 2;
export const DIG_ZONE_CAPACITY_UNITS = 3000;
export const DIG_ZONE_RESPAWN_MS = 10 * 60 * 1000;

export interface DigZone {
  id: string;
  x: number;
  z: number;
  radius: number;
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
      let h = 0.75 + Math.random() * 0.15;
      const zone = digZones.find((item) => distance(wx, wz, item.x, item.z) < item.radius);
      if (zone) {
        // 굴착 구역 — 흙 더미 (눈에 띄게 높게)
        const mound = 1 - distance(wx, wz, zone.x, zone.z) / zone.radius;
        h = 0.9 + mound * 1.1 + Math.random() * 0.2;
      }
      heights[idx] = h;
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
      const now = Date.now();
      activeZone.active = false;
      activeZone.depletedAt = now;
      activeZone.respawnAt = now + DIG_ZONE_RESPAWN_MS;
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
export const DUMP_ZONE = { x: 32, z: -12, radius: 8 };
export const DUMP_TRUCK_BED = {
  x: DUMP_ZONE.x + 1.6,
  z: DUMP_ZONE.z - 0.8,
  width: 7.2,
  depth: 5.4,
  rotation: -0.36,
  margin: 1.6,
};

function distance(ax: number, az: number, bx: number, bz: number) {
  return Math.sqrt((ax - bx) ** 2 + (az - bz) ** 2);
}

function createDigZone(id: string, x: number, z: number): DigZone {
  return {
    id,
    x,
    z,
    radius: DIG_ZONE.radius,
    remainingUnits: DIG_ZONE_CAPACITY_UNITS,
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
  for (let i = 0; i < 3; i++) {
    const pos = randomDigZonePosition(originX, originZ, zones);
    zones.push(createDigZone(`dig-${i + 1}`, pos.x, pos.z));
  }
  return zones;
}

function addMoundAtZone(terrain: TerrainData, zone: DigZone) {
  for (let gz = 0; gz < terrain.gridSize; gz++) {
    for (let gx = 0; gx < terrain.gridSize; gx++) {
      const idx = gz * terrain.gridSize + gx;
      const wx = terrain.originX + (gx + 0.5) * terrain.cellSize;
      const wz = terrain.originZ + (gz + 0.5) * terrain.cellSize;
      const dist = distance(wx, wz, zone.x, zone.z);
      if (dist >= zone.radius) continue;
      const mound = 1 - dist / zone.radius;
      const h = 0.9 + mound * 1.1 + Math.random() * 0.2;
      terrain.heights[idx] = Math.max(terrain.heights[idx], h);
      terrain.baseHeights[idx] = terrain.heights[idx];
    }
  }
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
    zone.x = pos.x;
    zone.z = pos.z;
    zone.remainingUnits = DIG_ZONE_CAPACITY_UNITS;
    zone.active = true;
    zone.depletedAt = null;
    zone.respawnAt = null;
    addMoundAtZone(terrain, zone);
  }
}

export function isInDumpZone(wx: number, wz: number): boolean {
  const dx = wx - DUMP_ZONE.x;
  const dz = wz - DUMP_ZONE.z;
  return Math.sqrt(dx * dx + dz * dz) < DUMP_ZONE.radius;
}

export function isInDumpTruckBed(wx: number, wz: number): boolean {
  const cos = Math.cos(-DUMP_TRUCK_BED.rotation);
  const sin = Math.sin(-DUMP_TRUCK_BED.rotation);
  const dx = wx - DUMP_TRUCK_BED.x;
  const dz = wz - DUMP_TRUCK_BED.z;
  const localX = dx * cos - dz * sin;
  const localZ = dx * sin + dz * cos;
  return (
    Math.abs(localX) <= DUMP_TRUCK_BED.width / 2 + DUMP_TRUCK_BED.margin &&
    Math.abs(localZ) <= DUMP_TRUCK_BED.depth / 2 + DUMP_TRUCK_BED.margin
  );
}

export function isInDigZone(wx: number, wz: number, terrain?: TerrainData): boolean {
  if (terrain) return getActiveDigZoneAt(terrain, wx, wz) != null;
  const dx = wx - DIG_ZONE.x;
  const dz = wz - DIG_ZONE.z;
  return Math.sqrt(dx * dx + dz * dz) < DIG_ZONE.radius;
}
