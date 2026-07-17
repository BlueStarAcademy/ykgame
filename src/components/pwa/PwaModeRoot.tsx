"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { activatePwaFromSearchParams, isPwaMode } from "@/lib/pwa-mode";
import { isStandalonePwa, unlockOrientation } from "@/lib/fullscreen";

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
      return;
    }

    document.documentElement.classList.add("pwa-mode");

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

    document.addEventListener("selectstart", blockSelect, { capture: true });
    document.addEventListener("contextmenu", blockSelect, { capture: true });

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("selectstart", blockSelect, true);
      document.removeEventListener("contextmenu", blockSelect, true);
    };
  }, [searchParams, pathname]);

  if (!active || pathname === "/") {
    return <>{children}</>;
  }

  return (
    <div
      className="pwa-shell fixed inset-0 z-[100] flex flex-col overflow-hidden bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
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
