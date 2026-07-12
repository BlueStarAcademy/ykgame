import { EXCAVATOR_COLLISION_RADIUS, DUMP_TRUCK_COLLIDER } from "./simConstants";
import { DUMP_TRUCK, dumpTruckBedCenterWorld } from "./terrain";
import type { ExcavatorSimState } from "./types";
import type { HydraulicVelocity } from "./controls";

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
  /** 붐·암 충돌용 높이·짐칸 공동 */
  solidMinY: 0.55,
  solidMaxY: 3.15,
  cavityMinY: 1.55,
  cavityMaxY: 3.15,
  cavityHalfX: 1.95,
  cavityHalfZ: 1.45,
  cavityCenterLocalX: -1.05,
  cavityCenterLocalZ: 0,
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

function truckLocalToWorld(
  localX: number,
  localZ: number,
  groupX: number,
  groupZ: number,
  rotation: number,
) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    x: groupX + localX * cos + localZ * sin,
    z: groupZ - localX * sin + localZ * cos,
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

/** 굴착기 차체(원)가 트럭 OBB에 파고들었는지 */
export function isExcavatorCollidingWithTruckTarget(
  x: number,
  z: number,
  target: TruckAlignTarget | null,
): boolean {
  if (!target) return false;
  const local = worldToTruckLocal(
    x,
    z,
    target.groupX,
    target.groupZ,
    target.rotation,
  );
  const localX = local.x - target.collider.centerOffsetX;
  const localZ = local.z - target.collider.centerOffsetZ;
  const outsideX = Math.max(Math.abs(localX) - target.collider.halfX, 0);
  const outsideZ = Math.max(Math.abs(localZ) - target.collider.halfZ, 0);
  return (
    outsideX * outsideX + outsideZ * outsideZ <= EXCAVATOR_COLLISION_RADIUS ** 2
  );
}

/** 트럭 OBB + 굴착기 반경 원 겹침을 최단면으로 밀어낸다. */
export function resolveExcavatorTruckOverlap(
  x: number,
  z: number,
  target: TruckAlignTarget,
): { x: number; z: number } | null {
  const local = worldToTruckLocal(
    x,
    z,
    target.groupX,
    target.groupZ,
    target.rotation,
  );
  const lx = local.x - target.collider.centerOffsetX;
  const lz = local.z - target.collider.centerOffsetZ;
  const hx = target.collider.halfX;
  const hz = target.collider.halfZ;
  const radius = EXCAVATOR_COLLISION_RADIUS;
  const pad = 0.04;

  const closestX = Math.max(-hx, Math.min(hx, lx));
  const closestZ = Math.max(-hz, Math.min(hz, lz));
  const dx = lx - closestX;
  const dz = lz - closestZ;
  const distSq = dx * dx + dz * dz;

  if (distSq > radius * radius) return null;

  let outLx: number;
  let outLz: number;
  if (distSq < 1e-8) {
    const toPosX = hx - lx;
    const toNegX = hx + lx;
    const toPosZ = hz - lz;
    const toNegZ = hz + lz;
    const nearest = Math.min(toPosX, toNegX, toPosZ, toNegZ);
    if (nearest === toPosX) {
      outLx = hx + radius + pad;
      outLz = lz;
    } else if (nearest === toNegX) {
      outLx = -hx - radius - pad;
      outLz = lz;
    } else if (nearest === toPosZ) {
      outLx = lx;
      outLz = hz + radius + pad;
    } else {
      outLx = lx;
      outLz = -hz - radius - pad;
    }
  } else {
    const dist = Math.sqrt(distSq);
    const scale = (radius + pad) / dist;
    outLx = closestX + dx * scale;
    outLz = closestZ + dz * scale;
  }

  return truckLocalToWorld(
    outLx + target.collider.centerOffsetX,
    outLz + target.collider.centerOffsetZ,
    target.groupX,
    target.groupZ,
    target.rotation,
  );
}

