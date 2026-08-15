"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { useRegisterInGameBackDismiss } from "@/hooks/useInGameBackNavigation";
import type { Locale } from "@/i18n/config";
import { localizedAsset } from "@/i18n/localizedAsset";
import styles from "./HourlyAdBanner.module.css";
import {
  HOURLY_AD_REWARD_POOL,
  HOURLY_AD_SLOT_DECAY_MS,
  HOURLY_AD_WATCH_SEC,
  formatMmSs,
  getActiveHourlyAd,
  makeHourlyAdEventId,
  markHourlyAdClaimedLocally,
  rollHourlyAdReward,
  saveHourlyAdGrantLocally,
  wasHourlyAdClaimedLocally,
  type HourlyAdClaimResult,
  type HourlyAdCreative,
  type HourlyAdReward,
  type HourlyAdSlotId,
} from "./hourlyAdReward";
import { yanmarAudio } from "./yanmarAudio";
import { runRewardReelSpin } from "./rewardReelSpin";

const REEL_LOOPS = 18;

const REWARD_PREVIEW_ITEMS = [
  {
    key: "stars",
    range: "75~225",
    icons: ["/images/star-currency.svg"],
  },
  {
    key: "gachaPremium",
    count: 2,
    icons: ["/images/yanmar/2d/gacha-ticket-premium.svg"],
  },
  {
    key: "gachaStandard",
    count: 4,
    icons: ["/images/yanmar/2d/gacha-ticket-standard.svg"],
  },
  {
    key: "points",
    range: "75~225",
    icons: [
      "/images/yanmar/2d/workshop-coin-dump.svg",
      "/images/yanmar/2d/workshop-coin-crash.svg",
      "/images/yanmar/2d/workshop-coin-hill.svg",
      "/images/yanmar/2d/workshop-coin-monument.svg",
    ],
  },
] as const;

type Phase = "idle" | "ad" | "claiming" | "spinning" | "result";

interface HourlyAdBannerProps {
  enabled: boolean;
  isLoggedIn: boolean;
  onClaimed: (result: HourlyAdClaimResult) => void | Promise<void>;
}

function buildReel(winner: HourlyAdReward) {
  const base = HOURLY_AD_REWARD_POOL.map((entry) => ({
    kind: entry.kind,
    label: entry.label,
    icon: entry.icon,
  }));
  const winnerIndexInPool = Math.max(
    0,
    HOURLY_AD_REWARD_POOL.findIndex((e) => e.kind === winner.kind),
  );
  const items: { kind: string; label: string; icon: string }[] = [];
  for (let i = 0; i < REEL_LOOPS; i++) {
    items.push(...base);
  }
  // One more cycle; stop on the winner cell inside it.
  items.push(...base);
  const stopIndex = REEL_LOOPS * base.length + winnerIndexInPool;
  items[stopIndex] = {
    kind: winner.kind,
    label: winner.label,
    icon: winner.icon,
  };
  // Trailing pad so the window never empties at the stop.
  items.push(...base.slice(0, 3));
  return { items, stopIndex };
}

