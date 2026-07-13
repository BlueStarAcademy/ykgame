"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StarAmount } from "@/components/StarAmount";
import {
  YANMAR_EQUIPMENT_CONFIG,
  YANMAR_EQUIPMENT_RESET_REFUND_RATE,
  formatYanmarSuccessRate,
  getYanmarUpgradeCost,
  getYanmarUpgradeFailBonusGain,
  getYanmarUpgradePartStatLabel,
  getYanmarUpgradePartStatText,
  getYanmarUpgradePartStatValue,
  getYanmarUpgradePartGainText,
  getYanmarUpgradeSuccessRate,
  getYanmarPartResetRefundStars,
  type YanmarEquipmentFailBonuses,
  type YanmarEquipmentLevels,
  type YanmarEquipmentPart,
} from "./equipment";
import type { GameMode } from "./tutorial";
import {
  EXCAVATOR_BODY_PARTS,
  YANMAR_UPGRADE_ATTACHMENT_TABS,
  YANMAR_UPGRADE_VISUALS,
  getUpgradeAttachmentTab,
  type UpgradeAttachmentTab,
} from "./upgradeVisualConfig";
import {
  getAttachmentRequiredLevel,
  isUpgradeAttachmentTabUnlocked,
} from "@/lib/playerUnlocks";

interface EquipmentUpgradePanelProps {
  open: boolean;
  mode: GameMode;
  levels: YanmarEquipmentLevels;
  failBonuses: YanmarEquipmentFailBonuses;
  currency: number;
  previewStars: number;
  upgradingPart: YanmarEquipmentPart | null;
  resettingEquipment: boolean;
  playerLevel: number;
  unlockAllAttachments?: boolean;
  onClose: () => void;
  onUpgrade: (part: YanmarEquipmentPart) => void | Promise<boolean | null>;
  onResetEquipment: (part: YanmarEquipmentPart) => void;
}

const HOTSPOT_WRAPPER_SIZE = { width: "4.1rem", height: "3.75rem" };
const UPGRADE_BAR_DURATION_MS = 2000;
const UPGRADE_SUCCESS_TOAST_MS = 3000;

type PendingUpgrade = {
  part: YanmarEquipmentPart;
  toLevel: number;
};

type UpgradeSession = {
  part: YanmarEquipmentPart;
  toLevel: number;
  barDone: boolean;
  /** null = request error / cancelled, true/false = rolled result */
  attemptResult: boolean | null | undefined;
};

type UpgradeSuccess = {
  part: YanmarEquipmentPart;
  level: number;
};

type UpgradeFail = {
  part: YanmarEquipmentPart;
  toLevel: number;
  bonusGain: number;
};

function hotspotButtonClass(isSelected: boolean, partLevel: number, maxed: boolean) {
  if (isSelected) {
    return "border-amber-300 bg-red-600/72 text-white ring-2 ring-amber-300/80 yanmar-hotspot-pulse";
  }
  if (maxed) {
    return "border-amber-400 bg-slate-900/55 text-amber-100 ring-2 ring-amber-300/35 hover:bg-slate-900/65";
  }
  if (partLevel > 0) {
    return "border-amber-400/90 bg-slate-900/50 text-amber-50 ring-2 ring-amber-200/30 hover:bg-slate-900/62";
  }
  return "border-white/85 bg-black/42 text-white ring-2 ring-white/25 hover:border-amber-200 hover:bg-black/55 hover:ring-amber-200/40";
}

function LevelMarker({
  level,
  maxed,
  bump,
}: {
  level: number;
  maxed: boolean;
  bump: boolean;
}) {
  return (
    <span
      key={bump ? `bump-${level}` : `level-${level}`}
      className={`pointer-events-none absolute -right-1.5 -top-1.5 z-10 flex h-[1.2rem] min-w-[1.2rem] items-center justify-center rounded-full border-2 px-1 text-[10px] font-black leading-none shadow-md ${
        maxed
          ? "border-amber-200 bg-amber-400 text-slate-900"
          : level > 0
            ? "border-amber-100 bg-red-600 text-white"
            : "border-white/80 bg-slate-800 text-white/85"
      } ${bump ? "yanmar-upgrade-level-bump" : ""}`}
    >
      +{level}
    </span>
  );
}

