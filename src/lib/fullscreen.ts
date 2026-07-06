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

export async function requestFullscreen(el?: HTMLElement | null): Promise<boolean> {
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

export function lockPortrait(): void {
  try {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (o: string) => Promise<void>;
    };
    orientation.lock?.("portrait-primary").catch(() => {});
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
