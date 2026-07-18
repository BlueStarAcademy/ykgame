"use client";

import { useEffect, useState } from "react";
import { clientLogout } from "@/lib/client-logout";
import { SiteLegendLegalFooter } from "@/components/auth/SiteLegendLegalFooter";
import { LoginForm } from "@/components/auth/LoginForm";
import { useSiteLegendLoginBgm } from "@/components/auth/useSiteLegendLoginBgm";
import { SiteLegendActionButtons } from "@/components/home/SiteLegendActionButtons";

interface SiteLegendHomeScreenProps {
  nickname?: string;
  role?: "USER" | "ADMIN";
  onStartGame: () => void;
  /** 게임 시작 후 인게임 준비 중 — 버튼 숨기고 로딩 표시 */
  isEnteringGame?: boolean;
}

type HomePanel = "home" | "login";

export function SiteLegendHomeScreen({
  onStartGame,
  isEnteringGame = false,
}: SiteLegendHomeScreenProps) {
  const [panel, setPanel] = useState<HomePanel>("home");

  useSiteLegendLoginBgm(!isEnteringGame);

  useEffect(() => {
    if (!isEnteringGame) return;
    setPanel("home");
  }, [isEnteringGame]);

  return (
    <div
      className={`site-legend-auth site-legend-home ${panel === "login" ? "is-login-panel" : ""}`}
    >
      <div
        className="site-legend-auth-bg"
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          overflow: "hidden",
          backgroundColor: "#0b1220",
          backgroundImage: 'url("/images/site-legend/splash-bg.png?v=13")',
          backgroundSize: "cover",
          backgroundPosition: "center center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <img
          src="/images/site-legend/splash-bg.png?v=13"
          alt=""
          className="site-legend-auth-bg-img"
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            display: "block",
            width: "100%",
            height: "100%",
            maxWidth: "none",
            maxHeight: "none",
            objectFit: "cover",
            objectPosition: "center center",
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
        <div
          className="site-legend-auth-bg-shade"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "linear-gradient(180deg, rgba(8, 14, 28, 0.18) 0%, rgba(8, 14, 28, 0.04) 30%, rgba(8, 14, 28, 0.08) 60%, rgba(8, 14, 28, 0.42) 100%), radial-gradient(120% 50% at 50% 100%, rgba(0, 0, 0, 0.35), transparent 72%)",
          }}
        />
      </div>

      <div className="site-legend-auth-frame">
        <div className="site-legend-auth-title-wrap">
          <img
            src="/images/site-legend/title.png"
            alt="현장전설 SITE LEGEND"
            className="site-legend-auth-title"
            draggable={false}
          />
        </div>

        <div
          className={`site-legend-auth-track ${panel === "login" ? "is-login" : ""}`}
        >
          <section
            className="site-legend-auth-panel site-legend-auth-panel-splash site-legend-home-main"
            aria-hidden={panel !== "home"}
          >
            {isEnteringGame ? (
              <div className="site-legend-entry-loading" role="status" aria-live="polite">
                <div className="site-legend-entry-loading-spinner" aria-hidden />
                <p className="site-legend-entry-loading-text">정보 불러오는 중</p>
              </div>
            ) : (
              <SiteLegendActionButtons
                primaryLabel="게임 시작"
                onPrimary={onStartGame}
                secondary={{
                  type: "logout",
                  onClick: () => {
                    void clientLogout();
                  },
                }}
                switchAccountLabel="다른 아이디로 로그인"
                onSwitchAccount={() => setPanel("login")}
              />
            )}
          </section>

          <section
            className="site-legend-auth-panel site-legend-auth-panel-login"
            aria-hidden={panel !== "login"}
          >
            <div className="site-legend-login-card">
              <LoginForm
                variant="siteLegend"
                onSuccess={() => setPanel("home")}
              />
            </div>
          </section>
        </div>

        {panel === "home" && !isEnteringGame ? <SiteLegendLegalFooter /> : null}
      </div>
    </div>
  );
}
