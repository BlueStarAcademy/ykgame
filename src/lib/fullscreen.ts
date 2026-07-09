/**
 * 브라우저 전체화면 API + iOS 홈화면 추가(PWA) + 조작석 방향 전환
 */

export function isFullscreenSupported(): boolean {
  if (typeof document === "undefined") return false;
  return !!(
    document.documentElement.requestFullscreen ||
    (document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void })
      .webkitRequestFullscreen
  );
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }
  return navigator.maxTouchPoints > 1 && window.innerWidth < 1024;
}

/** Prefer portrait for cockpit UX; never infer landscape from a flaky first paint. */
export function getDefaultCockpitLayoutMode(): "portrait" | "landscape" {
  return "portrait";
}

/**
 * Never use Fullscreen API on phones/PWAs.
 * Android fullscreen commonly rotates the device to landscape.
 */
export function shouldUseBrowserFullscreen(): boolean {
  if (isStandalonePwa()) return false;
  if (isMobileDevice()) return false;
  return isFullscreenSupported();
}

export async function requestFullscreen(el?: HTMLElement | null): Promise<boolean> {
  if (!shouldUseBrowserFullscreen()) return false;

  const target = el ?? document.documentElement;
  try {
    const req =
      target.requestFullscreen?.bind(target) ||
      (target as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> })
        .webkitRequestFullscreen?.bind(target);
    if (req) {
      await req();
      return true;
    }
  } catch {
    // 사용자 거부 또는 미지원
  }
  return false;
}

export async function exitFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  } catch {
    // ignore
  }
}

/**
 * Clear stale Screen Orientation locks (esp. landscape locks from older builds).
 * Safe to call once at app boot — never locks a direction afterward.
 */
export function unlockOrientation(): void {
  try {
    screen.orientation?.unlock?.();
  } catch {
    // ignore
  }
}

export type CockpitOrientation = "portrait" | "landscape";

export function isOrientationLockSupported(): boolean {
  if (typeof screen === "undefined") return false;
  return typeof screen.orientation?.lock === "function";
}

function getOrientationLockType(mode: CockpitOrientation): OrientationLockType {
  return mode === "landscape" ? "landscape" : "portrait-primary";
}

async function requestDocumentFullscreen(): Promise<boolean> {
  if (typeof document === "undefined") return false;
  try {
    const target = document.documentElement;
    const req =
      target.requestFullscreen?.bind(target) ||
      (target as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> })
        .webkitRequestFullscreen?.bind(target);
    if (!req) return false;
    await req();
    return !!document.fullscreenElement;
  } catch {
    return false;
  }
}

/** 인게임 가로/세로 토글 시 기기 화면 방향을 맞춘다. */
export async function lockCockpitOrientation(
  mode: CockpitOrientation,
): Promise<boolean> {
  if (typeof screen === "undefined") return false;

  const lockType = getOrientationLockType(mode);
  const tryLock = async () => {
    if (!screen.orientation?.lock) return false;
    await screen.orientation.lock(lockType);
    return true;
  };

  try {
    if (await tryLock()) return true;
  } catch {
    // Fullscreen unlocks orientation lock requirements on some mobile browsers.
  }

  if (isMobileDevice()) {
    try {
      await requestDocumentFullscreen();
      if (await tryLock()) return true;
    } catch {
      // ignore
    }
  }

  return false;
}

export async function restoreDefaultCockpitOrientation(): Promise<void> {
  try {
    if (isOrientationLockSupported()) {
      await lockCockpitOrientation("portrait");
      return;
    }
  } catch {
    // ignore
  }
  unlockOrientation();
}

const FORCED_LANDSCAPE_CLASS = "yanmar-forced-landscape";

export function setForcedLandscapeFallback(active: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(FORCED_LANDSCAPE_CLASS, active);
}

export function clearForcedLandscapeFallback(): void {
  setForcedLandscapeFallback(false);
}

/** Screen Orientation API가 실패했을 때 CSS로 가로 화면을 흉내 낸다. */
export function shouldUseForcedLandscapeFallback(mode: CockpitOrientation): boolean {
  if (typeof window === "undefined") return false;
  return mode === "landscape" && window.matchMedia("(orientation: portrait)").matches;
}

export async function applyCockpitOrientation(mode: CockpitOrientation): Promise<boolean> {
  const locked = await lockCockpitOrientation(mode);
  if (locked) {
    clearForcedLandscapeFallback();
    return true;
  }

  if (mode === "portrait") {
    clearForcedLandscapeFallback();
    return false;
  }

  setForcedLandscapeFallback(shouldUseForcedLandscapeFallback(mode));
  return false;
}
