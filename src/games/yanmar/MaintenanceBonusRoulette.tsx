"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  MAINTENANCE_FLUIDS,
  bonusTableForFluid,
  maintenancePackageHighlight,
  type MaintenanceBonusOutcome,
  type MaintenanceFluidId,
  type MaintenanceGrantedPayout,
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
};

type Phase = "spinning" | "reveal";

type GrantChip = {
  key: string;
  src: string;
  label: string;
  amountLabel: string;
};

function iconForKind(
  kind: ReturnType<typeof maintenancePackageHighlight>["iconKind"],
  pointKind: MaintenancePointKind,
): string {
  switch (kind) {
    case "stars":
      return STAR_ICON;
    case "points":
      return POINT_ICONS[pointKind];
    case "cores":
      return CORE_ICON;
    case "ticket-std":
      return TICKET_STANDARD_ICON;
    case "ticket-prem":
      return TICKET_PREMIUM_ICON;
  }
}

function highlightToReelItem(
  fluidId: MaintenanceFluidId,
  bonus: MaintenanceBonusOutcome | Parameters<
    typeof maintenancePackageHighlight
  >[1],
  t: ReturnType<typeof useTranslations>,
): ReelItem {
  const pointKind = MAINTENANCE_FLUIDS[fluidId].pointKind;
  const highlight = maintenancePackageHighlight(fluidId, bonus, t);
  return {
    key: highlight.key,
    label: highlight.label,
    icon: iconForKind(highlight.iconKind, pointKind),
  };
}

function buildReel(
  fluidId: MaintenanceFluidId,
  winner: MaintenanceBonusOutcome,
  t: ReturnType<typeof useTranslations>,
) {
  const base = bonusTableForFluid(fluidId).map((entry) =>
    highlightToReelItem(fluidId, entry.outcome, t),
  );
  const winnerItem = highlightToReelItem(fluidId, winner, t);
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

function grantChips(
  granted: MaintenanceGrantedPayout,
  t: ReturnType<typeof useTranslations>,
): GrantChip[] {
  const chips: GrantChip[] = [];
  if (granted.stars > 0) {
    chips.push({
      key: "stars",
      src: STAR_ICON,
      label: t("repair.stars"),
      amountLabel: `+${granted.stars.toLocaleString()}`,
    });
  }
  if (granted.workshopPoints > 0) {
    chips.push({
      key: "points",
      src: POINT_ICONS[granted.pointKind],
      label: t(`repair.catalog.pointKinds.${granted.pointKind}`),
      amountLabel: `+${granted.workshopPoints.toLocaleString()}`,
    });
  }
  if (granted.enhanceCores > 0) {
    chips.push({
      key: "cores",
      src: CORE_ICON,
      label: t("repair.enhanceCore"),
      amountLabel: `+${granted.enhanceCores.toLocaleString()}`,
    });
  }
  if (granted.gachaTicketsStandard > 0) {
    chips.push({
      key: "ticket-std",
      src: TICKET_STANDARD_ICON,
      label: t("repair.standardTicket"),
      amountLabel: t("maintenanceRoulette.count", {
        count: granted.gachaTicketsStandard,
      }),
    });
  }
  if (granted.gachaTicketsPremium > 0) {
    chips.push({
      key: "ticket-prem",
      src: TICKET_PREMIUM_ICON,
      label: t("repair.premiumTicket"),
      amountLabel: t("maintenanceRoulette.count", {
        count: granted.gachaTicketsPremium,
      }),
    });
  }
  if (granted.xpGarnish > 0) {
    chips.push({
      key: "xp",
      src: STAR_ICON,
      label: "EXP",
      amountLabel: `+${granted.xpGarnish.toLocaleString()}`,
    });
  }
  return chips;
}

export function MaintenanceBonusRoulette({
  fluidId,
  bonus,
  granted,
  buffLabel,
  onDone,
}: {
  fluidId: MaintenanceFluidId;
  bonus: MaintenanceBonusOutcome;
  granted: MaintenanceGrantedPayout;
  buffLabel: string;
  onDone: () => void;
}) {
  const t = useTranslations("yanmar");
  const [phase, setPhase] = useState<Phase>("spinning");
  const [reelItems, setReelItems] = useState<ReelItem[]>([]);
  const [reelOffsetRem, setReelOffsetRem] = useState(0);
  const spinRafRef = useRef(0);
  const spinningRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const startedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (spinRafRef.current) cancelAnimationFrame(spinRafRef.current);
      spinningRef.current = false;
      yanmarAudio.stopRouletteSpin();
    };
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const { items, stopIndex } = buildReel(fluidId, bonus, t);
    setReelItems(items);
    setReelOffsetRem(0);
    spinningRef.current = true;
    stopRequestedRef.current = false;
    setPhase("spinning");
    yanmarAudio.playRouletteSpin();

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
        yanmarAudio.stopRouletteSpin();
        setReelOffsetRem(endOffset);
        setPhase("reveal");
        yanmarAudio.playItemAcquire();
        if (granted.stars > 0) {
          yanmarAudio.playStarAcquire();
        }
        return;
      }

      spinRafRef.current = requestAnimationFrame(frame);
    };

    spinRafRef.current = requestAnimationFrame(frame);
  }, [fluidId, bonus, granted.stars, t]);

  function requestStopSpin() {
    if (phase !== "spinning") return;
    stopRequestedRef.current = true;
  }

  const chips = grantChips(granted, t);

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>
            {phase === "reveal"
              ? t("maintenanceRoulette.rewardAcquired")
              : t("maintenanceRoulette.drawingReward")}
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
                      <div className={styles.slotLabelCol}>
                        <div className={styles.slotLabel}>{item.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.slotResult}>
              <div className={styles.grantGrid} aria-label={t("maintenanceRoulette.allRewards")}>
                {chips.map((chip) => (
                  <span
                    key={chip.key}
                    className={styles.grantChip}
                    title={`${chip.label} ${chip.amountLabel}`}
                  >
                    {chip.key === "xp" ? (
                      <strong className={styles.grantXp}>EXP</strong>
                    ) : (
                      <span className={styles.grantIcon}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={chip.src} alt="" draggable={false} />
                      </span>
                    )}
                    <span className={styles.grantMeta}>
                      <em>{chip.label}</em>
                      <strong>{chip.amountLabel}</strong>
                    </span>
                  </span>
                ))}
              </div>
              {buffLabel ? (
                <p className={styles.buffLine}>{buffLabel}</p>
              ) : null}
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
              {t("maintenanceRoulette.stop")}
            </button>
          ) : (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={onDone}
            >
              {t("maintenanceRoulette.confirm")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
