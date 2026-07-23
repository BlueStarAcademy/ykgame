"use client";

/* eslint-disable react-hooks/immutability, react-hooks/refs, react-hooks/preserve-manual-memoization, react-hooks/set-state-in-effect */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import {
  GAME_IMMERSIVE_HEADER_CENTER_ID,
  GAME_IMMERSIVE_HEADER_LEFT_ID,
  GAME_IMMERSIVE_HEADER_RIGHT_ID,
} from "@/components/games/GameImmersiveOverlay";
import { LandingPromoPopup } from "@/components/landing/LandingPromoPopup";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import { StarAmount } from "@/components/StarAmount";
import { useRegisterInGameBackDismiss } from "@/hooks/useInGameBackNavigation";
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
import { resolveAttachmentTipClearance } from "./attachmentGround";
import {
  ExcavatorScene,
  createInitialSim,
  createInitialTerrain,
} from "./ExcavatorScene";
import type { WorldPickup } from "./worldPickups";
import {
  createEmptyWorldPickupsState,
  createWorldPickupsStateFromHydrate,
  getWorldPickupHourBucket,
  markWorldStarHourlyLimitReached,
  rollClientStarReward,
  starRewardToastFontRem,
  starRewardToastIconPx,
} from "./worldPickups";
import {
  isWorldPickupSnapshotCurrent,
  loadWorldPickupSnapshot,
  saveWorldPickupSnapshot,
  snapshotToActivePickups,
} from "./worldPickupPersistence";
import type {
  AttachmentType,
  CameraMode,
  CouponDiscoveryState,
  DumpScorePopup,
  DumpScorePanelState,
  ExcavatorSimState,
  AutoPoseSlotIndex,
  AutoPoseState,
  GearDiscoveryState,
} from "./types";
import {
  createCameraLookOffset,
  resetCameraLookOffset,
  type CameraLookOffset,
} from "./types";
import {
  createHydraulicVelocity,
  createAutoPoseState,
  startAutoArmPose,
  type HydraulicVelocity,
} from "./controls";
import { ExcavatorMinimap } from "./ExcavatorMinimap";
import { ExcavatorMapModal } from "./ExcavatorMapModal";
import { GrappleGripGauge } from "./DigHintPanel";
import { DumpHintPanel } from "./DumpHintPanel";
import { YanmarGameSettingsMenu } from "./YanmarGameSettingsMenu";
import { type HornId } from "./soundSettings";
import { useSoundSettings } from "./useSoundSettings";
import { yanmarAudio } from "./yanmarAudio";
import { QuestPanel } from "./QuestPanel";
import { ShopPanel, type GachaPayWith } from "./ShopPanel";
import { GachaResultModal } from "./GachaResultModal";
import { HourlyAdBanner } from "./HourlyAdBanner";
import {
  getHourlyAdHourBucket,
  loadHourlyAdGrantLocally,
  type HourlyAdClaimResult,
} from "./hourlyAdReward";
import type { GachaFreeStatus } from "./gachaFree";
import {
  getMsUntilNextGachaFreeReset,
  withGachaFreeDayRollover,
} from "./gachaFree";
import { ActiveShopBuffIcons } from "./ActiveShopBuffIcons";
import {
  activateShopBuff,
  loadActiveShopBuffs,
  resolveShopBuffOwner,
  saveActiveShopBuffs,
  type ActiveShopBuff,
} from "./shopBuffPersistence";
import {
  activeShopBuffIds,
  applyShopBuffsToStats,
} from "./shopBuffEffects";
import {
  SHOP_ITEM_BY_ID,
  type ShopItemId,
} from "./shopCatalog";
import { MissionHudPanel } from "./MissionHudPanel";
import {
  applyQuestProgress,
  claimCurrentMission,
  claimDailyQuest,
  claimRepeatQuest,
  countClaimableQuestRewards,
  loadQuestState,
  questClaimEventId,
  saveQuestState,
  getMsUntilNextQuestReset,
  getQuestDayKey,
  type YanmarQuestState,
} from "./quests/questState";
import type { QuestMetric } from "./quests/types";
import { createDigFeedback, type DigFeedback } from "./bucket";
import {
  loadDumpTruckCooldown,
  saveDumpTruckCooldown,
} from "./dumpTruckPersistence";
import {
  DUMP_REWARD_BATCH_DEBOUNCE_MS,
  DUMP_REWARD_BATCH_MAX_CHUNKS,
  dumpRewardOutboxStorageKey,
  mergeDumpRewardOutbox,
  parseDumpRewardOutbox,
  removeDumpRewardOutboxBatch,
  serializeDumpRewardOutbox,
  type DumpRewardOutboxBatch,
} from "./dumpRewardOutbox";
import { clampUserCurrency } from "@/lib/currency";
import {
  applyGameSessionTerrain,
  loadYanmarGameSession,
  saveYanmarGameSession,
  type YanmarGameSessionSnapshot,
} from "./gameSessionPersistence";
import {
  defaultAutoPoseSlotLabels,
  loadAutoPoseSlotLabelsForSession,
  loadAutoPoseSlotsForSession,
  resolveAutoPoseStorageOwner,
  saveAutoPoseSlotLabels,
  saveSavedArmPoseSlot,
  saveSavedArmPoseSlots,
  type AutoPoseSlotLabels,
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
  resetDumpTruckState,
  type DumpTruckPose,
} from "./dumpTruckState";
import { expandTerrainForLevel, type TerrainData } from "./terrain";
import {
  YANMAR_REWARD_CONFIG,
  YANMAR_CRASH_REWARD_CONFIG,
  YANMAR_HILL_REWARD_CONFIG,
  calculateYanmarCrashScore,
  calculateYanmarHillScore,
  getLoadUnits,
  rollYanmarHillXp,
  type YanmarEquipmentStats,
} from "./equipment";
import { defaultFinalStats } from "./gearStats";
import { GearPanel, type GearPanelItem } from "./GearPanel";
import { PlayerProfileModal } from "./PlayerProfileModal";
import {
  MAINTENANCE_FLUID_ART,
  MAINTENANCE_FLUID_IDS,
  MAINTENANCE_FLUIDS,
  computeMaintenanceSnapshot,
  formatRemainingDuration,
  type MaintenanceFluidId,
  type MaintenanceSnapshot,
} from "./maintenance";
import { RepairPanel, type MaintenanceClaimResult } from "./RepairPanel";
import { WorkshopPanel, type WorkshopPanelState } from "./WorkshopPanel";
import { MonumentPanel, type MonumentPanelState } from "./MonumentPanel";
import { isInWorkshopSignRange } from "./WorkshopSign";
import {
  WORKSHOP_DEFS,
  WORKSHOP_IDS,
  type WorkshopId,
  type WorkshopShopItemId,
  type WorkshopUpgradeKey,
} from "./workshop";
import {
  applyWorkshopQuestMetric,
  countClaimableWorkshopQuests,
  getClaimableWorkshopIds,
  loadWorkshopQuestState,
  markWorkshopQuestClaimed,
  saveWorkshopQuestState,
  type WorkshopQuestState,
} from "./workshop/questState";
import type { WorkshopQuestMetric } from "./workshop/types";
import {
  activateMonumentQuests,
  claimMonumentRepeatQuest,
  ensureMonumentQuestsForPhase,
  isInMonumentRange,
  loadMonumentQuestState,
  markMonumentDailyClaimed,
  MONUMENT_POINTS_ICON,
  MONUMENT_UNLOCK_LEVEL,
  monumentStorageCap,
  pushMonumentQuestProgress,
  saveMonumentQuestState,
  type MonumentPhase,
  type MonumentQuestMetric,
  type MonumentQuestState,
  type MonumentUpgradeKey,
} from "./monument";
import { SITE_LAYOUT } from "./siteLayout";
import { isInRepairTentRange } from "./RepairTent";
import type { ChassisModelId } from "./chassisCatalog";
import { getChassisDef } from "./chassisCatalog";
import { nicknameCharLength, profileAvatarSrc } from "@/lib/profile";
import {
  emptyAbilityAlloc,
  spentAbilityPoints,
  type AbilityAlloc,
} from "./abilityAlloc";
import {
  GEAR_INVENTORY_BASE,
  GEAR_SLOTS,
  GEAR_SLOT_LABEL,
  ITEM_GRADE_LABEL,
  type GearSlot,
  type ItemGrade,
} from "./gearCatalog";
import { GearIconCell } from "./GearIconCell";
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
  advanceTutorialProgress,
  createTutorialPhaseProgress,
  getTutorialInstruction,
  getTutorialPhaseCount,
  getTutorialPhaseSuccessLabel,
  getTutorialWaypoint,
  TUTORIAL_STEPS,
  waypointDistance,
  type GameMode,
  type TutorialPhaseProgress,
  type TutorialStep,
  type TutorialWaypoint,
} from "./tutorial";
import {
  getYanmarCouponImage,
  getYanmarCouponLabel,
} from "./rewardVisualConfig";
import { getPlayerLevelProgress } from "@/lib/playerLevel";
import {
  getCrossedUnlocks,
  getUnseenUnlocksForLevel,
  hasSeenPlayerUnlock,
  isAttachmentUnlocked,
  markPlayerUnlockSeen,
  PRACTICE_FULL_UNLOCK_LEVEL,
  type PlayerUnlockKind,
} from "@/lib/playerUnlocks";
import {
  SportsMeetHud,
  SportsMeetModePanel,
  SportsMeetRankingsPanel,
  SportsMeetResultPanel,
} from "./SportsMeetPanels";
import {
  beginSportsMeetRun,
  currentSportsStage,
  getSportsMeetMissionForWeek,
  getSportsMeetPattern,
  getSportsMeetWeekKey,
  isInSportsMeetPortalRange,
  isSportsMeetFinishDriveStage,
  noteSportsAsphaltBreak,
  noteSportsDumpDepart,
  noteSportsDumpFill,
  noteSportsRockDump,
  prepareSportsMeetStageContent,
  SPORTS_MEET_UNLOCK_LEVEL,
  sportsMeetDriveStarQuota,
  sportsMeetElapsedMs,
  sportsMeetStageWaypoint,
  STAGE_LABEL_KO,
  startSportsMeetCountdown,
  tickSportsMeetCountdown,
  tryCollectNearbySportsPickups,
  getSportsMeetAllowedAttachment,
  sportsMeetStageLockMessage,
  rollSportsMeetStarReward,
  type SportsMeetPlayMode,
  type SportsMeetRunState,
} from "./sportsMeet";
import {
  applySportsMeetEquipmentOverrides,
  createSportsMeetTerrain,
  heightAtTerrain,
} from "./sportsMeet/sessionSetup";

