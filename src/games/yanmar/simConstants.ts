export const MIN_BUCKET_GROUND_CLEARANCE = 0.05;
export const MIN_BUCKET_DIG_ZONE_CLEARANCE = -2.15;
/** 버켓이 이 높이보다 낮으면(지면 침투) 주행 잠금. 굴착지 여부와 무관. */
export const BUCKET_TRAVEL_LOCK_CLEARANCE = -0.05;
/**
 * 주행 잠금 해제 여유(히스테리시스).
 * Lock(-0.05)보다 조금만 높게 — 너무 크면 들어올린 뒤에도 잠금/경고가 안 풀림.
 */
export const BUCKET_TRAVEL_UNLOCK_CLEARANCE = 0.02;
/** 브레이커 주행 잠금 해제 여유. */
export const BREAKER_TRAVEL_UNLOCK_CLEARANCE = 0.4;
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
 * Default undercarriage collision radius (ViO17-class footprint + skin).
 * Prefer {@link getExcavatorCollisionRadius} when the active chassis scale is known.
 */
export const EXCAVATOR_COLLISION_RADIUS = 1.68;

/** Extra gap kept between excavator circle and truck OBB after resolve. */
export const TRUCK_BODY_SEPARATION_PAD = 0.32;

/** 붐·암·버킷 vs 덤프트럭 고체 — 구(sphere) 근사 반경 */
export const DUMP_TRUCK_ARM_PROBE_RADIUS = 0.32;

/**
 * 덤프트럭 차체 OBB — DumpTruckModel 외곽에 맞춤.
 * 캡 전면(~3.51)·적재함 후면(~-3.16)·측판/휠(~±1.66).
 */
export const DUMP_TRUCK_COLLIDER = {
  centerOffsetX: 0.05,
  centerOffsetZ: 0,
  halfX: 3.58,
  halfZ: 1.95,
} as const;
