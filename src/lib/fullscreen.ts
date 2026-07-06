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

/** 모바일·PWA에서는 CSS 고정 레이아웃만 사용 (Fullscreen API는 가로 회전 유발) */
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
      await lockPortraitAsync();
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

type OrientationLock = ScreenOrientation & {
  lock?: (orientation: string) => Promise<void>;
};

async function lockPortraitAsync(): Promise<void> {
  if (typeof screen === "undefined") return;
  const orientation = screen.orientation as OrientationLock;
  if (!orientation.lock) return;

  const modes: string[] = [
    "portrait-primary",
    "portrait",
    "natural",
  ];

  for (const mode of modes) {
    try {
      await orientation.lock(mode);
      return;
    } catch {
      // 다음 모드 시도
    }
  }
}

export function lockPortrait(): void {
  void lockPortraitAsync();
}

export function unlockOrientation(): void {
  try {
    screen.orientation?.unlock?.();
  } catch {
    // ignore
  }
}

let portraitLockListenerCount = 0;
let portraitLockHandler: (() => void) | null = null;

/** orientationchange 시 세로 재고정 (PWA·게임 중) */
export function enablePersistentPortraitLock(): () => void {
  if (typeof window === "undefined") return () => {};

  portraitLockListenerCount += 1;
  if (!portraitLockHandler) {
    portraitLockHandler = () => {
      lockPortrait();
      window.setTimeout(lockPortrait, 50);
      window.setTimeout(lockPortrait, 200);
      window.setTimeout(lockPortrait, 500);
    };
    window.addEventListener("orientationchange", portraitLockHandler);
    screen.orientation?.addEventListener?.("change", portraitLockHandler);
  }
  lockPortrait();

  return () => {
    portraitLockListenerCount = Math.max(0, portraitLockListenerCount - 1);
    if (portraitLockListenerCount === 0 && portraitLockHandler) {
      window.removeEventListener("orientationchange", portraitLockHandler);
      screen.orientation?.removeEventListener?.("change", portraitLockHandler);
      portraitLockHandler = null;
    }
  };
}

export function isPhoneLandscape(): boolean {
  if (typeof window === "undefined") return false;
  if (!isMobileDevice()) return false;
  const landscape = window.matchMedia("(orientation: landscape)").matches;
  // 폴더블·태블릿 가로는 제외, 일반 스마트폰만 차단
  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  return landscape && shortSide <= 520;
}
