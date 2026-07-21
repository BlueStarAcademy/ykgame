import type { ExcavatorSimState } from "./ExcavatorScene";
import type { ControlMask, ExcavatorControlState } from "./controls";
import { ALL_CONTROLS, JOINT_LIMITS } from "./controls";
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
  /** 선택 모달·초기 안내용 대표 문구 */
  instruction: string;
  highlight: TutorialHighlight;
  allowed: ControlMask;
  waypoint?: TutorialWaypoint;
  /** 시작 시 자동 장착할 부착물 */
  startAttachment?: AttachmentType;
  /** 시작 시 굴착기 위치 (미설정 시 기본 스폰) */
  startPose?: { x: number; z: number; heading?: number };
}

/** 단계별 서브 진행 (매 튜토리얼 시작 시 리셋) */
export interface TutorialPhaseProgress {
  phase: number;
  travelDist: number;
  headingAccum: number;
  lastX: number;
  lastZ: number;
  lastHeading: number;
  dumped: number;
  asphaltBroken: number;
  hillDelivered: number;
  rockLiftJudged: boolean;
  rockLiftSuccess: boolean;
  dumpTruckDeparted: boolean;
  haulTruckDeparted: boolean;
  lastLiftTick: number;
}

export interface TutorialTickExtras {
  input: ExcavatorControlState;
  gripPressure: number;
  carryingRock: boolean;
  grappleLiftResult: null | "success" | "fail";
  grappleLiftResultTick: number;
  dumpTruckPhase: string;
  haulTruckPhase: string;
  breakerTipReady: boolean;
}

const TRAVEL_FWD_WP: TutorialWaypoint = { x: -18, z: -10, radius: 3 };
const TRAVEL_REV_WP: TutorialWaypoint = { x: -18, z: -20, radius: 3.5 };
const TRAVEL_SIDE_DIST = 2.2;
const TRAVEL_TURN_RAD = 0.55;
const LEVER_ON = 0.55;
const LEVER_OFF = 0.22;

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "travel",
    title: "1. 주행",
    instruction: "전진·좌/우 레버·후진을 모두 연습합니다",
    highlight: "travel",
    allowed: { leftX: false, leftY: false, rightX: false, rightY: false, travel: true },
    waypoint: TRAVEL_FWD_WP,
  },
  {
    id: "swing",
    title: "2. 스윙",
    instruction: "좌·우측 스윙을 모두 연습합니다",
    highlight: "left",
    allowed: { leftX: true, leftY: false, rightX: false, rightY: false, travel: false },
  },
  {
    id: "arm",
    title: "3. 암",
    instruction: "암 뻗기·당김으로 제자리까지 연습합니다",
    highlight: "left",
    allowed: { leftX: false, leftY: true, rightX: false, rightY: false, travel: false },
  },
  {
    id: "boom",
    title: "4. 붐",
    instruction: "붐 하강·상승을 모두 연습합니다",
    highlight: "right",
    allowed: { leftX: false, leftY: false, rightX: false, rightY: true, travel: false },
  },
  {
    id: "bucket",
    title: "5. 버켓",
    instruction: "버켓 펴기·말기를 모두 연습합니다",
    highlight: "right",
    allowed: { leftX: false, leftY: false, rightX: true, rightY: false, travel: false },
  },
  {
    id: "dig",
    title: "6. 흙더미",
    instruction: "흙을 버켓에 100%까지 적재합니다",
    highlight: "both",
    allowed: { ...ALL_CONTROLS },
  },
  {
    id: "dump",
    title: "7. 하역",
    instruction: "트럭에 하역한 뒤 비켜서 출발까지 확인합니다",
    highlight: "both",
    allowed: { ...ALL_CONTROLS },
  },
  {
    id: "breaker",
    title: "8. 브레이커",
    instruction: "파쇄 구역에 대고 발판을 유지해 깨뜨립니다",
    highlight: "breaker",
    allowed: { ...ALL_CONTROLS },
    startAttachment: "breaker",
    startPose: { x: 96, z: 12, heading: Math.PI / 2 },
  },
  {
    id: "rockLoad",
    title: "9. 돌 적재",
    instruction: "돌을 집어 밀착감 최대 후 붐 상승 판정까지",
    highlight: "breaker",
    allowed: { ...ALL_CONTROLS },
    startAttachment: "grapple",
    startPose: { x: 22, z: 98, heading: 0 },
  },
  {
    id: "rockDump",
    title: "10. 돌 하역",
    instruction: "적재한 돌을 트럭에 하역하고 출발까지 확인합니다",
    highlight: "breaker",
    allowed: { ...ALL_CONTROLS },
    startAttachment: "grapple",
    startPose: { x: 22, z: 98, heading: 0 },
  },
];

