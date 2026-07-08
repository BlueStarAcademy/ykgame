"use client";

import { useCallback, useEffect, useState } from "react";
import {
  exitFullscreen,
  isFullscreenSupported,
  isStandalonePwa,
  requestFullscreen,
  shouldUseBrowserFullscreen,
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
    } else {
      setApiFullscreen(false);
    }
  }, [containerRef]);

  const leave = useCallback(async () => {
    setImmersive(false);
    setApiFullscreen(false);
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
