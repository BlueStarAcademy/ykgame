"use client";

import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import {
  YANMAR_MACHINE_COLORS as COLOR,
  YANMAR_MACHINE_MATERIALS as MATERIAL,
  YANMAR_MACHINE_RIG,
} from "./machineVisualTheme";

const FRAME = {
  color: COLOR.frame,
  ...MATERIAL.frame,
} as const;
const FRAME_LIGHT = {
  color: COLOR.frameLight,
  ...MATERIAL.frame,
} as const;
const STEEL = {
  color: COLOR.steel,
  ...MATERIAL.steel,
} as const;
const BRIGHT_STEEL = {
  color: COLOR.steelBright,
  ...MATERIAL.steel,
} as const;

const BREAKER_TOOL_PROFILE = [
  new THREE.Vector2(0, -0.34),
  new THREE.Vector2(0.13, -0.34),
  new THREE.Vector2(0.118, -0.29),
  new THREE.Vector2(0.108, -0.22),
  new THREE.Vector2(0.103, 0.08),
  new THREE.Vector2(0.096, 0.15),
  new THREE.Vector2(0.08, 0.24),
  new THREE.Vector2(0.058, 0.32),
  new THREE.Vector2(0.039, 0.365),
  new THREE.Vector2(0.028, 0.382),
  new THREE.Vector2(0, 0.385),
];

function PivotPin({
  x,
  y,
  radius,
  width,
}: {
  x: number;
  y: number;
  radius: number;
  width: number;
}) {
  return (
    <group position={[x, y, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[radius, radius, width, 24]} />
        <meshStandardMaterial {...FRAME} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[0, 0, side * (width / 2 + 0.012)]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[radius * 0.7, radius * 0.7, 0.035, 20]} />
          <meshStandardMaterial {...BRIGHT_STEEL} />
        </mesh>
      ))}
    </group>
  );
}

function HydraulicHose({ side }: { side: -1 | 1 }) {
  return (
    <group position={[0, 0, side * 0.25]}>
      <mesh position={[-0.35, 0.25, 0]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.026, 0.48, 6, 12]} />
        <meshStandardMaterial color="#090d10" roughness={0.7} metalness={0.12} />
      </mesh>
      <mesh position={[-0.67, 0.17, 0]} rotation={[0, 0, 0.92]}>
        <capsuleGeometry args={[0.026, 0.26, 6, 12]} />
        <meshStandardMaterial color="#090d10" roughness={0.7} metalness={0.12} />
      </mesh>
      <mesh position={[-0.14, 0.25, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.045, 0.045, 0.09, 16]} />
        <meshStandardMaterial {...BRIGHT_STEEL} />
      </mesh>
    </group>
  );
}

/** Procedural hydraulic breaker mounted at the arm-end pivot (local origin). */
export function ExcavatorBreaker() {
  return (
    <group>
      <PivotPin x={0} y={0} radius={0.155} width={0.52} />

      {/* Quick-coupler cradle, matching the bucket linkage footprint. */}
      <group position={[-0.16, -0.08, 0]}>
        <RoundedBox args={[0.42, 0.34, 0.54]} radius={0.075} smoothness={5} castShadow>
          <meshStandardMaterial color={COLOR.paintRedDark} {...MATERIAL.paintedDark} />
        </RoundedBox>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[0.02, 0.07, side * 0.292]} castShadow>
            <boxGeometry args={[0.35, 0.17, 0.045]} />
            <meshStandardMaterial color={COLOR.paintRed} {...MATERIAL.painted} />
          </mesh>
        ))}
      </group>
      <PivotPin x={-0.28} y={-0.12} radius={0.105} width={0.58} />

      {/* Breaker body follows the bucket's local -X working direction. */}
      <group rotation={[0, 0, YANMAR_MACHINE_RIG.breakerRotationZ]}>
        <RoundedBox
          args={[0.88, 0.48, 0.5]}
          radius={0.105}
          smoothness={7}
          position={[-0.72, -0.15, 0]}
          castShadow
        >
          <meshStandardMaterial {...FRAME_LIGHT} />
        </RoundedBox>
        <RoundedBox
          args={[0.62, 0.3, 0.54]}
          radius={0.065}
          smoothness={6}
          position={[-0.62, -0.13, 0]}
          castShadow
        >
          <meshStandardMaterial color={COLOR.paintRed} {...MATERIAL.painted} />
        </RoundedBox>

        {[-1, 1].map((side) => (
          <group key={side} position={[0, 0, side * 0.285]}>
            <mesh position={[-0.69, -0.13, 0]}>
              <boxGeometry args={[0.5, 0.055, 0.025]} />
              <meshStandardMaterial color={COLOR.paintHighlight} {...MATERIAL.painted} />
            </mesh>
            {[-0.9, -0.66, -0.42].map((x) => (
              <mesh key={x} position={[x, -0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.035, 0.035, 0.025, 12]} />
                <meshStandardMaterial {...BRIGHT_STEEL} />
              </mesh>
            ))}
          </group>
        ))}

        <HydraulicHose side={-1} />
        <HydraulicHose side={1} />

        <mesh position={[-1.18, -0.15, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.22, 0.17, 0.34, 24]} />
          <meshStandardMaterial {...FRAME} />
        </mesh>
        <mesh position={[-1.39, -0.15, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.145, 0.115, 0.19, 24]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
        {/* 축과 둥근 날끝을 하나의 연속 곡면으로 만들어 이음새를 없앤다. */}
        <mesh
          position={[
            YANMAR_MACHINE_RIG.breakerTipLocalX + 0.385,
            YANMAR_MACHINE_RIG.breakerTipLocalY,
            0,
          ]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <latheGeometry args={[BREAKER_TOOL_PROFILE, 32]} />
          <meshStandardMaterial {...BRIGHT_STEEL} />
        </mesh>
      </group>
    </group>
  );
}
