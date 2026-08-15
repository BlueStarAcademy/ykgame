import {
  getWorldPickupHourBucket,
  getWorldPickupHourStartMs,
} from "./worldPickups";

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const MINUTE_MS = 60_000;
/** Each hourly ad teaser stays visible for 15 minutes. */
export const HOURLY_AD_BANNER_MS = 15 * MINUTE_MS;
/** Ad watch gate before claim is enabled. */
export const HOURLY_AD_WATCH_SEC = 10;
/** Slot reel decelerates to a stop over this duration when not interrupted. */
export const HOURLY_AD_SLOT_DECAY_MS = 5_800;

export const HOURLY_AD_EVENT_PREFIX = "hourly-ad:";

export type HourlyAdSlotId = "m15" | "m30" | "m45";

export type HourlyAdCreative = {
  image: string;
  teaserTitle: string;
  teaserSub: string;
  panelEyebrow: string;
  panelTitle: string;
  imageAlt: string;
  ariaLabel: string;
  /** False until creative art is supplied (slot stays closed). */
  ready: boolean;
};

export type HourlyAdSlot = {
  id: HourlyAdSlotId;
  /** Minutes after KST hour start when the teaser opens. */
  offsetMin: number;
  creative: HourlyAdCreative;
};

/**
 * Three staggered ads per KST hour:
 * :15 existing launch creative, :30 parts pre-order, :45 next upload.
 */
export const HOURLY_AD_SLOTS: readonly HourlyAdSlot[] = [
  {
    id: "m15",
    offsetMin: 15,
    creative: {
      image: "/images/yanmar/ads/sv10-sv11-launch.png",
      teaserTitle: "SV10·SV11 출시!",
      teaserSub: "탭하고 보상 받기",
      panelEyebrow: "Yanmar New Model",
      panelTitle: "SV10·SV11 출시!",
      imageAlt: "얀마 SV10·SV11 미니굴착기 출시",
      ariaLabel: "SV10·SV11 출시 광고",
      ready: true,
    },
  },
  {
    id: "m30",
    offsetMin: 30,
    creative: {
      image: "/images/yanmar/ads/parts-preorder.png",
      teaserTitle: "부품 사전 주문!",
      teaserSub: "탭하고 보상 받기",
      panelEyebrow: "Yanmar Parts Promo",
      panelTitle: "부품 사전 주문 프로모션",
      imageAlt: "얀마 부품 사전 주문 프로모션 — 고무트랙·롤러·스프로켓·아이들러",
      ariaLabel: "부품 사전 주문 프로모션 광고",
      ready: true,
    },
  },
  {
    id: "m45",
    offsetMin: 45,
    creative: {
      image: "/images/yanmar/ads/hourly-ad-45.png",
      teaserTitle: "존디어 부품 20%!",
      teaserSub: "탭하고 보상 받기",
      panelEyebrow: "YK건기 × John Deere",
      panelTitle: "존디어 순정 부품 20% 인하",
      imageAlt:
        "YK건기 × 존디어 — 존디어 모든 순정 부품 20% 인하 프로모션",
      ariaLabel: "존디어 순정 부품 20% 인하 광고",
      ready: true,
    },
  },
] as const;

const SLOT_BY_ID = Object.fromEntries(
  HOURLY_AD_SLOTS.map((slot) => [slot.id, slot]),
) as Record<HourlyAdSlotId, HourlyAdSlot>;

export type HourlyAdRewardKind =
  | "stars"
  | "gachaPremium"
  | "gachaStandard"
  | "dumpPoints"
  | "crashPoints"
  | "hillPoints"
  | "monumentPoints";

export type HourlyAdReward = {
  kind: HourlyAdRewardKind;
  amount: number;
  label: string;
  icon: string;
};

export type HourlyAdRewardPoolEntry = {
  kind: HourlyAdRewardKind;
  label: string;
  icon: string;
  /** Fixed amount, or null when amount is rolled in range. */
  fixedAmount: number | null;
  min?: number;
  max?: number;
};

