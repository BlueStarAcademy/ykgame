"use client";

import { useEffect, useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { YkGeongiLogo } from "@/components/brand/YkGeongiLogo";
import { SignupForm } from "@/components/auth/SignupForm";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import { withPwaQuery, isPwaMode } from "@/lib/pwa-mode";

const STORAGE_KEY = "ykgame_saved_login_id";
const AUTO_LOGIN_KEY = "ykgame_auto_login";

type LoginFormVariant = "default" | "siteLegend";

export function LoginForm({
  variant = "default",
  onSuccess,
}: {
  variant?: LoginFormVariant;
  onSuccess?: () => void;
}) {
  return (
    <Suspense>
      <LoginFormInner variant={variant} onSuccess={onSuccess} />
    </Suspense>
  );
}

function LoginFormInner({
  variant,
  onSuccess,
}: {
  variant: LoginFormVariant;
  onSuccess?: () => void;
}) {
  const isSiteLegend = variant === "siteLegend";
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/home";
  const defaultCallback = callbackUrl.startsWith("/") ? callbackUrl : "/home";
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [saveId, setSaveId] = useState(false);
  const [autoLogin, setAutoLogin] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const [registeredNotice, setRegisteredNotice] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const auto = localStorage.getItem(AUTO_LOGIN_KEY) === "true";
    if (saved) {
      setLoginId(saved);
      setSaveId(true);
    }
    if (auto) setAutoLogin(true);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (saveId) {
      localStorage.setItem(STORAGE_KEY, loginId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    localStorage.setItem(AUTO_LOGIN_KEY, String(autoLogin));

    const result = await signIn("credentials", {
      loginId,
      password,
      rememberMe: String(autoLogin),
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("아이디 또는 비밀번호가 올바르지 않습니다.");
      return;
    }

    onSuccess?.();
    router.refresh();
    const dest = isPwaMode() ? withPwaQuery(defaultCallback) : defaultCallback;
    // 이미 /home 에 있으면 홈(게임시작) 상태로 갱신만 한다.
    if (
      typeof window !== "undefined" &&
      (window.location.pathname === dest ||
        window.location.pathname + window.location.search === dest ||
        (defaultCallback.startsWith("/home") && window.location.pathname === "/home"))
    ) {
      return;
    }
    router.push(dest);
  }

  return (
    <div
      className={
        isSiteLegend
          ? "site-legend-login-form w-full"
          : "w-full max-w-md rounded-2xl bg-white p-6 shadow-lg"
      }
    >
      {!isSiteLegend ? (
        <div className="mb-6 text-center">
          <YkGeongiLogo
            variant="black"
            priority
            className="mx-auto mb-3 h-12 w-auto max-w-[14rem] object-contain"
          />
          <h1 className="text-xl font-bold text-gray-900">YK건기 브랜드 캐주얼 게임</h1>
          <p className="mt-1 text-sm text-gray-500">로그인 후 미니게임을 즐겨보세요</p>
        </div>
      ) : (
        <div className="site-legend-login-heading">
          <h1>로그인</h1>
        </div>
      )}

      {registeredNotice ? (
        <p className={isSiteLegend ? "site-legend-login-success" : "mb-3 text-sm text-green-600"}>
          회원가입이 완료되었습니다. 로그인해 주세요.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className={isSiteLegend ? "site-legend-login-fields" : "space-y-4"}>
        <div>
          <label
            className={
              isSiteLegend
                ? "site-legend-login-label"
                : "mb-1 block text-sm font-medium text-gray-700"
            }
          >
            아이디
          </label>
          <input
            type="text"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            className={
              isSiteLegend
                ? "site-legend-login-input"
                : "w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500"
            }
            placeholder="아이디 입력"
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label
            className={
              isSiteLegend
                ? "site-legend-login-label"
                : "mb-1 block text-sm font-medium text-gray-700"
            }
          >
            비밀번호
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={
              isSiteLegend
                ? "site-legend-login-input"
                : "w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500"
            }
            placeholder="비밀번호 입력"
            autoComplete="current-password"
            required
          />
        </div>

        <div
          className={
            isSiteLegend
              ? "site-legend-login-checks"
              : "flex items-center justify-between text-sm"
          }
        >
          {isSiteLegend ? (
            <>
              <label className="site-legend-login-check">
                <input
                  type="checkbox"
                  checked={saveId}
                  onChange={(e) => setSaveId(e.target.checked)}
                />
                <span className="site-legend-check-box" aria-hidden>
                  ✓
                </span>
                아이디 저장
              </label>
              <label className="site-legend-login-check">
                <input
                  type="checkbox"
                  checked={autoLogin}
                  onChange={(e) => setAutoLogin(e.target.checked)}
                />
                <span className="site-legend-check-box" aria-hidden>
                  ✓
                </span>
                자동 로그인
              </label>
            </>
          ) : (
            <>
              <label className="flex items-center gap-2 text-gray-600">
                <input
                  type="checkbox"
                  checked={saveId}
                  onChange={(e) => setSaveId(e.target.checked)}
                />
                아이디 저장
              </label>
              <label className="flex items-center gap-2 text-gray-600">
                <input
                  type="checkbox"
                  checked={autoLogin}
                  onChange={(e) => setAutoLogin(e.target.checked)}
                />
                자동 로그인
              </label>
            </>
          )}
        </div>

        {error ? (
          <p className={isSiteLegend ? "site-legend-login-error" : "text-sm text-red-500"}>{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className={
            isSiteLegend
              ? "site-legend-btn site-legend-btn-login"
              : "w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          }
        >
          {isSiteLegend ? (
            <>
              <span className="site-legend-btn-primary-shine" aria-hidden />
              <span className="site-legend-btn-primary-label">
                {loading ? "로그인 중..." : "로그인"}
              </span>
            </>
          ) : loading ? (
            "로그인 중..."
          ) : (
            "로그인"
          )}
        </button>
      </form>

      <p className={isSiteLegend ? "site-legend-login-footer" : "mt-5 text-center text-sm text-gray-500"}>
        계정이 없으신가요?{" "}
        {isSiteLegend ? (
          <button
            type="button"
            className="site-legend-login-link"
            onClick={() => setSignupOpen(true)}
          >
            회원가입
          </button>
        ) : (
          <Link
            href={withPwaQuery("/signup")}
            className="font-medium text-blue-600 hover:underline"
          >
            회원가입
          </Link>
        )}
      </p>

      {isSiteLegend ? (
        <AppModalOverlay
          open={signupOpen}
          onClose={() => setSignupOpen(false)}
          panelClassName="!max-w-md !bg-transparent !p-0 !shadow-none"
        >
          <SignupForm
            embedded
            onRequestLogin={() => setSignupOpen(false)}
            onSuccess={() => {
              setSignupOpen(false);
              setRegisteredNotice(true);
            }}
          />
        </AppModalOverlay>
      ) : null}
    </div>
  );
}
