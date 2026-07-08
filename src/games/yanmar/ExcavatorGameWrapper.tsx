"use client";

/* eslint-disable react-hooks/immutability, react-hooks/refs, react-hooks/preserve-manual-memoization, react-hooks/set-state-in-effect */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { GAME_IMMERSIVE_HEADER_RIGHT_ID } from "@/components/games/GameImmersiveOverlay";
import type { GameResult } from "@/games/shared/types";
import { getMissionConfig } from "@/games/registry";
import type { AuxiliaryControlState, ControlMask, ExcavatorControlState } from "./controls";
import {
  COCKPIT_LAYOUT,
  LOCKED_CONTROLS,
  createAuxiliaryControls,
  filterInput,
  mergeControlInputs,
} from "./controls";
import { CockpitOverlay } from "./CockpitOverlay";
import {
  ExcavatorScene,
  type DumpScorePopup,
  type CameraMode,
  createInitialSim,
  createInitialTerrain,
  type ExcavatorSimState,
} from "./ExcavatorScene";
import { createHydraulicVelocity, type HydraulicVelocity } from "./controls";
import { ExcavatorMinimap } from "./ExcavatorMinimap";
import { DigPoseGraph } from "./DigHintPanel";
import { DumpHintPanel } from "./DumpHintPanel";
import { ControlsGuidePanel } from "./ControlsGuidePanel";
import { YanmarGameSettingsMenu } from "./YanmarGameSettingsMenu";
import { createDigFeedback, type DigFeedback } from "./bucket";
import type { TerrainData } from "./terrain";
import {
  DEFAULT_YANMAR_EQUIPMENT_LEVELS,
  YANMAR_EQUIPMENT_RESET_REFUND_RATE,
  YANMAR_EQUIPMENT_CONFIG,
  calculateYanmarEquipmentStats,
  getLoadUnits,
  getYanmarResetRefundStars,
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

interface ExcavatorGameWrapperProps {
  onEnd: (result: GameResult) => void;
  immersive?: boolean;
  initialPlayMode?: "practice" | "game";
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

function EquipmentUpgradeModal({
  open,
  mode,
  levels,
  currency,
  previewStars,
  upgradingPart,
  resettingEquipment,
  onClose,
  onUpgrade,
  onResetEquipment,
}: {
  open: boolean;
  mode: GameMode;
  levels: YanmarEquipmentLevels;
  currency: number;
  previewStars: number;
  upgradingPart: YanmarEquipmentPart | null;
  resettingEquipment: boolean;
  onClose: () => void;
  onUpgrade: (part: YanmarEquipmentPart) => void;
  onResetEquipment: () => void;
}) {
  if (!open) return null;

  const previewMode = mode !== "game";
  const balance = previewMode ? previewStars : currency;
  const hasPreviewUpgrade = (Object.keys(YANMAR_EQUIPMENT_CONFIG) as YanmarEquipmentPart[]).some(
    (part) => levels[part] !== DEFAULT_YANMAR_EQUIPMENT_LEVELS[part],
  );
  const resetRefundStars = getYanmarResetRefundStars(levels);

  return (
    <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-gradient-to-br from-slate-800 to-slate-950 px-4 py-3 text-white">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-200">
              Yanmar Parts
            </p>
            <h2 className="text-base font-black">장비강화</h2>
            <p className="mt-0.5 text-[10px] text-white/65">
              {previewMode ? "튜토리얼 임시 강화" : "본게임 실제 강화"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/15 px-2.5 py-1 text-xs font-bold hover:bg-white/25"
          >
            닫기
          </button>
        </div>
        <div className="space-y-2 p-3">
          <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
            {previewMode ? "체험 스타" : "보유 스타"} ⭐ {balance.toLocaleString()}
          </div>
          {hasPreviewUpgrade ? (
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
              {previewMode
                ? "튜토리얼 강화는 언제든 기본값으로 되돌릴 수 있습니다."
                : `강화 초기화 시 사용한 스타의 ${Math.round(
                    YANMAR_EQUIPMENT_RESET_REFUND_RATE * 100,
                  )}%인 ${resetRefundStars.toLocaleString()} 스타를 돌려받습니다.`}
            </p>
          ) : null}
          {previewMode || hasPreviewUpgrade ? (
            <button
              type="button"
              onClick={onResetEquipment}
              disabled={!hasPreviewUpgrade || resettingEquipment}
              className="w-full rounded-xl border border-slate-200 bg-slate-900 px-3 py-2 text-xs font-black text-white disabled:bg-gray-200 disabled:text-gray-400"
            >
              {resettingEquipment
                ? "초기화중"
                : previewMode
                  ? "튜토리얼 강화 초기화"
                  : "강화 초기화 (70% 환급)"}
            </button>
          ) : null}
          {(Object.keys(YANMAR_EQUIPMENT_CONFIG) as YanmarEquipmentPart[]).map((part) => {
            const config = YANMAR_EQUIPMENT_CONFIG[part];
            const level = levels[part];
            const nextLevel = level + 1;
            const cost = getYanmarUpgradeCost(part, nextLevel);
            const maxed = level >= config.maxLevel;
            const disabled =
              upgradingPart === part || maxed || (!previewMode && balance < cost);
            return (
              <div key={part} className="rounded-xl border border-gray-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-gray-900">
                      {config.label} 강화 +{level}
                    </p>
                    <p className="mt-0.5 text-[10px] text-gray-500">
                      {config.description} · 최대 +{config.maxLevel}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpgrade(part)}
                    disabled={disabled}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:bg-gray-300"
                  >
                    {maxed
                      ? "최대"
                      : upgradingPart === part
                        ? "강화중"
                        : previewMode
                          ? "체험 강화"
                          : `${cost} 스타`}
                  </button>
                </div>
                {!previewMode && !maxed && balance < cost ? (
                  <p className="mt-1 text-[10px] text-red-500">스타가 부족합니다.</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function resetSim(sim: ExcavatorSimState, vel: HydraulicVelocity) {
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
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-red-600 to-red-800 px-4 py-3 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-widest opacity-80">Practice</p>
          <h2 className="mt-1 text-base font-black">튜토리얼 선택</h2>
          <p className="mt-1 text-[11px] opacity-85">원하는 조작만 골라서 연습할 수 있습니다.</p>
        </div>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto p-3">
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
        <div className="border-t border-gray-100 p-3">
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

function RewardPopupOverlay({ popups }: { popups: DumpScorePopup[] }) {
  if (popups.length === 0) return null;

  return (
    <div className="pointer-events-none absolute left-1/2 top-[4.25rem] z-50 flex w-[16rem] -translate-x-1/2 flex-col-reverse items-center gap-2">
      {popups.map((popup, index) => (
        <div
          key={popup.id}
          className={`yanmar-score-pop rounded-xl border px-3.5 py-2 text-center font-black shadow-xl backdrop-blur-md ${
            popup.critical
              ? "border-yellow-200/70 bg-black/80 text-yellow-300"
              : "border-white/25 bg-black/78 text-slate-300"
          }`}
          style={{ animationDelay: `${index * 180}ms` }}
        >
          <span className={popup.critical ? "text-sm" : "text-xs"}>+{popup.score}</span>
          {popup.rewardText ? (
            <span className="ml-2 text-[10px] font-bold text-white/90">{popup.rewardText}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function ExcavatorGameWrapper({
  onEnd,
  immersive = false,
  initialPlayMode,
  onShowRanking,
  myRank = null,
  bestScore = 0,
}: ExcavatorGameWrapperProps) {
  const config = getMissionConfig("yanmar");
  const { update } = useSession();
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
  const [hud, setHud] = useState({
    progress: 0,
    timeLeft: config.duration,
    bucketLoad: 0,
    goalDist: 0,
    boom: 0.45,
    arm: -0.95,
    bucket: -0.12,
    score: 0,
  });
  const [scorePopups, setScorePopups] = useState<DumpScorePopup[]>([]);
  const [equipmentLevels, setEquipmentLevels] = useState<YanmarEquipmentLevels>(
    DEFAULT_YANMAR_EQUIPMENT_LEVELS,
  );
  const [equipmentStats, setEquipmentStats] =
    useState<YanmarEquipmentStats>(defaultEquipmentStats);
  const [currency, setCurrency] = useState(0);
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
  const [cameraMode, setCameraMode] = useState<CameraMode>(1);
  const endedRef = useRef(false);
  const elapsedRef = useRef(0);
  const tutorialDumpRef = useRef(0);
  const tutorialCompletingRef = useRef(false);
  const tutorialIndexRef = useRef(0);
  const digFeedbackRef = useRef<DigFeedback>(createDigFeedback());
  const [digFeedback, setDigFeedback] = useState<DigFeedback>(createDigFeedback());
  const digHudTickRef = useRef(0);
  const lastHudProgressRef = useRef(-1);
  const arcadeScoreRef = useRef(0);
  const scorePopupIdRef = useRef(0);
  const equipmentStatsRef = useRef<YanmarEquipmentStats>(defaultEquipmentStats);
  const updateSessionRef = useRef(update);
  updateSessionRef.current = update;

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
      Math.abs(prev.digPoseScore - fb.digPoseScore) < 0.01
        ? prev
        : { ...fb },
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
  }, [setDigFeedback, setHud]);

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
      if (typeof data.currency === "number") setCurrency(data.currency);
    } catch {
      // Equipment data is optional for unauthenticated previews.
    }
  }, []);

  useEffect(() => {
    void loadEquipment();
  }, [loadEquipment]);

  useEffect(() => {
    setHeaderHudReady(true);
  }, []);

  useEffect(() => {
    tutorialStepRef.current = tutorialStep;
    tutorialIndexRef.current = tutorialIndex;
  }, [tutorialIndex, tutorialStep]);

  useEffect(() => {
    allowedRef.current = allowed;
    syncMergedInput();
  }, [allowed, syncMergedInput]);

  useEffect(() => {
    auxiliaryRef.current = auxiliary;
  }, [auxiliary]);

  const handleAuxiliaryChange = useCallback((next: AuxiliaryControlState | ((current: AuxiliaryControlState) => AuxiliaryControlState)) => {
    const resolved = typeof next === "function" ? next(auxiliaryRef.current) : next;
    auxiliaryRef.current = resolved;
    setAuxiliary(resolved);
    if (resolved.safetyLocked) {
      clearAllInput();
    }
  }, [clearAllInput, setAuxiliary]);

  const resetYanmarSession = useCallback(() => {
    resetSim(simRef.current, velRef.current);
    terrainRef.current = createInitialTerrain();
    scoreRef.current = createScoreState(config.target, config.duration);
    tutorialDumpRef.current = 0;
    endedRef.current = false;
    elapsedRef.current = 0;
    lastHudProgressRef.current = -1;
    arcadeScoreRef.current = 0;
    setPreviewStars(0);
    tutorialCompletingRef.current = false;
    const nextAuxiliary = createAuxiliaryControls();
    auxiliaryRef.current = nextAuxiliary;
    setAuxiliary(nextAuxiliary);
    clearAllInput();
    setScorePopups([]);
    setHud({
      progress: 0,
      timeLeft: config.duration,
      bucketLoad: 0,
      goalDist: 0,
      boom: 0.45,
      arm: -0.95,
      bucket: -0.12,
      score: 0,
    });
  }, [clearAllInput, config.duration, config.target, setAuxiliary, setHud]);

  const enterPracticeMode = useCallback(() => {
    resetYanmarSession();
    terrainRef.current = createInitialTerrain(true);
    tutorialStepRef.current = null;
    setTutorialIndex(0);
    setShowTouchZones(true);
    setShowTutorialMenu(true);
    setMode("practice");
  }, [resetYanmarSession, setMode, setShowTouchZones, setShowTutorialMenu, setTutorialIndex]);

  const startGameDirect = useCallback(() => {
    resetYanmarSession();
    tutorialStepRef.current = null;
    setShowTouchZones(false);
    setShowTutorialMenu(false);
    endedRef.current = false;
    elapsedRef.current = 0;
    scoreRef.current.timeLeft = config.duration;
    setHud((h) => ({ ...h, progress: 0, timeLeft: config.duration }));
    setMode("game");
  }, [config.duration, resetYanmarSession, setHud, setMode, setShowTouchZones, setShowTutorialMenu]);

  const initialPlayModeRef = useRef(initialPlayMode);
  const hasBootstrappedRef = useRef(false);

  useEffect(() => {
    if (hasBootstrappedRef.current) return;
    const bootMode = initialPlayModeRef.current;
    if (!bootMode) return;
    hasBootstrappedRef.current = true;
    if (bootMode === "practice") {
      enterPracticeMode();
    } else {
      startGameDirect();
    }
  }, [enterPracticeMode, startGameDirect]);

  const startTutorial = useCallback((index: number) => {
    resetYanmarSession();
    const step = TUTORIAL_STEPS[index] ?? null;
    tutorialCompletingRef.current = false;
    tutorialIndexRef.current = index;
    tutorialStepRef.current = step;
    setTutorialIndex(index);
    setShowTutorialMenu(false);
    setShowTouchZones(true);
    setMode("tutorial");
  }, [resetYanmarSession, setMode, setShowTouchZones, setShowTutorialMenu, setTutorialIndex]);

  const startFreePractice = useCallback(() => {
    resetYanmarSession();
    tutorialStepRef.current = null;
    setShowTutorialMenu(false);
    setShowTouchZones(true);
    setMode("practice");
  }, [resetYanmarSession, setMode, setShowTouchZones, setShowTutorialMenu]);

  const handleSimTick = useCallback(() => {
    syncDigHud();

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
  }, [syncDigHud, setHud, setMode, setStepCompleteFlash]);

  const handleProgress = useCallback(
    (dumped: number, progress: number) => {
      if (progress !== lastHudProgressRef.current) {
        lastHudProgressRef.current = progress;
        setHud((h) => ({
          ...h,
          progress,
          bucketLoad: simRef.current.bucketLoad,
        }));
      }
      if (!endedRef.current && dumped >= config.target) {
        setHud((h) => ({ ...h, progress: 100 }));
      }
    },
    [config.target, setHud],
  );

  const addDumpPopup = useCallback((popup: Omit<DumpScorePopup, "id">) => {
    const id = ++scorePopupIdRef.current;
    arcadeScoreRef.current += popup.score;
    setHud((h) => ({ ...h, score: arcadeScoreRef.current }));
    setScorePopups((items) => [...items.slice(-4), { id, ...popup }]);
    window.setTimeout(() => {
      setScorePopups((items) => items.filter((item) => item.id !== id));
    }, 4600);
    return id;
  }, []);

  const updateDumpPopup = useCallback(
    (id: number, popup: Partial<Omit<DumpScorePopup, "id">>, scoreDelta = 0) => {
      if (scoreDelta !== 0) {
        arcadeScoreRef.current += scoreDelta;
        setHud((h) => ({ ...h, score: arcadeScoreRef.current }));
      }
      setScorePopups((items) =>
        items.map((item) => (item.id === id ? { ...item, ...popup } : item)),
      );
    },
    [],
  );

  const handleDumpScore = useCallback((popup: Omit<DumpScorePopup, "id">) => {
    if (modeRef.current !== "game") {
      const stars = Math.floor(Math.random() * 3) + 1;
      setPreviewStars((value) => value + stars);
      addDumpPopup({ ...popup, rewardText: `체험 ⭐${stars}` });
      return;
    }

    const popupId = addDumpPopup({ ...popup, rewardText: "보상 확인중" });

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
          setCurrency(data.currency);
          await updateSessionRef.current({ user: { currency: data.currency } });
        }
        if (!event) {
          updateDumpPopup(popupId, { rewardText: "보상 완료" });
          return;
        }
        updateDumpPopup(popupId, {
          score: event.score,
          critical: event.critical,
          rewardText:
            event.kind === "coupon"
              ? `쿠폰 ${event.discountPct}%`
              : `⭐${event.stars}`,
        }, event.score - popup.score);
      } catch {
        updateDumpPopup(popupId, { rewardText: "저장 실패" });
      }
    })();
  }, [addDumpPopup, updateDumpPopup]);

  const handleEquipmentUpgrade = useCallback(
    (part: YanmarEquipmentPart) => {
      const previewMode = modeRef.current !== "game";
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
        setPreviewStars((value) =>
          Math.max(0, value - getYanmarUpgradeCost(part, equipmentLevels[part] + 1)),
        );
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

  const handleEquipmentReset = useCallback(() => {
    const previewMode = modeRef.current !== "game";
    if (previewMode) {
      const nextLevels = { ...DEFAULT_YANMAR_EQUIPMENT_LEVELS };
      const nextStats = calculateYanmarEquipmentStats(nextLevels);
      equipmentStatsRef.current = nextStats;
      setEquipmentLevels(nextLevels);
      setEquipmentStats(nextStats);
      return;
    }

    const refundStars = getYanmarResetRefundStars(equipmentLevels);
    if (refundStars <= 0) return;
    const confirmed = window.confirm(
      `강화를 초기화하면 사용한 스타의 ${Math.round(
        YANMAR_EQUIPMENT_RESET_REFUND_RATE * 100,
      )}%인 ${refundStars.toLocaleString()} 스타를 돌려받습니다.\n초기화하시겠습니까?`,
    );
    if (!confirmed) return;

    setResettingEquipment(true);
    void (async () => {
      try {
        const res = await fetch("/api/equipment/yanmar/reset", {
          method: "POST",
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
          mode: "game",
        });
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [config.duration, mode, onEnd, syncDigHud]);

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

  return (
    <div
      className={`relative touch-manipulation ${
        immersive
          ? "flex h-full w-full items-center justify-center bg-slate-950"
          : "mx-auto w-full max-w-lg"
      }`}
    >
      <div
        className={`relative w-full overflow-hidden bg-slate-300 ${
          immersive ? "shadow-2xl shadow-black/50" : "aspect-video rounded-b-xl shadow-lg"
        }`}
        style={
          immersive
            ? {
                width: "100%",
                height: "100%",
              }
            : undefined
        }
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
        <EquipmentUpgradeModal
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

        {mode !== "intro" && mode !== "gameReady" && (
          <div className="absolute left-2 top-2 z-50 flex flex-col items-start gap-1.5">
            <div className="flex items-center gap-1.5">
              {(mode === "practice" || mode === "tutorial") && (
                <button
                  type="button"
                  onClick={() => setShowTutorialMenu(true)}
                  className="rounded-lg border border-white/20 bg-black/70 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-lg backdrop-blur-sm hover:bg-black/85"
                >
                  튜토리얼
                </button>
              )}
              <div className="flex min-w-[8rem] items-center gap-1.5 rounded-lg border border-orange-100/20 bg-black/60 px-2 py-1.5 text-[10px] font-black text-white shadow-lg backdrop-blur-sm">
                <span className="shrink-0 text-orange-100">적재량</span>
                <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/20">
                  <span
                    className="block h-full rounded-full bg-orange-300 transition-all duration-150"
                    style={{ width: `${Math.max(0, Math.min(100, hud.bucketLoad * 100))}%` }}
                  />
                </span>
                <span className="shrink-0 text-orange-50">
                  {getLoadUnits(hud.bucketLoad, equipmentStats.maxLoadUnits)}/
                  {equipmentStats.maxLoadUnits}
                </span>
              </div>
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

        {headerHudReady && mode !== "intro"
          ? (() => {
              const target = document.getElementById(GAME_IMMERSIVE_HEADER_RIGHT_ID);
              if (!target) return null;
              return createPortal(
                <div className="flex items-center gap-2 text-[10px] font-black text-white">
                  <span className="rounded-lg border border-white/15 bg-black/25 px-2 py-1">
                    점수 <span className="text-yellow-100">{hud.score.toLocaleString()}</span>
                  </span>
                  <span className="rounded-lg border border-white/15 bg-black/25 px-2 py-1">
                    {mode === "game" ? "스타" : "체험 스타"}{" "}
                    <span className="text-amber-100">
                      ⭐ {(mode === "game" ? currency : previewStars).toLocaleString()}
                    </span>
                  </span>
                </div>,
                target,
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
          <div className="absolute right-2 top-2 z-30 flex w-[116px] justify-center">
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
          />
        )}

        {mode === "tutorial" && tutorialStep?.id === "dump" ? (
          <DumpHintPanel
            bucketLoad={hud.bucketLoad}
            inDumpZone={digFeedback.inDumpZone}
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

        {mode !== "intro" && <RewardPopupOverlay popups={scorePopups} />}

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

        {mode === "game" && (
          <>
            <div className="absolute right-2 top-[17rem] z-20 rounded-lg bg-orange-600/80 px-2 py-1 text-[10px] text-white">
              🟠 굴착
            </div>
            <div className="absolute right-2 top-[18.75rem] z-20 rounded-lg bg-green-600/80 px-2 py-1 text-[10px] text-white">
              🟢 덤프
            </div>
          </>
        )}

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
              tutorialStepRef={tutorialStepRef}
              tutorialDumpRef={tutorialDumpRef}
              digFeedbackRef={digFeedbackRef}
              onProgress={handleProgress}
              onDumpScore={handleDumpScore}
              onSimTick={handleSimTick}
              scorePopups={scorePopups}
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
            }}
            auxiliary={auxiliary}
            onAuxiliaryChange={handleAuxiliaryChange}
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
