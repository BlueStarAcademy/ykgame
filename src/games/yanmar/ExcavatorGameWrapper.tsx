"use client";

/* eslint-disable react-hooks/immutability, react-hooks/refs, react-hooks/preserve-manual-memoization, react-hooks/set-state-in-effect */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import {
  GAME_IMMERSIVE_HEADER_LEFT_ID,
  GAME_IMMERSIVE_HEADER_RIGHT_ID,
} from "@/components/games/GameImmersiveOverlay";
import { StarAmount } from "@/components/StarAmount";
import type { GameResult } from "@/games/shared/types";
import { getMissionConfig } from "@/games/registry";
import type { AuxiliaryControlState, ControlMask, ExcavatorControlState } from "./controls";
import {
  COCKPIT_LAYOUT,
  LOCKED_CONTROLS,
  createAuxiliaryControls,
  filterInput,
  mergeControlInputs,
  cancelAutoArmPose,
  hasManualControlInput,
} from "./controls";
import { CockpitOverlay } from "./CockpitOverlay";
import {
  ExcavatorScene,
  createInitialSim,
  createInitialTerrain,
} from "./ExcavatorScene";
import type {
  AttachmentType,
  CameraMode,
  CouponDiscoveryState,
  DumpScorePopup,
  DumpScorePanelState,
  ExcavatorSimState,
  AutoPoseSlotIndex,
  AutoPoseState,
} from "./types";
import { EquipmentUpgradePanel } from "./EquipmentUpgradePanel";
import {
  createHydraulicVelocity,
  createAutoPoseState,
  startAutoArmPose,
  type HydraulicVelocity,
} from "./controls";
import { ExcavatorMinimap } from "./ExcavatorMinimap";
import { DigPoseGraph, GrappleGripGauge } from "./DigHintPanel";
import { DumpHintPanel } from "./DumpHintPanel";
import { ControlsGuidePanel } from "./ControlsGuidePanel";
import { YanmarGameSettingsMenu } from "./YanmarGameSettingsMenu";
import { QuestPanel } from "./QuestPanel";
import {
  applyQuestProgress,
  claimCurrentMission,
  claimDailyQuest,
  loadQuestState,
  questClaimEventId,
  saveQuestState,
  type YanmarQuestState,
} from "./quests/questState";
import type { QuestMetric } from "./quests/types";
import { createDigFeedback, type DigFeedback } from "./bucket";
import {
  loadDumpTruckCooldown,
  saveDumpTruckCooldown,
} from "./dumpTruckPersistence";
import {
  applyGameSessionTerrain,
  loadYanmarGameSession,
  saveYanmarGameSession,
  type YanmarGameSessionSnapshot,
} from "./gameSessionPersistence";
import {
  loadAutoPoseSlotsForSession,
  resolveAutoPoseStorageOwner,
  saveSavedArmPoseSlot,
  saveSavedArmPoseSlots,
} from "./autoPosePersistence";
import {
  loadAuxiliarySettingsForSession,
  resolveAuxiliarySettingsOwner,
  saveAuxiliarySettings,
} from "./auxiliarySettingsPersistence";
import {
  createDumpTruckState,
  formatDumpTruckReturnTime,
  getDumpTruckPose,
  type DumpTruckPose,
} from "./dumpTruckState";
import { expandTerrainForLevel, type TerrainData } from "./terrain";
import {
  DEFAULT_YANMAR_EQUIPMENT_LEVELS,
  YANMAR_EQUIPMENT_RESET_REFUND_RATE,
  YANMAR_EQUIPMENT_CONFIG,
  YANMAR_REWARD_CONFIG,
  YANMAR_CRASH_REWARD_CONFIG,
  YANMAR_HILL_REWARD_CONFIG,
  calculateYanmarCrashScore,
  calculateYanmarHillScore,
  calculateYanmarEquipmentStats,
  getLoadUnits,
  getYanmarPartResetRefundStars,
  getYanmarUpgradeCost,
  rollYanmarHillXp,
  type YanmarEquipmentLevels,
  type YanmarEquipmentPart,
  type YanmarEquipmentStats,
} from "./equipment";
import {
  createScoreState,
  getProgress,
  isComplete,
  isTimeUp,
  tickTimer,
  type DiggingScoreState,
} from "./scoring";
import {
  ALL_CONTROLS,
  checkTutorialStepComplete,
  TUTORIAL_STEPS,
  waypointDistance,
  type GameMode,
  type TutorialStep,
} from "./tutorial";
import {
  getYanmarCouponImage,
  getYanmarCouponLabel,
} from "./rewardVisualConfig";
import { XpProgressBar } from "@/components/ui/XpProgressBar";
import { formatXpProgress, getPlayerLevelProgress } from "@/lib/playerLevel";
import {
  getCrossedUnlocks,
  getUnseenUnlocksForLevel,
  hasSeenPlayerUnlock,
  isAttachmentUnlocked,
  markPlayerUnlockSeen,
  PRACTICE_FULL_UNLOCK_LEVEL,
  type PlayerUnlockKind,
} from "@/lib/playerUnlocks";

interface ExcavatorGameWrapperProps {
  onEnd: (result: GameResult) => void;
  exitSignal?: number;
  resumeSignal?: number;
  scoreCommit?: { id: number; score: number } | null;
  immersive?: boolean;
  initialPlayMode?: "practice" | "game" | "ride";
  onShowRanking?: () => void;
  /** Season total before this session; HUD shows base + session score in game mode. */
  seasonScoreBase?: number;
}

type DumpRewardApiEvent =
  | {
      kind: "coupon";
      score: number;
      critical: boolean;
      couponType: "YK_PARTS_DISCOUNT" | "EQUIPMENT_RENTAL_DISCOUNT" | "FILTER_SET_EXCHANGE";
      discountPct: number;
    }
  | {
      kind: "stars";
      score: number;
      critical: boolean;
      stars: number;
    };

function resetSim(sim: import("./types").ExcavatorSimState, vel: HydraulicVelocity) {
  const init = createInitialSim();
  Object.assign(sim, init);
  Object.assign(vel, createHydraulicVelocity());
}

function TutorialSelectModal({
  open,
  activeId,
  onClose,
  onSelect,
  onFreePlay,
}: {
  open: boolean;
  activeId: string | null;
  onClose: () => void;
  onSelect: (index: number) => void;
  onFreePlay: () => void;
}) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm landscape:items-start landscape:overflow-y-auto landscape:py-2">
      <div className="flex max-h-[min(92dvh,40rem)] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl landscape:max-h-[min(94dvh,22rem)]">
        <div className="shrink-0 bg-gradient-to-br from-red-600 to-red-800 px-4 py-3 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-widest opacity-80">Practice</p>
          <h2 className="mt-1 text-base font-black">튜토리얼 선택</h2>
          <p className="mt-1 text-[11px] opacity-85">원하는 조작만 골라서 연습할 수 있습니다.</p>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3 [-webkit-overflow-scrolling:touch] [touch-action:pan-y]">
          <button
            type="button"
            onClick={onFreePlay}
            className={`w-full rounded-xl border px-3 py-2 text-left text-xs font-bold ${
              activeId == null
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            자유동작
            <span className="mt-0.5 block text-[10px] font-medium text-gray-500">
              브레이커·집게·전체 맵 포함, 모든 기능을 자유롭게 사용
            </span>
          </button>
          {TUTORIAL_STEPS.map((step, index) => (
            <button
              key={step.id}
              type="button"
              onClick={() => onSelect(index)}
              className={`w-full rounded-xl border px-3 py-2 text-left text-xs ${
                activeId === step.id
                  ? "border-amber-300 bg-amber-50 text-amber-800"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className="font-bold">{step.title}</span>
              <span className="mt-0.5 block text-[10px] leading-tight text-gray-500">
                {step.instruction}
              </span>
            </button>
          ))}
        </div>
        <div className="shrink-0 border-t border-gray-100 p-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-gray-200 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

const DUMP_SCORE_PANEL_DURATION_MS = 9500;
const COUPON_DISCOVERY_DURATION_MS = 8200;

function appendRewardText(previous: string, next: string) {
  if (!next) return previous;
  if (!previous) return next;
  return `${previous} · ${next}`;
}

function crashHpBarColor(ratio: number) {
  if (ratio > 0.5) return "bg-emerald-400";
  if (ratio > 0.25) return "bg-orange-400";
  return "bg-red-500";
}

