"use client";

import { useLocale } from "next-intl";
import type { Locale } from "@/i18n/config";
import { localizedAsset } from "@/i18n/localizedAsset";

/** Client hook: resolve image path for the active locale. */
export function useLocalizedAsset(path: string): string {
  const locale = useLocale() as Locale;
  return localizedAsset(path, locale);
}