function UpgradePartButton({
  part,
  label,
  level,
  maxLevel,
  isSelected,
  levelBump,
  onClick,
  ariaLabel,
}: {
  part: YanmarEquipmentPart;
  label: string;
  level: number;
  maxLevel: number;
  isSelected: boolean;
  levelBump: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  const maxed = level >= maxLevel;
  const statText = getYanmarUpgradePartStatText(part, level);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={isSelected}
      className={`relative box-border flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg border-2 px-2 py-1.5 text-center font-black shadow-lg transition-[background-color,border-color,box-shadow] ${hotspotButtonClass(
        isSelected,
        level,
        maxed,
      )} ${levelBump ? "yanmar-upgrade-part-flash" : ""}`}
    >
      <LevelMarker level={level} maxed={maxed} bump={levelBump} />
      <span
        className={`pointer-events-none absolute -inset-1 rounded-[0.85rem] border border-dashed ${
          isSelected ? "border-transparent" : "border-white/20"
        }`}
        aria-hidden
      />
      <span className="text-[11px] leading-tight">{label}</span>
      <span className="text-[9px] font-bold leading-tight text-amber-100/95">{statText}</span>
    </button>
  );
}

function UpgradeStatCompare({
  part,
  level,
  maxed,
}: {
  part: YanmarEquipmentPart;
  level: number;
  maxed: boolean;
}) {
  const statLabel = getYanmarUpgradePartStatLabel(part);
  const currentValue = getYanmarUpgradePartStatValue(part, level);
  const nextValue = maxed ? null : getYanmarUpgradePartStatValue(part, level + 1);
  const gainText = maxed ? "" : getYanmarUpgradePartGainText(part, level);

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-[11px]">
      <span className="font-bold text-slate-600">{statLabel} </span>
      <span className="font-black text-amber-700">{currentValue}</span>
      {nextValue != null ? (
        <>
          <span className="mx-1.5 font-bold text-slate-400">→</span>
          <span className="font-black text-red-600">
            {nextValue}
            <span className="text-red-500">{gainText}</span>
          </span>
        </>
      ) : null}
    </div>
  );
}

function UpgradeProgressBar({ barKey }: { barKey: number }) {
  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden>
      <div
        key={barKey}
        className="yanmar-upgrade-bar-deplete h-full w-full rounded-full bg-gradient-to-r from-red-600 via-red-500 to-amber-400"
      />
    </div>
  );
}

function UpgradeSuccessToast({
  part,
  level,
  toastKey,
}: {
  part: YanmarEquipmentPart;
  level: number;
  toastKey: number;
}) {
  const label = YANMAR_EQUIPMENT_CONFIG[part].label;

  return (
    <div className="pointer-events-none absolute inset-0 z-[90] flex items-center justify-center px-6">
      <div
        key={toastKey}
        className="yanmar-upgrade-success-toast max-w-[min(20rem,92%)] rounded-2xl border-2 border-amber-300/75 bg-gradient-to-br from-slate-900/95 to-slate-800/95 px-5 py-4 text-center shadow-2xl backdrop-blur-sm"
      >
        <p className="text-base font-black leading-snug text-amber-50 sm:text-lg">
          강화 성공!{" "}
          <span className="text-white">({label})</span>{" "}
          <span className="text-red-400">+{level}</span> 강화
        </p>
      </div>
    </div>
  );
}

