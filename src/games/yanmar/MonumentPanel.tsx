"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import { StarAmount } from "@/components/StarAmount";
import { getPlayerLevelProgress } from "@/lib/playerLevel";
import {
  MONUMENT_BUILD_QUESTS,
  MONUMENT_POINTS_ICON,
  MONUMENT_SHOP_ITEMS,
  MONUMENT_STARS_PER_TICK,
  MONUMENT_UPGRADES,
  countClaimableMonumentQuests,
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
import type { WorkshopShopItemId } from "./workshop";
import {
  ClaimButton,
  DoneStamp,
  PendingStamp,
  QuestCard,
  QuestPointsChip,
  type QuestCardState,
} from "./QuestCardUI";

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
  onShopPurchase: (
    itemId: WorkshopShopItemId,
  ) => Promise<{ itemId: WorkshopShopItemId; grantedAmount: number } | null>;
  onStartConstruction?: () => void | Promise<void>;
  onClaimConstruction?: () => void | Promise<void>;
  onClaimStars?: () => void | Promise<void>;
  onRefresh?: () => void | Promise<void>;
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
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
  const [confirmShop, setConfirmShop] = useState<{
    itemId: WorkshopShopItemId;
    label: string;
    icon: string;
    cost: number;
  } | null>(null);
  const [shopResult, setShopResult] = useState<{
    itemId: WorkshopShopItemId;
    label: string;
    icon: string;
    amount: number;
  } | null>(null);
  const autoSettleKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setConfirmUpgrade(null);
      setConfirmShop(null);
      setShopResult(null);
    }
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

  const claimableQuestCount = useMemo(
    () => countClaimableMonumentQuests(questState),
    [questState],
  );

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
      panelClassName="yanmar-facility-modal-shell"
    >
      <div className="yanmar-facility-modal is-monument">
        <header className="yanmar-facility-modal-head">
          <span className="yanmar-facility-modal-emblem" aria-hidden>
            <img
              src="/images/yanmar/2d/cockpit/quest-premium.png?v=3"
              alt=""
              draggable={false}
            />
          </span>
          <div className="yanmar-facility-modal-titles">
            <p className="yanmar-facility-modal-eyebrow">YK MONUMENT</p>
            <h2>YK 조형물</h2>
          </div>
          <div className="yanmar-facility-modal-head-meta">
            <span
              className="yanmar-facility-modal-chip is-points"
              title="조형물 포인트"
            >
              <PointsAmount value={panelState.points} size={14} />
            </span>
            {claimableQuestCount > 0 ? (
              <span className="yanmar-facility-modal-chip" title="수령 대기">
                보상 <b className="tabular-nums">{claimableQuestCount}</b>
              </span>
            ) : null}
            <button
              type="button"
              className="yanmar-facility-modal-close"
              onClick={onClose}
              aria-label="조형물 닫기"
            >
              <CloseGlyph />
            </button>
          </div>
        </header>

        {showManage ? (
          <div className="yanmar-facility-storage-rail">
            <div className="yanmar-facility-storage-main">
              <div className="yanmar-facility-storage-row">
                <span className="yanmar-facility-storage-value">
                  <img
                    src="/images/star-currency.svg"
                    alt=""
                    width={14}
                    height={14}
                    className="yanmar-score-panel-star shrink-0"
                    draggable={false}
                  />
                  {starsStored.toLocaleString()}
                </span>
                <span className="yanmar-facility-storage-cap">
                  / {storageCap.toLocaleString()}
                </span>
                {!storageFull ? (
                  <span className="yanmar-facility-storage-note">
                    · 다음{" "}
                    <b>{formatUpgradeRemaining(nextProdRemainingMs)}</b>
                    {" · "}
                    {MONUMENT_STARS_PER_TICK}/
                    {intervalMs >= 60_000
                      ? `${Math.round(intervalMs / 60_000)}분`
                      : `${Math.round(intervalMs / 1000)}초`}
                  </span>
                ) : (
                  <span className="yanmar-facility-storage-note is-full">
                    · 저장 가득 참
                  </span>
                )}
              </div>
              <div className="yanmar-facility-track" style={{ marginTop: "0.4rem" }}>
                <span style={{ width: `${storagePct}%` }} />
              </div>
            </div>
            <button
              type="button"
              disabled={busy || !canClaimStars || !onClaimStars}
              onClick={() => void onClaimStars?.()}
              className="yanmar-facility-btn is-instant"
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
          <div className="yanmar-facility-modal-tabs" role="tablist">
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
                role="tab"
                aria-selected={tab === id}
                className={`yanmar-facility-tab${tab === id ? " is-active" : ""}`}
                onClick={() => setTab(id)}
              >
                <span>{label}</span>
                {id === "quest" && claimableQuestCount > 0 ? (
                  <span
                    className="yanmar-quest-notify-badge is-tab"
                    aria-label={`미수령 보상 ${claimableQuestCount}개`}
                  >
                    {claimableQuestCount > 9 ? "9+" : claimableQuestCount}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}

        {phase === "quest" ? (
          <div className="yanmar-quest-modal-rail">
            <span className="yanmar-quest-modal-rail-label">건설 미션</span>
            <span className="yanmar-quest-modal-rail-note">
              기본 미션을 완료하면 건설을 시작할 수 있습니다
            </span>
          </div>
        ) : null}

        {showManage && tab === "quest" ? (
          <div className="yanmar-quest-modal-rail">
            <span className="yanmar-quest-modal-rail-label">조형물 퀘스트</span>
            <span className="yanmar-quest-modal-rail-note">
              완료 보상은 조형물 포인트로 지급됩니다
            </span>
            <span className="yanmar-quest-modal-rail-value tabular-nums">
              수령대기 <b>{claimableQuestCount}</b>
            </span>
          </div>
        ) : null}

        <div className="yanmar-facility-modal-body">
          {phase === "quest" ? (
            <div className="flex flex-col gap-3">
              <ul className="yanmar-quest-list">
                {MONUMENT_BUILD_QUESTS.map((q) => {
                  const item: MonumentQuestProgressItem = questState?.build[
                    q.id
                  ] ?? {
                    id: q.id,
                    progress: 0,
                    completed: false,
                    claimed: false,
                  };
                  const state: QuestCardState = item.completed
                    ? "done"
                    : "active";
                  return (
                    <QuestCard
                      key={q.id}
                      title={q.title}
                      tag={{ label: "건설", tone: "required" }}
                      value={item.progress}
                      target={q.target}
                      metric={q.metric}
                      state={state}
                      action={
                        item.completed ? (
                          <DoneStamp label="완료" />
                        ) : (
                          <PendingStamp />
                        )
                      }
                    />
                  );
                })}
              </ul>
              {onStartConstruction ? (
                <button
                  type="button"
                  disabled={busy || !buildComplete}
                  className="yanmar-facility-btn is-primary"
                  onClick={() => void onStartConstruction()}
                >
                  건설 시작 (60분)
                </button>
              ) : null}
            </div>
          ) : null}

          {phase === "building" ? (
            <div className="yanmar-facility-hero">
              <p className="yanmar-facility-hero-title">건설 진행 중</p>
              <p className="yanmar-facility-hero-value">
                {panelState.constructionEndsAt
                  ? formatUpgradeRemaining(
                      new Date(panelState.constructionEndsAt).getTime() - nowMs,
                    )
                  : "—"}
              </p>
              <p className="yanmar-facility-hero-note">
                시간이 끝나면 가까이에서 건설완료를 눌러 주세요.
              </p>
            </div>
          ) : null}

          {phase === "claimable" ? (
            <div className="yanmar-facility-hero">
              <p className="yanmar-facility-hero-title is-success">
                건설이 완료되었습니다!
              </p>
              {onClaimConstruction ? (
                <button
                  type="button"
                  disabled={busy}
                  className="yanmar-facility-btn is-primary"
                  onClick={() => void onClaimConstruction()}
                >
                  건설완료
                </button>
              ) : null}
            </div>
          ) : null}

          {showManage && tab === "quest" ? (
            <ul className="yanmar-quest-list">
              {(questState?.daily ?? []).map((q) => {
                const item = questState?.dailyProgress[q.id] ?? {
                  id: q.id,
                  progress: 0,
                  completed: false,
                  claimed: false,
                };
                const canClaim = item.completed && !item.claimed;
                const state: QuestCardState = item.claimed
                  ? "done"
                  : canClaim
                    ? "claimable"
                    : "active";
                return (
                  <QuestCard
                    key={q.id}
                    title={q.title}
                    tag={{ label: "일일", tone: "required" }}
                    rewardSlot={
                      <QuestPointsChip
                        iconSrc={MONUMENT_POINTS_ICON}
                        amount={q.rewardPoints}
                        label="조형물 포인트"
                      />
                    }
                    value={item.progress}
                    target={q.target}
                    metric={q.metric}
                    state={state}
                    action={
                      canClaim ? (
                        <ClaimButton
                          claiming={Boolean(busy)}
                          onClaim={() =>
                            void onClaimQuest(q.id, q.rewardPoints)
                          }
                        />
                      ) : item.claimed ? (
                        <DoneStamp label="수령됨" />
                      ) : (
                        <PendingStamp />
                      )
                    }
                  />
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
                const state: QuestCardState = canClaim
                  ? "claimable"
                  : "active";
                return (
                  <QuestCard
                    key={q.id}
                    title={q.title}
                    tag={{ label: "반복", tone: "bonus" }}
                    rewardSlot={
                      <QuestPointsChip
                        iconSrc={MONUMENT_POINTS_ICON}
                        amount={q.rewardPoints}
                        label="조형물 포인트"
                      />
                    }
                    value={item.progress}
                    target={q.target}
                    metric={q.metric}
                    state={state}
                    action={
                      canClaim ? (
                        <ClaimButton
                          claiming={Boolean(busy) || !onClaimRepeatQuest}
                          onClaim={() =>
                            void onClaimRepeatQuest?.(q.id, q.rewardPoints)
                          }
                        />
                      ) : (
                        <PendingStamp />
                      )
                    }
                  />
                );
              })}
            </ul>
          ) : null}

          {showManage && tab === "upgrade" ? (
            <ul className="yanmar-facility-list">
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
                    className={`yanmar-facility-card${
                      isThisPending ? " is-claimable" : ""
                    }`}
                  >
                    <div className="yanmar-facility-card-top">
                      <div className="yanmar-facility-card-main">
                        <p className="yanmar-facility-card-title">
                          {u.label}
                          <em>
                            +{level}/{max}
                          </em>
                          {!maxed ? (
                            <span
                              className={`yanmar-facility-level-lock${
                                levelLocked ? " is-locked" : ""
                              }`}
                            >
                              레벨제한{reqLevel}
                            </span>
                          ) : null}
                        </p>
                        {!maxed ? (
                          <p className="yanmar-facility-card-preview">
                            {nextPreview}
                          </p>
                        ) : null}
                      </div>
                      <div className="yanmar-facility-card-side">
                        {isThisPending && onInstantUpgrade ? (
                          <button
                            type="button"
                            disabled={
                              busy || (!timerReady && currency < instantCost)
                            }
                            className="yanmar-facility-btn is-instant"
                            onClick={() => void onInstantUpgrade()}
                          >
                            {timerReady ? (
                              "완료"
                            ) : (
                              <>
                                즉시완료{" "}
                                <StarAmount value={instantCost} size={12} />
                                {currency < instantCost ? " (부족)" : ""}
                              </>
                            )}
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
                            className="yanmar-facility-btn is-upgrade"
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
                            className={`yanmar-facility-timer${
                              isThisPending ? " is-live" : ""
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
            <ul className="yanmar-facility-list">
              <li className="yanmar-facility-card-desc" style={{ listStyle: "none", margin: 0 }}>
                상품당 주간 {MONUMENT_SHOP_ITEMS[0]?.weeklyLimit ?? 3}회 · 월요일
                0시(KST) 리셋
              </li>
              {MONUMENT_SHOP_ITEMS.map((item) => {
                const purchase = panelState.shopPurchases[item.id] ?? {
                  count: 0,
                  remaining: item.weeklyLimit,
                };
                const canBuy =
                  panelState.points >= item.cost && purchase.remaining > 0;
                return (
                  <li key={item.id} className="yanmar-facility-card is-row">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.icon}
                      alt=""
                      className="yanmar-facility-shop-art"
                      draggable={false}
                    />
                    <div className="yanmar-facility-card-main">
                      <p className="yanmar-facility-card-title">{item.label}</p>
                      <p className="yanmar-facility-card-desc">
                        {item.description}
                      </p>
                      <p className="yanmar-facility-card-progress">
                        이번 주 {purchase.count}/{item.weeklyLimit}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy || !canBuy}
                      className="yanmar-facility-btn is-buy"
                      onClick={() =>
                        setConfirmShop({
                          itemId: item.id as WorkshopShopItemId,
                          label: item.label,
                          icon: item.icon,
                          cost: item.cost,
                        })
                      }
                    >
                      <PointsAmount value={item.cost} size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        {confirmShop ? (
          <div
            className="yanmar-repair-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="yanmar-monument-shop-confirm-title"
          >
            <div className="yanmar-repair-confirm-card">
              <h3 id="yanmar-monument-shop-confirm-title">구매 확인</h3>
              <p className="yanmar-repair-confirm-item">
                {confirmShop.label}을(를) 구매하시겠습니까?
              </p>
              <ul className="yanmar-repair-confirm-facts">
                <li className="yanmar-repair-confirm-cost">
                  소모 <PointsAmount value={confirmShop.cost} size={14} />
                </li>
              </ul>
              <div className="yanmar-repair-confirm-actions">
                <button
                  type="button"
                  className="yanmar-repair-confirm-cancel"
                  disabled={busy}
                  onClick={() => setConfirmShop(null)}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="yanmar-repair-confirm-ok"
                  disabled={busy}
                  onClick={() => {
                    const pending = confirmShop;
                    setConfirmShop(null);
                    void (async () => {
                      const result = await onShopPurchase(pending.itemId);
                      if (!result) return;
                      setShopResult({
                        itemId: result.itemId,
                        label: pending.label,
                        icon: pending.icon,
                        amount: result.grantedAmount,
                      });
                    })();
                  }}
                >
                  구매
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {shopResult ? (
          <div
            className="yanmar-repair-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="yanmar-monument-shop-result-title"
          >
            <div className="yanmar-repair-confirm-card is-result">
              <h3 id="yanmar-monument-shop-result-title">획득 결과</h3>
              <div className="flex flex-col items-center gap-2 py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shopResult.icon}
                  alt=""
                  className="h-16 w-16 object-contain"
                  draggable={false}
                />
                <p className="yanmar-repair-confirm-item">
                  {shopResult.label} ×{shopResult.amount}
                </p>
              </div>
              <div className="yanmar-repair-confirm-actions">
                <button
                  type="button"
                  className="yanmar-repair-confirm-ok"
                  onClick={() => setShopResult(null)}
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        ) : null}

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
