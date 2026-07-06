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
  bucketMax?: number;
  loadMin?: number;
  dumpMin?: number;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "travel",
    title: "1. 주행",
    instruction: "가운데 주행 레버를 앞·뒤로 밀어 목표까지 이동",
    highlight: "travel",
    allowed: { leftX: false, leftY: false, rightX: false, rightY: false, travel: true },
    waypoint: { x: -3, z: 2, radius: 2.2 },
  },
  {
    id: "swing",
    title: "2. 스윙",
    instruction: "좌 조이스틱 좌우 — 상부체 회전",
    highlight: "left",
    allowed: { leftX: true, leftY: false, rightX: false, rightY: false, travel: false },
    swingTarget: 0.55,
  },
  {
    id: "arm",
    title: "3. 암",
    instruction: "좌 조이스틱 전후 — 암 뻗음·당김",
    highlight: "left",
    allowed: { leftX: false, leftY: true, rightX: false, rightY: false, travel: false },
    armMin: -0.35,
  },
  {
    id: "boom",
    title: "4. 붐",
    instruction: "우 조이스틱 뒤로 — 붐 상승",
    highlight: "right",
    allowed: { leftX: false, leftY: false, rightX: false, rightY: true, travel: false },
    boomMin: 0.85,
  },
  {
    id: "bucket",
    title: "5. 버킷",
    instruction: "우 조이스틱 좌 — 버킷 말기",
    highlight: "right",
    allowed: { leftX: false, leftY: false, rightX: true, rightY: false, travel: false },
    bucketMax: -0.75,
  },
  {
    id: "dig",
    title: "6. 굴착",
    instruction: "주황 구역에서 흙을 파서 적재",
    highlight: "both",
    allowed: { ...ALL_CONTROLS },
    loadMin: 0.45,
  },
  {
    id: "dump",
    title: "7. 하역",
    instruction: "초록 덤프존에서 버킷 펴기",
    highlight: "both",
    allowed: { ...ALL_CONTROLS },
    dumpMin: 0.2,
  },
];

export function isAtWaypoint(sim: ExcavatorSimState, wp: TutorialWaypoint) {
  const dx = sim.posX - wp.x;
  const dz = sim.posZ - wp.z;
  return Math.sqrt(dx * dx + dz * dz) <= wp.radius;
}

export function checkTutorialStepComplete(
  step: TutorialStep,
  sim: ExcavatorSimState,
  tutorialDumped: number,
): boolean {
  if (step.waypoint && isAtWaypoint(sim, step.waypoint)) return true;
  if (step.swingTarget !== undefined && Math.abs(sim.swing) >= step.swingTarget) return true;
  if (step.armMin !== undefined && sim.arm <= step.armMin) return true;
  if (step.armMax !== undefined && sim.arm >= step.armMax) return true;
  if (step.boomMin !== undefined && sim.boom >= step.boomMin) return true;
  if (step.bucketMax !== undefined && sim.bucket <= step.bucketMax) return true;
  if (step.loadMin !== undefined && sim.bucketLoad >= step.loadMin) return true;
  if (step.dumpMin !== undefined && tutorialDumped >= step.dumpMin) return true;
  return false;
}

export { ALL_CONTROLS };
