"use client";

import { useEffect, useMemo, useState } from "react";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import { getPlayerLevelProgress } from "@/lib/playerLevel";
import {
  MONUMENT_BUILD_QUESTS,
  MONUMENT_POINTS_ICON,
  MONUMENT_SHOP_ITEMS,
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
} from "./upgradeTimers";
import type { WorkshopShopItemId } from "./workshop";

type TabId = "quest" | "upgrade" | "shop" | "build";

export interface MonumentPanelState {
  phase: MonumentPhase;
  points: number;
  levels: Record<string, number>;
  pending: MonumentPendingInfo | null;
  constructionEndsAt: string | null;
  starsStored: number;
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
  onUpgrade: (upgradeKey: MonumentUpgradeKey) => void | Promise<void>;
  onInstantUpgrade?: () => void | Promise<void>;
  onShopPurchase: (itemId: WorkshopShopItemId) => void | Promise<void>;
  onStartConstruction?: () => void | Promise<void>;
  onClaimConstruction?: () => void | Promise<void>;
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
  onUpgrade,
  onInstantUpgrade,
  onShopPurchase,
  onStartConstruction,
  onClaimConstruction,
}: MonumentPanelProps) {
  const [tab, setTab] = useState<TabId>("quest");
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
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

  const buildComplete = useMemo(() => {
    if (!questState) return false;
    return MONUMENT_BUILD_QUESTS.every((q) => questState.build[q.id]?.completed);
  }, [questState]);

  if (!open || !panelState) return null;

  const phase = panelState.phase;
  const showManage = phase === "active";

  return (
    <AppModalOverlay open={open} onClose={onClose} nested>
      <div className="yanmar-workshop-panel mx-auto flex h-[min(88dvh,36rem)] w-[min(96vw,26rem)] flex-col overflow-hidden rounded-2xl border border-stone-400/40 bg-[#1c2430]/96 text-stone-100 shadow-2xl backdrop-blur-md">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
            <h2 className="text-lg font-black tracking-tight">YK 조형물</h2>
            <p className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-amber-200">
              <span className="text-stone-400">조형물 포인트</span>
              <PointsAmount value={panelState.points} size={20} />
            </p>
            {phase === "active" ? (
              <p className="mt-1 text-xs text-amber-100/90">
                저장 ★{panelState.starsStored} / {monumentStorageCap(storageLv)}
                {" · "}
                {Math.round(monumentIntervalMs(speedLv) / 1000)}초마다 1★
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-sm text-stone-300 hover:bg-white/10"
            onClick={onClose}
          >
            닫기
          </button>
        </header>

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

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
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
                        {Math.min(item.progress, q.target)} / {q.target}
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
                      <div>
                        <p className="text-sm font-bold">{q.title}</p>
                        <p className="text-xs text-stone-400">일일</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <PointsAmount value={q.rewardPoints} size={16} />
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
                          <span className="text-xs text-stone-500">수령됨</span>
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
                      {Math.min(item.progress, q.target)} / {q.target}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {showManage && tab === "upgrade" ? (
            <ul className="flex flex-col gap-2">
              {pending ? (
                <li className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
                  <p className="text-sm font-bold text-amber-100">
                    강화 진행 중 · +{pending.targetLevel}
                  </p>
                  <p className="mt-1 text-xs text-stone-300">
                    남은 시간{" "}
                    {formatUpgradeRemaining(
                      new Date(pending.completesAt).getTime() - nowMs,
                    )}
                  </p>
                  {onInstantUpgrade ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-black text-white disabled:opacity-40"
                      onClick={() => void onInstantUpgrade()}
                    >
                      즉시완료 ★
                      {instantCompleteStars(
                        new Date(pending.completesAt).getTime() - nowMs,
                      ).toLocaleString()}
                    </button>
                  ) : null}
                </li>
              ) : null}
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
                            {nextPreview}
                          </p>
                        ) : null}
                        {!maxed && durationMs != null ? (
                          <p className="mt-0.5 text-[11px] text-stone-500">
                            소요 {formatUpgradeRemaining(durationMs)}
                            {levelLocked ? ` · ${reqLevel}레벨 필요` : ""}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        disabled={busy || !canBuy}
                        className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-black text-white disabled:opacity-40"
                        onClick={() => void onUpgrade(u.key)}
                      >
                        {maxed ? (
                          "MAX"
                        ) : levelLocked ? (
                          `Lv.${reqLevel}`
                        ) : (
                          <PointsAmount value={cost ?? 0} size={14} />
                        )}
                      </button>
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
                      <div className="min-h-0 flex-1">
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
      </div>
    </AppModalOverlay>
  );
}
