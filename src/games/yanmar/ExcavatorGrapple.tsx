"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  GRAPPLE_THUMB_HINGE,
  GRAPPLE_THUMB_MAX_OPEN_RAD,
  GRAPPLE_THUMB_OPEN_SIGN,
} from "./grappleArmClearance";
import { WorkLinkPin } from "./workEquipment/ykWorkGear";

const SHELL = "#2a323a";
const SHELL_DARK = "#1a2028";

export interface ExcavatorGrappleProps {
  openAmountRef: RefObject<THREE.Group | null>;
}

/**
 * Hydraulic thumb: arms + tip plate.
 * No scrapers on the tip — only the clamp face, oriented to bite
 * toward the bucket teeth (plate face flipped vs the old outward pad).
 */
export function ExcavatorGrapple({ openAmountRef }: ExcavatorGrappleProps) {
  const thumbRef = useRef<THREE.Group>(null);
  const currentOpenRef = useRef(1);
  const hinge = GRAPPLE_THUMB_HINGE;

  const armShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0.05, 0.05);
    shape.lineTo(-0.1, 0.06);
    shape.quadraticCurveTo(-0.42, -0.02, -0.7, -0.26);
    shape.quadraticCurveTo(-0.98, -0.42, -1.26, -0.5);
    shape.lineTo(-1.18, -0.58);
    shape.quadraticCurveTo(-0.92, -0.42, -0.55, -0.26);
    shape.quadraticCurveTo(-0.3, -0.1, -0.04, 0.0);
    shape.lineTo(0.05, 0.0);
    shape.closePath();
    return shape;
  }, []);

  useFrame((_, delta) => {
    const target = Math.max(
      0,
      Math.min(1, Number(openAmountRef.current?.userData.openAmount ?? 1)),
    );
    currentOpenRef.current +=
      (target - currentOpenRef.current) * (1 - Math.exp(-delta * 10));
    if (thumbRef.current) {
      thumbRef.current.rotation.z =
        GRAPPLE_THUMB_OPEN_SIGN *
        currentOpenRef.current *
        GRAPPLE_THUMB_MAX_OPEN_RAD;
    }
  });

  return (
    <group>
      {([-1, 1] as const).map((side) => (
        <mesh
          key={side}
          position={[hinge.x - 0.02, hinge.y - 0.02, side * 0.3]}
          rotation={[0, 0, -0.1]}
          castShadow
        >
          <boxGeometry args={[0.2, 0.12, 0.05]} />
          <meshStandardMaterial color={SHELL_DARK} metalness={0.48} roughness={0.4} />
        </mesh>
      ))}

      <group ref={thumbRef} position={[hinge.x, hinge.y, 0]}>
        <WorkLinkPin x={0} y={0} radius={0.065} width={0.52} plain />

        {([-1, 1] as const).map((side) => (
          <mesh key={side} position={[0, 0, side * 0.3 - 0.04]} castShadow>
            <extrudeGeometry
              args={[
                armShape,
                {
                  depth: 0.08,
                  bevelEnabled: true,
                  bevelSize: 0.008,
                  bevelThickness: 0.008,
                  bevelSegments: 1,
                },
              ]}
            />
            <meshStandardMaterial
              color={SHELL}
              metalness={0.48}
              roughness={0.38}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}

        {/*
          Tip plate — reaches scraper tips when closed; bite pad faces the jaw.
        */}
        <group position={[-1.24, -0.5, 0]} rotation={[0, 0, -0.36]}>
          <mesh position={[0.08, 0, 0]} castShadow>
            <boxGeometry args={[0.16, 0.07, 0.68]} />
            <meshStandardMaterial color={SHELL_DARK} metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[0.06, 0.055, 0]} castShadow>
            <boxGeometry args={[0.13, 0.05, 0.62]} />
            <meshStandardMaterial color={SHELL} metalness={0.48} roughness={0.38} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
