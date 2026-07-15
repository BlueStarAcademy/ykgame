"use client";

import { useMemo, useState } from "react";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import { StarAmount } from "@/components/StarAmount";
import {
  MAINTENANCE_FLUID_IDS,
  MAINTENANCE_FLUIDS,
  PREMIUM_CAPACITY_MULT,
  PREMIUM_REPAIR_COST,
  TOP_CAPACITY_MULT,
  TOP_REPAIR_COST,
  getRepairLabels,
  type FluidSnapshot,
  type MaintenanceFluidId,
  type MaintenanceRepairKind,
  type MaintenanceSnapshot,
} from "./maintenance";

const REPAIR_ART = "/images/yanmar/2d/cockpit/repair-tent-premium.png?v=2";

const FLUID_ART: Record<MaintenanceFluidId, string> = {
  engineOil: "/images/yanmar/2d/repair/engine-oil.png?v=1",
  engineOilFilter: "/images/yanmar/2d/repair/engine-oil-filter.png?v=1",
  hydraulicOil: "/images/yanmar/2d/repair/hydraulic-oil.png?v=1",
  hydraulicFilter: "/images/yanmar/2d/repair/hydraulic-filter.png?v=1",
  fuelFilter: "/images/yanmar/2d/repair/fuel-filter.png?v=1",
  gearOil: "/images/yanmar/2d/repair/gear-oil.png?v=1",
};

interface RepairPanelProps {
  open: boolean;
  onClose: () => void;
  currency: number;
  maintenance: MaintenanceSnapshot | null;
  busy?: boolean;
  onRepair: (
    fluid: MaintenanceFluidId,
    kind: MaintenanceRepairKind,
  ) => void | Promise<void>;
}

type PendingRepair = {
  fluid: MaintenanceFluidId;
  kind: MaintenanceRepairKind;
};

function formatNextCycle(
  id: MaintenanceFluidId,
  capacityMult: number,
): string {
  const def = MAINTENANCE_FLUIDS[id];
  if (def.wear === "distance") {
    const km = ((def.cycleMeters ?? 0) * capacityMult) / 1000;
    return `교환주기 ${km.toLocaleString()} km`;
  }
  return `교환주기 ${(def.cycleDays ?? 0) * capacityMult}일`;
}

function capacityForKind(kind: MaintenanceRepairKind): number {
  if (kind === "premium") return PREMIUM_CAPACITY_MULT;
  if (kind === "top") return TOP_CAPACITY_MULT;
  return 1;
}

function buffTextForKind(kind: MaintenanceRepairKind): string | null {
  if (kind === "premium") return "민첩 +5% · 12시간";
  if (kind === "top") return "힘·인내 +8% · 24시간";
  return null;
}

function starCostForKind(kind: MaintenanceRepairKind): number {
  if (kind === "premium") return PREMIUM_REPAIR_COST;
  if (kind === "top") return TOP_REPAIR_COST;
  return 0;
}

function freeReady(fluid: FluidSnapshot): boolean {
  if (!fluid.freeAvailableAt) return true;
  return new Date(fluid.freeAvailableAt).getTime() <= Date.now();
}

function statusTone(
  percent: number,
  depleted: boolean,
): "ok" | "warn" | "dead" {
  if (depleted || percent <= 0) return "dead";
  if (percent <= 30) return "warn";
  return "ok";
}

function statusLabel(tone: "ok" | "warn" | "dead"): string {
  if (tone === "dead") return "고갈";
  if (tone === "warn") return "교체 필요";
  return "정상";
}

