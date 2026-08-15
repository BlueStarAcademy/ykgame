"use client";

import { useTranslations } from "next-intl";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import { GearIconCell } from "@/games/yanmar/GearIconCell";
import {
  MAIN_OPTION_BY_SLOT,
  MASTER_OPTION_POOL,
  SUB_OPTION_POOL,
  type GearSlot,
  type ItemGrade,
  type MasterOptionKey,
  type SubOptionKey,
} from "@/games/yanmar/gearCatalog";
import {
  gearGradeLabel,
  gearItemDisplayName,
  gearSlotLabel,
  gearStatLabel,
} from "@/i18n/yanmarCatalog";
import type { ChatGearSnapshot } from "@/lib/chat/types";

function gradeTextClass(grade: ItemGrade) {
  switch (grade) {
    case "NORMAL":
      return "text-slate-200";
    case "ENHANCED":
      return "text-emerald-300";
    case "PRECISION":
      return "text-sky-300";
    case "MASTER":
      return "text-amber-300";
    default:
      return "text-amber-100";
  }
}

function parseMainOption(raw: unknown): { key: string; value: number } | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.key !== "string" || typeof obj.value !== "number") return null;
  return { key: obj.key, value: obj.value };
}

function parseSubOptions(raw: unknown): {
  key: string;
  tier: number;
  value: number;
  rollMin: number;
  rollMax: number;
  isPercent?: boolean;
}[] {
  if (!Array.isArray(raw)) return [];
  const out: {
    key: string;
    tier: number;
    value: number;
    rollMin: number;
    rollMax: number;
    isPercent?: boolean;
  }[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const obj = entry as Record<string, unknown>;
    if (typeof obj.key !== "string" || typeof obj.value !== "number") continue;
    const pool = SUB_OPTION_POOL.find((s) => s.key === obj.key);
    out.push({
      key: obj.key,
      tier: typeof obj.tier === "number" ? obj.tier : 1,
      value: obj.value,
      rollMin:
        typeof obj.rollMin === "number" ? obj.rollMin : (pool?.rollMin ?? 0),
      rollMax:
        typeof obj.rollMax === "number" ? obj.rollMax : (pool?.rollMax ?? 0),
      isPercent:
        typeof obj.isPercent === "boolean"
          ? obj.isPercent
          : pool?.isPercent,
    });
  }
  return out;
}

function parseMasterOption(raw: unknown): {
  key: string;
  value: number;
  label: string;
  hideValue: boolean;
  isPercent: boolean;
} | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.key !== "string") return null;
  const pool = MASTER_OPTION_POOL.find((m) => m.key === obj.key);
  return {
    key: obj.key,
    value: typeof obj.value === "number" ? obj.value : 0,
    label:
      typeof obj.label === "string" && obj.label
        ? obj.label
        : (pool?.label ?? obj.key),
    hideValue:
      typeof obj.hideValue === "boolean"
        ? obj.hideValue
        : Boolean(pool?.hideValue),
    isPercent:
      typeof obj.isPercent === "boolean"
        ? obj.isPercent
        : Boolean(pool?.isPercent),
  };
}

/** Convert equipped gear (profile / panel) into a chat inspect snapshot. */
export function toChatGearSnapshot(item: {
  id: string;
  nameSnapshot: string;
  slot: string;
  grade: string;
  enhanceLevel: number;
  mainOption: unknown;
  subOptions: unknown;
  masterOption: unknown;
  durability?: number;
  durabilityMax?: number;
}): ChatGearSnapshot {
  return {
    itemId: item.id,
    nameSnapshot: item.nameSnapshot,
    slot: item.slot,
    grade: item.grade,
    enhanceLevel: item.enhanceLevel,
    mainOption: item.mainOption,
    subOptions: item.subOptions,
    masterOption: item.masterOption,
    durability: item.durability,
    durabilityMax: item.durabilityMax,
  };
}

