import type { ExcavatorSimState } from "./ExcavatorScene";
import type { ControlMask, ExcavatorControlState } from "./controls";
import { ALL_CONTROLS, JOINT_LIMITS } from "./controls";
import type { AttachmentType } from "./types";
import { PLAYER_UNLOCKS } from "@/lib/playerUnlocks";
import {
  TUTORIAL_REWARDS,
  type TutorialStepId,
} from "./tutorialProgress";
import type { GearSlot, ItemGrade } from "./gearCatalog";

export type { ControlMask, TutorialStepId };
export { TUTORIAL_REWARDS };
export type GameMode =
  | "intro"
  | "ride"
  | "practice"
  | "tutorial"
  | "gameReady"
  | "game"
  | "sportsRanked"
  | "sportsPractice";

export type TutorialHighlight =
  | "left"
  | "right"
  | "travel"
  | "both"
  | "breaker"
  | null;

export type TutorialGearAction = "dismantle" | "enhance" | "synthesize";

export interface TutorialWaypoint {
  x: number;
  z: number;
  radius: number;
}

export interface TutorialReward {
  slot: GearSlot;
  grade: ItemGrade;
}

export interface TutorialStep {
  id: TutorialStepId;
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
  unlockLevel: number;
  reward?: TutorialReward;
  gearAction?: TutorialGearAction;
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
  cycleCount: number;
  cycleSeekingHigh: boolean;
  cycleArmed: boolean;
  gearActionOpened: boolean;
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
  travelBlockedRaiseArm: boolean;
  canDump: boolean;
  grappleOpen: number;
  gearActionOpened: boolean;
}

const TRAVEL_METERS = 5;
const LEVER_ON = 0.55;
const LEVER_OFF = 0.22;
const JOINT_EPS = 0.02;
const DUMP_WP: TutorialWaypoint = { x: 33.27, z: -12.68, radius: 8 };
const HAUL_WP: TutorialWaypoint = { x: 42, z: 100, radius: 8 };
const DIG_HEADING = Math.atan2(33.27 - 18, -12.68 - 2);

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "travel",
    title: "1. 주행",
    instruction: "전진·후진·왼레버 우회전·오른레버 좌회전을 각각 5m씩 연습합니다",
    highlight: "travel",
    allowed: {
      leftX: false,
      leftY: false,
      rightX: false,
      rightY: false,
      travel: true,
    },
    unlockLevel: 1,
    reward: TUTORIAL_REWARDS.travel,
  },
  {
    id: "boom",
    title: "2. 붐",
    instruction: "붐을 최대로 올렸다가 최대로 내리기를 3회 반복합니다",
    highlight: "right",
    allowed: {
      leftX: false,
      leftY: false,
      rightX: false,
      rightY: true,
      travel: false,
    },
    unlockLevel: 1,
    reward: TUTORIAL_REWARDS.boom,
  },
  {
    id: "arm",
    title: "3. 암",
    instruction: "암을 최대로 올렸다가 최대로 내리기를 3회 반복합니다",
    highlight: "left",
    allowed: {
      leftX: false,
      leftY: true,
      rightX: false,
      rightY: false,
      travel: false,
    },
    unlockLevel: 1,
    reward: TUTORIAL_REWARDS.arm,
  },
  {
    id: "bucket",
    title: "4. 버켓",
    instruction: "흙지역에서 적재한 뒤 덤프트럭에 하역합니다",
    highlight: "both",
    allowed: { ...ALL_CONTROLS },
    startPose: { x: 18, z: 2, heading: DIG_HEADING },
    startAttachment: "bucket",
    waypoint: { x: 18, z: 2, radius: 12 },
    unlockLevel: 1,
    reward: TUTORIAL_REWARDS.bucket,
  },
  {
    id: "breaker",
    title: "5. 브레이커",
    instruction: "아스팔트에 수직으로 대고 발판 좌측으로 파쇄합니다",
    highlight: "breaker",
    allowed: { ...ALL_CONTROLS },
    startAttachment: "breaker",
    startPose: { x: 96, z: 12, heading: Math.PI / 2 },
    unlockLevel: PLAYER_UNLOCKS.BREAKER,
    reward: TUTORIAL_REWARDS.breaker,
  },
  {
    id: "grapple",
    title: "6. 집게",
    instruction: "돌을 집어 적재한 뒤 돌트럭에 하역합니다",
    highlight: "breaker",
    allowed: { ...ALL_CONTROLS },
    startAttachment: "grapple",
    startPose: { x: 22, z: 98, heading: 0 },
    unlockLevel: PLAYER_UNLOCKS.GRAPPLE,
    reward: TUTORIAL_REWARDS.grapple,
  },
  {
    id: "gearDismantle",
    title: "7. 장비 분해",
    instruction: "장비를 분해하면 강화코어를 획득합니다",
    highlight: null,
    allowed: { ...ALL_CONTROLS },
    unlockLevel: PLAYER_UNLOCKS.GEAR_CRAFT,
    gearAction: "dismantle",
  },
  {
    id: "gearEnhance",
    title: "8. 장비 강화",
    instruction: "강화코어를 사용해 장비를 강화합니다",
    highlight: null,
    allowed: { ...ALL_CONTROLS },
    unlockLevel: PLAYER_UNLOCKS.GEAR_CRAFT,
    gearAction: "enhance",
  },
  {
    id: "gearSynth",
    title: "9. 장비 합성",
    instruction: "같은 등급 장비 3개를 합성합니다",
    highlight: null,
    allowed: { ...ALL_CONTROLS },
    unlockLevel: PLAYER_UNLOCKS.GEAR_CRAFT,
    gearAction: "synthesize",
  },
];

