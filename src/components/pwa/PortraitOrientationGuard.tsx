"use client";

import { useEffect, useState } from "react";
import { isMobileDevice, isPhoneLandscape } from "@/lib/fullscreen";

interface PortraitOrientationGuardProps {
  active?: boolean;
}

/** 모바일 가로 모드일 때 세로 회전 안내 */
export function PortraitOrientationGuard({ active = true }: PortraitOrientationGuardProps) {
  const [landscape, setLandscape] = useState(false);

  useEffect(() => {
    if (!active || !isMobileDevice()) {
      setLandscape(false);
      return;
    }

    const update = () => setLandscape(isPhoneLandscape());
    update();

    const mq = window.matchMedia("(orientation: landscape)");
    mq.addEventListener("change", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      mq.removeEventListener("change", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [active]);

  useEffect(() => {
    if (!landscape) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [landscape]);

  if (!active || !landscape) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-center gap-4 bg-slate-950/95 px-8 text-center text-white"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      onTouchMove={(e) => e.preventDefault()}
    >
      <div className="text-5xl" aria-hidden>
        📱
      </div>
      <p className="text-lg font-bold">세로 화면으로 돌려주세요</p>
      <p className="text-sm text-white/70">
        YK건기 체험 게임은 세로 모드에 최적화되어 있습니다
      </p>
    </div>
  );
}
