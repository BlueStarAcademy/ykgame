"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import { StarAmount } from "@/components/StarAmount";
import {
  EQUIP_LEVEL_BY_GRADE,
  GEAR_INVENTORY_BASE,
  GEAR_INVENTORY_EXPAND_STEP,
  GEAR_SLOTS,
  GEAR_SLOT_LABEL,
  ITEM_GRADE_LABEL,
  MAIN_OPTION_BY_SLOT,
  SELL_STARS_BY_GRADE,
  SUB_OPTION_POOL,
  SYNTH_NEXT_GRADE,
  SYNTH_UPGRADE_CHANCE,
  canEquipGearAtLevel,
  getGearInventoryExpandCost,
  type GearSlot,
  type ItemGrade,
  type MasterOptionKey,
} from "./gearCatalog";
import {
  getEnhanceCost,
  getEnhanceCoreCost,
  getEnhanceSuccessRate,
  getMilestonePreview,
  getDismantleEnhanceCores,
  previewMainAtLevel,
  canonicalizeMainOption,
  canonicalizeSubOptions,
} from "./gearGenerate";
import { GearIconCell } from "./GearIconCell";
import {
  equippedBySlot,
  formatChassisStatLines,
  formatDerivedStatLines,
} from "./gearSummary";
import { type ChassisModelId } from "./chassisCatalog";
import { calculateFinalYanmarStats } from "./gearStats";
import type { YanmarEquipmentStats } from "./equipment";
import { yanmarAudio } from "./yanmarAudio";

export interface GearPanelItem {
  id: string;
  slot: GearSlot;
  slotLabel: string;
  grade: ItemGrade;
  gradeLabel: string;
  enhanceLevel: number;
  failBonus: number;
  mainOption: { key: string; value: number };
  mainLabel?: string;
  subOptions: {
    key: string;
    tier: number;
    value: number;
    rollMin: number;
    rollMax: number;
    isPercent?: boolean;
  }[];
  masterOption: {
    key: string;
    value: number;
    label: string;
    hideValue: boolean;
    isPercent: boolean;
  } | null;
  nameSnapshot: string;
  durability: number;
  durabilityMax: number;
  equippedSlot: GearSlot | null;
}

export type EnhanceActionResult = {
  success?: boolean;
  before?: {
    enhanceLevel: number;
    failBonus: number;
    mainOption: { key: string; value: number };
    subOptions: {
      key: string;
      tier: number;
      value: number;
      rollMin?: number;
      rollMax?: number;
      isPercent?: boolean;
    }[];
  };
  after?: {
    enhanceLevel: number;
    failBonus: number;
    mainOption: { key: string; value: number };
    subOptions: {
      key: string;
      tier: number;
      value: number;
      rollMin?: number;
      rollMax?: number;
      isPercent?: boolean;
    }[];
  };
  failBonusAdd?: number;
  nextSuccessRate?: number;
  successRate?: number;
};

export type DismantleActionResult = {
  cores: number;
};

export type SellActionResult = {
  stars: number;
};

export type SynthesizeActionResult = {
  item: GearPanelItem;
  resultGrade: ItemGrade;
  inputGrade: ItemGrade;
  upgraded: boolean;
};

interface GearPanelProps {
  open: boolean;
  onClose: () => void;
  items: GearPanelItem[];
  currency: number;
  enhanceCores?: number;
  inventorySlots?: number;
  expandCost?: number | null;
  busy?: boolean;
  embedded?: boolean;
  playerLevel?: number;
  activeChassisId?: ChassisModelId | string;
  equipmentStats?: YanmarEquipmentStats | null;
  onEquip: (itemId: string) => void | Promise<void>;
  onUnequip: (itemId: string) => void | Promise<void>;
  onEnhance: (
    itemId: string,
  ) => Promise<EnhanceActionResult | null | void> | EnhanceActionResult | null | void;
  onDismantle: (
    itemId: string,
  ) =>
    | Promise<DismantleActionResult | null | void>
    | DismantleActionResult
    | null
    | void;
  onSell: (
    itemId: string,
  ) => Promise<SellActionResult | null | void> | SellActionResult | null | void;
  onSynthesize: (
    itemIds: [string, string, string],
  ) =>
    | Promise<SynthesizeActionResult | null | void>
    | SynthesizeActionResult
    | null
    | void;
  onExpandInventory?: () => void | Promise<void>;
}

type BubbleState =
  | { kind: "equipped"; itemId: string; slot: GearSlot }
  | { kind: "compare"; itemId: string; slot: GearSlot }
  | null;

/** 장착 2×3 그리드: 왼(버켓/브레이커/집게) · 오른(암/붐/트랙) */
const GEAR_EQUIP_GRID_ORDER: readonly GearSlot[] = [
  "BUCKET",
  "ARM",
  "BREAKER",
  "BOOM",
  "GRAPPLE",
  "TRACK",
];

function gradeTextClass(grade: ItemGrade) {
  switch (grade) {
    case "NORMAL":
      return "yanmar-gear-grade-text--normal";
    case "ENHANCED":
      return "yanmar-gear-grade-text--enhanced";
    case "PRECISION":
      return "yanmar-gear-grade-text--precision";
    case "MASTER":
      return "yanmar-gear-grade-text--master";
    default:
      return "";
  }
}

function EquipLevelText({
  grade,
  playerLevel,
}: {
  grade: ItemGrade;
  playerLevel: number;
}) {
  const required = EQUIP_LEVEL_BY_GRADE[grade];
  const locked = !canEquipGearAtLevel(grade, playerLevel);
  return (
    <span
      className={`yanmar-gear-equip-level${locked ? " is-locked" : ""}`}
    >
      레벨제한 {required}
    </span>
  );
}

function formatMain(item: GearPanelItem) {
  const def = MAIN_OPTION_BY_SLOT[item.slot];
  const label = item.mainLabel ?? def.label;
  const unit = def.isPercent ? "%" : "";
  return `${label} +${Math.round(item.mainOption.value)}${unit}`;
}

function formatSub(sub: GearPanelItem["subOptions"][number]) {
  const def = SUB_OPTION_POOL.find((s) => s.key === sub.key);
  const label = def?.label ?? sub.key;
  const unit = sub.isPercent ? "%" : "";
  return {
    text: `${label} +${Math.round(sub.value)}${unit}`,
    range: `[${Math.round(sub.rollMin)}~${Math.round(sub.rollMax)}] (T${sub.tier})`,
  };
}

function compareDelta(a: number, b: number) {
  const d = Math.round(b) - Math.round(a);
  if (d === 0) return null;
  return d > 0 ? `+${d}` : `${d}`;
}

