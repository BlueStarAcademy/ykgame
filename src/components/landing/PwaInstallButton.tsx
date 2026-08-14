"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { isStandalonePwa } from "@/lib/fullscreen";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallState = "loading" | "ready" | "ios" | "installed" | "unavailable";

function isIosDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/i.test(ua);
  const iPadOs =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOS || iPadOs;
}

export function PwaInstallButton() {
  const t = useTranslations("landing");
  const [state, setState] = useState<InstallState>("loading");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isStandalonePwa()) {
      setState("installed");
      return;
    }

    if (isIosDevice()) {
      setState("ios");
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setState("ready");
    };

    const onInstalled = () => {
      setDeferred(null);
      setState("installed");
      setShowIosGuide(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    // Chromium may fire beforeinstallprompt after a short delay; if never,
    // still show a helpful fallback so users know how to add the shortcut.
    const timer = window.setTimeout(() => {
      setState((prev) => (prev === "loading" ? "unavailable" : prev));
    }, 1500);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleInstall() {
    if (state === "ios") {
      setShowIosGuide((v) => !v);
      return;
    }

    if (state === "unavailable") {
      setShowIosGuide((v) => !v);
      return;
    }

    if (!deferred) return;

    setInstalling(true);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setState("installed");
      }
      setDeferred(null);
    } finally {
      setInstalling(false);
    }
  }

  if (state === "loading" || state === "installed") {
    return null;
  }

  const label = installing ? t("installing") : t("addToHome");

  return (
    <div className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={handleInstall}
        disabled={installing}
        className="landing-cta landing-cta-install flex w-full items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-bold text-white shadow-md disabled:opacity-70"
      >
        <span className="landing-install-icon" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png?v=3"
            alt=""
            width={18}
            height={18}
            className="h-[18px] w-[18px] rounded-[4px]"
          />
        </span>
        {label}
      </button>

      {showIosGuide && state === "ios" && (
        <div className="landing-install-guide absolute left-0 right-0 z-20 mt-2 w-[calc(200%+0.5rem)] rounded-xl border border-gray-200 bg-white/95 px-3 py-2.5 text-left shadow-sm">
          <p className="text-[11px] font-semibold text-gray-800">
            {t("iosInstallTitle")}
          </p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[10px] leading-relaxed text-gray-500">
            <li>
              {t("iosInstallStep1")}
            </li>
            <li>
              {t("iosInstallStep2")}
            </li>
            <li>
              {t("iosInstallStep3")}
            </li>
          </ol>
        </div>
      )}

      {showIosGuide && state === "unavailable" && (
        <div className="landing-install-guide absolute left-0 right-0 z-20 mt-2 w-[calc(200%+0.5rem)] rounded-xl border border-gray-200 bg-white/95 px-3 py-2.5 text-left shadow-sm">
          <p className="text-[11px] font-semibold text-gray-800">
            {t("addToHomeTitle")}
          </p>
          <p className="mt-1.5 text-[10px] leading-relaxed text-gray-500">
            {t("addToHomeDescription")}
          </p>
        </div>
      )}
    </div>
  );
}