export function isTutorialStepUnlocked(
  step: TutorialStep,
  playerLevel: number,
) {
  return playerLevel >= step.unlockLevel;
}

export function getNewTutorialStepIds(
  playerLevel: number,
  seenNew: readonly string[],
): TutorialStepId[] {
  const seen = new Set(seenNew);
  return TUTORIAL_STEPS.filter(
    (step) =>
      step.unlockLevel > 1 &&
      playerLevel >= step.unlockLevel &&
      !seen.has(step.id),
  ).map((step) => step.id);
}

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
    cycleCount: 0,
    cycleSeekingHigh: false,
    cycleArmed: false,
    gearActionOpened: false,
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

function atJointMin(value: number, min: number) {
  return value <= min + JOINT_EPS;
}

function atJointMax(value: number, max: number) {
  return value >= max - JOINT_EPS;
}

function travelMeterLabel(dist: number) {
  const shown = Math.min(TRAVEL_METERS, Math.floor(dist * 10) / 10);
  return `${shown.toFixed(1)} / ${TRAVEL_METERS}m`;
}

/** raise (min) then lower (max), 3 full cycles. */
function advanceJointCycles(
  progress: TutorialPhaseProgress,
  atMin: boolean,
  atMax: boolean,
): boolean {
  if (!progress.cycleSeekingHigh) {
    if (!atMin) progress.cycleArmed = true;
    if (atMin && progress.cycleArmed) {
      progress.cycleSeekingHigh = true;
      progress.cycleArmed = false;
      advancePhase(progress);
    }
  } else {
    if (!atMax) progress.cycleArmed = true;
    if (atMax && progress.cycleArmed) {
      progress.cycleCount += 1;
      progress.cycleSeekingHigh = false;
      progress.cycleArmed = false;
      if (progress.cycleCount >= 3) return true;
      advancePhase(progress);
    }
  }
  return false;
}

