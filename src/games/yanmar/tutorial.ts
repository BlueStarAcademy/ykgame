import type { ExcavatorSimState } from "./ExcavatorScene";
import type { ControlMask, ExcavatorControlState } from "./controls";
import { ALL_CONTROLS, BLADE_RAISED, JOINT_LIMITS } from "./controls";
import type { AttachmentType } from "./types";
import { PLAYER_UNLOCKS } from "@/lib/playerUnlocks";
import { SITE_LAYOUT } from "./siteLayout";
import type { TerrainData } from "./terrain";
import {
  DUMP_TRUCK,
  HAUL_TRUCK,
  isInsideDigZoneBounds,
  isInDigZone,
} from "./terrain";
import {
  TUTORIAL_REWARDS,
  type TutorialRewardDef,
  type TutorialStepId,
  type YanmarTutorialState,
} from "./tutorialProgress";

export type { ControlMask, TutorialStepId };
export { TUTORIAL_REWARDS };
export type TutorialReward = TutorialRewardDef;
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
  | "blade"
  | null;

/** World region that auto-offers a tutorial when entered (feature unlocked). */
export type TutorialRegionId = "dig" | "crash" | "hill" | "flood";

export interface TutorialWaypoint {
  x: number;
  z: number;
  radius: number;
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
  /** Entering this region in game mode offers the tutorial. */
  region?: TutorialRegionId;
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
  /** House swing angle at tutorial start (radians). */
  swingOrigin: number;
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
  /** Bucket/tool is on or in the ground (boom cannot lower further). */
  tipTouchingGround: boolean;
  /** Dozer blade 0=raised … 1=lowered. */
  blade: number;
}

