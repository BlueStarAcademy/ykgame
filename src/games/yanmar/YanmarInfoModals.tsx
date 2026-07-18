"use client";

import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import { YANMAR_GUIDE_STEPS, YANMAR_REWARD_INFO } from "./yanmarLobbyInfo";

function InfoModalShell({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <AppModalOverlay open={open} onClose={onClose} panelClassName="!max-w-md !bg-[#121826] !p-0 !text-white">
      <div className="yanmar-info-modal">
        <div className="yanmar-info-modal-head">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="닫기">
            닫기
          </button>
        </div>
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
    <InfoModalShell open={open} onClose={onClose} title="게임방법">
      <div className="game-lobby-guide-grid yanmar-info-guide-grid">
        {YANMAR_GUIDE_STEPS.map((step) => (
          <div key={step.title} className="game-lobby-guide-card yanmar-info-guide-card">
            <p className="game-lobby-guide-card-title">
              {step.icon} {step.title}
            </p>
            <p className="game-lobby-guide-card-desc">{step.desc}</p>
          </div>
        ))}
      </div>
    </InfoModalShell>
  );
}

export function YanmarRewardsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <InfoModalShell open={open} onClose={onClose} title="보상정보">
      <div className="game-lobby-reward-grid yanmar-info-reward-grid">
        {YANMAR_REWARD_INFO.map((reward) => (
          <div key={reward.label} className="game-lobby-reward-card yanmar-info-reward-card">
            <span className="game-lobby-reward-label">
              <span aria-hidden>{reward.icon}</span>
              {reward.label}
            </span>
            <span className="game-lobby-reward-desc">{reward.desc}</span>
          </div>
        ))}
      </div>
    </InfoModalShell>
  );
}
