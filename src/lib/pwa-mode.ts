/** PWA 전체화면 체험 모드 (sessionStorage 유지) */

export const PWA_STORAGE_KEY = "ykgame_pwa";
export const PWA_QUERY = "pwa";

export function enablePwaMode(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(PWA_STORAGE_KEY, "1");
}

export function disablePwaMode(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(PWA_STORAGE_KEY);
}

export function isPwaMode(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(PWA_STORAGE_KEY) === "1";
}

/** 상대/절대 경로에 pwa=1 쿼리 추가 */
export function withPwaQuery(path: string): string {
  if (typeof window === "undefined") {
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}${PWA_QUERY}=1`;
  }
  const url = new URL(path, window.location.origin);
  url.searchParams.set(PWA_QUERY, "1");
  return url.pathname + url.search;
}

/** QR·공유용 랜딩 URL (절대 경로) — 항상 소개 페이지부터 진입 */
export function buildPwaLandingUrl(
  origin = typeof window !== "undefined" ? window.location.origin : "",
): string {
  const params = new URLSearchParams({ [PWA_QUERY]: "1" });
  return `${origin}/?${params.toString()}`;
}

/** QR·공유용 로그인 URL (절대 경로) */
export function buildPwaLoginUrl(
  callbackUrl = "/home",
  origin = typeof window !== "undefined" ? window.location.origin : "",
): string {
  const params = new URLSearchParams({
    [PWA_QUERY]: "1",
    callbackUrl,
  });
  return `${origin}/login?${params.toString()}`;
}

export function activatePwaFromSearchParams(params: URLSearchParams): boolean {
  if (params.get(PWA_QUERY) === "1") {
    enablePwaMode();
    return true;
  }
  return isPwaMode();
}