function GearBubbleCard({
  title,
  item,
  emptyLabel,
  compareAgainst,
  footer,
  equipAction,
  highlight,
  playerLevel = 1,
  onZoom,
}: {
  title: string;
  item: GearPanelItem | null;
  emptyLabel?: string;
  compareAgainst?: GearPanelItem | null;
  footer?: ReactNode;
  equipAction?: ReactNode;
  highlight?: boolean;
  playerLevel?: number;
  onZoom?: (item: GearPanelItem) => void;
}) {
  if (!item) {
    return (
      <div className="yanmar-gear-bubble-card is-empty">
        <div className="yanmar-gear-bubble-card-head">
          <p className="yanmar-gear-bubble-card-title">{title}</p>
        </div>
        <p className="yanmar-gear-muted">{emptyLabel ?? "비어 있음"}</p>
      </div>
    );
  }

  const mainDelta =
    compareAgainst && compareAgainst.id !== item.id
      ? compareDelta(compareAgainst.mainOption.value, item.mainOption.value)
      : null;

  return (
    <div
      className={`yanmar-gear-bubble-card${highlight ? " is-highlight" : ""}${
        item.grade === "MASTER" ? " is-master" : ""
      }${item.grade === "PRECISION" ? " is-precision" : ""}`}
    >
      <div className="yanmar-gear-bubble-card-head">
        <p className="yanmar-gear-bubble-card-title">{title}</p>
        <div className="yanmar-gear-bubble-card-head-trail">
          <span className={`yanmar-gear-bubble-grade ${gradeTextClass(item.grade)}`}>
            {ITEM_GRADE_LABEL[item.grade]}
          </span>
          {onZoom ? (
            <button
              type="button"
              className="yanmar-gear-zoom-btn"
              onClick={() => onZoom(item)}
            >
              크게보기
            </button>
          ) : null}
        </div>
      </div>
      <div className="yanmar-gear-mgr-detail">
        <GearIconCell
          slot={item.slot}
          grade={item.grade}
          enhanceLevel={item.enhanceLevel}
          size="md"
          equipped={!!item.equippedSlot}
        />
        <div className="yanmar-gear-mgr-detail-meta">
          <p className={`yanmar-gear-mgr-name ${gradeTextClass(item.grade)}`}>
            {item.nameSnapshot}
            {item.enhanceLevel > 0 ? ` +${item.enhanceLevel}` : ""}
          </p>
          <p className="yanmar-gear-mgr-grade">
            {GEAR_SLOT_LABEL[item.slot]}
            {" · "}
            <EquipLevelText grade={item.grade} playerLevel={playerLevel} />
            {item.equippedSlot ? " · 장착중" : ""}
          </p>
          <p className="yanmar-gear-mgr-main">
            <span className="yanmar-gear-mgr-attr-main">{formatMain(item)}</span>
            {mainDelta ? (
              <span
                className={
                  mainDelta.startsWith("+")
                    ? "yanmar-gear-delta-up"
                    : "yanmar-gear-delta-down"
                }
              >
                {mainDelta}
              </span>
            ) : null}
          </p>
        </div>
        {equipAction ? (
          <div className="yanmar-gear-mgr-detail-equip">{equipAction}</div>
        ) : null}
      </div>
      <ul className="yanmar-gear-mgr-attr-list">
        {item.subOptions.map((sub) => {
          const row = formatSub(sub);
          return (
            <li key={`${sub.key}-${sub.tier}-${sub.value}`}>
              <span>{row.text}</span>
              <span className="yanmar-gear-muted">{row.range}</span>
            </li>
          );
        })}
        {item.masterOption ? (
          <li className="is-master-opt">
            <span>
              마스터 {item.masterOption.label}
              {!item.masterOption.hideValue
                ? ` ${item.masterOption.value}${
                    item.masterOption.isPercent ? "%" : ""
                  }`
                : ""}
            </span>
          </li>
        ) : null}
      </ul>
      {footer}
    </div>
  );
}

