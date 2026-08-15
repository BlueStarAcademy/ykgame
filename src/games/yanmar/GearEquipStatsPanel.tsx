"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { GearIconCell } from "./GearIconCell";
import {
  canonicalizeMainOption,
  canonicalizeSubOptions,
} from "./gearGenerate";
import type { GearSlot, ItemGrade, MasterOptionKey } from "./gearCatalog";
import {
  equippedBySlot,
  formatChassisStatLines,
  formatDerivedStatLines,
} from "./gearSummary";
import { calculateFinalYanmarStats } from "./gearStats";
import type { ChassisModelId } from "./chassisCatalog";
import type { AbilityAlloc } from "./abilityAlloc";
import { gearSlotLabel } from "@/i18n/yanmarCatalog";

/** Minimal equipped-item shape for the compact equip + stats row. */
export type GearEquipStatsItem = {
  id: string;
  slot: GearSlot;
  grade: ItemGrade;
  enhanceLevel: number;
  nameSnapshot: string;
  durability: number;
  durabilityMax: number;
  equippedSlot: GearSlot | null;
  mainOption: { key: string; value: number };
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
};

/** 장착 2×3 그리드: 왼(버켓/브레이커/집게) · 오른(암/붐/트랙) */
export const GEAR_EQUIP_GRID_ORDER: readonly GearSlot[] = [
  "BUCKET",
  "ARM",
  "BREAKER",
  "BOOM",
  "GRAPPLE",
  "TRACK",
];

type GearEquipStatsPanelProps = {
  items: GearEquipStatsItem[];
  activeChassisId?: ChassisModelId | string;
  /** When set, included in final stats (own gear panel omits this today). */
  abilityAlloc?: AbilityAlloc | null;
  /** Highlight a slot (e.g. open bubble in full GearPanel). */
  selectedSlot?: GearSlot | null;
  selectedItemId?: string | null;
  /** Omit for read-only inspect (public profile). */
  onSlotClick?: (slot: GearSlot, item: GearEquipStatsItem | null) => void;
  className?: string;
};

export function GearEquipStatsPanel({
  items,
  activeChassisId,
  abilityAlloc = null,
  selectedSlot = null,
  selectedItemId = null,
  onSlotClick,
  className = "",
}: GearEquipStatsPanelProps) {
  const t = useTranslations("yanmar.gear");
  const catalogT = useTranslations("yanmar");

  const bySlot = useMemo(() => equippedBySlot(items), [items]);
  const previewStats = useMemo(
    () =>
      calculateFinalYanmarStats({
        chassisId: activeChassisId,
        abilityAlloc,
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
    [items, activeChassisId, abilityAlloc],
  );
  const chassisLines = formatChassisStatLines(previewStats.chassisStats);
  const derivedLines = formatDerivedStatLines(previewStats);
  const interactive = typeof onSlotClick === "function";

  return (
    <section className={`yanmar-gear-mgr-compact ${className}`.trim()}>
      <div className="yanmar-gear-mgr-compact-left">
        <header className="yanmar-gear-mgr-pane-head">
          <h3>{t("equip")}</h3>
        </header>
        <div className="yanmar-gear-mgr-equip-grid yanmar-gear-mgr-equip-grid--2x3">
          {GEAR_EQUIP_GRID_ORDER.map((slot) => {
            const eq = bySlot[slot] ?? null;
            const selected =
              selectedSlot === slot &&
              (selectedItemId ? selectedItemId === eq?.id : true);
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
                  onClick={
                    interactive
                      ? () => onSlotClick?.(slot, eq)
                      : undefined
                  }
                  title={
                    eq
                      ? `${eq.nameSnapshot}${
                          eq.enhanceLevel > 0 ? ` +${eq.enhanceLevel}` : ""
                        }`
                      : `${gearSlotLabel(catalogT, slot)} (${t("empty")})`
                  }
                />
              </div>
            );
          })}
        </div>
      </div>
      <aside className="yanmar-gear-mgr-compact-stats" aria-label={t("stats")}>
        <header className="yanmar-gear-mgr-pane-head">
          <h3>{t("stats")}</h3>
        </header>
        <div className="yanmar-gear-mgr-stats-stack">
          <div
            className="yanmar-gear-mgr-stat-grid yanmar-gear-mgr-stat-grid--2x3"
            aria-label={t("baseStats")}
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
            aria-label={t("combatWorkStats")}
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
  );
}
