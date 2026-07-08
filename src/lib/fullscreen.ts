/**
 * 브라우저 전체화면 API + iOS 홈화면 추가(PWA) 지원 유틸
 *
 * IMPORTANT: Do not call Screen Orientation lock/unlock from gameplay.
 * Unlocking (or locking) mid-session makes phones snap-rotate unexpectedly.
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

/** One-shot viewport aspect for initial cockpit layout choice. */
export function getViewportOrientation(): "portrait" | "landscape" {
  if (typeof window === "undefined") return "portrait";
  return window.innerWidth < window.innerHeight ? "portrait" : "landscape";
}

/**
 * Never use Fullscreen API on phones/PWAs.
 * Android fullscreen often rotates the device and fights our UI layout.
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
