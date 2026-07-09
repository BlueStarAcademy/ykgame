import type { DumpTruckPose } from "./dumpTruckState";
import type { ExcavatorSimState } from "./types";
import type { HydraulicVelocity } from "./controls";
import { getArmCollisionSamples } from "./bucket";
import { dumpTruckBedCenterWorld, isInDumpTruckSolidVolume } from "./terrain";
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

function isPointInsideDumpTruckSolid(
  x: number,
  y: number,
  z: number,
  groupX?: number,
  groupZ?: number,
) {
  return isInDumpTruckSolidVolume(x, y, z, groupX, groupZ);
}

function isSampleCollidingDumpTruck(
  x: number,
  y: number,
  z: number,
  groupX?: number,
  groupZ?: number,
) {
  return PROBE_OFFSETS.some(([dx, dy, dz]) =>
    isPointInsideDumpTruckSolid(x + dx, y + dy, z + dz, groupX, groupZ),
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

/** 붐·암·버킷이 트럭 몸체(캡·측판)를 뚫지 않도록 관절 롤백 */
export function constrainArmFromDumpTruck(
  sim: ExcavatorSimState,
  vel: HydraulicVelocity,
  boomSwing: number,
  before: { boom: number; arm: number; bucket: number },
  pose?: DumpTruckPose,
): boolean {
  if (pose && !pose.present) return false;
  if (!armPenetratesDumpTruck(sim, boomSwing, pose)) return false;

  sim.boom = before.boom;
  sim.arm = before.arm;
  sim.bucket = before.bucket;
  vel.boom = 0;
  vel.arm = 0;
  vel.bucket = 0;
  return true;
}
