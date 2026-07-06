const GRID_SIZE = 32;
const CELL = 1.5;

export interface TerrainData {
  heights: Float32Array;
  gridSize: number;
  cellSize: number;
  originX: number;
  originZ: number;
}

export function createTerrain(
  originX = -24,
  originZ = -10,
): TerrainData {
  const heights = new Float32Array(GRID_SIZE * GRID_SIZE);
  for (let i = 0; i < heights.length; i++) {
    heights[i] = 0.8 + Math.random() * 0.3;
  }
  return { heights, gridSize: GRID_SIZE, cellSize: CELL, originX, originZ };
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

export const DIG_ZONE = { x: -5, z: 5, radius: 8 };
export const DUMP_ZONE = { x: 12, z: -5, radius: 5 };

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
