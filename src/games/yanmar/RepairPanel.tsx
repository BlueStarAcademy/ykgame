"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import {
  maintenanceFluidBlurb,
  maintenanceFluidLabel,
  maintenanceFluidWhyReplace,
  maintenancePointKindLabel,
} from "@/i18n/yanmarCatalog";
import {
  MAINTENANCE_CLAIM_BUFF,
  MAINTENANCE_FLUID_ART,
  MAINTENANCE_FLUID_IDS,
  MAINTENANCE_FLUIDS,
  MAINTENANCE_CLAIM_SKEW_MS,
  formatRemainingHhMm,
  maintenancePayoutRanges,
  type FluidSnapshot,
  type MaintenanceBonusOutcome,
  type MaintenanceClaimBuff,
  type MaintenanceFluidId,
  type MaintenanceGrantedPayout,
  type MaintenancePointKind,
  type MaintenanceSnapshot,
} from "./maintenance";
import { MaintenanceBonusRoulette } from "./MaintenanceBonusRoulette";

const REPAIR_ART = "/images/yanmar/2d/cockpit/repair-tent-premium.png?v=2";
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

function formatRangeAmount(
  min: number,
  max: number,
  asCount: boolean,
): string {
  if (min === max) {
    return asCount
      ? `${min.toLocaleString()}개`
      : `+${min.toLocaleString()}`;
  }
  return asCount
    ? `${min.toLocaleString()}~${max.toLocaleString()}개`
    : `+${min.toLocaleString()}~${max.toLocaleString()}`;
}

function RewardRangeChip({
  src,
  label,
  amountLabel,
}: {
  src?: string;
  label: string;
  amountLabel: string;
}) {
  const caption = `${label} ${amountLabel}`;
  return (
    <span
      className="yanmar-repair-reward-chip is-icon"
      title={caption}
      aria-label={caption}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" draggable={false} />
      ) : null}
      <strong className="yanmar-repair-reward-amt">{amountLabel}</strong>
      {!src ? (
        <em className="yanmar-repair-reward-exp-label">{label}</em>
      ) : null}
    </span>
  );
}

export type MaintenanceClaimResult = {
  bonus: MaintenanceBonusOutcome;
  buff: MaintenanceClaimBuff;
  granted: MaintenanceGrantedPayout;
};

interface RepairPanelProps {
  open: boolean;
  onClose: () => void;
  maintenance: MaintenanceSnapshot | null;
  busy?: boolean;
  /** serverNow - Date.now() offset for accurate countdown. */
  clockOffsetMs?: number;
  onRepair: (
    fluid: MaintenanceFluidId,
  ) => void | Promise<MaintenanceClaimResult | null | undefined>;
}

function statusTone(
  percent: number,
  depleted: boolean,
): "ok" | "warn" | "dead" {
  if (depleted || percent <= 0) return "dead";
  if (percent <= 30) return "warn";
  return "ok";
}

function statusLabel(
  t: ReturnType<typeof useTranslations>,
  tone: "ok" | "warn" | "dead",
  exchangeEligible: boolean,
): string {
  if (exchangeEligible || tone === "dead") return t("exchangeAvailable");
  if (tone === "warn") return t("expiringSoon");
  return t("normal");
}

function RewardPreview({
  fluidId,
  compact,
}: {
  fluidId: MaintenanceFluidId;
  compact?: boolean;
}) {
  const t = useTranslations("yanmar.repair");
  const catalogT = useTranslations("yanmar");
  const def = MAINTENANCE_FLUIDS[fluidId];
  const buff = MAINTENANCE_CLAIM_BUFF[fluidId];
  const ranges = maintenancePayoutRanges(fluidId);
  return (
    <div
      className={`yanmar-repair-reward-preview-body${compact ? " is-compact" : ""}`}
    >
      <div className="yanmar-repair-reward-grid" aria-label={t("rewardRange")}>
        <RewardRangeChip
          src={STAR_ICON}
          label={t("stars")}
          amountLabel={formatRangeAmount(
            ranges.stars.min,
            ranges.stars.max,
            false,
          )}
        />
        <RewardRangeChip
          src={POINT_ICONS[def.pointKind]}
          label={maintenancePointKindLabel(catalogT, def.pointKind)}
          amountLabel={formatRangeAmount(
            ranges.workshopPoints.min,
            ranges.workshopPoints.max,
            false,
          )}
        />
        {ranges.enhanceCores ? (
          <RewardRangeChip
            src={CORE_ICON}
            label={t("enhanceCore")}
            amountLabel={formatRangeAmount(
              ranges.enhanceCores.min,
              ranges.enhanceCores.max,
              false,
            )}
          />
        ) : null}
        {ranges.gachaTicketsStandard ? (
          <RewardRangeChip
            src={TICKET_STANDARD_ICON}
            label={t("standardTicket")}
            amountLabel={formatRangeAmount(
              ranges.gachaTicketsStandard.min,
              ranges.gachaTicketsStandard.max,
              true,
            )}
          />
        ) : null}
        {ranges.gachaTicketsPremium ? (
          <RewardRangeChip
            src={TICKET_PREMIUM_ICON}
            label={t("premiumTicket")}
            amountLabel={formatRangeAmount(
              ranges.gachaTicketsPremium.min,
              ranges.gachaTicketsPremium.max,
              true,
            )}
          />
        ) : null}
        {ranges.xpGarnish ? (
          <span
            className="yanmar-repair-reward-chip is-icon is-xp"
            title={`EXP +${ranges.xpGarnish.toLocaleString()}`}
            aria-label={`EXP +${ranges.xpGarnish.toLocaleString()}`}
          >
            <strong className="yanmar-repair-reward-amt">
              +{ranges.xpGarnish.toLocaleString()}
            </strong>
            <em className="yanmar-repair-reward-exp-label">EXP</em>
          </span>
        ) : null}
        <span className="yanmar-repair-reward-chip is-buff">
          <em>{t(`catalog.buffs.${fluidId}`)}</em>
        </span>
      </div>
    </div>
  );
}