export function getTutorialInstruction(
  step: TutorialStep,
  progress: TutorialPhaseProgress,
): string {
  switch (step.id) {
    case "travel":
      switch (progress.phase) {
        case 0:
          return `좌우 주행 레버를 둘 다 앞으로 — 전진 ${travelMeterLabel(progress.travelDist)}`;
        case 1:
          return `좌우 레버를 둘 다 뒤로 — 후진 ${travelMeterLabel(progress.travelDist)}`;
        case 2:
          return `왼쪽 레버만 앞으로 — 우회전 ${travelMeterLabel(progress.travelDist)}`;
        default:
          return `오른쪽 레버만 앞으로 — 좌회전 ${travelMeterLabel(progress.travelDist)}`;
      }
    case "boom":
      if (progress.cycleCount >= 3) return "붐 3회 완료!";
      return progress.cycleSeekingHigh
        ? `우 조이스틱 앞 — 붐을 최대로 내리세요 (${progress.cycleCount + 1}/3)`
        : `우 조이스틱 뒤 — 붐을 최대로 올리세요 (${progress.cycleCount + 1}/3)`;
    case "arm":
      if (progress.cycleCount >= 3) return "암 3회 완료!";
      return progress.cycleSeekingHigh
        ? `좌 조이스틱 앞 — 암을 최대로 뻗으세요 (${progress.cycleCount + 1}/3)`
        : `좌 조이스틱 뒤 — 암을 최대로 접으세요 (${progress.cycleCount + 1}/3)`;
    case "bucket":
      switch (progress.phase) {
        case 0:
          return "흙지역 안입니다. 붐·암을 조절해 버켓을 흙에 넣으세요";
        case 1:
          return "우 조이스틱 좌측으로 버켓을 말아 흙을 적재하세요";
        case 2:
          return "붐과 암을 들어 주행 가능한 자세로 만드세요";
        case 3:
          return "덤프트럭 하역 가능 위치까지 이동하세요";
        default:
          return "우 조이스틱 우측으로 버켓을 펴 흙을 하역하세요";
      }
    case "breaker":
      return progress.phase === 0
        ? "아스팔트에서 브레이커를 땅에 수직에 가깝게 대세요"
        : "하이라이트된 발판 좌측을 눌러 파쇄하세요";
    case "grapple":
      switch (progress.phase) {
        case 0:
          return "집게를 돌 근처 땅에 대고 발판 좌측으로 연 뒤, 우측으로 닫아 집으세요";
        case 1:
          return "밀착감 그래프는 적재 성공률입니다. 발판 우측을 유지해 밀착감을 올리세요";
        case 2:
          return "붐을 올려 적재를 확정하세요 (튜토리얼에서는 100% 성공)";
        case 3:
          return "집게를 열지 말고 천천히 돌트럭까지 이동하세요";
        default:
          return "돌트럭에서 발판 좌측으로 집게를 열어 하역하세요";
      }
    case "gearDismantle":
      return "장비 버튼을 연 뒤 분해를 눌러 강화코어 획득을 확인하세요";
    case "gearEnhance":
      return "장비 버튼을 연 뒤 강화를 눌러 강화코어 사용을 확인하세요";
    case "gearSynth":
      return "장비 버튼을 연 뒤 합성을 눌러 합성 화면을 확인하세요";
    default:
      return step.instruction;
  }
}

export function getTutorialWaypoint(
  step: TutorialStep,
  progress: TutorialPhaseProgress,
): TutorialWaypoint | undefined {
  if (step.id === "bucket" && progress.phase >= 3) return DUMP_WP;
  if (step.id === "bucket") return step.waypoint;
  if (step.id === "grapple" && progress.phase >= 3) return HAUL_WP;
  return step.waypoint;
}

