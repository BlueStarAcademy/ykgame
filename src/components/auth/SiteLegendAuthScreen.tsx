"use client";

import { useState } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { SiteLegendLegalFooter } from "@/components/auth/SiteLegendLegalFooter";
import { useSiteLegendLoginBgm } from "@/components/auth/useSiteLegendLoginBgm";
import { SiteLegendActionButtons } from "@/components/home/SiteLegendActionButtons";
import { clientLogout } from "@/lib/client-logout";

type AuthPanel = "splash" | "login";

export function SiteLegendAuthScreen() {
  const [panel, setPanel] = useState<AuthPanel>("splash");
  useSiteLegendLoginBgm(true);

  return (
    <div className={`site-legend-auth ${panel === "login" ? "is-login-panel" : ""}`}>
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
            className="site-legend-auth-panel site-legend-auth-panel-splash"
            aria-hidden={panel !== "splash"}
          >
            <SiteLegendActionButtons
              primaryLabel="로그인"
              onPrimary={() => setPanel("login")}
              secondary={{
                type: "logout",
                onClick: () => {
                  void clientLogout();
                },
              }}
            />
          </section>

          <section
            className="site-legend-auth-panel site-legend-auth-panel-login"
            aria-hidden={panel !== "login"}
          >
            <div className="site-legend-login-card">
              <LoginForm variant="siteLegend" />
            </div>
          </section>
        </div>

        {panel === "splash" ? <SiteLegendLegalFooter /> : null}
      </div>
    </div>
  );
}
