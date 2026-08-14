"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import { LanguagePicker } from "@/components/i18n/LanguagePicker";
import { StarAmount } from "@/components/StarAmount";
import {
  NICKNAME_CHANGE_COST_STARS,
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  validateNickname,
} from "@/lib/profile";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const t = useTranslations("shell.settings");
  const tc = useTranslations("common");
  const { data: session, update } = useSession();
  const [loginId, setLoginId] = useState("");
  const [nickname, setNickname] = useState("");
  const [currency, setCurrency] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    fetch("/api/user/profile")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        setLoginId(data.user?.loginId ?? "");
        setNickname(data.user?.nickname ?? session?.user?.nickname ?? "");
        setCurrency(
          typeof data.user?.currency === "number"
            ? data.user.currency
            : (session?.user?.currency ?? 0),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setLoginId("");
          setNickname(session?.user?.nickname ?? "");
          setCurrency(session?.user?.currency ?? 0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, session?.user?.nickname, session?.user?.currency]);

  if (!open) return null;

  const nicknameDirty =
    nickname.trim() !== (session?.user?.nickname ?? "").trim();
  const canAfford = currency >= NICKNAME_CHANGE_COST_STARS;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (nicknameDirty) {
      const parsed = validateNickname(nickname);
      if (!parsed.ok) {
        setError(parsed.message);
        return;
      }
    }

    setSaving(true);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("saveFailed"));
        return;
      }
      if (typeof data.currency === "number") {
        setCurrency(data.currency);
      }
      await update({
        user: {
          nickname: data.nickname,
          currency: data.currency,
          profileAvatarId: data.profileAvatarId,
        },
      });
      onClose();
    } catch {
      setError(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppModalOverlay open={open} onClose={onClose}>
      <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-slate-700 px-4 py-3 text-white">
          <h2 className="text-base font-black">{t("title")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/20 px-2.5 py-1 text-xs font-bold hover:bg-white/30"
          >
            {tc("close")}
          </button>
        </div>

        {loading ? (
          <p className="py-10 text-center text-xs text-gray-400">{t("loading")}</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 p-4">
            <LanguagePicker />

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">
                {t("loginId")}
              </label>
              <input
                type="text"
                value={loginId}
                readOnly
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">
                {t("nickname")}
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                placeholder={t("nicknamePlaceholder", {
                  min: NICKNAME_MIN_LENGTH,
                  max: NICKNAME_MAX_LENGTH,
                })}
                minLength={NICKNAME_MIN_LENGTH}
                maxLength={NICKNAME_MAX_LENGTH}
                required
              />
              <p className="mt-1.5 text-[11px] font-semibold text-amber-700">
                {t("nicknameHint", { cost: NICKNAME_CHANGE_COST_STARS })}
              </p>
            </div>

            {error ? <p className="text-xs text-red-500">{error}</p> : null}

            <button
              type="submit"
              disabled={saving || (nicknameDirty && !canAfford)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {saving ? (
                tc("saving")
              ) : nicknameDirty ? (
                <>
                  <span>{t("change")}</span>
                  <StarAmount
                    value={NICKNAME_CHANGE_COST_STARS}
                    size={14}
                    valueClassName="text-sm font-black tabular-nums"
                  />
                </>
              ) : (
                tc("save")
              )}
            </button>
          </form>
        )}
      </div>
    </AppModalOverlay>
  );
}