export function GearPanel({
  open,
  onClose,
  items,
  currency,
  enhanceCores = 0,
  inventorySlots = GEAR_INVENTORY_BASE,
  expandCost = getGearInventoryExpandCost(GEAR_INVENTORY_BASE),
  busy,
  embedded,
  playerLevel = 1,
  activeChassisId = "ViO17_1",
  equipmentStats: _equipmentStats = null,
  onEquip,
  onUnequip,
  onEnhance,
  onDismantle,
  onSell,
  onSynthesize,
  onExpandInventory,
}: GearPanelProps) {
  const [slotFilters, setSlotFilters] = useState<Record<GearSlot, boolean>>(
    () => Object.fromEntries(GEAR_SLOTS.map((s) => [s, true])) as Record<
      GearSlot,
      boolean
    >,
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [bubble, setBubble] = useState<BubbleState>(null);
  const [enhanceItemId, setEnhanceItemId] = useState<string | null>(null);
  const [enhancePhase, setEnhancePhase] = useState<
    "idle" | "progress" | "result"
  >("idle");
  const [enhanceProgress, setEnhanceProgress] = useState(0);
  const [enhanceResult, setEnhanceResult] =
    useState<EnhanceActionResult | null>(null);
  const [pendingDismantleId, setPendingDismantleId] = useState<string | null>(
    null,
  );
  const [dismantleResult, setDismantleResult] = useState<{
    nameSnapshot: string;
    slot: GearSlot;
    grade: ItemGrade;
    enhanceLevel: number;
    cores: number;
  } | null>(null);
  const [pendingSellId, setPendingSellId] = useState<string | null>(null);
  const [sellResult, setSellResult] = useState<{
    nameSnapshot: string;
    slot: GearSlot;
    grade: ItemGrade;
    enhanceLevel: number;
    stars: number;
  } | null>(null);
  const [synthOpen, setSynthOpen] = useState(false);
  const [synthGrade, setSynthGrade] = useState<ItemGrade | null>(null);
  const [synthSlots, setSynthSlots] = useState<[string | null, string | null, string | null]>([
    null,
    null,
    null,
  ]);
  const [synthResult, setSynthResult] = useState<SynthesizeActionResult | null>(
    null,
  );
  const [synthFocusId, setSynthFocusId] = useState<string | null>(null);
  const [artPreview, setArtPreview] = useState<GearPanelItem | null>(null);
  const [expandConfirmOpen, setExpandConfirmOpen] = useState(false);

  const progressFillRef = useRef<HTMLDivElement>(null);

  const bySlot = useMemo(() => equippedBySlot(items), [items]);
  const previewStats = useMemo(
    () =>
      calculateFinalYanmarStats({
        chassisId: activeChassisId,
        equipped: items
          .filter((i) => i.equippedSlot)
          .map((i) => ({
            slot: i.slot,
            durability: i.durability,
            data: {
              slot: i.slot,
              grade: i.grade,
              enhanceLevel: i.enhanceLevel,
              mainOption: canonicalizeMainOption(
                i.slot,
                i.grade,
                i.enhanceLevel,
                i.mainOption as Parameters<typeof canonicalizeMainOption>[3],
              ),
              subOptions: canonicalizeSubOptions(i.subOptions),
              masterOption: i.masterOption
                ? {
                    key: i.masterOption.key as MasterOptionKey,
                    value: i.masterOption.value,
                    label: i.masterOption.label,
                    hideValue: i.masterOption.hideValue,
                    isPercent: i.masterOption.isPercent,
                    isDropRateBonus: false,
                  }
                : null,
            },
          })),
      }),
    [items, activeChassisId],
  );
  const chassisLines = formatChassisStatLines(previewStats.chassisStats);
  const derivedLines = formatDerivedStatLines(previewStats);

  const activeFilterCount = GEAR_SLOTS.filter((s) => slotFilters[s]).length;
  const filterAll = activeFilterCount === GEAR_SLOTS.length || activeFilterCount === 0;

  const filtered = useMemo(() => {
    if (filterAll) return items;
    return items.filter((i) => slotFilters[i.slot]);
  }, [items, slotFilters, filterAll]);

  const emptyPadCount = Math.max(0, inventorySlots - items.length);

  useEffect(() => {
    if (!filterOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!filterRef.current?.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [filterOpen]);

  useEffect(() => {
    if (!open && !embedded) {
      setBubble(null);
      setEnhanceItemId(null);
      setEnhancePhase("idle");
      setEnhanceResult(null);
      setEnhanceProgress(0);
      setSynthOpen(false);
      setSynthGrade(null);
      setSynthSlots([null, null, null]);
      setSynthResult(null);
      setSynthFocusId(null);
      setPendingSellId(null);
      setSellResult(null);
    }
  }, [open, embedded]);

  const bubbleItem = bubble
    ? (items.find((i) => i.id === bubble.itemId) ?? null)
    : null;
  const bubbleEquipped = bubble ? bySlot[bubble.slot] : null;
  const enhanceItem = enhanceItemId
    ? (items.find((i) => i.id === enhanceItemId) ?? null)
    : null;
  const pendingDismantle = pendingDismantleId
    ? (items.find((i) => i.id === pendingDismantleId) ?? null)
    : null;
  const dismantleCores = pendingDismantle
    ? getDismantleEnhanceCores(
        pendingDismantle.grade,
        pendingDismantle.enhanceLevel,
      )
    : 0;
  const pendingSell = pendingSellId
    ? (items.find((i) => i.id === pendingSellId) ?? null)
    : null;
  const sellStars = pendingSell
    ? SELL_STARS_BY_GRADE[pendingSell.grade]
    : 0;
  const synthSlotItems = synthSlots.map((id) =>
    id ? (items.find((i) => i.id === id) ?? null) : null,
  );
  const synthReadyCount = synthSlots.filter(Boolean).length;
  const synthUpgradeChance = synthGrade
    ? Math.round(SYNTH_UPGRADE_CHANCE[synthGrade] * 100)
    : 0;
  const synthNextGrade = synthGrade ? SYNTH_NEXT_GRADE[synthGrade] : null;
  const synthInventoryItems = useMemo(() => {
    if (!synthGrade) return [];
    return items.filter(
      (item) => item.grade === synthGrade && !item.equippedSlot,
    );
  }, [items, synthGrade]);
  const synthFocusItem = synthFocusId
    ? (items.find((i) => i.id === synthFocusId) ?? null)
    : null;

  const enhanceGrade = enhanceItem?.grade ?? "NORMAL";
  const enhanceNextCost = enhanceItem
    ? getEnhanceCost(enhanceItem.enhanceLevel + 1, enhanceGrade)
    : null;
  const enhanceNextCore = enhanceItem
    ? getEnhanceCoreCost(enhanceItem.enhanceLevel + 1, enhanceGrade)
    : 0;
  const enhanceRate = enhanceItem
    ? getEnhanceSuccessRate(
        enhanceItem.enhanceLevel + 1,
        enhanceItem.failBonus,
        enhanceGrade,
      )
    : 0;
  const enhanceMainPreview = enhanceItem
    ? previewMainAtLevel(
        enhanceItem.slot,
        enhanceItem.grade,
        enhanceItem.enhanceLevel + 1,
      )
    : null;
  const milestonePreview = enhanceItem
    ? getMilestonePreview(
        enhanceItem.enhanceLevel + 1,
        enhanceItem.subOptions.length,
      )
    : { kind: "none" as const };
  const canAffordEnhance =
    enhanceNextCost != null &&
    currency >= enhanceNextCost &&
    enhanceCores >= enhanceNextCore;

  const closeBubble = () => {
    setBubble(null);
    setArtPreview(null);
  };
  const closeEnhance = () => {
    if (enhancePhase === "progress") return;
    setEnhanceItemId(null);
    setEnhancePhase("idle");
    setEnhanceResult(null);
    setEnhanceProgress(0);
  };
  const closeDismantleConfirm = () => setPendingDismantleId(null);
  const closeDismantleResult = () => setDismantleResult(null);
  const closeSellConfirm = () => setPendingSellId(null);
  const closeSellResult = () => setSellResult(null);

  const closeSynth = () => {
    setSynthOpen(false);
    setSynthGrade(null);
    setSynthSlots([null, null, null]);
    setSynthResult(null);
    setSynthFocusId(null);
  };

  const openSynth = (seedItem: GearPanelItem) => {
    if (seedItem.equippedSlot) return;
    setBubble(null);
    setSynthResult(null);
    setSynthGrade(seedItem.grade);
    setSynthSlots([seedItem.id, null, null]);
    setSynthFocusId(seedItem.id);
    setSynthOpen(true);
  };

  const tryFillSynthSlot = (item: GearPanelItem) => {
    if (!synthOpen || !synthGrade || synthResult) return false;
    if (item.equippedSlot) return true;
    if (item.grade !== synthGrade) return true;
    setSynthFocusId(item.id);
    if (synthSlots.includes(item.id)) {
      setSynthSlots(
        (prev) =>
          prev.map((id) => (id === item.id ? null : id)) as [
            string | null,
            string | null,
            string | null,
          ],
      );
      return true;
    }
    const emptyIdx = synthSlots.findIndex((id) => id == null);
    if (emptyIdx < 0) return true;
    setSynthSlots((prev) => {
      const next: [string | null, string | null, string | null] = [...prev];
      next[emptyIdx] = item.id;
      return next;
    });
    return true;
  };

  async function confirmDismantle() {
    if (!pendingDismantle || busy) return;
    const snap = {
      id: pendingDismantle.id,
      nameSnapshot: pendingDismantle.nameSnapshot,
      slot: pendingDismantle.slot,
      grade: pendingDismantle.grade,
      enhanceLevel: pendingDismantle.enhanceLevel,
    };
    setPendingDismantleId(null);
    const result = await onDismantle(snap.id);
    if (!result || typeof result.cores !== "number") return;
    setDismantleResult({
      nameSnapshot: snap.nameSnapshot,
      slot: snap.slot,
      grade: snap.grade,
      enhanceLevel: snap.enhanceLevel,
      cores: result.cores,
    });
  }

  async function confirmSell() {
    if (!pendingSell || busy) return;
    const snap = {
      id: pendingSell.id,
      nameSnapshot: pendingSell.nameSnapshot,
      slot: pendingSell.slot,
      grade: pendingSell.grade,
      enhanceLevel: pendingSell.enhanceLevel,
    };
    setPendingSellId(null);
    const result = await onSell(snap.id);
    if (!result || typeof result.stars !== "number") return;
    setSellResult({
      nameSnapshot: snap.nameSnapshot,
      slot: snap.slot,
      grade: snap.grade,
      enhanceLevel: snap.enhanceLevel,
      stars: result.stars,
    });
  }

  async function confirmSynthesize() {
    if (busy || !synthGrade) return;
    const ids = synthSlots.filter((id): id is string => !!id);
    if (ids.length !== 3) return;
    const result = await onSynthesize(ids as [string, string, string]);
    if (!result?.item) return;
    setSynthSlots([null, null, null]);
    setSynthResult(result);
  }

  const dismissEnhanceResult = () => {
    setEnhancePhase("idle");
    setEnhanceResult(null);
    setEnhanceProgress(0);
  };

  const runEnhanceAttempt = async () => {
    if (!enhanceItem || enhanceNextCost == null || !canAffordEnhance) return;
    if (enhancePhase !== "idle") return;
    setEnhancePhase("progress");
    setEnhanceProgress(0);
    setEnhanceResult(null);

    const minMs = 3000;

    // Wait for progress fill to mount, then start a GPU transform tween.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    const fill = progressFillRef.current;
    if (fill) {
      fill.style.transition = "none";
      fill.style.transform = "scaleX(0)";
      void fill.offsetWidth;
      fill.style.transition = `transform ${minMs}ms linear`;
      fill.style.transform = "scaleX(1)";
    }

    const waitMin = new Promise<void>((resolve) => {
      window.setTimeout(resolve, minMs);
    });

    const apiPromise = (async (): Promise<EnhanceActionResult | null> => {
      try {
        const raw = await onEnhance(enhanceItem.id);
        return (raw as EnhanceActionResult | null | undefined) ?? null;
      } catch {
        return null;
      }
    })();

    const [, result] = await Promise.all([waitMin, apiPromise]);

    if (fill) {
      fill.style.transition = "none";
      fill.style.transform = "scaleX(1)";
    }
    setEnhanceProgress(1);

    if (!result || typeof result.success !== "boolean") {
      setEnhancePhase("idle");
      setEnhanceProgress(0);
      if (fill) {
        fill.style.transform = "scaleX(0)";
      }
      return;
    }
    yanmarAudio.playEnhanceResult(result.success);
    setEnhanceResult(result);
    setEnhancePhase("result");
  };

  const filterSummary = filterAll
    ? "전체"
    : GEAR_SLOTS.filter((s) => slotFilters[s])
        .map((s) => GEAR_SLOT_LABEL[s])
        .join(", ");

  const equipButton = (item: GearPanelItem) => {
    if (item.equippedSlot) {
      return (
        <button
          type="button"
          className="yanmar-gear-btn yanmar-gear-btn--unequip yanmar-gear-btn--equip-side"
          disabled={busy}
          onClick={() => {
            void onUnequip(item.id);
            closeBubble();
          }}
        >
          해제
        </button>
      );
    }
    const levelLocked = !canEquipGearAtLevel(item.grade, playerLevel);
    return (
      <button
        type="button"
        className="yanmar-gear-btn yanmar-gear-btn--equip yanmar-gear-btn--equip-side"
        disabled={busy || levelLocked}
        title={
          levelLocked
            ? `레벨 ${EQUIP_LEVEL_BY_GRADE[item.grade]} 이상부터 장착 가능`
            : undefined
        }
        onClick={() => {
          if (levelLocked) return;
          void onEquip(item.id);
          closeBubble();
        }}
      >
        장착
      </button>
    );
  };

  const actionButtons = (item: GearPanelItem) => (
    <div className="yanmar-gear-mgr-actions yanmar-gear-mgr-actions--four">
      <button
        type="button"
        className="yanmar-gear-btn yanmar-gear-btn--enhance"
        disabled={busy || item.enhanceLevel >= 10}
        onClick={() => {
          setEnhanceItemId(item.id);
        }}
      >
        강화
      </button>
      <button
        type="button"
        className="yanmar-gear-btn yanmar-gear-btn--synth"
        disabled={busy || !!item.equippedSlot}
        onClick={() => openSynth(item)}
      >
        합성
      </button>
      <button
        type="button"
        className="yanmar-gear-btn yanmar-gear-btn--sell"
        disabled={busy || !!item.equippedSlot}
        onClick={() => {
          setPendingDismantleId(item.id);
          closeBubble();
        }}
      >
        분해
      </button>
      <button
        type="button"
        className="yanmar-gear-btn yanmar-gear-btn--vend"
        disabled={busy || !!item.equippedSlot}
        onClick={() => {
          setPendingSellId(item.id);
          closeBubble();
        }}
      >
        판매
      </button>
    </div>
  );

  if (!open && !embedded) return null;

  const canExpand = expandCost != null && !!onExpandInventory;

  const body = (
    <div
      className={
        embedded
          ? "yanmar-gear-mgr yanmar-gear-mgr--embedded"
          : "yanmar-gear-mgr"
      }
    >
      {!embedded ? (
        <div className="yanmar-gear-mgr-header">
          <h2>장비 관리</h2>
          <div className="yanmar-gear-mgr-header-trailing">
            <span className="yanmar-gear-core-chip" title="보유 강화코어">
              <img
                src="/images/yanmar/2d/enhance-core.png?v=3"
                alt=""
                width={16}
                height={16}
                draggable={false}
              />
              <span className="tabular-nums">{enhanceCores}</span>
            </span>
            <button type="button" onClick={onClose} aria-label="닫기">
              ×
            </button>
          </div>
        </div>
      ) : null}

      <div className="yanmar-gear-mgr-body">
        <section className="yanmar-gear-mgr-compact">
          <div className="yanmar-gear-mgr-compact-left">
            <header className="yanmar-gear-mgr-pane-head">
              <h3>장착 장비</h3>
            </header>
            <div className="yanmar-gear-mgr-equip-grid yanmar-gear-mgr-equip-grid--2x3">
              {GEAR_EQUIP_GRID_ORDER.map((slot) => {
                const eq = bySlot[slot];
                const selected =
                  bubble?.slot === slot &&
                  (bubble.kind === "equipped"
                    ? bubble.itemId === eq?.id
                    : true);
                return (
                  <div key={slot} className="yanmar-gear-mgr-equip-slot">
                    <GearIconCell
                      slot={slot}
                      grade={eq?.grade ?? null}
                      enhanceLevel={eq?.enhanceLevel ?? 0}
                      empty={!eq}
                      equipped={!!eq}
                      selected={selected}
                      size="md"
                      onClick={() => {
                        if (!eq) {
                          setBubble(null);
                          return;
                        }
                        setBubble({
                          kind: "equipped",
                          itemId: eq.id,
                          slot,
                        });
                      }}
                      title={
                        eq
                          ? `${eq.nameSnapshot}${
                              eq.enhanceLevel > 0 ? ` +${eq.enhanceLevel}` : ""
                            }`
                          : `${GEAR_SLOT_LABEL[slot]} (비어 있음)`
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <aside className="yanmar-gear-mgr-compact-stats" aria-label="능력치">
            <header className="yanmar-gear-mgr-pane-head">
              <h3>능력치</h3>
            </header>
            <div className="yanmar-gear-mgr-stats-stack">
              <div
                className="yanmar-gear-mgr-stat-grid yanmar-gear-mgr-stat-grid--2x3"
                aria-label="기본 능력치"
              >
                {chassisLines.map((line) => (
                  <p key={line.label} className="yanmar-gear-mgr-stat-cell">
                    <span>{line.label}</span>
                    <strong>{Number(line.value).toFixed(0)}</strong>
                  </p>
                ))}
              </div>
              <div
                className="yanmar-gear-mgr-stat-derived"
                aria-label="전투·작업 능력"
              >
                {derivedLines.map((line) => (
                  <p key={line.label} className="yanmar-gear-mgr-stat-cell">
                    <span>{line.label}</span>
                    <strong>{line.value}</strong>
                  </p>
                ))}
              </div>
            </div>
          </aside>
        </section>

        <section className="yanmar-gear-mgr-inv">
          <div className="yanmar-gear-mgr-inv-bar">
            <div className="yanmar-gear-filter-dd" ref={filterRef}>
              <button
                type="button"
                className="yanmar-gear-filter-dd-btn"
                onClick={() => setFilterOpen((v) => !v)}
                aria-expanded={filterOpen}
              >
                필터: {filterSummary}
                <span aria-hidden>▾</span>
              </button>
              {filterOpen ? (
                <div className="yanmar-gear-filter-dd-menu" role="menu">
                  <label className="yanmar-gear-filter-dd-item">
                    <input
                      type="checkbox"
                      checked={filterAll}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setSlotFilters(
                          Object.fromEntries(
                            GEAR_SLOTS.map((s) => [s, on]),
                          ) as Record<GearSlot, boolean>,
                        );
                      }}
                    />
                    전체
                  </label>
                  {GEAR_SLOTS.map((slot) => (
                    <label key={slot} className="yanmar-gear-filter-dd-item">
                      <input
                        type="checkbox"
                        checked={slotFilters[slot]}
                        onChange={(e) => {
                          setSlotFilters((prev) => ({
                            ...prev,
                            [slot]: e.target.checked,
                          }));
                        }}
                      />
                      {GEAR_SLOT_LABEL[slot]}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
            <span className="yanmar-gear-mgr-cap">
              {items.length} / {inventorySlots}
            </span>
          </div>
          <div className="yanmar-gear-mgr-inv-scroll">
            <div className="yanmar-gear-mgr-inv-grid yanmar-gear-mgr-inv-grid--5">
              {filtered.map((item) => (
                <GearIconCell
                  key={item.id}
                  slot={item.slot}
                  grade={item.grade}
                  enhanceLevel={item.enhanceLevel}
                  selected={
                    (!!bubble &&
                      bubble.itemId === item.id &&
                      (bubble.kind === "compare" ||
                        bubble.kind === "equipped")) ||
                    (synthOpen && synthSlots.includes(item.id))
                  }
                  equipped={!!item.equippedSlot}
                  size="md"
                  className="yanmar-gear-mgr-inv-cell"
                  onClick={() => {
                    if (tryFillSynthSlot(item)) return;
                    if (item.equippedSlot) {
                      setBubble({
                        kind: "equipped",
                        itemId: item.id,
                        slot: item.equippedSlot,
                      });
                      return;
                    }
                    setBubble({
                      kind: "compare",
                      itemId: item.id,
                      slot: item.slot,
                    });
                  }}
                  title={`${item.nameSnapshot}${
                    item.enhanceLevel > 0 ? ` +${item.enhanceLevel}` : ""
                  }`}
                />
              ))}
              {filterAll
                ? Array.from({ length: emptyPadCount }, (_, i) => (
                    <GearIconCell
                      key={`empty-${i}`}
                      empty
                      size="md"
                      className="yanmar-gear-mgr-inv-cell"
                      title="빈 슬롯"
                    />
                  ))
                : null}
              {canExpand && filterAll ? (
                <GearIconCell
                  purchase
                  size="md"
                  className="yanmar-gear-mgr-inv-cell"
                  title={`슬롯 ${GEAR_INVENTORY_EXPAND_STEP}칸 확장`}
                  onClick={() => {
                    if (busy) return;
                    setExpandConfirmOpen(true);
                  }}
                />
              ) : null}
            </div>
          </div>
        </section>
      </div>

      {bubble ? (
        <div className="yanmar-gear-bubble-layer">
          <button
            type="button"
            className="yanmar-gear-bubble-backdrop"
            aria-label="말풍선 닫기"
            onClick={closeBubble}
          />
          <div
            className={`yanmar-gear-bubble${
              bubble.kind === "compare" ? " yanmar-gear-bubble--compare" : ""
            }`}
            role="dialog"
            aria-modal="true"
          >
            <header className="yanmar-gear-bubble-head">
              <div className="yanmar-gear-bubble-head-lead">
                {bubble.kind === "compare" ? (
                  <>
                    <span className="yanmar-gear-mgr-compare-badge">
                      장비 비교
                    </span>
                    <p className="yanmar-gear-bubble-compare-sub">
                      {GEAR_SLOT_LABEL[bubble.slot]} 슬롯
                    </p>
                  </>
                ) : (
                  <span className="yanmar-gear-mgr-compare-badge">
                    현재 장착
                  </span>
                )}
              </div>
              <button
                type="button"
                className="yanmar-gear-bubble-close"
                onClick={closeBubble}
                aria-label="닫기"
              >
                ×
              </button>
            </header>
            {bubble.kind === "equipped" ? (
              <>
                <GearBubbleCard
                  title="장비 정보"
                  item={bubbleItem}
                  highlight
                  playerLevel={playerLevel}
                  onZoom={setArtPreview}
                  equipAction={bubbleItem ? equipButton(bubbleItem) : null}
                />
                {bubbleItem ? actionButtons(bubbleItem) : null}
              </>
            ) : (
              <>
                <div className="yanmar-gear-bubble-compare-row">
                  <GearBubbleCard
                    title="장착 중"
                    item={bubbleEquipped}
                    emptyLabel={`${GEAR_SLOT_LABEL[bubble.slot]} 슬롯 비어 있음`}
                    playerLevel={playerLevel}
                    onZoom={setArtPreview}
                    equipAction={
                      bubbleEquipped ? equipButton(bubbleEquipped) : null
                    }
                  />
                  <GearBubbleCard
                    title="선택"
                    item={bubbleItem}
                    highlight
                    playerLevel={playerLevel}
                    onZoom={setArtPreview}
                    equipAction={bubbleItem ? equipButton(bubbleItem) : null}
                    compareAgainst={
                      bubbleEquipped &&
                      bubbleItem &&
                      bubbleEquipped.id !== bubbleItem.id
                        ? bubbleEquipped
                        : null
                    }
                  />
                </div>
                {bubbleItem ? actionButtons(bubbleItem) : null}
              </>
            )}
          </div>
        </div>
      ) : null}

      {artPreview ? (
        <div
          className="yanmar-gear-art-preview-layer"
          role="dialog"
          aria-modal="true"
          aria-label="장비 이미지 크게보기"
        >
          <button
            type="button"
            className="yanmar-gear-art-preview-backdrop"
            aria-label="크게보기 닫기"
            onClick={() => setArtPreview(null)}
          />
          <div className="yanmar-gear-art-preview-card">
            <GearIconCell
              slot={artPreview.slot}
              grade={artPreview.grade}
              enhanceLevel={artPreview.enhanceLevel}
              size="xl"
              className="yanmar-gear-art-preview-icon"
            />
            <p
              className={`yanmar-gear-mgr-name ${gradeTextClass(artPreview.grade)}`}
            >
              {artPreview.nameSnapshot}
              {artPreview.enhanceLevel > 0
                ? ` +${artPreview.enhanceLevel}`
                : ""}
            </p>
            <p className="yanmar-gear-mgr-grade">
              [{ITEM_GRADE_LABEL[artPreview.grade]}] ·{" "}
              {GEAR_SLOT_LABEL[artPreview.slot]}
              {" · "}
              <EquipLevelText
                grade={artPreview.grade}
                playerLevel={playerLevel}
              />
            </p>
            <button
              type="button"
              className="yanmar-gear-btn yanmar-gear-btn--unequip"
              onClick={() => setArtPreview(null)}
            >
              닫기
            </button>
          </div>
        </div>
      ) : null}

      {enhanceItem ? (
        <div className="yanmar-gear-enhance-layer">
          <button
            type="button"
            className="yanmar-gear-enhance-backdrop"
            aria-label="강화 모달 닫기"
            disabled={enhancePhase === "progress"}
            onClick={closeEnhance}
          />
          <div
            className="yanmar-gear-enhance-modal"
            role="dialog"
            aria-modal="true"
            aria-label="장비 강화"
          >
            <div className="yanmar-gear-enhance-header">
              <h3>장비 강화</h3>
              <div className="yanmar-gear-mgr-header-trailing">
                <span className="yanmar-gear-core-chip" title="보유 강화코어">
                  <img
                    src="/images/yanmar/2d/enhance-core.png?v=3"
                    alt=""
                    width={16}
                    height={16}
                    draggable={false}
                  />
                  <span className="tabular-nums">{enhanceCores}</span>
                </span>
                <button
                  type="button"
                  onClick={closeEnhance}
                  aria-label="닫기"
                  disabled={enhancePhase === "progress"}
                >
                  ×
                </button>
              </div>
            </div>
            <div
              className={`yanmar-gear-mgr-detail${
                enhancePhase === "progress"
                  ? " yanmar-gear-enhance-pulse"
                  : ""
              }`}
            >
              <GearIconCell
                slot={enhanceItem.slot}
                grade={enhanceItem.grade}
                enhanceLevel={enhanceItem.enhanceLevel}
                size="md"
                equipped={!!enhanceItem.equippedSlot}
              />
              <div className="yanmar-gear-mgr-detail-meta">
                <p
                  className={`yanmar-gear-mgr-name ${gradeTextClass(
                    enhanceItem.grade,
                  )}`}
                >
                  {enhanceItem.nameSnapshot}
                  {enhanceItem.enhanceLevel > 0
                    ? ` +${enhanceItem.enhanceLevel}`
                    : ""}
                </p>
                <p
                  className={`yanmar-gear-mgr-grade ${gradeTextClass(
                    enhanceItem.grade,
                  )}`}
                >
                  [{ITEM_GRADE_LABEL[enhanceItem.grade]}] ·{" "}
                  {GEAR_SLOT_LABEL[enhanceItem.slot]}
                  {" · "}
                  <EquipLevelText
                    grade={enhanceItem.grade}
                    playerLevel={playerLevel}
                  />
                </p>
                <p className="yanmar-gear-mgr-main">
                  <span className="yanmar-gear-mgr-attr-main">
                    {formatMain(enhanceItem)}
                  </span>
                </p>
              </div>
            </div>

            {enhancePhase === "result" && enhanceResult ? (
              <div className="yanmar-gear-enhance-result">
                <p
                  className={
                    enhanceResult.success
                      ? "yanmar-gear-enhance-result-title is-success"
                      : "yanmar-gear-enhance-result-title is-fail"
                  }
                >
                  {enhanceResult.success ? "강화 성공" : "강화 실패"}
                </p>
                {enhanceResult.success && enhanceResult.before && enhanceResult.after ? (
                  <>
                    <p className="yanmar-gear-enhance-result-level">
                      +{enhanceResult.before.enhanceLevel} → +
                      {enhanceResult.after.enhanceLevel}
                    </p>
                    <ul className="yanmar-gear-enhance-result-stats">
                      <li>
                        <strong>
                          {MAIN_OPTION_BY_SLOT[enhanceItem.slot].label}
                        </strong>
                        <span>
                          +{Math.round(enhanceResult.before.mainOption.value)} → +
                          {Math.round(enhanceResult.after.mainOption.value)}
                        </span>
                      </li>
                      {(() => {
                        const beforeSubs = enhanceResult.before.subOptions;
                        const afterSubs = enhanceResult.after.subOptions;
                        const lines: ReactNode[] = [];
                        for (let i = 0; i < afterSubs.length; i += 1) {
                          const after = afterSubs[i]!;
                          const before = beforeSubs[i];
                          const def = SUB_OPTION_POOL.find(
                            (s) => s.key === after.key,
                          );
                          const label = def?.label ?? after.key;
                          const unit = after.isPercent ? "%" : "";
                          if (!before) {
                            lines.push(
                              <li key={`new-${after.key}-${i}`}>
                                <strong>{label}</strong>
                                <span className="is-new">
                                  신규 +{Math.round(after.value)}
                                  {unit} (T{after.tier})
                                </span>
                              </li>,
                            );
                          } else if (
                            before.tier !== after.tier ||
                            Math.abs(before.value - after.value) > 0.01
                          ) {
                            const beforeUnit = before.isPercent ? "%" : "";
                            lines.push(
                              <li key={`up-${after.key}-${i}`}>
                                <strong>{label}</strong>
                                <span>
                                  +{Math.round(before.value)}
                                  {beforeUnit} → +{Math.round(after.value)}
                                  {unit} (T{before.tier}→T{after.tier})
                                </span>
                              </li>,
                            );
                          } else {
                            lines.push(
                              <li key={`same-${after.key}-${i}`}>
                                <strong>{label}</strong>
                                <span className="is-muted">
                                  +{Math.round(after.value)}% (T{after.tier})
                                </span>
                              </li>,
                            );
                          }
                        }
                        if (afterSubs.length === 0) {
                          lines.push(
                            <li key="sub-none">
                              <strong>부옵션</strong>
                              <span className="is-muted">없음</span>
                            </li>,
                          );
                        }
                        return lines;
                      })()}
                    </ul>
                  </>
                ) : (
                  <>
                    <p className="yanmar-gear-muted yanmar-gear-enhance-result-note">
                      능력치 변화 없음
                    </p>
                    {(enhanceResult.failBonusAdd ?? 0) > 0 ? (
                      <p className="yanmar-gear-enhance-result-note">
                        실패 가산 +
                        {Math.round((enhanceResult.failBonusAdd ?? 0) * 1000) /
                          10}
                        %p
                      </p>
                    ) : null}
                    {typeof enhanceResult.nextSuccessRate === "number" ? (
                      <p className="yanmar-gear-enhance-result-note">
                        다음 성공률{" "}
                        {Math.round(enhanceResult.nextSuccessRate * 100)}%
                      </p>
                    ) : null}
                  </>
                )}
                <div className="yanmar-gear-enhance-actions">
                  <button
                    type="button"
                    className="yanmar-gear-btn yanmar-gear-btn--enhance"
                    onClick={dismissEnhanceResult}
                  >
                    확인
                  </button>
                </div>
              </div>
            ) : enhancePhase === "progress" ? (
              <div className="yanmar-gear-enhance-progress">
                <p>강화 중…</p>
                <div
                  className="yanmar-gear-enhance-progress-track"
                  role="progressbar"
                  aria-valuenow={Math.round(enhanceProgress * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    ref={progressFillRef}
                    className="yanmar-gear-enhance-progress-fill"
                  />
                </div>
              </div>
            ) : enhanceNextCost == null ? (
              <p className="yanmar-gear-enhance-max">최대 강화에 도달했습니다.</p>
            ) : (
              <div className="yanmar-gear-enhance-panels">
                <section className="yanmar-gear-enhance-panel is-emphasis">
                  <p className="yanmar-gear-enhance-panel-label">강화 재료</p>
                  <div className="yanmar-gear-enhance-cost-row">
                    <div className="yanmar-gear-enhance-cost-item">
                      <img
                        src="/images/star-currency.svg"
                        alt=""
                        width={22}
                        height={22}
                        draggable={false}
                      />
                      <strong
                        className={
                          currency < enhanceNextCost ? "is-shortage" : undefined
                        }
                      >
                        {enhanceNextCost.toLocaleString()}
                      </strong>
                    </div>
                    <div className="yanmar-gear-enhance-cost-item">
                      <img
                        src="/images/yanmar/2d/enhance-core.png?v=3"
                        alt=""
                        width={22}
                        height={22}
                        draggable={false}
                      />
                      <strong
                        className={
                          enhanceCores < enhanceNextCore
                            ? "is-shortage"
                            : undefined
                        }
                      >
                        {enhanceNextCore.toLocaleString()}
                      </strong>
                    </div>
                  </div>
                </section>

                <section className="yanmar-gear-enhance-panel is-emphasis">
                  <div className="yanmar-gear-enhance-meta-grid">
                    <div>
                      <p className="yanmar-gear-enhance-panel-label">다음 강화</p>
                      <p className="yanmar-gear-enhance-meta-value">
                        +{enhanceItem.enhanceLevel}
                        <span>→</span>+{enhanceItem.enhanceLevel + 1}
                      </p>
                    </div>
                    <div>
                      <p className="yanmar-gear-enhance-panel-label">성공 확률</p>
                      <p className="yanmar-gear-enhance-meta-value is-rate">
                        {Math.round(enhanceRate * 100)}
                        <span className="is-unit">%</span>
                      </p>
                    </div>
                  </div>
                </section>

                <section className="yanmar-gear-enhance-panel">
                  <div className="yanmar-gear-enhance-option-list">
                    {enhanceMainPreview != null ? (
                      <div className="yanmar-gear-enhance-option-row">
                        <strong>
                          {MAIN_OPTION_BY_SLOT[enhanceItem.slot].label}
                        </strong>
                        <span>
                          +{Math.round(enhanceItem.mainOption.value)} → +
                          {Math.round(enhanceMainPreview)}
                        </span>
                      </div>
                    ) : null}
                    <div className="yanmar-gear-enhance-option-row">
                      <strong>부옵션</strong>
                      <span>
                        {milestonePreview.kind === "newSubs"
                          ? `신규 생성 (최대 ${milestonePreview.count}개)`
                          : milestonePreview.kind === "tierUp"
                            ? `기존 중 ${milestonePreview.count}개 강화`
                            : "변화 없음"}
                      </span>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {enhancePhase === "idle" ? (
              <div className="yanmar-gear-enhance-actions">
                <button
                  type="button"
                  className="yanmar-gear-btn yanmar-gear-btn--unequip"
                  onClick={closeEnhance}
                >
                  닫기
                </button>
                <button
                  type="button"
                  className="yanmar-gear-btn yanmar-gear-btn--enhance"
                  disabled={
                    busy || enhanceNextCost == null || !canAffordEnhance
                  }
                  onClick={() => {
                    void runEnhanceAttempt();
                  }}
                >
                  강화하기
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {pendingDismantle ? (
        <div
          className="yanmar-gear-confirm-layer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="yanmar-gear-dismantle-title"
        >
          <button
            type="button"
            className="yanmar-gear-confirm-backdrop"
            aria-label="분해 확인 닫기"
            disabled={busy}
            onClick={closeDismantleConfirm}
          />
          <div className="yanmar-gear-confirm-card yanmar-gear-confirm-card--dismantle">
            <p className="yanmar-gear-confirm-eyebrow">장비 분해</p>
            <h3 id="yanmar-gear-dismantle-title">정말 분해할까요?</h3>
            <div className="yanmar-gear-confirm-item">
              <GearIconCell
                slot={pendingDismantle.slot}
                grade={pendingDismantle.grade}
                enhanceLevel={pendingDismantle.enhanceLevel}
                size="md"
              />
              <div className="yanmar-gear-confirm-item-meta">
                <p
                  className={`yanmar-gear-mgr-name ${gradeTextClass(
                    pendingDismantle.grade,
                  )}`}
                >
                  {pendingDismantle.nameSnapshot}
                  {pendingDismantle.enhanceLevel > 0
                    ? ` +${pendingDismantle.enhanceLevel}`
                    : ""}
                </p>
                <p
                  className={`yanmar-gear-mgr-grade ${gradeTextClass(
                    pendingDismantle.grade,
                  )}`}
                >
                  [{ITEM_GRADE_LABEL[pendingDismantle.grade]}] ·{" "}
                  {GEAR_SLOT_LABEL[pendingDismantle.slot]}
                </p>
              </div>
            </div>
            <div className="yanmar-gear-confirm-reward">
              <span className="yanmar-gear-confirm-reward-label">
                예상 획득
              </span>
              <span className="yanmar-gear-confirm-reward-value">
                <img
                  src="/images/yanmar/2d/enhance-core.png?v=3"
                  alt=""
                  width={20}
                  height={20}
                  draggable={false}
                />
                <strong className="tabular-nums">+{dismantleCores}</strong>
              </span>
            </div>
            <p className="yanmar-gear-confirm-warn">
              분해한 장비는 되돌릴 수 없습니다.
            </p>
            <div className="yanmar-gear-confirm-actions">
              <button
                type="button"
                className="yanmar-gear-btn yanmar-gear-btn--unequip"
                disabled={busy}
                onClick={closeDismantleConfirm}
              >
                취소
              </button>
              <button
                type="button"
                className="yanmar-gear-btn yanmar-gear-btn--sell"
                disabled={busy}
                onClick={() => void confirmDismantle()}
              >
                분해하기
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {dismantleResult ? (
        <div
          className="yanmar-gear-confirm-layer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="yanmar-gear-dismantle-done-title"
        >
          <button
            type="button"
            className="yanmar-gear-confirm-backdrop"
            aria-label="분해 결과 닫기"
            onClick={closeDismantleResult}
          />
          <div className="yanmar-gear-confirm-card yanmar-gear-confirm-card--done">
            <p className="yanmar-gear-confirm-eyebrow">분해 완료</p>
            <h3 id="yanmar-gear-dismantle-done-title">장비를 분해했습니다</h3>
            <div className="yanmar-gear-confirm-item">
              <GearIconCell
                slot={dismantleResult.slot}
                grade={dismantleResult.grade}
                enhanceLevel={dismantleResult.enhanceLevel}
                size="md"
              />
              <div className="yanmar-gear-confirm-item-meta">
                <p
                  className={`yanmar-gear-mgr-name ${gradeTextClass(
                    dismantleResult.grade,
                  )}`}
                >
                  {dismantleResult.nameSnapshot}
                  {dismantleResult.enhanceLevel > 0
                    ? ` +${dismantleResult.enhanceLevel}`
                    : ""}
                </p>
                <p
                  className={`yanmar-gear-mgr-grade ${gradeTextClass(
                    dismantleResult.grade,
                  )}`}
                >
                  [{ITEM_GRADE_LABEL[dismantleResult.grade]}] ·{" "}
                  {GEAR_SLOT_LABEL[dismantleResult.slot]}
                </p>
              </div>
            </div>
            <div className="yanmar-gear-confirm-reward">
              <span className="yanmar-gear-confirm-reward-label">획득</span>
              <span className="yanmar-gear-confirm-reward-value">
                <img
                  src="/images/yanmar/2d/enhance-core.png?v=3"
                  alt=""
                  width={20}
                  height={20}
                  draggable={false}
                />
                <strong className="tabular-nums">
                  +{dismantleResult.cores}
                </strong>
              </span>
            </div>
            <div className="yanmar-gear-confirm-actions yanmar-gear-confirm-actions--single">
              <button
                type="button"
                className="yanmar-gear-btn yanmar-gear-btn--enhance"
                onClick={closeDismantleResult}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingSell ? (
        <div
          className="yanmar-gear-confirm-layer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="yanmar-gear-sell-title"
        >
          <button
            type="button"
            className="yanmar-gear-confirm-backdrop"
            aria-label="판매 확인 닫기"
            disabled={busy}
            onClick={closeSellConfirm}
          />
          <div className="yanmar-gear-confirm-card yanmar-gear-confirm-card--dismantle">
            <p className="yanmar-gear-confirm-eyebrow">장비 판매</p>
            <h3 id="yanmar-gear-sell-title">정말 판매할까요?</h3>
            <div className="yanmar-gear-confirm-item">
              <GearIconCell
                slot={pendingSell.slot}
                grade={pendingSell.grade}
                enhanceLevel={pendingSell.enhanceLevel}
                size="md"
              />
              <div className="yanmar-gear-confirm-item-meta">
                <p
                  className={`yanmar-gear-mgr-name ${gradeTextClass(
                    pendingSell.grade,
                  )}`}
                >
                  {pendingSell.nameSnapshot}
                  {pendingSell.enhanceLevel > 0
                    ? ` +${pendingSell.enhanceLevel}`
                    : ""}
                </p>
                <p
                  className={`yanmar-gear-mgr-grade ${gradeTextClass(
                    pendingSell.grade,
                  )}`}
                >
                  [{ITEM_GRADE_LABEL[pendingSell.grade]}] ·{" "}
                  {GEAR_SLOT_LABEL[pendingSell.slot]}
                </p>
              </div>
            </div>
            <div className="yanmar-gear-confirm-reward">
              <span className="yanmar-gear-confirm-reward-label">
                예상 획득
              </span>
              <span className="yanmar-gear-confirm-reward-value">
                <StarAmount value={sellStars} />
              </span>
            </div>
            <p className="yanmar-gear-confirm-warn">
              판매한 장비는 되돌릴 수 없습니다.
            </p>
            <div className="yanmar-gear-confirm-actions">
              <button
                type="button"
                className="yanmar-gear-btn yanmar-gear-btn--unequip"
                disabled={busy}
                onClick={closeSellConfirm}
              >
                취소
              </button>
              <button
                type="button"
                className="yanmar-gear-btn yanmar-gear-btn--vend"
                disabled={busy}
                onClick={() => void confirmSell()}
              >
                판매하기
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {sellResult ? (
        <div
          className="yanmar-gear-confirm-layer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="yanmar-gear-sell-done-title"
        >
          <button
            type="button"
            className="yanmar-gear-confirm-backdrop"
            aria-label="판매 결과 닫기"
            onClick={closeSellResult}
          />
          <div className="yanmar-gear-confirm-card yanmar-gear-confirm-card--done">
            <p className="yanmar-gear-confirm-eyebrow">판매 완료</p>
            <h3 id="yanmar-gear-sell-done-title">장비를 판매했습니다</h3>
            <div className="yanmar-gear-confirm-item">
              <GearIconCell
                slot={sellResult.slot}
                grade={sellResult.grade}
                enhanceLevel={sellResult.enhanceLevel}
                size="md"
              />
              <div className="yanmar-gear-confirm-item-meta">
                <p
                  className={`yanmar-gear-mgr-name ${gradeTextClass(
                    sellResult.grade,
                  )}`}
                >
                  {sellResult.nameSnapshot}
                  {sellResult.enhanceLevel > 0
                    ? ` +${sellResult.enhanceLevel}`
                    : ""}
                </p>
                <p
                  className={`yanmar-gear-mgr-grade ${gradeTextClass(
                    sellResult.grade,
                  )}`}
                >
                  [{ITEM_GRADE_LABEL[sellResult.grade]}] ·{" "}
                  {GEAR_SLOT_LABEL[sellResult.slot]}
                </p>
              </div>
            </div>
            <div className="yanmar-gear-confirm-reward">
              <span className="yanmar-gear-confirm-reward-label">획득</span>
              <span className="yanmar-gear-confirm-reward-value">
                <StarAmount value={sellResult.stars} />
              </span>
            </div>
            <div className="yanmar-gear-confirm-actions yanmar-gear-confirm-actions--single">
              <button
                type="button"
                className="yanmar-gear-btn yanmar-gear-btn--enhance"
                onClick={closeSellResult}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {synthOpen ? (
        <div
          className="yanmar-gear-confirm-layer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="yanmar-gear-synth-title"
        >
          <button
            type="button"
            className="yanmar-gear-confirm-backdrop"
            aria-label="합성 모달 닫기"
            disabled={busy}
            onClick={closeSynth}
          />
          <div className="yanmar-gear-confirm-card yanmar-gear-synth-card">
            <p className="yanmar-gear-confirm-eyebrow">장비 합성</p>
            <h3 id="yanmar-gear-synth-title">
              {synthResult
                ? "합성 완료"
                : `${synthGrade ? ITEM_GRADE_LABEL[synthGrade] : ""} 장비 3개 합성`}
            </h3>

            {synthResult ? (
              <>
                <div className="yanmar-gear-confirm-item">
                  <GearIconCell
                    slot={synthResult.item.slot}
                    grade={synthResult.item.grade}
                    enhanceLevel={synthResult.item.enhanceLevel}
                    size="md"
                  />
                  <div className="yanmar-gear-confirm-item-meta">
                    <p
                      className={`yanmar-gear-mgr-name ${gradeTextClass(
                        synthResult.item.grade,
                      )}`}
                    >
                      {synthResult.item.nameSnapshot}
                    </p>
                    <p
                      className={`yanmar-gear-mgr-grade ${gradeTextClass(
                        synthResult.item.grade,
                      )}`}
                    >
                      [{ITEM_GRADE_LABEL[synthResult.item.grade]}] ·{" "}
                      {GEAR_SLOT_LABEL[synthResult.item.slot]}
                    </p>
                    {synthResult.upgraded ? (
                      <p className="yanmar-gear-synth-upgraded">등급 상승!</p>
                    ) : null}
                  </div>
                </div>
                <div className="yanmar-gear-confirm-actions yanmar-gear-confirm-actions--single">
                  <button
                    type="button"
                    className="yanmar-gear-btn yanmar-gear-btn--enhance"
                    onClick={closeSynth}
                  >
                    확인
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="yanmar-gear-synth-slots">
                  {synthSlotItems.map((slotItem, idx) => (
                    <button
                      key={`synth-slot-${idx}`}
                      type="button"
                      className={`yanmar-gear-synth-slot${
                        slotItem ? " is-filled" : ""
                      }`}
                      disabled={busy}
                      onClick={() => {
                        if (!slotItem) return;
                        setSynthFocusId(slotItem.id);
                        setSynthSlots((prev) => {
                          const next: [
                            string | null,
                            string | null,
                            string | null,
                          ] = [...prev];
                          next[idx] = null;
                          return next;
                        });
                      }}
                      title={
                        slotItem
                          ? "탭하여 슬롯 비우기"
                          : "아래 인벤에서 동일 등급 장비 선택"
                      }
                    >
                      {slotItem ? (
                        <GearIconCell
                          slot={slotItem.slot}
                          grade={slotItem.grade}
                          enhanceLevel={slotItem.enhanceLevel}
                          size="sm"
                          checked
                        />
                      ) : (
                        <span>{idx + 1}</span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="yanmar-gear-synth-odds" aria-label="합성 확률">
                  {synthGrade && synthNextGrade ? (
                    <>
                      <span
                        className={`yanmar-gear-synth-odds-part ${gradeTextClass(
                          synthGrade,
                        )}`}
                      >
                        {ITEM_GRADE_LABEL[synthGrade]} {100 - synthUpgradeChance}%
                      </span>
                      <span className="yanmar-gear-synth-odds-sep" aria-hidden>
                        /
                      </span>
                      <span
                        className={`yanmar-gear-synth-odds-part ${gradeTextClass(
                          synthNextGrade,
                        )}`}
                      >
                        {ITEM_GRADE_LABEL[synthNextGrade]} {synthUpgradeChance}%
                      </span>
                    </>
                  ) : synthGrade === "MASTER" ? (
                    <span
                      className={`yanmar-gear-synth-odds-part ${gradeTextClass(
                        "MASTER",
                      )}`}
                    >
                      마스터 100%
                    </span>
                  ) : null}
                </div>
                <div className="yanmar-gear-synth-viewer">
                  {synthFocusItem ? (
                    <div className="yanmar-gear-synth-viewer-body">
                      <GearIconCell
                        slot={synthFocusItem.slot}
                        grade={synthFocusItem.grade}
                        enhanceLevel={synthFocusItem.enhanceLevel}
                        size="md"
                        checked={synthSlots.includes(synthFocusItem.id)}
                      />
                      <div className="yanmar-gear-synth-viewer-meta">
                        <p className="yanmar-gear-synth-viewer-label">선택 장비</p>
                        <p
                          className={`yanmar-gear-mgr-name ${gradeTextClass(
                            synthFocusItem.grade,
                          )}`}
                        >
                          {synthFocusItem.nameSnapshot}
                          {synthFocusItem.enhanceLevel > 0
                            ? ` +${synthFocusItem.enhanceLevel}`
                            : ""}
                        </p>
                        <p
                          className={`yanmar-gear-mgr-grade ${gradeTextClass(
                            synthFocusItem.grade,
                          )}`}
                        >
                          [{ITEM_GRADE_LABEL[synthFocusItem.grade]}] ·{" "}
                          {GEAR_SLOT_LABEL[synthFocusItem.slot]}
                        </p>
                        <p className="yanmar-gear-mgr-main">
                          <span className="yanmar-gear-mgr-attr-main">
                            {formatMain(synthFocusItem)}
                          </span>
                        </p>
                        {synthFocusItem.subOptions.length > 0 ? (
                          <ul className="yanmar-gear-synth-viewer-subs">
                            {synthFocusItem.subOptions.map((sub) => {
                              const row = formatSub(sub);
                              return (
                                <li key={`${sub.key}-${sub.tier}-${sub.value}`}>
                                  {row.text}
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                        {synthFocusItem.masterOption ? (
                          <p className="yanmar-gear-synth-viewer-master">
                            마스터 {synthFocusItem.masterOption.label}
                            {!synthFocusItem.masterOption.hideValue
                              ? ` ${synthFocusItem.masterOption.value}${
                                  synthFocusItem.masterOption.isPercent
                                    ? "%"
                                    : ""
                                }`
                              : ""}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <p className="yanmar-gear-synth-viewer-empty">
                      장비를 선택하면 정보가 표시됩니다
                    </p>
                  )}
                </div>
                <div className="yanmar-gear-synth-inv">
                  <div className="yanmar-gear-synth-inv-bar">
                    <span>
                      {ITEM_GRADE_LABEL[synthGrade ?? "NORMAL"]} 인벤
                    </span>
                    <span className="yanmar-gear-mgr-cap">
                      {synthReadyCount} / 3 선택
                    </span>
                  </div>
                  <div className="yanmar-gear-synth-inv-scroll">
                    <div className="yanmar-gear-mgr-inv-grid yanmar-gear-mgr-inv-grid--5 yanmar-gear-synth-inv-grid">
                      {synthInventoryItems.length === 0 ? (
                        <p className="yanmar-gear-synth-inv-empty">
                          합성 가능한 장비가 없습니다.
                        </p>
                      ) : (
                        synthInventoryItems.map((item) => {
                          const inSlot = synthSlots.includes(item.id);
                          return (
                            <GearIconCell
                              key={item.id}
                              slot={item.slot}
                              grade={item.grade}
                              enhanceLevel={item.enhanceLevel}
                              size="md"
                              checked={inSlot}
                              selected={inSlot}
                              className="yanmar-gear-mgr-inv-cell"
                              onClick={() => {
                                if (busy) return;
                                tryFillSynthSlot(item);
                              }}
                              title={`${item.nameSnapshot}${
                                item.enhanceLevel > 0
                                  ? ` +${item.enhanceLevel}`
                                  : ""
                              }${inSlot ? " (선택됨 · 다시 탭하면 해제)" : ""}`}
                            />
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
                <div className="yanmar-gear-confirm-actions">
                  <button
                    type="button"
                    className="yanmar-gear-btn yanmar-gear-btn--unequip"
                    disabled={busy}
                    onClick={closeSynth}
                  >
                    닫기
                  </button>
                  <button
                    type="button"
                    className="yanmar-gear-btn yanmar-gear-btn--synth"
                    disabled={busy || synthReadyCount !== 3}
                    onClick={() => void confirmSynthesize()}
                  >
                    합성하기
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {expandConfirmOpen && expandCost != null ? (
        <div
          className="yanmar-gear-confirm-layer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="yanmar-gear-expand-title"
        >
          <button
            type="button"
            className="yanmar-gear-confirm-backdrop"
            aria-label="슬롯 확장 닫기"
            disabled={busy}
            onClick={() => setExpandConfirmOpen(false)}
          />
          <div className="yanmar-gear-confirm-card yanmar-gear-confirm-card--expand">
            <p className="yanmar-gear-confirm-eyebrow">인벤토리 확장</p>
            <h3 id="yanmar-gear-expand-title">슬롯을 확장할까요?</h3>
            <ul className="yanmar-gear-expand-facts">
              <li>
                <span>추가 슬롯</span>
                <strong>+{GEAR_INVENTORY_EXPAND_STEP}칸</strong>
              </li>
              <li>
                <span>확장 후</span>
                <strong>
                  {inventorySlots} → {inventorySlots + GEAR_INVENTORY_EXPAND_STEP}
                </strong>
              </li>
              <li className="yanmar-gear-expand-cost">
                <span>필요 비용</span>
                <strong>
                  <StarAmount
                    value={expandCost}
                    size={16}
                    valueClassName="yanmar-gear-expand-cost-star"
                  />
                </strong>
              </li>
            </ul>
            {currency < expandCost ? (
              <p className="yanmar-gear-confirm-warn">스타가 부족합니다.</p>
            ) : null}
            <div className="yanmar-gear-confirm-actions">
              <button
                type="button"
                className="yanmar-gear-btn yanmar-gear-btn--unequip"
                disabled={busy}
                onClick={() => setExpandConfirmOpen(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="yanmar-gear-btn yanmar-gear-btn--enhance"
                disabled={busy || currency < expandCost}
                onClick={() => {
                  if (busy || currency < expandCost) return;
                  setExpandConfirmOpen(false);
                  void onExpandInventory?.();
                }}
              >
                확장하기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  if (embedded) return body;

  return (
    <AppModalOverlay
      open={open}
      onClose={onClose}
      panelClassName="!w-[min(98vw,64rem)] !max-w-none !max-h-[min(94dvh,52rem)] !h-[min(92dvh,48rem)] !overflow-hidden !rounded-2xl !p-0 landscape:!max-h-[min(96dvh,42rem)] landscape:!h-[min(94dvh,40rem)]"
    >
      {body}
    </AppModalOverlay>
  );
}
