/**
 * Troika (`@react-three/drei` Text) font parsing logs unsupported GPOS/GSUB tables
 * and, with the default worker, floods Chrome with `[Violation] 'message' handler took …ms`.
 * Configure once before any Text / preloadFont runs.
 */
// Package ships without types; API is stable in 0.52.x.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error no types for troika-three-text
import { configureTextBuilder } from "troika-three-text";

/** Latin + Hangul; avoids unicode-font-resolver downloading many CJK faces. */
export const YANMAR_SCENE_FONT =
  "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff/Pretendard-Bold.woff";

const FONT_NOISE =
  /unsupported GPOS table|unsupported GSUB table|^unknown format:/;

function quietTroikaFontLogs() {
  if (typeof console === "undefined") return;
  for (const method of ["debug", "log", "warn"] as const) {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]) => {
      const first = args[0];
      if (typeof first === "string" && FONT_NOISE.test(first)) return;
      original(...args);
    };
  }
}

quietTroikaFontLogs();

configureTextBuilder({
  // Main-thread typesetting: no worker postMessage → no Chrome message-handler spam.
  useWorker: false,
  defaultFontURL: YANMAR_SCENE_FONT,
  // Slightly cheaper glyph SDFs for world labels (still sharp enough at our sizes).
  sdfGlyphSize: 48,
});