export function RepairPanel({
  open,
  onClose,
  maintenance,
  busy,
  clockOffsetMs = 0,
  onRepair,
}: RepairPanelProps) {
  const t = useTranslations("yanmar.repair");
  const catalogT = useTranslations("yanmar");
  const [activeId, setActiveId] = useState<MaintenanceFluidId>("engineOil");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [claimResult, setClaimResult] =
    useState<MaintenanceClaimResult | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now() + clockOffsetMs);

  useEffect(() => {
    if (!open) return;
    const tick = () => setNowMs(Date.now() + clockOffsetMs);
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [open, clockOffsetMs]);

  useEffect(() => {
    if (open) return;
    setConfirmOpen(false);
    setClaimResult(null);
  }, [open]);

  const activeFluid = useMemo(() => {
    return (
      maintenance?.fluids[activeId] ??
      ({
        id: activeId,
        label: maintenanceFluidLabel(catalogT, activeId),
        remaining: 1,
        percent: 100,
        capacityMult: 1,
        wear: "calendar",
        freeAvailableAt: null,
        filledAt: null,
        remainingMeters: null,
        remainingDays: null,
        remainingMs: MAINTENANCE_FLUIDS[activeId].cycleHours * 3600_000,
        cycleHours: MAINTENANCE_FLUIDS[activeId].cycleHours,
        depleted: false,
        warning: false,
        exchangeEligible: false,
      } satisfies FluidSnapshot)
    );
  }, [activeId, maintenance]);

  const def = MAINTENANCE_FLUIDS[activeId];

  const liveRemainingMs = useMemo(() => {
    const filled = activeFluid.filledAt
      ? new Date(activeFluid.filledAt).getTime()
      : NaN;
    if (!Number.isFinite(filled)) return activeFluid.remainingMs;
    const capacityMs =
      activeFluid.cycleHours *
      Math.max(1, activeFluid.capacityMult) *
      3600_000;
    const elapsed = Math.max(0, nowMs - filled);
    return Math.max(0, capacityMs - elapsed);
  }, [activeFluid, nowMs]);

  const capacityMs =
    activeFluid.cycleHours *
    Math.max(1, activeFluid.capacityMult) *
    3600_000;
  const liveEligible = liveRemainingMs <= MAINTENANCE_CLAIM_SKEW_MS;
  const livePercent = Math.round(
    Math.max(0, Math.min(100, (liveRemainingMs / capacityMs) * 100)),
  );

  const tone = statusTone(livePercent, liveEligible);
  const canExchange = liveEligible;
  const remainingHhMm = formatRemainingHhMm(liveRemainingMs);

  async function confirmExchange() {
    if (!canExchange || busy) return;
    setConfirmOpen(false);
    const result = await onRepair(activeId);
    if (result) {
      setClaimResult(result);
    }
  }

  function closeAll() {
    setConfirmOpen(false);
    setClaimResult(null);
    onClose();
  }

  function dismissClaimResult() {
    setClaimResult(null);
  }

  return (
    <AppModalOverlay
      open={open}
      onClose={closeAll}
      panelClassName="yanmar-repair-modal-shell"
    >
      <div className="yanmar-repair-panel is-premium-v2">
        <header className="yanmar-repair-panel-header">
          <div className="yanmar-repair-panel-brand">
            <span className="yanmar-repair-panel-art" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={REPAIR_ART} alt="" draggable={false} />
            </span>
            <div className="yanmar-repair-panel-titles">
              <h2>{t("title")}</h2>
            </div>
          </div>
          <button
            type="button"
            className="yanmar-repair-panel-close"
            onClick={closeAll}
            aria-label={t("close")}
          >
            ×
          </button>
        </header>

        <div className="yanmar-repair-panel-body">
          <div className="yanmar-repair-fluid-rail" role="tablist">
            {MAINTENANCE_FLUID_IDS.map((id) => {
              const snap = maintenance?.fluids[id];
              const pct = snap?.percent ?? 100;
              const selected = id === activeId;
              const tabTone = statusTone(pct, Boolean(snap?.depleted));
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`yanmar-repair-fluid-rail-item is-${tabTone}${
                    selected ? " is-active" : ""
                  }`}
                  onClick={() => setActiveId(id)}
                >
                  <span className="yanmar-repair-fluid-rail-art" aria-hidden>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={MAINTENANCE_FLUID_ART[id]}
                      alt=""
                      draggable={false}
                    />
                    {tabTone !== "ok" ? (
                      <span
                        className={`yanmar-repair-fluid-dot is-${tabTone}`}
                      />
                    ) : null}
                  </span>
                  <span className="yanmar-repair-fluid-rail-label">
                    {maintenanceFluidLabel(catalogT, id)}
                  </span>
                  <span className="yanmar-repair-fluid-rail-bar" aria-hidden>
                    <span
                      style={{
                        width: `${Math.max(0, Math.min(100, pct))}%`,
                      }}
                    />
                  </span>
                </button>
              );
            })}
          </div>

          <section className={`yanmar-repair-hero is-${tone}`}>
            <div className="yanmar-repair-hero-row">
              <div className="yanmar-repair-hero-art" aria-hidden>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={MAINTENANCE_FLUID_ART[activeId]}
                  alt=""
                  draggable={false}
                />
              </div>

              <div className="yanmar-repair-hero-info">
                <div className="yanmar-repair-detail-name-row">
                  <h3>{maintenanceFluidLabel(catalogT, activeId)}</h3>
                  <span className={`yanmar-repair-status is-${tone}`}>
                    {statusLabel(t, tone, canExchange)}
                  </span>
                </div>
                <p className="yanmar-repair-meta-line">
                  {t("cycleHours", { hours: activeFluid.cycleHours })}
                </p>
              </div>

              <div className="yanmar-repair-gauge-block">
                <div
                  className="yanmar-repair-gauge"
                  style={{ ["--repair-pct" as string]: `${livePercent}%` }}
                  aria-label={t("gaugeLabel", {
                    fluid: maintenanceFluidLabel(catalogT, activeId),
                    percent: livePercent,
                  })}
                >
                  <div className="yanmar-repair-gauge-ring">
                    <strong>{livePercent}%</strong>
                  </div>
                </div>
                <p className="yanmar-repair-gauge-time">{remainingHhMm}</p>
              </div>
            </div>

            <div className="yanmar-repair-copy-block">
              <p className="yanmar-repair-fluid-blurb">
                {maintenanceFluidBlurb(catalogT, activeId)}
              </p>
              <p className="yanmar-repair-fluid-why">
                {maintenanceFluidWhyReplace(catalogT, activeId)}
              </p>
            </div>
          </section>

          <div className="yanmar-repair-reward-preview">
            <h4>{t("exchangeRewards")}</h4>
            <RewardPreview fluidId={activeId} />
          </div>
        </div>

        <footer className="yanmar-repair-panel-footer">
          <button
            type="button"
            className={`yanmar-repair-claim-cta${canExchange ? " is-ready" : ""}`}
            disabled={busy || !canExchange}
            onClick={() => setConfirmOpen(true)}
          >
            {canExchange ? t("exchange") : t("waiting")}
          </button>
        </footer>

        {confirmOpen ? (
          <div
            className="yanmar-repair-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="yanmar-repair-confirm-title"
          >
            <div className="yanmar-repair-confirm-card">
              <div className="yanmar-repair-confirm-art" aria-hidden>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={MAINTENANCE_FLUID_ART[activeId]}
                  alt=""
                  draggable={false}
                />
              </div>
              <h3 id="yanmar-repair-confirm-title">
                {maintenanceFluidLabel(catalogT, activeId)}
              </h3>
              <RewardPreview fluidId={activeId} compact />
              <div className="yanmar-repair-confirm-actions">
                <button
                  type="button"
                  className="yanmar-repair-confirm-cancel"
                  disabled={busy}
                  onClick={() => setConfirmOpen(false)}
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  className="yanmar-repair-confirm-ok"
                  disabled={busy}
                  onClick={() => void confirmExchange()}
                >
                  {t("exchange")}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {claimResult ? (
          <MaintenanceBonusRoulette
            fluidId={activeId}
            bonus={claimResult.bonus}
            granted={claimResult.granted}
            buffLabel={claimResult.buff.label}
            onDone={dismissClaimResult}
          />
        ) : null}
      </div>
    </AppModalOverlay>
  );
}
