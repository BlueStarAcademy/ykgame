"use client";

import { useEffect, useRef, useState } from "react";
import {
  MAINTENANCE_FLUIDS,
  bonusOutcomeAmount,
  bonusOutcomeKey,
  bonusTableForFluid,
  pointKindLabel,
  type MaintenanceBonusOutcome,
  type MaintenanceFluidId,
  type MaintenancePointKind,
} from "./maintenance";
import { yanmarAudio } from "./yanmarAudio";
import styles from "./MaintenanceBonusRoulette.module.css";

const STAR_ICON = "/images/star-currency.svg";
const CORE_ICON = "/images/yanmar/2d/enhance-core.svg";
const TICKET_STANDARD_ICON = "/images/yanmar/2d/gacha-ticket-standard.svg";
const TICKET_PREMIUM_ICON = "/images/yanmar/2d/gacha-ticket-premium.svg";
const POINT_ICONS: Record<MaintenancePointKind, string> = {
  dump: "/images/yanmar/2d/workshop-coin-dump.svg",
  crash: "/images/yanmar/2d/workshop-coin-crash.svg",
  hill: "/images/yanmar/2d/workshop-coin-hill.svg",
  monument: "/images/yanmar/2d/workshop-coin-monument.svg",
};

const REEL_LOOPS = 16;
const ITEM_HEIGHT = 4.6; /* rem — keep in sync with CSS .slotItem */
const SPIN_MS = 5_800;

type ReelItem = {
  key: string;
  label: string;
  icon: string;
  amount: number;
};

type Phase = "spinning" | "reveal";

function outcomeToReelItem(
  fluidId: MaintenanceFluidId,
  outcome: MaintenanceBonusOutcome,
): ReelItem {
  const pointKind = MAINTENANCE_FLUIDS[fluidId].pointKind;
  const key = bonusOutcomeKey(outcome);
  const amount = bonusOutcomeAmount(outcome);
  if (outcome.stars) {
    return { key, label: outcome.label, icon: STAR_ICON, amount };
  }
  if (outcome.workshopPoints) {
    return {
      key,
      label: outcome.label || `${pointKindLabel(pointKind)} +${amount}`,
      icon: POINT_ICONS[pointKind],
      amount,
    };
  }
  if (outcome.enhanceCores) {
    return { key, label: outcome.label, icon: CORE_ICON, amount };
  }
  if (outcome.gachaTicketsStandard) {
    return { key, label: outcome.label, icon: TICKET_STANDARD_ICON, amount };
  }
  if (outcome.gachaTicketsPremium) {
    return { key, label: outcome.label, icon: TICKET_PREMIUM_ICON, amount };
  }
  return { key, label: outcome.label, icon: STAR_ICON, amount };
}

function buildReel(fluidId: MaintenanceFluidId, winner: MaintenanceBonusOutcome) {
  const base = bonusTableForFluid(fluidId).map((entry) =>
    outcomeToReelItem(fluidId, entry.outcome),
  );
  const winnerItem = outcomeToReelItem(fluidId, winner);
  const winnerIndexInPool = Math.max(
    0,
    base.findIndex((item) => item.key === winnerItem.key),
  );
  const items: ReelItem[] = [];
  for (let i = 0; i < REEL_LOOPS; i++) {
    items.push(...base);
  }
  items.push(...base);
  const stopIndex = REEL_LOOPS * base.length + winnerIndexInPool;
  items[stopIndex] = winnerItem;
  items.push(...base.slice(0, 3));
  return { items, stopIndex, winnerItem };
}

export function MaintenanceBonusRoulette({
  fluidId,
  bonus,
  onDone,
}: {
  fluidId: MaintenanceFluidId;
  bonus: MaintenanceBonusOutcome;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("spinning");
  const [reelItems, setReelItems] = useState<ReelItem[]>([]);
  const [reelOffsetRem, setReelOffsetRem] = useState(0);
  const [wonItem, setWonItem] = useState<ReelItem | null>(null);
  const spinRafRef = useRef(0);
  const spinningRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const startedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (spinRafRef.current) cancelAnimationFrame(spinRafRef.current);
      spinningRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const { items, stopIndex, winnerItem } = buildReel(fluidId, bonus);
    setReelItems(items);
    setWonItem(winnerItem);
    setReelOffsetRem(0);
    spinningRef.current = true;
    stopRequestedRef.current = false;
    setPhase("spinning");

    const endOffset = stopIndex * ITEM_HEIGHT;
    const start = performance.now();
    let fromOffset = 0;
    let segmentStart = start;
    let segmentDuration = SPIN_MS;
    let finishing = false;

    const spinEase = (t: number) => {
      const clamped = Math.min(1, Math.max(0, t));
      const quint = 1 - (1 - clamped) ** 5;
      const expo = clamped === 1 ? 1 : 1 - 2 ** (-10 * clamped);
      return quint * 0.72 + expo * 0.28;
    };

    const frame = (now: number) => {
      if (!spinningRef.current) return;

      if (!finishing && stopRequestedRef.current) {
        finishing = true;
        const progress = Math.min(1, (now - segmentStart) / segmentDuration);
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
        setPhase("reveal");
        if (bonus.stars) {
          yanmarAudio.playStarAcquire();
        }
        return;
      }

      spinRafRef.current = requestAnimationFrame(frame);
    };

    spinRafRef.current = requestAnimationFrame(frame);
  }, [fluidId, bonus]);

  function requestStopSpin() {
    if (phase !== "spinning") return;
    stopRequestedRef.current = true;
  }

  const display = wonItem ?? outcomeToReelItem(fluidId, bonus);
  const isTicket = Boolean(
    bonus.gachaTicketsStandard || bonus.gachaTicketsPremium,
  );

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>
            {phase === "reveal" ? "보너스 획득!" : "보너스 뽑기"}
          </h3>
        </div>
        <div className={styles.body}>
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
                    <div className={styles.slotItem} key={`${item.key}-${i}`}>
                      <div className={styles.slotIcon}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.icon} alt="" draggable={false} />
                      </div>
                      <div className={styles.slotLabel}>{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.slotResult}>
              <div className={styles.slotResultEyebrow}>BONUS</div>
              <div className={styles.slotResultIcon}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={display.icon} alt="" draggable={false} />
              </div>
              <div className={styles.slotResultTitle}>{display.label}</div>
              <div className={styles.slotResultAmount}>
                {isTicket
                  ? `${display.amount}개`
                  : `+${display.amount.toLocaleString("ko-KR")}`}
              </div>
            </div>
          )}
        </div>
        <div className={styles.footer}>
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
              onClick={onDone}
            >
              확인
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
