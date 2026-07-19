"use client";

import { useEffect, useState } from "react";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import { StarAmount } from "@/components/StarAmount";
import {
  SHOP_ITEMS,
  type ShopItem,
  type ShopItemId,
} from "./shopCatalog";
import {
  GACHA_CONFIG,
  type GachaBanner,
} from "./gearCatalog";
import {
  gachaBannerArtSrc,
  gachaBannerChromeClass,
  preloadAllGearIcons,
} from "./gearArt";
import type { GachaFreeStatus } from "./gachaFree";

export type GachaPayWith = "stars" | "tickets" | "free";

interface ShopPanelProps {
  open: boolean;
  onClose: () => void;
  stars?: number;
  gachaTicketsStandard?: number;
  gachaTicketsPremium?: number;
  freeGacha?: GachaFreeStatus | null;
  activeItemIds?: ReadonlySet<ShopItemId> | readonly ShopItemId[];
  purchasingId?: ShopItemId | null;
  onPurchase?: (itemId: ShopItemId) => void | Promise<void>;
  gachaBusy?: boolean;
  onGacha?: (
    banner: "STANDARD" | "PREMIUM",
    count: 1 | 10,
    payWith: GachaPayWith,
  ) => void | Promise<void>;
}

function formatCooldown(ms: number) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function ShopProductCard({
  item,
  stars,
  active,
  purchasing,
  onPurchase,
}: {
  item: ShopItem;
  stars?: number;
  active: boolean;
  purchasing: boolean;
  onPurchase?: (itemId: ShopItemId) => void | Promise<void>;
}) {
  const canAfford =
    typeof stars !== "number" || stars >= item.priceStars;
  const disabled = purchasing || !canAfford || !onPurchase;

  return (
    <article className="yanmar-shop-card">
      <div className="yanmar-shop-card-media">
        <img
          src={`${item.imageSrc}?v=1`}
          alt=""
          className="yanmar-shop-card-image"
          draggable={false}
        />
        <h3 className="yanmar-shop-card-title">{item.name}</h3>
        {active ? (
          <span className="yanmar-shop-card-active-badge">적용중</span>
        ) : null}
      </div>
      <div className="yanmar-shop-card-effect">
        <p className="yanmar-shop-card-effect-main">{item.effect}</p>
        <p className="yanmar-shop-card-effect-time">{item.durationLabel}</p>
      </div>
      <button
        type="button"
        className="yanmar-shop-card-buy"
        disabled={disabled}
        onClick={() => {
          void onPurchase?.(item.id);
        }}
      >
        <StarAmount
          value={item.priceStars}
          size={12}
          valueClassName="yanmar-shop-card-star-value"
        />
        <span className="yanmar-shop-card-buy-label">
          {purchasing ? "구매중" : active ? "연장" : "구매"}
        </span>
      </button>
    </article>
  );
}

