"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import {
  emptyAbilityAlloc,
  recommendAbilityAlloc,
  spentAbilityPoints,
  type AbilityAlloc,
} from "./abilityAlloc";
import {
  DEFAULT_CHASSIS_ID,
  getChassisDef,
  type ChassisModelId,
} from "./chassisCatalog";
import { MAIN_OPTION_KEYS, type MainOptionKey } from "./gearCatalog";
import { chassisModelThumbSrc } from "./gearArt";

interface ChassisPanelProps {
  open?: boolean;
  onClose?: () => void;
  playerLevel: number;
  currency: number;
  activeId: ChassisModelId | string;
  ownedIds: string[];
  busy?: boolean;
  abilityAlloc?: AbilityAlloc;
  /** When true, render gallery body without modal chrome. */
  embedded?: boolean;
  onPurchase: (id: ChassisModelId) => void | Promise<void>;
  onEquip: (id: ChassisModelId) => void | Promise<void>;
  onAbilityAllocSave?: (alloc: AbilityAlloc) => void | Promise<void>;
}

function allocEqual(a: AbilityAlloc, b: AbilityAlloc): boolean {
  return MAIN_OPTION_KEYS.every((key) => a[key] === b[key]);
}

/** Chassis switching is locked to ViO17-1; gallery is ability-alloc + info only. */
export function ChassisGallery({
  playerLevel,
  busy,
  abilityAlloc,
  onAbilityAllocSave,
}: Omit<ChassisPanelProps, "open" | "onClose" | "embedded">) {
  const t = useTranslations("yanmar.chassis");
  const selected = getChassisDef(DEFAULT_CHASSIS_ID);
  const [artPreviewOpen, setArtPreviewOpen] = useState(false);
  const allocEnabled = Boolean(abilityAlloc && onAbilityAllocSave);
  const [draft, setDraft] = useState<AbilityAlloc>(
    () => abilityAlloc ?? emptyAbilityAlloc(),
  );

  useEffect(() => {
    if (abilityAlloc) setDraft(abilityAlloc);
  }, [abilityAlloc]);

  const totalPoints = Math.max(0, Math.floor(playerLevel));
  const spent = spentAbilityPoints(draft);
  const remaining = Math.max(0, totalPoints - spent);
  const dirty = useMemo(
    () => (abilityAlloc ? !allocEqual(draft, abilityAlloc) : false),
    [draft, abilityAlloc],
  );

  const bump = (key: MainOptionKey, delta: number) => {
    if (busy || !allocEnabled) return;
    setDraft((prev) => {
      const nextVal = prev[key] + delta;
      if (nextVal < 0) return prev;
      if (delta > 0 && spentAbilityPoints(prev) + delta > totalPoints) return prev;
      return { ...prev, [key]: nextVal };
    });
  };

  const thumbSrc = chassisModelThumbSrc(selected.id);
  const statLabel = (key: MainOptionKey) => t(`stats.${key}`);
  const weightLabel = t("weight", {
    weight: selected.weightKg.toLocaleString(),
  });

  return (
    <div className="yanmar-chassis-gallery">
      <div className="yanmar-chassis-showcase">
        <div className="yanmar-chassis-showcase-visual is-active">
          <div className="yanmar-chassis-showcase-stage" aria-hidden>
            <span className="yanmar-chassis-showcase-glow" />
            <span className="yanmar-chassis-showcase-floor" />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={thumbSrc}
            src={thumbSrc}
            alt=""
            className="yanmar-chassis-showcase-img"
            draggable={false}
          />
          <span className="yanmar-chassis-weight-pill">{weightLabel}</span>
          <button
            type="button"
            className="yanmar-chassis-zoom-btn"
            onClick={() => setArtPreviewOpen(true)}
          >
            {t("zoom")}
          </button>
        </div>

        <div className="yanmar-chassis-showcase-meta">
          <div className="yanmar-chassis-showcase-title-row">
            <h4 className="yanmar-chassis-showcase-name">{selected.label}</h4>
          </div>
          <p className="yanmar-chassis-trait">{t("defaultTrait")}</p>
          {allocEnabled ? (
            <div className="yanmar-chassis-bonus-block">
              <span
                className={`yanmar-chassis-bonus-points${
                  remaining > 0 ? " has-remain" : ""
                }`}
                title={t("bonusPointsTitle")}
              >
                {t("bonus", { points: remaining })}
              </span>
              <div className="yanmar-chassis-bonus-actions">
                <button
                  type="button"
                  className="yanmar-chassis-bonus-btn is-save"
                  disabled={busy || !dirty}
                  onClick={() => void onAbilityAllocSave?.(draft)}
                >
                  {t("save")}
                  {dirty && remaining > 0 ? (
                    <em className="yanmar-bonus-point-badge is-on-btn" aria-hidden />
                  ) : null}
                </button>
                <button
                  type="button"
                  className="yanmar-chassis-bonus-btn"
                  disabled={busy || totalPoints <= 0}
                  onClick={() =>
                    setDraft(
                      recommendAbilityAlloc(playerLevel, selected.chassisClass),
                    )
                  }
                >
                  {t("recommendedAllocation")}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <ul
          className={`yanmar-chassis-stat-grid yanmar-chassis-stat-grid--2x3${
            allocEnabled ? " yanmar-chassis-stat-grid--editable" : ""
          }`}
          aria-label={t("statsAriaLabel")}
        >
          {MAIN_OPTION_KEYS.map((key) => {
            const base = selected.stats[key];
            const alloc = draft[key] ?? 0;
            const preview = base + alloc;
            return (
              <li key={key}>
                <span>{statLabel(key)}</span>
                <div className="yanmar-chassis-stat-right">
                  <strong>
                    {preview}
                    {alloc > 0 ? (
                      <em className="yanmar-chassis-stat-bonus">+{alloc}</em>
                    ) : null}
                  </strong>
                  {allocEnabled ? (
                    <div className="yanmar-chassis-stat-stepper">
                      <button
                        type="button"
                        disabled={busy || alloc <= 0}
                        onClick={() => bump(key, -1)}
                        aria-label={t("decreaseStat", { stat: statLabel(key) })}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        disabled={busy || remaining <= 0}
                        onClick={() => bump(key, 1)}
                        aria-label={t("increaseStat", { stat: statLabel(key) })}
                      >
                        +
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {artPreviewOpen ? (
        <div
          className="yanmar-chassis-art-preview-layer"
          role="dialog"
          aria-modal="true"
          aria-label={t("zoomAriaLabel")}
        >
          <button
            type="button"
            className="yanmar-chassis-art-preview-backdrop"
            aria-label={t("closeZoom")}
            onClick={() => setArtPreviewOpen(false)}
          />
          <div className="yanmar-chassis-art-preview-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={thumbSrc}
              src={thumbSrc}
              alt=""
              className="yanmar-chassis-art-preview-img"
              draggable={false}
            />
            <p className="yanmar-chassis-art-preview-name">{selected.label}</p>
            <p className="yanmar-chassis-art-preview-meta">{weightLabel}</p>
            <button
              type="button"
              className="yanmar-chassis-art-preview-close"
              onClick={() => setArtPreviewOpen(false)}
            >
              {t("close")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ChassisPanel({
  open = false,
  onClose,
  playerLevel,
  currency,
  activeId,
  ownedIds,
  busy,
  abilityAlloc,
  embedded,
  onPurchase,
  onEquip,
  onAbilityAllocSave,
}: ChassisPanelProps) {
  const t = useTranslations("yanmar.chassis");
  const gallery = (
    <ChassisGallery
      playerLevel={playerLevel}
      currency={currency}
      activeId={activeId}
      ownedIds={ownedIds}
      busy={busy}
      abilityAlloc={abilityAlloc}
      onPurchase={onPurchase}
      onEquip={onEquip}
      onAbilityAllocSave={onAbilityAllocSave}
    />
  );

  if (embedded) {
    return <div className="yanmar-chassis-panel-embedded">{gallery}</div>;
  }

  if (!open) return null;

  return (
    <AppModalOverlay open={open} onClose={onClose ?? (() => undefined)}>
      <div className="yanmar-shop-panel" style={{ maxWidth: 860 }}>
        <div className="yanmar-shop-panel-header">
          <h2>{t("title")}</h2>
          <button type="button" onClick={onClose} aria-label={t("close")}>
            ×
          </button>
        </div>
        {gallery}
      </div>
    </AppModalOverlay>
  );
}
