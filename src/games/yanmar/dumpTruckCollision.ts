import type { DumpTruckPose } from "./dumpTruckState";
import type { ExcavatorSimState } from "./types";
import type { HydraulicVelocity } from "./controls";
import { getArmCollisionSamples } from "./bucket";
import {
  DUMP_TRUCK,
  DUMP_TRUCK_SOLID,
  dumpTruckBedCenterWorld,
  worldToDumpTruckLocal,
} from "./terrain";
import { DUMP_TRUCK_ARM_PROBE_RADIUS } from "./simConstants";

const PROBE_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0],
  [DUMP_TRUCK_ARM_PROBE_RADIUS, 0, 0],
  [-DUMP_TRUCK_ARM_PROBE_RADIUS, 0, 0],
  [0, DUMP_TRUCK_ARM_PROBE_RADIUS, 0],
  [0, -DUMP_TRUCK_ARM_PROBE_RADIUS, 0],
  [0, 0, DUMP_TRUCK_ARM_PROBE_RADIUS],
  [0, 0, -DUMP_TRUCK_ARM_PROBE_RADIUS],
];

/**
 * 암·버킷 충돌용 짐칸 공동 — 시각 측판/바닥 안쪽만 비움.
 * 옆에서 뚫고 들어오지 못하게 XZ는 측판 안쪽으로 두고,
 * 위에서 들어올 수 있도록 덱 높이 이상만 공동으로 연다.
 */
const ARM_BED_CAVITY = {
  halfX: DUMP_TRUCK_SOLID.cavityHalfX,
  halfZ: DUMP_TRUCK_SOLID.cavityHalfZ,
  minY: DUMP_TRUCK.bedDeckWorldY + 0.12,
  maxY: DUMP_TRUCK_SOLID.maxY + 0.35,
} as const;

function isInDumpTruckSolidForArm(
  x: number,
  y: number,
  z: number,
  groupX?: number,
  groupZ?: number,
) {
  if (y < DUMP_TRUCK_SOLID.minY || y > DUMP_TRUCK_SOLID.maxY) return false;
  const local = worldToDumpTruckLocal(x, z, groupX, groupZ);
  const hullX = local.x - DUMP_TRUCK_SOLID.centerLocalX;
  const hullZ = local.z - DUMP_TRUCK_SOLID.centerLocalZ;
  if (
    Math.abs(hullX) > DUMP_TRUCK_SOLID.halfX ||
    Math.abs(hullZ) > DUMP_TRUCK_SOLID.halfZ
  ) {
    return false;
  }
  const bedRelX = local.x - DUMP_TRUCK.bedLocalX;
  const bedRelZ = local.z - DUMP_TRUCK.bedLocalZ;
  const inBedCavity =
    y >= ARM_BED_CAVITY.minY &&
    y <= ARM_BED_CAVITY.maxY &&
    Math.abs(bedRelX) <= ARM_BED_CAVITY.halfX &&
    Math.abs(bedRelZ) <= ARM_BED_CAVITY.halfZ;
  return !inBedCavity;
}

function isSampleCollidingDumpTruck(
  x: number,
  y: number,
  z: number,
  groupX?: number,
  groupZ?: number,
) {
  return PROBE_OFFSETS.some(([dx, dy, dz]) =>
    isInDumpTruckSolidForArm(x + dx, y + dy, z + dz, groupX, groupZ),
  );
}

/** 트럭 주변에서 붐·암 충돌 해석이 필요한지 (넓은 범위) */
export function isDumpTruckArmCollisionActive(
  sim: ExcavatorSimState,
  boomSwing: number,
  pose?: DumpTruckPose,
): boolean {
  if (pose && !pose.present) return false;
  const groupX = pose?.groupX;
  const groupZ = pose?.groupZ;
  const bedCenter = dumpTruckBedCenterWorld(groupX, groupZ);
  const reach = 8.5;

  if (Math.hypot(sim.posX - bedCenter.x, sim.posZ - bedCenter.z) <= reach) {
    return true;
  }

  return getArmCollisionSamples(sim, boomSwing).some(
    (point) => Math.hypot(point.x - bedCenter.x, point.z - bedCenter.z) <= reach,
  );
}

export function armPenetratesDumpTruck(
  sim: ExcavatorSimState,
  boomSwing: number,
  pose?: DumpTruckPose,
): boolean {
  if (pose && !pose.present) return false;
  const groupX = pose?.groupX;
  const groupZ = pose?.groupZ;
  return getArmCollisionSamples(sim, boomSwing).some((point) =>
    isSampleCollidingDumpTruck(point.x, point.y, point.z, groupX, groupZ),
  );
}

function restoreJoints(
  sim: ExcavatorSimState,
  vel: HydraulicVelocity,
  joints: { boom: number; arm: number; bucket: number },
  freeze: { boom?: boolean; arm?: boolean; bucket?: boolean },
) {
  if (freeze.boom) {
    sim.boom = joints.boom;
    vel.boom = 0;
  }
  if (freeze.arm) {
    sim.arm = joints.arm;
    vel.arm = 0;
  }
  if (freeze.bucket) {
    sim.bucket = joints.bucket;
    vel.bucket = 0;
  }
}

/** 붐·암·버킷이 트럭 고체를 뚫지 않도록 관절을 롤백한다. */
export function constrainArmFromDumpTruck(
  sim: ExcavatorSimState,
  vel: HydraulicVelocity,
  boomSwing: number,
  before: { boom: number; arm: number; bucket: number },
  pose?: DumpTruckPose,
): boolean {
  if (pose && !pose.present) return false;
  if (!armPenetratesDumpTruck(sim, boomSwing, pose)) return false;

  restoreJoints(sim, vel, before, { boom: true, arm: true, bucket: true });
  return true;
}
