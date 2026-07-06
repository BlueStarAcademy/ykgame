"use client";

import { useCallback, useEffect, useState } from "react";
import {
  exitFullscreen,
  isFullscreenSupported,
  isStandalonePwa,
  lockPortrait,
  requestFullscreen,
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
    lockPortrait();
    const ok = await requestFullscreen(containerRef?.current ?? null);
    setApiFullscreen(ok);
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
    // active 전환 시 자동 진입은 호출측(시작 버튼)에서 enter() 호출
  }, [active, leave]);

  useEffect(() => {
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
    canFullscreen: isFullscreenSupported(),
    enter,
    leave,
  };
}