function GachaBannerSection({
  banner,
  title,
  gradeLabels,
  gachaBusy,
  stars = 0,
  ticketCount,
  freeRemaining,
  freeAvailable,
  cooldownRemainingMs,
  onGacha,
}: {
  banner: GachaBanner;
  title: string;
  gradeLabels: readonly string[];
  gachaBusy?: boolean;
  stars?: number;
  ticketCount: number;
  freeRemaining: number;
  freeAvailable: boolean;
  cooldownRemainingMs: number;
  onGacha?: (
    banner: "STANDARD" | "PREMIUM",
    count: 1 | 10,
    payWith: GachaPayWith,
  ) => void | Promise<void>;
}) {
  const cfg = GACHA_CONFIG[banner];
  const isPremium = banner === "PREMIUM";
  const ticketIcon = isPremium
    ? "/images/yanmar/2d/gacha-ticket-premium.svg"
    : "/images/yanmar/2d/gacha-ticket-standard.svg";
  const useFree = freeRemaining > 0;
  const canAfford1 = stars >= cfg.cost1;
  const canAfford10 = stars >= cfg.cost10;
  const freeOnCooldown = useFree && cooldownRemainingMs > 0;
  const canFreePull = useFree && freeAvailable && !freeOnCooldown;

  return (
    <section className={`yanmar-gacha-banner ${gachaBannerChromeClass(banner)}`}>
      <div className="yanmar-gacha-banner-showcase">
        <div className="yanmar-gacha-banner-art" aria-hidden>
          <img
            src={`${gachaBannerArtSrc(banner)}?v=8`}
            alt=""
            draggable={false}
          />
        </div>
        <div className="yanmar-gacha-banner-copy">
          <span className="yanmar-gacha-banner-kicker">
            {isPremium ? "PREMIUM" : "STANDARD"}
          </span>
          <h3>{title}</h3>
          <div className="yanmar-gacha-grade-row" aria-label="등장 등급">
            {gradeLabels.map((label) => (
              <span key={label} className="yanmar-gacha-grade-chip">
                {label}
              </span>
            ))}
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-white/70">
            <span>{isPremium ? "고급 등급 확률 업" : "기본 장비 뽑기"}</span>
            <span className="inline-flex items-center gap-1 text-white/85">
              ·
              <img
                src={ticketIcon}
                alt=""
                width={11}
                height={11}
                className="shrink-0"
                draggable={false}
              />
              보유 {ticketCount.toLocaleString()}
            </span>
            {useFree ? (
              <span className="text-emerald-300/90">
                · 무료 {freeRemaining}회
                {freeOnCooldown
                  ? ` · ${formatCooldown(cooldownRemainingMs)}`
                  : ""}
              </span>
            ) : null}
          </p>
        </div>
      </div>
      <div className="yanmar-gacha-actions">
        <div className="yanmar-gacha-action-row-btns">
          {useFree ? (
            <button
              type="button"
              disabled={gachaBusy || !onGacha || !canFreePull}
              className="yanmar-gacha-pull-btn yanmar-gacha-pull-btn--free"
              onClick={() => void onGacha?.(banner, 1, "free")}
            >
              <span className="yanmar-gacha-pull-label">1회</span>
              <span className="yanmar-gacha-pull-cost">
                <span className="yanmar-gacha-pull-cost-value">
                  {freeOnCooldown
                    ? formatCooldown(cooldownRemainingMs)
                    : "무료"}
                </span>
              </span>
            </button>
          ) : (
            <button
              type="button"
              disabled={gachaBusy || !onGacha || !canAfford1}
              className="yanmar-gacha-pull-btn"
              onClick={() => void onGacha?.(banner, 1, "stars")}
            >
              <span className="yanmar-gacha-pull-label">1회</span>
              <span
                className={`yanmar-gacha-pull-cost${
                  canAfford1 ? "" : " is-short"
                }`}
              >
                <StarAmount
                  value={cfg.cost1}
                  size={11}
                  className="yanmar-gacha-pull-star-amount"
                  valueClassName="yanmar-gacha-pull-cost-value"
                />
              </span>
            </button>
          )}
          <button
            type="button"
            disabled={gachaBusy || !onGacha || !canAfford10}
            className="yanmar-gacha-pull-btn yanmar-gacha-pull-btn--multi"
            onClick={() => void onGacha?.(banner, 10, "stars")}
          >
            <span className="yanmar-gacha-pull-label">10회</span>
            <span
              className={`yanmar-gacha-pull-cost${
                canAfford10 ? "" : " is-short"
              }`}
            >
              <StarAmount
                value={cfg.cost10}
                size={11}
                className="yanmar-gacha-pull-star-amount"
                valueClassName="yanmar-gacha-pull-cost-value"
              />
              <span className="yanmar-gacha-pull-discount">-10%</span>
            </span>
          </button>
        </div>
        <div className="yanmar-gacha-action-row-btns">
          <button
            type="button"
            disabled={gachaBusy || !onGacha || ticketCount < 1}
            className="yanmar-gacha-pull-btn yanmar-gacha-pull-btn--ticket"
            onClick={() => void onGacha?.(banner, 1, "tickets")}
          >
            <span className="yanmar-gacha-pull-label">1회</span>
            <span
              className={`yanmar-gacha-pull-cost${
                ticketCount < 1 ? " is-short" : ""
              }`}
            >
              <img
                src={ticketIcon}
                alt=""
                className="yanmar-gacha-pull-cost-icon"
                draggable={false}
              />
              <span className="yanmar-gacha-pull-cost-value">1</span>
            </span>
          </button>
          <button
            type="button"
            disabled={gachaBusy || !onGacha || ticketCount < 10}
            className="yanmar-gacha-pull-btn yanmar-gacha-pull-btn--multi yanmar-gacha-pull-btn--ticket"
            onClick={() => void onGacha?.(banner, 10, "tickets")}
          >
            <span className="yanmar-gacha-pull-label">10회</span>
            <span
              className={`yanmar-gacha-pull-cost${
                ticketCount < 10 ? " is-short" : ""
              }`}
            >
              <img
                src={ticketIcon}
                alt=""
                className="yanmar-gacha-pull-cost-icon"
                draggable={false}
              />
              <span className="yanmar-gacha-pull-cost-value">10</span>
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}

export function ShopPanel({
  open,
  onClose,
  stars,
  gachaTicketsStandard = 0,
  gachaTicketsPremium = 0,
  freeGacha = null,
  activeItemIds,
  purchasingId = null,
  onPurchase,
  gachaBusy,
  onGacha,
}: ShopPanelProps) {
  const [tab, setTab] = useState<"gear" | "buff">("gear");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [cooldownAnchor, setCooldownAnchor] = useState<{
    remaining: number;
    at: number;
  } | null>(null);
  const activeSet =
    activeItemIds instanceof Set
      ? activeItemIds
      : new Set(activeItemIds ?? []);

  useEffect(() => {
    if (!open) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  // 10연 연출 직전에 아이콘이 비는 것을 막기 위해 상점 오픈 시 세트 워밍업
  useEffect(() => {
    if (!open) return;
    void preloadAllGearIcons();
  }, [open]);

  useEffect(() => {
    const remaining = freeGacha?.standard.cooldownRemainingMs ?? 0;
    if (remaining > 0) {
      setCooldownAnchor({ remaining, at: Date.now() });
    } else {
      setCooldownAnchor(null);
    }
  }, [freeGacha]);

  const liveStandardCooldownMs = cooldownAnchor
    ? Math.max(0, cooldownAnchor.remaining - (nowMs - cooldownAnchor.at))
    : 0;

  const standardRemaining = freeGacha?.standard.remaining ?? 0;
  const premiumRemaining = freeGacha?.premium.remaining ?? 0;

  return (
    <AppModalOverlay
      open={open}
      onClose={onClose}
      panelClassName="max-w-[min(96vw,26rem)] landscape:max-h-[min(94dvh,32rem)]"
    >
      <div className="flex h-[min(84dvh,38rem)] w-full flex-col overflow-hidden rounded-2xl border border-amber-200/20 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl landscape:h-[min(92dvh,26rem)]">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="yanmar-shop-panel-badge" aria-hidden />
            <h2 className="text-sm font-black text-amber-100">상점</h2>
          </div>
          <div className="flex items-center gap-1.5">
            {typeof stars === "number" ? (
              <span className="inline-flex items-center rounded-lg border border-amber-200/20 bg-black/35 px-2 py-1 text-amber-100">
                <StarAmount
                  value={stars}
                  size={12}
                  valueClassName="text-[11px] font-black tabular-nums text-amber-100"
                />
              </span>
            ) : null}
            <span
              className="inline-flex items-center gap-1 rounded-lg border border-sky-200/20 bg-black/35 px-2 py-1"
              title="일반 뽑기권"
            >
              <img
                src="/images/yanmar/2d/gacha-ticket-standard.svg"
                alt=""
                width={12}
                height={12}
                className="shrink-0"
                draggable={false}
              />
              <span className="text-[11px] font-black tabular-nums text-sky-100">
                {gachaTicketsStandard.toLocaleString()}
              </span>
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-lg border border-violet-200/20 bg-black/35 px-2 py-1"
              title="고급 뽑기권"
            >
              <img
                src="/images/yanmar/2d/gacha-ticket-premium.svg"
                alt=""
                width={12}
                height={12}
                className="shrink-0"
                draggable={false}
              />
              <span className="text-[11px] font-black tabular-nums text-violet-100">
                {gachaTicketsPremium.toLocaleString()}
              </span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-[11px] font-bold text-white/70 hover:bg-white/10 hover:text-white"
            >
              닫기
            </button>
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-b border-white/10 px-3 py-2">
          <button
            type="button"
            className={`rounded-lg px-3 py-1 text-[11px] font-bold ${
              tab === "gear" ? "bg-amber-500/20 text-amber-100" : "text-white/60"
            }`}
            onClick={() => setTab("gear")}
          >
            장비
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-1 text-[11px] font-bold ${
              tab === "buff" ? "bg-amber-500/20 text-amber-100" : "text-white/60"
            }`}
            onClick={() => setTab("buff")}
          >
            버프
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 [-webkit-overflow-scrolling:touch]">
          {tab === "buff" ? (
            <div className="yanmar-shop-grid">
              {SHOP_ITEMS.map((item) => (
                <ShopProductCard
                  key={item.id}
                  item={item}
                  stars={stars}
                  active={activeSet.has(item.id)}
                  purchasing={purchasingId === item.id}
                  onPurchase={onPurchase}
                />
              ))}
            </div>
          ) : (
            <div className="yanmar-gacha-stack">
              <GachaBannerSection
                banner="STANDARD"
                title="일반 뽑기"
                gradeLabels={["일반", "강화", "정밀"]}
                gachaBusy={gachaBusy}
                stars={stars}
                ticketCount={gachaTicketsStandard}
                freeRemaining={standardRemaining}
                freeAvailable={
                  standardRemaining > 0 && liveStandardCooldownMs <= 0
                }
                cooldownRemainingMs={liveStandardCooldownMs}
                onGacha={onGacha}
              />
              <GachaBannerSection
                banner="PREMIUM"
                title="고급 뽑기"
                gradeLabels={["강화", "정밀", "마스터"]}
                gachaBusy={gachaBusy}
                stars={stars}
                ticketCount={gachaTicketsPremium}
                freeRemaining={premiumRemaining}
                freeAvailable={premiumRemaining > 0}
                cooldownRemainingMs={0}
                onGacha={onGacha}
              />
            </div>
          )}
        </div>
      </div>
    </AppModalOverlay>
  );
}
