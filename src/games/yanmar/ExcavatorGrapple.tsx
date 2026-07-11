"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  YANMAR_MACHINE_COLORS as COLOR,
  YANMAR_MACHINE_MATERIALS as MATERIAL,
} from "./machineVisualTheme";

export interface ExcavatorGrappleProps {
  /** Parent group userData.openAmount: 0=closed against bucket, 1=fully open. */
  openAmountRef: RefObject<THREE.Group | null>;
}

function CrossPin({
  position,
  radius,
  width,
}: {
  position: [number, number, number];
  radius: number;
  width: number;
}) {
  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[radius, radius, width, 24]} />
        <meshStandardMaterial
          color={COLOR.frame}
          {...MATERIAL.frame}
        />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[0, 0, side * (width / 2 + 0.012)]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[radius * 0.66, radius * 0.66, 0.034, 18]} />
          <meshStandardMaterial
            color={COLOR.steelBright}
            {...MATERIAL.steel}
          />
        </mesh>
      ))}
    </group>
  );
}

function ThumbTine({
  side,
  shape,
}: {
  side: -1 | 1;
  shape: THREE.Shape;
}) {
  return (
    <mesh position={[0, 0, side * 0.29]} castShadow>
      <extrudeGeometry
        args={[
          shape,
          {
            depth: 0.09,
            bevelEnabled: true,
            bevelSize: 0.012,
            bevelThickness: 0.012,
            bevelSegments: 2,
          },
        ]}
      />
      <meshStandardMaterial
        color={COLOR.steel}
        {...MATERIAL.steel}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/** 버켓 위에 장착되어 버켓 이빨과 맞물리는 유압식 엄지 집게. */
export function ExcavatorGrapple({
  openAmountRef,
}: ExcavatorGrappleProps) {
  const thumbRef = useRef<THREE.Group>(null);
  const currentOpenRef = useRef(1);
  const tineShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0.08, 0.11);
    shape.lineTo(-0.2, 0.17);
    shape.quadraticCurveTo(-0.62, 0.12, -0.93, -0.12);
    shape.quadraticCurveTo(-1.1, -0.25, -1.18, -0.42);
    shape.lineTo(-1.08, -0.48);
    shape.quadraticCurveTo(-0.97, -0.31, -0.82, -0.2);
    shape.quadraticCurveTo(-0.55, -0.01, -0.16, 0.02);
    shape.lineTo(0.08, 0.01);
    shape.closePath();
    return shape;
  }, []);

  useFrame((_, delta) => {
    const target = Math.max(
      0,
      Math.min(1, Number(openAmountRef.current?.userData.openAmount ?? 1)),
    );
    // 유압 엄지의 개폐 속도는 기존 대비 절반으로 낮춘다.
    const follow = 1 - Math.exp(-delta * 5);
    currentOpenRef.current += (target - currentOpenRef.current) * follow;
    if (thumbRef.current) {
      thumbRef.current.rotation.z = -currentOpenRef.current * 0.82;
    }
  });

  return (
    <group>
      {/* 버켓 링크 위 고정 브래킷. 버켓 자체는 별도 컴포넌트로 항상 함께 보인다. */}
      <CrossPin position={[-0.03, 0.18, 0]} radius={0.14} width={0.68} />
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[-0.08, 0.23, side * 0.3]}
          rotation={[0, 0, -0.16]}
          castShadow
        >
          <boxGeometry args={[0.52, 0.16, 0.08]} />
          <meshStandardMaterial
            color={COLOR.paintRedDark}
            {...MATERIAL.paintedDark}
          />
        </mesh>
      ))}

      {/* 엄지를 여닫는 중앙 유압 실린더. */}
      <mesh position={[-0.12, 0.48, 0]} rotation={[0, 0, -0.22]}>
        <capsuleGeometry args={[0.075, 0.46, 8, 16]} />
        <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
      </mesh>
      <mesh position={[-0.29, 0.7, 0]} rotation={[0, 0, -0.22]}>
        <capsuleGeometry args={[0.035, 0.3, 7, 14]} />
        <meshStandardMaterial
          color={COLOR.steelBright}
          {...MATERIAL.steel}
        />
      </mesh>

      <group ref={thumbRef} position={[-0.08, 0.2, 0]}>
        <CrossPin position={[0, 0, 0]} radius={0.12} width={0.72} />
        <ThumbTine side={-1} shape={tineShape} />
        <ThumbTine side={1} shape={tineShape} />
        <mesh position={[-0.52, 0.01, 0]} castShadow>
          <boxGeometry args={[0.65, 0.09, 0.64]} />
          <meshStandardMaterial
            color={COLOR.frameLight}
            {...MATERIAL.frame}
          />
        </mesh>
        <mesh position={[-1.11, -0.43, 0]} castShadow>
          <boxGeometry args={[0.2, 0.11, 0.7]} />
          <meshStandardMaterial
            color={COLOR.chrome}
            roughness={0.19}
            metalness={0.84}
          />
        </mesh>
      </group>
    </group>
  );
}
