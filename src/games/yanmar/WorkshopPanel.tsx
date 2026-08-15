"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import { StarAmount } from "@/components/StarAmount";
import {
  workshopPointsLabel,
  workshopQuestLabel,
  workshopShopItemDescription,
  workshopShopItemLabel,
  workshopUpgradeDescription,
  workshopUpgradeLabel,
} from "@/i18n/yanmarCatalog";
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
  FLOOD_INCINERATOR_BASE_CAPACITY,
  floodBurnDurationSec,
  floodCleaningMasterMult,
  floodIncineratorCapacity,
} from "./floodRecovery/balance";
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
  isUpgradeTimerReady,
} from "./upgradeTimers";
import {
  ClaimButton,
  DoneStamp,
  PendingStamp,
  QuestCard,
  QuestPointsChip,
  type QuestCardState,
} from "./QuestCardUI";

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
  onShopPurchase: (
    itemId: WorkshopShopItemId,
  ) => Promise<{ itemId: WorkshopShopItemId; grantedAmount: number } | null>;
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
  t: ReturnType<typeof useTranslations>,
  workshopId: WorkshopId,
  key: WorkshopUpgradeKey,
  level: number,
): string {
  const next = level + 1;
  if (key === "truck_capacity") {
    return `${getYanmarTruckCapacityUnits(level).toLocaleString()} → ${getYanmarTruckCapacityUnits(next).toLocaleString()}`;
  }
  if (key === "truck_cooldown") {
    return t("secondsPreview", {
      from: getYanmarTruckCooldownSec(level),
      to: getYanmarTruckCooldownSec(next),
    });
  }
  if (key === "haul_capacity") {
    return t("capacityPreview", {
      from: workshopHaulTruckCapacity(level),
      to: workshopHaulTruckCapacity(Math.min(10, next)),
      base: YANMAR_BASE_HAUL_TRUCK_CAPACITY,
    });
  }
  if (key === "haul_cooldown") {
    return t("secondsPreview", {
      from: getYanmarHaulTruckCooldownSec(level),
      to: getYanmarHaulTruckCooldownSec(next),
    });
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
    return t("countPreview", {
      from: workshopHillBoulderCount(level),
      to: workshopHillBoulderCount(Math.min(5, next)),
      base: YANMAR_BASE_HILL_BOULDER_COUNT,
    });
  }
  if (key === "cleaning_master") {
    return `+${Math.round((floodCleaningMasterMult(level) - 1) * 100)}% → +${Math.round((floodCleaningMasterMult(Math.min(10, next)) - 1) * 100)}%`;
  }
  if (key === "incinerator_power") {
    return t("secondsPreview", {
      from: floodBurnDurationSec(level),
      to: floodBurnDurationSec(Math.min(10, next)),
    });
  }
  if (key === "incinerator_capacity") {
    return t("capacityPreview", {
      from: floodIncineratorCapacity(level),
      to: floodIncineratorCapacity(Math.min(5, next)),
      base: FLOOD_INCINERATOR_BASE_CAPACITY,
    });
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
  const t = useTranslations("yanmar.workshop");
  const catalogT = useTranslations("yanmar");
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
  const [confirmInstant, setConfirmInstant] = useState<{
    label: string;
    toLevel: number;
    stars: number;
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
      setConfirmInstant(null);
      setConfirmShop(null);
      setShopResult(null);
    }
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

  useEffect(() => {
    if (!pending) setConfirmInstant(null);
  }, [pending]);

  useEffect(() => {
    if (!open || !pending || !onInstantUpgrade || busy) return;
    const remainingMs = new Date(pending.completesAt).getTime() - nowMs;
    if (!isUpgradeTimerReady(remainingMs)) {
      autoSettleKeyRef.current = null;
      return;
    }
    const key = `${pending.workshopId}:${pending.upgradeKey}:${pending.completesAt}`;
    if (autoSettleKeyRef.current === key) return;
    autoSettleKeyRef.current = key;
    void onInstantUpgrade();
  }, [open, pending, nowMs, onInstantUpgrade, busy]);

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

  const claimableQuestCount = useMemo(
    () => questRows.filter(({ item }) => item.completed && !item.claimed).length,
    [questRows],
  );

  if (!open || !workshopId || !def) return null;

  const coin = def.pointsIcon;

  return (
    <AppModalOverlay
      open={open}
      onClose={onClose}
      nested
      panelClassName="yanmar-facility-modal-shell"
    >
      <div className="yanmar-facility-modal is-workshop">
        <header className="yanmar-facility-modal-head">
          <span className="yanmar-facility-modal-emblem" aria-hidden>
            <img
              src="/images/yanmar/2d/cockpit/upgrade-anvil-premium.png"
              alt=""
              draggable={false}
            />
          </span>
          <div className="yanmar-facility-modal-titles">
            <p className="yanmar-facility-modal-eyebrow">SITE WORKSHOP</p>
            <h2>{t("title")}</h2>
          </div>
          <div className="yanmar-facility-modal-head-meta">
            <span
              className="yanmar-facility-modal-chip is-points"
              title={workshopPointsLabel(catalogT, workshopId)}
            >
              <WorkshopPointsAmount
                icon={coin}
                value={points}
                label={workshopPointsLabel(catalogT, workshopId)}
                size={14}
              />
            </span>
            {claimableQuestCount > 0 ? (
              <span className="yanmar-facility-modal-chip" title={t("rewardsAwaiting")}>
                {t("rewards")} <b className="tabular-nums">{claimableQuestCount}</b>
              </span>
            ) : null}
            <button
              type="button"
              className="yanmar-facility-modal-close"
              onClick={onClose}
              aria-label={t("close")}
            >
              <CloseGlyph />
            </button>
          </div>
        </header>

        <div className="yanmar-facility-modal-tabs" role="tablist">
          {(
            [
              ["quest", t("tabs.quest")],
              ["upgrade", t("tabs.upgrade")],
              ["shop", t("tabs.shop")],
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
                  aria-label={t("unclaimedRewards", { count: claimableQuestCount })}
                >
                  {claimableQuestCount > 9 ? "9+" : claimableQuestCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {tab === "quest" ? (
          <div className="yanmar-quest-modal-rail">
            <span className="yanmar-quest-modal-rail-label">{t("questsTitle")}</span>
            <span className="yanmar-quest-modal-rail-note">
              {t("questRewardNote")}
            </span>
            <span className="yanmar-quest-modal-rail-value tabular-nums">
              {t("rewardsAwaiting")} <b>{claimableQuestCount}</b>
            </span>
          </div>
        ) : null}

        {tab === "upgrade" ? (
          <div className="yanmar-facility-modal-rail">
            <span className="yanmar-facility-modal-rail-label">{t("upgrade")}</span>
            <span className="yanmar-facility-modal-rail-note">
              {t("oneUpgradeAtATime")}
            </span>
            <span className="yanmar-facility-modal-rail-value">
              {t("owned")}{" "}
              <b>
                <WorkshopPointsAmount icon={coin} value={points} size={12} />
              </b>
            </span>
          </div>
        ) : null}

        {tab === "shop" ? (
          <div className="yanmar-facility-modal-rail">
            <span className="yanmar-facility-modal-rail-label">{t("shopTitle")}</span>
            <span className="yanmar-facility-modal-rail-note">
              {t("weeklyReset", { limit: WORKSHOP_SHOP_ITEMS[0]?.weeklyLimit ?? 3 })}
            </span>
          </div>
        ) : null}

        <div className="yanmar-facility-modal-body">
          {tab === "quest" ? (
            <ul className="yanmar-quest-list">
              {questRows.map(({ def: q, item }) => {
                const canClaim = item.completed && !item.claimed;
                const done = item.claimed && q.kind === "daily";
                const state: QuestCardState = done
                  ? "done"
                  : canClaim
                    ? "claimable"
                    : "active";
                return (
                  <QuestCard
                    key={q.id}
                    title={workshopQuestLabel(catalogT, q.id)}
                    tag={{
                      label: q.kind === "daily" ? t("tags.daily") : t("tags.repeat"),
                      tone: q.kind === "daily" ? "required" : "bonus",
                    }}
                    rewardSlot={
                      <QuestPointsChip
                        iconSrc={coin}
                        amount={q.rewardPoints}
                        label={workshopPointsLabel(catalogT, workshopId)}
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
                          onClaim={() => void onClaimQuest(q.id)}
                        />
                      ) : done ? (
                        <DoneStamp label={t("claimed")} />
                      ) : (
                        <PendingStamp />
                      )
                    }
                  />
                );
              })}
            </ul>
          ) : null}

          {tab === "upgrade" ? (
            <ul className="yanmar-facility-list">
              {def.upgrades.map((u) => {
                const level = levels[u.key] ?? 0;
                const max = getWorkshopUpgradeMaxLevel(u.key);
                const cost = getWorkshopUpgradeCost(u.key, level);
                const maxed = level >= max;
                const targetLevel = level + 1;
                const reqLevel =
                  getWorkshopUpgradeRequiredPlayerLevel(targetLevel, u.key) ??
                  999;
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
                  points >= cost;
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
                          {workshopUpgradeLabel(catalogT, u.key)}
                          <em>
                            +{level}/{max}
                          </em>
                          {!maxed ? (
                            <span
                              className={`yanmar-facility-level-lock${
                                levelLocked ? " is-locked" : ""
                              }`}
                            >
                              {t("levelRequirement", { level: reqLevel })}
                            </span>
                          ) : null}
                        </p>
                        <p className="yanmar-facility-card-desc">
                          {workshopUpgradeDescription(catalogT, u.key)}
                        </p>
                        {!maxed ? (
                          <p className="yanmar-facility-card-preview">
                            {effectPreview(t, workshopId, u.key, level)}
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
                            onClick={() => {
                              if (timerReady) {
                                void onInstantUpgrade();
                                return;
                              }
                              if (currency < instantCost) return;
                              setConfirmInstant({
                                label: workshopUpgradeLabel(catalogT, u.key),
                                toLevel: targetLevel,
                                stars: instantCost,
                              });
                            }}
                          >
                            {timerReady ? (
                              t("done")
                            ) : (
                              <>
                                {t("instantComplete")}{" "}
                                <StarAmount value={instantCost} size={12} />
                                {currency < instantCost ? t("insufficient") : ""}
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
                                label: workshopUpgradeLabel(catalogT, u.key),
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

          {tab === "shop" ? (
            <ul className="yanmar-facility-list">
              {WORKSHOP_SHOP_ITEMS.map((item) => {
                const purchase = shopPurchases[item.id] ?? {
                  count: 0,
                  remaining: item.weeklyLimit,
                };
                const canBuy = points >= item.cost && purchase.remaining > 0;
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
                      <p className="yanmar-facility-card-title">
                        {workshopShopItemLabel(catalogT, item.id)}
                      </p>
                      <p className="yanmar-facility-card-desc">
                        {workshopShopItemDescription(catalogT, item.id)}
                      </p>
                      <p className="yanmar-facility-card-progress">
                        {t("thisWeek", { count: purchase.count, limit: item.weeklyLimit })}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy || !canBuy}
                      className="yanmar-facility-btn is-buy"
                      onClick={() =>
                        setConfirmShop({
                          itemId: item.id,
                          label: workshopShopItemLabel(catalogT, item.id),
                          icon: item.icon,
                          cost: item.cost,
                        })
                      }
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
          ) : null}
        </div>

        {confirmShop ? (
          <div
            className="yanmar-repair-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="yanmar-workshop-shop-confirm-title"
          >
            <div className="yanmar-repair-confirm-card">
              <h3 id="yanmar-workshop-shop-confirm-title">{t("purchaseConfirmation")}</h3>
              <p className="yanmar-repair-confirm-item">
                {t("purchasePrompt", { item: confirmShop.label })}
              </p>
              <ul className="yanmar-repair-confirm-facts">
                <li className="yanmar-repair-confirm-cost">
                  {t("consume")}{" "}
                  <WorkshopPointsAmount
                    icon={coin}
                    value={confirmShop.cost}
                    size={14}
                  />
                </li>
              </ul>
              <div className="yanmar-repair-confirm-actions">
                <button
                  type="button"
                  className="yanmar-repair-confirm-cancel"
                  disabled={busy}
                  onClick={() => setConfirmShop(null)}
                >
                  {t("cancel")}
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
                  {t("purchase")}
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
            aria-labelledby="yanmar-workshop-shop-result-title"
          >
            <div className="yanmar-repair-confirm-card is-result">
              <h3 id="yanmar-workshop-shop-result-title">{t("acquiredResult")}</h3>
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
                  {t("confirm")}
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
            aria-labelledby="yanmar-workshop-upgrade-confirm-title"
          >
            <div className="yanmar-repair-confirm-card">
              <h3 id="yanmar-workshop-upgrade-confirm-title">{t("upgradeConfirmation")}</h3>
              <p className="yanmar-repair-confirm-item">
                {confirmUpgrade.label} +{confirmUpgrade.fromLevel} → +
                {confirmUpgrade.toLevel}
              </p>
              <ul className="yanmar-repair-confirm-facts">
                <li className="yanmar-repair-confirm-cost">
                  {t("consume")}{" "}
                  <WorkshopPointsAmount
                    icon={coin}
                    value={confirmUpgrade.cost}
                    size={14}
                  />
                </li>
                <li>
                  {t("duration")}{" "}
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
                  {t("cancel")}
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
                  {t("upgrade")}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {confirmInstant ? (
          <div
            className="yanmar-repair-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="yanmar-workshop-instant-confirm-title"
          >
            <div className="yanmar-repair-confirm-card">
              <h3 id="yanmar-workshop-instant-confirm-title">{t("instantCompleteConfirmation")}</h3>
              <p className="yanmar-repair-confirm-item">
                {confirmInstant.label} +{confirmInstant.toLevel}
              </p>
              <ul className="yanmar-repair-confirm-facts">
                <li className="yanmar-repair-confirm-cost">
                  {t("consume")} <StarAmount value={confirmInstant.stars} size={14} />
                </li>
              </ul>
              <div className="yanmar-repair-confirm-actions">
                <button
                  type="button"
                  className="yanmar-repair-confirm-cancel"
                  disabled={busy}
                  onClick={() => setConfirmInstant(null)}
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  className="yanmar-repair-confirm-ok"
                  disabled={busy}
                  onClick={() => {
                    setConfirmInstant(null);
                    void onInstantUpgrade?.();
                  }}
                >
                  {t("instantComplete")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppModalOverlay>
  );
}
