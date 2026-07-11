"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, Text } from "@react-three/drei";
import * as THREE from "three";
import type { HaulTruckState } from "./terrain";
import {
  YANMAR_MACHINE_COLORS as COLORS,
  YANMAR_MACHINE_MATERIALS as MATERIALS,
} from "./machineVisualTheme";

function PremiumWheel({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0.78, z]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.76, 0.76, 0.5, 28]} />
        <meshStandardMaterial color={COLORS.rubber} {...MATERIALS.rubber} />
      </mesh>
      <mesh
        position={[0, 0, z > 0 ? 0.265 : -0.265]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.4, 0.4, 0.035, 20]} />
        <meshStandardMaterial color={COLORS.steel} {...MATERIALS.steel} />
      </mesh>
      <mesh
        position={[0, 0, z > 0 ? 0.288 : -0.288]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.16, 0.16, 0.045, 16]} />
        <meshStandardMaterial color="#202a32" roughness={0.34} metalness={0.68} />
      </mesh>
      {Array.from({ length: 8 }, (_, index) => {
        const angle = (index / 8) * Math.PI * 2;
        return (
          <mesh
            key={index}
            position={[
              Math.cos(angle) * 0.28,
              Math.sin(angle) * 0.28,
              z > 0 ? 0.314 : -0.314,
            ]}
          >
            <sphereGeometry args={[0.035, 6, 6]} />
            <meshStandardMaterial color={COLORS.chrome} metalness={0.88} roughness={0.14} />
          </mesh>
        );
      })}
    </group>
  );
}

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
    if (state.phase === "engineStart") {
      group.position.x = Math.sin(state.phaseElapsed * 34) * 0.025;
      group.visible = true;
    } else if (state.phase === "departing") {
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
      {/* High-clearance black chassis under the painted body. */}
      <RoundedBox args={[6.9, 0.42, 2.55]} radius={0.12} position={[-0.05, 1.1, 0]} castShadow>
        <meshStandardMaterial color={COLORS.frame} {...MATERIALS.frame} />
      </RoundedBox>
      <RoundedBox args={[6.55, 0.92, 3.12]} radius={0.2} position={[0, 1.52, 0]} castShadow>
        <meshStandardMaterial color={COLORS.paintRedDark} {...MATERIALS.paintedDark} />
      </RoundedBox>

      {/* Deep quarry bed with reinforced floor, side rails and ribs. */}
      <group position={[-1.05, 2.2, 0]}>
        <RoundedBox args={[4.25, 0.24, 3.36]} radius={0.08} position={[0, -0.55, 0]} castShadow>
          <meshStandardMaterial color={COLORS.truckBedDark} {...MATERIALS.paintedDark} />
        </RoundedBox>
        {[-1, 1].map((side) => (
          <group key={side} position={[0, 0.05, side * 1.62]}>
            <RoundedBox args={[4.4, 1.45, 0.18]} radius={0.06} castShadow>
              <meshStandardMaterial color={COLORS.truckBed} {...MATERIALS.painted} />
            </RoundedBox>
            {[-1.55, -0.78, 0, 0.78, 1.55].map((x) => (
              <mesh key={x} position={[x, 0, side * 0.11]} rotation={[0, 0, -0.12]}>
                <boxGeometry args={[0.11, 1.28, 0.12]} />
                <meshStandardMaterial color={COLORS.paintHighlight} {...MATERIALS.painted} />
              </mesh>
            ))}
            <Text
              position={[0, 0.02, side * 0.115]}
              rotation={[0, side > 0 ? 0 : Math.PI, 0]}
              fontSize={0.42}
              color="#fff7ed"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.018}
              outlineColor={COLORS.paintRedDark}
            >
              YK QUARRY
            </Text>
          </group>
        ))}
        <RoundedBox args={[0.2, 1.5, 3.35]} radius={0.05} position={[-2.12, 0.04, 0]} castShadow>
          <meshStandardMaterial color={COLORS.truckBed} {...MATERIALS.painted} />
        </RoundedBox>
        {Array.from({ length: Math.min(12, rockCount) }, (_, index) => (
          <mesh
            key={index}
            position={[
              -1.55 + (index % 4) * 1.02,
              0.45 + Math.floor(index / 4) * 0.56,
              -0.9 + (index % 3) * 0.9,
            ]}
            rotation={[index * 0.31, index * 0.73, index * 0.19]}
            scale={[0.42, 0.34, 0.39]}
            castShadow
          >
            <icosahedronGeometry args={[0.72, 1]} />
            <meshStandardMaterial color={index % 2 ? "#64748b" : "#7c8ca0"} roughness={0.66} metalness={0.18} />
          </mesh>
        ))}
      </group>

      {/* Sculpted cab, glass canopy and front service deck. */}
      <group position={[2.15, 2.34, 0]}>
        <RoundedBox args={[2.25, 2.48, 3.08]} radius={0.24} castShadow>
          <meshStandardMaterial color={COLORS.paintRed} {...MATERIALS.painted} />
        </RoundedBox>
        <RoundedBox args={[2.02, 0.18, 3.18]} radius={0.08} position={[-0.03, 1.27, 0]} castShadow>
          <meshStandardMaterial color={COLORS.frameLight} {...MATERIALS.frame} />
        </RoundedBox>
        <mesh position={[1.13, 0.36, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[2.28, 0.92]} />
          <meshStandardMaterial color={COLORS.glass} {...MATERIALS.glass} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[0.27, 0.35, side * 1.548]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
            <planeGeometry args={[1.35, 0.9]} />
            <meshStandardMaterial color={COLORS.glass} {...MATERIALS.glass} />
          </mesh>
        ))}
        <mesh position={[1.145, -0.55, 0]}>
          <boxGeometry args={[0.1, 0.58, 2.52]} />
          <meshStandardMaterial color="#111820" roughness={0.38} metalness={0.72} />
        </mesh>
        {[-0.78, 0, 0.78].map((z) => (
          <mesh key={z} position={[1.205, -0.5, z]}>
            <boxGeometry args={[0.08, 0.15, 0.48]} />
            <meshStandardMaterial color={COLORS.frameLight} {...MATERIALS.frame} />
          </mesh>
        ))}
        {[-0.88, 0.88].map((z) => (
          <mesh key={z} position={[1.23, -0.15, z]}>
            <boxGeometry args={[0.08, 0.3, 0.42]} />
            <meshStandardMaterial
              color={COLORS.lamp}
              emissive={COLORS.lamp}
              emissiveIntensity={0.9}
              roughness={0.16}
            />
          </mesh>
        ))}
      </group>

      {/* Hydraulic ram, exhaust, safety rails and access steps. */}
      <mesh position={[0.05, 1.95, 0]} rotation={[0, 0, -0.62]} castShadow>
        <cylinderGeometry args={[0.11, 0.14, 2.25, 14]} />
        <meshStandardMaterial color={COLORS.steelBright} {...MATERIALS.steel} />
      </mesh>
      <group position={[1.12, 3.42, 1.34]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.1, 0.13, 1.52, 12]} />
          <meshStandardMaterial color={COLORS.frame} {...MATERIALS.frame} />
        </mesh>
        <mesh position={[0.1, 0.76, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.14, 0.14, 0.32, 12]} />
          <meshStandardMaterial color={COLORS.frameLight} {...MATERIALS.frame} />
        </mesh>
      </group>
      {[0.72, 1.16, 1.6].map((y) => (
        <mesh key={y} position={[2.88, y, -1.7]}>
          <boxGeometry args={[0.72, 0.1, 0.3]} />
          <meshStandardMaterial color={COLORS.steel} {...MATERIALS.steel} />
        </mesh>
      ))}
      {[-2.3, -0.85, 1.85].flatMap((x) =>
        [-1.58, 1.58].map((z) => <PremiumWheel key={`${x}-${z}`} x={x} z={z} />),
      )}
      <mesh position={[3.34, 1.72, 0]}>
        <boxGeometry args={[0.15, 0.62, 2.9]} />
        <meshStandardMaterial color={COLORS.warning} emissive="#b45309" emissiveIntensity={0.16} {...MATERIALS.painted} />
      </mesh>
    </group>
  );
}