function CrashAsphaltHpPanel({
  hp,
  maxHp,
  hitTick,
  hitDamage,
}: {
  hp: number;
  maxHp: number;
  hitTick: number;
  hitDamage: number;
}) {
  const safeMax = Math.max(1, maxHp);
  const ratio = Math.max(0, Math.min(1, hp / safeMax));
  const pct = Math.round(ratio * 100);

  return (
    <div className="relative w-[11.5rem] rounded-xl border border-white/20 bg-black/55 px-3 py-2 shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white/70">
          아스팔트
        </span>
        <span className="text-[10px] font-black tabular-nums text-white">
          ({Math.round(hp).toLocaleString()}
          <span className="text-white/45">/{safeMax.toLocaleString()}</span>)
        </span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/15">
        <div
          className={`h-full rounded-full transition-[width] duration-100 ease-out ${crashHpBarColor(ratio)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {hitTick > 0 && hitDamage > 0 ? (
        <span
          key={hitTick}
          className="yanmar-crash-hit-float pointer-events-none absolute -right-1 top-0 text-xs font-black text-amber-200"
        >
          -{hitDamage}
        </span>
      ) : null}
    </div>
  );
}

function rollOptimisticStarReward(
  minStars: number = YANMAR_REWARD_CONFIG.minStarReward,
  maxStars: number = YANMAR_REWARD_CONFIG.maxStarReward,
) {
  return Math.floor(Math.random() * (maxStars - minStars + 1)) + minStars;
}

function rollLocalCrashReward(stats: YanmarEquipmentStats) {
  const critical = Math.random() < stats.criticalChance;
  return {
    score: calculateYanmarCrashScore(stats, critical),
    critical,
    stars: rollOptimisticStarReward(
      YANMAR_CRASH_REWARD_CONFIG.minStarReward,
      YANMAR_CRASH_REWARD_CONFIG.maxStarReward,
    ),
  };
}

function rollLocalHillReward(stats: YanmarEquipmentStats) {
  const critical = Math.random() < stats.criticalChance;
  return {
    score: calculateYanmarHillScore(stats, critical),
    critical,
    stars: rollOptimisticStarReward(
      YANMAR_HILL_REWARD_CONFIG.minStarReward,
      YANMAR_HILL_REWARD_CONFIG.maxStarReward,
    ),
  };
}

function RewardPopupOverlay({ panel }: { panel: DumpScorePanelState | null }) {
  if (!panel) return null;

  return (
    <div className="pointer-events-none absolute left-1/2 top-[4.25rem] z-50 w-[min(22rem,92vw)] -translate-x-1/2">
      <div
        key={panel.pulseKey}
        className={`yanmar-score-panel rounded-xl border px-3.5 py-2 font-black shadow-xl backdrop-blur-md ${
          panel.critical
            ? "border-yellow-200/70 bg-black/80 text-yellow-300"
            : "border-white/25 bg-black/78 text-slate-200"
        }`}
      >
        <div
          className={`yanmar-score-panel-value flex items-center justify-center gap-2.5 whitespace-nowrap tabular-nums ${
            panel.critical ? "text-sm" : "text-xs"
          }`}
        >
          <span>{panel.totalScore.toLocaleString()}점</span>
          <span className={panel.critical ? "text-yellow-200/80" : "text-white/35"} aria-hidden>
            ·
          </span>
          <span>EXP+{panel.earnedXp.toLocaleString()}</span>
          <span className={panel.critical ? "text-yellow-200/80" : "text-white/35"} aria-hidden>
            ·
          </span>
          <span className="inline-flex items-center gap-0.5">
            <img
              src="/images/star-currency.svg"
              alt=""
              width={14}
              height={14}
              className="yanmar-score-panel-star"
              draggable={false}
            />
            {panel.earnedStars.toLocaleString()}
          </span>
        </div>
        {panel.rewardText ? (
          <div className="yanmar-score-panel-reward mt-1 text-center text-[10px] font-bold text-white/90">
            {panel.rewardText}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CouponDiscoveryOverlay({ discovery }: { discovery: CouponDiscoveryState | null }) {
  if (!discovery) return null;

  const label = getYanmarCouponLabel(discovery.couponType);

  return (
    <div
      key={discovery.pulseKey}
      className="pointer-events-none absolute inset-x-0 top-[5.5rem] z-[58] flex justify-center px-3"
    >
      <div className="yanmar-coupon-discovery w-[min(18rem,92%)] rounded-2xl border-2 border-yellow-200/80 bg-gradient-to-b from-amber-500/95 via-orange-500/95 to-red-600/95 px-4 py-3 text-center text-white shadow-[0_0_32px_rgba(251,191,36,0.45)] backdrop-blur-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getYanmarCouponImage(discovery.couponType)}
          alt=""
          width={120}
          height={72}
          className="mx-auto h-[4.5rem] w-auto drop-shadow-lg"
          draggable={false}
          aria-hidden
        />
        <p className="mt-2 text-sm font-black tracking-tight text-yellow-50">축하합니다!</p>
        <p className="mt-1 text-[11px] font-bold leading-snug text-white">
          {discovery.couponType === "FILTER_SET_EXCHANGE"
            ? `${label}을 발견했습니다!!`
            : `${label} ${discovery.discountPct}% 할인 쿠폰을 발견했습니다!!`}
        </p>
      </div>
    </div>
  );
}

function AttachmentUnlockOverlay({
  unlock,
  onClose,
}: {
  unlock: PlayerUnlockKind | undefined;
  onClose: () => void;
}) {
  if (!unlock) return null;
  const breaker = unlock === "BREAKER";
  const level = breaker ? 10 : 15;
  const attachmentLabel = breaker ? "브레이커" : "집게";
  const zoneLabel = breaker ? "Crash 철거 작업장" : "Hill 운반 작업장";
  const machineSrc = breaker
    ? "/images/yanmar/2d/excavator-side-diagram-breaker.png"
    : "/images/yanmar/2d/excavator-side-diagram-grapple.png";
  const attachmentSrc = breaker
    ? "/images/yanmar/2d/attachments/breaker.png"
    : "/images/yanmar/2d/attachments/grapple.png";

  return (
    <div className="yanmar-unlock-overlay" role="presentation">
      <div
        className="yanmar-unlock-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`레벨 ${level} ${attachmentLabel} 및 신규 작업장 개방 안내`}
      >
        <div className="yanmar-unlock-panel-glow" aria-hidden />
        <div className="yanmar-unlock-panel-frame" aria-hidden />

        <header className="yanmar-unlock-brand">
          <span className="yanmar-unlock-brand-mark">YANMAR</span>
          <span className="yanmar-unlock-brand-rule" aria-hidden />
          <span className="yanmar-unlock-brand-sub">SV08-1 · WORKSITE UNLOCK</span>
        </header>

        <div className="yanmar-unlock-hero">
          <div className="yanmar-unlock-hero-stage">
            <img
              className="yanmar-unlock-machine"
              src={machineSrc}
              alt={`블레이드가 장착된 얀마 굴착기와 ${attachmentLabel}`}
              draggable={false}
            />
            <div className="yanmar-unlock-blade-sheen" aria-hidden />
            <div className="yanmar-unlock-attachment-orb">
              <img
                className="yanmar-unlock-attachment"
                src={attachmentSrc}
                alt={attachmentLabel}
                draggable={false}
              />
            </div>
          </div>
          <div className="yanmar-unlock-hero-fade" aria-hidden />
        </div>

        <div className="yanmar-unlock-body">
          <p className="yanmar-unlock-level">
            <span>LEVEL</span> {level}
          </p>
          <h2 className="yanmar-unlock-title">새로운 작업이 개방되었습니다</h2>
          <p className="yanmar-unlock-lead">
            {zoneLabel}과 {attachmentLabel} 장비가 해금되었습니다.
          </p>

          <ul className="yanmar-unlock-perks">
            <li>
              <span className="yanmar-unlock-perk-index">01</span>
              <div>
                <strong>{attachmentLabel} 장착</strong>
                <span>기능 메뉴에서 부착물을 교체할 수 있습니다</span>
              </div>
            </li>
            <li>
              <span className="yanmar-unlock-perk-index">02</span>
              <div>
                <strong>{zoneLabel}</strong>
                <span>전용 작업 구역으로 이동해 미션을 수행하세요</span>
              </div>
            </li>
          </ul>

          <button type="button" className="yanmar-unlock-cta" onClick={onClose}>
            <span>확인</span>
            <span className="yanmar-unlock-cta-shine" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ExcavatorGameWrapper({
  onEnd,
  exitSignal = 0,
  resumeSignal = 0,
  scoreCommit = null,
  immersive = false,
  initialPlayMode,
  onShowRanking,
  seasonScoreBase = 0,
}: ExcavatorGameWrapperProps) {
  const config = getMissionConfig("yanmar");
  const { data: session, status: sessionStatus, update } = useSession();
  const defaultEquipmentStats = calculateYanmarEquipmentStats(DEFAULT_YANMAR_EQUIPMENT_LEVELS);
  const [mode, setMode] = useState<GameMode>("intro");
  const [tutorialIndex, setTutorialIndex] = useState(0);
  const [input, setInput] = useState<ExcavatorControlState>({
    left: { x: 0, y: 0 },
    right: { x: 0, y: 0 },
    travel: { left: 0, right: 0 },
  });
  const touchInputRef = useRef<ExcavatorControlState>({
    left: { x: 0, y: 0 },
    right: { x: 0, y: 0 },
    travel: { left: 0, right: 0 },
  });
  const keyboardInputRef = useRef<ExcavatorControlState>({
    left: { x: 0, y: 0 },
    right: { x: 0, y: 0 },
    travel: { left: 0, right: 0 },
  });
  const [auxiliary, setAuxiliary] = useState<AuxiliaryControlState>(
    createAuxiliaryControls,
  );
  const autoPoseRef = useRef<AutoPoseState>(createAutoPoseState());
  const [autoPose, setAutoPose] = useState<AutoPoseState>(autoPoseRef.current);
  const [poseSaveToastKey, setPoseSaveToastKey] = useState(0);
  const [poseSaveToastVisible, setPoseSaveToastVisible] = useState(false);
  const [levelUpToast, setLevelUpToast] = useState<{
    key: number;
    level: number;
  } | null>(null);
  const [attachmentType, setAttachmentType] =
    useState<AttachmentType>("bucket");
  const [attachmentWarning, setAttachmentWarning] = useState<{
    key: number;
    message: string;
  } | null>(null);
  const [unlockQueue, setUnlockQueue] = useState<PlayerUnlockKind[]>([]);
  const unlockSeenOwnerRef = useRef("local");
  const unlockAnnouncedRef = useRef<Set<PlayerUnlockKind>>(new Set());
  const [terrainRevision, setTerrainRevision] = useState(0);
  const [savePoseCooldownUntil, setSavePoseCooldownUntil] = useState(0);
  const [executePoseCooldownUntil, setExecutePoseCooldownUntil] = useState(0);
  const poseSaveToastTimerRef = useRef<number | null>(null);
  const levelUpToastTimerRef = useRef<number | null>(null);
  const poseActionCooldownMs = 5000;
  const [hud, setHud] = useState({
    progress: 0,
    timeLeft: config.duration,
    bucketLoad: 0,
    goalDist: 0,
    boom: 0.45,
    arm: -0.95,
    bucket: 0.85,
    score: 0,
    dumpedUnits: 0,
  });
  const [dumpScorePanel, setDumpScorePanel] = useState<DumpScorePanelState | null>(null);
  const [couponDiscovery, setCouponDiscovery] = useState<CouponDiscoveryState | null>(null);
  const [equipmentLevels, setEquipmentLevels] = useState<YanmarEquipmentLevels>(
    DEFAULT_YANMAR_EQUIPMENT_LEVELS,
  );
  const [equipmentStats, setEquipmentStats] =
    useState<YanmarEquipmentStats>(defaultEquipmentStats);
  const [currency, setCurrency] = useState(() => session?.user?.currency ?? 0);
  const [totalXp, setTotalXp] = useState(() => session?.user?.totalXp ?? 0);
  const totalXpRef = useRef(totalXp);
  const attachmentWarningTimerRef = useRef<number | null>(null);
  const [previewStars, setPreviewStars] = useState(() => session?.user?.currency ?? 0);
  const [stepCompleteFlash, setStepCompleteFlash] = useState(false);
  const [showControlsGuide, setShowControlsGuide] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showDigPoseGraph, setShowDigPoseGraph] = useState(true);
  const [showTutorialMenu, setShowTutorialMenu] = useState(false);
  const [showQuestPanel, setShowQuestPanel] = useState(false);
  const [questState, setQuestState] = useState<YanmarQuestState | null>(null);
  const [questClaimingId, setQuestClaimingId] = useState<string | null>(null);
  const questStateRef = useRef<YanmarQuestState | null>(null);
  const questTrackRef = useRef({
    posX: 0,
    posZ: 0,
    swing: 0,
    swingAccum: 0,
    bucketLoad: 0,
    dumpTruckPhase: "" as string,
    haulTruckPhase: "" as string,
    grappleLiftTick: 0,
    ready: false,
  });
  const [showTouchZones, setShowTouchZones] = useState(false);
  const [showEquipmentUpgrade, setShowEquipmentUpgrade] = useState(false);
  const [upgradingPart, setUpgradingPart] = useState<YanmarEquipmentPart | null>(null);
  const [resettingEquipment, setResettingEquipment] = useState(false);
  const [headerHudReady, setHeaderHudReady] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>(
    initialPlayMode === "ride" ? 3 : 1,
  );
  const gameFrameStyle: CSSProperties | undefined = immersive
    ? {
        width: "100%",
        height: "100%",
      }
    : undefined;
  const endedRef = useRef(false);
  const elapsedRef = useRef(0);
  const tutorialDumpRef = useRef(0);
  const tutorialCrashHitsRef = useRef(0);
  const tutorialHillDeliverRef = useRef(0);
  const tutorialCompletingRef = useRef(false);
  const tutorialIndexRef = useRef(0);
  const digFeedbackRef = useRef<DigFeedback>(createDigFeedback());
  const [digFeedback, setDigFeedback] = useState<DigFeedback>(createDigFeedback());
  const dumpTruckStateRef = useRef(createDumpTruckState());
  const dumpTruckPoseRef = useRef<DumpTruckPose>(getDumpTruckPose(dumpTruckStateRef.current));
  const digHudTickRef = useRef(0);
  const lastSyncedCrashHitTickRef = useRef(0);
  const lastHudProgressRef = useRef(-1);
  const arcadeScoreRef = useRef(0);
  const rewardStarsRef = useRef(0);
  const currencyRef = useRef(session?.user?.currency ?? 0);
  const processedExitSignalRef = useRef(0);
  const processedScoreCommitRef = useRef(0);
  const dumpScorePanelRef = useRef<DumpScorePanelState | null>(null);
  const dumpScoreHideTimerRef = useRef<number | null>(null);
  const couponDiscoveryRef = useRef<CouponDiscoveryState | null>(null);
  const couponDiscoveryHideTimerRef = useRef<number | null>(null);
  const equipmentStatsRef = useRef<YanmarEquipmentStats>(defaultEquipmentStats);
  const dumpTruckUserIdRef = useRef<string | null>(null);
  const dumpTruckLastSavedAtRef = useRef(0);
  const gameSessionUserIdRef = useRef<string | null>(null);
  const gameSessionLastSavedAtRef = useRef(0);
  const gameSessionRestoredRef = useRef(false);
  const updateSessionRef = useRef(update);
  updateSessionRef.current = update;

  const persistDumpTruckCooldown = useCallback((force = false) => {
    const userId = dumpTruckUserIdRef.current;
    if (!userId) return;
    // Ranked game sessions own truck state via full session persistence.
    if (modeRef.current === "game") return;

    const now = Date.now();
    if (!force && now - dumpTruckLastSavedAtRef.current < 1000) return;
    dumpTruckLastSavedAtRef.current = now;
    saveDumpTruckCooldown(
      userId,
      dumpTruckStateRef.current,
      equipmentStatsRef.current.truckCooldownSec,
      now,
    );
  }, []);

  const persistGameSession = useCallback((force = false) => {
    const userId = gameSessionUserIdRef.current;
    if (!userId || modeRef.current !== "game") return;

    const now = Date.now();
    if (!force && now - gameSessionLastSavedAtRef.current < 1000) return;
    gameSessionLastSavedAtRef.current = now;
    const terrain = terrainRef.current;
    const truckState = dumpTruckStateRef.current;
    const cooldownSec = equipmentStatsRef.current.truckCooldownSec;
    saveYanmarGameSession(
      userId,
      {
        sim: { ...simRef.current },
        dumpTruck: { ...truckState },
        dumpTruckCooldownSec: cooldownSec,
        digZones: terrain.digZones,
        crashZone: terrain.crashZone,
        hillZone: terrain.hillZone,
        mapTier: terrain.mapTier,
        gridSizeX: terrain.gridSizeX,
        gridSizeZ: terrain.gridSizeZ,
        heights: Array.from(terrain.heights),
        baseHeights: Array.from(terrain.baseHeights),
        arcadeScore: arcadeScoreRef.current,
        dumped: scoreRef.current.dumped,
        rewardStars: rewardStarsRef.current,
      },
      now,
    );
    saveDumpTruckCooldown(userId, truckState, cooldownSec, now);
  }, []);

  const applyGameSnapshot = useCallback((snapshot: YanmarGameSessionSnapshot) => {
    Object.assign(simRef.current, snapshot.sim);
    Object.assign(velRef.current, createHydraulicVelocity());
    Object.assign(dumpTruckStateRef.current, snapshot.dumpTruck);
    dumpTruckPoseRef.current = getDumpTruckPose(dumpTruckStateRef.current);
    terrainRef.current = applyGameSessionTerrain(snapshot);
    setAttachmentType(snapshot.sim.attachmentType);
    setTerrainRevision((key) => key + 1);
    arcadeScoreRef.current = snapshot.arcadeScore;
    rewardStarsRef.current = snapshot.rewardStars;
    scoreRef.current = createScoreState(config.target, config.duration);
    scoreRef.current.dumped = snapshot.dumped;
    endedRef.current = false;
    elapsedRef.current = 0;
    lastHudProgressRef.current = -1;
    setHud((h) => ({
      ...h,
      boom: snapshot.sim.boom,
      arm: snapshot.sim.arm,
      bucket: snapshot.sim.bucket,
      bucketLoad: snapshot.sim.bucketLoad,
      score: snapshot.arcadeScore,
      dumpedUnits: Math.round(
        Math.max(0, snapshot.dumped) * equipmentStatsRef.current.maxLoadUnits,
      ),
      progress: getProgress(scoreRef.current),
      timeLeft: config.duration,
    }));
  }, [config.duration, config.target, setHud]);

  const syncDigHud = useCallback(() => {
    digHudTickRef.current += 1;
    const fb = digFeedbackRef.current;
    const crashHitChanged = fb.crashHitTick !== lastSyncedCrashHitTickRef.current;
    if (crashHitChanged && modeRef.current === "tutorial") {
      const delta = fb.crashHitTick - lastSyncedCrashHitTickRef.current;
      if (delta > 0) tutorialCrashHitsRef.current += delta;
    }
    if (digHudTickRef.current % 3 !== 0 && !crashHitChanged) return;
    lastSyncedCrashHitTickRef.current = fb.crashHitTick;
    setDigFeedback((prev) =>
      prev.inDigZone === fb.inDigZone &&
      prev.inDumpZone === fb.inDumpZone &&
      prev.tipOnGround === fb.tipOnGround &&
      prev.bucketCurled === fb.bucketCurled &&
      prev.canLoad === fb.canLoad &&
      Math.abs(prev.digZoneRemainingUnits - fb.digZoneRemainingUnits) < 1 &&
      prev.canStrike === fb.canStrike &&
      prev.breakerNeedsVertical === fb.breakerNeedsVertical &&
      prev.crashTileHp === fb.crashTileHp &&
      prev.crashTileMaxHp === fb.crashTileMaxHp &&
      prev.crashHitTick === fb.crashHitTick &&
      prev.canGrab === fb.canGrab &&
      prev.grappleNeedsAlignment === fb.grappleNeedsAlignment &&
      prev.canDropRock === fb.canDropRock &&
      prev.showGripGauge === fb.showGripGauge &&
      Math.abs(prev.gripAdhesion - fb.gripAdhesion) < 0.01 &&
      Math.abs(prev.gripPressure - fb.gripPressure) < 0.01 &&
      prev.grappleLiftResult === fb.grappleLiftResult &&
      prev.grappleLiftResultTick === fb.grappleLiftResultTick &&
      prev.digging === fb.digging &&
      Math.abs(prev.groundDepth - fb.groundDepth) < 0.05 &&
      prev.bucketOpenReady === fb.bucketOpenReady &&
      prev.insertedDeepEnough === fb.insertedDeepEnough &&
      prev.bucketCurlReady === fb.bucketCurlReady &&
      prev.armPulling === fb.armPulling &&
      prev.optimalDigPose === fb.optimalDigPose &&
      prev.canDump === fb.canDump &&
      prev.truckPresent === fb.truckPresent &&
      prev.truckCanAccept === fb.truckCanAccept &&
      Math.abs(prev.truckFillRatio - fb.truckFillRatio) < 0.02 &&
      Math.abs(prev.truckCooldownRemaining - fb.truckCooldownRemaining) < 0.15 &&
      prev.raiseArmForDump === fb.raiseArmForDump &&
      prev.travelBlockedRaiseArm === fb.travelBlockedRaiseArm &&
      Math.abs(prev.digPoseScore - fb.digPoseScore) < 0.01 &&
      Math.abs(prev.soilRetention - fb.soilRetention) < 0.02 &&
      prev.soilSpilling === fb.soilSpilling &&
      prev.digCooldowns.length === fb.digCooldowns.length &&
      prev.digCooldowns.every(
        (item, i) =>
          item.id === fb.digCooldowns[i]?.id &&
          Math.abs(item.etaSec - (fb.digCooldowns[i]?.etaSec ?? 0)) < 0.15,
      )
        ? prev
        : { ...fb, digCooldowns: fb.digCooldowns.map((item) => ({ ...item })) },
    );
    setHud((h) => {
      const boom = simRef.current.boom;
      const arm = simRef.current.arm;
      const bucket = simRef.current.bucket;
      const bucketLoad = simRef.current.bucketLoad;
      if (
        Math.abs(h.boom - boom) < 0.01 &&
        Math.abs(h.arm - arm) < 0.01 &&
        Math.abs(h.bucket - bucket) < 0.01 &&
        Math.abs(h.bucketLoad - bucketLoad) < 0.005
      ) {
        return h;
      }
      return { ...h, boom, arm, bucket, bucketLoad };
    });
    setAutoPose((prev) =>
      prev.executing === autoPoseRef.current.executing ? prev : { ...autoPoseRef.current },
    );
  }, [setDigFeedback, setHud]);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    const userId = session?.user?.id ?? null;
    if (userId) {
      dumpTruckUserIdRef.current = userId;
      gameSessionUserIdRef.current = userId;
    }

    const savedAuxiliary = loadAuxiliarySettingsForSession(userId);
    if (savedAuxiliary) {
      const restoredAuxiliary = {
        ...auxiliaryRef.current,
        ...savedAuxiliary,
        attachmentPedal: 0 as const,
      };
      auxiliaryRef.current = restoredAuxiliary;
      setAuxiliary(restoredAuxiliary);
    }

    const savedSlots = loadAutoPoseSlotsForSession(userId);
    autoPoseRef.current.slots = [savedSlots[0], savedSlots[1]];
    autoPoseRef.current.saved = savedSlots[autoPoseRef.current.activeSlot];
    // 실행 중이면 유지하고, 아니면 저장된 슬롯만 복원한다.
    if (!autoPoseRef.current.executing) {
      autoPoseRef.current.phase = null;
    }
    setAutoPose({
      ...autoPoseRef.current,
      slots: [...autoPoseRef.current.slots],
    });

    if (userId && modeRef.current === "game" && !gameSessionRestoredRef.current) {
      const snapshot = loadYanmarGameSession(userId);
      gameSessionRestoredRef.current = true;
      if (snapshot) applyGameSnapshot(snapshot);
    } else if (userId && modeRef.current !== "game" && !gameSessionRestoredRef.current) {
      const restored = loadDumpTruckCooldown(userId);
      if (restored) {
        Object.assign(dumpTruckStateRef.current, restored);
        dumpTruckPoseRef.current = getDumpTruckPose(dumpTruckStateRef.current);
      }
    }

    return () => {
      persistGameSession(true);
      persistDumpTruckCooldown(true);
      const ownerId = resolveAutoPoseStorageOwner(
        session?.user?.id ?? gameSessionUserIdRef.current,
      );
      saveSavedArmPoseSlots(ownerId, autoPoseRef.current.slots);
      saveAuxiliarySettings(
        resolveAuxiliarySettingsOwner(
          session?.user?.id ?? gameSessionUserIdRef.current,
        ),
        auxiliaryRef.current,
      );
      if (!session?.user?.id) {
        dumpTruckUserIdRef.current = null;
        gameSessionUserIdRef.current = null;
      }
    };
  }, [
    applyGameSnapshot,
    persistDumpTruckCooldown,
    persistGameSession,
    session?.user?.id,
    sessionStatus,
  ]);

  useEffect(() => {
    const saveBeforeLeaving = () => {
      persistGameSession(true);
      persistDumpTruckCooldown(true);
      const ownerId = resolveAutoPoseStorageOwner(
        session?.user?.id ?? gameSessionUserIdRef.current,
      );
      saveSavedArmPoseSlots(ownerId, autoPoseRef.current.slots);
      saveAuxiliarySettings(
        resolveAuxiliarySettingsOwner(
          session?.user?.id ?? gameSessionUserIdRef.current,
        ),
        auxiliaryRef.current,
      );
    };
    window.addEventListener("pagehide", saveBeforeLeaving);
    return () => window.removeEventListener("pagehide", saveBeforeLeaving);
  }, [persistDumpTruckCooldown, persistGameSession, session?.user?.id]);

  const syncMergedInput = useCallback(() => {
    setInput(
      filterInput(
        mergeControlInputs(touchInputRef.current, keyboardInputRef.current),
        allowedRef.current,
      ),
    );
  }, []);

  const clearAllInput = useCallback(() => {
    const zero = {
      left: { x: 0, y: 0 },
      right: { x: 0, y: 0 },
      travel: { left: 0, right: 0 },
    };
    touchInputRef.current = zero;
    keyboardInputRef.current = zero;
    setInput(zero);
  }, []);

  const inputRef = useRef(input);

  const modeRef = useRef<GameMode>(mode);

  const simRef = useRef<ExcavatorSimState>(createInitialSim());
  const velRef = useRef<HydraulicVelocity>(createHydraulicVelocity());
  const terrainRef = useRef<TerrainData>(createInitialTerrain());
  const scoreRef = useRef<DiggingScoreState>(
    createScoreState(config.target, config.duration),
  );

  const tutorialStep: TutorialStep | null =
    mode === "tutorial" ? TUTORIAL_STEPS[tutorialIndex] ?? null : null;

  const tutorialStepRef = useRef<TutorialStep | null>(tutorialStep);

  const baseAllowed: ControlMask =
    mode === "gameReady"
      ? LOCKED_CONTROLS
      : mode === "tutorial"
        ? (tutorialStep?.allowed ?? ALL_CONTROLS)
        : ALL_CONTROLS;
  const allowed: ControlMask = auxiliary.safetyLocked ? LOCKED_CONTROLS : baseAllowed;

  const allowedRef = useRef<ControlMask>(allowed);

  const auxiliaryRef = useRef<AuxiliaryControlState>(auxiliary);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    equipmentStatsRef.current = equipmentStats;
  }, [equipmentStats]);

  const showPoseSaveToast = useCallback(() => {
    if (poseSaveToastTimerRef.current != null) {
      window.clearTimeout(poseSaveToastTimerRef.current);
    }
    setPoseSaveToastKey((key) => key + 1);
    setPoseSaveToastVisible(true);
    poseSaveToastTimerRef.current = window.setTimeout(() => {
      setPoseSaveToastVisible(false);
      poseSaveToastTimerRef.current = null;
    }, 2100);
  }, []);

  const showLevelUpToast = useCallback((level: number) => {
    if (levelUpToastTimerRef.current != null) {
      window.clearTimeout(levelUpToastTimerRef.current);
    }
    setLevelUpToast((prev) => ({
      key: (prev?.key ?? 0) + 1,
      level,
    }));
    levelUpToastTimerRef.current = window.setTimeout(() => {
      setLevelUpToast(null);
      levelUpToastTimerRef.current = null;
    }, 2800);
  }, []);

  const showAttachmentWarning = useCallback((message: string) => {
    if (attachmentWarningTimerRef.current != null) {
      window.clearTimeout(attachmentWarningTimerRef.current);
    }
    setAttachmentWarning((current) => ({
      key: (current?.key ?? 0) + 1,
      message,
    }));
    attachmentWarningTimerRef.current = window.setTimeout(() => {
      setAttachmentWarning(null);
      attachmentWarningTimerRef.current = null;
    }, 2400);
  }, []);

  const practiceUnlocksAll =
    mode === "practice" || mode === "tutorial";

  const handleAttachmentChange = useCallback(
    (next: AttachmentType) => {
      const unlockAll =
        modeRef.current === "practice" || modeRef.current === "tutorial";
      const playerLevel = getPlayerLevelProgress(totalXpRef.current).level;
      if (!isAttachmentUnlocked(next, playerLevel, { unlockAll })) {
        showAttachmentWarning(
          next === "breaker"
            ? "브레이커는 유저 레벨 10에 개방됩니다."
            : "집게는 유저 레벨 15에 개방됩니다.",
        );
        return;
      }
      if (simRef.current.bucketLoad > 0.01 && next !== "bucket") {
        showAttachmentWarning("버켓에 흙이 남아 있어 다른 부착물로 전환할 수 없습니다.");
        return;
      }
      simRef.current.attachmentType = next;
      simRef.current.carriedBoulderId = null;
      setAttachmentType(next);
    },
    [showAttachmentWarning],
  );

  const enqueueUnlockNotices = useCallback((kinds: PlayerUnlockKind[]) => {
    const ownerId = unlockSeenOwnerRef.current;
    const fresh = kinds.filter((kind) => {
      if (unlockAnnouncedRef.current.has(kind)) return false;
      if (hasSeenPlayerUnlock(ownerId, kind)) return false;
      return true;
    });
    if (fresh.length === 0) return;
    for (const kind of fresh) {
      unlockAnnouncedRef.current.add(kind);
      // Mark as soon as we decide to show — prevents reappearing on every reconnect.
      markPlayerUnlockSeen(ownerId, kind);
    }
    setUnlockQueue((queue) => [
      ...queue,
      ...fresh.filter((kind) => !queue.includes(kind)),
    ]);
  }, []);

  const applyTotalXp = useCallback(
    (nextXp: number, opts?: { announceLevelUp?: boolean }) => {
      const prevLevel = getPlayerLevelProgress(totalXpRef.current).level;
      const nextLevel = getPlayerLevelProgress(nextXp).level;
      totalXpRef.current = nextXp;
      setTotalXp(nextXp);
      const previousTier = terrainRef.current.mapTier;
      terrainRef.current = expandTerrainForLevel(terrainRef.current, nextLevel);
      if (terrainRef.current.mapTier !== previousTier) {
        setTerrainRevision((key) => key + 1);
      }
      if (opts?.announceLevelUp && nextLevel > prevLevel) {
        showLevelUpToast(nextLevel);
        enqueueUnlockNotices(getCrossedUnlocks(prevLevel, nextLevel));
      }
    },
    [enqueueUnlockNotices, showLevelUpToast],
  );

  const pushQuestProgress = useCallback(
    (metric: QuestMetric, amount: number) => {
      if (amount <= 0) return;
      if (modeRef.current === "intro" || modeRef.current === "ride") return;
      const current = questStateRef.current;
      if (!current) return;
      const next = applyQuestProgress(current, { metric, amount });
      if (next === current) return;
      questStateRef.current = next;
      setQuestState(next);
      saveQuestState(next);
    },
    [],
  );

  useEffect(() => {
    if (sessionStatus === "loading") return;
    const ownerId = session?.user?.id ?? "local";
    const level = getPlayerLevelProgress(
      session?.user?.totalXp ?? totalXpRef.current,
    ).level;
    const loaded = loadQuestState(ownerId, level);
    questStateRef.current = loaded;
    setQuestState(loaded);
    questTrackRef.current.ready = false;
  }, [session?.user?.id, session?.user?.totalXp, sessionStatus]);

  useEffect(() => {
    if (mode === "intro" || mode === "ride" || mode === "gameReady") return;
    if (!session?.user?.id) return;
    pushQuestProgress("login", 1);
  }, [mode, pushQuestProgress, session?.user?.id]);

  const grantQuestReward = useCallback(
    async (opts: {
      eventId: string;
      stars: number;
      xp: number;
      label: string;
    }) => {
      if (session?.user?.id) {
        const res = await fetch("/api/rewards/yanmar-quest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(opts),
        });
        if (res.status === 409) return true;
        if (!res.ok) throw new Error("quest claim failed");
        const data = (await res.json()) as {
          currency?: number;
          totalXp?: number;
        };
        if (typeof data.currency === "number") {
          currencyRef.current = data.currency;
          setCurrency(data.currency);
          setPreviewStars(data.currency);
          void updateSessionRef.current({ user: { currency: data.currency } });
        }
        if (typeof data.totalXp === "number") {
          applyTotalXp(data.totalXp, { announceLevelUp: true });
          void updateSessionRef.current({ user: { totalXp: data.totalXp } });
        }
        return true;
      }

      if (opts.stars > 0) {
        setPreviewStars((value) => value + opts.stars);
      }
      if (opts.xp > 0) {
        applyTotalXp(totalXpRef.current + opts.xp, { announceLevelUp: true });
      }
      return true;
    },
    [applyTotalXp, session?.user?.id],
  );

  const handleClaimDailyQuest = useCallback(
    async (questId: string) => {
      const current = questStateRef.current;
      if (!current || questClaimingId) return;
      const claimed = claimDailyQuest(current, questId);
      if (!claimed) return;
      setQuestClaimingId(`daily:${questId}`);
      try {
        await grantQuestReward({
          eventId: questClaimEventId("daily", current.dayKey, questId),
          stars: claimed.reward.stars,
          xp: claimed.reward.xp,
          label: `일일:${questId}`,
        });
        questStateRef.current = claimed.state;
        setQuestState(claimed.state);
        saveQuestState(claimed.state);
      } catch {
        showAttachmentWarning("퀘스트 보상 수령에 실패했습니다.");
      } finally {
        setQuestClaimingId(null);
      }
    },
    [grantQuestReward, questClaimingId, showAttachmentWarning],
  );

  const handleClaimMissionQuest = useCallback(async () => {
    const current = questStateRef.current;
    if (!current || questClaimingId) return;
    const claimed = claimCurrentMission(current);
    if (!claimed) return;
    setQuestClaimingId("mission");
    try {
      await grantQuestReward({
        eventId: questClaimEventId(
          "mission",
          current.dayKey,
          `round-${claimed.roundIndex}`,
        ),
        stars: claimed.reward.stars,
        xp: claimed.reward.xp,
        label: `미션:${claimed.roundIndex + 1}`,
      });
      questStateRef.current = claimed.state;
      setQuestState(claimed.state);
      saveQuestState(claimed.state);
    } catch {
      showAttachmentWarning("미션 보상 수령에 실패했습니다.");
    } finally {
      setQuestClaimingId(null);
    }
  }, [grantQuestReward, questClaimingId, showAttachmentWarning]);

  const handleHornQuest = useCallback(() => {
    pushQuestProgress("horn", 1);
  }, [pushQuestProgress]);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    unlockSeenOwnerRef.current = session?.user?.id ?? "local";
    const level = getPlayerLevelProgress(totalXp).level;
    const sessionLevel = getPlayerLevelProgress(session?.user?.totalXp ?? 0).level;
    const effectiveLevel = Math.max(level, sessionLevel);
    enqueueUnlockNotices(
      getUnseenUnlocksForLevel(unlockSeenOwnerRef.current, effectiveLevel),
    );
  }, [
    enqueueUnlockNotices,
    session?.user?.id,
    session?.user?.totalXp,
    sessionStatus,
    totalXp,
  ]);

  const loadEquipment = useCallback(async () => {
    try {
      const res = await fetch("/api/equipment/yanmar");
      if (!res.ok) return;
      const data = await res.json();
      if (data.levels) setEquipmentLevels(data.levels);
      if (data.stats) {
        equipmentStatsRef.current = data.stats;
        setEquipmentStats(data.stats);
      }
      if (typeof data.currency === "number") {
        currencyRef.current = data.currency;
        setCurrency(data.currency);
        if (modeRef.current !== "game") {
          setPreviewStars(data.currency);
        }
      }
      if (typeof data.totalXp === "number") {
        applyTotalXp(data.totalXp);
      }
    } catch {
      // Equipment data is optional for unauthenticated previews.
    }
  }, [applyTotalXp]);

  useEffect(() => {
    const sessionXp = session?.user?.totalXp;
    if (typeof sessionXp === "number" && sessionXp >= 0) {
      if (totalXpRef.current > 0) return;
      applyTotalXp(sessionXp);
    }
  }, [applyTotalXp, session?.user?.totalXp]);

  useEffect(() => {
    const sessionCurrency = session?.user?.currency;
    if (typeof sessionCurrency !== "number" || sessionCurrency < 0) return;
    // API로 이미 채운 값은 덮어쓰지 않고, 초기 0만 세션으로 채운다.
    setCurrency((prev) => {
      if (prev > 0) return prev;
      currencyRef.current = sessionCurrency;
      return sessionCurrency;
    });
    setPreviewStars((prev) => (prev > 0 ? prev : sessionCurrency));
  }, [session?.user?.currency]);

  useEffect(() => {
    if (mode === "ride") return;
    void loadEquipment();
  }, [loadEquipment, mode]);

  useEffect(() => {
    setHeaderHudReady(true);
  }, []);

  useEffect(() => {
    tutorialStepRef.current = tutorialStep;
    tutorialIndexRef.current = tutorialIndex;
  }, [tutorialIndex, tutorialStep]);

  useEffect(() => {
    currencyRef.current = currency;
  }, [currency]);

  useEffect(() => {
    allowedRef.current = allowed;
    syncMergedInput();
  }, [allowed, syncMergedInput]);

  useEffect(() => {
    auxiliaryRef.current = auxiliary;
  }, [auxiliary]);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    const ownerId = resolveAuxiliarySettingsOwner(
      session?.user?.id ?? gameSessionUserIdRef.current,
    );
    const timer = window.setTimeout(() => {
      saveAuxiliarySettings(ownerId, auxiliaryRef.current);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [auxiliary.boomSwing, auxiliary.highSpeed, session?.user?.id, sessionStatus]);

  const handleAuxiliaryChange = useCallback((next: AuxiliaryControlState | ((current: AuxiliaryControlState) => AuxiliaryControlState)) => {
    const resolved = typeof next === "function" ? next(auxiliaryRef.current) : next;
    if (autoPoseRef.current.executing) {
      const prev = auxiliaryRef.current;
      if (
        prev.boomSwing !== resolved.boomSwing ||
        prev.highSpeed !== resolved.highSpeed ||
        prev.safetyLocked !== resolved.safetyLocked ||
        prev.blade !== resolved.blade ||
        prev.throttle !== resolved.throttle ||
        prev.attachmentPedal !== resolved.attachmentPedal
      ) {
        cancelAutoArmPose(autoPoseRef.current);
        setAutoPose({ ...autoPoseRef.current });
      }
    }
    auxiliaryRef.current = resolved;
    setAuxiliary(resolved);
    if (resolved.safetyLocked) {
      clearAllInput();
      if (resolved.attachmentPedal !== 0) {
        const unlocked = { ...resolved, attachmentPedal: 0 as const };
        auxiliaryRef.current = unlocked;
        setAuxiliary(unlocked);
      }
    }
  }, [clearAllInput, setAuxiliary]);

  const handleSavePose = useCallback((slot: AutoPoseSlotIndex) => {
    const now = Date.now();
    if (now < savePoseCooldownUntil) return;

    const sim = simRef.current;
    const pose = {
      boom: sim.boom,
      arm: sim.arm,
      bucket: sim.bucket,
    };
    autoPoseRef.current.slots = [
      slot === 0 ? pose : autoPoseRef.current.slots[0],
      slot === 1 ? pose : autoPoseRef.current.slots[1],
    ];
    if (autoPoseRef.current.executing && autoPoseRef.current.activeSlot === slot) {
      cancelAutoArmPose(autoPoseRef.current);
      autoPoseRef.current.saved = { ...pose };
    } else if (!autoPoseRef.current.executing && autoPoseRef.current.activeSlot === slot) {
      autoPoseRef.current.saved = { ...pose };
    }
    setAutoPose({
      ...autoPoseRef.current,
      slots: [...autoPoseRef.current.slots],
    });

    const ownerId = resolveAutoPoseStorageOwner(
      session?.user?.id ?? gameSessionUserIdRef.current,
    );
    saveSavedArmPoseSlot(ownerId, slot, pose, now);

    setSavePoseCooldownUntil(now + poseActionCooldownMs);
    showPoseSaveToast();
  }, [poseActionCooldownMs, savePoseCooldownUntil, session?.user?.id, showPoseSaveToast]);

  const handleExecutePose = useCallback((slot: AutoPoseSlotIndex) => {
    const now = Date.now();
    if (now < executePoseCooldownUntil) return;
    if (!startAutoArmPose(autoPoseRef.current, slot)) return;
    setAutoPose({ ...autoPoseRef.current });
    setExecutePoseCooldownUntil(now + poseActionCooldownMs);
  }, [executePoseCooldownUntil, poseActionCooldownMs]);

  const resetExcavatorPosition = useCallback(() => {
    const initial = createInitialSim();
    const sim = simRef.current;
    sim.posX = initial.posX;
    sim.posY = initial.posY;
    sim.posZ = initial.posZ;

    // 순간이동 직후 기존 주행 관성으로 다시 움직이지 않도록 주행 속도만 멈춘다.
    const velocity = velRef.current;
    velocity.travel = 0;
    velocity.trackTurn = 0;
    velocity.trackLeft = 0;
    velocity.trackRight = 0;
    questTrackRef.current.ready = false;
  }, []);

  const resetYanmarSession = useCallback((opts?: { terrainLevel?: number }) => {
    resetSim(simRef.current, velRef.current);
    questTrackRef.current.ready = false;
    terrainRef.current = createInitialTerrain(
      false,
      opts?.terrainLevel ?? getPlayerLevelProgress(totalXpRef.current).level,
    );
    scoreRef.current = createScoreState(config.target, config.duration);
    tutorialDumpRef.current = 0;
    tutorialCrashHitsRef.current = 0;
    tutorialHillDeliverRef.current = 0;
    dumpTruckPoseRef.current = getDumpTruckPose(dumpTruckStateRef.current);
    endedRef.current = false;
    elapsedRef.current = 0;
    lastHudProgressRef.current = -1;
    arcadeScoreRef.current = 0;
    rewardStarsRef.current = 0;
    setPreviewStars(currencyRef.current);
    setAttachmentType("bucket");
    setTerrainRevision((key) => key + 1);
    tutorialCompletingRef.current = false;
    const nextAuxiliary = {
      ...createAuxiliaryControls(),
      highSpeed: auxiliaryRef.current.highSpeed,
      boomSwing: auxiliaryRef.current.boomSwing,
    };
    auxiliaryRef.current = nextAuxiliary;
    setAuxiliary(nextAuxiliary);
    // 저장된 자세는 세션 리셋·종료 후에도 유지 (재입장 시 실행 가능)
    const ownerId = resolveAutoPoseStorageOwner(
      session?.user?.id ?? gameSessionUserIdRef.current,
    );
    saveSavedArmPoseSlots(ownerId, autoPoseRef.current.slots);
    const persistedSlots = loadAutoPoseSlotsForSession(
      session?.user?.id ?? gameSessionUserIdRef.current,
    );
    const prevActiveSlot = autoPoseRef.current.activeSlot;
    autoPoseRef.current = createAutoPoseState();
    autoPoseRef.current.activeSlot = prevActiveSlot;
    autoPoseRef.current.slots = [persistedSlots[0], persistedSlots[1]];
    autoPoseRef.current.saved = persistedSlots[prevActiveSlot];
    setAutoPose({
      ...autoPoseRef.current,
      slots: [...autoPoseRef.current.slots],
    });
    clearAllInput();
    if (dumpScoreHideTimerRef.current != null) {
      window.clearTimeout(dumpScoreHideTimerRef.current);
      dumpScoreHideTimerRef.current = null;
    }
    if (couponDiscoveryHideTimerRef.current != null) {
      window.clearTimeout(couponDiscoveryHideTimerRef.current);
      couponDiscoveryHideTimerRef.current = null;
    }
    dumpScorePanelRef.current = null;
    couponDiscoveryRef.current = null;
    setDumpScorePanel(null);
    setCouponDiscovery(null);
    setHud({
      progress: 0,
      timeLeft: config.duration,
      bucketLoad: 0,
      goalDist: 0,
      boom: 0.45,
      arm: -0.95,
      bucket: 0.85,
      score: 0,
      dumpedUnits: 0,
    });
  }, [clearAllInput, config.duration, config.target, session?.user?.id, setAuxiliary, setHud]);

  useEffect(() => {
    return () => {
      if (poseSaveToastTimerRef.current != null) {
        window.clearTimeout(poseSaveToastTimerRef.current);
      }
      if (levelUpToastTimerRef.current != null) {
        window.clearTimeout(levelUpToastTimerRef.current);
      }
      if (attachmentWarningTimerRef.current != null) {
        window.clearTimeout(attachmentWarningTimerRef.current);
      }
    };
  }, []);

  const savePoseOnCooldown = Date.now() < savePoseCooldownUntil;
  const executePoseOnCooldown = Date.now() < executePoseCooldownUntil;

  useEffect(() => {
    const until = Math.max(savePoseCooldownUntil, executePoseCooldownUntil);
    const remaining = until - Date.now();
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => {
      // 쿨다운 만료 시 버튼 재활성화를 위해 리렌더
      setSavePoseCooldownUntil((value) => (Date.now() >= value ? 0 : value));
      setExecutePoseCooldownUntil((value) => (Date.now() >= value ? 0 : value));
    }, remaining + 16);
    return () => window.clearTimeout(timer);
  }, [executePoseCooldownUntil, savePoseCooldownUntil]);

  const enterRideMode = useCallback(() => {
    resetYanmarSession();
    terrainRef.current = createInitialTerrain(
      false,
      getPlayerLevelProgress(totalXpRef.current).level,
    );
    tutorialStepRef.current = null;
    setShowTutorialMenu(false);
    setShowTouchZones(false);
    setShowEquipmentUpgrade(false);
    setMode("ride");
  }, [resetYanmarSession, setMode, setShowTutorialMenu, setShowTouchZones]);

  const enterPracticeMode = useCallback(() => {
    resetYanmarSession({ terrainLevel: PRACTICE_FULL_UNLOCK_LEVEL });
    terrainRef.current = createInitialTerrain(true, PRACTICE_FULL_UNLOCK_LEVEL);
    setTerrainRevision((key) => key + 1);
    tutorialStepRef.current = null;
    setTutorialIndex(0);
    setShowTutorialMenu(true);
    setMode("practice");
  }, [resetYanmarSession, setMode, setShowTutorialMenu, setTutorialIndex]);

  const startGameDirect = useCallback(() => {
    tutorialStepRef.current = null;
    setShowTouchZones(false);
    setShowTutorialMenu(false);
    endedRef.current = false;
    elapsedRef.current = 0;

    const userId = session?.user?.id ?? gameSessionUserIdRef.current;
    if (userId) {
      const snapshot = loadYanmarGameSession(userId);
      gameSessionRestoredRef.current = true;
      if (snapshot) {
        applyGameSnapshot(snapshot);
        setMode("game");
        return;
      }
    }

    resetYanmarSession();
    terrainRef.current = createInitialTerrain(
      true,
      getPlayerLevelProgress(totalXpRef.current).level,
    );
    if (userId) {
      const truck = loadDumpTruckCooldown(userId);
      if (truck) {
        Object.assign(dumpTruckStateRef.current, truck);
      }
    }
    dumpTruckPoseRef.current = getDumpTruckPose(dumpTruckStateRef.current);
    scoreRef.current.timeLeft = config.duration;
    setHud((h) => ({ ...h, progress: 0, timeLeft: config.duration }));
    setMode("game");
  }, [
    applyGameSnapshot,
    config.duration,
    resetYanmarSession,
    session?.user?.id,
    setHud,
    setMode,
    setShowTouchZones,
    setShowTutorialMenu,
  ]);

  const finishCurrentRun = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    clearAllInput();
    persistGameSession(true);
    persistDumpTruckCooldown(true);
    const ownerId = resolveAutoPoseStorageOwner(
      session?.user?.id ?? gameSessionUserIdRef.current,
    );
    saveSavedArmPoseSlots(ownerId, autoPoseRef.current.slots);

    const currentMode = modeRef.current;
    const score = scoreRef.current;
    onEnd({
      gameId: "yanmar",
      progress: getProgress(score),
      playTime: Math.max(1, Math.round(elapsedRef.current)),
      timeLeft: config.duration > 0 ? Math.ceil(score.timeLeft) : 0,
      completed: isComplete(score),
      arcadeScore: arcadeScoreRef.current,
      dumpUnits: Math.round(Math.max(0, score.dumped) * equipmentStats.maxLoadUnits),
      rewardStars: rewardStarsRef.current,
      mode:
        currentMode === "game" || currentMode === "tutorial"
          ? currentMode
          : currentMode === "ride"
            ? "ride"
            : "practice",
    });
  }, [
    clearAllInput,
    config.duration,
    equipmentStats.maxLoadUnits,
    onEnd,
    persistDumpTruckCooldown,
    persistGameSession,
    session?.user?.id,
  ]);

  useEffect(() => {
    if (exitSignal <= processedExitSignalRef.current) return;
    processedExitSignalRef.current = exitSignal;
    finishCurrentRun();
  }, [exitSignal, finishCurrentRun]);

  useEffect(() => {
    if (resumeSignal <= 0) return;
    endedRef.current = false;
  }, [resumeSignal]);

  useEffect(() => {
    if (!scoreCommit || scoreCommit.id <= processedScoreCommitRef.current) return;
    processedScoreCommitRef.current = scoreCommit.id;

    arcadeScoreRef.current = Math.max(0, arcadeScoreRef.current - scoreCommit.score);
    setHud((current) => ({ ...current, score: arcadeScoreRef.current }));
    persistGameSession(true);
  }, [persistGameSession, scoreCommit, setHud]);

  const initialPlayModeRef = useRef(initialPlayMode);
  const hasBootstrappedRef = useRef(false);

  useEffect(() => {
    if (hasBootstrappedRef.current) return;
    const bootMode = initialPlayModeRef.current;
    if (!bootMode) return;
    hasBootstrappedRef.current = true;
    if (bootMode === "ride") {
      enterRideMode();
    } else if (bootMode === "practice") {
      enterPracticeMode();
    } else {
      startGameDirect();
    }
  }, [enterRideMode, enterPracticeMode, startGameDirect]);

  const startTutorial = useCallback((index: number) => {
    resetYanmarSession({ terrainLevel: PRACTICE_FULL_UNLOCK_LEVEL });
    terrainRef.current = createInitialTerrain(true, PRACTICE_FULL_UNLOCK_LEVEL);
    setTerrainRevision((key) => key + 1);
    const step = TUTORIAL_STEPS[index] ?? null;
    tutorialCompletingRef.current = false;
    tutorialCrashHitsRef.current = 0;
    tutorialHillDeliverRef.current = 0;
    tutorialIndexRef.current = index;
    tutorialStepRef.current = step;
    if (step?.startPose) {
      const sim = simRef.current;
      sim.posX = step.startPose.x;
      sim.posZ = step.startPose.z;
      if (step.startPose.heading != null) sim.heading = step.startPose.heading;
    }
    if (step?.startAttachment) {
      simRef.current.attachmentType = step.startAttachment;
      simRef.current.carriedBoulderId = null;
      setAttachmentType(step.startAttachment);
    }
    setTutorialIndex(index);
    setShowTutorialMenu(false);
    setMode("tutorial");
  }, [resetYanmarSession, setMode, setShowTutorialMenu, setTutorialIndex]);

  const startFreePractice = useCallback(() => {
    resetYanmarSession({ terrainLevel: PRACTICE_FULL_UNLOCK_LEVEL });
    terrainRef.current = createInitialTerrain(true, PRACTICE_FULL_UNLOCK_LEVEL);
    setTerrainRevision((key) => key + 1);
    tutorialStepRef.current = null;
    setShowTutorialMenu(false);
    setMode("practice");
  }, [resetYanmarSession, setMode, setShowTutorialMenu]);

  const handleSimTick = useCallback(() => {
    syncDigHud();
    persistGameSession();
    persistDumpTruckCooldown();

    const modeNow = modeRef.current;
    if (modeNow !== "intro" && modeNow !== "ride" && modeNow !== "gameReady") {
      const sim = simRef.current;
      const track = questTrackRef.current;
      const stats = equipmentStatsRef.current;
      const fb = digFeedbackRef.current;

      if (!track.ready) {
        track.posX = sim.posX;
        track.posZ = sim.posZ;
        track.swing = sim.swing;
        track.swingAccum = 0;
        track.bucketLoad = sim.bucketLoad;
        track.dumpTruckPhase = dumpTruckStateRef.current.phase;
        track.haulTruckPhase =
          terrainRef.current.hillZone?.haulTruck.phase ?? "";
        track.grappleLiftTick = fb.grappleLiftResultTick;
        track.ready = true;
      } else {
        const travelDelta = Math.hypot(sim.posX - track.posX, sim.posZ - track.posZ);
        if (travelDelta > 0.0001) {
          pushQuestProgress("travel", travelDelta);
        }
        track.posX = sim.posX;
        track.posZ = sim.posZ;

        let swingDelta = sim.swing - track.swing;
        while (swingDelta > Math.PI) swingDelta -= Math.PI * 2;
        while (swingDelta < -Math.PI) swingDelta += Math.PI * 2;
        track.swingAccum += Math.abs(swingDelta);
        track.swing = sim.swing;
        while (track.swingAccum >= Math.PI) {
          track.swingAccum -= Math.PI;
          pushQuestProgress("swing180", 1);
        }

        const loadDelta = sim.bucketLoad - track.bucketLoad;
        if (loadDelta > 0.0001) {
          pushQuestProgress("soilLoad", loadDelta * stats.maxLoadUnits);
        }
        track.bucketLoad = sim.bucketLoad;

        const dumpPhase = dumpTruckStateRef.current.phase;
        if (
          dumpPhase === "departing" &&
          track.dumpTruckPhase !== "departing" &&
          track.dumpTruckPhase !== ""
        ) {
          pushQuestProgress("dumpTruckDepart", 1);
        }
        track.dumpTruckPhase = dumpPhase;

        const haulPhase = terrainRef.current.hillZone?.haulTruck.phase ?? "";
        if (
          haulPhase === "departing" &&
          track.haulTruckPhase !== "departing" &&
          track.haulTruckPhase !== ""
        ) {
          pushQuestProgress("haulTruckDepart", 1);
        }
        track.haulTruckPhase = haulPhase;

        if (
          fb.grappleLiftResult === "success" &&
          fb.grappleLiftResultTick !== track.grappleLiftTick
        ) {
          pushQuestProgress("rockLoad", 1);
        }
        track.grappleLiftTick = fb.grappleLiftResultTick;
      }
    }

    if (modeRef.current !== "tutorial") return;
    if (tutorialCompletingRef.current) return;

    const step = tutorialStepRef.current;
    if (!step) return;

    if (
      checkTutorialStepComplete(step, simRef.current, {
        dumped: tutorialDumpRef.current,
        crashHits: tutorialCrashHitsRef.current,
        hillDelivered: tutorialHillDeliverRef.current,
      })
    ) {
      tutorialCompletingRef.current = true;
      setStepCompleteFlash(true);
      window.setTimeout(() => setStepCompleteFlash(false), 600);
      window.setTimeout(() => {
        tutorialCompletingRef.current = false;
        tutorialStepRef.current = null;
        setMode("practice");
      }, 900);
    }

    if (step.waypoint == null) return;
    const goalDist = Math.round(waypointDistance(simRef.current, step.waypoint));
    setHud((h) => (h.goalDist === goalDist ? h : { ...h, goalDist }));
  }, [
    persistDumpTruckCooldown,
    persistGameSession,
    pushQuestProgress,
    syncDigHud,
    setHud,
    setMode,
    setStepCompleteFlash,
  ]);

  const handleProgress = useCallback(
    (dumped: number, progress: number) => {
      const dumpedUnits = Math.round(Math.max(0, dumped) * equipmentStats.maxLoadUnits);
      if (progress !== lastHudProgressRef.current || hud.dumpedUnits !== dumpedUnits) {
        lastHudProgressRef.current = progress;
        setHud((h) => ({
          ...h,
          progress,
          bucketLoad: simRef.current.bucketLoad,
          dumpedUnits,
        }));
      }
      if (!endedRef.current && dumped >= config.target) {
        setHud((h) => ({
          ...h,
          progress: 100,
          dumpedUnits,
        }));
      }
    },
    [config.target, equipmentStats.maxLoadUnits, hud.dumpedUnits, setHud],
  );

  const scheduleHideDumpScorePanel = useCallback(() => {
    if (dumpScoreHideTimerRef.current != null) {
      window.clearTimeout(dumpScoreHideTimerRef.current);
    }
    dumpScoreHideTimerRef.current = window.setTimeout(() => {
      dumpScoreHideTimerRef.current = null;
      dumpScorePanelRef.current = null;
      setDumpScorePanel(null);
    }, DUMP_SCORE_PANEL_DURATION_MS);
  }, []);

  const scheduleHideCouponDiscovery = useCallback(() => {
    if (couponDiscoveryHideTimerRef.current != null) {
      window.clearTimeout(couponDiscoveryHideTimerRef.current);
    }
    couponDiscoveryHideTimerRef.current = window.setTimeout(() => {
      couponDiscoveryHideTimerRef.current = null;
      couponDiscoveryRef.current = null;
      setCouponDiscovery(null);
    }, COUPON_DISCOVERY_DURATION_MS);
  }, []);

  const showCouponDiscovery = useCallback(
    (couponType: CouponDiscoveryState["couponType"], discountPct: number) => {
      const next: CouponDiscoveryState = {
        couponType,
        discountPct,
        pulseKey: (couponDiscoveryRef.current?.pulseKey ?? 0) + 1,
      };
      couponDiscoveryRef.current = next;
      setCouponDiscovery(next);
      scheduleHideCouponDiscovery();
    },
    [scheduleHideCouponDiscovery],
  );

  const accumulateDumpScore = useCallback(
    (score: number, critical: boolean, rewardText = "", earnedXp = 0, earnedStars = 0) => {
      arcadeScoreRef.current += score;
      setHud((h) => ({ ...h, score: arcadeScoreRef.current }));

      const previous = dumpScorePanelRef.current;
      const next: DumpScorePanelState = {
        totalScore: (previous?.totalScore ?? 0) + score,
        critical: (previous?.critical ?? false) || critical,
        rewardText: appendRewardText(previous?.rewardText ?? "", rewardText),
        earnedStars: (previous?.earnedStars ?? 0) + earnedStars,
        earnedXp: (previous?.earnedXp ?? 0) + earnedXp,
        pendingRewards: previous?.pendingRewards ?? 0,
        pulseKey: (previous?.pulseKey ?? 0) + 1,
      };
      dumpScorePanelRef.current = next;
      setDumpScorePanel(next);
      scheduleHideDumpScorePanel();
    },
    [scheduleHideDumpScorePanel],
  );

  /** Crash 타일 등 — 이전 패널과 합산하지 않고 이번 보상만 표시 */
  const showStandaloneRewardPanel = useCallback(
    (
      score: number,
      critical: boolean,
      earnedStars: number,
      earnedXp = 0,
      rewardText = "",
    ) => {
      if (score > 0) {
        arcadeScoreRef.current += score;
        setHud((h) => ({ ...h, score: arcadeScoreRef.current }));
      }

      const next: DumpScorePanelState = {
        totalScore: score,
        critical,
        rewardText,
        earnedStars,
        earnedXp,
        pendingRewards: 0,
        pulseKey: (dumpScorePanelRef.current?.pulseKey ?? 0) + 1,
      };
      dumpScorePanelRef.current = next;
      setDumpScorePanel(next);
      scheduleHideDumpScorePanel();
    },
    [scheduleHideDumpScorePanel],
  );

  const adjustDumpScorePanel = useCallback(
    (
      scoreDelta: number,
      patch: Partial<
        Pick<DumpScorePanelState, "rewardText" | "critical" | "earnedStars" | "earnedXp">
      > = {},
      decrementPending = true,
    ) => {
      const previous = dumpScorePanelRef.current;
      if (!previous) return;

      if (scoreDelta !== 0) {
        arcadeScoreRef.current += scoreDelta;
        setHud((h) => ({ ...h, score: arcadeScoreRef.current }));
      }

      const next: DumpScorePanelState = {
        ...previous,
        totalScore: previous.totalScore + scoreDelta,
        critical: patch.critical ?? previous.critical,
        rewardText: patch.rewardText ?? previous.rewardText,
        earnedStars: patch.earnedStars ?? previous.earnedStars,
        earnedXp: patch.earnedXp ?? previous.earnedXp,
        pendingRewards: decrementPending
          ? Math.max(0, previous.pendingRewards - 1)
          : previous.pendingRewards,
        pulseKey: previous.pulseKey + (scoreDelta !== 0 ? 1 : 0),
      };
      dumpScorePanelRef.current = next;
      setDumpScorePanel(next);
      scheduleHideDumpScorePanel();
    },
    [scheduleHideDumpScorePanel],
  );

  const handleDumpScore = useCallback((popup: Omit<DumpScorePopup, "id">) => {
    if (modeRef.current === "ride") return;
    pushQuestProgress(
      "soilDump",
      equipmentStatsRef.current.scoreChunkUnits,
    );
    const dumpXp = equipmentStatsRef.current.scoreChunkUnits;
    if (modeRef.current !== "game") {
      const stars = rollOptimisticStarReward();
      setPreviewStars((value) => value + stars);
      accumulateDumpScore(popup.score, popup.critical, "", dumpXp, stars);
      return;
    }

    // 낙관적 업데이트: API 응답 전에 별·점수·경험치를 바로 표시
    const optimisticStars = rollOptimisticStarReward();
    accumulateDumpScore(popup.score, popup.critical, "", dumpXp, optimisticStars);
    rewardStarsRef.current += optimisticStars;
    currencyRef.current += optimisticStars;
    setCurrency(currencyRef.current);
    const panel = dumpScorePanelRef.current;
    if (panel) {
      const next = {
        ...panel,
        pendingRewards: panel.pendingRewards + 1,
      };
      dumpScorePanelRef.current = next;
      setDumpScorePanel(next);
    }

    void (async () => {
      try {
        const res = await fetch("/api/rewards/yanmar-dump", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chunkCount: 1 }),
        });
        if (!res.ok) throw new Error("Reward failed");
        const data = await res.json();
        const event = data.events?.[0] as DumpRewardApiEvent | undefined;
        const actualXp =
          typeof data.xpGained === "number" ? data.xpGained : dumpXp;
        const panelBefore = dumpScorePanelRef.current;
        const xpDelta = actualXp - dumpXp;
        const nextEarnedXp = Math.max(
          0,
          (panelBefore?.earnedXp ?? dumpXp) + xpDelta,
        );

        if (typeof data.currency === "number") {
          currencyRef.current = data.currency;
          setCurrency(data.currency);
          void updateSessionRef.current({ user: { currency: data.currency } });
        }
        if (typeof data.totalXp === "number") {
          applyTotalXp(data.totalXp, { announceLevelUp: true });
          void updateSessionRef.current({ user: { totalXp: data.totalXp } });
        }

        if (!event || event.kind === "stars") {
          const actualStars = event?.kind === "stars" ? event.stars : optimisticStars;
          const starDelta = actualStars - optimisticStars;
          rewardStarsRef.current += starDelta;
          if (typeof data.currency !== "number") {
            currencyRef.current += starDelta;
            setCurrency(currencyRef.current);
          }
          const starsOnPanel = Math.max(
            0,
            (dumpScorePanelRef.current?.earnedStars ?? optimisticStars) + starDelta,
          );
          adjustDumpScorePanel(event ? event.score - popup.score : 0, {
            critical:
              (event?.critical ?? false) || dumpScorePanelRef.current?.critical,
            earnedStars: starsOnPanel,
            earnedXp: nextEarnedXp,
          });
          return;
        }

        // 쿠폰이면 낙관적 별 회수 후 쿠폰 UI
        rewardStarsRef.current -= optimisticStars;
        if (typeof data.currency !== "number") {
          currencyRef.current = Math.max(0, currencyRef.current - optimisticStars);
          setCurrency(currencyRef.current);
        }
        showCouponDiscovery(event.couponType, event.discountPct);
        adjustDumpScorePanel(event.score - popup.score, {
          critical: true,
          earnedStars: Math.max(
            0,
            (dumpScorePanelRef.current?.earnedStars ?? optimisticStars) - optimisticStars,
          ),
          earnedXp: nextEarnedXp,
        });
      } catch {
        rewardStarsRef.current = Math.max(0, rewardStarsRef.current - optimisticStars);
        currencyRef.current = Math.max(0, currencyRef.current - optimisticStars);
        setCurrency(currencyRef.current);
        adjustDumpScorePanel(0, {
          earnedStars: Math.max(
            0,
            (dumpScorePanelRef.current?.earnedStars ?? optimisticStars) - optimisticStars,
          ),
          earnedXp: Math.max(
            0,
            (dumpScorePanelRef.current?.earnedXp ?? dumpXp) - dumpXp,
          ),
          rewardText: appendRewardText(
            dumpScorePanelRef.current?.rewardText ?? "",
            "저장 실패",
          ),
        });
      }
    })();
  }, [accumulateDumpScore, adjustDumpScorePanel, applyTotalXp, pushQuestProgress, showCouponDiscovery]);

  const claimSpecialReward = useCallback(
    async (kind: "crash" | "hill", eventId: string) => {
      if (modeRef.current === "ride") return;

      if (modeRef.current !== "game") {
        if (kind === "crash" || kind === "hill") {
          const local =
            kind === "crash"
              ? rollLocalCrashReward(equipmentStatsRef.current)
              : rollLocalHillReward(equipmentStatsRef.current);
          const localXp =
            kind === "crash"
              ? YANMAR_CRASH_REWARD_CONFIG.xpReward
              : rollYanmarHillXp();
          setPreviewStars((value) => value + local.stars);
          if (kind === "crash") {
            showStandaloneRewardPanel(
              local.score,
              local.critical,
              local.stars,
              localXp,
            );
          } else {
            accumulateDumpScore(
              local.score,
              local.critical,
              "",
              localXp,
              local.stars,
            );
          }
        }
        return;
      }

      try {
        const requestReward = () =>
          fetch(`/api/rewards/yanmar-${kind}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId }),
          });
        let res = await requestReward();
        if (kind === "crash" && res.status === 429) {
          await new Promise((resolve) => window.setTimeout(resolve, 1100));
          res = await requestReward();
        }
        if (res.status === 409) return;
        if (!res.ok) {
          if (res.status === 429) {
            showAttachmentWarning("보상 요청이 너무 빠릅니다. 잠시 후 다시 시도하세요.");
            return;
          }
          if (res.status === 403) {
            showAttachmentWarning(
              `${kind === "crash" ? "브레이커" : "운반"} 보상 레벨 조건을 확인하세요.`,
            );
            return;
          }
          throw new Error("Special reward failed");
        }
        const data = await res.json();
        if (typeof data.currency === "number") {
          currencyRef.current = data.currency;
          setCurrency(data.currency);
          void updateSessionRef.current({ user: { currency: data.currency } });
        }
        if (typeof data.totalXp === "number") {
          applyTotalXp(data.totalXp, { announceLevelUp: true });
          void updateSessionRef.current({ user: { totalXp: data.totalXp } });
        }

        const event = data.reward as DumpRewardApiEvent | undefined;
        const critical = Boolean(
          (typeof data.critical === "boolean" && data.critical) ||
            event?.critical,
        );
        const score =
          typeof data.score === "number"
            ? data.score
            : typeof event?.score === "number"
              ? event.score
              : 0;
        const xpGained =
          typeof data.xpGained === "number"
            ? data.xpGained
            : kind === "crash"
              ? YANMAR_CRASH_REWARD_CONFIG.xpReward
              : 0;

        if (kind === "crash") {
          if (event?.kind === "stars") {
            rewardStarsRef.current += event.stars;
            showStandaloneRewardPanel(score, critical, event.stars, xpGained);
          } else if (event?.kind === "coupon") {
            showCouponDiscovery(event.couponType, event.discountPct);
            showStandaloneRewardPanel(score, true, 0, xpGained, "쿠폰 획득!");
          } else if (typeof data.totalStars === "number") {
            rewardStarsRef.current += data.totalStars;
            showStandaloneRewardPanel(score, critical, data.totalStars, xpGained);
          } else if (score > 0 || xpGained > 0) {
            showStandaloneRewardPanel(score, critical, 0, xpGained);
          }
          return;
        }

        if (score > 0 || xpGained > 0) {
          const stars =
            event?.kind === "stars"
              ? event.stars
              : typeof data.totalStars === "number"
                ? data.totalStars
                : 0;
          if (event?.kind === "stars" || typeof data.totalStars === "number") {
            rewardStarsRef.current += stars;
          }
          if (event?.kind === "coupon") {
            showCouponDiscovery(event.couponType, event.discountPct);
            accumulateDumpScore(score, true, "쿠폰 획득!", xpGained, 0);
          } else {
            accumulateDumpScore(score, critical, "", xpGained, stars);
          }
        }
      } catch {
        showAttachmentWarning("보상 저장에 실패했습니다. 잠시 후 다시 시도하세요.");
      }
    },
    [
      accumulateDumpScore,
      applyTotalXp,
      showAttachmentWarning,
      showCouponDiscovery,
      showStandaloneRewardPanel,
    ],
  );

  const handleCrashTileDestroyed = useCallback(
    (tileId: string) => {
      pushQuestProgress("asphaltBreak", 1);
      void claimSpecialReward("crash", tileId);
    },
    [claimSpecialReward, pushQuestProgress],
  );

  const handleHillRockDelivered = useCallback(
    (rockId: string) => {
      if (modeRef.current === "tutorial") {
        tutorialHillDeliverRef.current += 1;
      }
      void claimSpecialReward("hill", rockId);
    },
    [claimSpecialReward],
  );

  const handleEquipmentUpgrade = useCallback(
    (part: YanmarEquipmentPart) => {
      const previewMode = modeRef.current !== "game";
      const practiceMode = modeRef.current === "practice";
      if (previewMode) {
        setEquipmentLevels((current) => {
          const maxLevel = YANMAR_EQUIPMENT_CONFIG[part].maxLevel;
          const next = {
            ...current,
            [part]: Math.min(maxLevel, current[part] + 1),
          };
          const nextStats = calculateYanmarEquipmentStats(next);
          equipmentStatsRef.current = nextStats;
          setEquipmentStats(nextStats);
          return next;
        });
        if (!practiceMode) {
          setPreviewStars((value) =>
            Math.max(0, value - getYanmarUpgradeCost(part, equipmentLevels[part] + 1)),
          );
        }
        return;
      }

      setUpgradingPart(part);
      void (async () => {
        try {
          const res = await fetch("/api/equipment/yanmar/upgrade", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ part }),
          });
          const data = await res.json();
          if (!res.ok) return;
          if (data.levels) setEquipmentLevels(data.levels);
          if (data.stats) {
            equipmentStatsRef.current = data.stats;
            setEquipmentStats(data.stats);
          }
          if (typeof data.currency === "number") {
            currencyRef.current = data.currency;
            setCurrency(data.currency);
            await updateSessionRef.current({ user: { currency: data.currency } });
          }
        } finally {
          setUpgradingPart(null);
        }
      })();
    },
    [equipmentLevels],
  );

  const handleEquipmentReset = useCallback((part: YanmarEquipmentPart) => {
    const previewMode = modeRef.current !== "game";
    const practiceMode = modeRef.current === "practice";
    const partLevel = equipmentLevels[part];
    if (partLevel <= 0) return;

    if (previewMode) {
      setEquipmentLevels((current) => {
        const next = {
          ...current,
          [part]: DEFAULT_YANMAR_EQUIPMENT_LEVELS[part],
        };
        const nextStats = calculateYanmarEquipmentStats(next);
        equipmentStatsRef.current = nextStats;
        setEquipmentStats(nextStats);
        return next;
      });
      if (!practiceMode) {
        const refundStars = getYanmarPartResetRefundStars(part, partLevel);
        if (refundStars > 0) {
          setPreviewStars((value) => value + refundStars);
        }
      }
      return;
    }

    const refundStars = getYanmarPartResetRefundStars(part, partLevel);
    const partLabel = YANMAR_EQUIPMENT_CONFIG[part].label;
    const confirmed = window.confirm(
      `${partLabel} 강화를 초기화하면 사용한 스타의 ${Math.round(
        YANMAR_EQUIPMENT_RESET_REFUND_RATE * 100,
      )}%인 ${refundStars.toLocaleString()} 스타를 돌려받습니다.\n초기화하시겠습니까?`,
    );
    if (!confirmed) return;

    setResettingEquipment(true);
    void (async () => {
      try {
        const res = await fetch("/api/equipment/yanmar/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ part }),
        });
        const data = await res.json();
        if (!res.ok) return;
        if (data.levels) setEquipmentLevels(data.levels);
        if (data.stats) {
          equipmentStatsRef.current = data.stats;
          setEquipmentStats(data.stats);
        }
        if (typeof data.currency === "number") {
          currencyRef.current = data.currency;
          setCurrency(data.currency);
          await updateSessionRef.current({ user: { currency: data.currency } });
        }
      } finally {
        setResettingEquipment(false);
      }
    })();
  }, [equipmentLevels]);

  useEffect(() => {
    if (mode !== "game") return;
    let raf: number;
    let last = performance.now();

    const tick = (now: number) => {
      if (endedRef.current) return;
      const dt = (now - last) / 1000;
      last = now;
      elapsedRef.current += dt;
      tickTimer(scoreRef.current, dt);
      setHud((h) => ({
        ...h,
        timeLeft: config.duration > 0 ? scoreRef.current.timeLeft : elapsedRef.current,
        progress: getProgress(scoreRef.current),
      }));
      syncDigHud();

      if (config.duration > 0 && isTimeUp(scoreRef.current) && !isComplete(scoreRef.current)) {
        endedRef.current = true;
        onEnd({
          gameId: "yanmar",
          progress: getProgress(scoreRef.current),
          playTime: Math.round(elapsedRef.current),
          timeLeft: 0,
          completed: false,
          arcadeScore: arcadeScoreRef.current,
          dumpUnits: Math.round(
            Math.max(0, scoreRef.current.dumped) * equipmentStats.maxLoadUnits,
          ),
          rewardStars: rewardStarsRef.current,
          mode: "game",
        });
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [config.duration, equipmentStats.maxLoadUnits, mode, onEnd, syncDigHud]);

  useEffect(() => {
    if (tutorialStep?.id !== "dig") return;
    const sim = simRef.current;
    sim.bucketLoad = 0;
    tutorialDumpRef.current = 0;
    if (sim.boom < 0.7) sim.boom = 0.75;
    sim.bucket = 0.85;
    setHud((h) => ({
      ...h,
      bucketLoad: 0,
      boom: sim.boom,
      arm: sim.arm,
      bucket: sim.bucket,
    }));
  }, [tutorialIndex, tutorialStep?.id]);

  useEffect(() => {
    if (tutorialStep?.id !== "dump") return;
    const sim = simRef.current;
    tutorialDumpRef.current = 0;
    if (sim.bucketLoad < 0.25) {
      sim.bucketLoad = 0.45;
      setHud((h) => ({ ...h, bucketLoad: sim.bucketLoad }));
    }
  }, [tutorialIndex, tutorialStep?.id]);

  useEffect(() => {
    const keys = new Set<string>();
    const updateKeys = () => {
      const left = { x: 0, y: 0 };
      const right = { x: 0, y: 0 };
      const travel = { left: 0, right: 0 };
      if (keys.has("a") || keys.has("arrowleft")) left.x = -1;
      if (keys.has("d") || keys.has("arrowright")) left.x = 1;
      if (keys.has("q")) left.y = -1;
      if (keys.has("e")) left.y = 1;
      if (keys.has("w") || keys.has("arrowup")) {
        travel.left = 1;
        travel.right = 1;
      } else if (keys.has("s") || keys.has("arrowdown")) {
        travel.left = -1;
        travel.right = -1;
      } else if (keys.has("z")) {
        travel.left = 1;
      } else if (keys.has("c")) {
        travel.left = -1;
      } else if (keys.has("x")) {
        travel.right = 1;
      } else if (keys.has("v")) {
        travel.right = -1;
      }
      if (keys.has("j")) right.x = -1;
      if (keys.has("l")) right.x = 1;
      if (keys.has("i")) right.y = 1;
      if (keys.has("k")) right.y = -1;
      keyboardInputRef.current = { left, right, travel };
      syncMergedInput();
    };
    const down = (e: KeyboardEvent) => {
      keys.add(e.key.toLowerCase());
      updateKeys();
    };
    const up = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
      updateKeys();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [syncMergedInput]);

  const loadOverlayEnabled = mode !== "intro" && mode !== "gameReady" && mode !== "ride";
  const loadOverlayPercent = Math.max(0, Math.min(100, hud.bucketLoad * 100));
  const loadOverlayUnits = getLoadUnits(hud.bucketLoad, equipmentStats.maxLoadUnits);
  const loadOverlayActive = loadOverlayEnabled && digFeedback.digging;

  return (
    <div
      className={`relative touch-manipulation ${
        immersive
          ? "h-full w-full overflow-hidden bg-slate-950"
          : "mx-auto w-full max-w-lg"
      } yanmar-layout-portrait`}
    >
      <div
        className={`relative overflow-hidden bg-slate-300 ${
          immersive
            ? "shadow-2xl shadow-black/50"
            : "h-[520px] rounded-b-xl shadow-lg"
        }`}
        style={gameFrameStyle}
      >
        <ControlsGuidePanel
          open={showControlsGuide}
          onClose={() => setShowControlsGuide(false)}
          digFeedback={digFeedback}
          bucketLoad={hud.bucketLoad}
          maxLoadUnits={equipmentStats.maxLoadUnits}
          boom={hud.boom}
        />
        <TutorialSelectModal
          open={showTutorialMenu}
          activeId={tutorialStep?.id ?? null}
          onClose={() => setShowTutorialMenu(false)}
          onSelect={startTutorial}
          onFreePlay={startFreePractice}
        />
        <EquipmentUpgradePanel
          open={showEquipmentUpgrade}
          mode={mode}
          levels={equipmentLevels}
          currency={currency}
          previewStars={previewStars}
          upgradingPart={upgradingPart}
          resettingEquipment={resettingEquipment}
          onClose={() => setShowEquipmentUpgrade(false)}
          onUpgrade={handleEquipmentUpgrade}
          onResetEquipment={handleEquipmentReset}
        />

        {mode !== "intro" && mode !== "gameReady" && digFeedback.travelBlockedRaiseArm ? (
          <div className="pointer-events-none absolute left-1/2 top-[3.25rem] z-[60] w-max max-w-[calc(100%_-_1rem)] -translate-x-1/2 whitespace-nowrap rounded-xl border border-amber-300/45 bg-amber-500/90 px-3 py-2 text-center text-[11px] font-black text-white shadow-xl backdrop-blur-sm">
            ⚠️ 붐을 더 들어야 움직일 수 있습니다
          </div>
        ) : null}

        {mode !== "intro" && mode !== "gameReady" && digFeedback.showGripGauge ? (
          <div
            className={`pointer-events-none absolute left-1/2 z-[55] -translate-x-1/2 ${
              digFeedback.travelBlockedRaiseArm ? "top-[5.75rem]" : "top-[3.25rem]"
            }`}
          >
            <GrappleGripGauge
              adhesion={digFeedback.gripAdhesion}
              pressure={digFeedback.gripPressure}
            />
          </div>
        ) : null}

        {mode === "ride" ? (
          <div className="pointer-events-none absolute left-1/2 top-2 z-50 -translate-x-1/2 whitespace-nowrap rounded-xl border border-sky-200/35 bg-sky-950/75 px-3 py-1.5 text-[11px] font-black text-sky-100 shadow-lg backdrop-blur-sm">
            탑승 체험 · 실제 조작 시뮬레이터
          </div>
        ) : null}

        {mode !== "intro" && mode !== "gameReady" && mode !== "ride" ? (
          <div className="absolute left-2 top-2 z-50 flex flex-col items-start gap-1.5">
            <button
              type="button"
              className={`yanmar-quest-button yanmar-aux-button touch-none active:scale-95${
                showQuestPanel ? " is-open" : ""
              }`}
              onClick={() => setShowQuestPanel((open) => !open)}
              aria-expanded={showQuestPanel}
              aria-label={showQuestPanel ? "퀘스트 닫기" : "퀘스트 열기"}
            >
              <img
                className="yanmar-quest-button-icon"
                src="/images/yanmar/2d/cockpit/quest-premium.png?v=3"
                alt=""
                draggable={false}
              />
              <span className="yanmar-quest-button-label">퀘스트</span>
            </button>
            <QuestPanel
              open={showQuestPanel}
              onClose={() => setShowQuestPanel(false)}
              playerLevel={getPlayerLevelProgress(totalXp).level}
              questState={questState}
              claimingId={questClaimingId}
              onClaimDaily={(questId) => {
                void handleClaimDailyQuest(questId);
              }}
              onClaimMission={() => {
                void handleClaimMissionQuest();
              }}
            />
            {(mode === "practice" || mode === "tutorial") && (
              <button
                type="button"
                onClick={() => setShowTutorialMenu(true)}
                className="w-[7.3125rem] rounded-lg border border-white/20 bg-black/70 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-lg backdrop-blur-sm hover:bg-black/85"
              >
                튜토리얼
              </button>
            )}
            {showDigPoseGraph ? (
              <div className="yanmar-dig-pose-panel w-[7.3125rem] rounded-sm border border-white/10 bg-black/55 px-2 py-1.5 text-white shadow-xl backdrop-blur-sm">
                <DigPoseGraph
                  boom={hud.boom}
                  arm={hud.arm}
                  bucket={hud.bucket}
                  feedback={digFeedback}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {loadOverlayEnabled && (
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 z-50 w-[min(12.5rem,58%)] rounded-xl border border-orange-100/35 bg-black/70 px-3 py-2.5 text-center text-white shadow-2xl backdrop-blur-md"
            style={{
              opacity: loadOverlayActive ? 1 : 0,
              transform: `translate(-50%, calc(-50% + ${loadOverlayActive ? "0rem" : "-2.2rem"})) scale(${loadOverlayActive ? 1 : 0.92})`,
              transition:
                "opacity 3000ms ease-out, transform 3000ms ease-out",
            }}
            aria-hidden={!loadOverlayActive}
          >
            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-orange-200">
              LOADING
            </p>
            <div className="mt-1.5 flex items-end justify-center gap-1">
              <span className="text-2xl font-black tabular-nums text-orange-100 drop-shadow">
                {Math.round(loadOverlayPercent)}
              </span>
              <span className="pb-0.5 text-xs font-black text-orange-200">%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/18">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-orange-300 via-amber-200 to-yellow-100"
                style={{ width: `${loadOverlayPercent}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] font-bold text-white/85">
              적재량 {loadOverlayUnits}/{equipmentStats.maxLoadUnits}{" "}
              {Math.round(loadOverlayPercent)}%
            </p>
          </div>
        )}

        {mode !== "intro" && mode !== "ride" && (
          <div className="pointer-events-none absolute left-1/2 top-2 z-50 flex -translate-x-1/2 flex-col items-center gap-1">
            <div className="flex min-w-[5.5rem] flex-col items-center rounded-xl border border-white/15 bg-black/45 px-3 py-1.5 text-white shadow-lg backdrop-blur-sm">
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/70">
                {mode === "game" ? "누적 점수" : "점수"}
              </span>
              <span className="mt-0.5 text-sm font-black tabular-nums text-yellow-100">
                {(
                  mode === "game" ? seasonScoreBase + hud.score : hud.score
                ).toLocaleString()}
              </span>
            </div>
            {digFeedback.canDump && hud.bucketLoad > 0.02 ? (
              <div className="rounded-xl border border-emerald-200/50 bg-emerald-500/90 px-3 py-1 text-[10px] font-black text-white shadow-lg backdrop-blur-sm">
                하역가능
              </div>
            ) : digFeedback.canLoad ? (
              <div className="rounded-xl border border-orange-200/50 bg-orange-500/90 px-3 py-1 text-[10px] font-black text-white shadow-lg backdrop-blur-sm">
                적재가능(
                <span className="tabular-nums">
                  {Math.round(digFeedback.digZoneRemainingUnits)}
                </span>
                )
              </div>
            ) : digFeedback.breakerNeedsVertical ? (
              <div className="rounded-xl border border-orange-200/50 bg-orange-600/90 px-3 py-1 text-[10px] font-black text-white shadow-lg backdrop-blur-sm">
                브레이커를 수직에 가깝게 세우세요.
              </div>
            ) : digFeedback.canStrike ? (
              <div className="rounded-xl border border-amber-200/50 bg-amber-500/90 px-3 py-1 text-[10px] font-black text-white shadow-lg backdrop-blur-sm">
                타격가능 (
                {Math.round(digFeedback.crashTileHp).toLocaleString()}/
                {Math.round(digFeedback.crashTileMaxHp).toLocaleString()})
              </div>
            ) : digFeedback.canGrab ? (
              <div className="rounded-xl border border-sky-200/50 bg-sky-500/90 px-3 py-1 text-[10px] font-black text-white shadow-lg backdrop-blur-sm">
                집게가능
              </div>
            ) : digFeedback.grappleNeedsAlignment ? (
              <div className="whitespace-nowrap rounded-xl border border-orange-200/50 bg-orange-600/90 px-3 py-1 text-[10px] font-black text-white shadow-lg backdrop-blur-sm">
                버켓 각도를 집게와 맞추세요
              </div>
            ) : digFeedback.canDropRock ? (
              <div className="rounded-xl border border-violet-200/50 bg-violet-500/90 px-3 py-1 text-[10px] font-black text-white shadow-lg backdrop-blur-sm">
                발판 아래쪽: 열기
              </div>
            ) : digFeedback.soilSpilling && hud.bucketLoad > 0.02 ? (
              <div className="rounded-xl border border-amber-200/50 bg-amber-600/90 px-3 py-1 text-[10px] font-black text-white shadow-lg backdrop-blur-sm">
                흙 유실 — 버켓 말기
              </div>
            ) : digFeedback.raiseArmForDump && hud.bucketLoad > 0.02 ? (
              <div className="rounded-xl border border-sky-200/50 bg-sky-600/90 px-3 py-1 text-[10px] font-black text-white shadow-lg backdrop-blur-sm">
                붐·암 들기
              </div>
            ) : null}
            {digFeedback.crashTileMaxHp > 0 ? (
              <CrashAsphaltHpPanel
                hp={digFeedback.crashTileHp}
                maxHp={digFeedback.crashTileMaxHp}
                hitTick={digFeedback.crashHitTick}
                hitDamage={digFeedback.crashHitDamage}
              />
            ) : null}
            {digFeedback.truckCooldownRemaining > 0 ? (
              <div className="rounded-xl border border-sky-300/25 bg-black/50 px-3 py-1 text-[10px] font-bold text-white shadow-lg backdrop-blur-sm">
                다음 트럭{" "}
                <span className="tabular-nums text-sky-200">
                  {formatDumpTruckReturnTime(digFeedback.truckCooldownRemaining)}
                </span>
              </div>
            ) : null}
            {digFeedback.digCooldowns.map((zone) => (
              <div
                key={zone.id}
                className="rounded-xl border border-amber-300/25 bg-black/50 px-3 py-1 text-[10px] font-bold text-white shadow-lg backdrop-blur-sm"
              >
                {zone.label}{" "}
                <span className="tabular-nums text-amber-200">
                  ({Math.ceil(zone.etaSec)}초)
                </span>
              </div>
            ))}
          </div>
        )}

        {headerHudReady && mode !== "intro" && mode !== "ride"
          ? (() => {
              const leftTarget = document.getElementById(GAME_IMMERSIVE_HEADER_LEFT_ID);
              const rightTarget = document.getElementById(GAME_IMMERSIVE_HEADER_RIGHT_ID);
              if (!leftTarget && !rightTarget) return null;
              const ownedStars = mode === "game" ? currency : previewStars;
              const xpProgress = getPlayerLevelProgress(
                mode === "game" ? totalXp : session?.user?.totalXp ?? totalXp,
              );
              const nickname =
                session?.user?.nickname ?? session?.user?.loginId ?? "PLAYER";
              return (
                <>
                  {leftTarget && mode === "game"
                    ? createPortal(
                        <div className="flex min-w-0 w-full max-w-full items-center text-white">
                          <div className="min-w-0 w-full rounded-lg border border-white/15 bg-black/25 px-2 py-1">
                            <div className="flex min-w-0 items-baseline gap-1">
                              <p className="min-w-0 truncate text-[10px] font-black leading-none">
                                {nickname}
                              </p>
                              <span className="shrink-0 text-[9px] font-black text-amber-200">
                                Lv.{xpProgress.level}
                              </span>
                            </div>
                            <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                              <XpProgressBar
                                progress={xpProgress}
                                compact
                                showLabel={false}
                                className="min-w-[3.5rem] flex-1"
                                barClassName="bg-white/20"
                              />
                              <span
                                className="shrink-0 text-[8px] font-bold tabular-nums leading-none text-white/80"
                                title={formatXpProgress(xpProgress)}
                              >
                                ({formatXpProgress(xpProgress)})
                              </span>
                            </div>
                          </div>
                        </div>,
                        leftTarget,
                      )
                    : null}
                  {rightTarget
                    ? createPortal(
                        <span className="inline-flex shrink-0 items-center rounded-lg border border-white/15 bg-black/25 px-2.5 py-1">
                          <StarAmount
                            value={ownedStars}
                            size={16}
                            valueClassName="text-[11px] font-black text-amber-100"
                          />
                        </span>,
                        rightTarget,
                      )
                    : null}
                </>
              );
            })()
          : null}

        {mode === "tutorial" && tutorialStep && (
          <div className="absolute left-2 top-[5.25rem] z-40 w-[min(42rem,calc(100%_-_1rem))] rounded-xl border border-amber-300/20 bg-black/75 p-2 text-white shadow-xl backdrop-blur-sm">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-amber-300">{tutorialStep.title}</p>
              <p className="mt-0.5 whitespace-nowrap text-[clamp(7px,2.35vw,10px)] text-white/85">
                {tutorialStep.instruction}
              </p>
            </div>
            <button
              type="button"
              onClick={startFreePractice}
              className="mx-auto mt-2 block rounded bg-white/10 px-2 py-0.5 text-[9px] font-medium hover:bg-white/20"
            >
              자유동작
            </button>
          </div>
        )}

        {mode === "tutorial" && tutorialStep && (
          <div className="absolute right-2 z-20 rounded bg-black/40 px-1.5 py-0.5 text-[9px] text-white/70"
            style={{
              bottom: `calc(${((COCKPIT_LAYOUT.height / COCKPIT_LAYOUT.width) * 100).toFixed(1)}% + 2.75rem)`,
            }}
          >
            선택 연습 {tutorialIndex + 1}/{TUTORIAL_STEPS.length}
          </div>
        )}

        {mode !== "intro" && (mode !== "gameReady" || showMinimap) && (
          <div className="absolute right-1.5 top-1.5 z-30 flex w-fit flex-col overflow-hidden rounded-xl border border-white/15 bg-black/60 shadow-lg backdrop-blur-sm">
            {mode !== "gameReady" ? (
              <button
                type="button"
                onClick={() => setCameraMode((current) => ((current % 3) + 1) as CameraMode)}
                className="flex h-6 w-full items-center justify-center gap-0.5 border-b border-white/10 px-1 text-[9px] font-black text-white hover:bg-white/10"
                aria-label={`카메라 ${cameraMode}번 시점`}
              >
                <span
                  className="relative h-3 w-4 shrink-0 rounded-[0.2rem] border border-white/65"
                  aria-hidden
                >
                  <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/75" />
                  <span className="absolute left-0.5 top-[-0.18rem] h-0.5 w-1.5 rounded-t-[0.12rem] border-x border-t border-white/55" />
                </span>
                <span>카메라{cameraMode}</span>
              </button>
            ) : null}
            {showMinimap ? (
              <ExcavatorMinimap
                simRef={simRef}
                terrainRef={terrainRef}
                tutorialStepRef={tutorialStepRef}
                visible
                embedded
                displaySize={88}
              />
            ) : null}
          </div>
        )}

        {mode === "tutorial" && tutorialStep?.id === "dump" ? (
          <DumpHintPanel
            bucketLoad={hud.bucketLoad}
            inDumpZone={digFeedback.inDumpZone}
            canDump={digFeedback.canDump}
            raiseArmForDump={digFeedback.raiseArmForDump}
            truckCooldownRemaining={digFeedback.truckCooldownRemaining}
            truckCanAccept={digFeedback.truckCanAccept}
            show
          />
        ) : null}

        {mode === "tutorial" && tutorialStep?.waypoint && (
          <div className="absolute left-2 top-[12.25rem] z-20 rounded-lg bg-sky-600/85 px-2 py-1 text-[10px] font-semibold text-white">
            목표까지 {hud.goalDist}m
          </div>
        )}

        {mode !== "intro" && <RewardPopupOverlay panel={dumpScorePanel} />}
        {mode !== "intro" && <CouponDiscoveryOverlay discovery={couponDiscovery} />}
        {mode !== "intro" && poseSaveToastVisible ? (
          <div key={poseSaveToastKey} className="yanmar-pose-save-toast" role="status">
            현재 자세가 저장되었습니다.
          </div>
        ) : null}
        {mode !== "intro" && attachmentWarning ? (
          <div
            key={attachmentWarning.key}
            className="yanmar-attachment-warning-toast"
            role="status"
            aria-live="polite"
          >
            {attachmentWarning.message}
          </div>
        ) : null}
        {mode !== "intro" && levelUpToast ? (
          <div
            key={levelUpToast.key}
            className="yanmar-level-up-toast"
            role="status"
            aria-live="polite"
          >
            <p className="yanmar-level-up-toast-title">레벨이 상승했습니다.</p>
            <p className="yanmar-level-up-toast-level">
              현재 레벨 <span>{levelUpToast.level}</span>
            </p>
          </div>
        ) : null}
        <AttachmentUnlockOverlay
          unlock={unlockQueue[0]}
          onClose={() => {
            setUnlockQueue((queue) => queue.slice(1));
          }}
        />

        <YanmarGameSettingsMenu
          immersive={immersive}
          show={mode !== "intro"}
          open={showSettingsMenu}
          onOpenChange={setShowSettingsMenu}
          showMinimap={showMinimap}
          onToggleMinimap={() => setShowMinimap((v) => !v)}
          showDigPose={showDigPoseGraph}
          onToggleDigPose={() => setShowDigPoseGraph((v) => !v)}
          showTouchZones={showTouchZones}
          onToggleTouchZones={() => setShowTouchZones((v) => !v)}
          touchZonesAvailable={mode !== "gameReady"}
          onOpenControlsGuide={() => setShowControlsGuide(true)}
          onResetPosition={resetExcavatorPosition}
          onShowRanking={onShowRanking}
        />

        {stepCompleteFlash && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
            <div className="rounded-xl bg-emerald-500/90 px-4 py-2 text-sm font-bold text-white shadow-lg">
              ✓ 완료!
            </div>
          </div>
        )}

        {mode !== "intro" && (
          <div className="pointer-events-none absolute inset-0 z-0">
            <ExcavatorScene
              inputRef={inputRef}
              simRef={simRef}
              velRef={velRef}
              terrainRef={terrainRef}
              terrainRevision={terrainRevision}
              scoreRef={scoreRef}
              modeRef={modeRef}
              equipmentStatsRef={equipmentStatsRef}
              allowedRef={allowedRef}
              auxiliaryRef={auxiliaryRef}
              autoPoseRef={autoPoseRef}
              tutorialStepRef={tutorialStepRef}
              tutorialDumpRef={tutorialDumpRef}
              digFeedbackRef={digFeedbackRef}
              dumpTruckStateRef={dumpTruckStateRef}
              dumpTruckPoseRef={dumpTruckPoseRef}
              onProgress={handleProgress}
              onDumpScore={handleDumpScore}
              onCrashTileDestroyed={handleCrashTileDestroyed}
              onHillRockDelivered={handleHillRockDelivered}
              onAttachmentWarning={showAttachmentWarning}
              onSimTick={handleSimTick}
              cameraMode={cameraMode}
            />
          </div>
        )}

        {mode !== "intro" && (
          <CockpitOverlay
            mode={mode}
            input={input}
            onInputChange={(next) => {
              touchInputRef.current =
                typeof next === "function" ? next(touchInputRef.current) : next;
              syncMergedInput();
              const merged = filterInput(
                mergeControlInputs(touchInputRef.current, keyboardInputRef.current),
                allowedRef.current,
              );
              if (
                autoPoseRef.current.executing &&
                hasManualControlInput(merged, allowedRef.current, auxiliaryRef.current)
              ) {
                cancelAutoArmPose(autoPoseRef.current);
                setAutoPose({ ...autoPoseRef.current });
              }
            }}
            auxiliary={auxiliary}
            onAuxiliaryChange={handleAuxiliaryChange}
            attachmentType={attachmentType}
            playerLevel={getPlayerLevelProgress(totalXp).level}
            unlockAllAttachments={practiceUnlocksAll}
            onAttachmentChange={handleAttachmentChange}
            onAttachmentWarning={showAttachmentWarning}
            autoPose={autoPose}
            onSavePose={handleSavePose}
            onExecutePose={handleExecutePose}
            savePoseDisabled={savePoseOnCooldown}
            executePoseDisabled={executePoseOnCooldown}
            allowed={allowed}
            tutorialStep={tutorialStep}
            showTouchZones={showTouchZones}
            onOpenEquipmentUpgrade={() => setShowEquipmentUpgrade(true)}
            onHorn={handleHornQuest}
          />
        )}

        {mode === "intro" && initialPlayMode && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950">
            <div className="text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-red-500" />
              <p className="text-xs font-bold text-white/70">시뮬레이터 준비 중</p>
            </div>
          </div>
        )}
      </div>
      {!immersive && (
        <p className="mt-2 text-center text-xs text-gray-400">
          얀마 · 굴삭기로 흙을 퍼서 옮기기
        </p>
      )}
    </div>
  );
}
