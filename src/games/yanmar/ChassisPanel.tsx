"use client";

import { useEffect, useMemo, useState } from "react";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import {
  abilityLabel,
  emptyAbilityAlloc,
  recommendAbilityAlloc,
  spentAbilityPoints,
  type AbilityAlloc,
} from "./abilityAlloc";
import {
  CHASSIS_CLASS_LABEL,
  DEFAULT_CHASSIS_ID,
  formatChassisWeightKg,
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

  return (
    <div className="yanmar-chassis-gallery">
      <div className="yanmar-chassis-showcase">
        <div className="yanmar-chassis-showcase-visual is-active">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={thumbSrc}
            src={thumbSrc}
            alt=""
            className="yanmar-chassis-showcase-img"
            draggable={false}
          />
          <button
            type="button"
            className="yanmar-chassis-zoom-btn"
            onClick={() => setArtPreviewOpen(true)}
          >
            크게보기
          </button>
        </div>

        <div className="yanmar-chassis-showcase-meta">
          <h4 className="yanmar-chassis-showcase-name">{selected.label}</h4>
          <div className="yanmar-chassis-showcase-info">
            <span className="yanmar-chassis-class-pill">
              {CHASSIS_CLASS_LABEL[selected.chassisClass]}
            </span>
            <span className="yanmar-chassis-weight-pill">
              {formatChassisWeightKg(selected.weightKg)}
            </span>
          </div>
          <p className="yanmar-chassis-trait">{selected.trait}</p>
          {allocEnabled ? (
            <div className="yanmar-chassis-bonus-block">
              <span
                className={`yanmar-chassis-bonus-points${
                  remaining > 0 ? " has-remain" : ""
                }`}
                title="분배 가능 보너스 포인트"
              >
                보너스 {remaining}
              </span>
              <div className="yanmar-chassis-bonus-actions">
                <button
                  type="button"
                  className="yanmar-chassis-bonus-btn is-save"
                  disabled={busy || !dirty}
                  onClick={() => void onAbilityAllocSave?.(draft)}
                >
                  저장
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
                  추천분배
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <ul
          className={`yanmar-chassis-stat-grid yanmar-chassis-stat-grid--2x3${
            allocEnabled ? " yanmar-chassis-stat-grid--editable" : ""
          }`}
          aria-label="차체 능력치"
        >
          {MAIN_OPTION_KEYS.map((key) => {
            const base = selected.stats[key];
            const alloc = allocEnabled ? (draft[key] ?? 0) : 0;
            const preview = base + alloc;
            return (
              <li key={key}>
                <span>{abilityLabel(key)}</span>
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
                        aria-label={`${abilityLabel(key)} 감소`}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        disabled={busy || remaining <= 0}
                        onClick={() => bump(key, 1)}
                        aria-label={`${abilityLabel(key)} 증가`}
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
          aria-label="차체 이미지 크게보기"
        >
          <button
            type="button"
            className="yanmar-chassis-art-preview-backdrop"
            aria-label="크게보기 닫기"
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
            <p className="yanmar-chassis-art-preview-meta">
              {CHASSIS_CLASS_LABEL[selected.chassisClass]} ·{" "}
              {formatChassisWeightKg(selected.weightKg)}
            </p>
            <button
              type="button"
              className="yanmar-chassis-art-preview-close"
              onClick={() => setArtPreviewOpen(false)}
            >
              닫기
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
          <h2>차체</h2>
          <button type="button" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        {gallery}
      </div>
    </AppModalOverlay>
  );
}
