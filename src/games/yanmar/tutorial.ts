import type { ExcavatorSimState } from "./ExcavatorScene";
import type { ControlMask } from "./controls";
import { ALL_CONTROLS } from "./controls";
import type { AttachmentType } from "./types";

export type { ControlMask };
export type GameMode = "intro" | "ride" | "practice" | "tutorial" | "gameReady" | "game";

export type TutorialHighlight =
  | "left"
  | "right"
  | "travel"
  | "both"
  | "breaker"
  | null;

export interface TutorialWaypoint {
  x: number;
  z: number;
  radius: number;
}

export interface TutorialStep {
  id: string;
  title: string;
  instruction: string;
  highlight: TutorialHighlight;
  allowed: ControlMask;
  waypoint?: TutorialWaypoint;
  /** 시작 시 자동 장착할 부착물 */
  startAttachment?: AttachmentType;
  /** 시작 시 굴착기 위치 (미설정 시 기본 스폰) */
  startPose?: { x: number; z: number; heading?: number };
  swingTarget?: number;
  armMin?: number;
  armMax?: number;
  boomMin?: number;
  bucketMax?: number;
  loadMin?: number;
  dumpMin?: number;
  /** 브레이커 성공 타격 횟수 */
  crashHitsMin?: number;
  /** 집게로 돌 하역 횟수 */
  hillDeliverMin?: number;
}

export interface TutorialProgress {
  dumped: number;
  crashHits: number;
  hillDelivered: number;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "travel",
    title: "1. 주행",
    instruction: "좌우 주행 레버를 둘 다 앞으로 — 파란 목표 링까지 이동",
    highlight: "travel",
    allowed: { leftX: false, leftY: false, rightX: false, rightY: false, travel: true },
    waypoint: { x: -18, z: -10, radius: 3 },
  },
  {
    id: "swing",
    title: "2. 스윙",
    instruction: "좌 조이스틱 좌측 — 상부체 선회",
    highlight: "left",
    allowed: { leftX: true, leftY: false, rightX: false, rightY: false, travel: false },
    swingTarget: 0.45,
  },
  {
    id: "arm",
    title: "3. 암",
    instruction: "좌 조이스틱 앞 — 암 뻗기",
    highlight: "left",
    allowed: { leftX: false, leftY: true, rightX: false, rightY: false, travel: false },
    armMax: -0.35,
  },
  {
    id: "boom",
    title: "4. 붐",
    instruction: "우 조이스틱 앞 — 붐 하강 (버켓을 아래로)",
    highlight: "right",
    allowed: { leftX: false, leftY: false, rightX: false, rightY: true, travel: false },
    boomMin: 0.75,
  },
  {
    id: "bucket",
    title: "5. 버켓",
    instruction: "우 조이스틱 좌 — 버켓 말기",
    highlight: "right",
    allowed: { leftX: false, leftY: false, rightX: true, rightY: false, travel: false },
    bucketMax: 0.35,
  },
  {
    id: "dig",
    title: "6. 굴착",
    instruction: "버켓을 반쯤 열고 흙더미에 깊이 넣은 뒤, 버켓을 30도쯤 말며 암을 안쪽으로 당겨 적재 35% 이상",
    highlight: "both",
    allowed: { ...ALL_CONTROLS },
    loadMin: 0.35,
  },
  {
    id: "dump",
    title: "7. 하역",
    instruction: "초록 구역에서 우 조이스틱 우측 — 버켓 펴기",
    highlight: "both",
    allowed: { ...ALL_CONTROLS },
    dumpMin: 0.12,
  },
  {
    id: "breaker",
    title: "8. 브레이커",
    instruction:
      "Crash 구역에서 브레이커 팁을 수직에 가깝게 세운 뒤, 하이라이트된 발판을 밟아 타격하세요",
    highlight: "breaker",
    allowed: { ...ALL_CONTROLS },
    startAttachment: "breaker",
    startPose: { x: 96, z: 12, heading: Math.PI / 2 },
    crashHitsMin: 8,
  },
  {
    id: "grapple",
    title: "9. 집게",
    instruction:
      "Stone 구역에서 우 조이스틱 좌로 돌을 집고, 하역 지점(트럭)에서 우로 펴서 내려놓으세요",
    highlight: "right",
    allowed: { ...ALL_CONTROLS },
    startAttachment: "grapple",
    startPose: { x: 22, z: 98, heading: 0 },
    hillDeliverMin: 1,
  },
];

export function isAtWaypoint(sim: ExcavatorSimState, wp: TutorialWaypoint) {
  const dx = sim.posX - wp.x;
  const dz = sim.posZ - wp.z;
  return Math.sqrt(dx * dx + dz * dz) <= wp.radius;
}

export function waypointDistance(sim: ExcavatorSimState, wp: TutorialWaypoint) {
  const dx = sim.posX - wp.x;
  const dz = sim.posZ - wp.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/** 단계 id별로만 판정 — 이전 단계 조건이 남아 오완료되는 것 방지 */
export function checkTutorialStepComplete(
  step: TutorialStep,
  sim: ExcavatorSimState,
  progress: TutorialProgress,
): boolean {
  switch (step.id) {
    case "travel":
      return step.waypoint != null && isAtWaypoint(sim, step.waypoint);
    case "swing":
      return step.swingTarget != null && sim.swing >= step.swingTarget;
    case "arm":
      return step.armMax != null && sim.arm >= step.armMax;
    case "boom":
      return step.boomMin != null && sim.boom >= step.boomMin;
    case "bucket":
      return step.bucketMax != null && sim.bucket <= step.bucketMax;
    case "dig":
      return step.loadMin != null && sim.bucketLoad >= step.loadMin;
    case "dump":
      return step.dumpMin != null && progress.dumped >= step.dumpMin;
    case "breaker":
      return step.crashHitsMin != null && progress.crashHits >= step.crashHitsMin;
    case "grapple":
      return (
        step.hillDeliverMin != null && progress.hillDelivered >= step.hillDeliverMin
      );
    default:
      return false;
  }
}

export { ALL_CONTROLS };
