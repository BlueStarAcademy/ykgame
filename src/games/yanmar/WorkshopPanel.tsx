"use client";

import { useMemo, useState } from "react";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import {
  WORKSHOP_DEFS,
  WORKSHOP_SHOP_ITEMS,
  getWorkshopUpgradeCost,
  getWorkshopUpgradeMaxLevel,
  type WorkshopId,
  type WorkshopShopItemId,
  type WorkshopUpgradeKey,
} from "./workshop";
import type { WorkshopQuestProgressItem } from "./workshop/questState";
import {
  getYanmarHaulTruckCooldownSec,
  getYanmarTruckCapacityUnits,
  getYanmarTruckCooldownSec,
  YANMAR_BASE_HAUL_TRUCK_CAPACITY,
  YANMAR_BASE_HILL_BOULDER_COUNT,
} from "./equipment";
import {
  workshopBreakerPowerMult,
  workshopHaulTruckCapacity,
  workshopHillBoulderCount,
  workshopLuckyDropBonus,
  workshopScoreMult,
  workshopXpMult,
} from "./workshop/effects";

type TabId = "quest" | "upgrade" | "shop";

export interface WorkshopPanelState {
  points: Record<WorkshopId, number>;
  levels: Record<WorkshopId, Record<string, number>>;
  shopPurchases: Record<
    WorkshopId,
    Record<string, { count: number; remaining: number }>
  >;
  weekKey: string;
}

interface WorkshopPanelProps {
  open: boolean;
  workshopId: WorkshopId | null;
  onClose: () => void;
  panelState: WorkshopPanelState | null;
  questItems: WorkshopQuestProgressItem[];
  busy?: boolean;
  onClaimQuest: (questId: string) => void | Promise<void>;
  onUpgrade: (upgradeKey: WorkshopUpgradeKey) => void | Promise<void>;
  onShopPurchase: (itemId: WorkshopShopItemId) => void | Promise<void>;
}

function effectPreview(
  workshopId: WorkshopId,
  key: WorkshopUpgradeKey,
  level: number,
): string {
  const next = level + 1;
  if (key === "truck_capacity") {
    return `${getYanmarTruckCapacityUnits(level).toLocaleString()} → ${getYanmarTruckCapacityUnits(next).toLocaleString()}`;
  }
  if (key === "truck_cooldown") {
    return `${getYanmarTruckCooldownSec(level)}초 → ${getYanmarTruckCooldownSec(next)}초`;
  }
  if (key === "haul_capacity") {
    return `${workshopHaulTruckCapacity(level)} → ${workshopHaulTruckCapacity(Math.min(10, next))} (기본 ${YANMAR_BASE_HAUL_TRUCK_CAPACITY})`;
  }
  if (key === "haul_cooldown") {
    return `${getYanmarHaulTruckCooldownSec(level)}초 → ${getYanmarHaulTruckCooldownSec(next)}초`;
  }
  if (key === "breaker_power") {
    return `×${workshopBreakerPowerMult(level).toFixed(1)} → ×${workshopBreakerPowerMult(next).toFixed(1)}`;
  }
  if (key === "score_rank") {
    return `+${Math.round((workshopScoreMult(level) - 1) * 100)}% → +${Math.round((workshopScoreMult(next) - 1) * 100)}%`;
  }
  if (key === "xp_expert") {
    return `+${Math.round((workshopXpMult(level) - 1) * 100)}% → +${Math.round((workshopXpMult(next) - 1) * 100)}%`;
  }
  if (key === "lucky_drop") {
    return `+${(workshopLuckyDropBonus(level) * 100).toFixed(1)}%p → +${(workshopLuckyDropBonus(next) * 100).toFixed(1)}%p`;
  }
  if (key === "rock_appraiser") {
    return `${workshopHillBoulderCount(level)}개 → ${workshopHillBoulderCount(Math.min(5, next))}개 (기본 ${YANMAR_BASE_HILL_BOULDER_COUNT})`;
  }
  void workshopId;
  return "";
}