const TRAVEL_METERS = 5;
const BLADE_TRAVEL_METERS = 10;
const LEVER_ON = 0.55;
const LEVER_OFF = 0.22;
const JOINT_EPS = 0.02;
const SWING_QUARTER = Math.PI / 2;
const SWING_EPS = 0.12;
const BLADE_DOWN_EPS = 0.92;
const BLADE_UP_EPS = 0.08;
const DUMP_WP: TutorialWaypoint = {
  x: DUMP_TRUCK.groupX,
  z: DUMP_TRUCK.groupZ,
  radius: 8,
};
const HAUL_WP: TutorialWaypoint = {
  x: HAUL_TRUCK.groupX,
  z: HAUL_TRUCK.groupZ,
  radius: 8,
};
const DIG_HEADING = Math.atan2(33.27 - 18, -12.68 - 2);

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "travel",
    title: "1. 주행",
    instruction: "전진/후진/회전 연습",
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
    instruction: "붐 올리고 내리기",
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
    instruction: "암 접고 뻗기",
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
    id: "swing",
    title: "4. 상부회전",
    instruction: "좌우 90도 회전",
    highlight: "left",
    allowed: {
      leftX: true,
      leftY: false,
      rightX: false,
      rightY: false,
      travel: false,
    },
    unlockLevel: 1,
    reward: TUTORIAL_REWARDS.swing,
    region: "dig",
  },
  {
    id: "bucket",
    title: "5. 버켓",
    instruction: "흙 적재 후 하역",
    highlight: "both",
    allowed: { ...ALL_CONTROLS },
    startPose: { x: 18, z: 2, heading: DIG_HEADING },
    startAttachment: "bucket",
    waypoint: { x: 18, z: 2, radius: 12 },
    unlockLevel: 1,
    reward: TUTORIAL_REWARDS.bucket,
    region: "dig",
  },
  {
    id: "breaker",
    title: "6. 브레이커",
    instruction: "아스팔트 파쇄",
    highlight: "breaker",
    allowed: { ...ALL_CONTROLS },
    startAttachment: "breaker",
    startPose: { x: 96, z: 12, heading: Math.PI / 2 },
    unlockLevel: PLAYER_UNLOCKS.BREAKER,
    reward: TUTORIAL_REWARDS.breaker,
    region: "crash",
  },
  {
    id: "grapple",
    title: "7. 집게",
    instruction: "돌 집어 하역",
    highlight: "breaker",
    allowed: { ...ALL_CONTROLS },
    startAttachment: "grapple",
    startPose: { x: 22, z: 98, heading: 0 },
    unlockLevel: PLAYER_UNLOCKS.GRAPPLE,
    reward: TUTORIAL_REWARDS.grapple,
    region: "hill",
  },
  {
    id: "blade",
    title: "8. 블레이드",
    instruction: "블레이드 내리고 전진",
    highlight: "blade",
    allowed: {
      leftX: false,
      leftY: false,
      rightX: false,
      rightY: false,
      travel: true,
    },
    startPose: {
      x: SITE_LAYOUT.flood[0],
      z: SITE_LAYOUT.flood[1],
      heading: 0,
    },
    unlockLevel: PLAYER_UNLOCKS.FLOOD_RECOVERY,
    reward: TUTORIAL_REWARDS.blade,
    region: "flood",
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

export function getTutorialStepIndex(stepId: TutorialStepId): number {
  return TUTORIAL_STEPS.findIndex((step) => step.id === stepId);
}

/** Whether the player is inside a tutorial offer region (ignores zone "active"). */
export function isInTutorialRegion(
  region: TutorialRegionId,
  terrain: TerrainData,
  wx: number,
  wz: number,
): boolean {
  switch (region) {
    case "dig":
      return (
        isInsideDigZoneBounds(terrain, wx, wz) || isInDigZone(wx, wz, terrain)
      );
    case "crash": {
      const zone = terrain.crashZone;
      if (!zone) return false;
      return (
        Math.abs(wx - zone.centerX) <= zone.width / 2 &&
        Math.abs(wz - zone.centerZ) <= zone.depth / 2
      );
    }
    case "hill": {
      const zone = terrain.hillZone;
      if (!zone) return false;
      return Math.hypot(wx - zone.centerX, wz - zone.centerZ) <= zone.radius + 8;
    }
    case "flood": {
      const zone = terrain.floodZone;
      if (!zone) return false;
      return (
        Math.hypot(wx - zone.centerX, wz - zone.centerZ) <= zone.radius + 10
      );
    }
    default:
      return false;
  }
}

/**
 * First unlocked, incomplete tutorial for this region (list order).
 * Skips already-completed steps so re-entry can offer the next one.
 */
export function findRegionTutorialOffer(
  region: TutorialRegionId,
  playerLevel: number,
  tutorial: YanmarTutorialState,
): TutorialStep | null {
  const completed = new Set(tutorial.completed);
  for (const step of TUTORIAL_STEPS) {
    if (step.region !== region) continue;
    if (!isTutorialStepUnlocked(step, playerLevel)) continue;
    if (completed.has(step.id)) continue;
    return step;
  }
  return null;
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
    swingOrigin: sim.swing,
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

function travelMeterLabel(dist: number, target = TRAVEL_METERS) {
  const shown = Math.min(target, Math.floor(dist * 10) / 10);
  return `${shown.toFixed(1)} / ${target}m`;
}

/** Fold (min) then extend (max), 1 full cycle. */
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
      if (progress.cycleCount >= 1) return true;
      advancePhase(progress);
    }
  }
  return false;
}

/**
 * Boom lower first (stick up / joint max, or ground stop), then raise (stick
 * down / joint min). Ground blocks boom.max, so tip contact counts as lowered.
 */
function advanceBoomCycles(
  progress: TutorialPhaseProgress,
  sim: ExcavatorSimState,
  extras: TutorialTickExtras,
): boolean {
  const stickLower = extras.input.right.y > LEVER_ON;
  const stickRaise = extras.input.right.y < -LEVER_ON;
  const atLower =
    atJointMax(sim.boom, JOINT_LIMITS.boom.max) || extras.tipTouchingGround;
  const atRaise = atJointMin(sim.boom, JOINT_LIMITS.boom.min);

  if (!progress.cycleSeekingHigh) {
    if (stickLower && atLower) {
      progress.cycleSeekingHigh = true;
      progress.cycleArmed = false;
      advancePhase(progress);
    }
  } else if (stickRaise && atRaise) {
    progress.cycleCount += 1;
    progress.cycleSeekingHigh = false;
    progress.cycleArmed = false;
    if (progress.cycleCount >= 1) return true;
    advancePhase(progress);
  }
  return false;
}

/**
 * House swing: left stick left → +swing (90°), then stick right back to origin.
 * Travel is disabled so drive-align does not zero swing mid-lesson.
 */
