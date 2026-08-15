"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { localeLabels, locales, type Locale } from "@/i18n/config";
import { setUserLocale } from "@/i18n/locale-actions";

interface LanguagePickerProps {
  className?: string;
  /** compact = select only; default includes label; game = in-game settings row; splash = login/home corner */
  variant?: "default" | "compact" | "game" | "splash";
}

export function LanguagePicker({
  className = "",
  variant = "default",
}: LanguagePickerProps) {
  const t = useTranslations("shell.settings");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(next: string) {
    startTransition(async () => {
      await setUserLocale(next);
      router.refresh();
    });
  }

  if (variant === "game") {
    return (
      <label
        className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left font-semibold text-white ${className}`}
      >
        <span className="shrink-0 text-[11px]">{t("language")}</span>
        <select
          value={locale}
          disabled={pending}
          onChange={(e) => onChange(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          aria-label={t("language")}
          className="min-w-0 max-w-[9.5rem] rounded-md border border-white/20 bg-black/55 px-2 py-1 text-[11px] font-bold text-white outline-none focus:border-sky-300/60 disabled:opacity-50"
        >
          {locales.map((code) => (
            <option key={code} value={code} className="bg-zinc-900 text-white">
              {localeLabels[code]}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (variant === "splash") {
    return (
      <div
        className={`pointer-events-auto absolute top-[max(0.7rem,env(safe-area-inset-top))] right-[max(0.7rem,env(safe-area-inset-right))] z-30 ${className}`.trim()}
      >
        <label className="block">
          <span className="sr-only">{t("language")}</span>
          <select
            value={locale}
            disabled={pending}
            onChange={(e) => onChange(e.target.value)}
            aria-label={t("language")}
            className="site-legend-lang-picker-select"
          >
            {locales.map((code) => (
              <option key={code} value={code} className="bg-zinc-900 text-white">
                {localeLabels[code]}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  const selectClass =
    "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500";

  return (
    <div className={className}>
      {variant === "default" ? (
        <label className="mb-1 block text-xs font-semibold text-gray-500">
          {t("language")}
        </label>
      ) : null}
      <select
        value={locale}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
        className={selectClass}
        aria-label={t("language")}
      >
        {locales.map((code) => (
          <option key={code} value={code}>
            {localeLabels[code]}
          </option>
        ))}
      </select>
    </div>
  );
}
