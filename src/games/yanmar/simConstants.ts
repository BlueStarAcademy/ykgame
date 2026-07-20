export const MIN_BUCKET_GROUND_CLEARANCE = 0.05;
export const MIN_BUCKET_DIG_ZONE_CLEARANCE = -2.15;
/** 버켓이 이 높이보다 낮으면(지면 침투) 주행 잠금. 굴착지 여부와 무관. */
export const BUCKET_TRAVEL_LOCK_CLEARANCE = -0.05;
/** 집게는 지면 아래로 파고들지 않는다. */
export const MIN_GRAPPLE_GROUND_CLEARANCE = 0.02;
/** 브레이커가 아스팔트/지면 위에 올려진 상태로 유지할 최소 여유. */
export const MIN_BREAKER_SURFACE_CLEARANCE = 0.02;
/** 팁이 이 높이 이하면 지면/아스팔트에 닿은 것으로 본다. */
export const BREAKER_TOUCH_BAND = 0.28;
/** 팁 XZ 오차(피치·롤·여유)를 흡수하는 아스팔트 타일 탐색 반경. */
export const BREAKER_TIP_PROBE_RADIUS = 0.65;
/** 이 높이보다 브레이커 팁이 낮으면 주행 잠금. */
export const BREAKER_TRAVEL_LOCK_CLEARANCE = 0.28;
export const EXCAVATOR_MAP_WALL_MARGIN = 4.6;
/**
 * 차체(궤도 포함) 충돌 원 반경.
 * 대형 차체 궤도 폭(~1.5m)이 트럭 측면에 파고들지 않도록 시각보다 약간 여유 있게.
 */
export const EXCAVATOR_COLLISION_RADIUS = 1.68;

/** 붐·암·버킷 vs 덤프트럭 고체 — 구(sphere) 근사 반경 */
export const DUMP_TRUCK_ARM_PROBE_RADIUS = 0.32;

/** 덤프트럭 차체 OBB (모델 측판·캡 외곽에 맞춤) */
export const DUMP_TRUCK_COLLIDER = {
  centerOffsetX: -0.08,
  centerOffsetZ: 0,
  halfX: 3.4,
  halfZ: 1.85,
} as const;