/** 해당 튜토리얼의 서브 단계 수 (완료 판정 포함) */
export function getTutorialPhaseCount(step: TutorialStep): number {
  switch (step.id) {
    case "travel":
      return 4;
    case "boom":
    case "arm":
      return 6;
    case "bucket":
      return 5;
    case "breaker":
      return 2;
    case "grapple":
      return 5;
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
        ["전진 성공!", "후진 성공!", "우회전 성공!", "좌회전 성공!"][
          completedPhase
        ] ?? "성공!"
      );
    case "boom":
      return completedPhase % 2 === 0 ? "붐 상승 성공!" : "붐 하강 성공!";
    case "arm":
      return completedPhase % 2 === 0 ? "암 접기 성공!" : "암 뻗기 성공!";
    case "bucket":
      return (
        [
          "흙 접촉!",
          "적재 성공!",
          "주행 자세 완료!",
          "하역 위치 도착!",
          "하역 성공!",
        ][completedPhase] ?? "성공!"
      );
    case "breaker":
      return completedPhase === 0 ? "접촉 성공!" : "파쇄 성공!";
    case "grapple":
      return (
        [
          "돌 집기 성공!",
          "밀착감 확인!",
          "적재 성공!",
          "돌트럭 도착!",
          "하역 성공!",
        ][completedPhase] ?? "성공!"
      );
    case "gearDismantle":
      return "분해 안내 확인!";
    case "gearEnhance":
      return "강화 안내 확인!";
    case "gearSynth":
      return "합성 안내 확인!";
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
  const { dist } = accumulateTravel(progress, sim);
  const travel = extras.input.travel;
  const bothFwd = travel.left > LEVER_ON && travel.right > LEVER_ON;
  const bothRev = travel.left < -LEVER_ON && travel.right < -LEVER_ON;
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

  if (extras.gearActionOpened) progress.gearActionOpened = true;

  switch (step.id) {
    case "travel": {
      const moving =
        progress.phase === 0
          ? bothFwd
          : progress.phase === 1
            ? bothRev
            : progress.phase === 2
              ? leftOnlyFwd
              : rightOnlyFwd;
      if (moving) progress.travelDist += dist;
      if (progress.travelDist >= TRAVEL_METERS) {
        if (progress.phase >= 3) return true;
        advancePhase(progress);
      }
      return false;
    }
    case "boom":
      return advanceJointCycles(
        progress,
        atJointMin(sim.boom, JOINT_LIMITS.boom.min),
        atJointMax(sim.boom, JOINT_LIMITS.boom.max),
      );
    case "arm":
      return advanceJointCycles(
        progress,
        atJointMin(sim.arm, JOINT_LIMITS.arm.min),
        atJointMax(sim.arm, JOINT_LIMITS.arm.max),
      );
    case "bucket": {
      if (progress.phase === 0 && sim.bucketLoad >= 0.04) {
        advancePhase(progress);
      } else if (progress.phase === 1 && sim.bucketLoad >= 0.35) {
        advancePhase(progress);
      } else if (
        progress.phase === 2 &&
        sim.bucketLoad >= 0.12 &&
        !extras.travelBlockedRaiseArm
      ) {
        advancePhase(progress);
      } else if (progress.phase === 3) {
        if (progress.dumped >= 0.08) return true;
        if (extras.canDump || isAtWaypoint(sim, DUMP_WP)) advancePhase(progress);
      } else if (progress.phase >= 4 && progress.dumped >= 0.08) {
        return true;
      }
      return false;
    }
    case "breaker": {
      if (progress.phase === 0 && extras.breakerTipReady) advancePhase(progress);
      else if (progress.phase === 1 && progress.asphaltBroken >= 1) return true;
      return false;
    }
    case "grapple": {
      if (progress.phase === 0) {
        if (extras.carryingRock) advancePhase(progress);
      } else if (progress.phase === 1) {
        if (!extras.carryingRock) progress.phase = 0;
        else if (extras.gripPressure >= 0.98 || progress.rockLiftSuccess) {
          advancePhase(progress);
        }
      } else if (progress.phase === 2) {
        if (!extras.carryingRock && !progress.rockLiftSuccess) progress.phase = 0;
        else if (progress.rockLiftSuccess) advancePhase(progress);
      } else if (progress.phase === 3) {
        if (!extras.carryingRock && progress.hillDelivered < 1) {
          progress.phase = 0;
        } else if (progress.hillDelivered >= 1) {
          return true;
        } else if (isAtWaypoint(sim, HAUL_WP)) {
          advancePhase(progress);
        }
      } else if (progress.phase >= 4 && progress.hillDelivered >= 1) {
        return true;
      }
      return false;
    }
    case "gearDismantle":
    case "gearEnhance":
    case "gearSynth":
      return progress.gearActionOpened;
    default:
      return false;
  }
}

export { ALL_CONTROLS };
