"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import { LocalizedImage } from "@/components/i18n/LocalizedImage";
import { YANMAR_ASSETS } from "./controls";
import { YANMAR_GUIDE_SECTIONS } from "./yanmarLobbyInfo";

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
      <div className="yanmar-help">
        <LocalizedImage
          src={YANMAR_ASSETS.controlsGuide}
          alt={t("diagramAlt")}
          className="mx-auto mb-2 w-full max-w-lg rounded-lg"
          draggable={false}
        />
        <p className="yanmar-help-diagram-hint">{t("diagramHint")}</p>
        <p className="yanmar-help-lead">{t("lead")}</p>
        {YANMAR_GUIDE_SECTIONS.map((section) => (
          <section key={section.id} className="yanmar-help-section">
            <h3 className="yanmar-help-section-title">
              {t(`sections.${section.id}.title`)}
            </h3>
            {section.hasIntro ? (
              <p className="yanmar-help-section-intro">
                {t(`sections.${section.id}.intro`)}
              </p>
            ) : null}
            <ul className="yanmar-help-list">
              {section.itemIds.map((itemId) => (
                <li key={itemId} className="yanmar-help-item">
                  <span className="yanmar-help-item-label">
                    {t(`sections.${section.id}.items.${itemId}.label`)}
                  </span>
                  <span className="yanmar-help-item-desc">
                    {t(`sections.${section.id}.items.${itemId}.desc`)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </InfoModalShell>
  );
}
