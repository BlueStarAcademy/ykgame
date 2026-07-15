"use client";

import { useMemo } from "react";

/** Placeholder tent near spawn — replace mesh/texture later. */
export function RepairTent({
  x = -26,
  z = -18,
  radius = 10,
}: {
  x?: number;
  z?: number;
  radius?: number;
}) {
  const poles = useMemo(
    () => [
      [x - 1.2, z - 1.2],
      [x + 1.2, z - 1.2],
      [x - 1.2, z + 1.2],
      [x + 1.2, z + 1.2],
    ],
    [x, z],
  );

  return (
    <group position={[0, 0, 0]}>
      <mesh position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius - 0.35, radius, 48]} />
        <meshBasicMaterial color="#c4a35a" transparent opacity={0.35} />
      </mesh>
      {poles.map(([px, pz], i) => (
        <mesh key={i} position={[px, 1.1, pz]}>
          <cylinderGeometry args={[0.06, 0.06, 2.2, 6]} />
          <meshStandardMaterial color="#6b4f2a" />
        </mesh>
      ))}
      <mesh position={[x, 2.15, z]}>
        <boxGeometry args={[3.2, 0.12, 3.2]} />
        <meshStandardMaterial color="#d9b45c" />
      </mesh>
      <mesh position={[x, 1.55, z]}>
        <boxGeometry args={[2.6, 1.1, 0.08]} />
        <meshStandardMaterial color="#8b1e1e" />
      </mesh>
    </group>
  );
}

export function isInRepairTentRange(
  posX: number,
  posZ: number,
  tentX = -26,
  tentZ = -18,
  radius = 10,
) {
  const dx = posX - tentX;
  const dz = posZ - tentZ;
  return dx * dx + dz * dz <= radius * radius;
}