export function ChatGearInspectModal({
  snapshot,
  onClose,
  nested = true,
}: {
  snapshot: ChatGearSnapshot;
  onClose: () => void;
  nested?: boolean;
}) {
  const t = useTranslations("shell.chat");
  const gearT = useTranslations("yanmar.gear");
  const catalogT = useTranslations("yanmar");
  const slot = snapshot.slot as GearSlot;
  const grade = snapshot.grade as ItemGrade;
  const mainOption = parseMainOption(snapshot.mainOption);
  const subOptions = parseSubOptions(snapshot.subOptions);
  const masterOption = parseMasterOption(snapshot.masterOption);
  const mainDef = MAIN_OPTION_BY_SLOT[slot];
  const mainLabel = mainOption
    ? `${
        gearStatLabel(catalogT, mainOption.key) ||
        mainDef?.label ||
        mainOption.key
      } +${Math.round(mainOption.value)}${mainDef?.isPercent ? "%" : ""}`
    : null;

  return (
    <AppModalOverlay
      open
      nested={nested}
      onClose={onClose}
      panelClassName="bg-slate-950 text-amber-50 p-4 !max-w-[min(94vw,22rem)]"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-black">{t("inspectGear")}</h3>
        <button
          type="button"
          className="rounded-lg bg-white/10 px-2 py-1 text-xs"
          onClick={onClose}
        >
          {t("close")}
        </button>
      </div>

      <div
        className={`yanmar-gear-bubble-card mt-3${
          grade === "MASTER" ? " is-master" : ""
        }${grade === "PRECISION" ? " is-precision" : ""}`}
      >
        <div className="yanmar-gear-mgr-detail">
          <GearIconCell
            slot={slot}
            grade={grade}
            enhanceLevel={snapshot.enhanceLevel}
            size="md"
          />
          <div className="yanmar-gear-mgr-detail-meta">
            <p className={`yanmar-gear-mgr-name ${gradeTextClass(grade)}`}>
              {snapshot.nameSnapshot ||
                gearItemDisplayName(catalogT, slot, grade)}
              {snapshot.enhanceLevel > 0 ? ` +${snapshot.enhanceLevel}` : ""}
            </p>
            <p className="yanmar-gear-mgr-grade">
              {gearSlotLabel(catalogT, slot)} · {gearGradeLabel(catalogT, grade)}
            </p>
            {mainLabel ? (
              <p className="yanmar-gear-mgr-main">
                <span className="yanmar-gear-mgr-attr-main">{mainLabel}</span>
              </p>
            ) : null}
          </div>
        </div>

        {subOptions.length > 0 || masterOption ? (
          <ul className="yanmar-gear-mgr-attr-list">
            {subOptions.map((sub) => {
              const def = SUB_OPTION_POOL.find(
                (s) => s.key === (sub.key as SubOptionKey),
              );
              const label =
                gearStatLabel(catalogT, sub.key) || def?.label || sub.key;
              const unit = sub.isPercent ? "%" : "";
              const tier = Math.max(1, Math.floor(Number(sub.tier) || 1));
              const rangeMin = Math.round(sub.rollMin) * tier;
              const rangeMax = Math.round(sub.rollMax) * tier;
              return (
                <li key={`${sub.key}-${sub.tier}-${sub.value}`}>
                  <span className="yanmar-gear-mgr-attr-stat">
                    {label} +{Math.round(sub.value)}
                    {unit}
                  </span>
                  <span className="yanmar-gear-mgr-attr-range yanmar-gear-muted">
                    {gearT("tierRange", {
                      min: rangeMin,
                      max: rangeMax,
                      tier,
                    })}
                  </span>
                </li>
              );
            })}
            {masterOption ? (
              <li className="is-master-opt">
                <span className="yanmar-gear-master-marker">{gearT("master")}</span>
                <span className="yanmar-gear-master-body">
                  {MASTER_OPTION_POOL.find(
                    (m) => m.key === (masterOption.key as MasterOptionKey),
                  )?.label ?? masterOption.label}
                  {!masterOption.hideValue
                    ? ` ${Math.round(masterOption.value)}${
                        masterOption.isPercent ? "%" : ""
                      }`
                    : ""}
                </span>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </AppModalOverlay>
  );
}