function UpgradeFailToast({
  part,
  toLevel,
  bonusGain,
  toastKey,
}: {
  part: YanmarEquipmentPart;
  toLevel: number;
  bonusGain: number;
  toastKey: number;
}) {
  const label = YANMAR_EQUIPMENT_CONFIG[part].label;

  return (
    <div className="pointer-events-none absolute inset-0 z-[90] flex items-center justify-center px-6">
      <div
        key={toastKey}
        className="yanmar-upgrade-success-toast max-w-[min(20rem,92%)] rounded-2xl border-2 border-slate-400/70 bg-gradient-to-br from-slate-900/95 to-slate-800/95 px-5 py-4 text-center shadow-2xl backdrop-blur-sm"
      >
        <p className="text-base font-black leading-snug text-slate-100 sm:text-lg">
          강화 실패{" "}
          <span className="text-white">({label} +{toLevel})</span>
        </p>
        {bonusGain > 0 ? (
          <p className="mt-1 text-[11px] font-bold text-sky-200">
            다음 시도 성공률 +{formatYanmarSuccessRate(bonusGain)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function EquipmentUpgradePanel({
  open,
  mode,
  levels,
  failBonuses,
  currency,
  previewStars,
  upgradingPart,
  resettingEquipment,
  playerLevel,
  unlockAllAttachments = false,
  onClose,
  onUpgrade,
  onResetEquipment,
}: EquipmentUpgradePanelProps) {
  const [selected, setSelected] = useState<YanmarEquipmentPart>("BOOM");
  const [attachmentTab, setAttachmentTab] = useState<UpgradeAttachmentTab>("bucket");
  const [pendingUpgrade, setPendingUpgrade] = useState<PendingUpgrade | null>(null);
  const [upgradeBarKey, setUpgradeBarKey] = useState(0);
  const [activeUpgradeBarPart, setActiveUpgradeBarPart] =
    useState<YanmarEquipmentPart | null>(null);
  const [bumpPart, setBumpPart] = useState<YanmarEquipmentPart | null>(null);
  const [upgradeSuccess, setUpgradeSuccess] = useState<UpgradeSuccess | null>(null);
  const [upgradeFail, setUpgradeFail] = useState<UpgradeFail | null>(null);
  const [successToastKey, setSuccessToastKey] = useState(0);
  const [displayLevels, setDisplayLevels] = useState(levels);
  const [displayFailBonuses, setDisplayFailBonuses] = useState(failBonuses);
  const barTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const upgradeSessionRef = useRef<UpgradeSession | null>(null);
  const levelsRef = useRef(levels);
  const failBonusesRef = useRef(failBonuses);

  const activeAttachment = getUpgradeAttachmentTab(attachmentTab);
  const showHaulTruckPanel = attachmentTab === "grapple";
  const truckUpgrades = showHaulTruckPanel
    ? YANMAR_UPGRADE_VISUALS.haulTruckUpgrades
    : YANMAR_UPGRADE_VISUALS.dumpTruckUpgrades;
  const truckDiagram = showHaulTruckPanel
    ? YANMAR_UPGRADE_VISUALS.haulTruckDiagram
    : YANMAR_UPGRADE_VISUALS.dumpTruckDiagram;
  const truckPanelTitle = showHaulTruckPanel ? "돌트럭 강화" : "덤프트럭 강화";
  const truckPanelAlt = showHaulTruckPanel ? "돌트럭" : "덤프트럭";
  const attachmentSpot = YANMAR_UPGRADE_VISUALS.excavatorHotspots.ATTACHMENT;

  const clearUpgradeTimers = useCallback(() => {
    if (barTimerRef.current) {
      clearTimeout(barTimerRef.current);
      barTimerRef.current = null;
    }
    if (bumpTimerRef.current) {
      clearTimeout(bumpTimerRef.current);
      bumpTimerRef.current = null;
    }
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
    if (failTimerRef.current) {
      clearTimeout(failTimerRef.current);
      failTimerRef.current = null;
    }
  }, []);

  const tryShowUpgradeSuccess = useCallback(() => {
    const session = upgradeSessionRef.current;
    if (!session?.barDone) return;
    if (session.attemptResult === undefined) return;

    // 게이지 종료 + 결과 확정 후에야 UI 수치/정보 반영
    setDisplayLevels(levelsRef.current);
    setDisplayFailBonuses(failBonusesRef.current);
    setPendingUpgrade(null);

    if (session.attemptResult === true) {
      setUpgradeFail(null);
      setUpgradeSuccess({ part: session.part, level: session.toLevel });
      setSuccessToastKey((key) => key + 1);
      setBumpPart(session.part);
      if (bumpTimerRef.current) clearTimeout(bumpTimerRef.current);
      bumpTimerRef.current = setTimeout(() => {
        setBumpPart(null);
        bumpTimerRef.current = null;
      }, 700);
      upgradeSessionRef.current = null;
      return;
    }

    if (session.attemptResult === false) {
      setUpgradeSuccess(null);
      setUpgradeFail({
        part: session.part,
        toLevel: session.toLevel,
        bonusGain: getYanmarUpgradeFailBonusGain(session.toLevel),
      });
      setSuccessToastKey((key) => key + 1);
      upgradeSessionRef.current = null;
      return;
    }

    // request error — no toast
    upgradeSessionRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearUpgradeTimers();
    };
  }, [clearUpgradeTimers]);

  useEffect(() => {
    levelsRef.current = levels;
  }, [levels]);

  useEffect(() => {
    failBonusesRef.current = failBonuses;
  }, [failBonuses]);

  useEffect(() => {
    if (
      pendingUpgrade != null ||
      activeUpgradeBarPart != null ||
      upgradeSuccess != null ||
      upgradeFail != null
    ) {
      return;
    }
    setDisplayLevels(levels);
    setDisplayFailBonuses(failBonuses);
  }, [
    levels,
    failBonuses,
    pendingUpgrade,
    activeUpgradeBarPart,
    upgradeSuccess,
    upgradeFail,
  ]);

  useEffect(() => {
    tryShowUpgradeSuccess();
  }, [levels, failBonuses, upgradingPart, activeUpgradeBarPart, tryShowUpgradeSuccess]);

  useEffect(() => {
    if (!open) return;
    if (
      isUpgradeAttachmentTabUnlocked(attachmentTab, playerLevel, {
        unlockAll: unlockAllAttachments,
      })
    ) {
      return;
    }
    const bucket = getUpgradeAttachmentTab("bucket");
    setAttachmentTab("bucket");
    setSelected(bucket.part);
  }, [open, attachmentTab, playerLevel, unlockAllAttachments]);

  useEffect(() => {
    if (!upgradeSuccess) return;

    successTimerRef.current = setTimeout(() => {
      setUpgradeSuccess(null);
      successTimerRef.current = null;
    }, UPGRADE_SUCCESS_TOAST_MS);

    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
        successTimerRef.current = null;
      }
    };
  }, [upgradeSuccess, successToastKey]);

  useEffect(() => {
    if (!upgradeFail) return;

    failTimerRef.current = setTimeout(() => {
      setUpgradeFail(null);
      failTimerRef.current = null;
    }, UPGRADE_SUCCESS_TOAST_MS);

    return () => {
      if (failTimerRef.current) {
        clearTimeout(failTimerRef.current);
        failTimerRef.current = null;
      }
    };
  }, [upgradeFail, successToastKey]);

  const handleAttachmentTabChange = useCallback(
    (tab: UpgradeAttachmentTab) => {
      if (
        !isUpgradeAttachmentTabUnlocked(tab, playerLevel, {
          unlockAll: unlockAllAttachments,
        })
      ) {
        return;
      }
      const next = getUpgradeAttachmentTab(tab);
      setAttachmentTab(tab);
      setSelected(next.part);
    },
    [playerLevel, unlockAllAttachments],
  );

  const handleUpgradeClick = useCallback(() => {
    const part = selected;
    const currentLevel = displayLevels[part];
    const config = YANMAR_EQUIPMENT_CONFIG[part];
    if (currentLevel >= config.maxLevel || pendingUpgrade || activeUpgradeBarPart) return;

    const toLevel = currentLevel + 1;
    clearUpgradeTimers();

    setPendingUpgrade({ part, toLevel });
    setUpgradeBarKey((key) => key + 1);
    setActiveUpgradeBarPart(part);
    setBumpPart(null);
    setUpgradeSuccess(null);
    setUpgradeFail(null);
    upgradeSessionRef.current = { part, toLevel, barDone: false, attemptResult: undefined };

    const result = onUpgrade(part);
    void Promise.resolve(result).then((attemptResult) => {
      if (upgradeSessionRef.current?.part === part) {
        upgradeSessionRef.current.attemptResult =
          typeof attemptResult === "boolean" ? attemptResult : null;
      }
      tryShowUpgradeSuccess();
    });

    barTimerRef.current = setTimeout(() => {
      if (upgradeSessionRef.current) {
        upgradeSessionRef.current.barDone = true;
      }
      setActiveUpgradeBarPart(null);
      barTimerRef.current = null;
      tryShowUpgradeSuccess();
    }, UPGRADE_BAR_DURATION_MS);
  }, [
    selected,
    displayLevels,
    pendingUpgrade,
    activeUpgradeBarPart,
    onUpgrade,
    clearUpgradeTimers,
    tryShowUpgradeSuccess,
  ]);

  const handleResetClick = useCallback(() => {
    onResetEquipment(selected);
  }, [onResetEquipment, selected]);

  if (!open) return null;

  const previewMode = mode !== "game";
  const practiceMode = mode === "practice";
  const balance = previewMode ? previewStars : currency;
  const config = YANMAR_EQUIPMENT_CONFIG[selected];
  const level = displayLevels[selected];
  const nextLevel = level + 1;
  const cost = getYanmarUpgradeCost(selected, nextLevel);
  const maxed = level >= config.maxLevel;
  const isUpgradingSelected =
    pendingUpgrade?.part === selected ||
    upgradingPart === selected ||
    activeUpgradeBarPart === selected;
  const upgradeDisabled =
    isUpgradingSelected ||
    maxed ||
    (!previewMode && balance < getYanmarUpgradeCost(selected, displayLevels[selected] + 1));
  const resetDisabled =
    displayLevels[selected] <= 0 ||
    resettingEquipment ||
    isUpgradingSelected;
  const resetRefundStars = getYanmarPartResetRefundStars(selected, displayLevels[selected]);
  const refundRateLabel = `${Math.round(YANMAR_EQUIPMENT_RESET_REFUND_RATE * 100)}%`;
  const attachmentPartLevel = displayLevels[activeAttachment.part];
  const attachmentPartConfig = YANMAR_EQUIPMENT_CONFIG[activeAttachment.part];
  const failBonus = displayFailBonuses[selected] ?? 0;
  const baseSuccessRate =
    level >= config.maxLevel ? 1 : getYanmarUpgradeSuccessRate(level + 1, 0);

  return (
    <div className="absolute inset-0 z-[80] flex flex-col bg-black/65 backdrop-blur-sm">
      {upgradeSuccess ? (
        <UpgradeSuccessToast
          part={upgradeSuccess.part}
          level={upgradeSuccess.level}
          toastKey={successToastKey}
        />
      ) : null}
      {upgradeFail ? (
        <UpgradeFailToast
          part={upgradeFail.part}
          toLevel={upgradeFail.toLevel}
          bonusGain={upgradeFail.bonusGain}
          toastKey={successToastKey}
        />
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-2 bg-gradient-to-br from-slate-800 to-slate-950 px-4 py-3 text-white">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-200">
              Yanmar Parts
            </p>
            <h2 className="text-base font-black">장비강화</h2>
            {practiceMode ? (
              <p className="mt-0.5 text-[10px] text-white/65">연습모드 · 재화 변동 없음</p>
            ) : previewMode ? (
              <p className="mt-0.5 text-[10px] text-white/65">튜토리얼 임시 강화</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-bold hover:bg-white/25"
          >
            닫기
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 [-webkit-overflow-scrolling:touch]">
          <div className="relative mb-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 pb-[5.35rem]">
            <img
              key={activeAttachment.id}
              src={activeAttachment.diagram}
              alt={`${activeAttachment.label} 장착 굴착기`}
              className="block w-full object-contain"
              draggable={false}
            />

            <div className="absolute left-2 top-2 z-30 flex gap-1">
              {YANMAR_UPGRADE_ATTACHMENT_TABS.map((tab) => {
                const active = attachmentTab === tab.id;
                const unlocked = isUpgradeAttachmentTabUnlocked(
                  tab.id,
                  playerLevel,
                  { unlockAll: unlockAllAttachments },
                );
                const requiredLevel =
                  tab.id === "bucket" ? 1 : getAttachmentRequiredLevel(tab.id);
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleAttachmentTabChange(tab.id)}
                    disabled={!unlocked}
                    aria-pressed={active}
                    aria-disabled={!unlocked}
                    title={
                      unlocked
                        ? undefined
                        : `유저 레벨 ${requiredLevel}에 개방됩니다`
                    }
                    className={`rounded-md border px-2 py-1 text-[10px] font-black shadow-md transition ${
                      !unlocked
                        ? "cursor-not-allowed border-white/20 bg-slate-950/45 text-white/35"
                        : active
                          ? "border-amber-300 bg-red-600 text-white"
                          : "border-white/70 bg-slate-950/70 text-white/90 hover:border-amber-200 hover:bg-slate-900/80"
                    }`}
                  >
                    {tab.label}
                    {!unlocked ? (
                      <span className="ml-1 font-bold opacity-80">Lv.{requiredLevel}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {EXCAVATOR_BODY_PARTS.map((part) => {
              const spot = YANMAR_UPGRADE_VISUALS.excavatorHotspots[part];
              const partLevel = displayLevels[part];
              const partConfig = YANMAR_EQUIPMENT_CONFIG[part];
              const isSelected = selected === part;
              return (
                <div
                  key={part}
                  className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${spot.x * 100}%`,
                    top: `${spot.y * 100}%`,
                    width: HOTSPOT_WRAPPER_SIZE.width,
                    height: HOTSPOT_WRAPPER_SIZE.height,
                  }}
                >
                  <UpgradePartButton
                    part={part}
                    label={spot.label}
                    level={partLevel}
                    maxLevel={partConfig.maxLevel}
                    isSelected={isSelected}
                    levelBump={bumpPart === part}
                    onClick={() => setSelected(part)}
                    ariaLabel={`${spot.label} 강화 +${partLevel}`}
                  />
                </div>
              );
            })}

            <div
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${attachmentSpot.x * 100}%`,
                top: `${attachmentSpot.y * 100}%`,
                width: HOTSPOT_WRAPPER_SIZE.width,
                height: HOTSPOT_WRAPPER_SIZE.height,
              }}
            >
              <UpgradePartButton
                part={activeAttachment.part}
                label={activeAttachment.label}
                level={attachmentPartLevel}
                maxLevel={attachmentPartConfig.maxLevel}
                isSelected={selected === activeAttachment.part}
                levelBump={bumpPart === activeAttachment.part}
                onClick={() => setSelected(activeAttachment.part)}
                ariaLabel={`${activeAttachment.label} 강화 +${attachmentPartLevel}`}
              />
            </div>

            <div className="absolute inset-x-0 bottom-0 z-10 border-t border-white/15 bg-gradient-to-t from-slate-950/92 via-slate-900/88 to-slate-900/55 px-2.5 pb-2.5 pt-2">
              <div className="flex items-stretch gap-2">
                <div className="flex w-[4.75rem] shrink-0 flex-col items-center gap-1">
                  <img
                    src={truckDiagram}
                    alt={truckPanelAlt}
                    className="h-[4.25rem] w-full object-contain object-left drop-shadow-xl"
                    draggable={false}
                  />
                  <p className="text-center text-[9px] font-bold leading-tight tracking-wide text-amber-200/90">
                    {truckPanelTitle}
                  </p>
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-2 self-center">
                  {truckUpgrades.map(({ part, label }) => {
                    const partLevel = displayLevels[part];
                    const partConfig = YANMAR_EQUIPMENT_CONFIG[part];
                    return (
                      <div
                        key={part}
                        className="min-w-0 flex-1"
                        style={{
                          height: HOTSPOT_WRAPPER_SIZE.height,
                        }}
                      >
                        <UpgradePartButton
                          part={part}
                          label={label}
                          level={partLevel}
                          maxLevel={partConfig.maxLevel}
                          isSelected={selected === part}
                          levelBump={bumpPart === part}
                          onClick={() => setSelected(part)}
                          ariaLabel={`${label} 강화 +${partLevel}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-sm font-black text-gray-900">
              {config.label} 강화{" "}
              <span
                className={
                  maxed ? "text-amber-500" : level > 0 ? "text-red-600" : "text-slate-400"
                }
              >
                +{level}
              </span>{" "}
              <span className="text-xs font-bold text-slate-400">
                (최대 +{config.maxLevel})
              </span>
            </p>
            <UpgradeStatCompare part={selected} level={level} maxed={maxed} />
            {!maxed ? (
              <div className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-center text-[11px]">
                <p className="font-black text-sky-900">
                  성공률 {formatYanmarSuccessRate(baseSuccessRate)}
                  {failBonus > 0
                    ? `(+${formatYanmarSuccessRate(failBonus)})`
                    : ""}
                </p>
              </div>
            ) : null}
            {!practiceMode ? (
              <p className="mt-3 text-center text-[10px] font-semibold text-slate-500">
                초기화 시 사용한 스타의 {refundRateLabel}가 환급됩니다.
              </p>
            ) : null}
            <div className={`${practiceMode ? "mt-3" : "mt-2"} grid grid-cols-2 gap-2`}>
              <button
                type="button"
                onClick={handleUpgradeClick}
                disabled={upgradeDisabled}
                className="inline-flex min-w-0 items-center justify-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:bg-gray-300"
              >
                {maxed ? (
                  "최대 강화"
                ) : isUpgradingSelected ? (
                  "강화중..."
                ) : practiceMode ? (
                  "강화"
                ) : previewMode ? (
                  "체험 강화"
                ) : (
                  <>
                    <StarAmount value={cost} size={14} valueClassName="text-white" /> 강화
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleResetClick}
                disabled={resetDisabled}
                className="inline-flex min-w-0 flex-col items-center justify-center rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:bg-gray-300"
                aria-label={`${config.label} 강화 초기화`}
              >
                {resettingEquipment ? (
                  "초기화중"
                ) : practiceMode ? (
                  "초기화"
                ) : displayLevels[selected] > 0 ? (
                  <>
                    <span>초기화</span>
                    <span className="mt-0.5 inline-flex items-center">
                      <StarAmount
                        value={resetRefundStars}
                        size={12}
                        valueClassName="text-[11px] font-bold text-white"
                      />
                    </span>
                  </>
                ) : (
                  "초기화"
                )}
              </button>
            </div>
            {activeUpgradeBarPart === selected ? (
              <UpgradeProgressBar barKey={upgradeBarKey} />
            ) : null}
            {!previewMode && !maxed && balance < getYanmarUpgradeCost(selected, displayLevels[selected] + 1) ? (
              <p className="mt-1 text-center text-[10px] text-red-500">스타가 부족합니다.</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
