"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { withPwaQuery } from "@/lib/pwa-mode";

export function SignupForm({
  embedded = false,
  onSuccess,
  onRequestLogin,
}: {
  embedded?: boolean;
  onSuccess?: () => void;
  onRequestLogin?: () => void;
}) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [form, setForm] = useState({
    loginId: "",
    email: "",
    password: "",
    passwordConfirm: "",
  });
  const [emailChecked, setEmailChecked] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "email") setEmailChecked(null);
  }

  async function checkEmail() {
    if (!form.email) return;
    const res = await fetch("/api/auth/check-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.email }),
    });
    const data = await res.json();
    setEmailChecked(data.available);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? t("signupFailed"));
      return;
    }

    if (onSuccess) {
      onSuccess();
      return;
    }

    router.push(withPwaQuery("/login?registered=1"));
  }

  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
      <h1 className="mb-6 text-center text-xl font-bold text-gray-900">{t("signupTitle")}</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("loginId")}</label>
          <input
            type="text"
            value={form.loginId}
            onChange={(e) => update("loginId", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("email")}</label>
          <div className="flex gap-2">
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
              required
            />
            <button
              type="button"
              onClick={checkEmail}
              className="rounded-lg bg-gray-100 px-3 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              {t("checkEmail")}
            </button>
          </div>
          {emailChecked === true && (
            <p className="mt-1 text-sm text-green-600">{t("emailAvailable")}</p>
          )}
          {emailChecked === false && (
            <p className="mt-1 text-sm text-red-500">{t("emailInUse")}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("password")}</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
            minLength={6}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("confirmPassword")}
          </label>
          <input
            type="password"
            value={form.passwordConfirm}
            onChange={(e) => update("passwordConfirm", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
            required
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading || emailChecked === false}
          className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? t("signingUp") : t("signup")}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-gray-500">
        {t("alreadyHaveAccount")}{" "}
        {embedded && onRequestLogin ? (
          <button
            type="button"
            onClick={onRequestLogin}
            className="font-medium text-blue-600 hover:underline"
          >
            {t("login")}
          </button>
        ) : (
          <Link href={withPwaQuery("/login")} className="font-medium text-blue-600 hover:underline">
            {t("login")}
          </Link>
        )}
      </p>
    </div>
  );
}
