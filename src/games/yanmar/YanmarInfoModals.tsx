"use client";

import type { ReactNode } from "react";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import { YANMAR_GUIDE_SECTIONS } from "./yanmarLobbyInfo";

function InfoModalShell({
  open,
  onClose,
  title,
  eyebrow,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow: string;
  subtitle: string;
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
              aria-label="닫기"
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
  return (
    <InfoModalShell
      open={open}
      onClose={onClose}
      title="게임방법"
      eyebrow="Operator Guide"
      subtitle="조작 · 작업 · 성장 · 보상을 한눈에"
    >
      <div className="yanmar-help">
        <p className="yanmar-help-lead">
          얀마 굴착기 체험의 조작·작업·성장·보상을 한눈에 정리한 도움말입니다.
        </p>
        {YANMAR_GUIDE_SECTIONS.map((section) => (
          <section key={section.title} className="yanmar-help-section">
            <h3 className="yanmar-help-section-title">{section.title}</h3>
            {section.intro ? (
              <p className="yanmar-help-section-intro">{section.intro}</p>
            ) : null}
            <ul className="yanmar-help-list">
              {section.items.map((item) => (
                <li key={item.label} className="yanmar-help-item">
                  <span className="yanmar-help-item-label">{item.label}</span>
                  <span className="yanmar-help-item-desc">{item.desc}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </InfoModalShell>
  );
}
