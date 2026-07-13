export const TICKER_SETTINGS_ID = "default";
export const TICKER_SCROLL_SPEED_DEFAULT = 60;
export const TICKER_SCROLL_SPEED_MIN = 20;
export const TICKER_SCROLL_SPEED_MAX = 200;
/** Pause at left edge before continuing exit scroll. */
export const TICKER_LEFT_PAUSE_MS = 3000;

export function clampTickerScrollSpeed(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < TICKER_SCROLL_SPEED_MIN || rounded > TICKER_SCROLL_SPEED_MAX) {
    return null;
  }
  return rounded;
}