interface ExcavatorGameWrapperProps {
  onEnd: (result: GameResult) => void;
  exitSignal?: number;
  resumeSignal?: number;
  scoreCommit?: { id: number; score: number } | null;
  immersive?: boolean;
  initialPlayMode?: "practice" | "game" | "ride";
  onShowGuide?: () => void;
  onShowRanking?: () => void;
  onRequestExit?: () => void;
  /** Season total before this session; HUD shows base + session score in game mode. */
  seasonScoreBase?: number;
  /** Fired once when the 3D scene assets are loaded and the first frames have painted. */
  onReady?: () => void;
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
  useRegisterInGameBackDismiss(open, onClose);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm landscape:items-start landscape:overflow-y-auto landscape:py-2">
      <div className="flex max-h-[min(92dvh,40rem)] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl landscape:max-h-[min(94dvh,22rem)]">
        <div className="shrink-0 bg-gradient-to-br from-red-600 to-red-800 px-4 py-3 text-white">
          <h2 className="text-base font-black">튜토리얼 선택</h2>
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
          </button>
          {TUTORIAL_STEPS.map((step, index) => (
            <button
              key={step.id}
              type="button"
              onClick={() => onSelect(index)}
              className={`w-full rounded-xl border px-3 py-2 text-left text-xs font-bold ${
                activeId === step.id
                  ? "border-amber-300 bg-amber-50 text-amber-800"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {step.title}
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

function InventoryFullModal({
  open,
  onClose,
  onOpenGear,
}: {
  open: boolean;
  onClose: () => void;
  onOpenGear: () => void;
}) {
  return (
    <AppModalOverlay
      open={open}
      onClose={onClose}
      nested
      panelClassName="!max-w-[21rem] !overflow-visible !rounded-none !bg-transparent !p-0 !shadow-none"
    >
      <div
        className="yanmar-gear-confirm-card yanmar-inventory-full-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="yanmar-inventory-full-title"
      >
        <p className="yanmar-gear-confirm-eyebrow">INVENTORY FULL</p>
        <h3 id="yanmar-inventory-full-title">인벤토리 공간이 부족합니다.</h3>
        <p className="yanmar-inventory-full-lead">
          장비를 분해·판매하거나 슬롯을 확장한 뒤 다시 획득할 수 있습니다.
        </p>
        <div className="yanmar-gear-confirm-actions">
          <button
            type="button"
            className="yanmar-gear-btn yanmar-gear-btn--unequip"
            onClick={onClose}
          >
            닫기
          </button>
          <button
            type="button"
            className="yanmar-gear-btn yanmar-gear-btn--enhance"
            onClick={onOpenGear}
          >
            장비관리
          </button>
        </div>
      </div>
    </AppModalOverlay>
  );
}

const DUMP_SCORE_PANEL_DURATION_MS = 9500;
const COUPON_DISCOVERY_DURATION_MS = 8200;
const GEAR_DISCOVERY_DURATION_MS = 6500;
const FREE_LOOK_SENSITIVITY = 0.0048;
const FREE_LOOK_PITCH_MIN = -0.55;
const FREE_LOOK_PITCH_MAX = 0.42;
const FREE_LOOK_TRAVEL_THRESHOLD = 0.08;
const FREE_LOOK_DISTANCE_MIN = 0.4;
const FREE_LOOK_DISTANCE_MAX = 2.5;
const FREE_LOOK_VEL_MAX = 5.5;
const FREE_LOOK_VEL_SMOOTH = 0.35;

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
  const bounceSide = hitTick % 2 === 0 ? "is-bounce-left" : "is-bounce-right";

  return (
    <div className="relative w-[8.25rem] rounded-xl border border-white/20 bg-black/55 px-2 py-1.5 shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[8px] font-black uppercase tracking-[0.12em] text-white/70">
          파쇄
        </span>
        <span className="text-[9px] font-black tabular-nums text-white">
          ({Math.round(hp).toLocaleString()}
          <span className="text-white/45">/{safeMax.toLocaleString()}</span>)
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/15">
        <div
          className={`h-full rounded-full transition-[width] duration-100 ease-out ${crashHpBarColor(ratio)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {hitTick > 0 && hitDamage > 0 ? (
        <span
          key={hitTick}
          className={`yanmar-crash-hit-float pointer-events-none absolute left-1/2 top-0 text-lg font-black tabular-nums text-amber-100 ${bounceSide}`}
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

  const showScore = panel.totalScore > 0;
  const showXp = panel.earnedXp > 0;
  const showStars = panel.earnedStars > 0;
  const showCores = panel.earnedEnhanceCores > 0;
  const showMonumentPoints = panel.earnedMonumentPoints > 0;
  const showTicketsStd = panel.earnedGachaTicketsStandard > 0;
  const showTicketsPrem = panel.earnedGachaTicketsPremium > 0;
  if (
    !showScore &&
    !showXp &&
    !showStars &&
    !showCores &&
    !showMonumentPoints &&
    !showTicketsStd &&
    !showTicketsPrem &&
    !panel.rewardText
  ) {
    return null;
  }

  const sepClass = panel.critical ? "text-yellow-200/80" : "text-white/35";
  const valueParts: ReactNode[] = [];
  if (showScore) {
    valueParts.push(
      <span key="score">{panel.totalScore.toLocaleString()}점</span>,
    );
  }
  if (showXp) {
    valueParts.push(
      <span key="xp">EXP+{panel.earnedXp.toLocaleString()}</span>,
    );
  }
  if (showStars) {
    valueParts.push(
      <span key="stars" className="inline-flex items-center gap-0.5">
        <img
          src="/images/star-currency.svg"
          alt=""
          width={16}
          height={16}
          className="yanmar-score-panel-star"
          draggable={false}
        />
        {panel.earnedStars.toLocaleString()}
      </span>,
    );
  }
  if (showMonumentPoints) {
    valueParts.push(
      <span key="monument" className="inline-flex items-center gap-0.5">
        <img
          src={MONUMENT_POINTS_ICON}
          alt=""
          width={16}
          height={16}
          className="object-contain"
          draggable={false}
        />
        {panel.earnedMonumentPoints.toLocaleString()}
      </span>,
    );
  }
  if (showCores) {
    valueParts.push(
      <span key="cores" className="inline-flex items-center gap-0.5">
        <img
          src="/images/yanmar/2d/enhance-core.png?v=3"
          alt=""
          width={16}
          height={16}
          className="yanmar-score-panel-core"
          draggable={false}
        />
        {panel.earnedEnhanceCores.toLocaleString()}
      </span>,
    );
  }
  if (showTicketsStd) {
    valueParts.push(
      <span key="ticket-std" className="inline-flex items-center gap-0.5">
        <img
          src="/images/yanmar/2d/gacha-ticket-standard.svg"
          alt=""
          width={16}
          height={16}
          className="object-contain"
          draggable={false}
        />
        {panel.earnedGachaTicketsStandard.toLocaleString()}
      </span>,
    );
  }
  if (showTicketsPrem) {
    valueParts.push(
      <span key="ticket-prem" className="inline-flex items-center gap-0.5">
        <img
          src="/images/yanmar/2d/gacha-ticket-premium.svg"
          alt=""
          width={16}
          height={16}
          className="object-contain"
          draggable={false}
        />
        {panel.earnedGachaTicketsPremium.toLocaleString()}
      </span>,
    );
  }

  return (
    <div
      key={panel.pulseKey}
      className={`yanmar-score-panel relative w-max max-w-[min(20rem,90vw)] rounded-xl border px-4 py-2.5 font-black shadow-xl backdrop-blur-sm ${
        panel.critical
          ? "yanmar-score-panel-critical border-yellow-200/55 bg-black/42 text-yellow-300 shadow-[0_0_28px_rgba(250,204,21,0.22)]"
          : "border-white/20 bg-black/40 text-slate-100"
      }`}
    >
      {panel.critical ? (
        <div
          key={`crit-${panel.pulseKey}`}
          className="yanmar-score-critical-label pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-[118%]"
          aria-hidden
        >
          CRITICAL
        </div>
      ) : null}
      {valueParts.length > 0 ? (
        <div
          className={`yanmar-score-panel-value flex items-center justify-center gap-2.5 whitespace-nowrap tabular-nums ${
            panel.critical ? "text-base" : "text-sm"
          }`}
        >
          {valueParts.flatMap((part, index) =>
            index === 0
              ? [part]
              : [
                  <span key={`sep-${index}`} className={sepClass} aria-hidden>
                    ·
                  </span>,
                  part,
                ],
          )}
        </div>
      ) : null}
      {panel.rewardText ? (
        <div className="yanmar-score-panel-reward mt-1 text-center text-[11px] font-bold text-white/90">
          {panel.rewardText}
        </div>
      ) : null}
    </div>
  );
}

function CouponDiscoveryOverlay({ discovery }: { discovery: CouponDiscoveryState | null }) {
  if (!discovery) return null;

  const label = getYanmarCouponLabel(discovery.couponType);

  return (
    <div
      key={discovery.pulseKey}
      className="yanmar-coupon-discovery w-max max-w-[min(18rem,90vw)] rounded-2xl border-2 border-yellow-200/55 bg-gradient-to-b from-amber-500/55 via-orange-500/50 to-red-600/48 px-4 py-3.5 text-center text-white shadow-[0_0_32px_rgba(251,191,36,0.28)] backdrop-blur-sm"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getYanmarCouponImage(discovery.couponType)}
        alt=""
        width={140}
        height={84}
        className="mx-auto h-[5.25rem] w-auto drop-shadow-lg"
        draggable={false}
        aria-hidden
      />
      <p className="mt-2 text-base font-black tracking-tight text-yellow-50">축하합니다!</p>
      <p className="mt-1 text-xs font-bold leading-snug text-white">
        {discovery.couponType === "FILTER_SET_EXCHANGE"
          ? `${label}을 발견했습니다!!`
          : `${label} ${discovery.discountPct}% 할인 쿠폰을 발견했습니다!!`}
      </p>
    </div>
  );
}

function isGearDiscoverySlot(v: unknown): v is GearSlot {
  return typeof v === "string" && (GEAR_SLOTS as readonly string[]).includes(v);
}

function isGearDiscoveryGrade(v: unknown): v is ItemGrade {
  return (
    v === "NORMAL" ||
    v === "ENHANCED" ||
    v === "PRECISION" ||
    v === "MASTER"
  );
}

function GearDiscoveryOverlay({ discovery }: { discovery: GearDiscoveryState | null }) {
  if (!discovery) return null;

  const grade = isGearDiscoveryGrade(discovery.grade) ? discovery.grade : "NORMAL";
  const slot = isGearDiscoverySlot(discovery.slot) ? discovery.slot : null;
  const gradeLabel = ITEM_GRADE_LABEL[grade];
  const slotLabel = slot ? GEAR_SLOT_LABEL[slot] : null;
  const gradeTone =
    grade === "MASTER"
      ? "yanmar-gear-discovery-grade--master"
      : grade === "PRECISION"
        ? "yanmar-gear-discovery-grade--precision"
        : grade === "ENHANCED"
          ? "yanmar-gear-discovery-grade--enhanced"
          : "yanmar-gear-discovery-grade--normal";

  return (
    <div
      key={discovery.pulseKey}
      className="yanmar-gear-discovery w-max max-w-[min(16rem,90vw)] rounded-2xl border border-white/15 bg-gradient-to-b from-slate-800/55 via-slate-900/50 to-black/48 px-4 py-3.5 text-center text-white shadow-[0_0_28px_rgba(148,163,184,0.18)] backdrop-blur-sm"
      role="status"
    >
      <div className="mx-auto flex justify-center">
        <GearIconCell slot={slot} grade={grade} size="lg" empty={!slot} />
      </div>
      <p className="mt-2.5 text-base font-black tracking-tight text-slate-50">
        {discovery.mailed ? "인벤토리 가득!" : "장비 획득!"}
      </p>
      <p
        className={`yanmar-gear-discovery-grade mt-1 text-[11px] font-bold uppercase ${gradeTone}`}
      >
        {gradeLabel}
        {slotLabel ? ` · ${slotLabel}` : ""}
      </p>
      <p className="mt-1 text-xs font-bold leading-snug text-white">
        {discovery.nameSnapshot}
      </p>
      {discovery.mailed ? (
        <p className="mt-1.5 text-[10px] font-semibold leading-snug text-amber-200/90">
          스타 우편으로 전환되었습니다
        </p>
      ) : null}
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

  if (unlock === "MONUMENT") {
    return (
      <div className="yanmar-unlock-overlay" role="presentation">
        <div
          className="yanmar-unlock-panel"
          role="dialog"
          aria-modal="true"
          aria-label="레벨 20 YK 조형물 개방 안내"
        >
          <div className="yanmar-unlock-panel-glow" aria-hidden />
          <div className="yanmar-unlock-panel-frame" aria-hidden />
          <header className="yanmar-unlock-brand">
            <span className="yanmar-unlock-brand-mark">YANMAR</span>
            <span className="yanmar-unlock-brand-rule" aria-hidden />
            <span className="yanmar-unlock-brand-sub">
              SV08-1 · MONUMENT UNLOCK
            </span>
          </header>
          <div className="yanmar-unlock-body">
            <p className="yanmar-unlock-level">
              <span>LEVEL</span> 20
            </p>
            <h2 className="yanmar-unlock-title">YK 조형물이 개방되었습니다</h2>
            <p className="yanmar-unlock-lead">
              맵 북쪽(미니맵 12시) 조형물 예정지로 이동합니다. 기본 미션 3개를
              완료하면 건설을 시작할 수 있습니다.
            </p>
            <ul className="yanmar-unlock-perks">
              <li>
                <span className="yanmar-unlock-perk-index">01</span>
                <div>
                  <strong>덤프트럭 보내기</strong>
                  <span>흙 하역장에서 트럭을 1회 출발시키세요</span>
                </div>
              </li>
              <li>
                <span className="yanmar-unlock-perk-index">02</span>
                <div>
                  <strong>파쇄 9개</strong>
                  <span>브레이커로 노면을 파쇄하세요</span>
                </div>
              </li>
              <li>
                <span className="yanmar-unlock-perk-index">03</span>
                <div>
                  <strong>돌 트럭 보내기</strong>
                  <span>언덕 하역장에서 돌 트럭을 1회 출발시키세요</span>
                </div>
              </li>
            </ul>
            <button
              type="button"
              className="yanmar-unlock-cta"
              onClick={onClose}
            >
              조형물로 이동
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (unlock === "SPORTS_MEET") {
    return (
      <div className="yanmar-unlock-overlay" role="presentation">
        <div
          className="yanmar-unlock-panel"
          role="dialog"
          aria-modal="true"
          aria-label="레벨 25 굴착기 운동회 개방 안내"
        >
          <div className="yanmar-unlock-panel-glow" aria-hidden />
          <div className="yanmar-unlock-panel-frame" aria-hidden />
          <header className="yanmar-unlock-brand">
            <span className="yanmar-unlock-brand-mark">YANMAR</span>
            <span className="yanmar-unlock-brand-rule" aria-hidden />
            <span className="yanmar-unlock-brand-sub">
              SV08-1 · SPORTS MEET UNLOCK
            </span>
          </header>
          <div className="yanmar-unlock-body">
            <p className="yanmar-unlock-level">
              <span>LEVEL</span> 25
            </p>
            <h2 className="yanmar-unlock-title">
              굴착기 운동회가 개방되었습니다
            </h2>
            <p className="yanmar-unlock-lead">
              미니맵 좌측 하단 포탈에서 주간 타임어택에 도전하세요. 매일
              도전권 1회, 연습 모드는 무제한입니다. 월요일 0시(KST)에 코스가
              바뀌고 지난주 순위로 스타 우편이 지급됩니다.
            </p>
            <ul className="yanmar-unlock-perks">
              <li>
                <span className="yanmar-unlock-perk-index">01</span>
                <div>
                  <strong>랭킹 · 연습</strong>
                  <span>도전권(1/1)으로 랭킹, 연습은 기록 미반영</span>
                </div>
              </li>
              <li>
                <span className="yanmar-unlock-perk-index">02</span>
                <div>
                  <strong>주간 코스</strong>
                  <span>5종 패턴이 월요일마다 자동 로테이션</span>
                </div>
              </li>
              <li>
                <span className="yanmar-unlock-perk-index">03</span>
                <div>
                  <strong>주간 보상</strong>
                  <span>1위 3000★ ~ 참가 100★ 우편 지급</span>
                </div>
              </li>
            </ul>
            <button
              type="button"
              className="yanmar-unlock-cta"
              onClick={onClose}
            >
              포탈로 이동
            </button>
          </div>
        </div>
      </div>
    );
  }

  const breaker = unlock === "BREAKER";
  const level = breaker ? 10 : 15;
  const attachmentLabel = breaker ? "브레이커" : "집게";
  const zoneLabel = breaker ? "파쇄 작업장" : "석재 운반 작업장";
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
  onShowGuide,
  onShowRanking,
  onRequestExit,
  seasonScoreBase = 0,
  onReady,
}: ExcavatorGameWrapperProps) {
  const config = getMissionConfig("yanmar");
  const { data: session, status: sessionStatus, update } = useSession();
  const defaultEquipmentStats = defaultFinalStats();
  const [mode, setMode] = useState<GameMode>("intro");
  const [audioArmed, setAudioArmed] = useState(false);
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
  const [autoPoseLabels, setAutoPoseLabels] = useState<AutoPoseSlotLabels>(
    defaultAutoPoseSlotLabels,
  );
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
    enhanceCores?: number;
    stars?: number;
  } | null>(null);
  const [unlockQueue, setUnlockQueue] = useState<PlayerUnlockKind[]>([]);
  const unlockSeenOwnerRef = useRef("local");
  const unlockAnnouncedRef = useRef<Set<PlayerUnlockKind>>(new Set());
  const [showSportsMeetPanel, setShowSportsMeetPanel] = useState(false);
  const [showSportsMeetRankings, setShowSportsMeetRankings] = useState(false);
  const [sportsMeetRankingsWeek, setSportsMeetRankingsWeek] = useState<
    "current" | "previous"
  >("current");
  const [nearSportsMeet, setNearSportsMeet] = useState(false);
  const nearSportsMeetRef = useRef(false);
  const sportsMeetRunRef = useRef<SportsMeetRunState | null>(null);
  const [sportsMeetRun, setSportsMeetRun] = useState<SportsMeetRunState | null>(
    null,
  );
  const [sportsMeetPickupRevision, setSportsMeetPickupRevision] = useState(0);
  const [sportsMeetTicket, setSportsMeetTicket] = useState({
    remaining: 1,
    limit: 1,
  });
  const sportsMainTerrainRef = useRef<TerrainData | null>(null);
  const sportsEquipmentSnapRef = useRef<YanmarEquipmentStats | null>(null);
  const sportsHudTickRef = useRef(0);
  const [sportsHudTick, setSportsHudTick] = useState(0);
  const [sportsResultSubmitted, setSportsResultSubmitted] = useState(false);
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
    boom: 0.55,
    arm: -0.95,
    bucket: 0.85,
    score: 0,
    dumpedUnits: 0,
  });
  const [dumpScorePanel, setDumpScorePanel] = useState<DumpScorePanelState | null>(null);
  const [couponDiscovery, setCouponDiscovery] = useState<CouponDiscoveryState | null>(null);
  const [gearDiscovery, setGearDiscovery] = useState<GearDiscoveryState | null>(null);
  const [equipmentStats, setEquipmentStats] =
    useState<YanmarEquipmentStats>(defaultEquipmentStats);
  const [currency, setCurrency] = useState(() => session?.user?.currency ?? 0);
  const [totalXp, setTotalXp] = useState(() => session?.user?.totalXp ?? 0);
  const totalXpRef = useRef(totalXp);
  /** False until the first real XP value is applied — blocks false level-up on boot. */
  const xpHydratedRef = useRef((session?.user?.totalXp ?? 0) > 0);
  const attachmentWarningTimerRef = useRef<number | null>(null);
  const attachmentWarningMessageRef = useRef<string | null>(null);
  const [travelRaiseWarn, setTravelRaiseWarn] = useState<{
    key: number;
    phase: "hold" | "fade";
  } | null>(null);
  const [previewStars, setPreviewStars] = useState(() => session?.user?.currency ?? 0);
  const [tutorialFlash, setTutorialFlash] = useState<{
    kind: "phase" | "complete";
    message: string;
    key: number;
  } | null>(null);
  const [tutorialPhaseDisplay, setTutorialPhaseDisplay] = useState({
    current: 1,
    total: 1,
  });
  const tutorialFlashTimersRef = useRef<number[]>([]);
  const tutorialUiPauseUntilRef = useRef(0);
  const tutorialCelebratedPhaseRef = useRef(-1);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [soundSettings, updateSoundSettings] = useSoundSettings();
  const [showMinimap, setShowMinimap] = useState(true);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showMissionQuest, setShowMissionQuest] = useState(true);
  const [showTutorialMenu, setShowTutorialMenu] = useState(false);
  const [showQuestPanel, setShowQuestPanel] = useState(false);
  const [showShopPanel, setShowShopPanel] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showRepairPanel, setShowRepairPanel] = useState(false);
  const [gearItems, setGearItems] = useState<GearPanelItem[]>([]);
  const [enhanceCores, setEnhanceCores] = useState(0);
  const [gearInventorySlots, setGearInventorySlots] = useState(GEAR_INVENTORY_BASE);
  const [gearExpandCost, setGearExpandCost] = useState<number | null>(100);
  const [activeChassisId, setActiveChassisId] = useState<ChassisModelId | string>("ViO17_1");
  const [ownedChassisIds, setOwnedChassisIds] = useState<string[]>(["ViO17_1"]);
  const [profileAvatarId, setProfileAvatarId] = useState<string | null>(
    () => session?.user?.profileAvatarId ?? null,
  );
  const [abilityAlloc, setAbilityAlloc] = useState<AbilityAlloc>(() => emptyAbilityAlloc());
  const [gearBusy, setGearBusy] = useState(false);
  const [gachaBusy, setGachaBusy] = useState(false);
  const [lastGachaResults, setLastGachaResults] = useState<
    { nameSnapshot: string; grade: string; slot?: string }[] | null
  >(null);
  const [lastGachaBanner, setLastGachaBanner] = useState<
    "STANDARD" | "PREMIUM" | null
  >(null);
  const [showGachaResultModal, setShowGachaResultModal] = useState(false);
  const [repairBuffExpiresAt, setRepairBuffExpiresAt] = useState<string | null>(
    null,
  );
  const [maintenance, setMaintenance] = useState<MaintenanceSnapshot | null>(
    null,
  );
  const repairStateRef = useRef<Parameters<typeof computeMaintenanceSnapshot>[0]>(
    null,
  );
  const maintenanceEligibleRef = useRef<Set<MaintenanceFluidId>>(new Set());
  const [maintenanceBubbleId, setMaintenanceBubbleId] =
    useState<MaintenanceFluidId | null>(null);
  /** serverNow - Date.now() when last synced (fixes countdown / claim skew). */
  const serverNowOffsetRef = useRef(0);
  const [serverNowOffsetMs, setServerNowOffsetMs] = useState(0);

  const syncServerNow = useCallback((serverNow: unknown) => {
    const ts = typeof serverNow === "number" ? serverNow : Number(serverNow);
    if (!Number.isFinite(ts)) return;
    const offset = ts - Date.now();
    serverNowOffsetRef.current = offset;
    setServerNowOffsetMs(offset);
  }, []);
  const [nearRepairTent, setNearRepairTent] = useState(false);
  const nearRepairTentRef = useRef(false);
  const [nearWorkshopId, setNearWorkshopId] = useState<WorkshopId | null>(null);
  const nearWorkshopIdRef = useRef<WorkshopId | null>(null);
  const [showWorkshopPanel, setShowWorkshopPanel] = useState(false);
  const [activeWorkshopId, setActiveWorkshopId] = useState<WorkshopId | null>(
    null,
  );
  const [workshopPanelState, setWorkshopPanelState] =
    useState<WorkshopPanelState | null>(null);
  const [workshopQuestState, setWorkshopQuestState] =
    useState<WorkshopQuestState | null>(null);
  const workshopQuestStateRef = useRef<WorkshopQuestState | null>(null);
  const [workshopBusy, setWorkshopBusy] = useState(false);
  const [nearMonument, setNearMonument] = useState(false);
  const nearMonumentRef = useRef(false);
  const [showMonumentPanel, setShowMonumentPanel] = useState(false);
  const [monumentPanelState, setMonumentPanelState] =
    useState<MonumentPanelState | null>(null);
  const [monumentQuestState, setMonumentQuestState] =
    useState<MonumentQuestState | null>(null);
  const monumentQuestStateRef = useRef<MonumentQuestState | null>(null);
  const [monumentBusy, setMonumentBusy] = useState(false);
  const monumentPhaseRef = useRef<MonumentPhase>("locked");
  const monumentTutorialArmedRef = useRef(false);
  const [gachaTicketsStandard, setGachaTicketsStandard] = useState(0);
  const [gachaTicketsPremium, setGachaTicketsPremium] = useState(0);
  const [freeGacha, setFreeGacha] = useState<GachaFreeStatus | null>(null);
  const travelMetersAccumRef = useRef(0);
  const travelFlushBusyRef = useRef(false);
  const [activeShopBuffs, setActiveShopBuffs] = useState<ActiveShopBuff[]>([]);
  const [purchasingShopItemId, setPurchasingShopItemId] =
    useState<ShopItemId | null>(null);
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
  const [showEquipmentUpgrade, setShowEquipmentUpgrade] = useState(false);
  const [showInventoryFullModal, setShowInventoryFullModal] = useState(false);
  const [headerHudReady, setHeaderHudReady] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>(
    initialPlayMode === "ride" ? 3 : 1,
  );
  const lookOffsetRef = useRef<CameraLookOffset>(createCameraLookOffset());
  const freeLookPointersRef = useRef(
    new Map<number, { x: number; y: number }>(),
  );
  const freeLookPinchRef = useRef<{ lastSpan: number } | null>(null);
  const freeLookDragRef = useRef<{
    pointerId: number | null;
    lastX: number;
    lastY: number;
    lastTime: number;
  }>({ pointerId: null, lastX: 0, lastY: 0, lastTime: 0 });
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
  const tutorialPhaseRef = useRef<TutorialPhaseProgress | null>(null);
  const tutorialWaypointRef = useRef<TutorialWaypoint | null>(null);
  const tutorialGuideRef = useRef("");
  const [tutorialGuide, setTutorialGuide] = useState("");
  const [tutorialHasWaypoint, setTutorialHasWaypoint] = useState(false);
  const digFeedbackRef = useRef<DigFeedback>(createDigFeedback());
  const [digFeedback, setDigFeedback] = useState<DigFeedback>(createDigFeedback());
  const dumpTruckStateRef = useRef(createDumpTruckState());
  const dumpTruckPoseRef = useRef<DumpTruckPose>(getDumpTruckPose(dumpTruckStateRef.current));
  const digHudTickRef = useRef(0);
  const lastSyncedCrashHitTickRef = useRef(0);
  const lastBreakerVibrationAtRef = useRef(Number.NEGATIVE_INFINITY);
  const lastHudProgressRef = useRef(-1);
  const arcadeScoreRef = useRef(0);
  const rewardStarsRef = useRef(0);
  const currencyRef = useRef(session?.user?.currency ?? 0);
  const worldPickupsRef = useRef(createEmptyWorldPickupsState());
  const worldPickupRevisionRef = useRef(0);
  const worldPickupOwnerRef = useRef<string | null>(session?.user?.id ?? null);
  const [worldPickupRevision, setWorldPickupRevision] = useState(0);
  const processedExitSignalRef = useRef(0);
  const processedScoreCommitRef = useRef(0);
  const dumpScorePanelRef = useRef<DumpScorePanelState | null>(null);
  const showStandaloneRewardPanelRef = useRef<
    (
      score: number,
      critical: boolean,
      earnedStars: number,
      earnedXp?: number,
      rewardText?: string,
      earnedEnhanceCores?: number,
      earnedMonumentPoints?: number,
      earnedGachaTicketsStandard?: number,
      earnedGachaTicketsPremium?: number,
    ) => void
  >(() => {});
  const dumpScoreHideTimerRef = useRef<number | null>(null);
  const dumpOutboxOwnerRef = useRef<string | null>(null);
  const dumpOutboxOpenBatchRef = useRef<DumpRewardOutboxBatch | null>(null);
  const dumpOutboxDebounceTimerRef = useRef<number | null>(null);
  const dumpOutboxInFlightRef = useRef<Set<string>>(new Set());
  const dumpOutboxFlushOwnersRef = useRef<Set<string>>(new Set());
  const dumpOutboxOptimisticRef = useRef<Map<string, DumpRewardOutboxBatch>>(
    new Map(),
  );
  const couponDiscoveryRef = useRef<CouponDiscoveryState | null>(null);
  const couponDiscoveryHideTimerRef = useRef<number | null>(null);
  const gearDiscoveryRef = useRef<GearDiscoveryState | null>(null);
  const gearDiscoveryHideTimerRef = useRef<number | null>(null);
  const equipmentStatsRef = useRef<YanmarEquipmentStats>(defaultEquipmentStats);
  const baseEquipmentStatsRef =
    useRef<YanmarEquipmentStats>(defaultEquipmentStats);
  const activeShopBuffsRef = useRef(activeShopBuffs);
  activeShopBuffsRef.current = activeShopBuffs;

  const publishEquipmentStats = useCallback((base: YanmarEquipmentStats) => {
    baseEquipmentStatsRef.current = base;
    const effective = applyShopBuffsToStats(
      base,
      activeShopBuffIds(activeShopBuffsRef.current),
    );
    equipmentStatsRef.current = effective;
    setEquipmentStats(effective);
  }, []);
  const publishEquipmentStatsRef = useRef(publishEquipmentStats);
  publishEquipmentStatsRef.current = publishEquipmentStats;
  const equipmentLoadGenRef = useRef(0);
  const sceneReadyRef = useRef(false);

  useEffect(() => {
    publishEquipmentStats(baseEquipmentStatsRef.current);
  }, [activeShopBuffs, publishEquipmentStats]);
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
    if (!force && endedRef.current) return;

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
        haulTruckCooldownSec: equipmentStatsRef.current.haulTruckCooldownSec,
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
    if (
      simRef.current.attachmentType === "breaker" ||
      simRef.current.attachmentType === "grapple"
    ) {
      resolveAttachmentTipClearance(
        simRef.current,
        terrainRef.current,
        auxiliaryRef.current.boomSwing,
        auxiliaryRef.current.grappleOpen,
      );
    }
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
    if (crashHitChanged) {
      const delta = fb.crashHitTick - lastSyncedCrashHitTickRef.current;
      if (delta > 0) {
        const now = performance.now();
        // Pedal release no longer depends on lostpointercapture, so vibrate
        // during a held strike is safe (throttle: once per 2s).
        if (now - lastBreakerVibrationAtRef.current >= 2000) {
          lastBreakerVibrationAtRef.current = now;
          if (typeof navigator.vibrate === "function") navigator.vibrate(120);
        }
      }
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
      Math.round(prev.gripAdhesion * 100) ===
        Math.round(Math.min(1, fb.gripAdhesion) * 100) &&
      Math.round(prev.gripPressure * 100) ===
        Math.round(Math.min(1, fb.gripPressure) * 100) &&
      prev.grappleLiftResult === fb.grappleLiftResult &&
      prev.grappleLiftResultTick === fb.grappleLiftResultTick &&
      prev.digging === fb.digging &&
      prev.bladeWorking === fb.bladeWorking &&
      Math.abs(prev.groundDepth - fb.groundDepth) < 0.05 &&
      prev.bucketOpenReady === fb.bucketOpenReady &&
      prev.insertedDeepEnough === fb.insertedDeepEnough &&
      prev.bucketCurlReady === fb.bucketCurlReady &&
      prev.armPulling === fb.armPulling &&
      prev.optimalDigPose === fb.optimalDigPose &&
      prev.canDump === fb.canDump &&
      prev.dumpBodyTouching === fb.dumpBodyTouching &&
      prev.dumpFacingBed === fb.dumpFacingBed &&
      prev.truckPresent === fb.truckPresent &&
      prev.haulTruckPresent === fb.haulTruckPresent &&
      prev.nearHaulTruck === fb.nearHaulTruck &&
      prev.carryingRock === fb.carryingRock &&
      prev.truckCanAccept === fb.truckCanAccept &&
      Math.abs(prev.truckFillRatio - fb.truckFillRatio) < 0.02 &&
      Math.abs(prev.truckCooldownRemaining - fb.truckCooldownRemaining) < 0.15 &&
      prev.haulTruckCanAccept === fb.haulTruckCanAccept &&
      Math.abs(prev.haulTruckFillRatio - fb.haulTruckFillRatio) < 0.02 &&
      Math.abs(prev.haulTruckCooldownRemaining - fb.haulTruckCooldownRemaining) < 0.15 &&
      prev.haulTruckLoadCount === fb.haulTruckLoadCount &&
      prev.haulTruckCapacity === fb.haulTruckCapacity &&
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
      ) &&
      Math.abs(prev.crashCooldownEtaSec - fb.crashCooldownEtaSec) < 0.15 &&
      Math.abs(prev.hillCooldownEtaSec - fb.hillCooldownEtaSec) < 0.15
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
    const previousUserId = gameSessionUserIdRef.current;
    if (previousUserId !== userId) {
      gameSessionRestoredRef.current = false;
    }
    if (userId) {
      dumpTruckUserIdRef.current = userId;
      gameSessionUserIdRef.current = userId;
    } else {
      dumpTruckUserIdRef.current = null;
      gameSessionUserIdRef.current = null;
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
    autoPoseRef.current.slots = [
      savedSlots[0],
      savedSlots[1],
      savedSlots[2],
      savedSlots[3],
    ];
    autoPoseRef.current.saved = savedSlots[autoPoseRef.current.activeSlot];
    // 실행 중이면 유지하고, 아니면 저장된 슬롯만 복원한다.
    if (!autoPoseRef.current.executing) {
      autoPoseRef.current.phase = null;
    }
    setAutoPose({
      ...autoPoseRef.current,
      slots: [...autoPoseRef.current.slots],
    });
    setAutoPoseLabels(loadAutoPoseSlotLabelsForSession(userId));

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
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        saveBeforeLeaving();
      }
    };
    window.addEventListener("pagehide", saveBeforeLeaving);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", saveBeforeLeaving);
      document.removeEventListener("visibilitychange", onVisibility);
    };
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

  const clearFreeLook = useCallback(() => {
    resetCameraLookOffset(lookOffsetRef.current);
    freeLookDragRef.current.pointerId = null;
    freeLookDragRef.current.lastTime = 0;
    freeLookPointersRef.current.clear();
    freeLookPinchRef.current = null;
  }, []);

  const isFreeLookTraveling = useCallback(() => {
    const travel = inputRef.current.travel;
    return (
      Math.abs(travel.left) > FREE_LOOK_TRAVEL_THRESHOLD ||
      Math.abs(travel.right) > FREE_LOOK_TRAVEL_THRESHOLD
    );
  }, []);

  const clampFreeLookPitch = useCallback((pitch: number) => {
    return Math.max(FREE_LOOK_PITCH_MIN, Math.min(FREE_LOOK_PITCH_MAX, pitch));
  }, []);

  const clampFreeLookDistance = useCallback((distance: number) => {
    return Math.max(
      FREE_LOOK_DISTANCE_MIN,
      Math.min(FREE_LOOK_DISTANCE_MAX, distance),
    );
  }, []);

  const applyFreeLookDragDelta = useCallback(
    (dx: number, dy: number, dtSec: number) => {
      const look = lookOffsetRef.current;
      const yawDelta = -dx * FREE_LOOK_SENSITIVITY;
      const pitchDelta = -dy * FREE_LOOK_SENSITIVITY;
      look.targetYaw += yawDelta;
      look.targetPitch = clampFreeLookPitch(look.targetPitch + pitchDelta);

      const safeDt = Math.max(0.004, Math.min(dtSec, 0.05));
      const instantVelYaw = yawDelta / safeDt;
      const instantVelPitch = pitchDelta / safeDt;
      look.velYaw =
        look.velYaw * (1 - FREE_LOOK_VEL_SMOOTH) +
        instantVelYaw * FREE_LOOK_VEL_SMOOTH;
      look.velPitch =
        look.velPitch * (1 - FREE_LOOK_VEL_SMOOTH) +
        instantVelPitch * FREE_LOOK_VEL_SMOOTH;
      look.velYaw = Math.max(
        -FREE_LOOK_VEL_MAX,
        Math.min(FREE_LOOK_VEL_MAX, look.velYaw),
      );
      look.velPitch = Math.max(
        -FREE_LOOK_VEL_MAX,
        Math.min(FREE_LOOK_VEL_MAX, look.velPitch),
      );
    },
    [clampFreeLookPitch],
  );

  const syncFreeLookDragFromPointers = useCallback(() => {
    const pointers = freeLookPointersRef.current;
    if (pointers.size !== 1) {
      freeLookDragRef.current.pointerId = null;
      lookOffsetRef.current.dragging = pointers.size > 0;
      return;
    }
    const [pointerId, point] = pointers.entries().next().value!;
    freeLookDragRef.current = {
      pointerId,
      lastX: point.x,
      lastY: point.y,
      lastTime: performance.now(),
    };
    lookOffsetRef.current.dragging = true;
  }, []);

  const onFreeLookPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      if (isFreeLookTraveling()) return;
      const pointers = freeLookPointersRef.current;
      pointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      event.currentTarget.setPointerCapture(event.pointerId);
      lookOffsetRef.current.dragging = true;
      lookOffsetRef.current.velYaw = 0;
      lookOffsetRef.current.velPitch = 0;

      if (pointers.size >= 2) {
        const [a, b] = pointers.values();
        freeLookPinchRef.current = {
          lastSpan: Math.hypot(a.x - b.x, a.y - b.y),
        };
        freeLookDragRef.current.pointerId = null;
      } else {
        freeLookPinchRef.current = null;
        syncFreeLookDragFromPointers();
      }
    },
    [isFreeLookTraveling, syncFreeLookDragFromPointers],
  );

  const onFreeLookPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const pointers = freeLookPointersRef.current;
      if (!pointers.has(event.pointerId)) return;

      const native = event.nativeEvent;
      const samples =
        typeof native.getCoalescedEvents === "function"
          ? native.getCoalescedEvents()
          : [native];

      if (isFreeLookTraveling()) {
        clearFreeLook();
        return;
      }

      const look = lookOffsetRef.current;
      look.dragging = true;

      if (pointers.size >= 2) {
        for (const sample of samples) {
          pointers.set(event.pointerId, {
            x: sample.clientX,
            y: sample.clientY,
          });
        }
        const [a, b] = pointers.values();
        const span = Math.hypot(a.x - b.x, a.y - b.y);
        let pinch = freeLookPinchRef.current;
        if (!pinch || pinch.lastSpan <= 1) {
          freeLookPinchRef.current = { lastSpan: span };
          return;
        }
        if (span > 1) {
          look.targetDistance = clampFreeLookDistance(
            look.targetDistance * (pinch.lastSpan / span),
          );
          pinch.lastSpan = span;
        }
        return;
      }

      const drag = freeLookDragRef.current;
      if (drag.pointerId !== event.pointerId) return;

      let prevX = drag.lastX;
      let prevY = drag.lastY;
      let prevTime = drag.lastTime || performance.now();
      for (const sample of samples) {
        const now =
          typeof sample.timeStamp === "number" && sample.timeStamp > 0
            ? sample.timeStamp
            : performance.now();
        const dx = sample.clientX - prevX;
        const dy = sample.clientY - prevY;
        const dtSec = Math.max(0.001, (now - prevTime) / 1000);
        if (dx !== 0 || dy !== 0) {
          applyFreeLookDragDelta(dx, dy, dtSec);
        }
        prevX = sample.clientX;
        prevY = sample.clientY;
        prevTime = now;
        pointers.set(event.pointerId, {
          x: sample.clientX,
          y: sample.clientY,
        });
      }
      drag.lastX = prevX;
      drag.lastY = prevY;
      drag.lastTime = prevTime;
    },
    [
      applyFreeLookDragDelta,
      clampFreeLookDistance,
      clearFreeLook,
      isFreeLookTraveling,
    ],
  );

  const onFreeLookPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const pointers = freeLookPointersRef.current;
      if (!pointers.has(event.pointerId)) return;
      pointers.delete(event.pointerId);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      if (pointers.size < 2) {
        freeLookPinchRef.current = null;
      } else {
        const [a, b] = pointers.values();
        freeLookPinchRef.current = {
          lastSpan: Math.hypot(a.x - b.x, a.y - b.y),
        };
      }

      if (pointers.size === 0) {
        lookOffsetRef.current.dragging = false;
        // Keep a bit of inertia so orbit feels continuous after release.
        const look = lookOffsetRef.current;
        look.velYaw *= 0.85;
        look.velPitch *= 0.85;
      }
      syncFreeLookDragFromPointers();
    },
    [syncFreeLookDragFromPointers],
  );

  const modeRef = useRef<GameMode>(mode);
  const sessionRoleRef = useRef(session?.user?.role);
  sessionRoleRef.current = session?.user?.role;

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

  const showAttachmentWarning = useCallback(
    (message: string, opts?: { enhanceCores?: number; stars?: number }) => {
      const isReward = Boolean(opts?.enhanceCores || opts?.stars);
      // Identical status toast already up — do not remount / reset the dismiss
      // timer (sim contact flicker used to spam this and freeze the banner).
      if (
        !isReward &&
        attachmentWarningMessageRef.current === message &&
        attachmentWarningTimerRef.current != null
      ) {
        return;
      }
      if (attachmentWarningTimerRef.current != null) {
        window.clearTimeout(attachmentWarningTimerRef.current);
      }
      attachmentWarningMessageRef.current = message;
      setAttachmentWarning((current) => ({
        key: (current?.key ?? 0) + 1,
        message,
        enhanceCores: opts?.enhanceCores,
        stars: opts?.stars,
      }));
      attachmentWarningTimerRef.current = window.setTimeout(() => {
        setAttachmentWarning(null);
        attachmentWarningTimerRef.current = null;
        attachmentWarningMessageRef.current = null;
      }, 2400);
    },
    [],
  );

  useEffect(() => {
    if (mode === "intro" || mode === "gameReady") {
      setTravelRaiseWarn(null);
      return;
    }

    if (digFeedback.travelBlockedRaiseArm) {
      setTravelRaiseWarn((prev) =>
        prev?.phase === "hold"
          ? prev
          : { key: (prev?.key ?? 0) + 1, phase: "hold" },
      );
      return;
    }

    setTravelRaiseWarn((prev) => {
      if (!prev || prev.phase === "fade") return prev;
      return { key: prev.key, phase: "fade" };
    });
  }, [digFeedback.travelBlockedRaiseArm, mode]);

  useEffect(() => {
    if (travelRaiseWarn?.phase !== "fade") return;
    const timer = window.setTimeout(() => {
      setTravelRaiseWarn(null);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [travelRaiseWarn]);

  const isAdmin = session?.user?.role === "ADMIN";
  const practiceUnlocksAll =
    mode === "practice" ||
    mode === "tutorial" ||
    mode === "sportsRanked" ||
    mode === "sportsPractice" ||
    isAdmin;

  const handleAttachmentChange = useCallback(
    (next: AttachmentType) => {
      const modeNow = modeRef.current;
      const unlockAll =
        modeNow === "practice" ||
        modeNow === "tutorial" ||
        modeNow === "sportsRanked" ||
        modeNow === "sportsPractice" ||
        sessionRoleRef.current === "ADMIN";
      const playerLevel = getPlayerLevelProgress(totalXpRef.current).level;
      if (!isAttachmentUnlocked(next, playerLevel, { unlockAll })) {
        showAttachmentWarning(
          next === "breaker"
            ? "브레이커는 유저 레벨 10에 개방됩니다."
            : "집게는 유저 레벨 15에 개방됩니다.",
        );
        return;
      }
      if (
        modeNow === "sportsRanked" ||
        modeNow === "sportsPractice"
      ) {
        const run = sportsMeetRunRef.current;
        const stage = run ? currentSportsStage(run) : null;
        const allowed = getSportsMeetAllowedAttachment(stage);
        if (allowed && next !== allowed) {
          showAttachmentWarning(
            sportsMeetStageLockMessage(stage) ||
              "이 코스에서는 해당 부착물을 쓸 수 없습니다.",
          );
          return;
        }
      }
      if (simRef.current.bucketLoad > 0.01 && next !== "bucket") {
        showAttachmentWarning("버켓에 흙이 남아 있어 다른 부착물로 전환할 수 없습니다.");
        return;
      }
      simRef.current.attachmentType = next;
      simRef.current.carriedBoulderId = null;
      // Breaker/grapple tips are longer than the bucket — lift clear so the
      // ground constraint does not freeze hydraulics/travel on swap.
      if (next === "breaker" || next === "grapple") {
        resolveAttachmentTipClearance(
          simRef.current,
          terrainRef.current,
          auxiliaryRef.current.boomSwing,
          auxiliaryRef.current.grappleOpen,
        );
      }
      setAttachmentType(next);
      if (attachmentWarningTimerRef.current != null) {
        window.clearTimeout(attachmentWarningTimerRef.current);
        attachmentWarningTimerRef.current = null;
      }
      attachmentWarningMessageRef.current = null;
      setAttachmentWarning(null);
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
      const wasHydrated = xpHydratedRef.current;
      totalXpRef.current = nextXp;
      setTotalXp(nextXp);
      xpHydratedRef.current = true;
      const previousTier = terrainRef.current.mapTier;
      terrainRef.current = expandTerrainForLevel(terrainRef.current, nextLevel);
      if (terrainRef.current.mapTier !== previousTier) {
        setTerrainRevision((key) => key + 1);
      }
      // Only celebrate real in-session gains — not 0→savedXp hydration on connect.
      if (
        opts?.announceLevelUp &&
        wasHydrated &&
        nextLevel > prevLevel
      ) {
        showLevelUpToast(nextLevel);
        enqueueUnlockNotices(getCrossedUnlocks(prevLevel, nextLevel));
      }
    },
    [enqueueUnlockNotices, showLevelUpToast],
  );
  const applyTotalXpRef = useRef(applyTotalXp);
  applyTotalXpRef.current = applyTotalXp;

  const syncSessionBalances = useCallback(
    (
      data: { currency?: unknown; totalXp?: unknown },
      opts?: { displayCurrency?: number; syncPreviewCurrency?: boolean },
    ) => {
      const user: { currency?: number; totalXp?: number } = {};
      if (typeof data.currency === "number") {
        user.currency = data.currency;
        currencyRef.current = opts?.displayCurrency ?? data.currency;
        setCurrency(currencyRef.current);
        if (opts?.syncPreviewCurrency) setPreviewStars(data.currency);
      }
      if (typeof data.totalXp === "number") {
        user.totalXp = data.totalXp;
        applyTotalXp(data.totalXp, { announceLevelUp: true });
      }
      if (user.currency !== undefined || user.totalXp !== undefined) {
        void updateSessionRef.current({ user });
      }
    },
    [applyTotalXp],
  );

  const pushQuestProgress = useCallback(
    (metric: QuestMetric, amount: number) => {
      if (amount <= 0) return;
      const modeNow = modeRef.current;
      if (
        modeNow === "intro" ||
        modeNow === "ride" ||
        modeNow === "practice" ||
        modeNow === "tutorial" ||
        modeNow === "sportsRanked" ||
        modeNow === "sportsPractice"
      ) {
        return;
      }
      const current = questStateRef.current;
      if (current) {
        const next = applyQuestProgress(current, { metric, amount });
        if (next !== current) {
          questStateRef.current = next;
          setQuestState(next);
          saveQuestState(next);
        }
      }

      const workshopMetric = metric as WorkshopQuestMetric;
      if (
        workshopMetric === "soilDump" ||
        workshopMetric === "dumpTruckDepart" ||
        workshopMetric === "asphaltBreak" ||
        workshopMetric === "rockDump" ||
        workshopMetric === "haulTruckDepart"
      ) {
        const wq = workshopQuestStateRef.current;
        if (wq) {
          const nextWq = applyWorkshopQuestMetric(wq, workshopMetric, amount);
          if (nextWq !== wq) {
            workshopQuestStateRef.current = nextWq;
            setWorkshopQuestState(nextWq);
            saveWorkshopQuestState(nextWq);
          }
        }
      }

      const monumentMetric = metric as MonumentQuestMetric;
      if (
        monumentMetric === "soilDump" ||
        monumentMetric === "dumpTruckDepart" ||
        monumentMetric === "asphaltBreak" ||
        monumentMetric === "haulTruckDepart" ||
        monumentMetric === "rockDump" ||
        monumentMetric === "travel"
      ) {
        const mq = monumentQuestStateRef.current;
        if (mq) {
          const nextMq = pushMonumentQuestProgress(
            mq,
            monumentMetric,
            amount,
            monumentPhaseRef.current === "active",
          );
          if (nextMq !== mq) {
            monumentQuestStateRef.current = nextMq;
            setMonumentQuestState(nextMq);
            saveMonumentQuestState(nextMq);
          }
        }
      }
    },
    [],
  );

  /** 접속 유지 중 KST 0시가 지나면 일일 퀘스트를 갱신하고 로그인 미션을 즉시 완료한다. */
  const syncQuestDayRollover = useCallback(() => {
    const ownerId =
      session?.user?.id ?? questStateRef.current?.ownerId ?? "local";
    const today = getQuestDayKey();
    const current = questStateRef.current;
    const level = getPlayerLevelProgress(totalXpRef.current).level;

    if (!current || current.dayKey !== today) {
      const next = loadQuestState(ownerId, level);
      questStateRef.current = next;
      setQuestState(next);
      saveQuestState(next);

      const wq = loadWorkshopQuestState(ownerId);
      workshopQuestStateRef.current = wq;
      setWorkshopQuestState(wq);

      const mq = monumentQuestStateRef.current;
      if (mq) {
        const synced = ensureMonumentQuestsForPhase(
          mq,
          monumentPhaseRef.current,
        );
        if (synced !== mq) {
          monumentQuestStateRef.current = synced;
          setMonumentQuestState(synced);
          saveMonumentQuestState(synced);
        }
      }
    }

    if (session?.user?.id) {
      pushQuestProgress("login", 1);
    }
  }, [session?.user?.id, pushQuestProgress]);

  const loadWorkshopState = useCallback(async () => {
    try {
      const res = await fetch("/api/workshop/yanmar/state");
      if (!res.ok) return;
      const data = await res.json();
      if (!data.ok) return;
      setWorkshopPanelState({
        points: data.points,
        levels: data.levels,
        shopPurchases: data.shopPurchases,
        weekKey: data.weekKey,
        pendingByWorkshop: data.pendingByWorkshop,
        totalXp: data.totalXp,
        currency: data.currency,
      });
      if (typeof data.totalXp === "number") {
        if (data.totalXp !== totalXpRef.current) {
          applyTotalXp(data.totalXp, { announceLevelUp: false });
          void updateSessionRef.current({ user: { totalXp: data.totalXp } });
        }
      }
      if (typeof data.gachaTicketsStandard === "number") {
        setGachaTicketsStandard(data.gachaTicketsStandard);
      }
      if (typeof data.gachaTicketsPremium === "number") {
        setGachaTicketsPremium(data.gachaTicketsPremium);
      }
      if (typeof data.enhanceCores === "number") {
        setEnhanceCores(data.enhanceCores);
      }
      if (typeof data.currency === "number") {
        currencyRef.current = data.currency;
        setCurrency(data.currency);
      }
    } catch {
      /* ignore */
    }
  }, [applyTotalXp]);

  const warpToMonument = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;
    sim.posX = SITE_LAYOUT.monument[0];
    sim.posZ = SITE_LAYOUT.monument[1] - 8;
    sim.heading = 0;
    const velocity = velRef.current;
    if (velocity) velocity.travel = 0;
  }, []);

  const warpToSportsMeetPortal = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;
    sim.posX = SITE_LAYOUT.sportsPortal[0] - 6;
    sim.posZ = SITE_LAYOUT.sportsPortal[1];
    sim.heading = Math.PI * 0.5;
    const velocity = velRef.current;
    if (velocity) velocity.travel = 0;
  }, []);

  const refreshSportsMeetTicket = useCallback(async () => {
    try {
      const res = await fetch("/api/sports-meet/yanmar/ticket");
      if (!res.ok) return;
      const data = (await res.json()) as {
        ticket?: { remaining?: number; limit?: number };
      };
      const remaining = data.ticket?.remaining;
      const limit = data.ticket?.limit;
      if (typeof remaining === "number" && typeof limit === "number") {
        setSportsMeetTicket({ remaining, limit });
      }
    } catch {
      /* ignore */
    }
  }, []);

  const syncSportsMeetRun = useCallback((next: SportsMeetRunState | null) => {
    sportsMeetRunRef.current = next;
    setSportsMeetRun(next);
    setSportsMeetPickupRevision((n) => n + 1);
  }, []);

  /** After dig/crash/hill/star clear advances a stage — spawn stars/warp/attachment. */
  const finalizeSportsMeetStageAdvance = useCallback(
    (before: SportsMeetRunState, next: SportsMeetRunState) => {
      if (next.stageIndex === before.stageIndex || next.phase !== "racing") {
        return next;
      }
      const pattern = getSportsMeetPattern(next.weekKey);
      let prepared = prepareSportsMeetStageContent(
        next,
        pattern,
        (x, z) => heightAtTerrain(terrainRef.current, x, z),
      );
      const stage = prepared.stageOrder[prepared.stageIndex];
      if (stage) {
        const spawn = sportsMeetStageWaypoint(
          pattern,
          stage,
          prepared.stageIndex,
        );
        const sim = simRef.current;
        if (sim) {
          sim.posX = spawn.x;
          sim.posZ = spawn.z;
          if (spawn.heading != null) sim.heading = spawn.heading;
          if (stage === "drive" || stage === "dig") {
            sim.attachmentType = "bucket";
          } else if (stage === "crash") {
            sim.attachmentType = "breaker";
          } else {
            sim.attachmentType = "grapple";
          }
          setAttachmentType(sim.attachmentType);
          if (stage === "dig") {
            resetDumpTruckState(dumpTruckStateRef.current);
          }
        }
        showAttachmentWarning(
          isSportsMeetFinishDriveStage(
            prepared.stageOrder,
            prepared.stageIndex,
          )
            ? "골인 주행 시작! FINISH로 달리세요"
            : `${STAGE_LABEL_KO[stage]} 코스 시작!`,
        );
      }
      setSportsMeetPickupRevision((n) => n + 1);
      return prepared;
    },
    [showAttachmentWarning],
  );

  const exitSportsMeet = useCallback(() => {
    const main = sportsMainTerrainRef.current;
    if (main) {
      terrainRef.current = main;
      sportsMainTerrainRef.current = null;
      setTerrainRevision((k) => k + 1);
    }
    if (sportsEquipmentSnapRef.current) {
      equipmentStatsRef.current = sportsEquipmentSnapRef.current;
      setEquipmentStats(sportsEquipmentSnapRef.current);
      sportsEquipmentSnapRef.current = null;
    }
    yanmarAudio.setSportsMeetBgm(false);
    setSportsResultSubmitted(false);
    syncSportsMeetRun(null);
    setMode("game");
    modeRef.current = "game";
    warpToSportsMeetPortal();
    void refreshSportsMeetTicket();
  }, [refreshSportsMeetTicket, syncSportsMeetRun, warpToSportsMeetPortal]);

  const enterSportsMeet = useCallback(
    async (playMode: SportsMeetPlayMode) => {
      setShowSportsMeetPanel(false);
      setSportsResultSubmitted(false);
      // Arm sports BGM on the click gesture before any await (autoplay policy).
      yanmarAudio.unlock();
      yanmarAudio.setSportsMeetBgm(true);

      let runId: string | null = null;
      if (playMode === "ranked") {
        const res = await fetch("/api/sports-meet/yanmar/ticket", {
          method: "POST",
        });
        if (!res.ok) {
          yanmarAudio.setSportsMeetBgm(false);
          showAttachmentWarning("도전권이 없거나 시작할 수 없습니다.");
          return;
        }
        const data = (await res.json()) as {
          runId?: string;
          ticket?: { remaining?: number; limit?: number };
        };
        runId = data.runId ?? null;
        if (typeof data.ticket?.remaining === "number") {
          setSportsMeetTicket({
            remaining: data.ticket.remaining,
            limit: data.ticket.limit ?? 1,
          });
        }
      }

      const weekKey = getSportsMeetWeekKey();
      const pattern = getSportsMeetPattern(weekKey);
      const mission = getSportsMeetMissionForWeek(weekKey);
      sportsMainTerrainRef.current = terrainRef.current;
      sportsEquipmentSnapRef.current = { ...equipmentStatsRef.current };

      terrainRef.current = createSportsMeetTerrain(pattern, mission);

      const nextStats = applySportsMeetEquipmentOverrides(
        equipmentStatsRef.current,
        mission,
      );
      equipmentStatsRef.current = nextStats;
      setEquipmentStats(nextStats);
      resetDumpTruckState(dumpTruckStateRef.current);
      setTerrainRevision((k) => k + 1);

      const run = beginSportsMeetRun(
        playMode,
        weekKey,
        (x, z) => heightAtTerrain(terrainRef.current, x, z),
        runId,
      );
      syncSportsMeetRun(run);

      const stage = run.stageOrder[0]!;
      const spawn = sportsMeetStageWaypoint(pattern, stage, 0);
      const sim = simRef.current;
      if (sim) {
        sim.posX = spawn.x;
        sim.posZ = spawn.z;
        sim.heading = spawn.heading ?? 0;
        sim.bucketLoad = 0;
        sim.carriedBoulderId = null;
        if (stage === "drive" || stage === "dig") sim.attachmentType = "bucket";
        else if (stage === "crash") sim.attachmentType = "breaker";
        else sim.attachmentType = "grapple";
        setAttachmentType(sim.attachmentType);
      }

      const nextMode =
        playMode === "ranked" ? "sportsRanked" : "sportsPractice";
      setMode(nextMode);
      modeRef.current = nextMode;
    },
    [showAttachmentWarning, syncSportsMeetRun],
  );

  const startSportsCountdown = useCallback(() => {
    const run = sportsMeetRunRef.current;
    if (!run || run.phase !== "ready") return;
    syncSportsMeetRun(startSportsMeetCountdown(run));
  }, [syncSportsMeetRun]);

  const grantSportsMeetCourseStar = useCallback(
    (run: SportsMeetRunState, starId: string) => {
      yanmarAudio.playStarAcquire();
      if (run.playMode !== "ranked" || !run.runId) {
        // Practice: SFX only — currency does not increase.
        return;
      }
      const optimistic = rollSportsMeetStarReward();
      const before = currencyRef.current;
      currencyRef.current = clampUserCurrency(before + optimistic);
      setCurrency(currencyRef.current);
      setPreviewStars(currencyRef.current);
      showAttachmentWarning(`스타 +${optimistic}`, { stars: optimistic });

      void (async () => {
        try {
          const res = await fetch("/api/sports-meet/yanmar/star", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ runId: run.runId, starId }),
          });
          if (!res.ok) {
            currencyRef.current = before;
            setCurrency(before);
            setPreviewStars(before);
            return;
          }
          const data = (await res.json()) as {
            stars?: number;
            currency?: number;
          };
          if (typeof data.currency === "number") {
            syncSessionBalances(data, { syncPreviewCurrency: true });
          } else if (typeof data.stars === "number") {
            const corrected = clampUserCurrency(before + data.stars);
            currencyRef.current = corrected;
            setCurrency(corrected);
            setPreviewStars(corrected);
          }
        } catch {
          currencyRef.current = before;
          setCurrency(before);
          setPreviewStars(before);
        }
      })();
    },
    [showAttachmentWarning, syncSessionBalances],
  );

  const loadMonumentState = useCallback(async () => {
    try {
      const res = await fetch("/api/monument/yanmar/state");
      if (!res.ok) return;
      const data = await res.json();
      if (!data.ok) return;
      const phase = (data.phase ?? "locked") as MonumentPhase;
      monumentPhaseRef.current = phase;
      setMonumentPanelState({
        phase,
        points: data.points ?? 0,
        levels: data.levels ?? {},
        pending: data.pending ?? null,
        constructionEndsAt: data.constructionEndsAt ?? null,
        starsStored: data.starsStored ?? 0,
        prodUpdatedAt: data.prodUpdatedAt ?? null,
        shopPurchases: data.shopPurchases ?? {},
        weekKey: data.weekKey ?? "",
        totalXp: data.totalXp,
        currency: data.currency,
      });
      if (typeof data.totalXp === "number") {
        if (data.totalXp !== totalXpRef.current) {
          applyTotalXp(data.totalXp, { announceLevelUp: false });
          void updateSessionRef.current({ user: { totalXp: data.totalXp } });
        }
      }
      if (typeof data.currency === "number") {
        currencyRef.current = data.currency;
        setCurrency(data.currency);
      }
      if (typeof data.gachaTicketsStandard === "number") {
        setGachaTicketsStandard(data.gachaTicketsStandard);
      }
      if (typeof data.gachaTicketsPremium === "number") {
        setGachaTicketsPremium(data.gachaTicketsPremium);
      }
      if (typeof data.enhanceCores === "number") {
        setEnhanceCores(data.enhanceCores);
      }

      const level = getPlayerLevelProgress(
        data.totalXp ?? totalXpRef.current,
      ).level;
      if (
        level >= MONUMENT_UNLOCK_LEVEL &&
        !data.tutorialDone &&
        !monumentTutorialArmedRef.current
      ) {
        monumentTutorialArmedRef.current = true;
        enqueueUnlockNotices(["MONUMENT"]);
      }

      const mq = monumentQuestStateRef.current;
      if (mq) {
        const synced = ensureMonumentQuestsForPhase(mq, phase);
        if (synced !== mq) {
          monumentQuestStateRef.current = synced;
          setMonumentQuestState(synced);
          saveMonumentQuestState(synced);
        }
      }
    } catch {
      /* ignore */
    }
  }, [applyTotalXp, enqueueUnlockNotices]);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    const ownerId = session?.user?.id ?? "local";
    const level = getPlayerLevelProgress(
      session?.user?.totalXp ?? totalXpRef.current,
    ).level;
    const loaded = loadQuestState(ownerId, level);
    questStateRef.current = loaded;
    setQuestState(loaded);
    const wq = loadWorkshopQuestState(ownerId);
    workshopQuestStateRef.current = wq;
    setWorkshopQuestState(wq);
    const mq = loadMonumentQuestState(ownerId);
    monumentQuestStateRef.current = mq;
    setMonumentQuestState(mq);
    questTrackRef.current.ready = false;
  }, [session?.user?.id, session?.user?.totalXp, sessionStatus]);

  useEffect(() => {
    if (sessionStatus === "loading" || !session?.user?.id) return;
    void loadWorkshopState();
    void loadMonumentState();
  }, [
    session?.user?.id,
    sessionStatus,
    loadWorkshopState,
    loadMonumentState,
  ]);

  /** Lv.25+ : soft-trigger weekly sports-meet settlement (lazy settle backup). */
  useEffect(() => {
    if (sessionStatus === "loading" || !session?.user?.id) return;
    const level = getPlayerLevelProgress(
      session.user.totalXp ?? totalXpRef.current,
    ).level;
    if (level < SPORTS_MEET_UNLOCK_LEVEL && session?.user?.role !== "ADMIN") {
      return;
    }
    void refreshSportsMeetTicket();
  }, [
    session?.user?.id,
    session?.user?.totalXp,
    session?.user?.role,
    sessionStatus,
    refreshSportsMeetTicket,
  ]);

  // If the player force-quit after claim (before pressing 확인), restore wallets
  // from the persisted grant + server state so the reward stays received.
  useEffect(() => {
    if (mode !== "game" || sessionStatus === "loading") return;
    const grant = loadHourlyAdGrantLocally(getHourlyAdHourBucket());
    if (!grant) return;

    if (typeof grant.currency === "number") {
      currencyRef.current = Math.max(currencyRef.current, grant.currency);
      setCurrency(currencyRef.current);
      setPreviewStars(currencyRef.current);
    }
    if (typeof grant.gachaTicketsStandard === "number") {
      setGachaTicketsStandard((prev) =>
        Math.max(prev, grant.gachaTicketsStandard!),
      );
    }
    if (typeof grant.gachaTicketsPremium === "number") {
      setGachaTicketsPremium((prev) =>
        Math.max(prev, grant.gachaTicketsPremium!),
      );
    }
    if (session?.user?.id) {
      void loadWorkshopState();
      void loadMonumentState();
    }
  }, [
    mode,
    session?.user?.id,
    sessionStatus,
    loadMonumentState,
    loadWorkshopState,
  ]);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    setActiveShopBuffs(loadActiveShopBuffs(session?.user?.id));
  }, [session?.user?.id, sessionStatus]);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (session?.user?.profileAvatarId !== undefined) {
      setProfileAvatarId(session.user.profileAvatarId ?? null);
    }
  }, [session?.user?.profileAvatarId, sessionStatus]);

  const persistActiveShopBuffs = useCallback(
    (next: ActiveShopBuff[]) => {
      const ownerId = resolveShopBuffOwner(
        session?.user?.id ?? gameSessionUserIdRef.current,
      );
      const pruned = next.filter((buff) => buff.expiresAt > Date.now());
      saveActiveShopBuffs(ownerId, pruned);
      setActiveShopBuffs(pruned);
    },
    [session?.user?.id],
  );

  const handleShopPurchase = useCallback(
    async (itemId: ShopItemId) => {
      const item = SHOP_ITEM_BY_ID[itemId];
      if (!item || purchasingShopItemId) return;

      const previewMode = modeRef.current !== "game";
      if (previewMode) {
        if (previewStars < item.priceStars) return;
        setPreviewStars((value) => Math.max(0, value - item.priceStars));
        setActiveShopBuffs((current) => {
          const next = activateShopBuff(current, itemId, item.durationMs);
          saveActiveShopBuffs(
            resolveShopBuffOwner(
              session?.user?.id ?? gameSessionUserIdRef.current,
            ),
            next,
          );
          return next;
        });
        yanmarAudio.playBuffAcquire();
        return;
      }

      setPurchasingShopItemId(itemId);
      try {
        const res = await fetch("/api/shop/yanmar/purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId }),
        });
        const data = (await res.json().catch(() => null)) as {
          currency?: number;
          durationMs?: number;
          expiresAt?: number;
        } | null;
        if (!res.ok || !data) return;
        if (typeof data.currency === "number") {
          syncSessionBalances(data);
        }
        const expiresAt =
          typeof data.expiresAt === "number"
            ? data.expiresAt
            : Date.now() +
              (typeof data.durationMs === "number"
                ? data.durationMs
                : item.durationMs);
        setActiveShopBuffs((current) => {
          const next = activateShopBuff(
            current,
            itemId,
            Math.max(0, expiresAt - Date.now()),
          );
          saveActiveShopBuffs(
            resolveShopBuffOwner(
              session?.user?.id ?? gameSessionUserIdRef.current,
            ),
            next,
          );
          return next;
        });
        yanmarAudio.playBuffAcquire();
      } catch {
        /* keep current buffs / currency */
      } finally {
        setPurchasingShopItemId(null);
      }
    },
    [
      previewStars,
      purchasingShopItemId,
      session?.user?.id,
      syncSessionBalances,
    ],
  );

  useEffect(() => {
    if (
      mode === "intro" ||
      mode === "ride" ||
      mode === "gameReady" ||
      mode === "practice" ||
      mode === "tutorial"
    ) {
      return;
    }
    if (!session?.user?.id) return;
    pushQuestProgress("login", 1);
  }, [mode, pushQuestProgress, session?.user?.id]);

  const applyHourlyAdClaim = useCallback(
    async (result: HourlyAdClaimResult) => {
      if (typeof result.currency === "number") {
        currencyRef.current = result.currency;
        setCurrency(result.currency);
        setPreviewStars(result.currency);
        await updateSessionRef.current({ user: { currency: result.currency } });
      } else if (result.reward.kind === "stars" && !session?.user?.id) {
        setPreviewStars((value) => value + result.reward.amount);
        setCurrency((value) => value + result.reward.amount);
      }

      if (typeof result.gachaTicketsStandard === "number") {
        setGachaTicketsStandard(result.gachaTicketsStandard);
      } else if (result.reward.kind === "gachaStandard" && !session?.user?.id) {
        setGachaTicketsStandard((prev) => prev + result.reward.amount);
      }

      if (typeof result.gachaTicketsPremium === "number") {
        setGachaTicketsPremium(result.gachaTicketsPremium);
      } else if (result.reward.kind === "gachaPremium" && !session?.user?.id) {
        setGachaTicketsPremium((prev) => prev + result.reward.amount);
      }

      if (
        typeof result.dumpWorkshopPoints === "number" ||
        typeof result.crashWorkshopPoints === "number" ||
        typeof result.hillWorkshopPoints === "number"
      ) {
        setWorkshopPanelState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            points: {
              ...prev.points,
              ...(typeof result.dumpWorkshopPoints === "number"
                ? { dump: result.dumpWorkshopPoints }
                : {}),
              ...(typeof result.crashWorkshopPoints === "number"
                ? { crash: result.crashWorkshopPoints }
                : {}),
              ...(typeof result.hillWorkshopPoints === "number"
                ? { hill: result.hillWorkshopPoints }
                : {}),
            },
          };
        });
      } else if (
        !session?.user?.id &&
        (result.reward.kind === "dumpPoints" ||
          result.reward.kind === "crashPoints" ||
          result.reward.kind === "hillPoints")
      ) {
        const key =
          result.reward.kind === "dumpPoints"
            ? "dump"
            : result.reward.kind === "crashPoints"
              ? "crash"
              : "hill";
        setWorkshopPanelState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            points: {
              ...prev.points,
              [key]: (prev.points[key] ?? 0) + result.reward.amount,
            },
          };
        });
      }

      if (typeof result.monumentPoints === "number") {
        setMonumentPanelState((prev) =>
          prev ? { ...prev, points: result.monumentPoints! } : prev,
        );
      } else if (result.reward.kind === "monumentPoints" && !session?.user?.id) {
        setMonumentPanelState((prev) =>
          prev
            ? { ...prev, points: (prev.points ?? 0) + result.reward.amount }
            : prev,
        );
      }

      // Refresh wallets from server so a force-quit still shows granted balances.
      if (session?.user?.id) {
        await Promise.all([loadWorkshopState(), loadMonumentState()]);
      }
    },
    [
      loadMonumentState,
      loadWorkshopState,
      session?.user?.id,
    ],
  );

  const grantQuestReward = useCallback(
    async (opts: {
      eventId: string;
      stars: number;
      xp: number;
      enhanceCores?: number;
      gachaTicketsStandard?: number;
      gachaTicketsPremium?: number;
      label: string;
    }) => {
      if (session?.user?.id) {
        const res = await fetch("/api/rewards/yanmar-quest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...opts,
            enhanceCores: opts.enhanceCores ?? 0,
            gachaTicketsStandard: opts.gachaTicketsStandard ?? 0,
            gachaTicketsPremium: opts.gachaTicketsPremium ?? 0,
          }),
        });
        if (res.status === 409) return true;
        if (!res.ok) throw new Error("quest claim failed");
        const data = (await res.json()) as {
          currency?: number;
          totalXp?: number;
          enhanceCores?: number;
          gachaTicketsStandard?: number;
          gachaTicketsPremium?: number;
        };
        syncSessionBalances(data, { syncPreviewCurrency: true });
        if (typeof data.enhanceCores === "number") {
          setEnhanceCores(data.enhanceCores);
        }
        if (typeof data.gachaTicketsStandard === "number") {
          setGachaTicketsStandard(data.gachaTicketsStandard);
        }
        if (typeof data.gachaTicketsPremium === "number") {
          setGachaTicketsPremium(data.gachaTicketsPremium);
        }
        return true;
      }

      if (opts.stars > 0) {
        setPreviewStars((value) => value + opts.stars);
      }
      if (opts.xp > 0) {
        applyTotalXp(totalXpRef.current + opts.xp, { announceLevelUp: true });
      }
      if ((opts.enhanceCores ?? 0) > 0) {
        setEnhanceCores((prev) => prev + (opts.enhanceCores ?? 0));
      }
      if ((opts.gachaTicketsStandard ?? 0) > 0) {
        setGachaTicketsStandard(
          (prev) => prev + (opts.gachaTicketsStandard ?? 0),
        );
      }
      if ((opts.gachaTicketsPremium ?? 0) > 0) {
        setGachaTicketsPremium(
          (prev) => prev + (opts.gachaTicketsPremium ?? 0),
        );
      }
      return true;
    },
    [applyTotalXp, session?.user?.id, syncSessionBalances],
  );

  const handleHornQuest = useCallback(() => {
    pushQuestProgress("horn", 1);
  }, [pushQuestProgress]);

  useEffect(() => {
    yanmarAudio.setActive(mode !== "intro" && audioArmed);
  }, [mode, audioArmed]);

  useEffect(() => {
    if (!showSettingsMenu) return;
    yanmarAudio.unlock();
  }, [showSettingsMenu]);

  useEffect(() => {
    return () => {
      // Soft stop only — hard dispose would force a second BGM/WebGL boot on remount
      // (React Strict Mode / fast re-entry).
      yanmarAudio.deactivate();
    };
  }, []);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    const ownerId = session?.user?.id ?? "local";
    unlockSeenOwnerRef.current = ownerId;
    const level = getPlayerLevelProgress(totalXp).level;
    const sessionLevel = getPlayerLevelProgress(session?.user?.totalXp ?? 0).level;
    const effectiveLevel = Math.max(level, sessionLevel);
    // Wait until XP is known so we don't flash unlocks against level 0.
    if (!xpHydratedRef.current && effectiveLevel <= 1 && (session?.user?.totalXp ?? 0) <= 0) {
      return;
    }
    enqueueUnlockNotices(
      getUnseenUnlocksForLevel(ownerId, effectiveLevel),
    );
  }, [
    enqueueUnlockNotices,
    session?.user?.id,
    session?.user?.totalXp,
    sessionStatus,
    totalXp,
  ]);

  const loadEquipment = useCallback(async () => {
    const loadGen = ++equipmentLoadGenRef.current;
    try {
      const res = await fetch("/api/gear/yanmar");
      if (!res.ok) return;
      const data = await res.json();
      // Ignore outdated responses so concurrent reloads cannot clobber a fresh save.
      if (loadGen !== equipmentLoadGenRef.current) return;
      if (data.stats) {
        publishEquipmentStatsRef.current(data.stats);
      }
      if (Array.isArray(data.items)) {
        setGearItems(data.items);
      }
      if (typeof data.enhanceCores === "number") {
        setEnhanceCores(data.enhanceCores);
      }
      if (typeof data.gachaTicketsStandard === "number") {
        setGachaTicketsStandard(data.gachaTicketsStandard);
      }
      if (typeof data.gachaTicketsPremium === "number") {
        setGachaTicketsPremium(data.gachaTicketsPremium);
      }
      if (data.freeGacha && typeof data.freeGacha === "object") {
        setFreeGacha(data.freeGacha as GachaFreeStatus);
      }
      if (typeof data.inventorySlots === "number") {
        setGearInventorySlots(data.inventorySlots);
      }
      if ("expandCost" in data) {
        setGearExpandCost(
          typeof data.expandCost === "number" ? data.expandCost : null,
        );
      }
      if (data.chassis?.activeId) {
        setActiveChassisId(data.chassis.activeId);
      }
      if (Array.isArray(data.chassis?.ownedIds)) {
        setOwnedChassisIds(data.chassis.ownedIds);
      }
      if (data.chassis?.abilityAlloc) {
        setAbilityAlloc({
          ...emptyAbilityAlloc(),
          ...data.chassis.abilityAlloc,
        });
      }
      if (data.repair) {
        repairStateRef.current = data.repair;
      }
      if (typeof data.serverNow === "number") {
        syncServerNow(data.serverNow);
      }
      if (data.maintenance) {
        setMaintenance(data.maintenance);
      } else if (data.repair) {
        setMaintenance(
          computeMaintenanceSnapshot(
            data.repair,
            Date.now() + serverNowOffsetRef.current,
          ),
        );
      }
      if (
        data.repair?.buffExpiresAt &&
        data.repair?.buffKind &&
        data.repair.buffKind !== "NONE"
      ) {
        setRepairBuffExpiresAt(
          typeof data.repair.buffExpiresAt === "string"
            ? data.repair.buffExpiresAt
            : new Date(data.repair.buffExpiresAt).toISOString(),
        );
      } else {
        setRepairBuffExpiresAt(null);
      }
      if (typeof data.currency === "number") {
        currencyRef.current = data.currency;
        setCurrency(data.currency);
        if (modeRef.current !== "game") {
          setPreviewStars(data.currency);
        }
      }
      if (typeof data.totalXp === "number") {
        applyTotalXpRef.current(data.totalXp);
      }
      if (data.migration?.migrated && data.migration.refundStars > 0) {
        // optional toast — migration refund applied server-side
      }
    } catch {
      // Equipment data is optional for unauthenticated previews.
    }
  }, [syncServerNow]);

  const refreshFreeGacha = useCallback(async () => {
    try {
      const res = await fetch("/api/gacha/yanmar");
      if (!res.ok) return;
      const data = await res.json();
      if (data.free && typeof data.free === "object") {
        setFreeGacha(data.free as GachaFreeStatus);
      }
      if (typeof data.gachaTicketsStandard === "number") {
        setGachaTicketsStandard(data.gachaTicketsStandard);
      }
      if (typeof data.gachaTicketsPremium === "number") {
        setGachaTicketsPremium(data.gachaTicketsPremium);
      }
      if (typeof data.currency === "number") {
        currencyRef.current = data.currency;
        setCurrency(data.currency);
        if (modeRef.current !== "game") {
          setPreviewStars(data.currency);
        }
      }
    } catch {
      // Free status refresh is best-effort while the session stays open.
    }
  }, []);

  useEffect(() => {
    if (!repairBuffExpiresAt) return;
    const expiresMs = new Date(repairBuffExpiresAt).getTime();
    if (!Number.isFinite(expiresMs)) return;
    const delay = expiresMs - Date.now();
    if (delay <= 0) {
      void loadEquipment();
      return;
    }
    const timer = window.setTimeout(() => {
      void loadEquipment();
    }, delay + 100);
    return () => window.clearTimeout(timer);
  }, [repairBuffExpiresAt, loadEquipment]);

  const notifyGearDrop = useCallback(
    (
      drop:
        | {
            nameSnapshot?: string;
            grade?: string;
            slot?: string;
            mailed?: boolean;
          }
        | null
        | undefined,
      opts?: { playSound?: boolean },
    ) => {
      if (!drop?.nameSnapshot) return;
      const mailed = Boolean(drop.mailed);

      if (opts?.playSound !== false) {
        if (drop.grade === "MASTER") {
          yanmarAudio.playMasterItemAcquire();
        } else {
          yanmarAudio.playItemAcquire();
        }
      }

      if (mailed) {
        // 슬롯 부족: 토스트 대신 안내 모달 (장비관리로 바로 이동)
        if (gearDiscoveryHideTimerRef.current != null) {
          window.clearTimeout(gearDiscoveryHideTimerRef.current);
          gearDiscoveryHideTimerRef.current = null;
        }
        gearDiscoveryRef.current = null;
        setGearDiscovery(null);
        setShowInventoryFullModal(true);
        void loadEquipment();
        return;
      }

      const next: GearDiscoveryState = {
        nameSnapshot: drop.nameSnapshot,
        grade: drop.grade ?? "NORMAL",
        slot: drop.slot,
        mailed: false,
        pulseKey: (gearDiscoveryRef.current?.pulseKey ?? 0) + 1,
      };
      gearDiscoveryRef.current = next;
      setGearDiscovery(next);
      if (gearDiscoveryHideTimerRef.current != null) {
        window.clearTimeout(gearDiscoveryHideTimerRef.current);
      }
      gearDiscoveryHideTimerRef.current = window.setTimeout(() => {
        gearDiscoveryHideTimerRef.current = null;
        gearDiscoveryRef.current = null;
        setGearDiscovery(null);
      }, GEAR_DISCOVERY_DURATION_MS);
      void loadEquipment();
    },
    [loadEquipment],
  );

  const notifyCoresDrop = useCallback(
    (amount: unknown, enhanceCoresTotal?: unknown) => {
      const n = typeof amount === "number" ? amount : 0;
      if (n <= 0) return 0;
      if (typeof enhanceCoresTotal === "number") {
        setEnhanceCores(enhanceCoresTotal);
      } else {
        setEnhanceCores((prev) => prev + n);
      }
      return n;
    },
    [],
  );

  const flushMaintenanceTravel = useCallback(
    async (meters: number) => {
      if (modeRef.current !== "game" || meters <= 0) return;
      if (travelFlushBusyRef.current) {
        travelMetersAccumRef.current += meters;
        return;
      }
      travelFlushBusyRef.current = true;
      try {
        const payload = Math.max(0.1, Math.min(50_000, meters));
        const res = await fetch("/api/repair/yanmar/consume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ travelMeters: payload }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.repair) repairStateRef.current = data.repair;
        if (typeof data.serverNow === "number") syncServerNow(data.serverNow);
        if (data.maintenance) setMaintenance(data.maintenance);
        if (data.stats) publishEquipmentStats(data.stats);
      } catch {
        // Maintenance sync is best-effort during travel.
      } finally {
        travelFlushBusyRef.current = false;
        const leftover = travelMetersAccumRef.current;
        if (leftover >= 5) {
          travelMetersAccumRef.current = 0;
          void flushMaintenanceTravel(leftover);
        }
      }
    },
    [publishEquipmentStats, syncServerNow],
  );

  const runGearAction = useCallback(
    async (
      action: string,
      itemId: string,
      opts?: { deferApply?: boolean },
    ) => {
      setGearBusy(true);
      try {
        const res = await fetch("/api/gear/yanmar/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, itemId }),
        });
        const data = await res.json();
        if (!res.ok) return null;
        if (!opts?.deferApply) {
          if (data.stats) {
            publishEquipmentStats(data.stats);
          }
          if (typeof data.currency === "number") {
            currencyRef.current = data.currency;
            setCurrency(data.currency);
            setPreviewStars(data.currency);
          }
          if (typeof data.enhanceCores === "number") {
            setEnhanceCores(data.enhanceCores);
          }
          await loadEquipment();
        }
        return data as Record<string, unknown>;
      } finally {
        setGearBusy(false);
      }
    },
    [loadEquipment, publishEquipmentStats],
  );

  const applyGearActionResult = useCallback(
    async (data: Record<string, unknown> | null | undefined) => {
      if (!data) return;
      if (data.stats) {
        publishEquipmentStats(data.stats as YanmarEquipmentStats);
      }
      if (typeof data.currency === "number") {
        currencyRef.current = data.currency;
        setCurrency(data.currency);
        setPreviewStars(data.currency);
      }
      if (typeof data.enhanceCores === "number") {
        setEnhanceCores(data.enhanceCores);
      }
      await loadEquipment();
    },
    [loadEquipment, publishEquipmentStats],
  );

  const runGearSynthesize = useCallback(
    async (itemIds: [string, string, string]) => {
      setGearBusy(true);
      try {
        const res = await fetch("/api/gear/yanmar/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "synthesize", itemIds }),
        });
        const data = await res.json();
        if (!res.ok) return null;
        if (data.stats) {
          publishEquipmentStats(data.stats);
        }
        if (typeof data.currency === "number") {
          currencyRef.current = data.currency;
          setCurrency(data.currency);
          setPreviewStars(data.currency);
        }
        if (typeof data.enhanceCores === "number") {
          setEnhanceCores(data.enhanceCores);
        }
        await loadEquipment();
        const created = data.item as {
          id: string;
          slot: GearSlot;
          grade: ItemGrade;
          enhanceLevel: number;
          failBonus: number;
          mainOption: GearPanelItem["mainOption"];
          subOptions: GearPanelItem["subOptions"];
          masterOption: GearPanelItem["masterOption"];
          nameSnapshot: string;
          durability: number;
          durabilityMax: number;
        } | null;
        if (!created?.id) return null;
        const slot = created.slot;
        const grade = created.grade;
        return {
          item: {
            id: created.id,
            slot,
            slotLabel: GEAR_SLOT_LABEL[slot],
            grade,
            gradeLabel: ITEM_GRADE_LABEL[grade],
            enhanceLevel: created.enhanceLevel ?? 0,
            failBonus: created.failBonus ?? 0,
            mainOption: created.mainOption ?? { key: "strength", value: 0 },
            subOptions: Array.isArray(created.subOptions)
              ? created.subOptions
              : [],
            masterOption: created.masterOption ?? null,
            nameSnapshot: created.nameSnapshot,
            durability: created.durability,
            durabilityMax: created.durabilityMax,
            equippedSlot: null,
          } satisfies GearPanelItem,
          resultGrade: (data.resultGrade as ItemGrade) ?? grade,
          inputGrade: (data.inputGrade as ItemGrade) ?? grade,
          upgraded: Boolean(data.upgraded),
        };
      } finally {
        setGearBusy(false);
      }
    },
    [loadEquipment, publishEquipmentStats],
  );

  const handleExpandInventory = useCallback(async () => {
    setGearBusy(true);
    try {
      const res = await fetch("/api/gear/yanmar/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "expandInventory" }),
      });
      const data = await res.json();
      if (!res.ok) return;
      if (typeof data.currency === "number") {
        currencyRef.current = data.currency;
        setCurrency(data.currency);
        setPreviewStars(data.currency);
      }
      if (typeof data.inventorySlots === "number") {
        setGearInventorySlots(data.inventorySlots);
      }
      if ("expandCost" in data) {
        setGearExpandCost(
          typeof data.expandCost === "number" ? data.expandCost : null,
        );
      }
      await loadEquipment();
    } finally {
      setGearBusy(false);
    }
  }, [loadEquipment]);

  const handleChassisAction = useCallback(
    async (action: "purchase" | "equip", chassisId: ChassisModelId) => {
      setGearBusy(true);
      try {
        const res = await fetch("/api/chassis/yanmar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, chassisId }),
        });
        const data = await res.json();
        if (!res.ok) return;
        if (data.stats) {
          publishEquipmentStats(data.stats);
        }
        if (typeof data.currency === "number") {
          currencyRef.current = data.currency;
          setCurrency(data.currency);
          setPreviewStars(data.currency);
        }
        if (data.activeId) setActiveChassisId(data.activeId);
        if (Array.isArray(data.ownedIds)) setOwnedChassisIds(data.ownedIds);
        if (data.abilityAlloc) {
          setAbilityAlloc({
            ...emptyAbilityAlloc(),
            ...data.abilityAlloc,
          });
        }
        await loadEquipment();
      } finally {
        setGearBusy(false);
      }
    },
    [loadEquipment, publishEquipmentStats],
  );

  const handleAbilityAllocAction = useCallback(
    async (
      action: "allocate" | "resetAlloc" | "recommendAlloc",
      alloc?: AbilityAlloc,
    ) => {
      setGearBusy(true);
      try {
        const res = await fetch("/api/chassis/yanmar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            action === "allocate" ? { action, alloc } : { action },
          ),
        });
        const data = (await res.json().catch(() => null)) as {
          error?: string;
          abilityAlloc?: AbilityAlloc;
          stats?: YanmarEquipmentStats;
        } | null;
        if (!res.ok) {
          const err = data?.error ?? "";
          showAttachmentWarning(
            err === "INVALID_ALLOC"
              ? "보너스 분배가 올바르지 않습니다. 남은 포인트를 확인해 주세요."
              : err === "LOADOUT_NOT_FOUND" || err.includes("abilityAlloc")
                ? "보너스 스탯 저장에 실패했습니다. 페이지를 새로고침 후 다시 시도해 주세요."
                : "보너스 스탯 저장에 실패했습니다.",
          );
          return;
        }
        // Invalidate in-flight gear loads before applying the saved alloc so a
        // stale GET cannot wipe the just-saved distribution.
        equipmentLoadGenRef.current += 1;
        if (data?.abilityAlloc) {
          setAbilityAlloc({
            ...emptyAbilityAlloc(),
            ...data.abilityAlloc,
          });
        }
        if (data?.stats) {
          publishEquipmentStats(data.stats);
        }
        await loadEquipment();
        if (action === "allocate") {
          showAttachmentWarning("보너스 스탯을 저장했습니다.");
        }
      } finally {
        setGearBusy(false);
      }
    },
    [loadEquipment, publishEquipmentStats, showAttachmentWarning],
  );

  const handleRepair = useCallback(
    async (fluid: MaintenanceFluidId): Promise<MaintenanceClaimResult | null> => {
      setGearBusy(true);
      try {
        const res = await fetch("/api/repair/yanmar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fluid }),
        });
        const data = await res.json();
        if (typeof data.serverNow === "number") {
          syncServerNow(data.serverNow);
        }
        if (data.repair) {
          repairStateRef.current = data.repair;
        }
        if (data.maintenance) {
          setMaintenance(data.maintenance);
        }
        if (!res.ok) {
          if (data.error === "NOT_READY") {
            showAttachmentWarning("아직 교환 시간이 되지 않았습니다");
          } else {
            showAttachmentWarning("교환에 실패했습니다");
          }
          return null;
        }
        if (data.stats) {
          publishEquipmentStats(data.stats);
        }
        if (typeof data.currency === "number") {
          currencyRef.current = data.currency;
          setCurrency(data.currency);
          setPreviewStars(data.currency);
        }
        await loadEquipment();
        if (data.reward?.guaranteed && data.reward?.bonus && data.reward?.buff) {
          return {
            guaranteed: data.reward.guaranteed,
            bonus: data.reward.bonus,
            buff: data.reward.buff,
          };
        }
        return null;
      } finally {
        setGearBusy(false);
      }
    },
    [loadEquipment, publishEquipmentStats, showAttachmentWarning, syncServerNow],
  );

  const handleGacha = useCallback(
    async (
      banner: "STANDARD" | "PREMIUM",
      count: 1 | 10,
      payWith: GachaPayWith = "stars",
    ) => {
      const freeSlots = Math.max(0, gearInventorySlots - gearItems.length);
      if (count > freeSlots) {
        setShowInventoryFullModal(true);
        return;
      }

      setGachaBusy(true);
      try {
        const res = await fetch("/api/gacha/yanmar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ banner, count, payWith }),
        });
        const data = (await res.json()) as {
          error?: string;
          currency?: number;
          gachaTicketsStandard?: number;
          gachaTicketsPremium?: number;
          free?: GachaFreeStatus;
          items?: { nameSnapshot: string; grade: string; slot?: string }[];
        };
        if (!res.ok) {
          if (data.error === "INVENTORY_FULL") {
            setShowInventoryFullModal(true);
          }
          return;
        }
        if (typeof data.currency === "number") {
          currencyRef.current = data.currency;
          setCurrency(data.currency);
          setPreviewStars(data.currency);
        }
        if (typeof data.gachaTicketsStandard === "number") {
          setGachaTicketsStandard(data.gachaTicketsStandard);
        }
        if (typeof data.gachaTicketsPremium === "number") {
          setGachaTicketsPremium(data.gachaTicketsPremium);
        }
        if (data.free && typeof data.free === "object") {
          setFreeGacha(data.free);
        }
        if (Array.isArray(data.items) && data.items.length > 0) {
          setLastGachaBanner(banner);
          setLastGachaResults(data.items);
          setShowGachaResultModal(true);
          // Single pull: play immediately. Multi-pull SFX plays per card reveal.
          if (data.items.length === 1) {
            if (data.items[0]?.grade === "MASTER") {
              yanmarAudio.playMasterItemAcquire();
            } else {
              yanmarAudio.playItemAcquire();
            }
          }
        }
        await loadEquipment();
      } finally {
        setGachaBusy(false);
      }
    },
    [gearInventorySlots, gearItems.length, loadEquipment],
  );

  const handleWorkshopClaim = useCallback(
    async (questId: string) => {
      const workshopId = activeWorkshopId;
      if (!workshopId) return;
      const def = WORKSHOP_DEFS[workshopId].quests.find((q) => q.id === questId);
      if (!def) return;
      setWorkshopBusy(true);

      // 보유 포인트는 즉시 반영하고, 서버 응답으로 최종 동기화한다.
      setWorkshopPanelState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          points: {
            ...prev.points,
            [workshopId]: (prev.points[workshopId] ?? 0) + def.rewardPoints,
          },
        };
      });

      try {
        const eventId = `workshop-quest:${workshopId}:${questId}:${crypto.randomUUID()}`;
        const res = await fetch("/api/workshop/yanmar/quest/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId,
            workshopId,
            questId,
            points: def.rewardPoints,
          }),
        });
        const data = (await res.json()) as {
          points?: Record<WorkshopId, number>;
          result?: { points?: Record<WorkshopId, number> };
        };
        if (!res.ok) {
          await loadWorkshopState();
          return;
        }
        const nextPoints = data.points ?? data.result?.points;
        if (nextPoints) {
          setWorkshopPanelState((prev) =>
            prev
              ? { ...prev, points: nextPoints }
              : {
                  points: nextPoints,
                  levels: { dump: {}, crash: {}, hill: {} },
                  shopPurchases: { dump: {}, crash: {}, hill: {} },
                  weekKey: "",
                },
          );
        }
        const current = workshopQuestStateRef.current;
        if (current) {
          const next = markWorkshopQuestClaimed(current, workshopId, questId);
          workshopQuestStateRef.current = next;
          setWorkshopQuestState(next);
          saveWorkshopQuestState(next);
        }
      } finally {
        setWorkshopBusy(false);
      }
    },
    [activeWorkshopId, loadWorkshopState],
  );

  const handleWorkshopUpgrade = useCallback(
    async (upgradeKey: WorkshopUpgradeKey) => {
      const workshopId = activeWorkshopId;
      if (!workshopId) return;
      setWorkshopBusy(true);
      try {
        const res = await fetch("/api/workshop/yanmar/upgrade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workshopId, upgradeKey }),
        });
        const data = await res.json();
        if (!res.ok) return;
        setWorkshopPanelState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            points: data.points ?? prev.points,
            pendingByWorkshop: {
              ...prev.pendingByWorkshop,
              [workshopId]: {
                workshopId,
                upgradeKey,
                completesAt: data.completesAt,
                targetLevel: data.targetLevel,
              },
            },
            currency: prev.currency,
          };
        });
        await loadWorkshopState();
        await loadEquipment();
      } finally {
        setWorkshopBusy(false);
      }
    },
    [activeWorkshopId, loadEquipment, loadWorkshopState],
  );

  const handleWorkshopInstantUpgrade = useCallback(async () => {
    const workshopId = activeWorkshopId;
    if (!workshopId) return;
    setWorkshopBusy(true);
    try {
      const res = await fetch("/api/workshop/yanmar/upgrade/instant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workshopId }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && typeof data?.currency === "number") {
        currencyRef.current = data.currency;
        setCurrency(data.currency);
      }
      // Always refresh — timer settle may clear pending even when instant pay fails.
      await loadWorkshopState();
      await loadEquipment();
    } finally {
      setWorkshopBusy(false);
    }
  }, [activeWorkshopId, loadEquipment, loadWorkshopState]);

  const handleMonumentClaimQuest = useCallback(
    async (questId: string, points: number) => {
      setMonumentBusy(true);
      try {
        const eventId = `monument-quest:${questId}:${crypto.randomUUID()}`;
        const res = await fetch("/api/monument/yanmar/quest/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId, questId, points }),
        });
        const data = await res.json();
        if (!res.ok) return;
        if (typeof data.points === "number") {
          setMonumentPanelState((prev) =>
            prev ? { ...prev, points: data.points } : prev,
          );
        }
        const current = monumentQuestStateRef.current;
        if (current) {
          const next = markMonumentDailyClaimed(current, questId);
          monumentQuestStateRef.current = next;
          setMonumentQuestState(next);
          saveMonumentQuestState(next);
        }
        if (!data.duplicate && points > 0) {
          showStandaloneRewardPanelRef.current(0, false, 0, 0, "", 0, points);
        }
      } finally {
        setMonumentBusy(false);
      }
    },
    [],
  );

  const handleMonumentClaimRepeatQuest = useCallback(
    async (questId: string, points: number) => {
      setMonumentBusy(true);
      try {
        const eventId = `monument-repeat:${questId}:${crypto.randomUUID()}`;
        const res = await fetch("/api/monument/yanmar/quest/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId, questId, points }),
        });
        const data = await res.json();
        if (!res.ok) return;
        if (typeof data.points === "number") {
          setMonumentPanelState((prev) =>
            prev ? { ...prev, points: data.points } : prev,
          );
        }
        const current = monumentQuestStateRef.current;
        if (current) {
          const next = claimMonumentRepeatQuest(current, questId);
          if (next) {
            monumentQuestStateRef.current = next;
            setMonumentQuestState(next);
            saveMonumentQuestState(next);
          }
        }
        if (!data.duplicate && points > 0) {
          showStandaloneRewardPanelRef.current(0, false, 0, 0, "", 0, points);
        }
      } finally {
        setMonumentBusy(false);
      }
    },
    [],
  );

  const handleMonumentUpgrade = useCallback(
    async (upgradeKey: MonumentUpgradeKey) => {
      setMonumentBusy(true);
      try {
        const res = await fetch("/api/monument/yanmar/upgrade/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ upgradeKey }),
        });
        if (!res.ok) return;
        await loadMonumentState();
      } finally {
        setMonumentBusy(false);
      }
    },
    [loadMonumentState],
  );

  const handleMonumentInstantUpgrade = useCallback(async () => {
    setMonumentBusy(true);
    try {
      const res = await fetch("/api/monument/yanmar/upgrade/instant", {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (res.ok && typeof data?.currency === "number") {
        currencyRef.current = data.currency;
        setCurrency(data.currency);
      }
      await loadMonumentState();
    } finally {
      setMonumentBusy(false);
    }
  }, [loadMonumentState]);

  const handleMonumentShopPurchase = useCallback(
    async (itemId: WorkshopShopItemId) => {
      setMonumentBusy(true);
      try {
        const res = await fetch("/api/monument/yanmar/shop/purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId }),
        });
        const data = await res.json();
        if (!res.ok) return;
        if (typeof data.points === "number") {
          setMonumentPanelState((prev) =>
            prev ? { ...prev, points: data.points } : prev,
          );
        }
        if (typeof data.gachaTicketsStandard === "number") {
          setGachaTicketsStandard(data.gachaTicketsStandard);
        }
        if (typeof data.gachaTicketsPremium === "number") {
          setGachaTicketsPremium(data.gachaTicketsPremium);
        }
        if (typeof data.enhanceCores === "number") {
          setEnhanceCores(data.enhanceCores);
        }
        await loadMonumentState();
      } finally {
        setMonumentBusy(false);
      }
    },
    [loadMonumentState],
  );

  const handleMonumentStartConstruction = useCallback(async () => {
    setMonumentBusy(true);
    try {
      const res = await fetch("/api/monument/yanmar/construction/start", {
        method: "POST",
      });
      if (!res.ok) return;
      await loadMonumentState();
    } finally {
      setMonumentBusy(false);
    }
  }, [loadMonumentState]);

  const handleMonumentClaimConstruction = useCallback(async () => {
    setMonumentBusy(true);
    try {
      const res = await fetch("/api/monument/yanmar/construction/claim", {
        method: "POST",
      });
      if (!res.ok) return;
      await loadMonumentState();
      const current = monumentQuestStateRef.current;
      if (current && !current.activeDayKey) {
        const next = activateMonumentQuests(current);
        monumentQuestStateRef.current = next;
        setMonumentQuestState(next);
        saveMonumentQuestState(next);
      }
    } finally {
      setMonumentBusy(false);
    }
  }, [loadMonumentState]);

  const handleMonumentClaimStars = useCallback(async () => {
    setMonumentBusy(true);
    try {
      const res = await fetch("/api/monument/yanmar/stars/claim", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) return;
      if (typeof data.currency === "number") {
        currencyRef.current = data.currency;
        setCurrency(data.currency);
      }
      const claimed =
        typeof data.claimed === "number" ? Math.max(0, data.claimed) : 0;
      if (claimed > 0) {
        rewardStarsRef.current += claimed;
        showStandaloneRewardPanelRef.current(0, false, claimed);
      }
      await loadMonumentState();
    } finally {
      setMonumentBusy(false);
    }
  }, [loadMonumentState]);

  const handleWorkshopShopPurchase = useCallback(
    async (itemId: WorkshopShopItemId) => {
      const workshopId = activeWorkshopId;
      if (!workshopId) return;
      setWorkshopBusy(true);
      try {
        const res = await fetch("/api/workshop/yanmar/shop/purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workshopId, itemId }),
        });
        const data = await res.json();
        if (!res.ok) return;
        setWorkshopPanelState((prev) => {
          if (!prev) return prev;
          const shopPurchases = {
            ...prev.shopPurchases,
            [workshopId]: {
              ...prev.shopPurchases[workshopId],
              [itemId]: {
                count: data.weeklyCount ?? 0,
                remaining: data.weeklyRemaining ?? 0,
              },
            },
          };
          return {
            ...prev,
            points: data.points ?? prev.points,
            shopPurchases,
          };
        });
        if (typeof data.gachaTicketsStandard === "number") {
          setGachaTicketsStandard(data.gachaTicketsStandard);
        }
        if (typeof data.gachaTicketsPremium === "number") {
          setGachaTicketsPremium(data.gachaTicketsPremium);
        }
        if (typeof data.enhanceCores === "number") {
          setEnhanceCores(data.enhanceCores);
        }
      } finally {
        setWorkshopBusy(false);
      }
    },
    [activeWorkshopId],
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      const sim = simRef.current;
      if (!sim) return;
      const near = isInRepairTentRange(sim.posX, sim.posZ);
      if (near !== nearRepairTentRef.current) {
        const entered = near && !nearRepairTentRef.current;
        nearRepairTentRef.current = near;
        setNearRepairTent(near);
        if (entered) yanmarAudio.playServiceEnter();
        if (!near) setShowRepairPanel(false);
      }

      const nearMon = isInMonumentRange(sim.posX, sim.posZ);
      if (nearMon !== nearMonumentRef.current) {
        const enteredMon = nearMon && !nearMonumentRef.current;
        nearMonumentRef.current = nearMon;
        setNearMonument(nearMon);
        if (enteredMon) {
          yanmarAudio.playMonumentEnter();
          if (monumentPhaseRef.current === "active") {
            void loadMonumentState();
          }
        }
        if (!nearMon) setShowMonumentPanel(false);
      }

      const playerLevel = getPlayerLevelProgress(totalXpRef.current).level;
      if (playerLevel >= SPORTS_MEET_UNLOCK_LEVEL) {
        const nearSm = isInSportsMeetPortalRange(sim.posX, sim.posZ);
        if (nearSm !== nearSportsMeetRef.current) {
          nearSportsMeetRef.current = nearSm;
          setNearSportsMeet(nearSm);
          if (!nearSm) setShowSportsMeetPanel(false);
        }
      } else if (nearSportsMeetRef.current) {
        nearSportsMeetRef.current = false;
        setNearSportsMeet(false);
        setShowSportsMeetPanel(false);
      }

      const terrain = terrainRef.current;
      const mapTier = terrain.mapTier;
      let found: WorkshopId | null = null;
      for (const wid of WORKSHOP_IDS) {
        if (mapTier < WORKSHOP_DEFS[wid].minMapTier) continue;
        if (isInWorkshopSignRange(wid, sim.posX, sim.posZ, terrain)) {
          found = wid;
          break;
        }
      }
      if (found !== nearWorkshopIdRef.current) {
        nearWorkshopIdRef.current = found;
        setNearWorkshopId(found);
        if (!found) {
          setShowWorkshopPanel(false);
          setActiveWorkshopId(null);
        }
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [loadMonumentState]);

  useEffect(() => {
    if (sessionStatus === "loading" || !session?.user?.id) return;
    if ((monumentPanelState?.phase ?? monumentPhaseRef.current) !== "active") {
      return;
    }
    const id = window.setInterval(() => {
      void loadMonumentState();
    }, 75_000);
    return () => window.clearInterval(id);
  }, [
    session?.user?.id,
    sessionStatus,
    monumentPanelState?.phase,
    loadMonumentState,
  ]);

  useEffect(() => {
    void loadEquipment();
  }, [loadEquipment]);

  // 접속 유지 중 KST 0시에 무료 뽑기 상태를 다시 불러온다.
  useEffect(() => {
    if (sessionStatus !== "authenticated" || !session?.user?.id) return;

    let timer: number | null = null;
    const schedule = () => {
      const delay = Math.min(
        getMsUntilNextGachaFreeReset() + 500,
        24 * 60 * 60 * 1000,
      );
      timer = window.setTimeout(() => {
        setFreeGacha((prev) => (prev ? withGachaFreeDayRollover(prev) : prev));
        void refreshFreeGacha();
        schedule();
      }, Math.max(1000, delay));
    };
    schedule();

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      setFreeGacha((prev) => (prev ? withGachaFreeDayRollover(prev) : prev));
      void refreshFreeGacha();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timer != null) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session?.user?.id, sessionStatus, refreshFreeGacha]);

  // 접속 유지 중 KST 0시에 일일 퀘스트를 리셋하고 로그인 미션을 클리어한다.
  useEffect(() => {
    if (sessionStatus === "loading") return;

    let timer: number | null = null;
    const schedule = () => {
      const delay = Math.min(
        getMsUntilNextQuestReset() + 500,
        24 * 60 * 60 * 1000,
      );
      timer = window.setTimeout(() => {
        syncQuestDayRollover();
        schedule();
      }, Math.max(1000, delay));
    };
    schedule();

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      syncQuestDayRollover();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timer != null) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sessionStatus, session?.user?.id, syncQuestDayRollover]);

  useEffect(() => {
    if (!showQuestPanel) return;
    if (sessionStatus === "loading") return;
    syncQuestDayRollover();
  }, [showQuestPanel, sessionStatus, syncQuestDayRollover]);

  useEffect(() => {
    if (!showShopPanel) return;
    if (sessionStatus !== "authenticated" || !session?.user?.id) return;
    setFreeGacha((prev) => (prev ? withGachaFreeDayRollover(prev) : prev));
    void refreshFreeGacha();
  }, [
    showShopPanel,
    session?.user?.id,
    sessionStatus,
    refreshFreeGacha,
  ]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const row = repairStateRef.current;
      if (!row) return;
      const next = computeMaintenanceSnapshot(
        row,
        Date.now() + serverNowOffsetRef.current,
      );
      const prevEligible = maintenanceEligibleRef.current;
      const nextEligible = new Set<MaintenanceFluidId>();
      let toastFluid: MaintenanceFluidId | null = null;
      let toastHours = Number.POSITIVE_INFINITY;

      for (const fluidId of MAINTENANCE_FLUID_IDS) {
        const fluid = next.fluids[fluidId];
        if (!fluid.exchangeEligible) continue;
        nextEligible.add(fluidId);
        if (!prevEligible.has(fluidId) && fluid.cycleHours < toastHours) {
          toastFluid = fluidId;
          toastHours = fluid.cycleHours;
        }
      }
      maintenanceEligibleRef.current = nextEligible;

      if (toastFluid) {
        showAttachmentWarning(
          `${MAINTENANCE_FLUIDS[toastFluid].label} 만료 · 정비소에서 교환`,
        );
      }

      // Always refresh so remainingMs / countdowns stay live even when % is unchanged.
      setMaintenance(next);
    }, 1000);
    return () => window.clearInterval(id);
  }, [showAttachmentWarning]);

  useEffect(() => {
    if (!maintenanceBubbleId) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(".yanmar-maintenance-warn-stack")
      ) {
        return;
      }
      setMaintenanceBubbleId(null);
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [maintenanceBubbleId]);

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
    // 개폐량은 시뮬이 발판으로 갱신하므로 React state 동기화 시 덮어쓰지 않는다.
    auxiliaryRef.current = {
      ...auxiliary,
      grappleOpen: auxiliaryRef.current.grappleOpen,
    };
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
    auxiliaryRef.current = {
      ...resolved,
      grappleOpen: auxiliaryRef.current.grappleOpen,
    };
    setAuxiliary({
      ...resolved,
      grappleOpen: auxiliaryRef.current.grappleOpen,
    });
    if (resolved.safetyLocked) {
      clearAllInput();
      if (resolved.attachmentPedal !== 0) {
        const unlocked = {
          ...resolved,
          attachmentPedal: 0 as const,
          grappleOpen: auxiliaryRef.current.grappleOpen,
        };
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
    autoPoseRef.current.slots = autoPoseRef.current.slots.map((existing, index) =>
      index === slot ? pose : existing,
    ) as typeof autoPoseRef.current.slots;
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

  const handleSaveAutoPoseLabels = useCallback(
    (labels: AutoPoseSlotLabels) => {
      setAutoPoseLabels(labels);
      const ownerId = resolveAutoPoseStorageOwner(
        session?.user?.id ?? gameSessionUserIdRef.current,
      );
      saveAutoPoseSlotLabels(ownerId, labels);
    },
    [session?.user?.id],
  );

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
    autoPoseRef.current.slots = [
      persistedSlots[0],
      persistedSlots[1],
      persistedSlots[2],
      persistedSlots[3],
    ];
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
    if (gearDiscoveryHideTimerRef.current != null) {
      window.clearTimeout(gearDiscoveryHideTimerRef.current);
      gearDiscoveryHideTimerRef.current = null;
    }
    dumpScorePanelRef.current = null;
    couponDiscoveryRef.current = null;
    gearDiscoveryRef.current = null;
    setDumpScorePanel(null);
    setCouponDiscovery(null);
    setGearDiscovery(null);
    setHud({
      progress: 0,
      timeLeft: config.duration,
      bucketLoad: 0,
      goalDist: 0,
      boom: 0.55,
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
      if (gearDiscoveryHideTimerRef.current != null) {
        window.clearTimeout(gearDiscoveryHideTimerRef.current);
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
    setShowEquipmentUpgrade(false);
    setShowInventoryFullModal(false);
    setMode("ride");
  }, [resetYanmarSession, setMode, setShowTutorialMenu]);

  const enterPracticeMode = useCallback(() => {
    resetYanmarSession({ terrainLevel: PRACTICE_FULL_UNLOCK_LEVEL });
    terrainRef.current = createInitialTerrain(true, PRACTICE_FULL_UNLOCK_LEVEL);
    setTerrainRevision((key) => key + 1);
    tutorialStepRef.current = null;
    setTutorialIndex(0);
    setShowQuestPanel(false);
    setShowShopPanel(false);
    setShowTutorialMenu(true);
    setMode("practice");
  }, [resetYanmarSession, setMode, setShowTutorialMenu, setTutorialIndex]);

  const startGameDirect = useCallback(() => {
    tutorialStepRef.current = null;
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
    setTerrainRevision((key) => key + 1);
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
  const readyNotifiedRef = useRef(false);
  const readyTimerRef = useRef<number | null>(null);

  const tryNotifyEntryReady = useCallback(() => {
    if (readyNotifiedRef.current) return;
    // Scene paint is enough to reveal — gear can finish in the background.
    if (!sceneReadyRef.current) return;
    readyNotifiedRef.current = true;
    // One paint so the canvas is composited under the splash, then reveal.
    if (readyTimerRef.current != null) {
      window.cancelAnimationFrame(readyTimerRef.current);
    }
    readyTimerRef.current = window.requestAnimationFrame(() => {
      readyTimerRef.current = null;
      setAudioArmed(true);
      yanmarAudio.unlock();
      onReady?.();
    });
  }, [onReady]);

  useEffect(() => {
    initialPlayModeRef.current = initialPlayMode;
  }, [initialPlayMode]);

  useEffect(() => {
    return () => {
      if (readyTimerRef.current != null) {
        window.cancelAnimationFrame(readyTimerRef.current);
        readyTimerRef.current = null;
      }
    };
  }, []);

  const handleSceneReady = useCallback(() => {
    sceneReadyRef.current = true;
    tryNotifyEntryReady();
  }, [tryNotifyEntryReady]);

  useLayoutEffect(() => {
    if (hasBootstrappedRef.current) return;
    const bootMode = initialPlayModeRef.current ?? initialPlayMode;
    if (!bootMode) return;
    hasBootstrappedRef.current = true;
    if (bootMode === "ride") {
      enterRideMode();
      tryNotifyEntryReady();
      return;
    }
    // 홈 「게임 시작」 및 game 모드는 무조건 게임모드 진입 (연습/튜토리얼 우회)
    if (bootMode === "game") {
      startGameDirect();
      return;
    }
    if (bootMode === "practice") {
      enterPracticeMode();
    }
  }, [
    enterRideMode,
    enterPracticeMode,
    initialPlayMode,
    startGameDirect,
    tryNotifyEntryReady,
  ]);

  const clearTutorialFlashTimers = useCallback(() => {
    for (const id of tutorialFlashTimersRef.current) {
      window.clearTimeout(id);
    }
    tutorialFlashTimersRef.current = [];
    tutorialUiPauseUntilRef.current = 0;
    setTutorialFlash(null);
  }, []);

  const showTutorialPhaseSuccess = useCallback(
    (message: string, nextGuide: string, phaseIndex: number, phaseTotal: number) => {
      clearTutorialFlashTimers();
      const flashKey = Date.now();
      setTutorialFlash({ kind: "phase", message, key: flashKey });
      setTutorialPhaseDisplay({
        current: Math.min(phaseIndex + 1, phaseTotal),
        total: phaseTotal,
      });
      tutorialUiPauseUntilRef.current = performance.now() + 900;
      const hideId = window.setTimeout(() => {
        setTutorialFlash((current) =>
          current?.key === flashKey ? null : current,
        );
        tutorialGuideRef.current = nextGuide;
        setTutorialGuide(nextGuide);
      }, 750);
      const unlockId = window.setTimeout(() => {
        tutorialUiPauseUntilRef.current = 0;
      }, 900);
      tutorialFlashTimersRef.current.push(hideId, unlockId);
    },
    [clearTutorialFlashTimers],
  );

  const showTutorialComplete = useCallback(
    (finalPhaseLabel?: string, phaseTotal = 1) => {
      clearTutorialFlashTimers();
      tutorialCompletingRef.current = true;
      tutorialUiPauseUntilRef.current = performance.now() + 2200;
      setTutorialPhaseDisplay({ current: phaseTotal, total: phaseTotal });

      const runComplete = () => {
        const flashKey = Date.now();
        setTutorialFlash({
          kind: "complete",
          message: "튜토리얼 완료!",
          key: flashKey,
        });
        tutorialGuideRef.current = "모든 단계를 완료했습니다";
        setTutorialGuide("모든 단계를 완료했습니다");
        const hideId = window.setTimeout(() => {
          setTutorialFlash((current) =>
            current?.key === flashKey ? null : current,
          );
        }, 1100);
        const doneId = window.setTimeout(() => {
          tutorialCompletingRef.current = false;
          tutorialUiPauseUntilRef.current = 0;
          tutorialStepRef.current = null;
          tutorialPhaseRef.current = null;
          tutorialWaypointRef.current = null;
          tutorialGuideRef.current = "";
          tutorialCelebratedPhaseRef.current = -1;
          setTutorialGuide("");
          setTutorialHasWaypoint(false);
          setMode("practice");
        }, 1400);
        tutorialFlashTimersRef.current.push(hideId, doneId);
      };

      if (finalPhaseLabel) {
        const phaseKey = Date.now();
        setTutorialFlash({
          kind: "phase",
          message: finalPhaseLabel,
          key: phaseKey,
        });
        const toCompleteId = window.setTimeout(() => {
          runComplete();
        }, 850);
        tutorialFlashTimersRef.current.push(toCompleteId);
      } else {
        runComplete();
      }
    },
    [clearTutorialFlashTimers, setMode],
  );

  const startTutorial = useCallback((index: number) => {
    clearTutorialFlashTimers();
    tutorialCelebratedPhaseRef.current = -1;
    resetYanmarSession({ terrainLevel: PRACTICE_FULL_UNLOCK_LEVEL });
    terrainRef.current = createInitialTerrain(true, PRACTICE_FULL_UNLOCK_LEVEL);
    setTerrainRevision((key) => key + 1);
    const step = TUTORIAL_STEPS[index] ?? null;
    tutorialCompletingRef.current = false;
    tutorialCrashHitsRef.current = 0;
    tutorialHillDeliverRef.current = 0;
    tutorialDumpRef.current = 0;
    tutorialIndexRef.current = index;
    tutorialStepRef.current = step;
    const phase = createTutorialPhaseProgress(simRef.current);
    phase.lastLiftTick = digFeedbackRef.current.grappleLiftResultTick;
    tutorialPhaseRef.current = phase;
    const guide = step ? getTutorialInstruction(step, phase) : "";
    tutorialGuideRef.current = guide;
    setTutorialGuide(guide);
    setTutorialPhaseDisplay({
      current: 1,
      total: step ? getTutorialPhaseCount(step) : 1,
    });
    tutorialWaypointRef.current = step
      ? (getTutorialWaypoint(step, phase) ?? null)
      : null;
    setTutorialHasWaypoint(tutorialWaypointRef.current != null);
    if (step?.startPose) {
      const sim = simRef.current;
      sim.posX = step.startPose.x;
      sim.posZ = step.startPose.z;
      if (step.startPose.heading != null) sim.heading = step.startPose.heading;
      phase.lastX = sim.posX;
      phase.lastZ = sim.posZ;
      phase.lastHeading = sim.heading;
    }
    if (step?.startAttachment) {
      simRef.current.attachmentType = step.startAttachment;
      simRef.current.carriedBoulderId = null;
      if (
        step.startAttachment === "breaker" ||
        step.startAttachment === "grapple"
      ) {
        resolveAttachmentTipClearance(
          simRef.current,
          terrainRef.current,
          auxiliaryRef.current.boomSwing,
          auxiliaryRef.current.grappleOpen,
        );
      }
      setAttachmentType(step.startAttachment);
    }

    resetDumpTruckState(dumpTruckStateRef.current);
    if (step?.id === "dump") {
      const stats = equipmentStatsRef.current;
      // 한 번 하역하면 만차가 되어, 구역을 벗어나면 트럭이 출발하도록 미리 채움
      dumpTruckStateRef.current.fillUnits = Math.max(
        0,
        stats.truckCapacityUnits - Math.max(8, stats.maxLoadUnits * 0.15),
      );
    }
    if (step?.id === "rockDump") {
      const hill = terrainRef.current.hillZone;
      const capacity = Math.max(
        1,
        Math.floor(equipmentStatsRef.current.haulTruckCapacity),
      );
      if (hill) {
        hill.haulTruck.loadCount = Math.max(0, capacity - 1);
      }
    }
    dumpTruckPoseRef.current = getDumpTruckPose(dumpTruckStateRef.current);

    setTutorialIndex(index);
    setShowQuestPanel(false);
    setShowShopPanel(false);
    setShowTutorialMenu(false);
    setMode("tutorial");
  }, [
    clearTutorialFlashTimers,
    resetYanmarSession,
    setMode,
    setShowTutorialMenu,
    setTutorialIndex,
  ]);

  const startFreePractice = useCallback(() => {
    clearTutorialFlashTimers();
    resetYanmarSession({ terrainLevel: PRACTICE_FULL_UNLOCK_LEVEL });
    terrainRef.current = createInitialTerrain(true, PRACTICE_FULL_UNLOCK_LEVEL);
    setTerrainRevision((key) => key + 1);
    tutorialStepRef.current = null;
    tutorialPhaseRef.current = null;
    tutorialWaypointRef.current = null;
    tutorialGuideRef.current = "";
    tutorialCelebratedPhaseRef.current = -1;
    setTutorialGuide("");
    setTutorialHasWaypoint(false);
    setShowQuestPanel(false);
    setShowShopPanel(false);
    setShowTutorialMenu(false);
    setMode("practice");
  }, [clearTutorialFlashTimers, resetYanmarSession, setMode, setShowTutorialMenu]);

  const handleSimTick = useCallback(() => {
    syncDigHud();
    persistGameSession();
    persistDumpTruckCooldown();

    const pickups = worldPickupsRef.current;
    if (pickups.revision !== worldPickupRevisionRef.current) {
      worldPickupRevisionRef.current = pickups.revision;
      setWorldPickupRevision(pickups.revision);
      if (modeRef.current === "game" && worldPickupOwnerRef.current) {
        saveWorldPickupSnapshot(worldPickupOwnerRef.current, pickups);
      }
    }

    const modeNow = modeRef.current;
    const isSports =
      modeNow === "sportsRanked" || modeNow === "sportsPractice";

    if (isSports) {
      let run = sportsMeetRunRef.current;
      if (run) {
        const now = Date.now();
        const beforePhase = run.phase;
        const beforeStage = run.stageIndex;
        const beforeStars = run.starsCollected;
        run = tickSportsMeetCountdown(run, now);
        run = tryCollectNearbySportsPickups(
          run,
          simRef.current.posX,
          simRef.current.posZ,
          now,
          getSportsMeetPattern(run.weekKey),
        );
        run = noteSportsDumpFill(
          run,
          dumpTruckStateRef.current.fillUnits,
        );
        if (pickups) {
          pickups.speedBuffUntilMs = run.speedBuffUntilMs;
        }
        if (
          run !== sportsMeetRunRef.current ||
          run.phase !== beforePhase ||
          run.stageIndex !== beforeStage ||
          run.starsCollected !== beforeStars
        ) {
          const stageChanged = run.stageIndex !== beforeStage;
          const prevCourseStars = sportsMeetRunRef.current?.courseStars;
          const prevBuffCollected = sportsMeetRunRef.current?.speedBuffs.map(
            (b) => b.collected,
          );
          if (run.starsCollected !== beforeStars) {
            const newlyCollected = run.courseStars.filter(
              (star) =>
                star.collected &&
                !prevCourseStars?.some((p) => p.id === star.id && p.collected),
            );
            for (const star of newlyCollected) {
              grantSportsMeetCourseStar(run, star.id);
            }
          }
          if (stageChanged && run.phase === "racing") {
            run = finalizeSportsMeetStageAdvance(
              { ...run, stageIndex: beforeStage },
              run,
            );
          }
          sportsMeetRunRef.current = run;
          setSportsMeetRun(run);
          const buffChanged = run.speedBuffs.some(
            (b, i) => b.collected !== prevBuffCollected?.[i],
          );
          if (
            stageChanged ||
            run.starsCollected !== beforeStars ||
            buffChanged
          ) {
            setSportsMeetPickupRevision((n) => n + 1);
          }
          if (run.phase === "finished" && beforePhase !== "finished") {
            void (async () => {
              if (run.playMode === "ranked") {
                try {
                  await fetch("/api/sports-meet/yanmar/score", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      weekKey: run.weekKey,
                      patternId: run.patternId,
                      clearTimeMs: run.finalTimeMs,
                      runId: run.runId,
                      mode: "ranked",
                    }),
                  });
                } finally {
                  setSportsResultSubmitted(true);
                }
              } else {
                setSportsResultSubmitted(true);
              }
            })();
          }
        }
        sportsHudTickRef.current += 1;
        if (sportsHudTickRef.current % 6 === 0) {
          setSportsHudTick((n) => n + 1);
        }
      }
    }

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
          if (modeNow === "game") {
            travelMetersAccumRef.current += travelDelta;
            if (travelMetersAccumRef.current >= 5) {
              const meters = travelMetersAccumRef.current;
              travelMetersAccumRef.current = 0;
              void flushMaintenanceTravel(meters);
            }
          }
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
          if (isSports && sportsMeetRunRef.current) {
            const before = sportsMeetRunRef.current;
            let next = noteSportsDumpDepart(before, Date.now());
            if (next !== before) {
              next = finalizeSportsMeetStageAdvance(before, next);
              sportsMeetRunRef.current = next;
              setSportsMeetRun(next);
            }
          }
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
    const phase = tutorialPhaseRef.current;
    if (!step || !phase) return;

    phase.dumped = tutorialDumpRef.current;
    phase.asphaltBroken = tutorialCrashHitsRef.current;
    phase.hillDelivered = tutorialHillDeliverRef.current;

    // 성공 연출 중에는 다음 단계 판정을 잠시 멈춰 안내를 읽을 시간을 준다
    if (performance.now() < tutorialUiPauseUntilRef.current) {
      return;
    }

    const fb = digFeedbackRef.current;
    const prevPhase = phase.phase;
    const done = advanceTutorialProgress(step, simRef.current, phase, {
      input: inputRef.current,
      gripPressure: fb.gripPressure,
      carryingRock: fb.carryingRock,
      grappleLiftResult: fb.grappleLiftResult,
      grappleLiftResultTick: fb.grappleLiftResultTick,
      dumpTruckPhase: dumpTruckStateRef.current.phase,
      haulTruckPhase: terrainRef.current.hillZone?.haulTruck.phase ?? "",
      breakerTipReady: fb.canStrike,
    });

    const wp = getTutorialWaypoint(step, phase) ?? null;
    const hadWp = tutorialWaypointRef.current != null;
    tutorialWaypointRef.current = wp;
    if (wp != null !== hadWp) {
      setTutorialHasWaypoint(wp != null);
    }
    if (wp) {
      const goalDist = Math.round(waypointDistance(simRef.current, wp));
      setHud((h) => (h.goalDist === goalDist ? h : { ...h, goalDist }));
    } else if (hadWp) {
      setHud((h) => (h.goalDist === 0 ? h : { ...h, goalDist: 0 }));
    }

    if (done) {
      const finalLabel = getTutorialPhaseSuccessLabel(step, prevPhase);
      showTutorialComplete(finalLabel, getTutorialPhaseCount(step));
      return;
    }

    if (phase.phase > prevPhase && phase.phase > tutorialCelebratedPhaseRef.current) {
      tutorialCelebratedPhaseRef.current = phase.phase;
      const successLabel = getTutorialPhaseSuccessLabel(step, prevPhase);
      const nextGuide = getTutorialInstruction(step, phase);
      showTutorialPhaseSuccess(
        successLabel,
        nextGuide,
        phase.phase,
        getTutorialPhaseCount(step),
      );
      return;
    }

    // rockLoad처럼 안내만 바뀌는 경우(성공 연출 없이 상태 추적)
    if (phase.phase !== prevPhase) {
      const guide = getTutorialInstruction(step, phase);
      if (guide !== tutorialGuideRef.current) {
        tutorialGuideRef.current = guide;
        setTutorialGuide(guide);
      }
    }
  }, [
    finalizeSportsMeetStageAdvance,
    flushMaintenanceTravel,
    grantSportsMeetCourseStar,
    persistDumpTruckCooldown,
    persistGameSession,
    pushQuestProgress,
    showTutorialComplete,
    showTutorialPhaseSuccess,
    syncDigHud,
    setHud,
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
    (
      score: number,
      critical: boolean,
      rewardText = "",
      earnedXp = 0,
      earnedStars = 0,
      earnedEnhanceCores = 0,
    ) => {
      arcadeScoreRef.current += score;
      setHud((h) => ({ ...h, score: arcadeScoreRef.current }));

      const previous = dumpScorePanelRef.current;
      const next: DumpScorePanelState = {
        totalScore: (previous?.totalScore ?? 0) + score,
        critical: (previous?.critical ?? false) || critical,
        rewardText: appendRewardText(previous?.rewardText ?? "", rewardText),
        earnedStars: (previous?.earnedStars ?? 0) + earnedStars,
        earnedXp: (previous?.earnedXp ?? 0) + earnedXp,
        earnedEnhanceCores:
          (previous?.earnedEnhanceCores ?? 0) + earnedEnhanceCores,
        earnedMonumentPoints: previous?.earnedMonumentPoints ?? 0,
        earnedGachaTicketsStandard:
          previous?.earnedGachaTicketsStandard ?? 0,
        earnedGachaTicketsPremium: previous?.earnedGachaTicketsPremium ?? 0,
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
      earnedEnhanceCores = 0,
      earnedMonumentPoints = 0,
      earnedGachaTicketsStandard = 0,
      earnedGachaTicketsPremium = 0,
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
        earnedEnhanceCores,
        earnedMonumentPoints,
        earnedGachaTicketsStandard,
        earnedGachaTicketsPremium,
        pendingRewards: 0,
        pulseKey: (dumpScorePanelRef.current?.pulseKey ?? 0) + 1,
      };
      dumpScorePanelRef.current = next;
      setDumpScorePanel(next);
      scheduleHideDumpScorePanel();
    },
    [scheduleHideDumpScorePanel],
  );
  showStandaloneRewardPanelRef.current = showStandaloneRewardPanel;

  const appendEnhanceCoresToRewardPanel = useCallback(
    (amount: number) => {
      if (amount <= 0) return;
      const previous = dumpScorePanelRef.current;
      if (previous) {
        const next: DumpScorePanelState = {
          ...previous,
          earnedEnhanceCores: previous.earnedEnhanceCores + amount,
          pulseKey: previous.pulseKey + 1,
        };
        dumpScorePanelRef.current = next;
        setDumpScorePanel(next);
        scheduleHideDumpScorePanel();
        return;
      }
      showStandaloneRewardPanel(0, false, 0, 0, "", amount);
    },
    [scheduleHideDumpScorePanel, showStandaloneRewardPanel],
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
          enhanceCores: claimed.reward.enhanceCores ?? 0,
          gachaTicketsStandard: claimed.reward.gachaTicketsStandard ?? 0,
          gachaTicketsPremium: claimed.reward.gachaTicketsPremium ?? 0,
          label: `일일:${questId}`,
        });
        questStateRef.current = claimed.state;
        setQuestState(claimed.state);
        saveQuestState(claimed.state);
        if (claimed.reward.stars > 0) {
          rewardStarsRef.current += claimed.reward.stars;
        }
        showStandaloneRewardPanel(
          0,
          false,
          claimed.reward.stars,
          claimed.reward.xp,
          "",
          claimed.reward.enhanceCores ?? 0,
          0,
          claimed.reward.gachaTicketsStandard ?? 0,
          claimed.reward.gachaTicketsPremium ?? 0,
        );
      } catch {
        showAttachmentWarning("퀘스트 보상 수령에 실패했습니다.");
      } finally {
        setQuestClaimingId(null);
      }
    },
    [
      grantQuestReward,
      questClaimingId,
      showAttachmentWarning,
      showStandaloneRewardPanel,
    ],
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
        enhanceCores: claimed.reward.enhanceCores ?? 0,
        gachaTicketsStandard: claimed.reward.gachaTicketsStandard ?? 0,
        gachaTicketsPremium: claimed.reward.gachaTicketsPremium ?? 0,
        label: `미션:${claimed.roundIndex + 1}`,
      });
      questStateRef.current = claimed.state;
      setQuestState(claimed.state);
      saveQuestState(claimed.state);
      if (claimed.reward.stars > 0) {
        rewardStarsRef.current += claimed.reward.stars;
      }
      showStandaloneRewardPanel(
        claimed.reward.score ?? 0,
        false,
        claimed.reward.stars,
        claimed.reward.xp,
        "",
        claimed.reward.enhanceCores ?? 0,
        0,
        claimed.reward.gachaTicketsStandard ?? 0,
        claimed.reward.gachaTicketsPremium ?? 0,
      );
    } catch {
      showAttachmentWarning("미션 보상 수령에 실패했습니다.");
    } finally {
      setQuestClaimingId(null);
    }
  }, [
    grantQuestReward,
    questClaimingId,
    showAttachmentWarning,
    showStandaloneRewardPanel,
  ]);

  const handleClaimRepeatQuest = useCallback(
    async (questId: string) => {
      const current = questStateRef.current;
      if (!current || questClaimingId) return;
      const claimed = claimRepeatQuest(current, questId);
      if (!claimed) return;
      setQuestClaimingId(`repeat:${questId}`);
      try {
        await grantQuestReward({
          eventId: questClaimEventId(
            "repeat",
            current.dayKey,
            `${questId}:${claimed.claimIndex}`,
          ),
          stars: claimed.reward.stars,
          xp: claimed.reward.xp,
          enhanceCores: claimed.reward.enhanceCores ?? 0,
          gachaTicketsStandard: claimed.reward.gachaTicketsStandard ?? 0,
          gachaTicketsPremium: claimed.reward.gachaTicketsPremium ?? 0,
          label: `반복:${questId}`,
        });
        questStateRef.current = claimed.state;
        setQuestState(claimed.state);
        saveQuestState(claimed.state);
        if (claimed.reward.stars > 0) {
          rewardStarsRef.current += claimed.reward.stars;
        }
        showStandaloneRewardPanel(
          0,
          false,
          claimed.reward.stars,
          claimed.reward.xp,
          "",
          claimed.reward.enhanceCores ?? 0,
          0,
          claimed.reward.gachaTicketsStandard ?? 0,
          claimed.reward.gachaTicketsPremium ?? 0,
        );
      } catch {
        showAttachmentWarning("퀘스트 보상 수령에 실패했습니다.");
      } finally {
        setQuestClaimingId(null);
      }
    },
    [
      grantQuestReward,
      questClaimingId,
      showAttachmentWarning,
      showStandaloneRewardPanel,
    ],
  );

  const adjustDumpScorePanel = useCallback(
    (
      scoreDelta: number,
      patch: Partial<
        Pick<
          DumpScorePanelState,
          | "rewardText"
          | "critical"
          | "earnedStars"
          | "earnedXp"
          | "earnedEnhanceCores"
        >
      > = {},
      pendingCompleted = 1,
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
        earnedEnhanceCores:
          patch.earnedEnhanceCores ?? previous.earnedEnhanceCores,
        pendingRewards: Math.max(0, previous.pendingRewards - pendingCompleted),
        pulseKey: previous.pulseKey + (scoreDelta !== 0 ? 1 : 0),
      };
      dumpScorePanelRef.current = next;
      setDumpScorePanel(next);
      scheduleHideDumpScorePanel();
    },
    [scheduleHideDumpScorePanel],
  );

  const flushDumpRewardOutbox = useCallback(async () => {
    const userId = session?.user?.id;
    if (
      !userId ||
      dumpOutboxOwnerRef.current !== userId ||
      dumpOutboxFlushOwnersRef.current.has(userId)
    ) {
      return;
    }

    dumpOutboxFlushOwnersRef.current.add(userId);
    const storageKey = dumpRewardOutboxStorageKey(userId);
    const attemptedEventIds = new Set<string>();
    try {
      while (dumpOutboxOwnerRef.current === userId) {
        const batches = parseDumpRewardOutbox(
          window.localStorage.getItem(storageKey),
        );
        const openEventId = dumpOutboxOpenBatchRef.current?.eventId;
        const batch = batches.find(
          (item) =>
            item.eventId !== openEventId &&
            !attemptedEventIds.has(item.eventId) &&
            !dumpOutboxInFlightRef.current.has(`${userId}:${item.eventId}`),
        );
        if (!batch) break;

        const runtimeKey = `${userId}:${batch.eventId}`;
        dumpOutboxInFlightRef.current.add(runtimeKey);
        try {
          const res = await fetch("/api/rewards/yanmar-dump", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chunkCount: batch.chunkCount,
              eventId: batch.eventId,
            }),
            keepalive: true,
          });
          if (!res.ok) {
            attemptedEventIds.add(batch.eventId);
            if (
              res.status === 401 ||
              res.status === 408 ||
              res.status === 429 ||
              res.status >= 500
            ) {
              break;
            }
            continue;
          }

          const data = (await res.json()) as {
            events?: DumpRewardApiEvent[];
            currency?: number;
            totalXp?: number;
            xpGained?: number;
            gearDrops?: {
              nameSnapshot: string;
              grade: string;
              slot?: string;
              mailed?: boolean;
            }[];
            coresDropped?: number;
            enhanceCores?: number;
          };
          if (data.gearDrops && data.gearDrops.length > 0) {
            data.gearDrops.forEach((drop, index) => {
              notifyGearDrop(drop, { playSound: index === 0 });
            });
          }
          const coresDropped = notifyCoresDrop(
            data.coresDropped,
            data.enhanceCores,
          );
          if (coresDropped > 0) {
            appendEnhanceCoresToRewardPanel(coresDropped);
          }
          const remaining = removeDumpRewardOutboxBatch(
            parseDumpRewardOutbox(window.localStorage.getItem(storageKey)),
            batch.eventId,
          );
          if (remaining.length > 0) {
            window.localStorage.setItem(
              storageKey,
              serializeDumpRewardOutbox(remaining),
            );
          } else {
            window.localStorage.removeItem(storageKey);
          }

          const optimistic = dumpOutboxOptimisticRef.current.get(runtimeKey);
          dumpOutboxOptimisticRef.current.delete(runtimeKey);
          if (dumpOutboxOwnerRef.current !== userId) continue;

          const pendingOptimisticStars = Array.from(
            dumpOutboxOptimisticRef.current.entries(),
          ).reduce(
            (sum, [key, item]) =>
              key.startsWith(`${userId}:`) ? sum + item.optimisticStars : sum,
            0,
          );
          syncSessionBalances(data, {
            displayCurrency:
              typeof data.currency === "number"
                ? data.currency + pendingOptimisticStars
                : undefined,
          });
          if (!optimistic) continue;

          const events = Array.isArray(data.events) ? data.events : [];
          const actualScore = events.reduce((sum, event) => sum + event.score, 0);
          const actualStars = events.reduce(
            (sum, event) => sum + (event.kind === "stars" ? event.stars : 0),
            0,
          );
          const actualXp =
            typeof data.xpGained === "number"
              ? data.xpGained
              : optimistic.optimisticXp;
          const starDelta = actualStars - optimistic.optimisticStars;
          const xpDelta = actualXp - optimistic.optimisticXp;
          rewardStarsRef.current = Math.max(
            0,
            rewardStarsRef.current + starDelta,
          );
          for (const event of events) {
            if (event.kind === "coupon") {
              showCouponDiscovery(event.couponType, event.discountPct);
            }
          }
          adjustDumpScorePanel(
            actualScore - optimistic.optimisticScore,
            {
              critical:
                events.some((event) => event.critical) ||
                dumpScorePanelRef.current?.critical,
              earnedStars: Math.max(
                0,
                (dumpScorePanelRef.current?.earnedStars ?? 0) + starDelta,
              ),
              earnedXp: Math.max(
                0,
                (dumpScorePanelRef.current?.earnedXp ?? 0) + xpDelta,
              ),
            },
            optimistic.chunkCount,
          );
        } finally {
          dumpOutboxInFlightRef.current.delete(runtimeKey);
        }
      }
    } catch {
      // Durable outbox remains in localStorage and retries on the next trigger.
    } finally {
      dumpOutboxFlushOwnersRef.current.delete(userId);
    }
  }, [
    adjustDumpScorePanel,
    appendEnhanceCoresToRewardPanel,
    notifyCoresDrop,
    notifyGearDrop,
    session?.user?.id,
    showCouponDiscovery,
    syncSessionBalances,
  ]);

  const sealAndFlushDumpRewardOutbox = useCallback(() => {
    dumpOutboxOpenBatchRef.current = null;
    if (dumpOutboxDebounceTimerRef.current != null) {
      window.clearTimeout(dumpOutboxDebounceTimerRef.current);
      dumpOutboxDebounceTimerRef.current = null;
    }
    void flushDumpRewardOutbox();
  }, [flushDumpRewardOutbox]);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    const userId = session?.user?.id ?? null;
    dumpOutboxOwnerRef.current = userId;
    dumpOutboxOpenBatchRef.current = null;
    dumpOutboxOptimisticRef.current.clear();
    if (!userId) return;

    void flushDumpRewardOutbox();
    const flushOnline = () => void flushDumpRewardOutbox();
    const flushOnVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sealAndFlushDumpRewardOutbox();
      } else {
        void flushDumpRewardOutbox();
      }
    };
    window.addEventListener("online", flushOnline);
    document.addEventListener("visibilitychange", flushOnVisibilityChange);
    return () => {
      window.removeEventListener("online", flushOnline);
      document.removeEventListener("visibilitychange", flushOnVisibilityChange);
      if (dumpOutboxDebounceTimerRef.current != null) {
        window.clearTimeout(dumpOutboxDebounceTimerRef.current);
        dumpOutboxDebounceTimerRef.current = null;
      }
      dumpOutboxOpenBatchRef.current = null;
      dumpOutboxOptimisticRef.current.clear();
      if (dumpOutboxOwnerRef.current === userId) {
        dumpOutboxOwnerRef.current = null;
      }
    };
  }, [
    flushDumpRewardOutbox,
    sealAndFlushDumpRewardOutbox,
    session?.user?.id,
    sessionStatus,
  ]);

  const queueDumpRewardChunk = useCallback(
    (score: number, optimisticStars: number, optimisticXp: number) => {
      const userId = session?.user?.id;
      if (!userId || dumpOutboxOwnerRef.current !== userId) return false;

      const current = dumpOutboxOpenBatchRef.current;
      const batch =
        current && current.chunkCount < DUMP_REWARD_BATCH_MAX_CHUNKS
          ? {
              ...current,
              chunkCount: current.chunkCount + 1,
              optimisticStars: current.optimisticStars + optimisticStars,
              optimisticXp: current.optimisticXp + optimisticXp,
              optimisticScore: current.optimisticScore + score,
            }
          : {
              eventId: `dump:${window.crypto.randomUUID()}`,
              chunkCount: 1,
              optimisticStars,
              optimisticXp,
              optimisticScore: score,
              createdAt: Date.now(),
            };

      try {
        const storageKey = dumpRewardOutboxStorageKey(userId);
        const next = mergeDumpRewardOutbox(
          parseDumpRewardOutbox(window.localStorage.getItem(storageKey)),
          batch,
        );
        window.localStorage.setItem(
          storageKey,
          serializeDumpRewardOutbox(next),
        );
      } catch {
        return false;
      }

      dumpOutboxOpenBatchRef.current = batch;
      dumpOutboxOptimisticRef.current.set(`${userId}:${batch.eventId}`, batch);

      if (dumpOutboxDebounceTimerRef.current != null) {
        window.clearTimeout(dumpOutboxDebounceTimerRef.current);
      }
      if (batch.chunkCount >= DUMP_REWARD_BATCH_MAX_CHUNKS) {
        sealAndFlushDumpRewardOutbox();
        return true;
      }
      dumpOutboxDebounceTimerRef.current = window.setTimeout(() => {
        if (dumpOutboxOpenBatchRef.current?.eventId === batch.eventId) {
          dumpOutboxOpenBatchRef.current = null;
        }
        dumpOutboxDebounceTimerRef.current = null;
        void flushDumpRewardOutbox();
      }, DUMP_REWARD_BATCH_DEBOUNCE_MS);
      return true;
    },
    [
      flushDumpRewardOutbox,
      sealAndFlushDumpRewardOutbox,
      session?.user?.id,
    ],
  );

  const handleDumpScore = useCallback(
    (popup: Omit<DumpScorePopup, "id">) => {
      if (modeRef.current === "ride") return;
      if (
        modeRef.current === "sportsRanked" ||
        modeRef.current === "sportsPractice"
      ) {
        return;
      }
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

      const optimisticStars = rollOptimisticStarReward();
      if (!queueDumpRewardChunk(popup.score, optimisticStars, dumpXp)) {
        accumulateDumpScore(popup.score, popup.critical, "", dumpXp, 0);
        return;
      }
      accumulateDumpScore(popup.score, popup.critical, "", dumpXp, optimisticStars);
      rewardStarsRef.current += optimisticStars;
      currencyRef.current = clampUserCurrency(
        currencyRef.current + optimisticStars,
      );
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
    },
    [accumulateDumpScore, pushQuestProgress, queueDumpRewardChunk],
  );

  const worldStarClaimInFlightRef = useRef(false);

  const handleWorldPickup = useCallback(
    (pickup: WorldPickup) => {
      if (modeRef.current !== "game") return;
      const userId = session?.user?.id;
      if (userId) {
        saveWorldPickupSnapshot(userId, worldPickupsRef.current);
      }

      if (pickup.kind === "speed") {
        showAttachmentWarning("이동속도 2배! (30초)");
        yanmarAudio.playBuffAcquire();
        return;
      }

      if (!userId) return;
      // One street-star claim per hour — block overlapping client awards.
      if (worldStarClaimInFlightRef.current) return;
      worldStarClaimInFlightRef.current = true;

      const optimistic = rollClientStarReward();
      const before = currencyRef.current;
      currencyRef.current = clampUserCurrency(
        currencyRef.current + optimistic,
      );
      setCurrency(currencyRef.current);
      setPreviewStars(currencyRef.current);
      showAttachmentWarning(`스타 +${optimistic}`, { stars: optimistic });
      yanmarAudio.playStarAcquire();

      // Hour-scoped id so a respawn / double-collect cannot grant twice.
      const eventId = `world-star:${getWorldPickupHourBucket()}`;
      void (async () => {
        try {
          const res = await fetch("/api/rewards/yanmar-world-pickup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId }),
          });
          if (res.status === 429) {
            currencyRef.current = before;
            setCurrency(before);
            setPreviewStars(before);
            markWorldStarHourlyLimitReached(worldPickupsRef.current);
            saveWorldPickupSnapshot(userId, worldPickupsRef.current);
            worldPickupRevisionRef.current = worldPickupsRef.current.revision;
            setWorldPickupRevision(worldPickupsRef.current.revision);
            showAttachmentWarning("시간당 스타 획득 한도에 도달했습니다.");
            return;
          }
          if (!res.ok) {
            currencyRef.current = before;
            setCurrency(before);
            setPreviewStars(before);
            return;
          }
          markWorldStarHourlyLimitReached(worldPickupsRef.current);
          saveWorldPickupSnapshot(userId, worldPickupsRef.current);
          worldPickupRevisionRef.current = worldPickupsRef.current.revision;
          setWorldPickupRevision(worldPickupsRef.current.revision);
          const data = (await res.json()) as {
            stars?: number;
            currency?: number;
          };
          // Silently reconcile to server balance — do not show a second +스타 toast.
          if (typeof data.currency === "number") {
            syncSessionBalances(data, { syncPreviewCurrency: true });
          } else if (typeof data.stars === "number") {
            const corrected = before + data.stars;
            currencyRef.current = corrected;
            setCurrency(corrected);
            setPreviewStars(corrected);
          }
        } catch {
          currencyRef.current = before;
          setCurrency(before);
          setPreviewStars(before);
        } finally {
          worldStarClaimInFlightRef.current = false;
        }
      })();
    },
    [session?.user?.id, showAttachmentWarning, syncSessionBalances],
  );

  useEffect(() => {
    worldPickupOwnerRef.current = session?.user?.id ?? null;
  }, [session?.user?.id]);

  useEffect(() => {
    const userId = session?.user?.id ?? null;
    worldPickupOwnerRef.current = userId;
    if (mode === "game" && userId) {
      const snap = loadWorldPickupSnapshot(userId);
      const hydrate =
        snap && isWorldPickupSnapshotCurrent(snap)
          ? {
              hourBucket: snap.hourBucket,
              starCollectedThisHour: snap.starCollectedThisHour,
              speedCollectedThisHour: snap.speedCollectedThisHour,
              pendingStarAt: snap.pendingStarAt,
              pendingSpeedAt: snap.pendingSpeedAt,
              speedBuffUntilMs: snap.speedBuffUntilMs,
              active: snapshotToActivePickups(snap),
            }
          : null;
      const next = createWorldPickupsStateFromHydrate(hydrate);
      worldPickupsRef.current = next;
      worldPickupRevisionRef.current = next.revision;
      setWorldPickupRevision(next.revision);
      saveWorldPickupSnapshot(userId, next);
      return;
    }
    // Leaving game mode — keep last snapshot on disk; clear in-memory pickups.
    const empty = createEmptyWorldPickupsState();
    worldPickupsRef.current = empty;
    worldPickupRevisionRef.current = empty.revision;
    setWorldPickupRevision(empty.revision);
  }, [mode, session?.user?.id]);

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
        syncSessionBalances(data);

        const event = data.reward as DumpRewardApiEvent | undefined;
        const couponEvent = (data.coupon ??
          (event?.kind === "coupon" ? event : null)) as
          | Extract<DumpRewardApiEvent, { kind: "coupon" }>
          | null
          | undefined;
        const critical = Boolean(
          (typeof data.critical === "boolean" && data.critical) ||
            event?.critical ||
            couponEvent?.critical,
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
        const stars =
          typeof data.totalStars === "number"
            ? data.totalStars
            : event?.kind === "stars"
              ? event.stars
              : 0;

        if (couponEvent?.kind === "coupon") {
          showCouponDiscovery(couponEvent.couponType, couponEvent.discountPct);
        }

        notifyGearDrop(
          data.gearDrop as
            | {
                nameSnapshot?: string;
                grade?: string;
                slot?: string;
                mailed?: boolean;
              }
            | null
            | undefined,
        );
        const coresDropped = notifyCoresDrop(
          data.coresDropped,
          data.enhanceCores,
        );

        if (kind === "crash") {
          if (stars > 0) {
            rewardStarsRef.current += stars;
          }
          if (
            score > 0 ||
            xpGained > 0 ||
            stars > 0 ||
            coresDropped > 0 ||
            couponEvent
          ) {
            showStandaloneRewardPanel(
              score,
              critical || Boolean(couponEvent),
              stars,
              xpGained,
              couponEvent ? "쿠폰 획득!" : undefined,
              coresDropped,
            );
          }
          return;
        }

        if (
          score > 0 ||
          xpGained > 0 ||
          stars > 0 ||
          coresDropped > 0 ||
          couponEvent
        ) {
          if (stars > 0) {
            rewardStarsRef.current += stars;
          }
          accumulateDumpScore(
            score,
            critical || Boolean(couponEvent),
            couponEvent ? "쿠폰 획득!" : "",
            xpGained,
            stars,
            coresDropped,
          );
        }
      } catch {
        showAttachmentWarning("보상 저장에 실패했습니다. 잠시 후 다시 시도하세요.");
      }
    },
    [
      accumulateDumpScore,
      notifyGearDrop,
      notifyCoresDrop,
      showAttachmentWarning,
      showCouponDiscovery,
      showStandaloneRewardPanel,
      syncSessionBalances,
    ],
  );

  const handleCrashTileDestroyed = useCallback(
    (tileId: string) => {
      if (modeRef.current === "tutorial") {
        tutorialCrashHitsRef.current += 1;
      }
      const isSports =
        modeRef.current === "sportsRanked" ||
        modeRef.current === "sportsPractice";
      if (isSports && sportsMeetRunRef.current) {
        const before = sportsMeetRunRef.current;
        let next = noteSportsAsphaltBreak(before, Date.now());
        next = finalizeSportsMeetStageAdvance(before, next);
        sportsMeetRunRef.current = next;
        setSportsMeetRun(next);
        return;
      }
      pushQuestProgress("asphaltBreak", 1);
      void claimSpecialReward("crash", tileId);
    },
    [
      claimSpecialReward,
      finalizeSportsMeetStageAdvance,
      pushQuestProgress,
    ],
  );

  const handleHillRockDelivered = useCallback(
    (rockId: string) => {
      if (modeRef.current === "tutorial") {
        tutorialHillDeliverRef.current += 1;
      }
      const isSports =
        modeRef.current === "sportsRanked" ||
        modeRef.current === "sportsPractice";
      if (isSports && sportsMeetRunRef.current) {
        const before = sportsMeetRunRef.current;
        let next = noteSportsRockDump(before, Date.now());
        next = finalizeSportsMeetStageAdvance(before, next);
        sportsMeetRunRef.current = next;
        setSportsMeetRun(next);
        return;
      }
      pushQuestProgress("rockDump", 1);
      void claimSpecialReward("hill", rockId);
    },
    [
      claimSpecialReward,
      finalizeSportsMeetStageAdvance,
      pushQuestProgress,
    ],
  );

  const claimTruckFullReward = useCallback(
    async (kind: "dump" | "haul") => {
      if (modeRef.current !== "game") return;
      try {
        const res = await fetch("/api/rewards/yanmar-truck-full", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            eventId: `truck-full:${kind}:${window.crypto.randomUUID()}`,
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          bonusScore?: number;
          gearDrop?: {
            nameSnapshot?: string;
            grade?: string;
            slot?: string;
            mailed?: boolean;
          } | null;
          coresDropped?: number;
          enhanceCores?: number;
        };
        const coresDropped = notifyCoresDrop(
          data.coresDropped,
          data.enhanceCores,
        );
        if (typeof data.bonusScore === "number" && data.bonusScore > 0) {
          accumulateDumpScore(
            data.bonusScore,
            false,
            "트럭 만재 보너스",
            0,
            0,
            coresDropped,
          );
        } else if (coresDropped > 0) {
          appendEnhanceCoresToRewardPanel(coresDropped);
        }
        notifyGearDrop(data.gearDrop);
      } catch {
        // Best-effort master-option score / drop on truck departure.
      }
    },
    [
      accumulateDumpScore,
      appendEnhanceCoresToRewardPanel,
      notifyCoresDrop,
      notifyGearDrop,
    ],
  );

  const handleDumpTruckFull = useCallback(() => {
    void claimTruckFullReward("dump");
  }, [claimTruckFullReward]);

  const handleHaulTruckFull = useCallback(() => {
    void claimTruckFullReward("haul");
  }, [claimTruckFullReward]);

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
      const key = e.key?.toLowerCase();
      if (!key) return;
      keys.add(key);
      updateKeys();
    };
    const up = (e: KeyboardEvent) => {
      const key = e.key?.toLowerCase();
      if (!key) return;
      keys.delete(key);
      updateKeys();
    };
    const clearKeys = () => {
      if (keys.size === 0) return;
      keys.clear();
      updateKeys();
    };
    const onVisibility = () => {
      if (document.hidden) clearKeys();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clearKeys);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clearKeys);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [syncMergedInput]);

  const loadOverlayPercent = Math.max(0, Math.min(100, hud.bucketLoad * 100));
  const loadOverlayUnits = getLoadUnits(hud.bucketLoad, equipmentStats.maxLoadUnits);
  const showBucketLoad = attachmentType === "bucket" && loadOverlayUnits > 0;
  const questsDisabled =
    mode === "practice" ||
    mode === "tutorial" ||
    mode === "sportsRanked" ||
    mode === "sportsPractice";
  const sportsMeetUnlocked =
    getPlayerLevelProgress(totalXp).level >= SPORTS_MEET_UNLOCK_LEVEL ||
    isAdmin;
  const questClaimableCount = questsDisabled
    ? 0
    : countClaimableQuestRewards(questState).total;
  const workshopClaimableCount =
    nearWorkshopId && workshopQuestState
      ? countClaimableWorkshopQuests(workshopQuestState, nearWorkshopId)
      : 0;
  const repairClaimableCount = maintenance
    ? MAINTENANCE_FLUID_IDS.filter(
        (id) => maintenance.fluids[id].exchangeEligible,
      ).length
    : 0;
  const monumentStarsClaimable =
    monumentPanelState?.phase === "active" &&
    (monumentPanelState.starsStored ?? 0) > 0;
  const monumentHudPhase =
    monumentPanelState?.phase ?? monumentPhaseRef.current ?? "locked";
  const showMonumentMinimapProgress = monumentHudPhase === "active";
  const monumentMinimapStorageCap = monumentStorageCap(
    monumentPanelState?.levels?.storage_cap ?? 0,
  );
  const monumentMinimapStoragePct = Math.min(
    100,
    Math.round(
      (100 * (monumentPanelState?.starsStored ?? 0)) /
        Math.max(1, monumentMinimapStorageCap),
    ),
  );
  const monumentMinimapStorageFull =
    (monumentPanelState?.starsStored ?? 0) >= monumentMinimapStorageCap;

  return (
    <div
      className={`relative touch-manipulation ${
        immersive
          ? "h-full w-full overflow-hidden"
          : "mx-auto w-full max-w-lg"
      } yanmar-layout-portrait`}
      style={immersive ? { backgroundColor: "#8ec6e8" } : undefined}
    >
      <LandingPromoPopup surface="ingame" />
      <div
        className={`relative overflow-hidden ${
          immersive
            ? "shadow-2xl shadow-black/50"
            : "h-[520px] rounded-b-xl bg-slate-300 shadow-lg"
        }`}
        style={
          immersive
            ? { ...gameFrameStyle, backgroundColor: "#8ec6e8" }
            : gameFrameStyle
        }
      >
        <HourlyAdBanner
          enabled={mode === "game"}
          isLoggedIn={Boolean(session?.user?.id)}
          onClaimed={applyHourlyAdClaim}
        />
        <TutorialSelectModal
          open={showTutorialMenu}
          activeId={tutorialStep?.id ?? null}
          onClose={() => setShowTutorialMenu(false)}
          onSelect={startTutorial}
          onFreePlay={startFreePractice}
        />
        <InventoryFullModal
          open={showInventoryFullModal}
          onClose={() => setShowInventoryFullModal(false)}
          onOpenGear={() => {
            setShowInventoryFullModal(false);
            setShowShopPanel(false);
            setShowEquipmentUpgrade(true);
          }}
        />
        <GearPanel
          open={showEquipmentUpgrade}
          onClose={() => setShowEquipmentUpgrade(false)}
          items={gearItems}
          currency={mode === "game" ? currency : previewStars}
          enhanceCores={enhanceCores}
          inventorySlots={gearInventorySlots}
          expandCost={gearExpandCost}
          busy={gearBusy}
          playerLevel={getPlayerLevelProgress(totalXp).level}
          activeChassisId={activeChassisId}
          equipmentStats={equipmentStats}
          onEquip={(id) => void runGearAction("equip", id)}
          onUnequip={(id) => void runGearAction("unequip", id)}
          onEnhance={(id) =>
            runGearAction("enhance", id, { deferApply: true })
          }
          onApplyEnhanceResult={(result) =>
            applyGearActionResult(result as Record<string, unknown>)
          }
          onDismantle={async (id) => {
            const data = await runGearAction("dismantle", id);
            if (!data || typeof data.cores !== "number") return null;
            return { cores: data.cores as number };
          }}
          onSell={async (id) => {
            const data = await runGearAction("sell", id);
            if (!data || typeof data.stars !== "number") return null;
            return { stars: data.stars as number };
          }}
          onSynthesize={(itemIds) => runGearSynthesize(itemIds)}
          onExpandInventory={() => void handleExpandInventory()}
        />
        <PlayerProfileModal
          open={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          nickname={
            session?.user?.nickname ?? session?.user?.loginId ?? "PLAYER"
          }
          xpProgress={getPlayerLevelProgress(totalXp)}
          stars={mode === "game" ? currency : previewStars}
          playerLevel={getPlayerLevelProgress(totalXp).level}
          currency={mode === "game" ? currency : previewStars}
          activeChassisId={activeChassisId}
          ownedChassisIds={ownedChassisIds}
          profileAvatarId={profileAvatarId}
          abilityAlloc={abilityAlloc}
          busy={gearBusy}
          onPurchaseChassis={(id) => void handleChassisAction("purchase", id)}
          onEquipChassis={(id) => void handleChassisAction("equip", id)}
          onAbilityAllocChange={(alloc) =>
            void handleAbilityAllocAction("allocate", alloc)
          }
          onProfileUpdated={async (result) => {
            setProfileAvatarId(result.profileAvatarId);
            currencyRef.current = result.currency;
            setCurrency(result.currency);
            if (modeRef.current !== "game") {
              setPreviewStars(result.currency);
            }
            await update({
              user: {
                nickname: result.nickname,
                profileAvatarId: result.profileAvatarId,
                currency: result.currency,
              },
            });
          }}
        />
        <RepairPanel
          open={showRepairPanel}
          onClose={() => setShowRepairPanel(false)}
          maintenance={maintenance}
          busy={gearBusy}
          clockOffsetMs={serverNowOffsetMs}
          onRepair={(fluid) => handleRepair(fluid)}
        />
        <WorkshopPanel
          open={showWorkshopPanel}
          workshopId={activeWorkshopId}
          onClose={() => {
            setShowWorkshopPanel(false);
            setActiveWorkshopId(null);
          }}
          panelState={workshopPanelState}
          questItems={
            activeWorkshopId && workshopQuestState
              ? workshopQuestState.byWorkshop[activeWorkshopId]
              : []
          }
          busy={workshopBusy}
          onClaimQuest={(questId) => void handleWorkshopClaim(questId)}
          onUpgrade={(key) => void handleWorkshopUpgrade(key)}
          onInstantUpgrade={() => void handleWorkshopInstantUpgrade()}
          onShopPurchase={(itemId) => void handleWorkshopShopPurchase(itemId)}
        />
        <MonumentPanel
          open={showMonumentPanel}
          onClose={() => setShowMonumentPanel(false)}
          panelState={monumentPanelState}
          questState={monumentQuestState}
          busy={monumentBusy}
          onClaimQuest={(questId, points) =>
            void handleMonumentClaimQuest(questId, points)
          }
          onClaimRepeatQuest={(questId, points) =>
            void handleMonumentClaimRepeatQuest(questId, points)
          }
          onUpgrade={(key) => void handleMonumentUpgrade(key)}
          onInstantUpgrade={() => void handleMonumentInstantUpgrade()}
          onShopPurchase={(itemId) => void handleMonumentShopPurchase(itemId)}
          onStartConstruction={() => void handleMonumentStartConstruction()}
          onClaimConstruction={() => void handleMonumentClaimConstruction()}
          onClaimStars={() => void handleMonumentClaimStars()}
          onRefresh={() => void loadMonumentState()}
        />
        <ExcavatorMapModal
          open={showMapModal}
          onClose={() => setShowMapModal(false)}
          simRef={simRef}
          terrainRef={terrainRef}
          tutorialStepRef={tutorialStepRef}
          tutorialWaypointRef={tutorialWaypointRef}
          worldPickupsRef={
            mode === "game" && session?.user?.id ? worldPickupsRef : undefined
          }
          monumentPhase={
            monumentPanelState?.phase ?? monumentPhaseRef.current ?? "locked"
          }
          sportsMeetUnlocked={sportsMeetUnlocked}
        />

        {mode !== "intro" && mode !== "gameReady" && travelRaiseWarn ? (
          <div
            key={travelRaiseWarn.key}
            className={`yanmar-travel-raise-warn pointer-events-none absolute left-1/2 top-[3.25rem] z-[60] w-max max-w-[calc(100%_-_1rem)] -translate-x-1/2 whitespace-nowrap rounded-xl border border-amber-300/45 bg-amber-500/90 px-3 py-2 text-center text-[11px] font-black text-white shadow-xl backdrop-blur-sm${
              travelRaiseWarn.phase === "fade" ? " is-fading" : ""
            }`}
          >
            ⚠️{" "}
            {attachmentType === "breaker"
              ? "브레이커가 땅에 닿아있어 주행이 불가능합니다."
              : attachmentType === "grapple"
                ? "집게가 땅에 닿아있어 주행이 불가능합니다."
                : "버켓이 땅에 닿아있어 주행이 불가능합니다."}
          </div>
        ) : null}

        {mode !== "intro" && mode !== "gameReady" && digFeedback.showGripGauge ? (
          <div
            className={`pointer-events-none absolute left-1/2 z-[55] -translate-x-1/2 ${
              travelRaiseWarn ? "top-[5.75rem]" : "top-[3.25rem]"
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
          <div className="absolute left-1 top-2 z-50 flex max-w-[calc(100%-7rem)] flex-col items-start gap-1.5">
            {!questsDisabled ? (
              <>
                <div className="pointer-events-auto flex max-w-full flex-col items-start gap-1.5">
                  <div className="flex max-w-full flex-wrap items-start gap-1.5">
                    <button
                      type="button"
                      className={`yanmar-quest-button yanmar-aux-button touch-none active:scale-95${
                        showQuestPanel ? " is-open" : ""
                      }`}
                      onClick={() => {
                        setShowShopPanel(false);
                        setShowEquipmentUpgrade(false);
                        setShowQuestPanel((open) => !open);
                      }}
                      aria-expanded={showQuestPanel}
                      aria-label={
                        showQuestPanel
                          ? "퀘스트 닫기"
                          : questClaimableCount > 0
                            ? `퀘스트 열기, 미수령 보상 ${questClaimableCount}개`
                            : "퀘스트 열기"
                      }
                    >
                      <img
                        className="yanmar-quest-button-icon"
                        src="/images/yanmar/2d/cockpit/quest-premium.png?v=3"
                        alt=""
                        draggable={false}
                      />
                      <span className="yanmar-quest-button-label">퀘스트</span>
                      {questClaimableCount > 0 ? (
                        <span
                          className="yanmar-quest-notify-badge is-icon"
                          aria-hidden
                        >
                          {questClaimableCount > 9 ? "9+" : questClaimableCount}
                        </span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className={`yanmar-upgrade-hud-button yanmar-aux-button touch-none active:scale-95${
                        showEquipmentUpgrade ? " is-open" : ""
                      }`}
                      onClick={() => {
                        setShowQuestPanel(false);
                        setShowShopPanel(false);
                        setShowProfileModal(false);
                        setShowEquipmentUpgrade((open) => !open);
                      }}
                      aria-expanded={showEquipmentUpgrade}
                      aria-label={
                        showEquipmentUpgrade ? "장비강화 닫기" : "장비강화 열기"
                      }
                    >
                      <img
                        className="yanmar-upgrade-hud-button-icon"
                        src="/images/yanmar/2d/cockpit/upgrade-anvil-premium.png?v=2"
                        alt=""
                        draggable={false}
                      />
                      <span className="yanmar-upgrade-hud-button-label">장비</span>
                    </button>
                    <button
                      type="button"
                      className={`yanmar-shop-button yanmar-aux-button touch-none active:scale-95${
                        showShopPanel ? " is-open" : ""
                      }`}
                      onClick={() => {
                        setShowQuestPanel(false);
                        setShowEquipmentUpgrade(false);
                        setShowProfileModal(false);
                        setShowShopPanel((open) => !open);
                      }}
                      aria-expanded={showShopPanel}
                      aria-label={showShopPanel ? "상점 닫기" : "상점 열기"}
                    >
                      <img
                        className="yanmar-shop-button-icon"
                        src="/images/yanmar/2d/cockpit/shop-premium.png?v=4"
                        alt=""
                        draggable={false}
                      />
                      <span className="yanmar-shop-button-label">상점</span>
                    </button>
                    {nearMonument &&
                    !showMonumentPanel &&
                    !nearRepairTent &&
                    (monumentPanelState?.phase ?? "locked") !== "locked" ? (
                      <div className="pointer-events-auto flex flex-col items-stretch gap-1.5">
                        <button
                          type="button"
                          className="yanmar-site-prompt-hud-btn touch-none active:scale-95"
                          onClick={() => {
                            setShowQuestPanel(false);
                            setShowShopPanel(false);
                            setShowEquipmentUpgrade(false);
                            setShowProfileModal(false);
                            setShowRepairPanel(false);
                            setShowWorkshopPanel(false);
                            setShowMonumentPanel(true);
                            void loadMonumentState();
                          }}
                          aria-label={
                            monumentStarsClaimable
                              ? `조형물 입장, 수령 가능 스타 ${monumentPanelState?.starsStored?.toLocaleString() ?? 0}`
                              : "조형물 입장"
                          }
                        >
                          <span className="yanmar-site-prompt-hud-copy">
                            <span className="yanmar-site-prompt-hud-eyebrow">
                              조형물
                            </span>
                            <span className="yanmar-site-prompt-hud-label">
                              {monumentPanelState?.phase === "quest"
                                ? "미션 확인"
                                : monumentPanelState?.phase === "building"
                                  ? "건설 현황"
                                  : monumentPanelState?.phase === "active" &&
                                      (monumentPanelState.starsStored ?? 0) > 0
                                    ? `스타 수령 ${monumentPanelState.starsStored.toLocaleString()}`
                                    : "조형물 입장"}
                            </span>
                          </span>
                          {monumentStarsClaimable ? (
                            <span
                              className="yanmar-quest-notify-badge is-dot"
                              aria-hidden
                            />
                          ) : null}
                        </button>
                        {monumentPanelState?.phase === "claimable" ? (
                          <button
                            type="button"
                            className="yanmar-site-prompt-hud-btn touch-none active:scale-95 disabled:opacity-50"
                            disabled={monumentBusy}
                            onClick={() =>
                              void handleMonumentClaimConstruction()
                            }
                            aria-label="건설완료"
                          >
                            <span className="yanmar-site-prompt-hud-copy">
                              <span className="yanmar-site-prompt-hud-eyebrow">
                                조형물
                              </span>
                              <span className="yanmar-site-prompt-hud-label">
                                건설완료
                              </span>
                            </span>
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {nearSportsMeet &&
                    !showSportsMeetPanel &&
                    !nearRepairTent &&
                    sportsMeetUnlocked ? (
                      <button
                        type="button"
                        className="yanmar-site-prompt-hud-btn yanmar-site-prompt-hud-btn--sports touch-none active:scale-95"
                        onClick={() => {
                          setShowQuestPanel(false);
                          setShowShopPanel(false);
                          setShowEquipmentUpgrade(false);
                          setShowProfileModal(false);
                          setShowRepairPanel(false);
                          setShowWorkshopPanel(false);
                          setShowMonumentPanel(false);
                          void refreshSportsMeetTicket();
                          setShowSportsMeetPanel(true);
                        }}
                        aria-label={`운동회 입장, 입장권 ${sportsMeetTicket.remaining}/${sportsMeetTicket.limit}`}
                      >
                        <span className="yanmar-site-prompt-hud-copy">
                          <span className="yanmar-site-prompt-hud-label">
                            운동회 입장
                          </span>
                        </span>
                        <span className="yanmar-sports-meet-prompt-ticket">
                          <img
                            className="yanmar-sports-meet-ticket-icon"
                            src="/images/yanmar/2d/sports-meet-ticket.svg"
                            alt=""
                            draggable={false}
                          />
                          <span
                            className="yanmar-sports-meet-ticket-count"
                            aria-hidden
                          >
                            ({sportsMeetTicket.remaining}/
                            {sportsMeetTicket.limit})
                          </span>
                        </span>
                      </button>
                    ) : null}
                    {nearRepairTent && !showRepairPanel ? (
                      <button
                        type="button"
                        className={`yanmar-site-prompt-hud-btn touch-none active:scale-95${
                          repairClaimableCount > 0 ? " is-claimable" : ""
                        }`}
                        onClick={() => {
                          setShowQuestPanel(false);
                          setShowShopPanel(false);
                          setShowEquipmentUpgrade(false);
                          setShowProfileModal(false);
                          setShowWorkshopPanel(false);
                          setShowMonumentPanel(false);
                          setShowRepairPanel(true);
                        }}
                        aria-label={
                          repairClaimableCount > 0
                            ? `YK건기 서비스지점 열기, 교환 가능 ${repairClaimableCount}개`
                            : "YK건기 서비스지점 열기"
                        }
                      >
                        <span className="yanmar-site-prompt-hud-icon-wrap">
                          <img
                            className="yanmar-site-prompt-hud-icon"
                            src="/images/yanmar/2d/cockpit/repair-tent-premium.png?v=2"
                            alt=""
                            draggable={false}
                          />
                        </span>
                        <span className="yanmar-site-prompt-hud-copy">
                          <span className="yanmar-site-prompt-hud-eyebrow">
                            YK건기
                          </span>
                          <span className="yanmar-site-prompt-hud-label">
                            서비스지점
                          </span>
                        </span>
                        {repairClaimableCount > 0 ? (
                          <span className="yanmar-repair-claim-badge" aria-hidden>
                            {repairClaimableCount > 9
                              ? "9+"
                              : repairClaimableCount}
                          </span>
                        ) : null}
                      </button>
                    ) : null}
                    {nearWorkshopId &&
                    !showWorkshopPanel &&
                    !nearRepairTent &&
                    !nearMonument ? (
                      <button
                        type="button"
                        className={`yanmar-site-prompt-hud-btn touch-none active:scale-95${
                          workshopClaimableCount > 0 ? " is-claimable" : ""
                        }`}
                        onClick={() => {
                          setShowQuestPanel(false);
                          setShowShopPanel(false);
                          setShowEquipmentUpgrade(false);
                          setShowProfileModal(false);
                          setShowRepairPanel(false);
                          setActiveWorkshopId(nearWorkshopId);
                          setShowWorkshopPanel(true);
                          void loadWorkshopState();
                        }}
                        aria-label={
                          workshopClaimableCount > 0
                            ? `${WORKSHOP_DEFS[nearWorkshopId].promptTitle} 열기, 완료 퀘스트 ${workshopClaimableCount}개`
                            : `${WORKSHOP_DEFS[nearWorkshopId].promptTitle} 열기`
                        }
                      >
                        <span className="yanmar-site-prompt-hud-copy">
                          <span className="yanmar-site-prompt-hud-eyebrow">
                            {WORKSHOP_DEFS[nearWorkshopId].promptTitle}
                          </span>
                          <span className="yanmar-site-prompt-hud-label">
                            {WORKSHOP_DEFS[nearWorkshopId].promptAction}
                          </span>
                        </span>
                        {workshopClaimableCount > 0 ? (
                          <span
                            className="yanmar-quest-notify-badge is-icon"
                            aria-hidden
                          >
                            {workshopClaimableCount > 9
                              ? "9+"
                              : workshopClaimableCount}
                          </span>
                        ) : null}
                      </button>
                    ) : null}
                  </div>
                  {showMissionQuest ? (
                    <div className="w-[9rem]">
                      <MissionHudPanel
                        questState={questState}
                        claiming={questClaimingId === "mission"}
                        onClaim={() => {
                          void handleClaimMissionQuest();
                        }}
                      />
                    </div>
                  ) : null}
                </div>
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
                  onClaimRepeat={(questId) => {
                    void handleClaimRepeatQuest(questId);
                  }}
                />
                <ShopPanel
                  open={showShopPanel}
                  onClose={() => setShowShopPanel(false)}
                  stars={mode === "game" ? currency : previewStars}
                  gachaTicketsStandard={gachaTicketsStandard}
                  gachaTicketsPremium={gachaTicketsPremium}
                  freeGacha={freeGacha}
                  onRefreshFreeGacha={() => {
                    void refreshFreeGacha();
                  }}
                  activeItemIds={activeShopBuffs.map((buff) => buff.id)}
                  purchasingId={purchasingShopItemId}
                  onPurchase={(itemId) => {
                    void handleShopPurchase(itemId);
                  }}
                  gachaBusy={gachaBusy}
                  onGacha={(banner, count, payWith) => {
                    void handleGacha(banner, count, payWith);
                  }}
                />
                <GachaResultModal
                  open={showGachaResultModal}
                  onClose={() => setShowGachaResultModal(false)}
                  results={lastGachaResults}
                  banner={lastGachaBanner}
                />
              </>
            ) : null}
            {questsDisabled ? (
              <div className="pointer-events-auto flex max-w-full flex-col items-start gap-1.5">
                <div className="flex max-w-full flex-wrap items-start gap-1.5">
                  <button
                    type="button"
                    className={`yanmar-upgrade-hud-button yanmar-aux-button touch-none active:scale-95${
                      showEquipmentUpgrade ? " is-open" : ""
                    }`}
                    onClick={() => {
                      setShowEquipmentUpgrade((open) => !open);
                    }}
                    aria-expanded={showEquipmentUpgrade}
                    aria-label={
                      showEquipmentUpgrade ? "장비강화 닫기" : "장비강화 열기"
                    }
                  >
                    <img
                      className="yanmar-upgrade-hud-button-icon"
                      src="/images/yanmar/2d/cockpit/upgrade-anvil-premium.png?v=2"
                      alt=""
                      draggable={false}
                    />
                    <span className="yanmar-upgrade-hud-button-label">장비</span>
                  </button>
                  {mode !== "sportsRanked" && mode !== "sportsPractice" ? (
                    <button
                      type="button"
                      onClick={() => setShowTutorialMenu(true)}
                      className="h-[2.75rem] rounded-lg border border-white/20 bg-black/70 px-2.5 text-[11px] font-bold text-white shadow-lg backdrop-blur-sm hover:bg-black/85"
                    >
                      튜토리얼
                    </button>
                  ) : null}
                {nearMonument &&
                !showMonumentPanel &&
                !nearRepairTent &&
                (monumentPanelState?.phase ?? "locked") !== "locked" ? (
                  <div className="pointer-events-auto flex flex-col items-stretch gap-1.5">
                    <button
                      type="button"
                      className="yanmar-site-prompt-hud-btn touch-none active:scale-95"
                      onClick={() => {
                        setShowEquipmentUpgrade(false);
                        setShowRepairPanel(false);
                        setShowWorkshopPanel(false);
                        setShowMonumentPanel(true);
                        void loadMonumentState();
                      }}
                      aria-label={
                        monumentStarsClaimable
                          ? `조형물 입장, 수령 가능 스타 ${monumentPanelState?.starsStored?.toLocaleString() ?? 0}`
                          : "조형물 입장"
                      }
                    >
                      <span className="yanmar-site-prompt-hud-copy">
                        <span className="yanmar-site-prompt-hud-eyebrow">
                          조형물
                        </span>
                        <span className="yanmar-site-prompt-hud-label">
                          {monumentPanelState?.phase === "quest"
                            ? "미션 확인"
                            : monumentPanelState?.phase === "building"
                              ? "건설 현황"
                              : monumentPanelState?.phase === "active" &&
                                  (monumentPanelState.starsStored ?? 0) > 0
                                ? `스타 수령 ${monumentPanelState.starsStored.toLocaleString()}`
                                : "조형물 입장"}
                        </span>
                      </span>
                      {monumentStarsClaimable ? (
                        <span
                          className="yanmar-quest-notify-badge is-dot"
                          aria-hidden
                        />
                      ) : null}
                    </button>
                    {monumentPanelState?.phase === "claimable" ? (
                      <button
                        type="button"
                        className="yanmar-site-prompt-hud-btn touch-none active:scale-95 disabled:opacity-50"
                        disabled={monumentBusy}
                        onClick={() => void handleMonumentClaimConstruction()}
                        aria-label="건설완료"
                      >
                        <span className="yanmar-site-prompt-hud-copy">
                          <span className="yanmar-site-prompt-hud-eyebrow">
                            조형물
                          </span>
                          <span className="yanmar-site-prompt-hud-label">
                            건설완료
                          </span>
                        </span>
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {nearRepairTent && !showRepairPanel ? (
                  <button
                    type="button"
                    className={`yanmar-site-prompt-hud-btn touch-none active:scale-95${
                      repairClaimableCount > 0 ? " is-claimable" : ""
                    }`}
                    onClick={() => {
                      setShowEquipmentUpgrade(false);
                      setShowWorkshopPanel(false);
                      setShowMonumentPanel(false);
                      setShowRepairPanel(true);
                    }}
                    aria-label={
                      repairClaimableCount > 0
                        ? `YK건기 서비스지점 열기, 교환 가능 ${repairClaimableCount}개`
                        : "YK건기 서비스지점 열기"
                    }
                  >
                    <span className="yanmar-site-prompt-hud-icon-wrap">
                      <img
                        className="yanmar-site-prompt-hud-icon"
                        src="/images/yanmar/2d/cockpit/repair-tent-premium.png?v=2"
                        alt=""
                        draggable={false}
                      />
                    </span>
                    <span className="yanmar-site-prompt-hud-copy">
                      <span className="yanmar-site-prompt-hud-eyebrow">
                        YK건기
                      </span>
                      <span className="yanmar-site-prompt-hud-label">
                        서비스지점
                      </span>
                    </span>
                    {repairClaimableCount > 0 ? (
                      <span className="yanmar-repair-claim-badge" aria-hidden>
                        {repairClaimableCount > 9
                          ? "9+"
                          : repairClaimableCount}
                      </span>
                    ) : null}
                  </button>
                ) : null}
                {nearWorkshopId &&
                !showWorkshopPanel &&
                !nearRepairTent &&
                !nearMonument ? (
                  <button
                    type="button"
                    className={`yanmar-site-prompt-hud-btn touch-none active:scale-95${
                      workshopClaimableCount > 0 ? " is-claimable" : ""
                    }`}
                    onClick={() => {
                      setShowEquipmentUpgrade(false);
                      setShowRepairPanel(false);
                      setActiveWorkshopId(nearWorkshopId);
                      setShowWorkshopPanel(true);
                      void loadWorkshopState();
                    }}
                    aria-label={
                      workshopClaimableCount > 0
                        ? `${WORKSHOP_DEFS[nearWorkshopId].promptTitle} 열기, 완료 퀘스트 ${workshopClaimableCount}개`
                        : `${WORKSHOP_DEFS[nearWorkshopId].promptTitle} 열기`
                    }
                  >
                    <span className="yanmar-site-prompt-hud-copy">
                      <span className="yanmar-site-prompt-hud-eyebrow">
                        {WORKSHOP_DEFS[nearWorkshopId].promptTitle}
                      </span>
                      <span className="yanmar-site-prompt-hud-label">
                        {WORKSHOP_DEFS[nearWorkshopId].promptAction}
                      </span>
                    </span>
                    {workshopClaimableCount > 0 ? (
                      <span
                        className="yanmar-quest-notify-badge is-icon"
                        aria-hidden
                      >
                        {workshopClaimableCount > 9
                          ? "9+"
                          : workshopClaimableCount}
                      </span>
                    ) : null}
                  </button>
                ) : null}
                </div>
                {(mode === "sportsRanked" || mode === "sportsPractice") &&
                sportsMeetRun ? (
                  <div className="w-[9rem]">
                    <SportsMeetHud
                      key={`sports-hud-${sportsHudTick}`}
                      stageLabel={
                        sportsMeetRun.phase === "finished"
                          ? "완주!"
                          : isSportsMeetFinishDriveStage(
                                sportsMeetRun.stageOrder,
                                sportsMeetRun.stageIndex,
                              )
                            ? "골인 주행"
                            : `${STAGE_LABEL_KO[currentSportsStage(sportsMeetRun) ?? "drive"]} 코스`
                      }
                      progressLabel={(() => {
                        const stage = currentSportsStage(sportsMeetRun);
                        if (!stage) return "";
                        if (stage === "drive") {
                          if (
                            isSportsMeetFinishDriveStage(
                              sportsMeetRun.stageOrder,
                              sportsMeetRun.stageIndex,
                            )
                          ) {
                            return "FINISH 골인";
                          }
                          const quota = sportsMeetDriveStarQuota(
                            sportsMeetRun.mission,
                            sportsMeetRun.stageOrder,
                            sportsMeetRun.stageIndex,
                          );
                          return `별 ${sportsMeetRun.starsCollected}/${quota}`;
                        }
                        if (stage === "dig") {
                          return `하역 ${Math.floor(sportsMeetRun.dumpFillUnits)}/${sportsMeetRun.mission.dig.dumpTruckCapacity}`;
                        }
                        if (stage === "crash") {
                          return `파쇄 ${sportsMeetRun.asphaltBroken}/${sportsMeetRun.mission.crash.asphaltTileCount}`;
                        }
                        return `돌 ${sportsMeetRun.rocksDumped}/${sportsMeetRun.mission.hill.successfulDumpsRequired}`;
                      })()}
                      elapsedMs={sportsMeetElapsedMs(sportsMeetRun)}
                      countdownSec={
                        sportsMeetRun.phase === "countdown"
                          ? Math.max(
                              0,
                              Math.ceil(
                                (sportsMeetRun.countdownEndsAtMs - Date.now()) /
                                  1000,
                              ),
                            )
                          : null
                      }
                      phase={sportsMeetRun.phase}
                      patternName={sportsMeetRun.patternNameKo}
                      stageIndex={Math.min(
                        sportsMeetRun.stageIndex,
                        Math.max(0, sportsMeetRun.stageOrder.length - 1),
                      )}
                      stageTotal={sportsMeetRun.stageOrder.length}
                      onStart={startSportsCountdown}
                      onExit={exitSportsMeet}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {mode !== "intro" && mode !== "ride" && (
          <div className="pointer-events-none absolute left-1/2 top-14 z-50 flex -translate-x-1/2 flex-col items-center gap-1">
            {!(immersive && headerHudReady) ? (
              <div className="flex min-w-[5.5rem] flex-col items-center rounded-xl border border-white/15 bg-black/45 px-3 py-1.5 text-white shadow-lg backdrop-blur-sm">
                <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/70">
                  {mode === "game" ||
                  mode === "sportsRanked" ||
                  mode === "sportsPractice"
                    ? "누적 점수"
                    : "점수"}
                </span>
                <span className="mt-0.5 text-sm font-black tabular-nums text-yellow-100">
                  {(
                    mode === "game" ||
                    mode === "sportsRanked" ||
                    mode === "sportsPractice"
                      ? seasonScoreBase + hud.score
                      : hud.score
                  ).toLocaleString()}
                </span>
              </div>
            ) : null}
            {showBucketLoad ? (
              <div className="min-w-[7.5rem] rounded-xl border border-orange-200/45 bg-black/65 px-2.5 py-1.5 text-center text-white shadow-lg backdrop-blur-sm">
                <div className="flex items-center justify-center gap-1.5 text-[10px] font-black text-orange-100">
                  <span>현재 적재량</span>
                  <span className="tabular-nums">
                    {loadOverlayUnits}/{equipmentStats.maxLoadUnits}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/20">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-orange-400 to-yellow-200"
                    style={{ width: `${loadOverlayPercent}%` }}
                  />
                </div>
              </div>
            ) : null}
            {digFeedback.canDump && hud.bucketLoad > 0.02 ? (
              <div className="rounded-xl border border-emerald-200/50 bg-emerald-500/90 px-3 py-1 text-[10px] font-black text-white shadow-lg backdrop-blur-sm">
                하역가능
              </div>
            ) : hud.bucketLoad > 0.02 &&
              digFeedback.truckPresent &&
              digFeedback.dumpBodyTouching &&
              !digFeedback.dumpFacingBed ? (
              <div className="rounded-xl border border-sky-200/50 bg-sky-600/90 px-3 py-1 text-[10px] font-black text-white shadow-lg backdrop-blur-sm">
                정면을 짐칸으로
              </div>
            ) : hud.bucketLoad > 0.02 &&
              digFeedback.truckPresent &&
              digFeedback.inDumpZone &&
              !digFeedback.dumpBodyTouching ? (
              <div className="rounded-xl border border-sky-200/50 bg-sky-600/90 px-3 py-1 text-[10px] font-black text-white shadow-lg backdrop-blur-sm">
                트럭에 차체 붙이기
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
                타격가능
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
                발판 왼쪽: 열기
              </div>
            ) : attachmentType === "grapple" &&
              digFeedback.carryingRock &&
              digFeedback.haulTruckPresent &&
              digFeedback.nearHaulTruck &&
              digFeedback.dumpBodyTouching &&
              !digFeedback.dumpFacingBed &&
              !digFeedback.showGripGauge &&
              !digFeedback.canGrab ? (
              <div className="rounded-xl border border-sky-200/50 bg-sky-600/90 px-3 py-1 text-[10px] font-black text-white shadow-lg backdrop-blur-sm">
                정면을 짐칸으로
              </div>
            ) : attachmentType === "grapple" &&
              digFeedback.carryingRock &&
              digFeedback.haulTruckPresent &&
              digFeedback.nearHaulTruck &&
              !digFeedback.dumpBodyTouching &&
              !digFeedback.showGripGauge &&
              !digFeedback.canGrab ? (
              <div className="rounded-xl border border-sky-200/50 bg-sky-600/90 px-3 py-1 text-[10px] font-black text-white shadow-lg backdrop-blur-sm">
                트럭에 차체 붙이기
              </div>
            ) : digFeedback.soilSpilling && hud.bucketLoad > 0.02 ? (
              <div className="rounded-xl border border-amber-200/50 bg-amber-600/90 px-3 py-1 text-[10px] font-black text-white shadow-lg backdrop-blur-sm">
                흙 유실 — 버켓 말기
              </div>
            ) : digFeedback.raiseArmForDump &&
              digFeedback.truckPresent &&
              hud.bucketLoad > 0.02 ? (
              <div className="rounded-xl border border-sky-200/50 bg-sky-600/90 px-3 py-1 text-[10px] font-black text-white shadow-lg backdrop-blur-sm">
                붐·암 들기
              </div>
            ) : digFeedback.haulTruckPresent &&
              !digFeedback.haulTruckCanAccept &&
              digFeedback.haulTruckCooldownRemaining <= 0 ? (
              <div className="whitespace-nowrap rounded-xl border border-amber-200/50 bg-amber-600/90 px-3 py-1 text-[10px] font-black text-white shadow-lg backdrop-blur-sm">
                돌트럭 만차 — 하역 위치에서 벗어나세요
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
          </div>
        )}

        {headerHudReady && mode !== "intro" && mode !== "ride"
          ? (() => {
              const leftTarget = document.getElementById(GAME_IMMERSIVE_HEADER_LEFT_ID);
              const centerTarget = document.getElementById(
                GAME_IMMERSIVE_HEADER_CENTER_ID,
              );
              const rightTarget = document.getElementById(GAME_IMMERSIVE_HEADER_RIGHT_ID);
              if (!leftTarget && !centerTarget && !rightTarget) return null;
              const isSportsMeet =
                mode === "sportsRanked" || mode === "sportsPractice";
              // Sports meet keeps the same header chrome as game mode; score
              // does not increase during the meet (sim only awards in "game").
              const headerLikeGame = mode === "game" || isSportsMeet;
              const ownedStars = mode === "game" || isSportsMeet
                ? currency
                : previewStars;
              const xpProgress = getPlayerLevelProgress(
                mode === "game" || isSportsMeet
                  ? totalXp
                  : session?.user?.totalXp ?? totalXp,
              );
              const nickname =
                session?.user?.nickname ?? session?.user?.loginId ?? "PLAYER";
              const nickLen = nicknameCharLength(nickname);
              const displayScore =
                mode === "game"
                  ? seasonScoreBase + hud.score
                  : isSportsMeet
                    ? seasonScoreBase + hud.score
                    : hud.score;
              const bonusRemaining = Math.max(
                0,
                xpProgress.level - spentAbilityPoints(abilityAlloc),
              );
              return (
                <>
                  {leftTarget && headerLikeGame
                    ? createPortal(
                        <button
                          type="button"
                          className="yanmar-profile-chip"
                          onClick={() => {
                            setShowQuestPanel(false);
                            setShowShopPanel(false);
                            setShowEquipmentUpgrade(false);
                            setShowRepairPanel(false);
                            setShowProfileModal(true);
                          }}
                          aria-label={
                            bonusRemaining > 0
                              ? `프로필 열기, 보너스 분배 ${bonusRemaining}포인트 남음`
                              : "프로필 열기"
                          }
                        >
                          <span className="yanmar-profile-chip-avatar-col">
                            <span
                              className="yanmar-profile-chip-avatar"
                              aria-hidden
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                key={profileAvatarSrc(
                                  profileAvatarId,
                                  String(activeChassisId),
                                )}
                                src={profileAvatarSrc(
                                  profileAvatarId,
                                  String(activeChassisId),
                                )}
                                alt=""
                                className="yanmar-profile-chip-avatar-img"
                                draggable={false}
                              />
                              {bonusRemaining > 0 ? (
                                <em
                                  className="yanmar-bonus-point-badge is-on-chip"
                                  aria-hidden
                                />
                              ) : null}
                            </span>
                            <span className="yanmar-profile-chip-xp" aria-hidden>
                              <span
                                className="yanmar-profile-chip-xp-fill"
                                style={{
                                  width: `${Math.max(
                                    0,
                                    Math.min(100, xpProgress.progressPct),
                                  )}%`,
                                }}
                              />
                            </span>
                          </span>
                          <span className="yanmar-profile-chip-meta">
                            <span className="yanmar-profile-chip-lv">
                              Lv.{xpProgress.level}
                            </span>
                            <span
                              className={
                                nickLen >= 7
                                  ? "yanmar-profile-chip-name is-compact"
                                  : "yanmar-profile-chip-name"
                              }
                              title={nickname}
                            >
                              {nickname}
                            </span>
                          </span>
                        </button>,
                        leftTarget,
                      )
                    : null}
                  {centerTarget
                    ? createPortal(
                        <div className="inline-flex h-8 w-max min-w-[6.5rem] max-w-[10.5rem] flex-col items-center justify-center rounded-lg border border-white/20 bg-black/30 px-2.5 text-white shadow-sm">
                          <span className="text-[8px] font-bold uppercase leading-none tracking-[0.12em] text-white/75">
                            {headerLikeGame ? "누적 점수" : "점수"}
                          </span>
                          <span className="mt-0.5 max-w-full truncate text-[13px] font-black leading-none tabular-nums text-yellow-100">
                            {displayScore.toLocaleString()}
                          </span>
                        </div>,
                        centerTarget,
                      )
                    : null}
                  {rightTarget
                    ? createPortal(
                        <span className="inline-flex h-8 shrink-0 items-center rounded-lg border border-white/15 bg-black/25 px-2.5">
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
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold text-amber-300">{tutorialStep.title}</p>
              <p className="shrink-0 text-[9px] font-semibold tabular-nums text-white/55">
                {tutorialPhaseDisplay.current}/{tutorialPhaseDisplay.total}
              </p>
            </div>
            <p
              className={`mt-0.5 text-[clamp(7px,2.35vw,10px)] leading-snug ${
                tutorialFlash?.kind === "phase"
                  ? "font-bold text-emerald-300"
                  : tutorialFlash?.kind === "complete"
                    ? "font-bold text-amber-200"
                    : "text-white/85"
              }`}
            >
              {tutorialFlash
                ? `✓ ${tutorialFlash.message}`
                : tutorialGuide || tutorialStep.instruction}
            </p>
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
          <div className="absolute right-1.5 top-1.5 z-30 flex items-start gap-1 pointer-events-auto">
            <ActiveShopBuffIcons
              buffs={activeShopBuffs}
              onChange={persistActiveShopBuffs}
              worldPickupsRef={
                mode === "game" && session?.user?.id
                  ? worldPickupsRef
                  : undefined
              }
              worldPickupRevision={worldPickupRevision}
              alignWithMinimap={mode !== "gameReady"}
            />
            <div className="flex w-[88px] flex-col items-stretch gap-1.5">
            <div className="relative flex w-full flex-col overflow-hidden rounded-xl border border-white/15 bg-black/60 shadow-lg backdrop-blur-sm">
              {mode !== "gameReady" ? (
                <button
                  type="button"
                  onClick={() => {
                    clearFreeLook();
                    setCameraMode((current) => ((current % 3) + 1) as CameraMode);
                  }}
                  className="flex h-6 w-full items-center justify-center gap-0.5 border-b border-white/10 px-1 text-[9px] font-black whitespace-nowrap text-white hover:bg-white/10"
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
                  tutorialWaypointRef={tutorialWaypointRef}
                  worldPickupsRef={
                    mode === "game" && session?.user?.id
                      ? worldPickupsRef
                      : undefined
                  }
                  visible
                  embedded
                  displaySize={88}
                  monumentPhase={
                    monumentPanelState?.phase ??
                    monumentPhaseRef.current ??
                    "locked"
                  }
                  sportsMeetUnlocked={sportsMeetUnlocked}
                  onExpand={() => {
                    clearFreeLook();
                    setShowMapModal(true);
                  }}
                />
              ) : null}
              {digFeedback.truckCooldownRemaining > 0 ||
              digFeedback.haulTruckCooldownRemaining > 0 ||
              digFeedback.digCooldowns.length > 0 ||
              digFeedback.crashCooldownEtaSec > 0 ||
              digFeedback.hillCooldownEtaSec > 0 ||
              showMonumentMinimapProgress ? (
                <ul
                  className="flex w-full flex-col gap-0.5 border-t border-white/10 px-1 py-0.5"
                  aria-label="리젠 대기"
                >
                  {showMonumentMinimapProgress ? (
                    <li className="flex min-w-0 items-center justify-between gap-0.5 text-[7px] font-bold leading-none text-white/85">
                      <span className="truncate">조형물</span>
                      <span
                        className={`shrink-0 tabular-nums ${
                          monumentMinimapStorageFull
                            ? "text-orange-200"
                            : "text-amber-200"
                        }`}
                      >
                        {monumentMinimapStoragePct}%
                      </span>
                    </li>
                  ) : null}
                  {digFeedback.truckCooldownRemaining > 0 ? (
                    <li className="flex min-w-0 items-center justify-between gap-0.5 text-[7px] font-bold leading-none text-white/85">
                      <span className="truncate">덤프트럭</span>
                      <span className="shrink-0 tabular-nums text-sky-200">
                        {formatDumpTruckReturnTime(
                          digFeedback.truckCooldownRemaining,
                        )}
                      </span>
                    </li>
                  ) : null}
                  {digFeedback.haulTruckCooldownRemaining > 0 ? (
                    <li className="flex min-w-0 items-center justify-between gap-0.5 text-[7px] font-bold leading-none text-white/85">
                      <span className="truncate">돌트럭</span>
                      <span className="shrink-0 tabular-nums text-slate-200">
                        {formatDumpTruckReturnTime(
                          digFeedback.haulTruckCooldownRemaining,
                        )}
                      </span>
                    </li>
                  ) : null}
                  {digFeedback.digCooldowns.map((zone) => (
                    <li
                      key={zone.id}
                      className="flex min-w-0 items-center justify-between gap-0.5 text-[7px] font-bold leading-none text-white/85"
                    >
                      <span className="truncate">{zone.label}</span>
                      <span className="shrink-0 tabular-nums text-amber-200">
                        {Math.ceil(zone.etaSec)}초
                      </span>
                    </li>
                  ))}
                  {digFeedback.crashCooldownEtaSec > 0 ? (
                    <li className="flex min-w-0 items-center justify-between gap-0.5 text-[7px] font-bold leading-none text-white/85">
                      <span className="truncate">파쇄</span>
                      <span className="shrink-0 tabular-nums text-orange-200">
                        {formatDumpTruckReturnTime(
                          digFeedback.crashCooldownEtaSec,
                        )}
                      </span>
                    </li>
                  ) : null}
                  {digFeedback.hillCooldownEtaSec > 0 ? (
                    <li className="flex min-w-0 items-center justify-between gap-0.5 text-[7px] font-bold leading-none text-white/85">
                      <span className="truncate">석재</span>
                      <span className="shrink-0 tabular-nums text-sky-200">
                        {formatDumpTruckReturnTime(
                          digFeedback.hillCooldownEtaSec,
                        )}
                      </span>
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </div>
            {mode !== "gameReady" &&
            maintenance &&
            maintenance.warnings.length > 0 ? (
              <div className="yanmar-maintenance-warn-stack" aria-live="polite">
                {maintenance.warnings.map((fluid) => {
                  const ready = fluid.exchangeEligible || fluid.depleted;
                  const open = maintenanceBubbleId === fluid.id;
                  return (
                    <div
                      key={fluid.id}
                      className="yanmar-maintenance-icon-wrap"
                    >
                      <button
                        type="button"
                        className={`yanmar-maintenance-icon-btn${
                          ready ? " is-ready" : " is-warn"
                        }`}
                        aria-label={
                          ready
                            ? `${fluid.label} 교환 가능`
                            : `${fluid.label} 곧 만료`
                        }
                        aria-expanded={open}
                        onClick={() => {
                          setMaintenanceBubbleId((cur) =>
                            cur === fluid.id ? null : fluid.id,
                          );
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={MAINTENANCE_FLUID_ART[fluid.id]}
                          alt=""
                          draggable={false}
                        />
                      </button>
                      {open ? (
                        <div
                          className="yanmar-maintenance-bubble"
                          role="dialog"
                        >
                          <strong>{fluid.label}</strong>
                          <span>
                            {ready
                              ? "교환 가능"
                              : `곧 만료 · 남은 ${formatRemainingDuration(fluid.remainingMs)}`}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
            </div>
          </div>
        )}

        {mode === "tutorial" &&
        tutorialStep?.id === "dump" &&
        digFeedback.truckPresent ? (
          <DumpHintPanel
            bucketLoad={hud.bucketLoad}
            dumpBodyTouching={digFeedback.dumpBodyTouching}
            dumpFacingBed={digFeedback.dumpFacingBed}
            canDump={digFeedback.canDump}
            raiseArmForDump={digFeedback.raiseArmForDump}
            truckCooldownRemaining={digFeedback.truckCooldownRemaining}
            truckCanAccept={digFeedback.truckCanAccept}
            show
          />
        ) : null}

        {mode === "tutorial" && tutorialHasWaypoint && (
          <div className="absolute left-2 top-[12.25rem] z-20 rounded-lg bg-sky-600/85 px-2 py-1 text-[10px] font-semibold text-white">
            목표까지 {hud.goalDist}m
          </div>
        )}

        {mode !== "intro" &&
        (dumpScorePanel || couponDiscovery || gearDiscovery) &&
        typeof document !== "undefined"
          ? createPortal(
              <div
                className="pointer-events-none fixed left-1/2 top-1/2 z-[350] flex max-w-[calc(100%-1rem)] -translate-x-1/2 -translate-y-1/2 flex-row flex-wrap items-center justify-center gap-2.5"
                aria-live="polite"
              >
                <RewardPopupOverlay panel={dumpScorePanel} />
                <CouponDiscoveryOverlay discovery={couponDiscovery} />
                <GearDiscoveryOverlay discovery={gearDiscovery} />
              </div>,
              document.body,
            )
          : null}
        {mode !== "intro" && poseSaveToastVisible ? (
          <div key={poseSaveToastKey} className="yanmar-pose-save-toast" role="status">
            현재 자세가 저장되었습니다.
          </div>
        ) : null}
        {mode !== "intro" && attachmentWarning ? (
          <div
            key={attachmentWarning.key}
            className={`yanmar-attachment-warning-toast${
              attachmentWarning.enhanceCores || attachmentWarning.stars
                ? " yanmar-attachment-warning-toast--cores"
                : ""
            }`}
            role="status"
            aria-live="polite"
            aria-label={attachmentWarning.message}
          >
            {attachmentWarning.enhanceCores ? (
              <span className="yanmar-enhance-core-toast">
                <img
                  src="/images/yanmar/2d/enhance-core.png?v=3"
                  alt=""
                  width={28}
                  height={28}
                  className="yanmar-enhance-core-toast-img"
                  draggable={false}
                />
                <span className="yanmar-enhance-core-toast-amount tabular-nums">
                  +{attachmentWarning.enhanceCores}
                </span>
              </span>
            ) : attachmentWarning.stars ? (
              <span className="yanmar-enhance-core-toast">
                <img
                  src="/images/star-currency.svg"
                  alt=""
                  width={starRewardToastIconPx(attachmentWarning.stars)}
                  height={starRewardToastIconPx(attachmentWarning.stars)}
                  className="yanmar-enhance-core-toast-img"
                  style={{
                    width: starRewardToastIconPx(attachmentWarning.stars),
                    height: starRewardToastIconPx(attachmentWarning.stars),
                  }}
                  draggable={false}
                />
                <span
                  className="yanmar-enhance-core-toast-amount tabular-nums"
                  style={{
                    fontSize: `${starRewardToastFontRem(attachmentWarning.stars)}rem`,
                  }}
                >
                  +{attachmentWarning.stars}
                </span>
              </span>
            ) : (
              attachmentWarning.message
            )}
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
            const closed = unlockQueue[0];
            if (closed) {
              markPlayerUnlockSeen(unlockSeenOwnerRef.current, closed);
              if (closed === "MONUMENT") {
                warpToMonument();
                void fetch("/api/monument/yanmar/tutorial/done", {
                  method: "POST",
                });
                void loadMonumentState();
              }
              if (closed === "SPORTS_MEET") {
                warpToSportsMeetPortal();
              }
            }
            setUnlockQueue((queue) => queue.slice(1));
          }}
        />
        <SportsMeetModePanel
          open={showSportsMeetPanel}
          onClose={() => setShowSportsMeetPanel(false)}
          onEnter={(m) => void enterSportsMeet(m)}
          onOpenRankings={(week) => {
            setSportsMeetRankingsWeek(week);
            setShowSportsMeetRankings(true);
          }}
        />
        <SportsMeetRankingsPanel
          open={showSportsMeetRankings}
          week={sportsMeetRankingsWeek}
          onClose={() => setShowSportsMeetRankings(false)}
          onSwitchWeek={setSportsMeetRankingsWeek}
        />
        {sportsMeetRun?.phase === "finished" ? (
          <SportsMeetResultPanel
            open
            playMode={sportsMeetRun.playMode}
            patternName={sportsMeetRun.patternNameKo}
            finalTimeMs={sportsMeetRun.finalTimeMs}
            splits={(() => {
              let driveN = 0;
              return sportsMeetRun.splits.map((s) => {
                let label = STAGE_LABEL_KO[s.stage];
                if (s.stage === "drive") {
                  driveN += 1;
                  label = `주행 ${driveN}`;
                }
                return {
                  stage: s.stage,
                  clearTimeMs: s.clearTimeMs,
                  label,
                };
              });
            })()}
            submitted={
              sportsMeetRun.playMode === "practice" || sportsResultSubmitted
            }
            onRetryPractice={() => void enterSportsMeet("practice")}
            onExit={exitSportsMeet}
            onOpenRankings={() => {
              setSportsMeetRankingsWeek("current");
              setShowSportsMeetRankings(true);
            }}
          />
        ) : null}

        <YanmarGameSettingsMenu
          immersive={immersive}
          show={mode !== "intro"}
          open={showSettingsMenu}
          onOpenChange={setShowSettingsMenu}
          showMinimap={showMinimap}
          onToggleMinimap={() => setShowMinimap((v) => !v)}
          showMissionQuest={showMissionQuest}
          onToggleMissionQuest={() => setShowMissionQuest((v) => !v)}
          bgmEnabled={soundSettings.bgmEnabled}
          onToggleBgm={() => {
            const bgmEnabled = !soundSettings.bgmEnabled;
            updateSoundSettings({ bgmEnabled });
            if (bgmEnabled) yanmarAudio.unlock();
          }}
          bgmVolume={soundSettings.bgmVolume}
          onBgmVolumeChange={(bgmVolume) => {
            updateSoundSettings({ bgmVolume });
          }}
          sfxEnabled={soundSettings.sfxEnabled}
          onToggleSfx={() => {
            const sfxEnabled = !soundSettings.sfxEnabled;
            updateSoundSettings({ sfxEnabled });
            if (sfxEnabled) yanmarAudio.unlock();
          }}
          sfxVolume={soundSettings.sfxVolume}
          onSfxVolumeChange={(sfxVolume) => {
            updateSoundSettings({ sfxVolume });
          }}
          breakerSfxEnabled={soundSettings.breakerSfxEnabled}
          onToggleBreakerSfx={() => {
            updateSoundSettings({
              breakerSfxEnabled: !soundSettings.breakerSfxEnabled,
            });
          }}
          hornId={soundSettings.hornId}
          onHornIdChange={(hornId: HornId) => {
            updateSoundSettings({ hornId });
            yanmarAudio.unlock();
            yanmarAudio.playHorn(hornId);
          }}
          onResetPosition={resetExcavatorPosition}
          onShowGuide={onShowGuide}
          onShowRanking={onShowRanking}
          onSaveAndExit={onRequestExit}
          isAdmin={isAdmin}
          onBeforeOpenAdmin={() => {
            persistGameSession(true);
          }}
        />

        {tutorialFlash && (
          <div
            key={tutorialFlash.key}
            className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center"
          >
            <div
              className={`yanmar-tutorial-flash rounded-xl px-5 py-2.5 text-sm font-black text-white shadow-lg ${
                tutorialFlash.kind === "complete"
                  ? "bg-amber-500/95"
                  : "bg-emerald-500/95"
              }`}
            >
              ✓ {tutorialFlash.message}
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
              tutorialWaypointRef={tutorialWaypointRef}
              tutorialDumpRef={tutorialDumpRef}
              digFeedbackRef={digFeedbackRef}
              dumpTruckStateRef={dumpTruckStateRef}
              dumpTruckPoseRef={dumpTruckPoseRef}
              onProgress={handleProgress}
              onDumpScore={handleDumpScore}
              onCrashTileDestroyed={handleCrashTileDestroyed}
              onHillRockDelivered={handleHillRockDelivered}
              onAttachmentWarning={showAttachmentWarning}
              onDumpTruckFull={handleDumpTruckFull}
              onHaulTruckFull={handleHaulTruckFull}
              onSimTick={handleSimTick}
              cameraMode={cameraMode}
              lookOffsetRef={lookOffsetRef}
              endedRef={endedRef}
              activeChassisId={String(activeChassisId)}
              onSceneReady={handleSceneReady}
              worldPickupsRef={
                mode === "game" && session?.user?.id
                  ? worldPickupsRef
                  : undefined
              }
              worldPickupRevision={worldPickupRevision}
              onWorldPickup={handleWorldPickup}
              workshopClaimableIds={
                workshopQuestState
                  ? getClaimableWorkshopIds(workshopQuestState)
                  : []
              }
              monumentPhase={
                monumentPanelState?.phase ??
                monumentPhaseRef.current ??
                "locked"
              }
              monumentStarsStored={monumentPanelState?.starsStored ?? 0}
              monumentStorageCap={monumentStorageCap(
                monumentPanelState?.levels?.storage_cap ?? 0,
              )}
              sportsMeetPortalVisible={
                sportsMeetUnlocked &&
                mode !== "sportsRanked" &&
                mode !== "sportsPractice"
              }
              sportsMeetTicketRemaining={sportsMeetTicket.remaining}
              sportsMeetTicketLimit={sportsMeetTicket.limit}
              sportsMeetRunRef={sportsMeetRunRef}
              sportsMeetPickupRevision={sportsMeetPickupRevision}
              sportsArenaActive={
                mode === "sportsRanked" || mode === "sportsPractice"
              }
              sportsMeetPattern={
                sportsMeetRun
                  ? getSportsMeetPattern(sportsMeetRun.weekKey)
                  : null
              }
              sportsMeetGateOpen={
                !sportsMeetRun ||
                (sportsMeetRun.phase !== "ready" &&
                  sportsMeetRun.phase !== "countdown")
              }
            />
          </div>
        )}

        {mode !== "intro" && mode !== "gameReady" && (
          <div
            className="absolute inset-0 z-[5] touch-none"
            style={{
              pointerEvents:
                Math.abs(input.travel.left) > FREE_LOOK_TRAVEL_THRESHOLD ||
                Math.abs(input.travel.right) > FREE_LOOK_TRAVEL_THRESHOLD
                  ? "none"
                  : "auto",
            }}
            onPointerDown={onFreeLookPointerDown}
            onPointerMove={onFreeLookPointerMove}
            onPointerUp={onFreeLookPointerUp}
            onPointerCancel={onFreeLookPointerUp}
            aria-hidden
          />
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
            autoPoseLabels={autoPoseLabels}
            onSavePose={handleSavePose}
            onExecutePose={handleExecutePose}
            onSaveAutoPoseLabels={handleSaveAutoPoseLabels}
            savePoseDisabled={savePoseOnCooldown}
            executePoseDisabled={executePoseOnCooldown}
            allowed={allowed}
            tutorialStep={tutorialStep}
            showTouchZones={false}
            hornId={soundSettings.hornId}
            onHorn={handleHornQuest}
          />
        )}

        {mode === "intro" && initialPlayMode && (
          <div
            className="absolute inset-0 z-40 flex items-center justify-center"
            style={{ backgroundColor: "#8ec6e8" }}
          >
            <div className="text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-white/35 border-t-red-500" />
              <p className="text-xs font-bold text-slate-700/80">시뮬레이터 준비 중</p>
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
