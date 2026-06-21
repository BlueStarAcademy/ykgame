export type OAuthProvider = "kakao" | "google";

export const OAUTH_PROVIDERS: OAuthProvider[] = ["kakao", "google"];

export function isOAuthConfigured(provider: OAuthProvider): boolean {
  if (provider === "kakao") {
    return Boolean(
      process.env.KAKAO_CLIENT_ID && process.env.KAKAO_CLIENT_SECRET,
    );
  }
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
}

export function getOAuthNotReadyMessage(provider: OAuthProvider): string {
  const name = provider === "kakao" ? "카카오" : "구글";
  return `${name} 로그인은 준비 중입니다. API 키 설정 후 이용 가능합니다.`;
}
