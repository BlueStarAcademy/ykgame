export const MIN_BUCKET_GROUND_CLEARANCE = 0.05;
export const MIN_BUCKET_DIG_ZONE_CLEARANCE = -2.15;
export const EXCAVATOR_MAP_WALL_MARGIN = 4.6;
export const EXCAVATOR_COLLISION_RADIUS = 1.35;

/** 붐·암·버킷 vs 덤프트럭 고체 — 구(sphere) 근사 반경 */
export const DUMP_TRUCK_ARM_PROBE_RADIUS = 0.32;

export const DUMP_TRUCK_COLLIDER = {
  centerOffsetX: -0.12,
  centerOffsetZ: 0,
  halfX: 3.15,
  halfZ: 1.62,
} as const;
