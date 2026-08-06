"use client";

import { useMemo } from "react";
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
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.03,
    bevelSegments: 2,
  });
  geo.center();
  // Keep in XY (vertical). Do not rotate onto the ground plane.
  return geo;
}

/** Shared 5-point extruded star used by world pickups and sports-meet courses. */
export function StarMesh() {
  const geo = useMemo(() => createStarShape(), []);
  return (
    <group>
      <mesh geometry={geo} castShadow>
        <meshStandardMaterial
          color="#ffd24a"
          emissive="#c99612"
          emissiveIntensity={0.55}
          metalness={0.35}
          roughness={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0, 0]} scale={0.38}>
        <octahedronGeometry args={[0.35, 0]} />
        <meshStandardMaterial
          color="#fff6c8"
          emissive="#ffcc44"
          emissiveIntensity={0.35}
          metalness={0.2}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}
