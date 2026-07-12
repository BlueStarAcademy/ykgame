import { HAUL_TRUCK } from "./terrain";

/** 돌트럭 퇴장·복귀 도로 길이 (mapDecor HaulTruckDepartureLane 과 동일) */
export const HAUL_TRUCK_LANE_LENGTH = 40;
/** 주차 위치에서 도로 시작점까지 역방향 여유 */
export const HAUL_TRUCK_LANE_APPROACH = 2.2;

/** 주차 위치 기준, 도로 진행 방향(+forward)으로 도로 끝까지 거리 */
export const HAUL_TRUCK_LANE_END_OFFSET =
  HAUL_TRUCK_LANE_LENGTH - HAUL_TRUCK_LANE_APPROACH;

export function getHaulTruckLaneDirection() {
  const cos = Math.cos(HAUL_TRUCK.rotation);
  const sin = Math.sin(HAUL_TRUCK.rotation);
  return { dirX: cos, dirZ: -sin };
}

export function getHaulTruckLaneSegment() {
  const { dirX, dirZ } = getHaulTruckLaneDirection();
  const startX = HAUL_TRUCK.groupX - dirX * HAUL_TRUCK_LANE_APPROACH;
  const startZ = HAUL_TRUCK.groupZ - dirZ * HAUL_TRUCK_LANE_APPROACH;
  const endX = startX + dirX * HAUL_TRUCK_LANE_LENGTH;
  const endZ = startZ + dirZ * HAUL_TRUCK_LANE_LENGTH;
  return { startX, startZ, endX, endZ, dirX, dirZ };
}

/** 주차 위치에서 도로 방향으로 offset 만큼 이동한 월드 좌표 */
export function haulTruckOffsetToWorld(offsetLocalX: number) {
  const { dirX, dirZ } = getHaulTruckLaneDirection();
  return {
    groupX: HAUL_TRUCK.groupX + offsetLocalX * dirX,
    groupZ: HAUL_TRUCK.groupZ + offsetLocalX * dirZ,
  };
}
