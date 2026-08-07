"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { StarMesh } from "./StarMesh";
import type { SportsMeetRunState } from "./sportsMeet/types";

const SHARED_BUFF_GEO = new THREE.BoxGeometry(0.7, 0.7, 0.7);
const SHARED_BUFF_MAT = new THREE.MeshStandardMaterial({
  color: "#38bdf8",
  emissive: "#0ea5e9",
  emissiveIntensity: 0.5,
  metalness: 0.3,
  roughness: 0.3,
});

export function SportsMeetPickups({
  runRef,
  revision,
}: {
  runRef: React.RefObject<SportsMeetRunState | null>;
  revision: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  // Rebuild placement when the stage refreshes pickups — no full remount on collect.
  const stars = useMemo(() => {
    void revision;
    return (runRef.current?.courseStars ?? []).map((s) => ({ ...s }));
  }, [revision, runRef]);
  const buffs = useMemo(() => {
    void revision;
    return (runRef.current?.speedBuffs ?? []).map((b) => ({ ...b }));
  }, [revision, runRef]);

  useFrame(({ clock }) => {
    const g = groupRef.current;
    const run = runRef.current;
    if (!g || !run) return;
    const t = clock.elapsedTime;
    const starCollected = new Map(
      run.courseStars.map((s) => [s.id, s.collected] as const),
    );
    const buffCollected = new Map(
      run.speedBuffs.map((b) => [b.id, b.collected] as const),
    );
    for (const child of g.children) {
      const id = child.userData.pickupId as string | undefined;
      const kind = child.userData.kind as "star" | "buff" | undefined;
      if (!id || !kind) continue;
      const collected =
        kind === "star"
          ? (starCollected.get(id) ?? true)
          : (buffCollected.get(id) ?? true);
      child.visible = !collected;
      if (collected) continue;
      child.position.y =
        (child.userData.baseY as number) +
        Math.sin(t * 3 + child.position.x) * 0.12;
      child.rotation.y = t * 1.4;
    }
  });

  return (
    <group ref={groupRef}>
      {stars.map((s) => (
        <group
          key={s.id}
          position={[s.x, s.y, s.z]}
          userData={{ baseY: s.y, pickupId: s.id, kind: "star" }}
          visible={!s.collected}
        >
          <StarMesh />
        </group>
      ))}
      {buffs.map((b) => (
        <mesh
          key={b.id}
          position={[b.x, b.y, b.z]}
          userData={{ baseY: b.y, pickupId: b.id, kind: "buff" }}
          geometry={SHARED_BUFF_GEO}
          material={SHARED_BUFF_MAT}
          visible={!b.collected}
        />
      ))}
    </group>
  );
}
