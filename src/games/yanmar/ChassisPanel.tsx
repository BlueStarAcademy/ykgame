"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import {
  abilityLabel,
  emptyAbilityAlloc,
  recommendAbilityAlloc,
  spentAbilityPoints,
  type AbilityAlloc,
} from "./abilityAlloc";
import {
  CHASSIS_CATALOG,
  CHASSIS_CLASS_LABEL,
  formatChassisWeightKg,
  type ChassisClass,
  type ChassisDef,
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

type ChassisFilter = "ALL" | ChassisClass;

const FILTER_TABS: { id: ChassisFilter; label: string }[] = [
  { id: "ALL", label: "전체" },
  { id: "LIGHT", label: "경량급" },
  { id: "MEDIUM", label: "중형" },
  { id: "HEAVY", label: "대형" },
];

function getActiveFallback(activeId: ChassisModelId | string): ChassisDef {
  return (
    CHASSIS_CATALOG.find((c) => c.id === activeId) ??
    CHASSIS_CATALOG.find((c) => c.granted) ??
    CHASSIS_CATALOG[0]!
  );
}

function chassisStatus(
  c: ChassisDef,
  owned: Set<string>,
  playerLevel: number,
  activeId: string,
) {
  const isOwned = owned.has(c.id) || c.granted;
  const levelLocked = !c.granted && playerLevel < c.unlockLevel;
  const isActive = activeId === c.id;
  return { isOwned, levelLocked, isActive };
}

function allocEqual(a: AbilityAlloc, b: AbilityAlloc): boolean {
  return MAIN_OPTION_KEYS.every((key) => a[key] === b[key]);
}

export function ChassisGallery({
  playerLevel,
  currency,
  activeId,
  ownedIds,
  busy,
  abilityAlloc,
  onPurchase,
  onEquip,
  onAbilityAllocSave,
}: Omit<ChassisPanelProps, "open" | "onClose" | "embedded">) {
  const owned = useMemo(() => new Set(ownedIds), [ownedIds]);
  const [filter, setFilter] = useState<ChassisFilter>("ALL");
  const [index, setIndex] = useState(0);
  const [artPreviewOpen, setArtPreviewOpen] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const allocEnabled = Boolean(abilityAlloc && onAbilityAllocSave);
  const [draft, setDraft] = useState<AbilityAlloc>(
    () => abilityAlloc ?? emptyAbilityAlloc(),
  );

  const filtered = useMemo(() => {
    if (filter === "ALL") return [...CHASSIS_CATALOG];
    return CHASSIS_CATALOG.filter((c) => c.chassisClass === filter);
  }, [filter]);

  useEffect(() => {
    const list =
      filter === "ALL"
        ? CHASSIS_CATALOG
        : CHASSIS_CATALOG.filter((c) => c.chassisClass === filter);
    const preferred = list.findIndex((c) => c.id === activeId);
    setIndex(preferred >= 0 ? preferred : 0);
  }, [filter, activeId]);

  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>(
      `[data-chassis-idx="${index}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [index]);

  useEffect(() => {
    if (abilityAlloc) setDraft(abilityAlloc);
  }, [abilityAlloc]);

  const selected = filtered[index] ?? getActiveFallback(activeId);
  const status = chassisStatus(selected, owned, playerLevel, String(activeId));
  const pageLabel = `${Math.min(index + 1, filtered.length)} / ${filtered.length}`;
  const totalPoints = Math.max(0, Math.floor(playerLevel));
  const spent = spentAbilityPoints(draft);
  const remaining = Math.max(0, totalPoints - spent);
  const dirty = useMemo(
    () => (abilityAlloc ? !allocEqual(draft, abilityAlloc) : false),
    [draft, abilityAlloc],
  );

  const go = (delta: number) => {
    if (filtered.length === 0) return;
    setIndex((prev) => (prev + delta + filtered.length) % filtered.length);
  };

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
      <div className="yanmar-chassis-filter-tabs" role="tablist" aria-label="차체 등급">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={filter === tab.id}
            className={`yanmar-chassis-filter-tab${
              filter === tab.id ? " is-active" : ""
            }`}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="yanmar-chassis-showcase">
        <div
          className={`yanmar-chassis-showcase-visual${
            !status.isOwned ? " is-locked" : ""
          }${status.isActive ? " is-active" : ""}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={thumbSrc}
            src={thumbSrc}
            alt=""
            className="yanmar-chassis-showcase-img"
            draggable={false}
          />
          {!status.isOwned ? (
            <div className="yanmar-chassis-lock" aria-hidden>
              <svg
                className="yanmar-chassis-lock-icon"
                viewBox="0 0 24 24"
                width="28"
                height="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            </div>
          ) : null}
          {status.isActive ? (
            <span className="yanmar-chassis-active-pill">탑승 중</span>
          ) : null}
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
                  {remaining > 0 ? (
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

      <div className="yanmar-chassis-strip-section">
        <span className="yanmar-chassis-page" aria-live="polite">
          {pageLabel}
        </span>
        <div className="yanmar-chassis-strip-wrap">
          <button
            type="button"
            className="yanmar-chassis-nav"
            aria-label="이전 차체"
            onClick={() => go(-1)}
            disabled={filtered.length <= 1}
          >
            ‹
          </button>
          <div className="yanmar-chassis-strip" ref={stripRef}>
            {filtered.map((c, i) => {
              const s = chassisStatus(c, owned, playerLevel, String(activeId));
              return (
                <button
                  key={c.id}
                  type="button"
                  data-chassis-idx={i}
                  className={`yanmar-chassis-strip-card${
                    i === index ? " is-selected" : ""
                  }${s.isActive ? " is-active" : ""}${
                    !s.isOwned ? " is-locked" : ""
                  }`}
                  onClick={() => setIndex(i)}
                  title={c.label}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={chassisModelThumbSrc(c.id)}
                    alt=""
                    draggable={false}
                  />
                  {!s.isOwned ? (
                    <span className="yanmar-chassis-strip-lock" aria-hidden>
                      <svg
                        viewBox="0 0 24 24"
                        width="12"
                        height="12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="5" y="11" width="14" height="10" rx="2" />
                        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                      </svg>
                    </span>
                  ) : null}
                  <span className="yanmar-chassis-strip-name">{c.label}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="yanmar-chassis-nav"
            aria-label="다음 차체"
            onClick={() => go(1)}
            disabled={filtered.length <= 1}
          >
            ›
          </button>
        </div>
      </div>

      <div className="yanmar-chassis-footer">
        {!status.isOwned ? (
          <p className="yanmar-chassis-unlock-hint">
            {status.levelLocked
              ? `해금 조건 · 플레이어 Lv.${selected.unlockLevel} 이상 · ${selected.priceStars.toLocaleString()}★`
              : `구매 가능 · ${selected.priceStars.toLocaleString()}★`}
          </p>
        ) : status.isActive ? (
          <p className="yanmar-chassis-unlock-hint is-ok">현재 탑승 중인 차체입니다</p>
        ) : (
          <p className="yanmar-chassis-unlock-hint is-ok">보유 중 · 탑승 가능</p>
        )}

        {!status.isOwned ? (
          <button
            type="button"
            className="yanmar-chassis-cta"
            disabled={busy || status.levelLocked || currency < selected.priceStars}
            onClick={() => onPurchase(selected.id)}
          >
            {status.levelLocked
              ? `Lv.${selected.unlockLevel} 해금 · ${selected.priceStars.toLocaleString()}★`
              : `구매하기 ${selected.priceStars.toLocaleString()}★`}
          </button>
        ) : status.isActive ? (
          <button type="button" className="yanmar-chassis-cta is-current" disabled>
            탑승 중
          </button>
        ) : (
          <button
            type="button"
            className="yanmar-chassis-cta is-ride"
            disabled={busy}
            onClick={() => onEquip(selected.id)}
          >
            탑승
          </button>
        )}
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
          <h2>차체변경</h2>
          <button type="button" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        {gallery}
      </div>
    </AppModalOverlay>
  );
}
