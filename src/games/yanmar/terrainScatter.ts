import * as THREE from "three";
import type { TerrainData } from "./terrain";
import { sampleHeight } from "./terrain";

export interface ScatterRock {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotY: number;
  rotX: number;
}

function seededRandom(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function buildTerrainScatterRocks(terrain: TerrainData, perZone = 28): ScatterRock[] {
  const rocks: ScatterRock[] = [];
  const span = terrain.gridSize * terrain.cellSize;

  for (const zone of terrain.digZones) {
    for (let i = 0; i < perZone; i++) {
      const seed = zone.x * 17 + zone.z * 31 + i * 97;
      const angle = seededRandom(seed) * Math.PI * 2;
      const dist = seededRandom(seed + 1) * zone.radius * 0.92;
      const x = zone.x + Math.cos(angle) * dist;
      const z = zone.z + Math.sin(angle) * dist;
      const y = sampleHeight(terrain, x, z);
      rocks.push({
        x,
        y: y + 0.03,
        z,
        scale: 0.12 + seededRandom(seed + 2) * 0.22,
        rotY: seededRandom(seed + 3) * Math.PI,
        rotX: (seededRandom(seed + 4) - 0.5) * 0.35,
      });
    }
  }

  for (let i = 0; i < 48; i++) {
    const seed = i * 53 + 7;
    const x = terrain.originX + 8 + seededRandom(seed) * (span - 16);
    const z = terrain.originZ + 8 + seededRandom(seed + 1) * (span - 16);
    const y = sampleHeight(terrain, x, z);
    if (y < 1.05) {
      rocks.push({
        x,
        y: y + 0.02,
        z,
        scale: 0.08 + seededRandom(seed + 2) * 0.14,
        rotY: seededRandom(seed + 3) * Math.PI,
        rotX: (seededRandom(seed + 4) - 0.5) * 0.25,
      });
    }
  }

  return rocks;
}

export function createRockGeometry() {
  const geo = new THREE.DodecahedronGeometry(1, 0);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const sx = 0.82 + seededRandom(i * 1.7) * 0.36;
    const sy = 0.55 + seededRandom(i * 2.3) * 0.3;
    const sz = 0.78 + seededRandom(i * 3.1) * 0.34;
    pos.setX(i, pos.getX(i) * sx);
    pos.setY(i, pos.getY(i) * sy);
    pos.setZ(i, pos.getZ(i) * sz);
  }
  geo.computeVertexNormals();
  return geo;
}
