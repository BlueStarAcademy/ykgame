import type { ExcavatorSimState } from "./ExcavatorScene";
import type { HydraulicVelocity } from "./controls";
import { getArmCollisionSamples } from "./bucket";
import { isInDumpTruckSolidVolume, isNearDumpTruck } from "./terrain";

export function armPenetratesDumpTruck(sim: ExcavatorSimState, boomSwing: number): boolean {
  return getArmCollisionSamples(sim, boomSwing).some((point) =>
    isInDumpTruckSolidVolume(point.x, point.y, point.z),
  );
}

/** 붐·암·버킷이 트럭 몸체(캡·측판)를 뚫지 않도록 관절 롤백 */
export function constrainArmFromDumpTruck(
  sim: ExcavatorSimState,
  vel: HydraulicVelocity,
  boomSwing: number,
  before: { boom: number; arm: number; bucket: number },
): boolean {
  if (!isNearDumpTruck(sim.posX, sim.posZ)) return false;
  if (!armPenetratesDumpTruck(sim, boomSwing)) return false;

  sim.boom = before.boom;
  sim.arm = before.arm;
  sim.bucket = before.bucket;
  // 트럭 쪽으로 밀어넣는 조작만 정지 — 들어올리기·당기기는 유지
  if (vel.boom > 0) vel.boom = 0;
  if (vel.arm < 0) vel.arm = 0;
  if (vel.bucket > 0) vel.bucket = 0;
  return true;
}
