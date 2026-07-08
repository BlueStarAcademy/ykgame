/**
 * 브라우저 전체화면 API + iOS 홈화면 추가(PWA) 지원 유틸
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
 * 게임 몰입 모드에서는 모바일도 Fullscreen API 사용 (Android 가로 전환·크롬 UI 숨김).
 * 이미 설치된 standalone PWA는 CSS 풀스크린만 사용.
 */
export function shouldUseBrowserFullscreen(): boolean {
  if (isStandalonePwa()) return false;
  return isFullscreenSupported();
}

type OrientationLock = ScreenOrientation & {
  lock?: (orientation: string) => Promise<void>;
};

async function lockOrientationAsync(modes: string[]): Promise<boolean> {
  if (typeof screen === "undefined") return false;
  const orientation = screen.orientation as OrientationLock;
  if (!orientation.lock) return false;

  for (const mode of modes) {
    try {
      await orientation.lock(mode);
      return true;
    } catch {
      // try next mode
    }
  }
  return false;
}

/** 게임 중 가로 우선 (지원 기기에서만 동작, iOS는 보통 무시) */
export async function lockLandscapeAsync(): Promise<boolean> {
  return lockOrientationAsync(["landscape-primary", "landscape", "any"]);
}

export function lockLandscape(): void {
  void lockLandscapeAsync();
}

/** 게임 중 세로 우선 (지원 기기에서만 동작) */
export async function lockPortraitAsync(): Promise<boolean> {
  return lockOrientationAsync(["portrait-primary", "portrait", "natural"]);
}

export function lockPortrait(): void {
  void lockPortraitAsync();
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
      await lockLandscapeAsync();
      return true;
    }
  } catch {
    // 사용자 거부 또는 미지원
  }
  return false;
}

export async function exitFullscreen(): Promise<void> {
  if (!shouldUseBrowserFullscreen()) return;
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  } catch {
    // ignore
  }
}

export function unlockOrientation(): void {
  try {
    screen.orientation?.unlock?.();
  } catch {
    // ignore
  }
}
