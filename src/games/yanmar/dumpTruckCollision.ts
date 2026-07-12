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
 * 암·버킷 충돌용 짐칸 공동.
 * 시각 측판보다 넓혀 프로브(0.32)가 측벽에 걸려 하역 시 버켓이 안 펴지는 문제를 막는다.
 * 캡 등 짐칸 밖 고체는 그대로 막는다.
 */
const ARM_BED_CAVITY = {
  halfX: DUMP_TRUCK.bedWidth / 2 + DUMP_TRUCK_ARM_PROBE_RADIUS + 0.25,
  halfZ: DUMP_TRUCK.bedDepth / 2 + DUMP_TRUCK_ARM_PROBE_RADIUS + 0.25,
  minY: Math.min(DUMP_TRUCK_SOLID.cavityMinY, DUMP_TRUCK.bedDeckWorldY - 0.9),
  maxY: DUMP_TRUCK_SOLID.maxY + 0.2,
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

/** 붐·암·버킷이 트럭 캡 등 고체를 뚫지 않도록 관절 롤백 (짐칸 안 하역은 허용) */
export function constrainArmFromDumpTruck(
  sim: ExcavatorSimState,
  vel: HydraulicVelocity,
  boomSwing: number,
  before: { boom: number; arm: number; bucket: number },
  pose?: DumpTruckPose,
): boolean {
  if (pose && !pose.present) return false;
  if (!armPenetratesDumpTruck(sim, boomSwing, pose)) return false;

  const after = {
    boom: sim.boom,
    arm: sim.arm,
    bucket: sim.bucket,
  };

  // 버켓만 충돌이면 버켓만 되돌림 → 붐·암 조작은 유지
  sim.bucket = before.bucket;
  if (!armPenetratesDumpTruck(sim, boomSwing, pose)) {
    restoreJoints(sim, vel, before, { bucket: true });
    return true;
  }

  // 붐·암만 충돌이면 그쪽만 되돌림 → 버켓 펴기(하역)는 유지
  sim.boom = before.boom;
  sim.arm = before.arm;
  sim.bucket = after.bucket;
  if (!armPenetratesDumpTruck(sim, boomSwing, pose)) {
    restoreJoints(sim, vel, before, { boom: true, arm: true });
    return true;
  }

  restoreJoints(sim, vel, before, { boom: true, arm: true, bucket: true });
  return true;
}