/** Reward pool scaled to ~75% of the previous hourly-ad amounts. */
export const HOURLY_AD_REWARD_POOL: readonly HourlyAdRewardPoolEntry[] = [
  {
    kind: "stars",
    label: "스타",
    icon: "/images/star-currency.svg",
    fixedAmount: null,
    min: 75,
    max: 225,
  },
  {
    kind: "gachaPremium",
    label: "고급 뽑기권",
    icon: "/images/yanmar/2d/gacha-ticket-premium.svg",
    fixedAmount: 2,
  },
  {
    kind: "gachaStandard",
    label: "일반 뽑기권",
    icon: "/images/yanmar/2d/gacha-ticket-standard.svg",
    fixedAmount: 4,
  },
  {
    kind: "dumpPoints",
    label: "흙 하역장 포인트",
    icon: "/images/yanmar/2d/workshop-coin-dump.svg",
    fixedAmount: null,
    min: 75,
    max: 225,
  },
  {
    kind: "crashPoints",
    label: "파쇄 작업장 포인트",
    icon: "/images/yanmar/2d/workshop-coin-crash.svg",
    fixedAmount: null,
    min: 75,
    max: 225,
  },
  {
    kind: "hillPoints",
    label: "돌 하역장 포인트",
    icon: "/images/yanmar/2d/workshop-coin-hill.svg",
    fixedAmount: null,
    min: 75,
    max: 225,
  },
  {
    kind: "monumentPoints",
    label: "조형물 포인트",
    icon: "/images/yanmar/2d/workshop-coin-monument.svg",
    fixedAmount: null,
    min: 75,
    max: 225,
  },
] as const;

const CLAIMED_STORAGE_PREFIX = "ykgame:yanmar:hourly-ad-claimed:";
const GRANT_STORAGE_PREFIX = "ykgame:yanmar:hourly-ad-grant:";

export function getHourlyAdHourBucket(now = Date.now()) {
  return getWorldPickupHourBucket(now);
}

export function getHourlyAdHourStartMs(hourBucket: number) {
  return getWorldPickupHourStartMs(hourBucket);
}

export function isHourlyAdSlotId(value: string): value is HourlyAdSlotId {
  return value === "m15" || value === "m30" || value === "m45";
}

export function getHourlyAdSlot(slotId: HourlyAdSlotId) {
  return SLOT_BY_ID[slotId];
}

/** KST wall-clock open time for a slot inside the given hour bucket. */
export function getHourlyAdSlotWindowStartMs(
  hourBucket: number,
  slotId: HourlyAdSlotId,
) {
  const slot = getHourlyAdSlot(slotId);
  return getHourlyAdHourStartMs(hourBucket) + slot.offsetMin * MINUTE_MS;
}

export type ActiveHourlyAd = {
  hourBucket: number;
  slot: HourlyAdSlot;
  remainingMs: number;
};

/** Active ready slot for `now`, or null outside all windows. */
export function getActiveHourlyAd(now = Date.now()): ActiveHourlyAd | null {
  const hourBucket = getHourlyAdHourBucket(now);
  for (const slot of HOURLY_AD_SLOTS) {
    if (!slot.creative.ready) continue;
    const start = getHourlyAdSlotWindowStartMs(hourBucket, slot.id);
    const elapsed = now - start;
    if (elapsed < 0 || elapsed >= HOURLY_AD_BANNER_MS) continue;
    return {
      hourBucket,
      slot,
      remainingMs: HOURLY_AD_BANNER_MS - elapsed,
    };
  }
  return null;
}

export function makeHourlyAdEventId(
  hourBucket: number,
  slotId: HourlyAdSlotId,
) {
  return `${HOURLY_AD_EVENT_PREFIX}${hourBucket}:${slotId}`;
}

export function parseHourlyAdEventId(eventId: string): {
  hourBucket: number;
  slotId: HourlyAdSlotId;
} | null {
  if (!eventId.startsWith(HOURLY_AD_EVENT_PREFIX)) return null;
  const raw = eventId.slice(HOURLY_AD_EVENT_PREFIX.length);
  const [bucketRaw, slotRaw] = raw.split(":");
  const hourBucket = Number(bucketRaw);
  if (!Number.isInteger(hourBucket) || hourBucket <= 0) return null;
  if (!slotRaw || !isHourlyAdSlotId(slotRaw)) return null;
  return { hourBucket, slotId: slotRaw };
}

/** @deprecated Prefer parseHourlyAdEventId — kept for older callers. */
export function parseHourlyAdEventBucket(eventId: string): number | null {
  return parseHourlyAdEventId(eventId)?.hourBucket ?? null;
}

/** Remaining ms until the active teaser expires (0 if none). */
export function getHourlyAdBannerRemainingMs(now = Date.now()) {
  return getActiveHourlyAd(now)?.remainingMs ?? 0;
}

/**
 * Claim is allowed while a ready slot window is open.
 */
