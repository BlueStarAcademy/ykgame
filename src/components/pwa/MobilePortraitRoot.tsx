"use client";

import { useEffect } from "react";
import {
  enablePersistentPortraitLock,
  isMobileDevice,
  lockPortrait,
} from "@/lib/fullscreen";
import { PortraitOrientationGuard } from "./PortraitOrientationGuard";

/** 모바일 전역 세로 고정 + 가로 모드 차단 */
export function MobilePortraitRoot({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!isMobileDevice()) return;

    document.documentElement.classList.add("portrait-only");
    lockPortrait();
    const release = enablePersistentPortraitLock();

    // Android: 회전 직후 lock이 실패하는 경우 재시도
    const retry = window.setInterval(() => lockPortrait(), 2000);

    return () => {
      window.clearInterval(retry);
      release();
      document.documentElement.classList.remove("portrait-only");
    };
  }, []);

  return (
    <>
      {isMobileDevice() && <PortraitOrientationGuard />}
      {children}
    </>
  );
}
