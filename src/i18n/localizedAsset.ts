import { defaultLocale, type Locale } from "./config";

/**
 * Resolve a localized image path.
 * Korean uses the original path for backward compatibility.
 * Other locales append `.{locale}` before the extension:
 *   /images/foo.webp + ja → /images/foo.ja.webp
 */
export function localizedAsset(path: string, locale: Locale = defaultLocale): string {
  if (locale === defaultLocale) return path;

  const qIndex = path.indexOf("?");
  const base = qIndex >= 0 ? path.slice(0, qIndex) : path;
  const query = qIndex >= 0 ? path.slice(qIndex) : "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return `${base}.${locale}${query}`;

  const stem = base.slice(0, dot);
  const ext = base.slice(dot);
  // Already localized (e.g. foo.ja.webp)
  if (stem.endsWith(`.${locale}`)) return path;
  return `${stem}.${locale}${ext}${query}`;
}
