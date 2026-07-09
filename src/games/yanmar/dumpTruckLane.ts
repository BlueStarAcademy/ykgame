import { DUMP_TRUCK } from "./terrain";

/** 퇴장·복귀 도로 길이 (mapDecor TruckDepartureLane 과 동일) */
export const DUMP_TRUCK_LANE_LENGTH = 44;
/** 주차 위치에서 도로 시작점까지 역방향 여유 */
export const DUMP_TRUCK_LANE_APPROACH = 2.2;

/** 주차 위치 기준, 도로 진행 방향(+local X)으로 도로 끝까지 거리 */
export const DUMP_TRUCK_LANE_END_OFFSET =
  DUMP_TRUCK_LANE_LENGTH - DUMP_TRUCK_LANE_APPROACH;

export function getDumpTruckLaneDirection() {
  const cos = Math.cos(DUMP_TRUCK.rotation);
  const sin = Math.sin(DUMP_TRUCK.rotation);
  return { dirX: cos, dirZ: -sin };
}

export function getDumpTruckLaneSegment() {
  const { dirX, dirZ } = getDumpTruckLaneDirection();
  const startX = DUMP_TRUCK.groupX - dirX * DUMP_TRUCK_LANE_APPROACH;
  const startZ = DUMP_TRUCK.groupZ - dirZ * DUMP_TRUCK_LANE_APPROACH;
  const endX = startX + dirX * DUMP_TRUCK_LANE_LENGTH;
  const endZ = startZ + dirZ * DUMP_TRUCK_LANE_LENGTH;
  return { startX, startZ, endX, endZ, dirX, dirZ };
}

/** 주차 위치에서 도로 방향으로 offset 만큼 이동한 월드 좌표 */
export function dumpTruckOffsetToWorld(offsetLocalX: number) {
  const { dirX, dirZ } = getDumpTruckLaneDirection();
  return {
    groupX: DUMP_TRUCK.groupX + offsetLocalX * dirX,
    groupZ: DUMP_TRUCK.groupZ + offsetLocalX * dirZ,
  };
}
