"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { HaulTruckState } from "./terrain";

export function HaulTruckModel({
  state,
  rockCount,
}: {
  state: HaulTruckState;
  rockCount: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const progress = Math.min(1, state.phaseElapsed / (state.phase === "arriving" ? 8 : 5));
    if (state.phase === "departing") {
      group.position.x = progress * 34;
      group.visible = true;
    } else if (state.phase === "arriving") {
      group.position.x = (1 - progress) * 34;
      group.visible = true;
    } else {
      group.position.x = 0;
      group.visible = state.phase === "ready";
    }
  });

  return (
    <group ref={groupRef} rotation={[0, -Math.PI / 2, 0]}>
      <RoundedBox args={[6.8, 1.1, 3.3]} radius={0.18} position={[0, 1.45, 0]} castShadow>
        <meshStandardMaterial color="#7f1d1d" roughness={0.42} metalness={0.28} />
      </RoundedBox>
      <RoundedBox args={[2.25, 2.55, 3.15]} radius={0.22} position={[2.15, 2.35, 0]} castShadow>
        <meshStandardMaterial color="#b91c1c" roughness={0.36} metalness={0.22} />
      </RoundedBox>
      <mesh position={[2.42, 2.7, -1.59]}>
        <planeGeometry args={[1.42, 0.78]} />
        <meshStandardMaterial color="#5e7f91" metalness={0.42} roughness={0.18} />
      </mesh>
      <group position={[-1, 2.05, 0]}>
        <RoundedBox args={[4.35, 1.55, 3.4]} radius={0.15} castShadow>
          <meshStandardMaterial color="#5b6470" roughness={0.58} metalness={0.5} />
        </RoundedBox>
        {Array.from({ length: Math.min(12, rockCount) }, (_, index) => (
          <mesh
            key={index}
            position={[
              -1.55 + (index % 4) * 1.02,
              1 + Math.floor(index / 4) * 0.72,
              -0.9 + (index % 3) * 0.9,
            ]}
            scale={[0.62, 0.5, 0.58]}
            castShadow
          >
            <dodecahedronGeometry args={[0.72, 0]} />
            <meshStandardMaterial color="#59616a" roughness={0.94} />
          </mesh>
        ))}
      </group>
      {[
        [-2.1, -1.5],
        [-2.1, 1.5],
        [1.7, -1.5],
        [1.7, 1.5],
      ].map(([x, z], index) => (
        <mesh key={index} position={[x, 0.78, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.72, 0.72, 0.48, 24]} />
          <meshStandardMaterial color="#15191f" roughness={0.84} />
        </mesh>
      ))}
      <mesh position={[3.3, 2.2, 0]}>
        <boxGeometry args={[0.12, 0.72, 2.6]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.18} />
      </mesh>
    </group>
  );
}