export function HourlyAdBanner({
  enabled,
  isLoggedIn,
  onClaimed,
}: HourlyAdBannerProps) {
  const t = useTranslations("yanmar");
  const locale = useLocale();
  const [mounted, setMounted] = useState(false);
  const [bannerSec, setBannerSec] = useState(0);
  const [claimed, setClaimed] = useState(false);
  const [activeSlotId, setActiveSlotId] = useState<HourlyAdSlotId | null>(null);
  const [activeHourBucket, setActiveHourBucket] = useState<number | null>(null);
  const [creative, setCreative] = useState<HourlyAdCreative | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [watchLeft, setWatchLeft] = useState(HOURLY_AD_WATCH_SEC);
  const [reward, setReward] = useState<HourlyAdReward | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const [reelItems, setReelItems] = useState<
    { kind: string; label: string; icon: string }[]
  >([]);
  const trackRef = useRef<HTMLDivElement>(null);
  const spinRafRef = useRef(0);
  const spinningRef = useRef(false);
  const stopRequestedRef = useRef(false);
  /** True once server/local grant is finalized (independent of 확인). */
  const grantFinalizedRef = useRef(false);
  const activeSlotIdRef = useRef<HourlyAdSlotId | null>(null);
  const activeHourBucketRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!enabled || !mounted) return;

    const tick = () => {
      const active = getActiveHourlyAd();
      if (!active) {
        setBannerSec((prev) => (prev === 0 ? prev : 0));
        setActiveSlotId((prev) => (prev === null ? prev : null));
        setActiveHourBucket((prev) => (prev === null ? prev : null));
        setCreative((prev) => (prev === null ? prev : null));
        activeSlotIdRef.current = null;
        activeHourBucketRef.current = null;
        setClaimed((prev) => (prev ? false : prev));
        return;
      }

      const { hourBucket, slot, remainingMs } = active;
      activeSlotIdRef.current = slot.id;
      activeHourBucketRef.current = hourBucket;
      setActiveSlotId((prev) => (prev === slot.id ? prev : slot.id));
      setActiveHourBucket((prev) => (prev === hourBucket ? prev : hourBucket));
      setCreative((prev) => (prev === slot.creative ? prev : slot.creative));
      const nextClaimed = wasHourlyAdClaimedLocally(hourBucket, slot.id);
      setClaimed((prev) => (prev === nextClaimed ? prev : nextClaimed));
      const nextSec = remainingMs / 1000;
      setBannerSec((prev) => (Math.abs(prev - nextSec) < 0.05 ? prev : nextSec));
    };

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [enabled, mounted]);

  const showTeaser =
    enabled &&
    mounted &&
    !claimed &&
    bannerSec > 0 &&
    creative !== null &&
    phase === "idle";
  const creativeCopy =
    activeSlotId && creative
      ? {
          teaserTitle: t(`ads.${activeSlotId}.teaserTitle`),
          teaserSub: t(`ads.${activeSlotId}.teaserSub`),
          panelEyebrow: t(`ads.${activeSlotId}.panelEyebrow`),
          panelTitle: t(`ads.${activeSlotId}.panelTitle`),
          imageAlt: t(`ads.${activeSlotId}.imageAlt`),
          ariaLabel: t(`ads.${activeSlotId}.ariaLabel`),
          image: localizedAsset(creative.image, locale as Locale),
        }
      : null;

  const adOpen = phase === "ad" || phase === "claiming";
  const rewardOpen = phase === "spinning" || phase === "result";

  useRegisterInGameBackDismiss(adOpen && !confirmClose, () => {
    if (phase === "claiming") return;
    setConfirmClose(true);
  });

  useRegisterInGameBackDismiss(adOpen && confirmClose, () => {
    setConfirmClose(false);
  });

  useRegisterInGameBackDismiss(rewardOpen && phase === "result", () => {
    setPhase("idle");
    setReward(null);
  });

  useEffect(() => {
    if (phase !== "ad") return;
    setWatchLeft(HOURLY_AD_WATCH_SEC);
    const started = Date.now();
    const id = window.setInterval(() => {
      const left = Math.max(
        0,
        HOURLY_AD_WATCH_SEC - Math.floor((Date.now() - started) / 1000),
      );
      setWatchLeft(left);
    }, 200);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    return () => {
      if (spinRafRef.current) cancelAnimationFrame(spinRafRef.current);
      spinningRef.current = false;
      yanmarAudio.stopRouletteSpin();
    };
  }, []);

  useEffect(() => {
    const persistClaimed = () => {
      if (!grantFinalizedRef.current) return;
      const slotId = activeSlotIdRef.current;
      const hourBucket = activeHourBucketRef.current;
      if (!slotId || hourBucket === null) return;
      markHourlyAdClaimedLocally(hourBucket, slotId);
    };
    window.addEventListener("pagehide", persistClaimed);
    document.addEventListener("visibilitychange", persistClaimed);
    return () => {
      window.removeEventListener("pagehide", persistClaimed);
      document.removeEventListener("visibilitychange", persistClaimed);
    };
  }, []);

  function openAd() {
    if (claimed || bannerSec <= 0 || !creative) return;
    setClaimError(null);
    setConfirmClose(false);
    setPhase("ad");
  }

  function requestCloseAd() {
    if (phase === "claiming") return;
    setConfirmClose(true);
  }

  function cancelCloseAd() {
    setConfirmClose(false);
  }

  function confirmCloseAd() {
    if (phase === "claiming") return;
    if (activeHourBucket !== null && activeSlotId) {
      markHourlyAdClaimedLocally(activeHourBucket, activeSlotId);
    }
    setClaimed(true);
    setConfirmClose(false);
    setPhase("idle");
    setWatchLeft(HOURLY_AD_WATCH_SEC);
    setClaimError(null);
  }

  function startSpin(won: HourlyAdReward) {
    if (spinRafRef.current) cancelAnimationFrame(spinRafRef.current);

    const { items, stopIndex } = buildReel(won);
    setReelItems(items);
    spinningRef.current = true;
    stopRequestedRef.current = false;
    setPhase("spinning");
    yanmarAudio.playRouletteSpin();

    const applyOffset = (px: number) => {
      const track = trackRef.current;
      if (track) track.style.transform = `translate3d(0, ${-px}px, 0)`;
    };

    runRewardReelSpin({
      getItemHeight: () =>
        (trackRef.current?.firstElementChild as HTMLElement | undefined)
          ?.getBoundingClientRect().height ?? 0,
      stopIndex,
      durationMs: HOURLY_AD_SLOT_DECAY_MS,
      spinningRef,
      stopRequestedRef,
      rafRef: spinRafRef,
      applyOffset,
      onDone: () => {
        yanmarAudio.stopRouletteSpin();
        setPhase("result");
        yanmarAudio.playItemAcquire();
        if (won.kind === "stars") {
          yanmarAudio.playStarAcquire();
        }
      },
    });
  }

  function requestStopSpin() {
    if (phase !== "spinning") return;
    stopRequestedRef.current = true;
  }

  async function claimReward() {
    if (phase !== "ad" || watchLeft > 0) return;
    if (activeHourBucket === null || !activeSlotId) return;
    setPhase("claiming");
    setClaimError(null);

    const bucket = activeHourBucket;
    const slotId = activeSlotId;
    const eventId = makeHourlyAdEventId(bucket, slotId);

    try {
      let result: HourlyAdClaimResult;

      if (isLoggedIn) {
        const res = await fetch("/api/rewards/yanmar-hourly-ad", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId }),
          keepalive: true,
        });
        const data = (await res.json().catch(() => null)) as
          | (HourlyAdClaimResult & { error?: string; expired?: boolean })
          | null;
        if (!res.ok || !data?.reward) {
          throw new Error(
            data?.expired
              ? "정시 보상 시간이 지났습니다."
              : data?.error === "Unauthorized"
                ? "로그인이 필요합니다."
                : "보상 지급에 실패했습니다.",
          );
        }
        result = data;
      } else {
        const won = rollHourlyAdReward();
        result = { eventId, reward: won };
      }

      // Grant is final as soon as the API/local roll succeeds — 확인 is UI only.
      saveHourlyAdGrantLocally(bucket, slotId, result);
      grantFinalizedRef.current = true;
      setClaimed(true);
      setReward(result.reward);
      await onClaimed(result);
      startSpin(result.reward);
    } catch (err) {
      setClaimError(
        err instanceof Error ? err.message : "보상 지급에 실패했습니다.",
      );
      setPhase("ad");
    }
  }

  function closeResult() {
    if (phase === "spinning") return;
    // Reward was already granted at claim time; this only dismisses the UI.
    setPhase("idle");
    setReward(null);
    setReelItems([]);
  }

  if (!mounted) return null;

  return (
    <>
      {showTeaser && creative && creativeCopy ? (
        <button
          type="button"
          className={styles.teaser}
          onClick={openAd}
          aria-label={`${creativeCopy.ariaLabel} — ${t("ads.rewardHint")}`}
        >
          <span className={styles.teaserShine} aria-hidden />
          <div className={styles.teaserMedia}>
            <span className={styles.adMarker} aria-hidden>
              AD
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={creativeCopy.image}
              alt=""
              draggable={false}
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = creative.image;
              }}
            />
          </div>
          <div className={styles.teaserBody}>
            <div className={styles.teaserTitle}>{creativeCopy.teaserTitle}</div>
            <div className={styles.teaserSub}>{creativeCopy.teaserSub}</div>
            <div className={styles.teaserTimer}>
              <span className={styles.teaserTimerLabel}>{t("ads.remainingTime")}</span>
              <span>{formatMmSs(bannerSec)}</span>
            </div>
          </div>
        </button>
      ) : null}

      {adOpen && creative && creativeCopy
        ? createPortal(
            <div className={styles.backdrop} onClick={requestCloseAd}>
              <div
                className={styles.panel}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={creativeCopy.ariaLabel}
              >
                <div className={styles.panelHeader}>
                  <div>
                    <div className={styles.panelEyebrow}>
                      {creativeCopy.panelEyebrow}
                    </div>
                    <h2 className={styles.panelTitle}>{creativeCopy.panelTitle}</h2>
                  </div>
                  <button
                    type="button"
                    className={styles.panelClose}
                    onClick={requestCloseAd}
                    aria-label="닫기"
                    disabled={phase === "claiming"}
                  >
                    ×
                  </button>
                </div>
                <div className={styles.panelBody}>
                  <div className={styles.adFrame}>
                    <span className={styles.adMarker} aria-hidden>
                      AD
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={creativeCopy.image}
                      alt={creativeCopy.imageAlt}
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = creative.image;
                      }}
                    />
                  </div>
                  {watchLeft > 0 ? (
                    <p className={styles.adHint}>
                      {t("ads.rewardAfterSeconds", { seconds: watchLeft })}
                    </p>
                  ) : null}
                  <div className={styles.rewardPreview}>
                    <p className={styles.rewardPreviewLabel}>
                      {t("ads.oneOfRewards")}
                    </p>
                    <div className={styles.rewardPreviewRow}>
                      {REWARD_PREVIEW_ITEMS.map((item) => (
                        <div
                          className={styles.rewardPreviewItem}
                          key={item.key}
                        >
                          <div
                            className={
                              item.icons.length > 1
                                ? styles.rewardPreviewIconsStacked
                                : styles.rewardPreviewIcons
                            }
                          >
                            {item.icons.map((icon) => (
                              <div
                                className={styles.rewardPreviewIcon}
                                key={icon}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={icon} alt="" />
                              </div>
                            ))}
                          </div>
                          <span className={styles.rewardPreviewRange}>
                            {"count" in item
                              ? t("ads.count", { count: item.count })
                              : item.range}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {claimError ? (
                    <p className={styles.adHintError}>{claimError}</p>
                  ) : null}
                </div>
                <div className={styles.panelFooter}>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={requestCloseAd}
                    disabled={phase === "claiming"}
                  >
                    {t("ads.close")}
                  </button>
                  <button
                    type="button"
                    className={`${styles.btnPrimary}${
                      phase === "claiming" ? ` ${styles.btnPrimaryBusy}` : ""
                    }`}
                    onClick={() => void claimReward()}
                    disabled={watchLeft > 0 || phase === "claiming"}
                  >
                    {phase === "claiming"
                      ? t("ads.granting")
                      : watchLeft > 0
                        ? t("ads.seconds", { seconds: watchLeft })
                        : t("ads.claim")}
                  </button>
                </div>

                {confirmClose ? (
                  <div
                    className={styles.confirmOverlay}
                    role="alertdialog"
                    aria-modal="true"
                    aria-labelledby="hourly-ad-close-confirm-title"
                  >
                    <div className={styles.confirmCard}>
                      <p
                        id="hourly-ad-close-confirm-title"
                        className={styles.confirmText}
                      >
                        {t("ads.closeWithoutReward")}
                      </p>
                      <div className={styles.confirmActions}>
                        <button
                          type="button"
                          className={styles.btnGhost}
                          onClick={cancelCloseAd}
                        >
                          {t("ads.cancel")}
                        </button>
                        <button
                          type="button"
                          className={styles.btnPrimary}
                          onClick={confirmCloseAd}
                        >
                          {t("ads.close")}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}

      {rewardOpen && reward
        ? createPortal(
            <div
              className={`${styles.backdrop} ${styles.panelNested}`}
              onClick={phase === "result" ? closeResult : undefined}
            >
              <div
                className={styles.panel}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={t("ads.rewardDialogAria")}
              >
                <div className={styles.panelHeader}>
                  <div>
                    <h2 className={styles.panelTitle}>
                      {phase === "result"
                        ? t("ads.rewardAcquired")
                        : t("ads.drawingReward")}
                    </h2>
                  </div>
                  {phase === "result" ? (
                    <button
                      type="button"
                      className={styles.panelClose}
                      onClick={closeResult}
                      aria-label={t("ads.close")}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
                <div className={styles.panelBody}>
                  {phase === "spinning" ? (
                    <div className={styles.slotStage}>
                      <div className={styles.slotPointer} aria-hidden />
                      <div className={styles.slotWindow}>
                        <div
                          ref={trackRef}
                          className={styles.slotTrack}
                        >
                          {reelItems.map((item, i) => (
                            <div className={styles.slotItem} key={`${item.kind}-${i}`}>
                              <div className={styles.slotIcon}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={item.icon} alt="" />
                              </div>
                              <div className={styles.slotLabel}>{item.label}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.slotResult}>
                      <div className={styles.slotResultIcon}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={reward.icon} alt="" />
                      </div>
                      <div className={styles.slotResultTitle}>{reward.label}</div>
                      <div className={styles.slotResultAmount}>
                        {reward.kind === "gachaPremium" ||
                        reward.kind === "gachaStandard"
                          ? t("ads.count", { count: reward.amount })
                          : reward.amount.toLocaleString(locale)}
                      </div>
                    </div>
                  )}
                </div>
                <div className={styles.panelFooter} style={{ gridTemplateColumns: "1fr" }}>
                  {phase === "spinning" ? (
                    <button
                      type="button"
                      className={styles.btnGold}
                      onClick={requestStopSpin}
                    >
                      {t("ads.stop")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      onClick={closeResult}
                    >
                      {t("ads.confirm")}
                    </button>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
