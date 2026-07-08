"use client";

import { useCallback, useEffect, useState } from "react";
import {
  exitFullscreen,
  isFullscreenSupported,
  isStandalonePwa,
  lockLandscape,
  requestFullscreen,
  shouldUseBrowserFullscreen,
  unlockOrientation,
} from "@/lib/fullscreen";

interface UseGameFullscreenOptions {
  /** true일 때 전체화면 진입 시도 */
  active: boolean;
  containerRef?: React.RefObject<HTMLElement | null>;
}

export function useGameFullscreen({ active, containerRef }: UseGameFullscreenOptions) {
  const [immersive, setImmersive] = useState(false);
  const [apiFullscreen, setApiFullscreen] = useState(false);

  const enter = useCallback(async () => {
    setImmersive(true);

    if (shouldUseBrowserFullscreen()) {
      const ok = await requestFullscreen(containerRef?.current ?? null);
      setApiFullscreen(ok);
      if (!ok) {
        // Fullscreen 거부/미지원이어도 가로 회전 시도 (Android Chrome 등)
        lockLandscape();
      }
    } else {
      // standalone PWA: 전체화면 API 없이 가로만 요청
      lockLandscape();
      setApiFullscreen(false);
    }
  }, [containerRef]);

  const leave = useCallback(async () => {
    setImmersive(false);
    setApiFullscreen(false);
    unlockOrientation();
    await exitFullscreen();
  }, []);

  useEffect(() => {
    if (!active) {
      leave();
      return;
    }
  }, [active, leave]);

  useEffect(() => {
    if (!shouldUseBrowserFullscreen()) return;

    const onChange = () => {
      setApiFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement && !active) {
        setImmersive(false);
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [active]);

  return {
    immersive,
    apiFullscreen,
    isStandalone: isStandalonePwa(),
    canFullscreen: isFullscreenSupported() && shouldUseBrowserFullscreen(),
    enter,
    leave,
  };
}
