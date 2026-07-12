export const MIN_BUCKET_GROUND_CLEARANCE = 0.05;
export const MIN_BUCKET_DIG_ZONE_CLEARANCE = -2.15;
/** 브레이커가 아스팔트/지면 위에 올려진 상태로 유지할 최소 여유. */
export const MIN_BREAKER_SURFACE_CLEARANCE = 0.02;
/** 팁이 이 높이 이하면 지면/아스팔트에 닿은 것으로 본다. */
export const BREAKER_TOUCH_BAND = 0.28;
/** 팁 XZ 오차(피치·롤·여유)를 흡수하는 아스팔트 타일 탐색 반경. */
export const BREAKER_TIP_PROBE_RADIUS = 0.65;
/** 이 높이보다 브레이커 팁이 낮으면 주행 잠금. */
export const BREAKER_TRAVEL_LOCK_CLEARANCE = 0.28;
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
