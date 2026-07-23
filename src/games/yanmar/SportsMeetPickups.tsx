"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import type { SportsMeetRunState } from "./sportsMeet/types";

export function SportsMeetPickups({
  runRef,
  revision,
}: {
  runRef: React.RefObject<SportsMeetRunState | null>;
  revision: number;
}) {
  const groupRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    const t = clock.elapsedTime;
    for (const child of g.children) {
      child.position.y =
        (child.userData.baseY as number) +
        Math.sin(t * 3 + child.position.x) * 0.12;
      child.rotation.y = t * 1.4;
    }
  });

  const run = runRef.current;
  if (!run) return null;

  return (
    <group ref={groupRef} key={revision}>
      {run.courseStars
        .filter((s) => !s.collected)
        .map((s) => (
          <mesh
            key={s.id}
            position={[s.x, s.y, s.z]}
            userData={{ baseY: s.y }}
          >
            <octahedronGeometry args={[0.55, 0]} />
            <meshStandardMaterial
              color="#fbbf24"
              emissive="#f59e0b"
              emissiveIntensity={0.55}
              metalness={0.35}
              roughness={0.25}
            />
          </mesh>
        ))}
      {run.speedBuffs
        .filter((b) => !b.collected)
        .map((b) => (
          <mesh
            key={b.id}
            position={[b.x, b.y, b.z]}
            userData={{ baseY: b.y }}
          >
            <boxGeometry args={[0.7, 0.7, 0.7]} />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#0ea5e9"
              emissiveIntensity={0.5}
              metalness={0.3}
              roughness={0.3}
            />
          </mesh>
        ))}
    </group>
  );
}
