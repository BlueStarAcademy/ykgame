"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  disableInGamePortrait,
  enableInGamePortrait,
  exitFullscreen,
  isApiFullscreenActive,
  isFullscreenSupported,
  isStandalonePwa,
  requestFullscreen,
  shouldUseBrowserFullscreen,
} from "@/lib/fullscreen";

interface UseGameFullscreenOptions {
  /** true일 때 인게임 immersion 활성 */
  active: boolean;
  containerRef?: React.RefObject<HTMLElement | null>;
}

export function useGameFullscreen({ active, containerRef }: UseGameFullscreenOptions) {
  const [immersive, setImmersive] = useState(false);
  const [apiFullscreen, setApiFullscreen] = useState(false);
  const mountedRef = useRef(false);

  const enter = useCallback(async () => {
    setImmersive(true);

    if (!shouldUseBrowserFullscreen()) {
      setApiFullscreen(false);
      await enableInGamePortrait();
      return;
    }

    const ok = await requestFullscreen(containerRef?.current ?? null);
    setApiFullscreen(ok);
    await enableInGamePortrait();
  }, [containerRef]);

  const leave = useCallback(async () => {
    setImmersive(false);
    setApiFullscreen(false);
    await exitFullscreen();
  }, []);

  useEffect(() => {
    if (!active) {
      void leave();
      return;
    }

    void enableInGamePortrait();

    const keepPortrait = () => {
      void enableInGamePortrait();
    };

    window.addEventListener("orientationchange", keepPortrait);
    window.addEventListener("resize", keepPortrait);
    screen.orientation?.addEventListener?.("change", keepPortrait);

    return () => {
      window.removeEventListener("orientationchange", keepPortrait);
      window.removeEventListener("resize", keepPortrait);
      screen.orientation?.removeEventListener?.("change", keepPortrait);
    };
  }, [active, leave]);

  // Strict Mode remount에서는 FS를 유지하고, 진짜 unmount에서만 해제한다.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      queueMicrotask(() => {
        if (!mountedRef.current) {
          void exitFullscreen();
          disableInGamePortrait();
        }
      });
    };
  }, []);

  useEffect(() => {
    if (!shouldUseBrowserFullscreen()) return;

    const sync = () => {
      const fs = isApiFullscreenActive();
      setApiFullscreen(fs);
      if (fs || active) {
        void enableInGamePortrait();
      } else {
        setImmersive(false);
        disableInGamePortrait();
      }
    };

    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
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
