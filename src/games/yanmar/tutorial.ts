import type { ExcavatorSimState } from "./ExcavatorScene";
import type { ControlMask } from "./controls";
import { ALL_CONTROLS } from "./controls";

export type { ControlMask };
export type GameMode = "intro" | "tutorial" | "game";

export type TutorialHighlight = "left" | "right" | "travel" | "both" | null;

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
  swingTarget?: number;
  armMin?: number;
  armMax?: number;
  boomMin?: number;
  bucketMin?: number;
  loadMin?: number;
  dumpMin?: number;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "travel",
    title: "1. 주행",
    instruction: "주행 레버로 앞으로 — 파란 목표 링까지 이동",
    highlight: "travel",
    allowed: { leftX: false, leftY: false, rightX: false, rightY: false, travel: true },
    waypoint: { x: -18, z: -10, radius: 3 },
  },
  {
    id: "swing",
    title: "2. 스윙",
    instruction: "좌 조이스틱 우측 — 상부체 회전",
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
    instruction: "우 조이스틱 앞 — 붐 하강 (버킷을 아래로)",
    highlight: "right",
    allowed: { leftX: false, leftY: false, rightX: false, rightY: true, travel: false },
    boomMin: 0.75,
  },
  {
    id: "bucket",
    title: "5. 버킷",
    instruction: "우 조이스틱 우 — 버킷 말기",
    highlight: "right",
    allowed: { leftX: false, leftY: false, rightX: true, rightY: false, travel: false },
    bucketMin: 0.7,
  },
  {
    id: "dig",
    title: "6. 굴착",
    instruction: "주황 구역에서 흙을 파서 적재 35% 이상",
    highlight: "both",
    allowed: { ...ALL_CONTROLS },
    loadMin: 0.35,
  },
  {
    id: "dump",
    title: "7. 하역",
    instruction: "초록 구역에서 버킷 펴기 — 흙 비우기",
    highlight: "both",
    allowed: { ...ALL_CONTROLS },
    dumpMin: 0.12,
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
  tutorialDumped: number,
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
      return step.bucketMin != null && sim.bucket >= step.bucketMin;
    case "dig":
      return step.loadMin != null && sim.bucketLoad >= step.loadMin;
    case "dump":
      return step.dumpMin != null && tutorialDumped >= step.dumpMin;
    default:
      return false;
  }
}

export { ALL_CONTROLS };
