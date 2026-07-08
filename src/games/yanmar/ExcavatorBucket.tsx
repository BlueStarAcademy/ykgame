"use client";

import { useMemo, type RefObject } from "react";
import * as THREE from "three";

const STEEL = {
  color: "#3f4b55",
  metalness: 0.62,
  roughness: 0.26,
} as const;
const STEEL_DARK = {
  color: "#202a33",
  metalness: 0.58,
  roughness: 0.36,
} as const;
const EDGE = {
  color: "#d8e0e8",
  metalness: 0.78,
  roughness: 0.18,
} as const;
const LINK = {
  color: "#151d25",
  metalness: 0.54,
  roughness: 0.26,
} as const;

function LinkPin({
  x,
  y,
  z = 0,
  radius = 0.14,
  width = 0.46,
}: {
  x: number;
  y: number;
  z?: number;
  radius?: number;
  width?: number;
}) {
  return (
    <group position={[x, y, z]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius, radius, width, 24]} />
        <meshStandardMaterial {...LINK} />
      </mesh>
      {[1, -1].map((side) => (
        <mesh
          key={side}
          position={[0, 0, side * (width / 2 + 0.014)]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[radius * 0.72, radius * 0.72, 0.035, 24]} />
          <meshStandardMaterial color="#d7dee6" roughness={0.22} metalness={0.72} />
        </mesh>
      ))}
    </group>
  );
}

function HydraulicRod({
  x,
  y,
  length,
  angle,
}: {
  x: number;
  y: number;
  length: number;
  angle: number;
}) {
  return (
    <group position={[x, y, 0]} rotation={[0, 0, angle]}>
      <mesh position={[-length * 0.18, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.06, length * 0.42, 8, 16]} />
        <meshStandardMaterial color="#12171d" roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh position={[length * 0.2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.028, length * 0.48, 6, 12]} />
        <meshStandardMaterial color="#dfe7ee" roughness={0.18} metalness={0.84} />
      </mesh>
    </group>
  );
}

function SidePlate({
  side,
  shape,
}: {
  side: 1 | -1;
  shape: THREE.Shape;
}) {
  return (
    <mesh position={[0, 0, side * 0.42]}>
      <extrudeGeometry
        args={[
          shape,
          {
            depth: 0.045,
            bevelEnabled: true,
            bevelSize: 0.008,
            bevelThickness: 0.008,
            bevelSegments: 1,
          },
        ]}
      />
      <meshStandardMaterial {...STEEL} side={THREE.DoubleSide} />
    </mesh>
  );
}

function BottomPanel({
  x,
  y,
  width,
  angle,
}: {
  x: number;
  y: number;
  width: number;
  angle: number;
}) {
  return (
    <mesh position={[x, y, 0]} rotation={[0, 0, angle]}>
      <boxGeometry args={[width, 0.055, 0.72]} />
      <meshStandardMaterial {...STEEL_DARK} />
    </mesh>
  );
}

function ChiselTooth({ z }: { z: number }) {
  return (
    <group position={[0.98, -0.41, z]} rotation={[0, 0, -0.16]}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.18, 0.075, 0.11]} />
        <meshStandardMaterial {...EDGE} />
      </mesh>
      <mesh position={[0.075, -0.025, 0]}>
        <boxGeometry args={[0.08, 0.032, 0.105]} />
        <meshStandardMaterial color="#eef3f7" roughness={0.16} metalness={0.82} />
      </mesh>
    </group>
  );
}

