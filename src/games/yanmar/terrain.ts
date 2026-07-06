export const GRID_SIZE = 48;
export const CELL_SIZE = 2;

export interface TerrainData {
  heights: Float32Array;
  baseHeights: Float32Array;
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
): TerrainData {
  const heights = new Float32Array(GRID_SIZE * GRID_SIZE);
  for (let gz = 0; gz < GRID_SIZE; gz++) {
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      const idx = gz * GRID_SIZE + gx;
      const wx = originX + (gx + 0.5) * CELL_SIZE;
      const wz = originZ + (gz + 0.5) * CELL_SIZE;
      let h = 0.75 + Math.random() * 0.15;
      const ddx = wx - DIG_ZONE.x;
      const ddz = wz - DIG_ZONE.z;
      const dist = Math.sqrt(ddx * ddx + ddz * ddz);
      if (dist < DIG_ZONE.radius) {
        // 굴착 구역 — 흙 더미 (눈에 띄게 높게)
        const mound = 1 - dist / DIG_ZONE.radius;
        h = 0.9 + mound * 1.1 + Math.random() * 0.2;
      }
      heights[idx] = h;
    }
  }
  return {
    heights,
    baseHeights: heights.slice(),
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

export function isInDumpZone(wx: number, wz: number): boolean {
  const dx = wx - DUMP_ZONE.x;
  const dz = wz - DUMP_ZONE.z;
  return Math.sqrt(dx * dx + dz * dz) < DUMP_ZONE.radius;
}

export function isInDigZone(wx: number, wz: number): boolean {
  const dx = wx - DIG_ZONE.x;
  const dz = wz - DIG_ZONE.z;
  return Math.sqrt(dx * dx + dz * dz) < DIG_ZONE.radius;
}
