"use client";

import { useState } from "react";
import { StarAmount } from "@/components/StarAmount";
import {
  DEFAULT_YANMAR_EQUIPMENT_LEVELS,
  YANMAR_EQUIPMENT_CONFIG,
  YANMAR_EQUIPMENT_RESET_REFUND_RATE,
  getYanmarResetRefundStars,
  getYanmarUpgradeCost,
  type YanmarEquipmentLevels,
  type YanmarEquipmentPart,
} from "./equipment";
import type { GameMode } from "./tutorial";
import { YANMAR_UPGRADE_VISUALS, type UpgradeHotspotPart } from "./upgradeVisualConfig";

interface EquipmentUpgradePanelProps {
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
}

const HOTSPOT_PARTS = Object.keys(
  YANMAR_UPGRADE_VISUALS.hotspots,
) as UpgradeHotspotPart[];

export function EquipmentUpgradePanel({
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
}: EquipmentUpgradePanelProps) {
  const [selected, setSelected] = useState<YanmarEquipmentPart>("BOOM");

  if (!open) return null;

  const previewMode = mode !== "game";
  const balance = previewMode ? previewStars : currency;
  const hasPreviewUpgrade = (Object.keys(YANMAR_EQUIPMENT_CONFIG) as YanmarEquipmentPart[]).some(
    (part) => levels[part] !== DEFAULT_YANMAR_EQUIPMENT_LEVELS[part],
  );
  const resetRefundStars = getYanmarResetRefundStars(levels);
  const config = YANMAR_EQUIPMENT_CONFIG[selected];
  const level = levels[selected];
  const nextLevel = level + 1;
  const cost = getYanmarUpgradeCost(selected, nextLevel);
  const maxed = level >= config.maxLevel;
  const upgradeDisabled =
    upgradingPart === selected || maxed || (!previewMode && balance < cost);

  return (
    <div className="absolute inset-0 z-[80] flex flex-col bg-black/65 backdrop-blur-sm">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between bg-gradient-to-br from-slate-800 to-slate-950 px-4 py-3 text-white">
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

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 [-webkit-overflow-scrolling:touch]">
          <div className="mb-3 flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
            <span>{previewMode ? "체험 스타" : "보유 스타"}</span>
            <StarAmount value={balance} size={16} valueClassName="text-amber-900" />
          </div>

          <div className="relative mb-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            <img
              src={YANMAR_UPGRADE_VISUALS.excavatorDiagram}
              alt="굴착기 부품 diagram"
              className="block w-full object-contain"
              draggable={false}
            />
            <img
              src={YANMAR_UPGRADE_VISUALS.dumpTruckDiagram}
              alt=""
              className="pointer-events-none absolute bottom-1 right-2 w-[34%] object-contain drop-shadow-xl"
              draggable={false}
            />
            {HOTSPOT_PARTS.map((part) => {
              const spot = YANMAR_UPGRADE_VISUALS.hotspots[part];
              const partLevel = levels[part];
              const isSelected = selected === part;
              const partMaxed = partLevel >= YANMAR_EQUIPMENT_CONFIG[part].maxLevel;
              return (
                <button
                  key={part}
                  type="button"
                  onClick={() => setSelected(part)}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 px-1.5 py-0.5 text-[9px] font-black shadow-lg transition ${
                    isSelected
                      ? "border-amber-300 bg-red-600 text-white ring-2 ring-amber-300/60"
                      : partLevel > 0
                        ? "border-amber-400/80 bg-slate-900/85 text-amber-100"
                        : "border-white/70 bg-black/55 text-white hover:bg-black/75"
                  } ${isSelected ? "yanmar-hotspot-pulse" : ""}`}
                  style={{
                    left: `${spot.x * 100}%`,
                    top: `${spot.y * 100}%`,
                  }}
                  aria-label={`${spot.label} 강화 +${partLevel}`}
                >
                  {spot.label}
                  <span className={partMaxed ? "text-amber-300" : "text-red-300"}>
                    +{partLevel}
                  </span>
                </button>
              );
            })}
          </div>

          {hasPreviewUpgrade ? (
            <button
              type="button"
              onClick={onResetEquipment}
              disabled={!hasPreviewUpgrade || resettingEquipment}
              className="mb-3 w-full rounded-xl border border-slate-200 bg-slate-900 px-3 py-2 text-xs font-black text-white disabled:bg-gray-200 disabled:text-gray-400"
            >
              {resettingEquipment
                ? "초기화중"
                : previewMode
                  ? "튜토리얼 강화 초기화"
                  : `강화 초기화 (${Math.round(YANMAR_EQUIPMENT_RESET_REFUND_RATE * 100)}% 환급 ${resetRefundStars}⭐)`}
            </button>
          ) : null}

          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-sm font-black text-gray-900">
              {config.label} 강화{" "}
              <span
                className={
                  maxed ? "text-amber-500" : level > 0 ? "text-red-600" : "text-slate-400"
                }
              >
                +{level}
              </span>
            </p>
            <p className="mt-1 text-[11px] text-gray-500">
              {config.description} · 최대{" "}
              <span className="font-bold text-amber-600">+{config.maxLevel}</span>
            </p>
            <p className="mt-2 text-[10px] text-slate-500">
              선택한 부위가 diagram에서 강조됩니다. 강화 단계는 장비의 성능과 시각 강조에
              함께 반영됩니다.
            </p>
            <button
              type="button"
              onClick={() => onUpgrade(selected)}
              disabled={upgradeDisabled}
              className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:bg-gray-300"
            >
              {maxed ? (
                "최대 강화"
              ) : upgradingPart === selected ? (
                "강화중..."
              ) : previewMode ? (
                "체험 강화"
              ) : (
                <>
                  <StarAmount value={cost} size={14} valueClassName="text-white" /> 강화
                </>
              )}
            </button>
            {!previewMode && !maxed && balance < cost ? (
              <p className="mt-1 text-center text-[10px] text-red-500">스타가 부족합니다.</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