/** 3D 버킷: 속이 빈 바구니형 본체 + 납작한 긁개 이빨 + 실제 링크 구조 */
export function ExcavatorBucket({
  dirtRef,
}: {
  dirtRef: RefObject<THREE.Mesh | null>;
}) {
  const sideShape = useMemo(() => {
    const shape = new THREE.Shape();

    // 측판 외곽: 힌지 쪽은 높고, 앞 커팅엣지로 갈수록 낮아지는 실제 버킷 실루엣.
    shape.moveTo(-0.1, 0.2);
    shape.lineTo(-0.08, -0.08);
    shape.quadraticCurveTo(0.05, -0.34, 0.36, -0.49);
    shape.quadraticCurveTo(0.64, -0.61, 0.96, -0.48);
    shape.lineTo(1.05, -0.31);
    shape.quadraticCurveTo(0.82, -0.12, 0.54, 0.02);
    shape.quadraticCurveTo(0.22, 0.17, -0.1, 0.2);

    return shape;
  }, []);

  const teeth = [-0.3, -0.15, 0, 0.15, 0.3];

  return (
    <group>
      {/* 버킷 링크/실린더 */}
      <LinkPin x={0} y={0} radius={0.155} width={0.52} />
      <HydraulicRod x={0.08} y={0.24} length={0.82} angle={-0.58} />
      {[1, -1].map((side) => (
        <mesh
          key={`upper-link-${side}`}
          position={[0.16, -0.02, side * 0.13]}
          rotation={[0, side * 0.12, -0.76]}
        >
          <boxGeometry args={[0.34, 0.06, 0.07]} />
          <meshStandardMaterial {...LINK} />
        </mesh>
      ))}
      <LinkPin x={0.23} y={-0.12} radius={0.12} width={0.46} />
      <mesh position={[0.2, -0.1, 0]}>
        <boxGeometry args={[0.14, 0.13, 0.38]} />
        <meshStandardMaterial {...LINK} />
      </mesh>

      {/* 버킷 본체: 피벗 기준 안쪽(-X)으로 감기는 백호 버킷 배치 */}
      <group position={[-0.06, -0.07, 0]} scale={[-1, 1, 1]}>
        <SidePlate side={1} shape={sideShape} />
        <SidePlate side={-1} shape={sideShape} />

        {/* 곡면 바닥: 흙이 담길 바닥만 막고 위쪽 공간은 비워 둠 */}
        <BottomPanel x={0.18} y={-0.29} width={0.42} angle={-0.5} />
        <BottomPanel x={0.48} y={-0.45} width={0.48} angle={-0.18} />
        <BottomPanel x={0.82} y={-0.45} width={0.38} angle={0.1} />
        <mesh position={[0.52, -0.42, 0]} rotation={[0, 0, -0.18]}>
          <boxGeometry args={[0.7, 0.045, 0.64]} />
          <meshStandardMaterial color="#303b45" roughness={0.42} metalness={0.46} />
        </mesh>

        {/* 뒤판과 상단 림 */}
        <mesh position={[-0.07, 0.02, 0]} rotation={[0, 0, 0.05]}>
          <boxGeometry args={[0.065, 0.42, 0.76]} />
          <meshStandardMaterial {...STEEL_DARK} />
        </mesh>
        {[1, -1].map((side) => (
          <mesh key={`top-rim-${side}`} position={[0.32, 0.06, side * 0.43]} rotation={[0, 0, -0.09]}>
            <boxGeometry args={[0.78, 0.045, 0.05]} />
            <meshStandardMaterial {...EDGE} />
          </mesh>
        ))}
        {[1, -1].map((side) => (
          <mesh key={`side-highlight-${side}`} position={[0.52, -0.32, side * 0.455]} rotation={[0, 0, -0.18]}>
            <boxGeometry args={[0.72, 0.028, 0.035]} />
            <meshStandardMaterial color="#8fa0ad" roughness={0.22} metalness={0.62} />
          </mesh>
        ))}

        {/* 앞 커팅엣지 + 긁개형 이빨 */}
        <mesh position={[0.95, -0.36, 0]} rotation={[0, 0, -0.08]}>
          <boxGeometry args={[0.08, 0.11, 0.78]} />
          <meshStandardMaterial {...EDGE} />
        </mesh>
        {teeth.map((z) => (
          <ChiselTooth key={z} z={z} />
        ))}

        {/* 내부 그늘: 구멍이 아니라 비어 있는 바구니 안쪽 깊이만 표현 */}
        <mesh position={[0.42, -0.24, 0]} rotation={[0, 0, -0.2]}>
          <boxGeometry args={[0.5, 0.025, 0.56]} />
          <meshStandardMaterial color="#121920" roughness={0.7} metalness={0.18} />
        </mesh>

        <mesh ref={dirtRef} position={[0.48, -0.35, 0]} visible={false}>
          <boxGeometry args={[0.72, 0.28, 0.62]} />
          <meshStandardMaterial color="#7a5532" roughness={0.96} />
        </mesh>
      </group>
    </group>
  );
}
