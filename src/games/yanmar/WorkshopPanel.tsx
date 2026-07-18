"use client";

import { useEffect, useMemo, useState } from "react";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import { getPlayerLevelProgress } from "@/lib/playerLevel";
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
import type { WorkshopPendingInfo } from "./workshop/pending";
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
import {
  formatUpgradeRemaining,
  getUpgradeDurationMs,
  getWorkshopUpgradeRequiredPlayerLevel,
  instantCompleteStars,
} from "./upgradeTimers";

type TabId = "quest" | "upgrade" | "shop";

export interface WorkshopPanelState {
  points: Record<WorkshopId, number>;
  levels: Record<WorkshopId, Record<string, number>>;
  shopPurchases: Record<
    WorkshopId,
    Record<string, { count: number; remaining: number }>
  >;
  weekKey: string;
  pendingByWorkshop?: Partial<Record<WorkshopId, WorkshopPendingInfo>>;
  totalXp?: number;
  currency?: number;
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
  onInstantUpgrade?: () => void | Promise<void>;
  onShopPurchase: (itemId: WorkshopShopItemId) => void | Promise<void>;
}

function WorkshopPointsAmount({
  icon,
  value,
  label,
  size = 18,
  className = "",
}: {
  icon: string;
  value: number | string;
  label?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 tabular-nums ${className}`.trim()}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={icon}
        alt=""
        width={size}
        height={size}
        className="shrink-0 object-contain"
        style={{ width: size, height: size }}
        draggable={false}
      />
      <span>{typeof value === "number" ? value.toLocaleString() : value}</span>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
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
  onInstantUpgrade,
  onShopPurchase,
}: WorkshopPanelProps) {
  const [tab, setTab] = useState<TabId>("quest");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [confirmUpgrade, setConfirmUpgrade] = useState<{
    key: WorkshopUpgradeKey;
    label: string;
    fromLevel: number;
    toLevel: number;
    cost: number;
    durationMs: number;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (!open) setConfirmUpgrade(null);
  }, [open, workshopId]);

  const def = workshopId ? WORKSHOP_DEFS[workshopId] : null;
  const points = workshopId && panelState ? panelState.points[workshopId] : 0;
  const levels =
    workshopId && panelState ? panelState.levels[workshopId] : {};
  const shopPurchases =
    workshopId && panelState ? panelState.shopPurchases[workshopId] : {};
  const pending =
    workshopId && panelState?.pendingByWorkshop
      ? panelState.pendingByWorkshop[workshopId]
      : undefined;
  const playerLevel = getPlayerLevelProgress(panelState?.totalXp ?? 0).level;
  const currency = panelState?.currency ?? 0;

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

  const coin = def.pointsIcon;

  return (
    <AppModalOverlay
      open={open}
      onClose={onClose}
      nested
      panelClassName="!max-w-[min(96vw,26rem)] !overflow-hidden landscape:!max-h-[min(94dvh,32rem)]"
    >
      <div className="yanmar-workshop-panel flex h-[min(88dvh,36rem)] w-full flex-col overflow-hidden rounded-2xl border border-stone-400/40 bg-[#1c2430]/96 text-stone-100 shadow-2xl backdrop-blur-md landscape:h-[min(92dvh,26rem)]">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <h2 className="min-w-0 flex-1 truncate text-lg font-black tracking-tight">
            {def.label}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            <div
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/35 bg-amber-500/10 px-2.5 py-1.5 text-sm font-black text-amber-100 shadow-inner"
              title={def.pointsLabel}
            >
              <WorkshopPointsAmount
                icon={coin}
                value={points}
                label={def.pointsLabel}
                size={20}
              />
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg px-2 py-1 text-sm text-stone-300 hover:bg-white/10"
              onClick={onClose}
            >
              닫기
            </button>
          </div>
        </header>

        <div className="flex shrink-0 gap-1 border-b border-white/10 px-2 pt-2">
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

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-3">
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
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">{q.title}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-stone-400">
                            {q.kind === "daily" ? "일일" : "반복"}
                          </span>
                          <WorkshopPointsAmount
                            icon={coin}
                            value={q.rewardPoints}
                            size={16}
                            className="text-xs font-bold text-amber-200"
                          />
                        </div>
                        {canClaim ? (
                          <button
                            type="button"
                            disabled={busy}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white disabled:opacity-50"
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
                const targetLevel = level + 1;
                const reqLevel =
                  getWorkshopUpgradeRequiredPlayerLevel(targetLevel) ?? 999;
                const levelLocked = !maxed && playerLevel < reqLevel;
                const durationMs = getUpgradeDurationMs(targetLevel);
                const isThisPending =
                  pending?.upgradeKey === u.key &&
                  pending.targetLevel === targetLevel;
                const otherPending = Boolean(pending) && !isThisPending;
                const remainingMs = isThisPending
                  ? new Date(pending!.completesAt).getTime() - nowMs
                  : null;
                const instantCost =
                  remainingMs != null
                    ? instantCompleteStars(remainingMs)
                    : 0;
                const canBuy =
                  !maxed &&
                  !pending &&
                  !levelLocked &&
                  cost != null &&
                  points >= cost;
                return (
                  <li
                    key={u.key}
                    className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">
                          {u.label}{" "}
                          <span className="text-amber-200">
                            +{level}/{max}
                          </span>
                          {!maxed ? (
                            <span
                              className={`ml-1.5 text-[11px] font-extrabold ${
                                levelLocked
                                  ? "text-red-400"
                                  : "text-stone-400"
                              }`}
                            >
                              레벨제한{reqLevel}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-xs text-stone-400">
                          {u.description}
                        </p>
                        {!maxed ? (
                          <p className="mt-1 text-[11px] text-sky-200/90">
                            {effectPreview(workshopId, u.key, level)}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {isThisPending && onInstantUpgrade ? (
                          <button
                            type="button"
                            disabled={busy || currency < instantCost}
                            className="inline-flex items-center justify-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-black text-white disabled:opacity-40"
                            onClick={() => void onInstantUpgrade()}
                          >
                            즉시완료 ★{instantCost.toLocaleString()}
                            {currency < instantCost ? " (부족)" : ""}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={
                              busy ||
                              maxed ||
                              levelLocked ||
                              !canBuy ||
                              otherPending
                            }
                            className="inline-flex items-center justify-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-black text-white disabled:opacity-40"
                            onClick={() => {
                              if (
                                cost == null ||
                                durationMs == null ||
                                levelLocked
                              )
                                return;
                              setConfirmUpgrade({
                                key: u.key,
                                label: u.label,
                                fromLevel: level,
                                toLevel: targetLevel,
                                cost,
                                durationMs,
                              });
                            }}
                          >
                            {maxed ? (
                              "MAX"
                            ) : (
                              <WorkshopPointsAmount
                                icon={coin}
                                value={cost ?? 0}
                                size={14}
                              />
                            )}
                          </button>
                        )}
                        {!maxed &&
                        (isThisPending
                          ? remainingMs != null
                          : durationMs != null) ? (
                          <p
                            className={`text-[11px] tabular-nums ${
                              isThisPending
                                ? "font-semibold text-amber-200"
                                : "text-stone-500"
                            }`}
                          >
                            {formatUpgradeRemaining(
                              isThisPending ? remainingMs! : durationMs!,
                            )}
                          </p>
                        ) : null}
                      </div>
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
                      {/* eslint-disable-next-line @next/next/no-img-element */}
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
                        className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-black text-white disabled:opacity-40"
                        onClick={() => void onShopPurchase(item.id)}
                      >
                        <WorkshopPointsAmount
                          icon={coin}
                          value={item.cost}
                          size={14}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>

        {confirmUpgrade ? (
          <div
            className="yanmar-repair-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="yanmar-workshop-upgrade-confirm-title"
          >
            <div className="yanmar-repair-confirm-card">
              <h3 id="yanmar-workshop-upgrade-confirm-title">업그레이드 확인</h3>
              <p className="yanmar-repair-confirm-item">
                {confirmUpgrade.label} +{confirmUpgrade.fromLevel} → +
                {confirmUpgrade.toLevel}
              </p>
              <ul className="yanmar-repair-confirm-facts">
                <li className="yanmar-repair-confirm-cost">
                  소모{" "}
                  <WorkshopPointsAmount
                    icon={coin}
                    value={confirmUpgrade.cost}
                    size={14}
                  />
                </li>
                <li>
                  소요 시간{" "}
                  {formatUpgradeRemaining(confirmUpgrade.durationMs)}
                </li>
              </ul>
              <div className="yanmar-repair-confirm-actions">
                <button
                  type="button"
                  className="yanmar-repair-confirm-cancel"
                  disabled={busy}
                  onClick={() => setConfirmUpgrade(null)}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="yanmar-repair-confirm-ok"
                  disabled={busy}
                  onClick={() => {
                    const key = confirmUpgrade.key;
                    setConfirmUpgrade(null);
                    void onUpgrade(key);
                  }}
                >
                  업그레이드
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppModalOverlay>
  );
}
