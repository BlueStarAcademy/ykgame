"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { activatePwaFromSearchParams, isPwaMode } from "@/lib/pwa-mode";
import { isStandalonePwa, unlockOrientation } from "@/lib/fullscreen";

/**
 * iOS Safari(탭 브라우저)는 fixed inset-0 / 100vh가 주소창·하단 툴바를
 * 포함한 "큰 뷰포트"로 잡혀 상·하단 UI가 잘린다.
 * Visual Viewport 높이로 셸을 맞춘다. standalone PWA는 크롬이 없어 dvh면 충분.
 */
function syncPwaShellViewport() {
  const root = document.documentElement;
  const vv = window.visualViewport;
  const height = vv?.height ?? window.innerHeight;
  const offsetTop = vv?.offsetTop ?? 0;
  root.style.setProperty("--pwa-shell-height", `${Math.round(height)}px`);
  root.style.setProperty("--pwa-shell-top", `${Math.round(offsetTop)}px`);
}

function clearPwaShellViewport() {
  const root = document.documentElement;
  root.style.removeProperty("--pwa-shell-height");
  root.style.removeProperty("--pwa-shell-top");
}

function PwaModeRootInner({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  useEffect(() => {
    // Older builds locked landscape on game enter. Clear once per tab session.
    const key = "ykgame_orientation_unlocked_v1";
    try {
      if (sessionStorage.getItem(key) === "1") return;
      unlockOrientation();
      sessionStorage.setItem(key, "1");
    } catch {
      unlockOrientation();
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Install prompt may be unavailable without SW; ignore registration errors.
    });
  }, []);

  useEffect(() => {
    const fromUrl = activatePwaFromSearchParams(searchParams);
    const on = fromUrl || isPwaMode() || isStandalonePwa();
    setActive(on);

    if (!on) {
      document.documentElement.classList.remove("pwa-mode");
      clearPwaShellViewport();
      return;
    }

    document.documentElement.classList.add("pwa-mode");
    syncPwaShellViewport();

    const prevOverflow = document.body.style.overflow;
    if (pathname !== "/") {
      document.body.style.overflow = "hidden";
    }

    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      return target.isContentEditable;
    };

    const blockSelect = (event: Event) => {
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
    };

    const onViewportChange = () => {
      syncPwaShellViewport();
    };

    const vv = window.visualViewport;
    vv?.addEventListener("resize", onViewportChange);
    vv?.addEventListener("scroll", onViewportChange);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("orientationchange", onViewportChange);

    document.addEventListener("selectstart", blockSelect, { capture: true });
    document.addEventListener("contextmenu", blockSelect, { capture: true });

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("selectstart", blockSelect, true);
      document.removeEventListener("contextmenu", blockSelect, true);
      vv?.removeEventListener("resize", onViewportChange);
      vv?.removeEventListener("scroll", onViewportChange);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("orientationchange", onViewportChange);
      clearPwaShellViewport();
    };
  }, [searchParams, pathname]);

  if (!active || pathname === "/") {
    return <>{children}</>;
  }

  return (
    <div
      className="pwa-shell fixed left-0 right-0 z-[100] flex flex-col overflow-hidden bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900"
      style={{
        top: "var(--pwa-shell-top, 0px)",
        height: "var(--pwa-shell-height, 100dvh)",
        maxHeight: "var(--pwa-shell-height, 100dvh)",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}

export function PwaModeRoot({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <PwaModeRootInner>{children}</PwaModeRootInner>
    </Suspense>
  );
}
