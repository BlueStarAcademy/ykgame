"use client";

import { Billboard, Text } from "@react-three/drei";
import type { WorkshopId } from "./workshop/types";
import { WORKSHOP_DEFS } from "./workshop/catalog";

const POST_COLOR = "#6b4f2e";
const BOARD_COLOR = "#c4a574";
const BOARD_EDGE = "#8a6b3d";
const TRIM = "#2f5f8f";

function SignLabel({
  label,
  claimable,
}: {
  label: string;
  claimable: boolean;
}) {
  return (
    <Billboard position={[0, 3.35, 0]} follow lockX={false} lockZ={false}>
      <Text
        fontSize={0.42}
        color="#1a1a1a"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#f5efe4"
        maxWidth={4}
      >
        {label}
      </Text>
      {claimable ? (
        <group position={[0, 0.85, 0]}>
          <Text
            fontSize={0.55}
            color="#16a34a"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.04}
            outlineColor="#052e16"
          >
            V
          </Text>
          <Text
            position={[0, -0.55, 0]}
            fontSize={0.32}
            color="#15803d"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.025}
            outlineColor="#ecfdf5"
          >
            퀘스트완료
          </Text>
        </group>
      ) : null}
    </Billboard>
  );
}

export function WorkshopSign({
  workshopId,
  claimable = false,
  visible = true,
}: {
  workshopId: WorkshopId;
  claimable?: boolean;
  visible?: boolean;
}) {
  if (!visible) return null;
  const def = WORKSHOP_DEFS[workshopId];
  const { x, z, rotationY } = def.sign;

  return (
    <group position={[x, 0, z]} rotation={[0, rotationY, 0]}>
      {/* post */}
      <mesh position={[0, 1.35, 0]} castShadow>
        <boxGeometry args={[0.18, 2.7, 0.18]} />
        <meshStandardMaterial color={POST_COLOR} roughness={0.85} />
      </mesh>
      {/* board */}
      <mesh position={[0, 2.55, 0.08]} castShadow>
        <boxGeometry args={[2.4, 1.15, 0.12]} />
        <meshStandardMaterial color={BOARD_COLOR} roughness={0.7} />
      </mesh>
      <mesh position={[0, 2.55, 0.15]}>
        <boxGeometry args={[2.2, 0.95, 0.02]} />
        <meshStandardMaterial color="#efe2c6" roughness={0.9} />
      </mesh>
      {/* trim bar */}
      <mesh position={[0, 3.05, 0.16]}>
        <boxGeometry args={[2.25, 0.08, 0.04]} />
        <meshStandardMaterial color={TRIM} metalness={0.3} roughness={0.45} />
      </mesh>
      <mesh position={[0, 2.05, 0.16]}>
        <boxGeometry args={[2.25, 0.08, 0.04]} />
        <meshStandardMaterial color={BOARD_EDGE} roughness={0.6} />
      </mesh>
      <SignLabel label={def.label} claimable={claimable} />
    </group>
  );
}

export function isInWorkshopSignRange(
  workshopId: WorkshopId,
  posX: number,
  posZ: number,
) {
  const { x, z, radius } = WORKSHOP_DEFS[workshopId].sign;
  const dx = posX - x;
  const dz = posZ - z;
  return dx * dx + dz * dz <= radius * radius;
}

export function WorkshopSigns({
  mapTier,
  claimableIds,
}: {
  mapTier: number;
  claimableIds: ReadonlySet<WorkshopId> | readonly WorkshopId[];
}) {
  const claimable =
    claimableIds instanceof Set
      ? claimableIds
      : new Set(claimableIds);

  return (
    <>
      <WorkshopSign
        workshopId="dump"
        claimable={claimable.has("dump")}
        visible={mapTier >= 1}
      />
      <WorkshopSign
        workshopId="crash"
        claimable={claimable.has("crash")}
        visible={mapTier >= 2}
      />
      <WorkshopSign
        workshopId="hill"
        claimable={claimable.has("hill")}
        visible={mapTier >= 3}
      />
    </>
  );
}
