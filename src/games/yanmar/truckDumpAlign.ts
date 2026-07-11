import { EXCAVATOR_COLLISION_RADIUS, DUMP_TRUCK_COLLIDER } from "./simConstants";
import { DUMP_TRUCK, dumpTruckBedCenterWorld } from "./terrain";

/** 트럭 옆면에 차체가 붙은 것으로 볼 여유 (충돌면 바깥 허용) */
export const TRUCK_BODY_TOUCH_MARGIN = 0.45;

/** 정면이 짐칸 중심을 향한다고 볼 최소 cos(약 55°) */
export const TRUCK_BED_FACING_MIN_DOT = 0.55;

export type TruckAlignTarget = {
  groupX: number;
  groupZ: number;
  rotation: number;
  bedCenterX: number;
  bedCenterZ: number;
  collider: {
    centerOffsetX: number;
    centerOffsetZ: number;
    halfX: number;
    halfZ: number;
  };
};

/**
 * HaulTruckModel: group at drop, rotation Y = -π/2.
 * Bed group local (-1.05, 0) → world offset (0, -1.05).
 * Chassis ~6.9 × 2.55 after rotation → halfZ≈3.45, halfX≈1.56.
 */
export const HAUL_TRUCK_ALIGN = {
  rotation: -Math.PI / 2,
  bedOffsetX: 0,
  bedOffsetZ: -1.05,
  collider: {
    centerOffsetX: 0,
    centerOffsetZ: -0.05,
    halfX: 1.56,
    halfZ: 3.45,
  },
} as const;

function worldToTruckLocal(
  wx: number,
  wz: number,
  groupX: number,
  groupZ: number,
  rotation: number,
) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const dx = wx - groupX;
  const dz = wz - groupZ;
  return {
    x: dx * cos - dz * sin,
    z: dx * sin + dz * cos,
  };
}

/** 차체(원형)가 트럭 박스에 닿거나 아주 가까이 붙은 상태 */
export function isBodyTouchingTruck(
  posX: number,
  posZ: number,
  target: TruckAlignTarget,
  touchMargin = TRUCK_BODY_TOUCH_MARGIN,
): boolean {
  const local = worldToTruckLocal(
    posX,
    posZ,
    target.groupX,
    target.groupZ,
    target.rotation,
  );
  const localX = local.x - target.collider.centerOffsetX;
  const localZ = local.z - target.collider.centerOffsetZ;
  const outsideX = Math.max(Math.abs(localX) - target.collider.halfX, 0);
  const outsideZ = Math.max(Math.abs(localZ) - target.collider.halfZ, 0);
  const touchRadius = EXCAVATOR_COLLISION_RADIUS + touchMargin;
  return outsideX * outsideX + outsideZ * outsideZ <= touchRadius * touchRadius;
}

/**
 * 상부(정면)가 짐칸 중심을 향하는지.
 * facing = heading + swing (버킷/그랩 작업 방향과 동일).
 */
export function isFacingTruckBedCenter(
  posX: number,
  posZ: number,
  heading: number,
  swing: number,
  bedCenterX: number,
  bedCenterZ: number,
  minDot = TRUCK_BED_FACING_MIN_DOT,
): boolean {
  const toX = bedCenterX - posX;
  const toZ = bedCenterZ - posZ;
  const dist = Math.hypot(toX, toZ);
  if (dist < 0.35) return true;
  const facing = heading + swing;
  const forwardX = Math.sin(facing);
  const forwardZ = Math.cos(facing);
  const dot = (forwardX * toX + forwardZ * toZ) / dist;
  return dot >= minDot;
}

/** 흙/돌 트럭 공통: 차체 밀착 + 정면이 짐칸 중심 */
export function isAlignedForTruckDump(
  posX: number,
  posZ: number,
  heading: number,
  swing: number,
  target: TruckAlignTarget | null,
): boolean {
  if (!target) return false;
  return (
    isBodyTouchingTruck(posX, posZ, target) &&
    isFacingTruckBedCenter(
      posX,
      posZ,
      heading,
      swing,
      target.bedCenterX,
      target.bedCenterZ,
    )
  );
}

export function getDumpTruckAlignTarget(
  groupX: number,
  groupZ: number,
  present: boolean,
): TruckAlignTarget | null {
  if (!present) return null;
  const bed = dumpTruckBedCenterWorld(groupX, groupZ);
  return {
    groupX,
    groupZ,
    rotation: DUMP_TRUCK.rotation,
    bedCenterX: bed.x,
    bedCenterZ: bed.z,
    collider: {
      centerOffsetX: DUMP_TRUCK_COLLIDER.centerOffsetX,
      centerOffsetZ: DUMP_TRUCK_COLLIDER.centerOffsetZ,
      halfX: DUMP_TRUCK_COLLIDER.halfX,
      halfZ: DUMP_TRUCK_COLLIDER.halfZ,
    },
  };
}

export function getHaulTruckAlignTarget(
  dropX: number,
  dropZ: number,
  present: boolean,
): TruckAlignTarget | null {
  if (!present) return null;
  return {
    groupX: dropX,
    groupZ: dropZ,
    rotation: HAUL_TRUCK_ALIGN.rotation,
    bedCenterX: dropX + HAUL_TRUCK_ALIGN.bedOffsetX,
    bedCenterZ: dropZ + HAUL_TRUCK_ALIGN.bedOffsetZ,
    collider: {
      centerOffsetX: HAUL_TRUCK_ALIGN.collider.centerOffsetX,
      centerOffsetZ: HAUL_TRUCK_ALIGN.collider.centerOffsetZ,
      halfX: HAUL_TRUCK_ALIGN.collider.halfX,
      halfZ: HAUL_TRUCK_ALIGN.collider.halfZ,
    },
  };
}