export function RepairPanel({
  open,
  onClose,
  currency,
  maintenance,
  busy,
  onRepair,
}: RepairPanelProps) {
  const [activeId, setActiveId] = useState<MaintenanceFluidId>("engineOil");
  const [pending, setPending] = useState<PendingRepair | null>(null);

  const activeFluid = useMemo(() => {
    return (
      maintenance?.fluids[activeId] ??
      ({
        id: activeId,
        label: MAINTENANCE_FLUIDS[activeId].label,
        remaining: 1,
        percent: 100,
        capacityMult: 1,
        wear: MAINTENANCE_FLUIDS[activeId].wear,
        freeAvailableAt: null,
        remainingMeters: null,
        remainingDays: null,
        depleted: false,
        warning: false,
      } satisfies FluidSnapshot)
    );
  }, [activeId, maintenance]);

  const labels = getRepairLabels(activeId);
  const freeOk = freeReady(activeFluid);
  const needsRepair = activeFluid.percent < 100;
  const tone = statusTone(activeFluid.percent, activeFluid.depleted);
  const gaugePercent = Math.max(0, Math.min(100, activeFluid.percent));
  const fluidArt = FLUID_ART[activeId];

  const pendingLabels = pending ? getRepairLabels(pending.fluid) : null;
  const pendingName = pending
    ? pending.kind === "free"
      ? pendingLabels!.free
      : pending.kind === "premium"
        ? pendingLabels!.premium
        : pendingLabels!.top
    : null;
  const pendingCycle = pending
    ? formatNextCycle(pending.fluid, capacityForKind(pending.kind))
    : null;
  const pendingBuff = pending ? buffTextForKind(pending.kind) : null;
  const pendingCost = pending ? starCostForKind(pending.kind) : 0;

  function requestRepair(kind: MaintenanceRepairKind) {
    if (!needsRepair || busy) return;
    setPending({ fluid: activeId, kind });
  }

  async function confirmRepair() {
    if (!pending || busy) return;
    const { fluid, kind } = pending;
    setPending(null);
    await onRepair(fluid, kind);
  }

  return (
    <AppModalOverlay
      open={open}
      onClose={() => {
        setPending(null);
        onClose();
      }}
    >
      <div className="yanmar-repair-panel">
        <div className="yanmar-repair-panel-header">
          <div className="yanmar-repair-panel-brand">
            <span className="yanmar-repair-panel-art" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={REPAIR_ART} alt="" draggable={false} />
            </span>
            <div className="yanmar-repair-panel-titles">
              <h2>정비소</h2>
            </div>
          </div>
          <div className="yanmar-repair-panel-header-right">
            <div className="yanmar-repair-panel-stars">
              <StarAmount
                value={currency}
                size={14}
                valueClassName="yanmar-repair-panel-star-value"
              />
            </div>
            <button
              type="button"
              className="yanmar-repair-panel-close"
              onClick={() => {
                setPending(null);
                onClose();
              }}
              aria-label="닫기"
            >
              ×
            </button>
          </div>
        </div>

        <div className="yanmar-repair-fluid-tabs" role="tablist">
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
                className={`yanmar-repair-fluid-tab is-${tabTone}${
                  selected ? " is-active" : ""
                }`}
                onClick={() => setActiveId(id)}
              >
                <span className="yanmar-repair-fluid-tab-art" aria-hidden>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={FLUID_ART[id]} alt="" draggable={false} />
                </span>
                <span className="yanmar-repair-fluid-tab-label">
                  {MAINTENANCE_FLUIDS[id].label}
                </span>
                <span className="yanmar-repair-fluid-tab-pct">{pct}%</span>
                <span className="yanmar-repair-fluid-tab-bar" aria-hidden>
                  <span
                    style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                  />
                </span>
              </button>
            );
          })}
        </div>

        <section className={`yanmar-repair-detail is-${tone}`}>
          <div className="yanmar-repair-detail-top">
            <div className="yanmar-repair-detail-copy">
              <div className="yanmar-repair-detail-art" aria-hidden>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fluidArt} alt="" draggable={false} />
              </div>
              <div className="yanmar-repair-detail-name-row">
                <h3>{activeFluid.label}</h3>
                <span className={`yanmar-repair-status is-${tone}`}>
                  {statusLabel(tone)}
                </span>
              </div>
            </div>
            <div
              className="yanmar-repair-gauge"
              style={{ ["--repair-pct" as string]: `${gaugePercent}%` }}
              aria-label={`${activeFluid.label} ${gaugePercent}%`}
            >
              <div className="yanmar-repair-gauge-ring">
                <strong>{gaugePercent}%</strong>
              </div>
            </div>
          </div>

          <div className="yanmar-repair-tier-list">
            <button
              type="button"
              className="yanmar-repair-tier is-free"
              disabled={busy || !needsRepair || !freeOk}
              onClick={() => requestRepair("free")}
            >
              <div className="yanmar-repair-tier-main">
                <div className="yanmar-repair-tier-title">
                  <span className="yanmar-repair-tier-rank">기본</span>
                  <strong className="yanmar-repair-tier-name">
                    {labels.free}
                  </strong>
                  <span className="yanmar-repair-tier-cycle">
                    {formatNextCycle(activeId, 1)}
                  </span>
                </div>
                {!needsRepair ? (
                  <span className="yanmar-repair-tier-cooldown">
                    잔량 100% · 정비 불필요
                  </span>
                ) : !freeOk && activeFluid.freeAvailableAt ? (
                  <span className="yanmar-repair-tier-cooldown">
                    {new Date(activeFluid.freeAvailableAt).toLocaleString()}{" "}
                    이후 가능
                  </span>
                ) : null}
              </div>
              <span className="yanmar-repair-tier-cta">무료</span>
            </button>

            <button
              type="button"
              className="yanmar-repair-tier is-premium"
              disabled={
                busy || !needsRepair || currency < PREMIUM_REPAIR_COST
              }
              onClick={() => requestRepair("premium")}
            >
              <div className="yanmar-repair-tier-main">
                <div className="yanmar-repair-tier-title">
                  <span className="yanmar-repair-tier-rank">추천</span>
                  <strong className="yanmar-repair-tier-name">
                    {labels.premium}
                  </strong>
                  <span className="yanmar-repair-tier-cycle">
                    {formatNextCycle(activeId, PREMIUM_CAPACITY_MULT)}
                  </span>
                </div>
                <span className="yanmar-repair-tier-buff">
                  {buffTextForKind("premium")}
                </span>
              </div>
              <span className="yanmar-repair-tier-cta">
                <StarAmount
                  value={PREMIUM_REPAIR_COST}
                  size={13}
                  valueClassName="yanmar-repair-tier-star"
                />
              </span>
            </button>

            <button
              type="button"
              className="yanmar-repair-tier is-top"
              disabled={busy || !needsRepair || currency < TOP_REPAIR_COST}
              onClick={() => requestRepair("top")}
            >
              <div className="yanmar-repair-tier-main">
                <div className="yanmar-repair-tier-title">
                  <span className="yanmar-repair-tier-rank">최상</span>
                  <strong className="yanmar-repair-tier-name">
                    {labels.top}
                  </strong>
                  <span className="yanmar-repair-tier-cycle">
                    {formatNextCycle(activeId, TOP_CAPACITY_MULT)}
                  </span>
                </div>
                <span className="yanmar-repair-tier-buff">
                  {buffTextForKind("top")}
                </span>
              </div>
              <span className="yanmar-repair-tier-cta">
                <StarAmount
                  value={TOP_REPAIR_COST}
                  size={13}
                  valueClassName="yanmar-repair-tier-star"
                />
              </span>
            </button>
          </div>
        </section>

        {pending ? (
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
                  src={FLUID_ART[pending.fluid]}
                  alt=""
                  draggable={false}
                />
              </div>
              <h3 id="yanmar-repair-confirm-title">정비 확인</h3>
              <p className="yanmar-repair-confirm-item">
                {MAINTENANCE_FLUIDS[pending.fluid].label} · {pendingName}
              </p>
              <ul className="yanmar-repair-confirm-facts">
                <li>{pendingCycle}</li>
                {pendingBuff ? <li>{pendingBuff}</li> : null}
                <li className="yanmar-repair-confirm-cost">
                  {pendingCost > 0 ? (
                    <>
                      소모{" "}
                      <StarAmount
                        value={pendingCost}
                        size={14}
                        valueClassName="yanmar-repair-tier-star"
                      />
                    </>
                  ) : (
                    "소모 없음 (무료)"
                  )}
                </li>
              </ul>
              <div className="yanmar-repair-confirm-actions">
                <button
                  type="button"
                  className="yanmar-repair-confirm-cancel"
                  disabled={busy}
                  onClick={() => setPending(null)}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="yanmar-repair-confirm-ok"
                  disabled={busy}
                  onClick={() => void confirmRepair()}
                >
                  정비하기
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppModalOverlay>
  );
}
