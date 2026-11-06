/** Legacy seeded slot ids + dynamic cuid ids. */
export type HourlyAdSlotId = string;

export const HOURLY_AD_LEGACY_SLOT_IDS = ["m15", "m30", "m45"] as const;

export const HOURLY_AD_OFFSET_MIN_MIN = 0;
export const HOURLY_AD_OFFSET_MIN_MAX = 59;

export const HOURLY_AD_DURATION_MIN_DEFAULT = 15;
export const HOURLY_AD_DURATION_MIN_MIN = 1;
export const HOURLY_AD_DURATION_MIN_MAX = 60;

export const HOURLY_AD_MAX_SLOTS = 12;
export const HOURLY_AD_DRAFT_SLOT_ID = "__draft__";

/** Stored / final WebP size cap after conversion. */
export const HOURLY_AD_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
/** Raw upload size before WebP conversion. */
export const HOURLY_AD_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
export const HOURLY_AD_WEBP_MAX_WIDTH = 1200;
export const HOURLY_AD_ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export const HOURLY_AD_OFFSET_PLACEHOLDER = "0분, 15분, 30분, 45분";
export const HOURLY_AD_DURATION_PLACEHOLDER = "10분간, 20분간";

/** Fallback image used until a custom upload exists. */
export const HOURLY_AD_FALLBACK_IMAGE_PATH =
  "/images/yanmar/ads/sv10-sv11-launch.png";

export const HOURLY_AD_DEFAULT_SLOTS: ReadonlyArray<{
  id: HourlyAdSlotId;
  sortOrder: number;
  title: string;
  defaultImagePath: string;
  offsetMin: number;
  durationMin: number;
}> = [
  {
    id: "m15",
    sortOrder: 0,
    title: "SV10·SV11 출시",
    defaultImagePath: "/images/yanmar/ads/sv10-sv11-launch.png",
    offsetMin: 0,
    durationMin: 15,
  },
  {
    id: "m30",
    sortOrder: 1,
    title: "부품 사전 주문",
    defaultImagePath: "/images/yanmar/ads/parts-preorder.png",
    offsetMin: 15,
    durationMin: 15,
  },
  {
    id: "m45",
    sortOrder: 2,
    title: "존디어 부품 20% 인하",
    defaultImagePath: "/images/yanmar/ads/hourly-ad-45.png",
    offsetMin: 30,
    durationMin: 15,
  },
];

export function isLegacyHourlyAdSlotId(value: string): boolean {
  return (HOURLY_AD_LEGACY_SLOT_IDS as readonly string[]).includes(value);
}

/** Accept legacy ids and cuid-like dynamic ids (no colon — used in event keys). */
export function isHourlyAdSlotId(value: string): value is HourlyAdSlotId {
  if (!value || value === HOURLY_AD_DRAFT_SLOT_ID) return false;
  if (value.includes(":") || value.includes("/")) return false;
  return /^[a-zA-Z0-9_-]{2,64}$/.test(value);
}

export function clampHourlyAdOffsetMin(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.round(value);
  if (n < HOURLY_AD_OFFSET_MIN_MIN || n > HOURLY_AD_OFFSET_MIN_MAX) return null;
  return n;
}

export function clampHourlyAdDurationMin(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.round(value);
  if (n < HOURLY_AD_DURATION_MIN_MIN || n > HOURLY_AD_DURATION_MIN_MAX) {
    return null;
  }
  return n;
}

export function normalizeHourlyAdLinkUrl(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  return parsed.toString();
}
