"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import { getPlayerLevelProgress } from "@/lib/playerLevel";
import {
  MONUMENT_BUILD_QUESTS,
  MONUMENT_POINTS_ICON,
  MONUMENT_SHOP_ITEMS,
  MONUMENT_STARS_PER_TICK,
  MONUMENT_UPGRADES,
  getMonumentUpgradeCost,
  getMonumentUpgradeMaxLevel,
  monumentIntervalMs,
  monumentStorageCap,
  type MonumentPhase,
  type MonumentUpgradeKey,
} from "./monument";
import type { MonumentPendingInfo } from "./monument/pending";
import type {
  MonumentQuestProgressItem,
  MonumentQuestState,
} from "./monument/questState";
import {
  formatUpgradeRemaining,
  getMonumentUpgradeRequiredPlayerLevel,
  getUpgradeDurationMs,
  instantCompleteStars,
  isUpgradeTimerReady,
} from "./upgradeTimers";
import { formatQuestProgressCurrent } from "./quests/formatProgress";
import type { WorkshopShopItemId } from "./workshop";

type TabId = "quest" | "upgrade" | "shop" | "build";

export interface MonumentPanelState {
  phase: MonumentPhase;
  points: number;
  levels: Record<string, number>;
  pending: MonumentPendingInfo | null;
  constructionEndsAt: string | null;
  starsStored: number;
  /** ISO — 다음 생산 틱 기준 시각 */
  prodUpdatedAt: string | null;
  shopPurchases: Record<string, { count: number; remaining: number }>;
  weekKey: string;
  totalXp?: number;
  currency?: number;
}

interface MonumentPanelProps {
  open: boolean;
  onClose: () => void;
  panelState: MonumentPanelState | null;
  questState: MonumentQuestState | null;
  busy?: boolean;
  onClaimQuest: (questId: string, points: number) => void | Promise<void>;
  onClaimRepeatQuest?: (questId: string, points: number) => void | Promise<void>;
  onUpgrade: (upgradeKey: MonumentUpgradeKey) => void | Promise<void>;
  onInstantUpgrade?: () => void | Promise<void>;
  onShopPurchase: (itemId: WorkshopShopItemId) => void | Promise<void>;
  onStartConstruction?: () => void | Promise<void>;
  onClaimConstruction?: () => void | Promise<void>;
  onClaimStars?: () => void | Promise<void>;
  onRefresh?: () => void | Promise<void>;
}

function PointsAmount({
  value,
  size = 18,
}: {
  value: number | string;
  size?: number;
}) {
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={MONUMENT_POINTS_ICON}
        alt=""
        width={size}
        height={size}
        className="shrink-0 object-contain"
        style={{ width: size, height: size }}
        draggable={false}
      />
      <span>{typeof value === "number" ? value.toLocaleString() : value}</span>
    </span>
  );
}

