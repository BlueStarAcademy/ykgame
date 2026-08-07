"use client";

import * as THREE from "three";

function createStarShape() {
  const shape = new THREE.Shape();
  const spikes = 5;
  const outer = 0.55;
  const inner = 0.24;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    // Tip points up (+Y). sin(+π/2)=1 → first outer tip at (0, +r).
    const a = (i / (spikes * 2)) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  // Light bevel — shared across all stars (do not dispose per instance).
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.02,
    bevelSegments: 1,
  });
  geo.center();
  return geo;
}

const SHARED_STAR_GEO = createStarShape();
const SHARED_CORE_GEO = new THREE.OctahedronGeometry(0.35, 0);

const SHARED_STAR_MAT = new THREE.MeshStandardMaterial({
  color: "#ffd24a",
  emissive: "#c99612",
  emissiveIntensity: 0.55,
  metalness: 0.35,
  roughness: 0.35,
  side: THREE.DoubleSide,
});

const SHARED_CORE_MAT = new THREE.MeshStandardMaterial({
  color: "#fff6c8",
  emissive: "#ffcc44",
  emissiveIntensity: 0.35,
  metalness: 0.2,
  roughness: 0.4,
});

/** Shared 5-point extruded star used by world pickups and sports-meet courses. */
export function StarMesh({ castShadow = false }: { castShadow?: boolean }) {
  return (
    <group>
      <mesh
        geometry={SHARED_STAR_GEO}
        material={SHARED_STAR_MAT}
        castShadow={castShadow}
      />
      <mesh
        geometry={SHARED_CORE_GEO}
        material={SHARED_CORE_MAT}
        scale={0.38}
      />
    </group>
  );
}
