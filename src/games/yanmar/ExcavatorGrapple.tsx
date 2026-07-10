"use client";

import { useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import {
  YANMAR_MACHINE_COLORS as COLOR,
  YANMAR_MACHINE_MATERIALS as MATERIAL,
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

export interface ExcavatorGrappleProps {
  /** Jaw opening, clamped to the inclusive range 0 (closed) to 1 (fully open). */
  openAmount?: number;
}

function CrossPin({
  position,
  radius = 0.12,
  width = 0.56,
}: {
  position: [number, number, number];
  radius?: number;
  width?: number;
}) {
  return (
    <group position={position}>
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
          <cylinderGeometry args={[radius * 0.68, radius * 0.68, 0.034, 20]} />
          <meshStandardMaterial {...BRIGHT_STEEL} />
        </mesh>
      ))}
    </group>
  );
}

function GrappleClaw({
  shape,
  mirrored,
  angle,
}: {
  shape: THREE.Shape;
  mirrored: boolean;
  angle: number;
}) {
  const direction = mirrored ? -1 : 1;

  return (
    <group rotation={[0, 0, direction * angle]} scale={[1, direction, 1]}>
      <mesh position={[0, 0, -0.14]} castShadow>
        <extrudeGeometry
          args={[
            shape,
            {
              depth: 0.28,
              bevelEnabled: true,
              bevelSize: 0.018,
              bevelThickness: 0.018,
              bevelSegments: 2,
            },
          ]}
        />
        <meshStandardMaterial {...STEEL} side={THREE.DoubleSide} />
      </mesh>

      {/* Raised spine and replaceable gripping tooth. */}
      <mesh position={[-0.75, -0.12, 0]} rotation={[0, 0, 0.2]} castShadow>
        <boxGeometry args={[0.72, 0.075, 0.34]} />
        <meshStandardMaterial color={COLOR.frameLight} {...MATERIAL.frame} />
      </mesh>
      <mesh position={[-1.43, -0.08, 0]} rotation={[0, 0, -0.18]} castShadow>
        <boxGeometry args={[0.28, 0.11, 0.36]} />
        <meshStandardMaterial color={COLOR.chrome} roughness={0.19} metalness={0.84} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[-0.58, -0.01, side * 0.19]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.025, 12]} />
          <meshStandardMaterial {...BRIGHT_STEEL} />
        </mesh>
      ))}
    </group>
  );
}

/** Procedural two-jaw grapple mounted at the arm-end pivot (local origin). */
export function ExcavatorGrapple({ openAmount = 0 }: ExcavatorGrappleProps) {
  const openness = Math.min(1, Math.max(0, openAmount));
  const jawAngle = openness * 0.46;
  const clawShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0.08, 0.11);
    shape.lineTo(-0.34, 0.16);
    shape.quadraticCurveTo(-0.78, 0.1, -1.1, -0.2);
    shape.quadraticCurveTo(-1.34, -0.44, -1.55, -0.11);
    shape.lineTo(-1.43, 0.04);
    shape.quadraticCurveTo(-1.3, -0.16, -1.16, -0.09);
    shape.quadraticCurveTo(-0.78, 0.24, -0.3, 0.27);
    shape.lineTo(0.08, 0.24);
    shape.closePath();
    return shape;
  }, []);

  return (
    <group>
      <CrossPin position={[0, 0, 0]} radius={0.155} width={0.52} />

      {/* Quick-coupler and rotary head. */}
      <group position={[-0.19, -0.08, 0]}>
        <RoundedBox args={[0.46, 0.34, 0.56]} radius={0.075} smoothness={6} castShadow>
          <meshStandardMaterial color={COLOR.paintRedDark} {...MATERIAL.paintedDark} />
        </RoundedBox>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[-0.01, 0.06, side * 0.3]} castShadow>
            <boxGeometry args={[0.36, 0.18, 0.045]} />
            <meshStandardMaterial color={COLOR.paintRed} {...MATERIAL.painted} />
          </mesh>
        ))}
      </group>
      <CrossPin position={[-0.31, -0.13, 0]} radius={0.105} width={0.6} />

      {/* The jaw axis follows the bucket's local -X working direction. */}
      <group position={[-0.25, -0.13, 0]} rotation={[0, 0, -0.06]}>
        <mesh position={[-0.18, 0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.29, 0.29, 0.54, 28]} />
          <meshStandardMaterial {...FRAME} />
        </mesh>
        <mesh position={[-0.18, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.59, 24]} />
          <meshStandardMaterial {...BRIGHT_STEEL} />
        </mesh>

        {/* Twin actuator barrels imply synchronized hydraulic jaw motion. */}
        {[-1, 1].map((side) => (
          <group key={side} scale={[1, side, 1]}>
            <mesh position={[-0.25, 0.3, 0]} rotation={[0, 0, 0.14]}>
              <capsuleGeometry args={[0.065, 0.34, 7, 14]} />
              <meshStandardMaterial {...FRAME_LIGHT} />
            </mesh>
            <mesh position={[-0.33, 0.52, 0]} rotation={[0, 0, 0.14]}>
              <capsuleGeometry args={[0.031, 0.2, 6, 12]} />
              <meshStandardMaterial {...BRIGHT_STEEL} />
            </mesh>
            <mesh position={[-0.37, 0.65, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.075, 0.075, 0.38, 18]} />
              <meshStandardMaterial {...FRAME} />
            </mesh>
          </group>
        ))}

        <GrappleClaw shape={clawShape} mirrored={false} angle={jawAngle} />
        <GrappleClaw shape={clawShape} mirrored angle={jawAngle} />
      </group>
    </group>
  );
}
