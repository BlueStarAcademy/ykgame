"use client";

import { useId, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import {
  YANMAR_GUIDE_TABS,
  type YanmarGuideTabId,
  type YanmarGuideVisualCard,
} from "./yanmarLobbyInfo";

function InfoModalShell({
  open,
  onClose,
  title,
  eyebrow,
  subtitle,
  closeAriaLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow: string;
  subtitle: string;
  closeAriaLabel: string;
  children: ReactNode;
}) {
  return (
    <AppModalOverlay
      open={open}
      onClose={onClose}
      panelClassName="yanmar-info-modal-panel"
    >
      <div className="yanmar-info-modal">
        <header className="yanmar-info-modal-header">
          <div className="yanmar-info-modal-header-glow" aria-hidden />
          <div className="yanmar-info-modal-header-grid" aria-hidden />
          <div className="yanmar-info-modal-header-top">
            <p className="yanmar-info-modal-eyebrow">{eyebrow}</p>
            <button
              type="button"
              onClick={onClose}
              className="yanmar-info-modal-close"
              aria-label={closeAriaLabel}
            >
              ✕
            </button>
          </div>
          <h2 className="yanmar-info-modal-title">{title}</h2>
          <p className="yanmar-info-modal-subtitle">{subtitle}</p>
        </header>
        <div className="yanmar-info-modal-body">{children}</div>
      </div>
    </AppModalOverlay>
  );
}

function GuideCardImage({
  src,
  badgeSrc,
  alt,
}: {
  src: string;
  badgeSrc?: string;
  alt: string;
}) {
  return (
    <div className="yanmar-help-card-media" aria-hidden={!alt}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="yanmar-help-card-img"
        draggable={false}
      />
      {badgeSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={badgeSrc}
          alt=""
          className="yanmar-help-card-badge"
          draggable={false}
        />
      ) : null}
    </div>
  );
}

function GuideSteps({
  cardId,
  tabId,
}: {
  cardId: string;
  tabId: YanmarGuideTabId;
}) {
  const t = useTranslations("yanmar.guide");
  const steps = ["1", "2", "3"] as const;

  return (
    <ol className="yanmar-help-steps">
      {steps.map((step, index) => (
        <li key={step} className="yanmar-help-step">
          <span className="yanmar-help-step-num" aria-hidden>
            {step}
          </span>
          <span className="yanmar-help-step-text">
            {t(`panels.${tabId}.cards.${cardId}.steps.${step}`)}
          </span>
          {index < steps.length - 1 ? (
            <span className="yanmar-help-step-arrow" aria-hidden>
              →
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function GuideCard({
  card,
  tabId,
}: {
  card: YanmarGuideVisualCard;
  tabId: YanmarGuideTabId;
}) {
  const t = useTranslations("yanmar.guide");
  const title = t(`panels.${tabId}.cards.${card.id}.title`);
  const desc = t(`panels.${tabId}.cards.${card.id}.desc`);

  return (
    <article className="yanmar-help-card">
      <GuideCardImage
        src={card.image}
        badgeSrc={card.badgeImage}
        alt=""
      />
      <div className="yanmar-help-card-body">
        <h4 className="yanmar-help-card-title">{title}</h4>
        <p className="yanmar-help-card-desc">{desc}</p>
        {card.steps ? <GuideSteps cardId={card.id} tabId={tabId} /> : null}
      </div>
    </article>
  );
}

function YanmarGuideBody() {
  const t = useTranslations("yanmar.guide");
  const baseId = useId();
  const [activeTab, setActiveTab] = useState<YanmarGuideTabId>("start");

  const activeDef =
    YANMAR_GUIDE_TABS.find((tab) => tab.id === activeTab) ??
    YANMAR_GUIDE_TABS[0];

  return (
    <div className="yanmar-help">
      <div
        className="yanmar-help-tabs"
        role="tablist"
        aria-label={t("title")}
      >
        {YANMAR_GUIDE_TABS.map((tab) => {
          const selected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              className={`yanmar-help-tab${selected ? " is-active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {t(`tabs.${tab.id}`)}
            </button>
          );
        })}
      </div>

      <div
        key={activeDef.id}
        role="tabpanel"
        id={`${baseId}-panel-${activeDef.id}`}
        aria-labelledby={`${baseId}-tab-${activeDef.id}`}
        className="yanmar-help-panel"
      >
        {activeDef.heroImage ? (
          <div className="yanmar-help-hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeDef.heroImage}
              alt={t(`panels.${activeDef.id}.heroAlt`)}
              className="yanmar-help-hero-img"
              draggable={false}
            />
            <div className="yanmar-help-hero-shade" aria-hidden />
          </div>
        ) : null}

        {activeDef.hasLead ? (
          <p className="yanmar-help-lead">
            {t(`panels.${activeDef.id}.lead`)}
          </p>
        ) : null}

        <div className="yanmar-help-cards">
          {activeDef.cards.map((card) => (
            <GuideCard key={card.id} card={card} tabId={activeDef.id} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function YanmarGuideModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("yanmar.guide");
  const tc = useTranslations("common");

  return (
    <InfoModalShell
      open={open}
      onClose={onClose}
      title={t("title")}
      eyebrow={t("eyebrow")}
      subtitle={t("subtitle")}
      closeAriaLabel={tc("close")}
    >
      {/* Remount on open so the first tab is always shown. */}
      <YanmarGuideBody key={open ? "open" : "closed"} />
    </InfoModalShell>
  );
}
