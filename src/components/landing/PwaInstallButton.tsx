"use client";

import { useEffect, useState } from "react";
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

  const label =
    state === "ios"
      ? "홈 화면에 추가"
      : state === "unavailable"
        ? "홈 화면 바로가기"
        : installing
          ? "설치 중..."
          : "홈 화면에 추가";

  return (
    <div className="mx-auto w-full max-w-[280px]">
      <button
        type="button"
        onClick={handleInstall}
        disabled={installing}
        className="landing-cta landing-cta-install flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-white shadow-md disabled:opacity-70"
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
        <div className="landing-install-guide mt-2 rounded-xl border border-gray-200 bg-white/90 px-3 py-2.5 text-left shadow-sm">
          <p className="text-[11px] font-semibold text-gray-800">
            iPhone / iPad 설치 방법
          </p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[10px] leading-relaxed text-gray-500">
            <li>
              Safari 하단 <strong className="text-gray-700">공유</strong> 버튼을
              탭합니다
            </li>
            <li>
              <strong className="text-gray-700">홈 화면에 추가</strong>를
              선택합니다
            </li>
            <li>
              이름 확인 후 <strong className="text-gray-700">추가</strong>를
              누르면 YK게임 아이콘이 생성됩니다
            </li>
          </ol>
        </div>
      )}

      {showIosGuide && state === "unavailable" && (
        <div className="landing-install-guide mt-2 rounded-xl border border-gray-200 bg-white/90 px-3 py-2.5 text-left shadow-sm">
          <p className="text-[11px] font-semibold text-gray-800">
            바로가기 추가 방법
          </p>
          <p className="mt-1.5 text-[10px] leading-relaxed text-gray-500">
            브라우저 메뉴에서{" "}
            <strong className="text-gray-700">앱 설치</strong> 또는{" "}
            <strong className="text-gray-700">홈 화면에 추가</strong>를
            선택하면 YK게임 아이콘이 홈 화면에 생성됩니다.
          </p>
        </div>
      )}
    </div>
  );
}
