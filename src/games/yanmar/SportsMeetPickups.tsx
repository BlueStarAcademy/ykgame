"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { StarMesh } from "./StarMesh";
import { BoosterMesh } from "./WorldPickupMeshes";
import type { SportsMeetRunState } from "./sportsMeet/types";

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
    const stars = run.courseStars;
    const buffsLive = run.speedBuffs;
    for (const child of g.children) {
      const id = child.userData.pickupId as string | undefined;
      const kind = child.userData.kind as "star" | "buff" | undefined;
      if (!id || !kind) continue;
      let collected = true;
      if (kind === "star") {
        for (let i = 0; i < stars.length; i++) {
          if (stars[i]!.id === id) {
            collected = stars[i]!.collected;
            break;
          }
        }
      } else {
        for (let i = 0; i < buffsLive.length; i++) {
          if (buffsLive[i]!.id === id) {
            collected = buffsLive[i]!.collected;
            break;
          }
        }
      }
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
        <group
          key={b.id}
          position={[b.x, b.y, b.z]}
          userData={{ baseY: b.y, pickupId: b.id, kind: "buff" }}
          visible={!b.collected}
        >
          <BoosterMesh />
        </group>
      ))}
    </group>
  );
}
