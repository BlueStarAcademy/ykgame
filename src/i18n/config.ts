export const locales = ["ko", "ja", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ko";

export const LOCALE_COOKIE = "NEXT_LOCALE";

export const localeLabels: Record<Locale, string> = {
  ko: "한국어",
  ja: "日本語",
  en: "English",
};

export const localeToBcp47: Record<Locale, string> = {
  ko: "ko-KR",
  ja: "ja-JP",
  en: "en-US",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

export function parseLocale(value: unknown): Locale {
  return isLocale(value) ? value : defaultLocale;
}
