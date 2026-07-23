"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import type { SportsMeetPattern } from "./sportsMeet/patterns";
import {
  getSportsMeetStartPaddock,
  type SportsMeetStartPaddock,
} from "./sportsMeet/startPaddock";

function BarrierPost({
  x,
  z,
  y = 1.15,
}: {
  x: number;
  z: number;
  y?: number;
}) {
  return (
    <mesh position={[x, y, z]} castShadow>
      <boxGeometry args={[0.22, 2.3, 0.22]} />
      <meshStandardMaterial color="#1e293b" metalness={0.55} roughness={0.42} />
    </mesh>
  );
}

function StripedRail({
  from,
  to,
  y = 1.15,
  height = 0.55,
  thickness = 0.18,
}: {
  from: [number, number];
  to: [number, number];
  y?: number;
  height?: number;
  thickness?: number;
}) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  if (length < 0.15) return null;
  const angle = Math.atan2(to[0] - from[0], to[1] - from[1]);
  const cx = (from[0] + to[0]) / 2;
  const cz = (from[1] + to[1]) / 2;
  const stripeCount = Math.max(4, Math.floor(length / 0.85));

  return (
    <group position={[cx, y, cz]} rotation={[0, angle, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[thickness, height, length]} />
        <meshStandardMaterial color="#0f172a" metalness={0.35} roughness={0.55} />
      </mesh>
      {Array.from({ length: stripeCount }, (_, i) => {
        const t = (i + 0.5) / stripeCount - 0.5;
        const localZ = t * length;
        return (
          <mesh key={i} position={[thickness * 0.55, 0, localZ]} castShadow>
            <boxGeometry args={[0.06, height * 0.92, length / stripeCount]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? "#f8fafc" : "#dc2626"}
              roughness={0.7}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function StartGate({
  paddock,
  open,
}: {
  paddock: SportsMeetStartPaddock;
  open: boolean;
}) {
  const gateRef = useRef<THREE.Group>(null);
  const openAmount = useRef(open ? 1 : 0);

  useFrame((_, dt) => {
    const target = open ? 1 : 0;
    openAmount.current += (target - openAmount.current) * Math.min(1, dt * 5);
    const g = gateRef.current;
    if (!g) return;
    // Raise gate upward when opening.
    g.position.y = 0.95 + openAmount.current * 3.4;
    g.rotation.x = -openAmount.current * 0.12;
  });

  const half = paddock.halfWidth;
  const fl = paddockLocalCorner(paddock, 0, -half);
  const fr = paddockLocalCorner(paddock, 0, half);

  return (
    <group>
      <BarrierPost x={fl.x} z={fl.z} y={1.35} />
      <BarrierPost x={fr.x} z={fr.z} y={1.35} />
      {/* Overhead gantry */}
      <mesh
        position={[
          (fl.x + fr.x) / 2 + paddock.forwardX * 0.15,
          3.15,
          (fl.z + fr.z) / 2 + paddock.forwardZ * 0.15,
        ]}
        rotation={[0, paddock.heading, 0]}
        castShadow
      >
        <boxGeometry args={[half * 2 + 0.8, 0.22, 0.28]} />
        <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Start lights */}
      {[-1.2, 0, 1.2].map((ox, i) => {
        const wx =
          paddock.gateX +
          paddock.forwardX * 0.2 +
          paddock.rightX * ox;
        const wz =
          paddock.gateZ +
          paddock.forwardZ * 0.2 +
          paddock.rightZ * ox;
        const color = open
          ? "#22c55e"
          : i === 2
            ? "#ef4444"
            : i === 1
              ? "#f59e0b"
              : "#ef4444";
        return (
          <mesh key={i} position={[wx, 2.75, wz]}>
            <sphereGeometry args={[0.22, 12, 10]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={open ? 1.1 : 0.85}
              toneMapped={false}
            />
          </mesh>
        );
      })}
      <group ref={gateRef}>
        <StripedRail from={[fl.x, fl.z]} to={[fr.x, fr.z]} y={0} height={0.7} />
        <Text
          position={[
            paddock.gateX - paddock.forwardX * 0.05,
            0.55,
            paddock.gateZ - paddock.forwardZ * 0.05,
          ]}
          rotation={[-Math.PI / 2, 0, -paddock.heading]}
          fontSize={0.55}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.04}
          outlineColor="#7f1d1d"
        >
          START
        </Text>
      </group>
      {/* Start line paint on ground */}
      <mesh
        position={[paddock.gateX, 0.722, paddock.gateZ]}
        rotation={[-Math.PI / 2, 0, paddock.heading]}
        receiveShadow
      >
        <planeGeometry args={[half * 2.05, 0.55]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.85} />
      </mesh>
    </group>
  );
}

function paddockLocalCorner(
  paddock: SportsMeetStartPaddock,
  along: number,
  across: number,
) {
  return {
    x:
      paddock.gateX +
      paddock.forwardX * along +
      paddock.rightX * across,
    z:
      paddock.gateZ +
      paddock.forwardZ * along +
      paddock.rightZ * across,
  };
}

/** Racing start grid — narrow paddock with closed gate until GO. */
export function SportsMeetStartGrid({
  pattern,
  gateOpen,
}: {
  pattern: SportsMeetPattern;
  /** True once countdown finishes (racing / finished). */
  gateOpen: boolean;
}) {
  const paddock = useMemo(() => getSportsMeetStartPaddock(pattern), [pattern]);
  const half = paddock.halfWidth;
  const depth = paddock.depth;

  const fl = paddockLocalCorner(paddock, 0, -half);
  const fr = paddockLocalCorner(paddock, 0, half);
  const bl = paddockLocalCorner(paddock, -depth, -half);
  const br = paddockLocalCorner(paddock, -depth, half);

  const floorCenter = {
    x: paddock.centerX,
    z: paddock.centerZ,
  };

  return (
    <group>
      {/* Asphalt start box */}
      <mesh
        position={[floorCenter.x, 0.71, floorCenter.z]}
        rotation={[-Math.PI / 2, 0, paddock.heading]}
        receiveShadow
      >
        <planeGeometry args={[half * 2.15, depth + 0.4]} />
        <meshStandardMaterial color="#3f4650" roughness={0.92} />
      </mesh>
      {/* Checker / grid marks */}
      {[-0.55, 0.55].map((lane, li) =>
        [0.22, 0.48, 0.74].map((t, ti) => {
          const along = -depth * t;
          const across = lane * half * 0.55;
          const p = paddockLocalCorner(paddock, along, across);
          return (
            <mesh
              key={`${li}-${ti}`}
              position={[p.x, 0.716, p.z]}
              rotation={[-Math.PI / 2, 0, paddock.heading]}
              receiveShadow
            >
              <planeGeometry args={[1.35, 1.1]} />
              <meshStandardMaterial
                color={(li + ti) % 2 === 0 ? "#e2e8f0" : "#1e293b"}
                roughness={0.88}
              />
            </mesh>
          );
        }),
      )}

      {/* Side + rear barriers (always solid look) */}
      <StripedRail from={[fl.x, fl.z]} to={[bl.x, bl.z]} />
      <StripedRail from={[fr.x, fr.z]} to={[br.x, br.z]} />
      <StripedRail from={[bl.x, bl.z]} to={[br.x, br.z]} />
      <BarrierPost x={bl.x} z={bl.z} />
      <BarrierPost x={br.x} z={br.z} />
      <BarrierPost
        x={(bl.x + br.x) / 2}
        z={(bl.z + br.z) / 2}
      />

      <StartGate paddock={paddock} open={gateOpen} />

      {!gateOpen ? (
        <Text
          position={[
            paddock.centerX - paddock.forwardX * 0.2,
            2.6,
            paddock.centerZ - paddock.forwardZ * 0.2,
          ]}
          rotation={[0, paddock.heading + Math.PI, 0]}
          fontSize={0.42}
          color="#fef3c7"
          anchorX="center"
          outlineWidth={0.035}
          outlineColor="#78350f"
        >
          스타트 대기
        </Text>
      ) : null}
    </group>
  );
}