export function WorkshopPanel({
  open,
  workshopId,
  onClose,
  panelState,
  questItems,
  busy,
  onClaimQuest,
  onUpgrade,
  onShopPurchase,
}: WorkshopPanelProps) {
  const [tab, setTab] = useState<TabId>("quest");

  const def = workshopId ? WORKSHOP_DEFS[workshopId] : null;
  const points = workshopId && panelState ? panelState.points[workshopId] : 0;
  const levels =
    workshopId && panelState ? panelState.levels[workshopId] : {};
  const shopPurchases =
    workshopId && panelState ? panelState.shopPurchases[workshopId] : {};

  const questRows = useMemo(() => {
    if (!def) return [];
    return def.quests.map((q) => {
      const item = questItems.find((i) => i.id === q.id) ?? {
        id: q.id,
        progress: 0,
        completed: false,
        claimed: false,
      };
      return { def: q, item };
    });
  }, [def, questItems]);

  if (!open || !workshopId || !def) return null;

  return (
    <AppModalOverlay open={open} onClose={onClose} nested>
      <div className="yanmar-workshop-panel mx-auto flex max-h-[min(92vh,720px)] w-[min(96vw,440px)] flex-col overflow-hidden rounded-2xl border border-stone-400/40 bg-[#1c2430]/96 text-stone-100 shadow-2xl backdrop-blur-md">
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
            <h2 className="text-lg font-black tracking-tight">{def.label}</h2>
            <p className="mt-1 text-sm font-semibold text-amber-200">
              {def.pointsLabel}:{" "}
              <span className="tabular-nums">{points.toLocaleString()}</span>
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-sm text-stone-300 hover:bg-white/10"
            onClick={onClose}
          >
            닫기
          </button>
        </header>

        <div className="flex gap-1 border-b border-white/10 px-2 pt-2">
          {(
            [
              ["quest", "퀘스트"],
              ["upgrade", "업그레이드"],
              ["shop", "상점"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`flex-1 rounded-t-lg px-2 py-2 text-sm font-bold ${
                tab === id
                  ? "bg-white/15 text-white"
                  : "text-stone-400 hover:bg-white/5"
              }`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {tab === "quest" ? (
            <ul className="flex flex-col gap-2">
              {questRows.map(({ def: q, item }) => {
                const canClaim = item.completed && !item.claimed;
                const pct = Math.min(100, (item.progress / q.target) * 100);
                return (
                  <li
                    key={q.id}
                    className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold">{q.title}</p>
                        <p className="mt-0.5 text-xs text-stone-400">
                          {q.kind === "daily" ? "일일" : "반복"} · 보상{" "}
                          {q.rewardPoints}pt
                        </p>
                      </div>
                      {canClaim ? (
                        <button
                          type="button"
                          disabled={busy}
                          className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white disabled:opacity-50"
                          onClick={() => void onClaimQuest(q.id)}
                        >
                          완료
                        </button>
                      ) : item.claimed && q.kind === "daily" ? (
                        <span className="text-xs font-semibold text-stone-500">
                          수령됨
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-amber-400/80"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-right text-[11px] tabular-nums text-stone-400">
                      {Math.min(item.progress, q.target).toLocaleString()} /{" "}
                      {q.target.toLocaleString()}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {tab === "upgrade" ? (
            <ul className="flex flex-col gap-2">
              {def.upgrades.map((u) => {
                const level = levels[u.key] ?? 0;
                const max = getWorkshopUpgradeMaxLevel(u.key);
                const cost = getWorkshopUpgradeCost(u.key, level);
                const maxed = level >= max;
                const canBuy = !maxed && cost != null && points >= cost;
                return (
                  <li
                    key={u.key}
                    className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold">
                          {u.label}{" "}
                          <span className="text-amber-200">
                            +{level}/{max}
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-stone-400">
                          {u.description}
                        </p>
                        {!maxed ? (
                          <p className="mt-1 text-[11px] text-sky-200/90">
                            {effectPreview(
                              workshopId,
                              u.key,
                              level,
                            )}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        disabled={busy || !canBuy}
                        className="shrink-0 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-black text-white disabled:opacity-40"
                        onClick={() => void onUpgrade(u.key)}
                      >
                        {maxed
                          ? "MAX"
                          : `${(cost ?? 0).toLocaleString()}pt`}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {tab === "shop" ? (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] text-stone-400">
                상품당 주간 {WORKSHOP_SHOP_ITEMS[0]?.weeklyLimit ?? 3}회 ·
                월요일 0시(KST) 리셋
              </p>
              <ul className="flex flex-col gap-2">
                {WORKSHOP_SHOP_ITEMS.map((item) => {
                  const purchase = shopPurchases[item.id] ?? {
                    count: 0,
                    remaining: item.weeklyLimit,
                  };
                  const canBuy =
                    points >= item.cost && purchase.remaining > 0;
                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5"
                    >
                      <img
                        src={item.icon}
                        alt=""
                        className="h-12 w-12 shrink-0 object-contain"
                        draggable={false}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">{item.label}</p>
                        <p className="text-xs text-stone-400">
                          {item.description}
                        </p>
                        <p className="mt-0.5 text-[11px] text-stone-500">
                          이번 주 {purchase.count}/{item.weeklyLimit}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={busy || !canBuy}
                        className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-black text-white disabled:opacity-40"
                        onClick={() => void onShopPurchase(item.id)}
                      >
                        {item.cost.toLocaleString()}pt
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </AppModalOverlay>
  );
}