export function MonumentPanel({
  open,
  onClose,
  panelState,
  questState,
  busy,
  onClaimQuest,
  onClaimRepeatQuest,
  onUpgrade,
  onInstantUpgrade,
  onShopPurchase,
  onStartConstruction,
  onClaimConstruction,
  onClaimStars,
  onRefresh,
}: MonumentPanelProps) {
  const [tab, setTab] = useState<TabId>("quest");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [confirmUpgrade, setConfirmUpgrade] = useState<{
    key: MonumentUpgradeKey;
    label: string;
    fromLevel: number;
    toLevel: number;
    cost: number;
    durationMs: number;
  } | null>(null);
  const autoSettleKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (!open) setConfirmUpgrade(null);
  }, [open]);

  useEffect(() => {
    if (!panelState) return;
    if (panelState.phase === "quest" || panelState.phase === "building") {
      setTab("build");
    } else {
      setTab("quest");
    }
  }, [panelState?.phase, open]);

  const playerLevel = getPlayerLevelProgress(panelState?.totalXp ?? 0).level;
  const pending = panelState?.pending ?? null;
  const levels = panelState?.levels ?? {};
  const storageLv = levels.storage_cap ?? 0;
  const speedLv = levels.prod_speed ?? 0;
  const currency = panelState?.currency ?? 0;

  useEffect(() => {
    if (!open || !pending || !onInstantUpgrade || busy) return;
    const remainingMs = new Date(pending.completesAt).getTime() - nowMs;
    if (!isUpgradeTimerReady(remainingMs)) {
      autoSettleKeyRef.current = null;
      return;
    }
    const key = `${pending.upgradeKey}:${pending.completesAt}`;
    if (autoSettleKeyRef.current === key) return;
    autoSettleKeyRef.current = key;
    void onInstantUpgrade();
  }, [open, pending, nowMs, onInstantUpgrade, busy]);
  const storageCap = monumentStorageCap(storageLv);
  const intervalMs = monumentIntervalMs(speedLv);
  const starsStored = panelState?.starsStored ?? 0;
  const storageFull = starsStored >= storageCap;
  const prodUpdatedMs = panelState?.prodUpdatedAt
    ? Date.parse(panelState.prodUpdatedAt)
    : NaN;
  const nextProdRemainingMs =
    storageFull || !Number.isFinite(prodUpdatedMs)
      ? 0
      : Math.max(0, prodUpdatedMs + intervalMs - nowMs);
  const prevRemainingRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      prevRemainingRef.current = null;
      return;
    }
    if (!onRefresh || storageFull || !Number.isFinite(prodUpdatedMs)) return;
    const prev = prevRemainingRef.current;
    prevRemainingRef.current = nextProdRemainingMs;
    if (prev != null && prev > 0 && nextProdRemainingMs <= 0) {
      void onRefresh();
    }
  }, [
    open,
    onRefresh,
    storageFull,
    prodUpdatedMs,
    nextProdRemainingMs,
  ]);

  const buildComplete = useMemo(() => {
    if (!questState) return false;
    return MONUMENT_BUILD_QUESTS.every((q) => questState.build[q.id]?.completed);
  }, [questState]);

  if (!open || !panelState) return null;

  const phase = panelState.phase;
  const showManage = phase === "active";
  const canClaimStars = showManage && starsStored > 0;
  const storagePct = Math.min(
    100,
    Math.round((starsStored / Math.max(1, storageCap)) * 100),
  );

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
            YK 조형물
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            <div
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/35 bg-amber-500/10 px-2.5 py-1.5 text-sm font-black text-amber-100 shadow-inner"
              title="조형물 포인트"
            >
              <PointsAmount value={panelState.points} size={20} />
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

        {showManage ? (
          <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="inline-flex items-center gap-1 text-sm font-black tabular-nums text-amber-100">
                  <img
                    src="/images/star-currency.svg"
                    alt=""
                    width={16}
                    height={16}
                    className="yanmar-score-panel-star shrink-0"
                    draggable={false}
                  />
                  {starsStored.toLocaleString()}
                </span>
                <span className="text-[11px] font-semibold tabular-nums text-stone-400">
                  / {storageCap.toLocaleString()}
                </span>
                {!storageFull ? (
                  <span className="truncate text-[10px] font-semibold text-stone-400">
                    · 다음{" "}
                    <span className="tabular-nums text-amber-100/90">
                      {formatUpgradeRemaining(nextProdRemainingMs)}
                    </span>
                    {" · "}
                    {MONUMENT_STARS_PER_TICK}/
                    {intervalMs >= 60_000
                      ? `${Math.round(intervalMs / 60_000)}분`
                      : `${Math.round(intervalMs / 1000)}초`}
                  </span>
                ) : (
                  <span className="truncate text-[10px] font-semibold text-amber-200/90">
                    · 저장 가득 참
                  </span>
                )}
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-black/40">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-300 to-yellow-200 transition-[width] duration-500"
                  style={{ width: `${storagePct}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              disabled={busy || !canClaimStars || !onClaimStars}
              onClick={() => void onClaimStars?.()}
              className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-amber-200/45 bg-gradient-to-b from-amber-200 to-amber-500 px-2.5 py-1.5 text-xs font-black text-[#3b2208] transition enabled:hover:brightness-105 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-none disabled:bg-white/10 disabled:text-stone-500"
            >
              {canClaimStars ? (
                <>
                  수령
                  <img
                    src="/images/star-currency.svg"
                    alt=""
                    width={12}
                    height={12}
                    className="yanmar-score-panel-star shrink-0"
                    draggable={false}
                  />
                  {starsStored.toLocaleString()}
                </>
              ) : (
                "수령"
              )}
            </button>
          </div>
        ) : null}

        {showManage ? (
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
        ) : null}

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-3">
          {phase === "quest" ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-stone-300">
                기본 미션 3개를 완료하면 건설을 시작할 수 있습니다.
              </p>
              <ul className="flex flex-col gap-2">
                {MONUMENT_BUILD_QUESTS.map((q) => {
                  const item: MonumentQuestProgressItem = questState?.build[
                    q.id
                  ] ?? {
                    id: q.id,
                    progress: 0,
                    completed: false,
                    claimed: false,
                  };
                  const pct = Math.min(100, (item.progress / q.target) * 100);
                  return (
                    <li
                      key={q.id}
                      className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5"
                    >
                      <p className="text-sm font-bold">{q.title}</p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-amber-400/80"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1 text-right text-[11px] tabular-nums text-stone-400">
                        {formatQuestProgressCurrent(
                          item.progress,
                          q.target,
                          q.metric,
                        ).toLocaleString()}{" "}
                        / {q.target.toLocaleString()}
                        {item.completed ? " ✓" : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
              {onStartConstruction ? (
                <button
                  type="button"
                  disabled={busy || !buildComplete}
                  className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-40"
                  onClick={() => void onStartConstruction()}
                >
                  건설 시작 (60분)
                </button>
              ) : null}
            </div>
          ) : null}

          {phase === "building" ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-base font-bold">건설 진행 중</p>
              <p className="text-2xl font-black tabular-nums text-amber-200">
                {panelState.constructionEndsAt
                  ? formatUpgradeRemaining(
                      new Date(panelState.constructionEndsAt).getTime() - nowMs,
                    )
                  : "—"}
              </p>
              <p className="text-xs text-stone-400">
                시간이 끝나면 가까이에서 건설완료를 눌러 주세요.
              </p>
            </div>
          ) : null}

          {phase === "claimable" ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <p className="text-base font-bold text-emerald-300">
                건설이 완료되었습니다!
              </p>
              {onClaimConstruction ? (
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-40"
                  onClick={() => void onClaimConstruction()}
                >
                  건설완료
                </button>
              ) : null}
            </div>
          ) : null}

          {showManage && tab === "quest" ? (
            <ul className="flex flex-col gap-2">
              {(questState?.daily ?? []).map((q) => {
                const item = questState?.dailyProgress[q.id] ?? {
                  id: q.id,
                  progress: 0,
                  completed: false,
                  claimed: false,
                };
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
                          <span className="text-xs text-stone-400">일일</span>
                          <PointsAmount value={q.rewardPoints} size={16} />
                        </div>
                        {canClaim ? (
                          <button
                            type="button"
                            disabled={busy}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white disabled:opacity-50"
                            onClick={() =>
                              void onClaimQuest(q.id, q.rewardPoints)
                            }
                          >
                            완료
                          </button>
                        ) : item.claimed ? (
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
                      {formatQuestProgressCurrent(
                        item.progress,
                        q.target,
                        q.metric,
                      ).toLocaleString()}{" "}
                      / {q.target.toLocaleString()}
                    </p>
                  </li>
                );
              })}
              {(questState?.repeat ?? []).map((q) => {
                const item = questState?.repeatProgress[q.id] ?? {
                  id: q.id,
                  progress: 0,
                  completed: false,
                  claimed: false,
                };
                const canClaim = item.completed;
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
                          <span className="text-xs text-stone-400">반복</span>
                          <PointsAmount value={q.rewardPoints} size={16} />
                        </div>
                        {canClaim ? (
                          <button
                            type="button"
                            disabled={busy || !onClaimRepeatQuest}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white disabled:opacity-50"
                            onClick={() =>
                              void onClaimRepeatQuest?.(q.id, q.rewardPoints)
                            }
                          >
                            완료
                          </button>
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
                      {formatQuestProgressCurrent(
                        item.progress,
                        q.target,
                        q.metric,
                      ).toLocaleString()}{" "}
                      / {q.target.toLocaleString()}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {showManage && tab === "upgrade" ? (
            <ul className="flex flex-col gap-2">
              {MONUMENT_UPGRADES.map((u) => {
                const level = levels[u.key] ?? 0;
                const max = getMonumentUpgradeMaxLevel(u.key);
                const cost = getMonumentUpgradeCost(u.key, level);
                const maxed = level >= max;
                const targetLevel = level + 1;
                const reqLevel =
                  getMonumentUpgradeRequiredPlayerLevel(targetLevel) ?? 999;
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
                const timerReady =
                  remainingMs != null && isUpgradeTimerReady(remainingMs);
                const canBuy =
                  !maxed &&
                  !pending &&
                  !levelLocked &&
                  cost != null &&
                  panelState.points >= cost;
                const nextPreview =
                  u.key === "storage_cap"
                    ? `${monumentStorageCap(level)} → ${monumentStorageCap(targetLevel)}`
                    : `${Math.round(monumentIntervalMs(level) / 1000)}초 → ${Math.round(monumentIntervalMs(targetLevel) / 1000)}초`;
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
                        {!maxed ? (
                          <p className="mt-1 text-[11px] text-sky-200/90">
                            {nextPreview}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {isThisPending && onInstantUpgrade ? (
                          <button
                            type="button"
                            disabled={
                              busy || (!timerReady && currency < instantCost)
                            }
                            className="inline-flex items-center justify-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-black text-white disabled:opacity-40"
                            onClick={() => void onInstantUpgrade()}
                          >
                            {timerReady
                              ? "완료"
                              : `즉시완료 ★${instantCost.toLocaleString()}`}
                            {!timerReady && currency < instantCost
                              ? " (부족)"
                              : ""}
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
                              <PointsAmount value={cost ?? 0} size={14} />
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

          {showManage && tab === "shop" ? (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] text-stone-400">
                상품당 주간 {MONUMENT_SHOP_ITEMS[0]?.weeklyLimit ?? 3}회 ·
                월요일 0시(KST) 리셋
              </p>
              <ul className="flex flex-col gap-2">
                {MONUMENT_SHOP_ITEMS.map((item) => {
                  const purchase = panelState.shopPurchases[item.id] ?? {
                    count: 0,
                    remaining: item.weeklyLimit,
                  };
                  const canBuy =
                    panelState.points >= item.cost && purchase.remaining > 0;
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
                      </div>
                      <button
                        type="button"
                        disabled={busy || !canBuy}
                        className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-black text-white disabled:opacity-40"
                        onClick={() =>
                          void onShopPurchase(item.id as WorkshopShopItemId)
                        }
                      >
                        <PointsAmount value={item.cost} size={14} />
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
            aria-labelledby="yanmar-monument-upgrade-confirm-title"
          >
            <div className="yanmar-repair-confirm-card">
              <h3 id="yanmar-monument-upgrade-confirm-title">업그레이드 확인</h3>
              <p className="yanmar-repair-confirm-item">
                {confirmUpgrade.label} +{confirmUpgrade.fromLevel} → +
                {confirmUpgrade.toLevel}
              </p>
              <ul className="yanmar-repair-confirm-facts">
                <li className="yanmar-repair-confirm-cost">
                  소모 <PointsAmount value={confirmUpgrade.cost} size={14} />
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
