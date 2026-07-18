"use client";

import { forwardRef, type RefObject } from "react";

interface SiteLegendActionButtonsProps {
  primaryLabel: "로그인" | "게임 시작";
  onPrimary: () => void;
  /** Secondary action under the primary CTA. Login splash uses logout; home uses settings. */
  secondary:
    | {
        type: "settings";
        onClick: () => void;
        open?: boolean;
        badge?: number;
        buttonRef?: RefObject<HTMLButtonElement | null>;
      }
    | {
        type: "logout";
        onClick: () => void;
      };
  switchAccountLabel?: string;
  onSwitchAccount?: () => void;
}

export const SiteLegendSettingsButton = forwardRef<
  HTMLButtonElement,
  {
    onClick: () => void;
    open?: boolean;
    badge?: number;
  }
>(function SiteLegendSettingsButton({ onClick, open, badge }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className="site-legend-btn site-legend-btn-settings"
      onClick={onClick}
      aria-expanded={open}
      aria-label="설정"
    >
      <span className="site-legend-btn-settings-inner">
        <span className="site-legend-btn-gear" aria-hidden>
          ⚙
        </span>
        <span>설정</span>
      </span>
      {badge && badge > 0 ? (
        <span className="site-legend-settings-badge">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </button>
  );
});

export function SiteLegendLogoutButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="site-legend-btn site-legend-btn-settings site-legend-btn-logout"
      onClick={onClick}
      aria-label="로그아웃"
    >
      <span className="site-legend-btn-settings-inner">
        <svg
          className="site-legend-btn-logout-icon"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
        >
          <path
            d="M6.5 3H4.2C3.54 3 3 3.54 3 4.2v7.6C3 12.46 3.54 13 4.2 13h2.3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M7 8h6m0 0-2.2-2.2M13 8l-2.2 2.2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>로그아웃</span>
      </span>
    </button>
  );
}

export function SiteLegendActionButtons({
  primaryLabel,
  onPrimary,
  secondary,
  switchAccountLabel,
  onSwitchAccount,
}: SiteLegendActionButtonsProps) {
  return (
    <div className="site-legend-auth-actions">
      {switchAccountLabel && onSwitchAccount ? (
        <button
          type="button"
          className="site-legend-switch-account"
          onClick={onSwitchAccount}
        >
          {switchAccountLabel}
        </button>
      ) : null}

      <button
        type="button"
        className={`site-legend-btn site-legend-btn-primary ${
          primaryLabel === "로그인" ? "is-login" : "is-start"
        }`}
        onClick={onPrimary}
      >
        <span className="site-legend-btn-primary-shine" aria-hidden />
        <span className="site-legend-btn-primary-label">{primaryLabel}</span>
      </button>

      {secondary.type === "settings" ? (
        <SiteLegendSettingsButton
          ref={secondary.buttonRef}
          onClick={secondary.onClick}
          open={secondary.open}
          badge={secondary.badge}
        />
      ) : (
        <SiteLegendLogoutButton onClick={secondary.onClick} />
      )}
    </div>
  );
}
