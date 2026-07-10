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
import type { CameraMode, CouponDiscoveryState, DumpScorePopup, DumpScorePanelState, ExcavatorSimState, AutoPoseState } from "./types";
import { EquipmentUpgradePanel } from "./EquipmentUpgradePanel";
import {
  createHydraulicVelocity,
  createAutoPoseState,
  startAutoArmPose,
  type HydraulicVelocity,
} from "./controls";
import { ExcavatorMinimap } from "./ExcavatorMinimap";
import { DigPoseGraph } from "./DigHintPanel";
import { DumpHintPanel } from "./DumpHintPanel";
import { ControlsGuidePanel } from "./ControlsGuidePanel";
import { YanmarGameSettingsMenu } from "./YanmarGameSettingsMenu";
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
  loadSavedArmPose,
  saveSavedArmPose,
} from "./autoPosePersistence";
import {
  createDumpTruckState,
  formatDumpTruckReturnTime,
  getDumpTruckPose,
  type DumpTruckPose,
} from "./dumpTruckState";
import type { TerrainData } from "./terrain";
import {
  DEFAULT_YANMAR_EQUIPMENT_LEVELS,
  YANMAR_EQUIPMENT_RESET_REFUND_RATE,
  YANMAR_EQUIPMENT_CONFIG,
  calculateYanmarEquipmentStats,
  getLoadUnits,
  getYanmarPartResetRefundStars,
  getYanmarUpgradeCost,
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
import { getPlayerLevelProgress } from "@/lib/playerLevel";

interface ExcavatorGameWrapperProps {
  onEnd: (result: GameResult) => void;
  exitSignal?: number;
  resumeSignal?: number;
  immersive?: boolean;
  initialPlayMode?: "practice" | "game" | "ride";
  onShowRanking?: () => void;
  myRank?: number | null;
  bestScore?: number;
}

type DumpRewardApiEvent =
  | {
      kind: "coupon";
      score: number;
      critical: boolean;
      couponType: "YK_PARTS_DISCOUNT" | "EQUIPMENT_RENTAL_DISCOUNT";
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
              튜토리얼 없이 모든 조작을 자유롭게 사용
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

function formatDumpScorePanelReward(panel: DumpScorePanelState) {
  const starSummary =
    panel.earnedStars > 0 ? `⭐ ${panel.earnedStars.toLocaleString()}` : "";
  if (panel.pendingRewards > 0) {
    if (starSummary && panel.rewardText) {
      return `${starSummary} · ${panel.rewardText} · 보상 확인중`;
    }
    if (starSummary) return `${starSummary} · 보상 확인중`;
    if (panel.rewardText) return `${panel.rewardText} · 보상 확인중`;
    return "보상 확인중";
  }
  if (starSummary && panel.rewardText) {
    return `${starSummary} · ${panel.rewardText}`;
  }
  return starSummary || panel.rewardText;
}

function RewardPopupOverlay({ panel }: { panel: DumpScorePanelState | null }) {
  if (!panel) return null;

  const rewardText = formatDumpScorePanelReward(panel);

  return (
    <div className="pointer-events-none absolute left-1/2 top-[4.25rem] z-50 w-[16rem] -translate-x-1/2">
      <div
        className={`yanmar-score-panel rounded-xl border px-4 py-2.5 text-center font-black shadow-xl backdrop-blur-md ${
          panel.critical
            ? "border-yellow-200/70 bg-black/80 text-yellow-300"
            : "border-white/25 bg-black/78 text-slate-300"
        }`}
      >
        <div
          key={panel.pulseKey}
          className={`yanmar-score-panel-value ${panel.critical ? "text-sm" : "text-xs"}`}
        >
          +{panel.totalScore}
        </div>
        {rewardText ? (
          <div className="yanmar-score-panel-reward mt-1 text-[10px] font-bold text-white/90">
            {rewardText}
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
          {label} {discovery.discountPct}% 할인 쿠폰을 발견했습니다!!
        </p>
      </div>
    </div>
  );
}

export function ExcavatorGameWrapper({
  onEnd,
  exitSignal = 0,
  resumeSignal = 0,
  immersive = false,
  initialPlayMode,
  onShowRanking,
  myRank = null,
  bestScore = 0,
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
  const [savePoseCooldownUntil, setSavePoseCooldownUntil] = useState(0);
  const [executePoseCooldownUntil, setExecutePoseCooldownUntil] = useState(0);
  const poseSaveToastTimerRef = useRef<number | null>(null);
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
  const [currency, setCurrency] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [previewStars, setPreviewStars] = useState(0);
  const [stepCompleteFlash, setStepCompleteFlash] = useState(false);
  const [showControlsGuide, setShowControlsGuide] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showDigPoseGraph, setShowDigPoseGraph] = useState(true);
  const [showTutorialMenu, setShowTutorialMenu] = useState(false);
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
        width: "min(100cqw, calc(100cqh * 9 / 16))",
        height: "min(100cqh, calc(100cqw * 16 / 9))",
      }
    : undefined;
  const endedRef = useRef(false);
  const elapsedRef = useRef(0);
  const tutorialDumpRef = useRef(0);
  const tutorialCompletingRef = useRef(false);
  const tutorialIndexRef = useRef(0);
  const digFeedbackRef = useRef<DigFeedback>(createDigFeedback());
  const [digFeedback, setDigFeedback] = useState<DigFeedback>(createDigFeedback());
  const dumpTruckStateRef = useRef(createDumpTruckState());
  const dumpTruckPoseRef = useRef<DumpTruckPose>(getDumpTruckPose(dumpTruckStateRef.current));
  const digHudTickRef = useRef(0);
  const lastHudProgressRef = useRef(-1);
  const arcadeScoreRef = useRef(0);
  const rewardStarsRef = useRef(0);
  const currencyRef = useRef(0);
  const processedExitSignalRef = useRef(0);
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
    if (digHudTickRef.current % 3 !== 0) return;
    const fb = digFeedbackRef.current;
    setDigFeedback((prev) =>
      prev.inDigZone === fb.inDigZone &&
      prev.inDumpZone === fb.inDumpZone &&
      prev.tipOnGround === fb.tipOnGround &&
      prev.bucketCurled === fb.bucketCurled &&
      prev.canLoad === fb.canLoad &&
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
    const userId = session?.user?.id;
    if (!userId) return;

    dumpTruckUserIdRef.current = userId;
    gameSessionUserIdRef.current = userId;

    const savedPose = loadSavedArmPose(userId);
    if (savedPose) {
      autoPoseRef.current.saved = savedPose;
      setAutoPose({ ...autoPoseRef.current });
    }

    if (modeRef.current === "game" && !gameSessionRestoredRef.current) {
      const snapshot = loadYanmarGameSession(userId);
      gameSessionRestoredRef.current = true;
      if (snapshot) applyGameSnapshot(snapshot);
    } else if (modeRef.current !== "game" && !gameSessionRestoredRef.current) {
      const restored = loadDumpTruckCooldown(userId);
      if (restored) {
        Object.assign(dumpTruckStateRef.current, restored);
        dumpTruckPoseRef.current = getDumpTruckPose(dumpTruckStateRef.current);
      }
    }

    return () => {
      persistGameSession(true);
      persistDumpTruckCooldown(true);
      dumpTruckUserIdRef.current = null;
      gameSessionUserIdRef.current = null;
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
    };
    window.addEventListener("pagehide", saveBeforeLeaving);
    return () => window.removeEventListener("pagehide", saveBeforeLeaving);
  }, [persistDumpTruckCooldown, persistGameSession]);

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
        setTotalXp(data.totalXp);
      }
    } catch {
      // Equipment data is optional for unauthenticated previews.
    }
  }, []);

  useEffect(() => {
    const sessionXp = session?.user?.totalXp;
    if (typeof sessionXp === "number" && sessionXp >= 0) {
      setTotalXp((prev) => (prev > 0 ? prev : sessionXp));
    }
  }, [session?.user?.totalXp]);

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

  const handleAuxiliaryChange = useCallback((next: AuxiliaryControlState | ((current: AuxiliaryControlState) => AuxiliaryControlState)) => {
    const resolved = typeof next === "function" ? next(auxiliaryRef.current) : next;
    if (autoPoseRef.current.executing) {
      const prev = auxiliaryRef.current;
      if (
        prev.boomSwing !== resolved.boomSwing ||
        prev.highSpeed !== resolved.highSpeed ||
        prev.safetyLocked !== resolved.safetyLocked ||
        prev.blade !== resolved.blade ||
        prev.throttle !== resolved.throttle
      ) {
        cancelAutoArmPose(autoPoseRef.current);
        setAutoPose({ ...autoPoseRef.current });
      }
    }
    auxiliaryRef.current = resolved;
    setAuxiliary(resolved);
    if (resolved.safetyLocked) {
      clearAllInput();
    }
  }, [clearAllInput, setAuxiliary]);

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

  const handleSavePose = useCallback(() => {
    const now = Date.now();
    if (now < savePoseCooldownUntil) return;

    const sim = simRef.current;
    const pose = {
      boom: sim.boom,
      arm: sim.arm,
      bucket: sim.bucket,
    };
    autoPoseRef.current.saved = pose;
    if (autoPoseRef.current.executing) {
      cancelAutoArmPose(autoPoseRef.current);
    }
    setAutoPose({ ...autoPoseRef.current });

    const userId = session?.user?.id ?? gameSessionUserIdRef.current;
    if (userId) {
      saveSavedArmPose(userId, pose, now);
    }

    setSavePoseCooldownUntil(now + poseActionCooldownMs);
    showPoseSaveToast();
  }, [poseActionCooldownMs, savePoseCooldownUntil, session?.user?.id, showPoseSaveToast]);

  const handleExecutePose = useCallback(() => {
    const now = Date.now();
    if (now < executePoseCooldownUntil) return;
    if (!startAutoArmPose(autoPoseRef.current)) return;
    setAutoPose({ ...autoPoseRef.current });
    setExecutePoseCooldownUntil(now + poseActionCooldownMs);
  }, [executePoseCooldownUntil, poseActionCooldownMs]);

  const resetYanmarSession = useCallback(() => {
    resetSim(simRef.current, velRef.current);
    terrainRef.current = createInitialTerrain();
    scoreRef.current = createScoreState(config.target, config.duration);
    tutorialDumpRef.current = 0;
    dumpTruckPoseRef.current = getDumpTruckPose(dumpTruckStateRef.current);
    endedRef.current = false;
    elapsedRef.current = 0;
    lastHudProgressRef.current = -1;
    arcadeScoreRef.current = 0;
    rewardStarsRef.current = 0;
    setPreviewStars(currencyRef.current);
    tutorialCompletingRef.current = false;
    const nextAuxiliary = createAuxiliaryControls();
    auxiliaryRef.current = nextAuxiliary;
    setAuxiliary(nextAuxiliary);
    // 저장된 자세는 세션 리셋 후에도 유지 (종료 후 재입장 시 실행 가능)
    const userId = session?.user?.id ?? gameSessionUserIdRef.current;
    const persistedPose = userId ? loadSavedArmPose(userId) : null;
    autoPoseRef.current = createAutoPoseState();
    if (persistedPose) {
      autoPoseRef.current.saved = persistedPose;
    }
    setAutoPose({ ...autoPoseRef.current });
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
    terrainRef.current = createInitialTerrain(false);
    tutorialStepRef.current = null;
    setShowTutorialMenu(false);
    setShowTouchZones(false);
    setShowEquipmentUpgrade(false);
    setMode("ride");
  }, [resetYanmarSession, setMode, setShowTutorialMenu, setShowTouchZones]);

  const enterPracticeMode = useCallback(() => {
    resetYanmarSession();
    terrainRef.current = createInitialTerrain(true);
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
    terrainRef.current = createInitialTerrain(true);
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
    resetYanmarSession();
    const step = TUTORIAL_STEPS[index] ?? null;
    tutorialCompletingRef.current = false;
    tutorialIndexRef.current = index;
    tutorialStepRef.current = step;
    setTutorialIndex(index);
    setShowTutorialMenu(false);
    setMode("tutorial");
  }, [resetYanmarSession, setMode, setShowTutorialMenu, setTutorialIndex]);

  const startFreePractice = useCallback(() => {
    resetYanmarSession();
    tutorialStepRef.current = null;
    setShowTutorialMenu(false);
    setMode("practice");
  }, [resetYanmarSession, setMode, setShowTutorialMenu]);

  const handleSimTick = useCallback(() => {
    syncDigHud();
    persistGameSession();
    persistDumpTruckCooldown();

    if (modeRef.current !== "tutorial") return;
    if (tutorialCompletingRef.current) return;

    const step = tutorialStepRef.current;
    if (!step) return;

    if (checkTutorialStepComplete(step, simRef.current, tutorialDumpRef.current)) {
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
    (score: number, critical: boolean, rewardText = "") => {
      arcadeScoreRef.current += score;
      setHud((h) => ({ ...h, score: arcadeScoreRef.current }));

      const previous = dumpScorePanelRef.current;
      const next: DumpScorePanelState = {
        totalScore: (previous?.totalScore ?? 0) + score,
        critical: (previous?.critical ?? false) || critical,
        rewardText: appendRewardText(previous?.rewardText ?? "", rewardText),
        earnedStars: previous?.earnedStars ?? 0,
        pendingRewards: previous?.pendingRewards ?? 0,
        pulseKey: (previous?.pulseKey ?? 0) + 1,
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
      patch: Partial<Pick<DumpScorePanelState, "rewardText" | "critical" | "earnedStars">> = {},
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
    if (modeRef.current !== "game") {
      const stars = Math.floor(Math.random() * 3) + 1;
      setPreviewStars((value) => value + stars);
      accumulateDumpScore(popup.score, popup.critical);
      const panel = dumpScorePanelRef.current;
      if (panel) {
        const next = { ...panel, earnedStars: panel.earnedStars + stars };
        dumpScorePanelRef.current = next;
        setDumpScorePanel(next);
        scheduleHideDumpScorePanel();
      }
      return;
    }

    accumulateDumpScore(popup.score, popup.critical);
    const panel = dumpScorePanelRef.current;
    if (panel) {
      panel.pendingRewards += 1;
      dumpScorePanelRef.current = { ...panel };
      setDumpScorePanel({ ...panel });
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
        if (typeof data.currency === "number") {
          currencyRef.current = data.currency;
          setCurrency(data.currency);
          await updateSessionRef.current({ user: { currency: data.currency } });
        }
        if (typeof data.totalXp === "number") {
          setTotalXp(data.totalXp);
          await updateSessionRef.current({ user: { totalXp: data.totalXp } });
        }
        if (!event) {
          adjustDumpScorePanel(0, {
            rewardText: appendRewardText(dumpScorePanelRef.current?.rewardText ?? "", "보상 완료"),
          });
          return;
        }
        if (event.kind === "stars") {
          rewardStarsRef.current += event.stars;
          adjustDumpScorePanel(event.score - popup.score, {
            critical: event.critical || dumpScorePanelRef.current?.critical,
            earnedStars: rewardStarsRef.current,
          });
          return;
        }
        showCouponDiscovery(event.couponType, event.discountPct);
        adjustDumpScorePanel(event.score - popup.score, {
          critical: true,
        });
      } catch {
        adjustDumpScorePanel(0, {
          rewardText: appendRewardText(dumpScorePanelRef.current?.rewardText ?? "", "저장 실패"),
        });
      }
    })();
  }, [accumulateDumpScore, adjustDumpScorePanel, scheduleHideDumpScorePanel, showCouponDiscovery]);

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
      }
      if (keys.has("s") || keys.has("arrowdown")) {
        travel.left = -1;
        travel.right = -1;
      }
      if (keys.has("z")) travel.left = 1;
      if (keys.has("x")) travel.right = 1;
      if (keys.has("c")) travel.left = -1;
      if (keys.has("v")) travel.right = -1;
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
          ? "flex h-full w-full items-center justify-center overflow-hidden bg-slate-950"
          : "mx-auto w-full max-w-lg"
      } yanmar-layout-portrait`}
      style={immersive ? { containerType: "size" } : undefined}
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
          <div className="pointer-events-none absolute left-1/2 top-[3.25rem] z-[60] w-[min(18rem,88%)] -translate-x-1/2 rounded-xl border border-amber-300/45 bg-amber-500/90 px-3 py-2 text-center text-[11px] font-black leading-snug text-white shadow-xl backdrop-blur-sm">
            ⚠️ 붐을 더 들어야 움직일 수 있습니다
          </div>
        ) : null}

        {mode === "ride" ? (
          <div className="pointer-events-none absolute left-1/2 top-2 z-50 -translate-x-1/2 rounded-xl border border-sky-200/35 bg-sky-950/75 px-3 py-1.5 text-[11px] font-black text-sky-100 shadow-lg backdrop-blur-sm">
            탑승 체험 · 실제 조작 시뮬레이터
          </div>
        ) : null}

        {mode !== "intro" && mode !== "gameReady" && mode !== "ride" && (
          <div className="absolute left-2 top-2 z-50 flex max-w-[9.75rem] flex-col items-start gap-1.5">
            {(mode === "practice" || mode === "tutorial") && (
              <button
                type="button"
                onClick={() => setShowTutorialMenu(true)}
                className="rounded-lg border border-white/20 bg-black/70 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-lg backdrop-blur-sm hover:bg-black/85"
              >
                튜토리얼
              </button>
            )}
            <div className="flex w-full min-w-0 flex-col items-center gap-1 rounded-lg border border-orange-100/20 bg-black/60 px-2.5 py-2 text-center shadow-lg backdrop-blur-sm">
              <span className="text-[10px] font-black text-orange-100">적재량</span>
              <span className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                <span
                  className="block h-full rounded-full bg-orange-300 transition-all duration-150"
                  style={{ width: `${loadOverlayPercent}%` }}
                />
              </span>
              <span className="text-[9px] font-bold tabular-nums text-orange-50">
                {loadOverlayUnits}/{equipmentStats.maxLoadUnits} ({Math.round(loadOverlayPercent)}%)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowEquipmentUpgrade(true)}
              className="rounded-lg border border-amber-200/30 bg-amber-500/90 px-2.5 py-1.5 text-[11px] font-black text-white shadow-lg backdrop-blur-sm hover:bg-amber-400"
            >
              장비강화
            </button>
          </div>
        )}

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
            <div className="rounded-xl border border-white/15 bg-black/45 px-3 py-1.5 text-[11px] font-black text-white shadow-lg backdrop-blur-sm">
              점수 <span className="text-yellow-100">{hud.score.toLocaleString()}</span>
            </div>
            {digFeedback.canDump && hud.bucketLoad > 0.02 ? (
              <div className="rounded-xl border border-emerald-200/50 bg-emerald-500/90 px-3 py-1 text-[10px] font-black text-white shadow-lg backdrop-blur-sm">
                하역가능
              </div>
            ) : digFeedback.soilSpilling && hud.bucketLoad > 0.02 ? (
              <div className="rounded-xl border border-amber-200/50 bg-amber-600/90 px-3 py-1 text-[10px] font-black text-white shadow-lg backdrop-blur-sm">
                흙 유실 — 버킷 말기
              </div>
            ) : digFeedback.raiseArmForDump && hud.bucketLoad > 0.02 ? (
              <div className="rounded-xl border border-sky-200/50 bg-sky-600/90 px-3 py-1 text-[10px] font-black text-white shadow-lg backdrop-blur-sm">
                붐·암 들기
              </div>
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
                        <div className="flex max-w-[min(42vw,12rem)] min-w-0 items-center text-white">
                          <div className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/25 px-2 py-1">
                            <div className="flex items-baseline gap-1">
                              <p className="truncate text-[10px] font-black leading-none">
                                {nickname}
                              </p>
                              <span className="shrink-0 text-[9px] font-black text-amber-200">
                                Lv.{xpProgress.level}
                              </span>
                            </div>
                            <XpProgressBar
                              progress={xpProgress}
                              compact
                              showLabel={false}
                              className="mt-0.5"
                              barClassName="bg-white/20"
                            />
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
          <div className="absolute left-2 top-[5.25rem] z-40 w-[8.75rem] rounded-xl border border-amber-300/20 bg-black/75 p-2 text-white shadow-xl backdrop-blur-sm">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-amber-300">{tutorialStep.title}</p>
              <p className="mt-0.5 text-[10px] leading-tight text-white/85">
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

        {mode !== "intro" && mode !== "gameReady" && (
          <div className="absolute right-2 top-2 z-30 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCameraMode((current) => ((current % 3) + 1) as CameraMode)}
              className="flex h-[30px] items-center gap-1 rounded-lg border border-white/20 bg-black/70 px-2 text-[10px] font-black text-white shadow-lg backdrop-blur-sm hover:bg-black/85"
              aria-label={`카메라 ${cameraMode}번 시점`}
            >
              <span
                className="relative h-3.5 w-5 rounded-[0.25rem] border border-white/65"
                aria-hidden
              >
                <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/75" />
                <span className="absolute left-1 top-[-0.22rem] h-1 w-2 rounded-t-[0.18rem] border-x border-t border-white/55" />
              </span>
              <span>카메라{cameraMode}</span>
            </button>
          </div>
        )}

        {mode !== "intro" && showMinimap && (
          <ExcavatorMinimap
            simRef={simRef}
            terrainRef={terrainRef}
            tutorialStepRef={tutorialStepRef}
            visible
            displaySize={88}
          />
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

        {mode !== "intro" && showDigPoseGraph && (
          <div className="yanmar-dig-pose-panel pointer-events-none absolute right-[8.25rem] top-2 z-20 w-[116px] rounded-sm border border-white/10 bg-black/55 px-2 py-1.5 text-white shadow-xl backdrop-blur-sm">
            <DigPoseGraph
              boom={hud.boom}
              arm={hud.arm}
              bucket={hud.bucket}
              feedback={digFeedback}
            />
          </div>
        )}

        {mode !== "intro" && <RewardPopupOverlay panel={dumpScorePanel} />}
        {mode !== "intro" && <CouponDiscoveryOverlay discovery={couponDiscovery} />}
        {mode !== "intro" && poseSaveToastVisible ? (
          <div key={poseSaveToastKey} className="yanmar-pose-save-toast" role="status">
            현재 자세가 저장되었습니다.
          </div>
        ) : null}

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
          onShowRanking={onShowRanking}
          myRank={myRank}
          bestScore={bestScore}
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
              onSimTick={handleSimTick}
              cameraMode={cameraMode}
            />
          </div>
        )}

        {mode !== "intro" && (
          <CockpitOverlay
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
            autoPose={autoPose}
            onSavePose={handleSavePose}
            onExecutePose={handleExecutePose}
            savePoseDisabled={savePoseOnCooldown}
            executePoseDisabled={executePoseOnCooldown}
            allowed={allowed}
            tutorialStep={tutorialStep}
            showTouchZones={showTouchZones}
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