/** 주행 중 트럭에 부딪히면 직전 위치로 되돌리거나 밀어낸다. */
export function constrainExcavatorToTruckTarget(
  sim: ExcavatorSimState,
  previous: { x: number; z: number },
  target: TruckAlignTarget | null,
): boolean {
  if (!target || !isExcavatorCollidingWithTruckTarget(sim.posX, sim.posZ, target)) {
    return false;
  }
  if (!isExcavatorCollidingWithTruckTarget(previous.x, previous.z, target)) {
    sim.posX = previous.x;
    sim.posZ = previous.z;
    return true;
  }
  const resolved = resolveExcavatorTruckOverlap(sim.posX, sim.posZ, target);
  if (resolved) {
    sim.posX = resolved.x;
    sim.posZ = resolved.z;
  }
  return true;
}

/** 돌트럭 차체·측판 고체(짐칸 공동 제외). */
export function isInHaulTruckSolidVolume(
  wx: number,
  wy: number,
  wz: number,
  dropX: number,
  dropZ: number,
): boolean {
  if (wy < HAUL_TRUCK_ALIGN.solidMinY || wy > HAUL_TRUCK_ALIGN.solidMaxY) {
    return false;
  }
  const local = worldToTruckLocal(
    wx,
    wz,
    dropX,
    dropZ,
    HAUL_TRUCK_ALIGN.rotation,
  );
  const hullX = local.x - HAUL_TRUCK_ALIGN.collider.centerOffsetX;
  const hullZ = local.z - HAUL_TRUCK_ALIGN.collider.centerOffsetZ;
  if (
    Math.abs(hullX) > HAUL_TRUCK_ALIGN.collider.halfX ||
    Math.abs(hullZ) > HAUL_TRUCK_ALIGN.collider.halfZ
  ) {
    return false;
  }
  const bedRelX = local.x - HAUL_TRUCK_ALIGN.cavityCenterLocalX;
  const bedRelZ = local.z - HAUL_TRUCK_ALIGN.cavityCenterLocalZ;
  const inCavity =
    wy >= HAUL_TRUCK_ALIGN.cavityMinY &&
    wy <= HAUL_TRUCK_ALIGN.cavityMaxY &&
    Math.abs(bedRelX) <= HAUL_TRUCK_ALIGN.cavityHalfX &&
    Math.abs(bedRelZ) <= HAUL_TRUCK_ALIGN.cavityHalfZ;
  return !inCavity;
}

/** 붐·암이 돌트럭 고체를 뚫으면 관절을 롤백한다. */
export function constrainArmFromHaulTruck(
  sim: ExcavatorSimState,
  vel: HydraulicVelocity,
  boomSwing: number,
  before: { boom: number; arm: number; bucket: number },
  dropX: number,
  dropZ: number,
  present: boolean,
  getSamples: (
    sim: ExcavatorSimState,
    boomSwing: number,
  ) => ReadonlyArray<{ x: number; y: number; z: number }>,
): boolean {
  if (!present) return false;
  const probe = 0.32;
  const offsets: ReadonlyArray<readonly [number, number, number]> = [
    [0, 0, 0],
    [probe, 0, 0],
    [-probe, 0, 0],
    [0, probe, 0],
    [0, -probe, 0],
    [0, 0, probe],
    [0, 0, -probe],
  ];
  const samples = getSamples(sim, boomSwing);
  const hits = samples.some((point) =>
    offsets.some(([dx, dy, dz]) =>
      isInHaulTruckSolidVolume(
        point.x + dx,
        point.y + dy,
        point.z + dz,
        dropX,
        dropZ,
      ),
    ),
  );
  if (!hits) return false;
  sim.boom = before.boom;
  sim.arm = before.arm;
  sim.bucket = before.bucket;
  vel.boom = 0;
  vel.arm = 0;
  vel.bucket = 0;
  return true;
}
