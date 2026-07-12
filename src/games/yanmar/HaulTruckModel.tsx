"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import {
  HAUL_TRUCK_ARRIVE_SEC,
  HAUL_TRUCK_DEPART_SEC,
  HAUL_TRUCK,
  type HaulTruckState,
} from "./terrain";
import {
  getHaulTruckLaneDirection,
  HAUL_TRUCK_LANE_END_OFFSET,
} from "./haulTruckLane";
import {
  createYkGeongiWhiteTextTexture,
  YANMAR_MACHINE_COLORS as COLORS,
  YANMAR_MACHINE_MATERIALS as MATERIALS,
} from "./machineVisualTheme";

const MAX_VISIBLE_BED_ROCKS = 5;

/** 짐칸 바닥에 안정적으로 앉는 위치 (bed group local). */
const BED_ROCK_SLOTS: ReadonlyArray<{
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  scale: [number, number, number];
  color: string;
}> = [
  { x: -0.35, y: 0.02, z: -0.55, rx: 0.35, ry: 0.8, rz: 0.2, scale: [0.95, 0.78, 0.88], color: "#6b7280" },
  { x: 0.55, y: 0.06, z: 0.35, rx: 0.55, ry: 1.1, rz: -0.25, scale: [0.82, 0.7, 0.9], color: "#7c8798" },
  { x: -0.95, y: 0.04, z: 0.45, rx: -0.4, ry: 0.45, rz: 0.55, scale: [0.78, 0.72, 0.74], color: "#64748b" },
  { x: 0.15, y: 0.42, z: -0.05, rx: 0.7, ry: -0.35, rz: 0.3, scale: [0.88, 0.68, 0.8], color: "#8b95a5" },
  { x: -0.55, y: 0.38, z: 0.15, rx: 0.25, ry: 1.4, rz: -0.5, scale: [0.72, 0.62, 0.76], color: "#5f6b7a" },
];

