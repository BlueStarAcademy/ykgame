/**
 * 브라우저 전체화면 API + iOS 홈화면 추가(PWA)
 *
 * 인게임 진입 시에만 Fullscreen API를 사용한다.
 * 인게임은 Screen Orientation lock으로 세로(portrait)를 유지한다.
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

/**
 * standalone PWA는 OS 크롬이 이미 숨겨져 있으므로 Fullscreen API는 건너뛴다.
 * 브라우저 탭(데스크톱·모바일)에서는 인게임 전용으로 허용한다.
 */
export function shouldUseBrowserFullscreen(): boolean {
  if (isStandalonePwa()) return false;
  return isFullscreenSupported();
}

export function isApiFullscreenActive(): boolean {
  if (typeof document === "undefined") return false;
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  return !!(document.fullscreenElement || doc.webkitFullscreenElement);
}

export async function lockPortraitOrientation(): Promise<boolean> {
  const orientation = getLockableOrientation();
  if (!orientation?.lock) return false;

  for (const mode of ["portrait", "portrait-primary"] as const) {
    try {
      await orientation.lock(mode);
      return true;
    } catch {
      // try next
    }
  }
  return false;
}

/** Clear Screen Orientation locks (esp. leftover landscape from older builds). */
export function unlockOrientation(): void {
  try {
    getLockableOrientation()?.unlock?.();
  } catch {
    // ignore
  }
}

/** 인게임 세로 유지 — Orientation API만 사용 (CSS 회전 없음). */
export async function enableInGamePortrait(): Promise<void> {
  await lockPortraitOrientation();
}

export function disableInGamePortrait(): void {
  unlockOrientation();
}

/**
 * 인게임 진입용 전체화면.
 * 사용자 제스처 핸들러에서 호출해야 모바일에서 성공한다.
 * 성공 후 portrait lock으로 세로를 유지한다.
 */
export async function requestFullscreen(el?: HTMLElement | null): Promise<boolean> {
  if (!shouldUseBrowserFullscreen()) {
    await enableInGamePortrait();
    return false;
  }
  if (isApiFullscreenActive()) {
    await enableInGamePortrait();
    return true;
  }

  const target = el ?? document.documentElement;
  try {
    if (typeof target.requestFullscreen === "function") {
      await target.requestFullscreen();
    } else {
      const webkit = (
        target as HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void> | void;
        }
      ).webkitRequestFullscreen?.bind(target);
      if (!webkit) {
        await enableInGamePortrait();
        return false;
      }
      await webkit();
    }

    await enableInGamePortrait();
    return true;
  } catch {
    await enableInGamePortrait();
  }
  return false;
}

/**
 * 인게임 진입 직전 — 사용자 제스처에서 호출.
 * pwa-mode + Fullscreen + portrait lock을 한 번에 건다.
 */
export async function prepareInGameFullscreen(
  el?: HTMLElement | null,
): Promise<boolean> {
  if (typeof document !== "undefined") {
    document.documentElement.classList.add("pwa-mode");
  }
  return requestFullscreen(el ?? document.documentElement);
}

export async function exitFullscreen(): Promise<void> {
  try {
    disableInGamePortrait();
    if (!isApiFullscreenActive()) return;

    const doc = document as Document & {
      exitFullscreen?: () => Promise<void>;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    if (typeof doc.exitFullscreen === "function") {
      await doc.exitFullscreen();
    } else {
      await doc.webkitExitFullscreen?.();
    }
  } catch {
    // ignore
  }
}

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => void;
};

function getLockableOrientation(): LockableScreenOrientation | undefined {
  if (typeof screen === "undefined") return undefined;
  return screen.orientation as LockableScreenOrientation | undefined;
}