export function isHourlyAdClaimOpen(now = Date.now()) {
  return getActiveHourlyAd(now) !== null;
}

export function formatMmSs(totalSec: number) {
  const sec = Math.max(0, Math.ceil(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function storageKey(prefix: string, hourBucket: number, slotId: HourlyAdSlotId) {
  return `${prefix}${hourBucket}:${slotId}`;
}

/** True if reward was claimed or the ad was dismissed for this slot. */
export function wasHourlyAdClaimedLocally(
  hourBucket: number,
  slotId: HourlyAdSlotId,
) {
  try {
    return (
      window.localStorage.getItem(
        storageKey(CLAIMED_STORAGE_PREFIX, hourBucket, slotId),
      ) === "1"
    );
  } catch {
    return false;
  }
}

/** Hide the teaser for this slot (after claim or dismiss-without-reward). */
export function markHourlyAdClaimedLocally(
  hourBucket: number,
  slotId: HourlyAdSlotId,
) {
  try {
    window.localStorage.setItem(
      storageKey(CLAIMED_STORAGE_PREFIX, hourBucket, slotId),
      "1",
    );
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Persist a successful grant. Receipt is final here — closing the result modal
 * or quitting the app must not undo it.
 */
export function saveHourlyAdGrantLocally(
  hourBucket: number,
  slotId: HourlyAdSlotId,
  result: HourlyAdClaimResult,
) {
  markHourlyAdClaimedLocally(hourBucket, slotId);
  try {
    window.localStorage.setItem(
      storageKey(GRANT_STORAGE_PREFIX, hourBucket, slotId),
      JSON.stringify({
        eventId: result.eventId,
        reward: result.reward,
        currency: result.currency,
        gachaTicketsStandard: result.gachaTicketsStandard,
        gachaTicketsPremium: result.gachaTicketsPremium,
        dumpWorkshopPoints: result.dumpWorkshopPoints,
        crashWorkshopPoints: result.crashWorkshopPoints,
        hillWorkshopPoints: result.hillWorkshopPoints,
        floodWorkshopPoints: result.floodWorkshopPoints,
        monumentPoints: result.monumentPoints,
        savedAtMs: Date.now(),
      }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadHourlyAdGrantLocally(
  hourBucket: number,
  slotId: HourlyAdSlotId,
): HourlyAdClaimResult | null {
  try {
    const raw = window.localStorage.getItem(
      storageKey(GRANT_STORAGE_PREFIX, hourBucket, slotId),
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HourlyAdClaimResult & {
      savedAtMs?: number;
    };
    if (!parsed?.reward?.kind || typeof parsed.reward.amount !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Most recent persisted grant among this hour's slots (for wallet restore). */
export function loadLatestHourlyAdGrantLocally(
  hourBucket: number,
): HourlyAdClaimResult | null {
  let latest: (HourlyAdClaimResult & { savedAtMs?: number }) | null = null;
  for (const slot of HOURLY_AD_SLOTS) {
    const grant = loadHourlyAdGrantLocally(hourBucket, slot.id) as
      | (HourlyAdClaimResult & { savedAtMs?: number })
      | null;
    if (!grant) continue;
    if (!latest || (grant.savedAtMs ?? 0) > (latest.savedAtMs ?? 0)) {
      latest = grant;
    }
  }
  return latest;
}

export function rollHourlyAdReward(): HourlyAdReward {
  const entry =
    HOURLY_AD_REWARD_POOL[
      Math.floor(Math.random() * HOURLY_AD_REWARD_POOL.length)
    ]!;
  const amount =
    entry.fixedAmount ??
    randomInt(entry.min ?? 75, entry.max ?? 225);
  return {
    kind: entry.kind,
    amount,
    label: entry.label,
    icon: entry.icon,
  };
}

export function describeHourlyAdReward(reward: HourlyAdReward) {
  if (reward.kind === "gachaPremium" || reward.kind === "gachaStandard") {
    return `${reward.label} ${reward.amount}개`;
  }
  return `${reward.label} ${reward.amount.toLocaleString("ko-KR")}`;
}

export type HourlyAdClaimResult = {
  eventId: string;
  reward: HourlyAdReward;
  replayed?: boolean;
  currency?: number;
  gachaTicketsStandard?: number;
  gachaTicketsPremium?: number;
  dumpWorkshopPoints?: number;
  crashWorkshopPoints?: number;
  hillWorkshopPoints?: number;
  floodWorkshopPoints?: number;
  monumentPoints?: number;
};
