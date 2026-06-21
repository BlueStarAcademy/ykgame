/**
 * 앱 URL / Railway 환경 변수 자동 설정
 */
export function getAppUrl(): string {
  if (process.env.AUTH_URL) {
    return process.env.AUTH_URL.replace(/\/$/, "");
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  return "http://localhost:3000";
}

export function ensureRailwayEnv(): void {
  if (!process.env.AUTH_URL && process.env.RAILWAY_PUBLIC_DOMAIN) {
    process.env.AUTH_URL = getAppUrl();
  }
}
