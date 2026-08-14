"use client";

import { useEffect, useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("auth");
  const common = useTranslations("common");
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
  const [conflictOpen, setConflictOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const auto = localStorage.getItem(AUTO_LOGIN_KEY) === "true";
    if (saved) {
      setLoginId(saved);
      setSaveId(true);
    }
    if (auto) setAutoLogin(true);
  }, []);

  function persistLoginPrefs() {
    if (saveId) {
      localStorage.setItem(STORAGE_KEY, loginId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    localStorage.setItem(AUTO_LOGIN_KEY, String(autoLogin));
  }

  async function completeSignIn() {
    const result = await signIn("credentials", {
      loginId,
      password,
      rememberMe: String(autoLogin),
      forceTakeover: "true",
      redirect: false,
    });

    if (result?.error) {
      setError(t("invalidCredentials"));
      return false;
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
      return true;
    }
    router.push(dest);
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    persistLoginPrefs();

    try {
      const preRes = await fetch("/api/auth/prelogin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password }),
      });
      const preData = (await preRes.json()) as {
        conflict?: boolean;
        error?: string;
      };

      if (!preRes.ok) {
        setError(preData.error ?? t("invalidCredentials"));
        return;
      }

      if (preData.conflict) {
        setConflictOpen(true);
        return;
      }

      await completeSignIn();
    } catch {
      setError(t("loginError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleConflictConfirm() {
    setConflictOpen(false);
    setError("");
    setLoading(true);
    try {
      await completeSignIn();
    } catch {
      setError(t("loginError"));
    } finally {
      setLoading(false);
    }
  }

  function handleConflictCancel() {
    setConflictOpen(false);
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
          <h1 className="text-xl font-bold text-gray-900">{t("brandTitle")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("brandSubtitle")}</p>
        </div>
      ) : (
        <div className="site-legend-login-heading">
          <h1>{t("login")}</h1>
        </div>
      )}

      {registeredNotice ? (
        <p className={isSiteLegend ? "site-legend-login-success" : "mb-3 text-sm text-green-600"}>
          {t("registeredNotice")}
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
            {t("loginId")}
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
            placeholder={t("loginIdPlaceholder")}
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
            {t("password")}
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
            placeholder={t("passwordPlaceholder")}
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
                {t("saveId")}
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
                {t("autoLogin")}
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
                {t("saveId")}
              </label>
              <label className="flex items-center gap-2 text-gray-600">
                <input
                  type="checkbox"
                  checked={autoLogin}
                  onChange={(e) => setAutoLogin(e.target.checked)}
                />
                {t("autoLogin")}
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
                {loading ? t("loggingIn") : t("login")}
              </span>
            </>
          ) : loading ? (
            t("loggingIn")
          ) : (
            t("login")
          )}
        </button>
      </form>

      <p className={isSiteLegend ? "site-legend-login-footer" : "mt-5 text-center text-sm text-gray-500"}>
        {t("noAccount")}{" "}
        {isSiteLegend ? (
          <button
            type="button"
            className="site-legend-login-link"
            onClick={() => setSignupOpen(true)}
          >
            {t("signup")}
          </button>
        ) : (
          <Link
            href={withPwaQuery("/signup")}
            className="font-medium text-blue-600 hover:underline"
          >
            {t("signup")}
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

      <AppModalOverlay
        open={conflictOpen}
        onClose={handleConflictCancel}
        nested={isSiteLegend}
      >
        <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="px-5 py-6">
            <p className="text-center text-base font-semibold text-gray-900">
              {t("conflictTitle")}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={handleConflictCancel}
                className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                {common("cancel")}
              </button>
              <button
                type="button"
                onClick={() => void handleConflictConfirm()}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                {t("connect")}
              </button>
            </div>
          </div>
        </div>
      </AppModalOverlay>
    </div>
  );
}
