import { localeToBcp47, type Locale, defaultLocale } from "./config";

export function formatNumber(
  value: number,
  locale: Locale = defaultLocale,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(localeToBcp47[locale], options).format(value);
}

export function formatDate(
  value: Date | string | number,
  locale: Locale = defaultLocale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(localeToBcp47[locale], options).format(date);
}
