"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { activatePwaFromSearchParams, isPwaMode } from "@/lib/pwa-mode";
import {
  enablePersistentPortraitLock,
  isStandalonePwa,
  lockPortrait,
} from "@/lib/fullscreen";

function PwaModeRootInner({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  useEffect(() => {
    const fromUrl = activatePwaFromSearchParams(searchParams);
    const on = fromUrl || isPwaMode() || isStandalonePwa();
    setActive(on);

    if (!on) {
      document.documentElement.classList.remove("pwa-mode");
      return;
    }

    document.documentElement.classList.add("pwa-mode");
    lockPortrait();
    const releasePortraitLock = enablePersistentPortraitLock();

    const prevOverflow = document.body.style.overflow;
    if (pathname !== "/") {
      document.body.style.overflow = "hidden";
    }

    return () => {
      releasePortraitLock();
      document.body.style.overflow = prevOverflow;
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
