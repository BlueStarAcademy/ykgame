"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { experienceDestination, getExperienceMode } from "@/lib/experience-mode";
import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  nicknameCharLength,
  validateNickname,
} from "@/lib/profile";
import { withPwaQuery } from "@/lib/pwa-mode";

export function NicknameForm() {
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const router = useRouter();
  const { update } = useSession();
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const length = useMemo(() => nicknameCharLength(nickname.trim()), [nickname]);
  const hint =
    length === 0
      ? t("nicknameInitialHint", {
          min: NICKNAME_MIN_LENGTH,
          max: NICKNAME_MAX_LENGTH,
        })
      : length < NICKNAME_MIN_LENGTH
        ? t("nicknameMinHint", { min: NICKNAME_MIN_LENGTH, length })
        : length > NICKNAME_MAX_LENGTH
          ? t("nicknameMaxHint", { max: NICKNAME_MAX_LENGTH, length })
          : t("nicknameLength", { length, max: NICKNAME_MAX_LENGTH });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const parsed = validateNickname(nickname);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }

    setLoading(true);

    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: parsed.nickname }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? t("nicknameSetFailed"));
      return;
    }

    await update({ user: { nickname: data.nickname, currency: data.currency } });
    const experience = getExperienceMode();
    const nextPath = experience ? experienceDestination(experience) : "/home";
    router.push(withPwaQuery(nextPath));
    router.refresh();
  }

  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
      <h1 className="mb-2 text-center text-xl font-bold text-gray-900">{t("nicknameTitle")}</h1>
      <p className="mb-6 text-center text-sm text-gray-500">
        {t("nicknameSubtitle")}
        <br />
        <span className="text-xs text-gray-400">
          {t("nicknameRequirements", {
            min: NICKNAME_MIN_LENGTH,
            max: NICKNAME_MAX_LENGTH,
          })}
        </span>
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="text"
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              if (error) setError("");
            }}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-lg outline-none focus:border-blue-500"
            placeholder={t("nicknamePlaceholder", {
              min: NICKNAME_MIN_LENGTH,
              max: NICKNAME_MAX_LENGTH,
            })}
            maxLength={NICKNAME_MAX_LENGTH}
            autoComplete="nickname"
            required
          />
          <p
            className={`mt-2 text-center text-xs ${
              length > 0 &&
              (length < NICKNAME_MIN_LENGTH || length > NICKNAME_MAX_LENGTH)
                ? "font-semibold text-amber-600"
                : "text-gray-400"
            }`}
          >
            {hint}
          </p>
        </div>
        {error ? <p className="text-center text-sm text-red-500">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? common("saving") : t("nicknameContinue")}
        </button>
      </form>
    </div>
  );
}