export function createTutorialPhaseProgress(
  sim: ExcavatorSimState,
): TutorialPhaseProgress {
  return {
    phase: 0,
    travelDist: 0,
    headingAccum: 0,
    lastX: sim.posX,
    lastZ: sim.posZ,
    lastHeading: sim.heading,
    dumped: 0,
    asphaltBroken: 0,
    hillDelivered: 0,
    rockLiftJudged: false,
    rockLiftSuccess: false,
    dumpTruckDeparted: false,
    haulTruckDeparted: false,
    lastLiftTick: 0,
  };
}

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

function normalizeAngle(rad: number) {
  let a = rad;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function accumulateTravel(
  progress: TutorialPhaseProgress,
  sim: ExcavatorSimState,
) {
  const dx = sim.posX - progress.lastX;
  const dz = sim.posZ - progress.lastZ;
  const dist = Math.hypot(dx, dz);
  const dHeading = Math.abs(normalizeAngle(sim.heading - progress.lastHeading));
  progress.lastX = sim.posX;
  progress.lastZ = sim.posZ;
  progress.lastHeading = sim.heading;
  return { dist, dHeading };
}

function advancePhase(progress: TutorialPhaseProgress) {
  progress.phase += 1;
  progress.travelDist = 0;
  progress.headingAccum = 0;
}

export function getTutorialInstruction(
  step: TutorialStep,
  progress: TutorialPhaseProgress,
): string {
  switch (step.id) {
    case "travel":
      switch (progress.phase) {
        case 0:
          return "좌우 주행 레버를 둘 다 앞으로 — 파란 목표 링까지 전진";
        case 1:
          return "왼쪽 레버만 앞으로 밀어 선회·이동해 보세요";
        case 2:
          return "오른쪽 레버만 앞으로 밀어 선회·이동해 보세요";
        default:
          return "좌우 레버를 둘 다 뒤로 밀어 후진해 보세요 (목표 링까지)";
      }
    case "swing":
      return progress.phase === 0
        ? "좌 조이스틱 좌측 — 좌측으로 스윙"
        : "좌 조이스틱 우측 — 우측으로 스윙";
    case "arm":
      return progress.phase === 0
        ? "좌 조이스틱 앞 — 암 뻗기"
        : "좌 조이스틱 뒤 — 암을 당겨 제자리로";
    case "boom":
      return progress.phase === 0
        ? "우 조이스틱 앞 — 붐 하강"
        : "우 조이스틱 뒤 — 붐 상승";
    case "bucket":
      return progress.phase === 0
        ? "우 조이스틱 우측 — 버켓 펴기"
        : "우 조이스틱 좌측 — 버켓 말기";
    case "dig":
      return "버켓을 반쯤 열고 흙더미에 넣은 뒤, 말며 암을 당겨 적재 100%까지";
    case "dump":
      return progress.phase === 0
        ? "트럭에 차체를 붙이고 정면을 맞춘 뒤, 우 조이스틱 우측으로 버켓을 펴 하역"
        : "트럭에서 비켜나면 트럭이 출발합니다 — 출발할 때까지 확인";
    case "breaker":
      return progress.phase === 0
        ? "파쇄 구역에서 브레이커 팁을 노면에 수직에 가깝게 대세요"
        : "하이라이트된 발판을 클릭한 채 유지 — 파쇄가 끝날 때까지";
    case "rockLoad":
      switch (progress.phase) {
        case 0:
          return "버켓 각도를 집게에 맞춘 뒤 발판 오른쪽으로 돌을 집으세요";
        case 1:
          return "집게 발판을 오른쪽으로 3초간 유지해 밀착감을 최대로 올리세요";
        default:
          return "발판을 떼고 붐을 올려 적재 성공/실패 판정을 확인하세요";
      }
    case "rockDump":
      switch (progress.phase) {
        case 0:
          return "돌을 성공적으로 적재한 뒤 돌트럭으로 이동하세요";
        case 1:
          return "트럭에서 발판 왼쪽을 밟아 돌을 하역하세요";
        default:
          return "트럭에서 비켜나면 트럭이 출발합니다 — 출발할 때까지 확인";
      }
    default:
      return step.instruction;
  }
}

export function getTutorialWaypoint(
  step: TutorialStep,
  progress: TutorialPhaseProgress,
): TutorialWaypoint | undefined {
  if (step.id !== "travel") return step.waypoint;
  if (progress.phase === 0) return TRAVEL_FWD_WP;
  if (progress.phase >= 3) return TRAVEL_REV_WP;
  return undefined;
}

/** 해당 튜토리얼의 서브 단계 수 (완료 판정 포함) */
export function getTutorialPhaseCount(step: TutorialStep): number {
  switch (step.id) {
    case "travel":
      return 4;
    case "swing":
    case "arm":
    case "boom":
    case "bucket":
    case "dump":
    case "breaker":
      return 2;
    case "rockLoad":
    case "rockDump":
      return 3;
    case "dig":
    default:
      return 1;
  }
}

/** 방금 끝낸 서브 단계(completedPhase) 성공 문구 */
export function getTutorialPhaseSuccessLabel(
  step: TutorialStep,
  completedPhase: number,
): string {
  switch (step.id) {
    case "travel":
      return (
        ["전진 성공!", "왼쪽 레버 성공!", "오른쪽 레버 성공!", "후진 성공!"][
          completedPhase
        ] ?? "성공!"
      );
    case "swing":
      return completedPhase === 0 ? "좌측 스윙 성공!" : "우측 스윙 성공!";
    case "arm":
      return completedPhase === 0 ? "암 뻗기 성공!" : "암 당김 성공!";
    case "boom":
      return completedPhase === 0 ? "붐 하강 성공!" : "붐 상승 성공!";
    case "bucket":
      return completedPhase === 0 ? "버켓 펴기 성공!" : "버켓 말기 성공!";
    case "dig":
      return "적재 100% 성공!";
    case "dump":
      return completedPhase === 0 ? "하역 성공!" : "트럭 출발 확인!";
    case "breaker":
      return completedPhase === 0 ? "접촉 성공!" : "파쇄 성공!";
    case "rockLoad":
      return (
        ["돌 집기 성공!", "밀착감 최대!", "적재 판정 확인!"][completedPhase] ??
        "성공!"
      );
    case "rockDump":
      return (
        ["돌 적재 성공!", "돌 하역 성공!", "트럭 출발 확인!"][completedPhase] ??
        "성공!"
      );
    default:
      return "성공!";
  }
}

/**
 * 서브 단계를 갱신하고, 해당 튜토리얼이 모두 끝났으면 true.
 */
export function advanceTutorialProgress(
  step: TutorialStep,
  sim: ExcavatorSimState,
  progress: TutorialPhaseProgress,
  extras: TutorialTickExtras,
): boolean {
  const { dist, dHeading } = accumulateTravel(progress, sim);
  const travel = extras.input.travel;
  const leftOnlyFwd =
    travel.left > LEVER_ON && Math.abs(travel.right) < LEVER_OFF;
  const rightOnlyFwd =
    travel.right > LEVER_ON && Math.abs(travel.left) < LEVER_OFF;

  if (
    extras.grappleLiftResultTick !== progress.lastLiftTick &&
    extras.grappleLiftResult != null
  ) {
    progress.lastLiftTick = extras.grappleLiftResultTick;
    progress.rockLiftJudged = true;
    if (extras.grappleLiftResult === "success") {
      progress.rockLiftSuccess = true;
    }
  }

  if (
    (extras.dumpTruckPhase === "engineStart" ||
      extras.dumpTruckPhase === "departing") &&
    progress.dumped > 0
  ) {
    progress.dumpTruckDeparted = true;
  }
  if (
    (extras.haulTruckPhase === "engineStart" ||
      extras.haulTruckPhase === "departing") &&
    progress.hillDelivered > 0
  ) {
    progress.haulTruckDeparted = true;
  }

  switch (step.id) {
    case "travel": {
      if (progress.phase === 0) {
        if (isAtWaypoint(sim, TRAVEL_FWD_WP)) advancePhase(progress);
      } else if (progress.phase === 1) {
        if (leftOnlyFwd) {
          progress.travelDist += dist;
          progress.headingAccum += dHeading;
        }
        if (
          progress.travelDist >= TRAVEL_SIDE_DIST ||
          progress.headingAccum >= TRAVEL_TURN_RAD
        ) {
          advancePhase(progress);
        }
      } else if (progress.phase === 2) {
        if (rightOnlyFwd) {
          progress.travelDist += dist;
          progress.headingAccum += dHeading;
        }
        if (
          progress.travelDist >= TRAVEL_SIDE_DIST ||
          progress.headingAccum >= TRAVEL_TURN_RAD
        ) {
          advancePhase(progress);
        }
      } else if (progress.phase === 3) {
        const bothRev =
          travel.left < -LEVER_ON && travel.right < -LEVER_ON;
        if (bothRev) progress.travelDist += dist;
        if (
          progress.travelDist >= 3.2 ||
          isAtWaypoint(sim, TRAVEL_REV_WP)
        ) {
          return true;
        }
      }
      return false;
    }
    case "swing": {
      if (progress.phase === 0 && sim.swing >= 0.45) advancePhase(progress);
      else if (progress.phase === 1 && sim.swing <= -0.45) return true;
      return false;
    }
    case "arm": {
      if (progress.phase === 0 && sim.arm >= -0.35) advancePhase(progress);
      else if (progress.phase === 1 && sim.arm <= -0.85) return true;
      return false;
    }
    case "boom": {
      if (progress.phase === 0 && sim.boom >= 0.75) advancePhase(progress);
      else if (progress.phase === 1 && sim.boom <= JOINT_LIMITS.boom.min + 0.02) {
        return true;
      }
      return false;
    }
    case "bucket": {
      if (progress.phase === 0 && sim.bucket >= 1.8) advancePhase(progress);
      else if (progress.phase === 1 && sim.bucket <= 0.45) return true;
      return false;
    }
    case "dig":
      return sim.bucketLoad >= 0.995;
    case "dump": {
      if (progress.phase === 0 && progress.dumped >= 0.08) advancePhase(progress);
      else if (progress.phase === 1 && progress.dumpTruckDeparted) return true;
      return false;
    }
    case "breaker": {
      if (progress.phase === 0 && extras.breakerTipReady) advancePhase(progress);
      else if (progress.phase === 1 && progress.asphaltBroken >= 1) return true;
      return false;
    }
    case "rockLoad": {
      if (progress.rockLiftJudged) return true;
      if (!extras.carryingRock) progress.phase = 0;
      else if (extras.gripPressure < 0.98) progress.phase = 1;
      else progress.phase = 2;
      return false;
    }
    case "rockDump": {
      if (progress.phase === 0) {
        if (progress.rockLiftSuccess && extras.carryingRock) advancePhase(progress);
      } else if (progress.phase === 1) {
        if (progress.hillDelivered >= 1) advancePhase(progress);
      } else if (progress.phase === 2 && progress.haulTruckDeparted) {
        return true;
      }
      return false;
    }
    default:
      return false;
  }
}

export { ALL_CONTROLS };
