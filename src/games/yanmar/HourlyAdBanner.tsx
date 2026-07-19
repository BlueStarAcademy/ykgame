"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRegisterInGameBackDismiss } from "@/hooks/useInGameBackNavigation";
import styles from "./HourlyAdBanner.module.css";
import {
  HOURLY_AD_REWARD_POOL,
  HOURLY_AD_SLOT_DECAY_MS,
  HOURLY_AD_WATCH_SEC,
  formatMmSs,
  getHourlyAdBannerRemainingMs,
  getHourlyAdHourBucket,
  makeHourlyAdEventId,
  markHourlyAdClaimedLocally,
  rollHourlyAdReward,
  saveHourlyAdGrantLocally,
  wasHourlyAdClaimedLocally,
  type HourlyAdClaimResult,
  type HourlyAdReward,
} from "./hourlyAdReward";
import { yanmarAudio } from "./yanmarAudio";

const AD_IMAGE = "/images/yanmar/ads/sv10-sv11-launch.png";
const REEL_LOOPS = 18;
const ITEM_HEIGHT = 4.6; /* rem — keep in sync with CSS .slotItem */

const REWARD_PREVIEW_ITEMS = [
  {
    key: "stars",
    range: "100~300",
    icons: ["/images/star-currency.svg"],
  },
  {
    key: "gachaPremium",
    range: "2개",
    icons: ["/images/yanmar/2d/gacha-ticket-premium.svg"],
  },
  {
    key: "gachaStandard",
    range: "5개",
    icons: ["/images/yanmar/2d/gacha-ticket-standard.svg"],
  },
  {
    key: "points",
    range: "100~300",
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
  const [mounted, setMounted] = useState(false);
  const [bannerSec, setBannerSec] = useState(0);
  const [claimed, setClaimed] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [watchLeft, setWatchLeft] = useState(HOURLY_AD_WATCH_SEC);
  const [reward, setReward] = useState<HourlyAdReward | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const [reelItems, setReelItems] = useState<
    { kind: string; label: string; icon: string }[]
  >([]);
  const [reelOffsetRem, setReelOffsetRem] = useState(0);
  const spinRafRef = useRef(0);
  const spinningRef = useRef(false);
  const stopRequestedRef = useRef(false);
  /** True once server/local grant is finalized (independent of 확인). */
  const grantFinalizedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!enabled || !mounted) return;

    const tick = () => {
      const now = Date.now();
      const bucket = getHourlyAdHourBucket(now);
      setClaimed(wasHourlyAdClaimedLocally(bucket));
      const remainMs = getHourlyAdBannerRemainingMs(now);
      setBannerSec(remainMs > 0 ? remainMs / 1000 : 0);
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
    phase === "idle";

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
    };
  }, []);

  useEffect(() => {
    const persistClaimed = () => {
      if (!grantFinalizedRef.current) return;
      markHourlyAdClaimedLocally(getHourlyAdHourBucket());
    };
    window.addEventListener("pagehide", persistClaimed);
    document.addEventListener("visibilitychange", persistClaimed);
    return () => {
      window.removeEventListener("pagehide", persistClaimed);
      document.removeEventListener("visibilitychange", persistClaimed);
    };
  }, []);

  function openAd() {
    if (claimed || bannerSec <= 0) return;
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
    const bucket = getHourlyAdHourBucket();
    markHourlyAdClaimedLocally(bucket);
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
    setReelOffsetRem(0);
    spinningRef.current = true;
    stopRequestedRef.current = false;
    setPhase("spinning");

    const endOffset = stopIndex * ITEM_HEIGHT;
    const start = performance.now();
    let fromOffset = 0;
    let segmentStart = start;
    let segmentDuration = HOURLY_AD_SLOT_DECAY_MS;
    let finishing = false;

    /** Fast start, long soft landing — reads like a physical reel. */
    const spinEase = (t: number) => {
      const clamped = Math.min(1, Math.max(0, t));
      // Blend: mostly easeOutQuint, with a bit of easeOutExpo for a softer tail.
      const quint = 1 - (1 - clamped) ** 5;
      const expo = clamped === 1 ? 1 : 1 - 2 ** (-10 * clamped);
      return quint * 0.72 + expo * 0.28;
    };

    const frame = (now: number) => {
      if (!spinningRef.current) return;

      if (!finishing && stopRequestedRef.current) {
        finishing = true;
        const progress = Math.min(
          1,
          (now - segmentStart) / segmentDuration,
        );
        fromOffset = fromOffset + (endOffset - fromOffset) * spinEase(progress);
        segmentStart = now;
        const remain = 1 - progress;
        segmentDuration = Math.min(1600, Math.max(900, remain * 1800));
      }

      const t = Math.min(1, (now - segmentStart) / segmentDuration);
      const offset = fromOffset + (endOffset - fromOffset) * spinEase(t);
      setReelOffsetRem(offset);

      if (t >= 1) {
        spinningRef.current = false;
        setReelOffsetRem(endOffset);
        setPhase("result");
        if (won.kind === "stars") {
          yanmarAudio.playStarAcquire();
        }
        return;
      }

      spinRafRef.current = requestAnimationFrame(frame);
    };

    spinRafRef.current = requestAnimationFrame(frame);
  }

  function requestStopSpin() {
    if (phase !== "spinning") return;
    stopRequestedRef.current = true;
  }

  async function claimReward() {
    if (phase !== "ad" || watchLeft > 0) return;
    setPhase("claiming");
    setClaimError(null);

    const bucket = getHourlyAdHourBucket();
    const eventId = makeHourlyAdEventId(bucket);

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
      saveHourlyAdGrantLocally(bucket, result);
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
    setReelOffsetRem(0);
  }

  if (!mounted) return null;

  return (
    <>
      {showTeaser ? (
        <button
          type="button"
          className={styles.teaser}
          onClick={openAd}
          aria-label="SV10·SV11 출시 광고 보상 보기"
        >
          <span className={styles.teaserShine} aria-hidden />
          <div className={styles.teaserMedia}>
            <span className={styles.teaserBadge}>NEW</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={AD_IMAGE} alt="" draggable={false} />
          </div>
          <div className={styles.teaserBody}>
            <div className={styles.teaserTitle}>SV10·SV11 출시!</div>
            <div className={styles.teaserSub}>탭하고 보상 받기</div>
            <div className={styles.teaserTimer}>
              <span className={styles.teaserTimerLabel}>남은 시간</span>
              <span>{formatMmSs(bannerSec)}</span>
            </div>
          </div>
        </button>
      ) : null}

      {adOpen
        ? createPortal(
            <div className={styles.backdrop} onClick={requestCloseAd}>
              <div
                className={styles.panel}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="SV10·SV11 출시 광고"
              >
                <div className={styles.panelHeader}>
                  <div>
                    <div className={styles.panelEyebrow}>Yanmar New Model</div>
                    <h2 className={styles.panelTitle}>SV10·SV11 출시!</h2>
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={AD_IMAGE}
                      alt="얀마 SV10·SV11 미니굴착기 출시"
                    />
                  </div>
                  {watchLeft > 0 ? (
                    <p className={styles.adHint}>{watchLeft}초 후 보상 획득</p>
                  ) : null}
                  <div className={styles.rewardPreview}>
                    <p className={styles.rewardPreviewLabel}>
                      아래 보상중 한 가지 획득
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
                            {item.range}
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
                    닫기
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
                      ? "지급 중…"
                      : watchLeft > 0
                        ? `${watchLeft}초`
                        : "보상받기"}
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
                        보상을 받지 않고 창을 닫으시겠습니까?
                      </p>
                      <div className={styles.confirmActions}>
                        <button
                          type="button"
                          className={styles.btnGhost}
                          onClick={cancelCloseAd}
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          className={styles.btnPrimary}
                          onClick={confirmCloseAd}
                        >
                          닫기
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
                aria-label="광고 보상"
              >
                <div className={styles.panelHeader}>
                  <div>
                    <h2 className={styles.panelTitle}>
                      {phase === "result" ? "보상 획득!" : "보상 추첨 중"}
                    </h2>
                  </div>
                  {phase === "result" ? (
                    <button
                      type="button"
                      className={styles.panelClose}
                      onClick={closeResult}
                      aria-label="닫기"
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
                          className={styles.slotTrack}
                          style={{
                            transform: `translate3d(0, -${reelOffsetRem}rem, 0)`,
                          }}
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
                          ? `${reward.amount}개`
                          : reward.amount.toLocaleString("ko-KR")}
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
                      멈춤
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      onClick={closeResult}
                    >
                      확인
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