function advanceSwingCycles(
  progress: TutorialPhaseProgress,
  sim: ExcavatorSimState,
  extras: TutorialTickExtras,
): boolean {
  const delta = normalizeAngle(sim.swing - progress.swingOrigin);
  const stickLeft = extras.input.left.x < -LEVER_ON;
  const stickRight = extras.input.left.x > LEVER_ON;

  if (progress.phase === 0) {
    if (stickLeft && delta >= SWING_QUARTER - SWING_EPS) {
      advancePhase(progress);
    }
    return false;
  }

  if (stickRight && Math.abs(delta) <= SWING_EPS) {
    return true;
  }
  return false;
}

function advanceBladeCycles(
  progress: TutorialPhaseProgress,
  extras: TutorialTickExtras,
  dist: number,
): boolean {
  const travel = extras.input.travel;
  const bothFwd = travel.left > LEVER_ON && travel.right > LEVER_ON;
  const bladeDown = extras.blade >= BLADE_DOWN_EPS;
  const bladeUp = extras.blade <= BLADE_RAISED + BLADE_UP_EPS;

  if (progress.phase === 0) {
    if (bladeDown) advancePhase(progress);
    return false;
  }
  if (progress.phase === 1) {
    if (!bladeDown) {
      // Raised mid-push — restart the drive segment.
      progress.travelDist = 0;
      return false;
    }
    if (bothFwd) progress.travelDist += dist;
    if (progress.travelDist >= BLADE_TRAVEL_METERS) {
      advancePhase(progress);
    }
    return false;
  }
  return bladeUp;
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
      if (progress.cycleCount >= 1) return "붐 완료!";
      return progress.cycleSeekingHigh
        ? "우 조이스틱을 아래로 당겨 붐을 최대로 올리세요"
        : "우 조이스틱을 위로 밀어 붐을 최대로 내리세요";
    case "arm":
      if (progress.cycleCount >= 1) return "암 완료!";
      return progress.cycleSeekingHigh
        ? "좌 조이스틱 앞 — 암을 최대로 뻗으세요"
        : "좌 조이스틱 뒤 — 암을 최대로 접으세요";
    case "swing":
      return progress.phase === 0
        ? "좌 조이스틱을 왼쪽으로 — 상부를 좌측 90도까지 돌리세요"
        : "좌 조이스틱을 오른쪽으로 — 상부를 제자리로 돌리세요";
    case "bucket":
      switch (progress.phase) {
        case 0:
          return "흙더미에서 버켓을 땅에 대고, 우 조이스틱 좌측으로 말아 흙을 담으세요";
        case 1:
          return "우 조이스틱 좌측으로 버켓을 더 말아 적재를 늘리세요";
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
    case "blade":
      switch (progress.phase) {
        case 0:
          return "기능 메뉴의 블레이드 레버를 밀어 블레이드를 최대로 내리세요";
        case 1:
          return `블레이드를 내린 채로 전진하세요 ${travelMeterLabel(progress.travelDist, BLADE_TRAVEL_METERS)}`;
        default:
          return "블레이드 레버를 당겨 블레이드를 올리세요";
      }
    default:
      return step.instruction;
  }
}

export function getTutorialWaypoint(
  step: TutorialStep,
  progress: TutorialPhaseProgress,
): TutorialWaypoint | undefined {
  // 버켓: 적재 중에는 흙더미 중심 거리(예: 10m)를 띄우지 않는다.
  // 하역장으로 이동할 때만 웨이포인트/거리를 표시한다.
  if (step.id === "bucket") {
    return progress.phase >= 3 ? DUMP_WP : undefined;
  }
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
    case "swing":
      return 2;
    case "blade":
      return 3;
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
      return completedPhase % 2 === 0 ? "붐 하강 성공!" : "붐 상승 성공!";
    case "arm":
      return completedPhase % 2 === 0 ? "암 접기 성공!" : "암 뻗기 성공!";
    case "swing":
      return completedPhase === 0 ? "좌측 90도 성공!" : "제자리 복귀 성공!";
    case "blade":
      return (
        ["블레이드 하강!", "전진 10m 완료!", "블레이드 상승!"][
          completedPhase
        ] ?? "성공!"
      );
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
      return advanceBoomCycles(progress, sim, extras);
    case "arm":
      return advanceJointCycles(
        progress,
        atJointMin(sim.arm, JOINT_LIMITS.arm.min),
        atJointMax(sim.arm, JOINT_LIMITS.arm.max),
      );
    case "swing":
      return advanceSwingCycles(progress, sim, extras);
    case "blade":
      return advanceBladeCycles(progress, extras, dist);
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
    default:
      return false;
  }
}

export { ALL_CONTROLS };