function PremiumWheel({ x, z }: { x: number; z: number }) {
  // radius 0.76 → 중심을 0.76에 두면 휠 바닥이 그룹 원점(지면)에 붙음
  return (
    <group position={[x, 0.76, z]}>
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

function HaulTruckBedRocks({ state }: { state: HaulTruckState }) {
  const rocksRef = useRef<Array<THREE.Group | null>>([]);
  const prevCountRef = useRef(0);
  const dropAnimRef = useRef<{ index: number; t: number } | null>(null);

  useFrame((_, delta) => {
    const count = Math.min(
      MAX_VISIBLE_BED_ROCKS,
      Math.max(0, Math.floor(state.loadCount)),
    );
    const prev = prevCountRef.current;

    if (count > prev) {
      dropAnimRef.current = { index: count - 1, t: 0 };
    } else if (count < prev) {
      dropAnimRef.current = null;
    }
    prevCountRef.current = count;

    const drop = dropAnimRef.current;
    if (drop) {
      drop.t = Math.min(1, drop.t + delta * 2.6);
      if (drop.t >= 1) dropAnimRef.current = null;
    }

    for (let i = 0; i < MAX_VISIBLE_BED_ROCKS; i += 1) {
      const group = rocksRef.current[i];
      const slot = BED_ROCK_SLOTS[i];
      if (!group || !slot) continue;

      const visible = i < count && state.phase !== "cooldown";
      group.visible = visible;
      if (!visible) continue;

      let y = slot.y;
      let squash = 1;
      if (drop && drop.index === i) {
        const u = drop.t;
        const fall = u < 0.72 ? (u / 0.72) ** 2 : 1;
        const bounce =
          u > 0.72 ? Math.sin(((u - 0.72) / 0.28) * Math.PI) * (1 - u) * 0.35 : 0;
        y = slot.y + (1 - fall) * 1.35 + bounce;
        squash = u > 0.72 ? 1 - Math.sin(((u - 0.72) / 0.28) * Math.PI) * 0.12 : 1;
        group.rotation.set(
          slot.rx + (1 - fall) * 1.2,
          slot.ry + (1 - fall) * 0.8,
          slot.rz,
        );
      } else {
        group.rotation.set(slot.rx, slot.ry, slot.rz);
      }

      group.position.set(slot.x, y, slot.z);
      group.scale.set(
        slot.scale[0],
        slot.scale[1] * squash,
        slot.scale[2] * (2 - squash),
      );
    }
  });

  return (
    <group position={[0, -0.28, 0]}>
      {BED_ROCK_SLOTS.map((slot, index) => (
        <group
          key={index}
          ref={(node) => {
            rocksRef.current[index] = node;
          }}
          visible={false}
          position={[slot.x, slot.y, slot.z]}
          rotation={[slot.rx, slot.ry, slot.rz]}
          scale={slot.scale}
        >
          <mesh castShadow>
            <icosahedronGeometry args={[0.55, 1]} />
            <meshStandardMaterial
              color={slot.color}
              roughness={0.72}
              metalness={0.12}
              flatShading
            />
          </mesh>
          <mesh position={[0.12, 0.08, -0.1]} scale={[0.55, 0.48, 0.5]} castShadow>
            <dodecahedronGeometry args={[0.42, 0]} />
            <meshStandardMaterial
              color={index % 2 ? "#566074" : "#748092"}
              roughness={0.78}
              metalness={0.08}
              flatShading
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function HaulTruckModel({
  state,
}: {
  state: HaulTruckState;
  /** @deprecated loadCount는 state에서 매 프레임 읽는다 */
  rockCount?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const ykMark = useMemo(() => createYkGeongiWhiteTextTexture(), []);
  useLayoutEffect(() => () => ykMark?.dispose(), [ykMark]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const progress = Math.min(
      1,
      state.phaseElapsed /
        (state.phase === "arriving" ? HAUL_TRUCK_ARRIVE_SEC : HAUL_TRUCK_DEPART_SEC),
    );
    const { dirX, dirZ } = getHaulTruckLaneDirection();
    const ease = progress * progress * (3 - 2 * progress);
    if (state.phase === "engineStart") {
      const shake = Math.sin(state.phaseElapsed * 34) * 0.025;
      group.position.x = -dirZ * shake;
      group.position.z = dirX * shake;
      group.visible = true;
    } else if (state.phase === "departing") {
      const travel = ease * HAUL_TRUCK_LANE_END_OFFSET;
      group.position.x = travel * dirX;
      group.position.z = travel * dirZ;
      group.visible = true;
    } else if (state.phase === "arriving") {
      const travel = (1 - ease) * HAUL_TRUCK_LANE_END_OFFSET;
      group.position.x = travel * dirX;
      group.position.z = travel * dirZ;
      group.visible = true;
    } else {
      group.position.x = 0;
      group.position.z = 0;
      group.visible = state.phase === "ready";
    }
  });

  return (
    <group ref={groupRef} rotation={[0, HAUL_TRUCK.rotation, 0]}>
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
            {ykMark ? (
              <mesh
                position={[0, 0.02, side * 0.12]}
                rotation={[0, side > 0 ? 0 : Math.PI, 0]}
                renderOrder={18}
              >
                <planeGeometry args={[2.05, 0.64]} />
                <meshBasicMaterial
                  map={ykMark}
                  transparent
                  alphaTest={0.16}
                  toneMapped={false}
                  depthWrite={false}
                  side={THREE.DoubleSide}
                />
              </mesh>
            ) : null}
          </group>
        ))}
        <RoundedBox args={[0.2, 1.5, 3.35]} radius={0.05} position={[-2.12, 0.04, 0]} castShadow>
          <meshStandardMaterial color={COLORS.truckBed} {...MATERIALS.painted} />
        </RoundedBox>
        <HaulTruckBedRocks state={state} />
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
