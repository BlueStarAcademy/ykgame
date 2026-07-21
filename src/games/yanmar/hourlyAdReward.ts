import {
  getWorldPickupHourBucket,
  getWorldPickupHourStartMs,
} from "./worldPickups";

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const MINUTE_MS = 60_000;
/** Banner opens at KST :30 every hour (e.g. 12:30–13:00). */
export const HOURLY_AD_WINDOW_OFFSET_MS = 30 * MINUTE_MS;
/** Banner stays visible for 30 minutes after the :30 open. */
export const HOURLY_AD_BANNER_MS = 30 * MINUTE_MS;
/** Ad watch gate before claim is enabled. */
export const HOURLY_AD_WATCH_SEC = 10;
/** Slot reel decelerates to a stop over this duration when not interrupted. */
export const HOURLY_AD_SLOT_DECAY_MS = 5_800;

export const HOURLY_AD_EVENT_PREFIX = "hourly-ad:";

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

export const HOURLY_AD_REWARD_POOL: readonly HourlyAdRewardPoolEntry[] = [
  {
    kind: "stars",
    label: "스타",
    icon: "/images/star-currency.svg",
    fixedAmount: null,
    min: 100,
    max: 300,
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
    fixedAmount: 5,
  },
  {
    kind: "dumpPoints",
    label: "흙 하역장 포인트",
    icon: "/images/yanmar/2d/workshop-coin-dump.svg",
    fixedAmount: null,
    min: 100,
    max: 300,
  },
  {
    kind: "crashPoints",
    label: "파쇄 작업장 포인트",
    icon: "/images/yanmar/2d/workshop-coin-crash.svg",
    fixedAmount: null,
    min: 100,
    max: 300,
  },
  {
    kind: "hillPoints",
    label: "돌 하역장 포인트",
    icon: "/images/yanmar/2d/workshop-coin-hill.svg",
    fixedAmount: null,
    min: 100,
    max: 300,
  },
  {
    kind: "monumentPoints",
    label: "조형물 포인트",
    icon: "/images/yanmar/2d/workshop-coin-monument.svg",
    fixedAmount: null,
    min: 100,
    max: 300,
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

/** KST wall-clock :30 of the given hour bucket (UTC epoch ms). */
export function getHourlyAdWindowStartMs(hourBucket: number) {
  return getHourlyAdHourStartMs(hourBucket) + HOURLY_AD_WINDOW_OFFSET_MS;
}

export function makeHourlyAdEventId(hourBucket: number) {
  return `${HOURLY_AD_EVENT_PREFIX}${hourBucket}`;
}

export function parseHourlyAdEventBucket(eventId: string): number | null {
  if (!eventId.startsWith(HOURLY_AD_EVENT_PREFIX)) return null;
  const raw = eventId.slice(HOURLY_AD_EVENT_PREFIX.length);
  const bucket = Number(raw);
  return Number.isInteger(bucket) && bucket > 0 ? bucket : null;
}

/** Remaining ms until the teaser banner expires (0 if outside :30–:00 KST). */
export function getHourlyAdBannerRemainingMs(now = Date.now()) {
  const bucket = getHourlyAdHourBucket(now);
  const start = getHourlyAdWindowStartMs(bucket);
  const elapsed = now - start;
  if (elapsed < 0 || elapsed >= HOURLY_AD_BANNER_MS) return 0;
  return HOURLY_AD_BANNER_MS - elapsed;
}

/**
 * Claim is allowed while the banner window is open (KST :30–:00).
 * Rejects requests before :30 or after the hour rolls over.
 */
export function isHourlyAdClaimOpen(now = Date.now()) {
  return getHourlyAdBannerRemainingMs(now) > 0;
}

export function formatMmSs(totalSec: number) {
  const sec = Math.max(0, Math.ceil(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** True if reward was claimed or the ad was dismissed this hour. */
export function wasHourlyAdClaimedLocally(hourBucket: number) {
  try {
    return (
      window.localStorage.getItem(`${CLAIMED_STORAGE_PREFIX}${hourBucket}`) ===
      "1"
    );
  } catch {
    return false;
  }
}

/** Hide the teaser for this hour (after claim or dismiss-without-reward). */
export function markHourlyAdClaimedLocally(hourBucket: number) {
  try {
    window.localStorage.setItem(`${CLAIMED_STORAGE_PREFIX}${hourBucket}`, "1");
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
  result: HourlyAdClaimResult,
) {
  markHourlyAdClaimedLocally(hourBucket);
  try {
    window.localStorage.setItem(
      `${GRANT_STORAGE_PREFIX}${hourBucket}`,
      JSON.stringify({
        eventId: result.eventId,
        reward: result.reward,
        currency: result.currency,
        gachaTicketsStandard: result.gachaTicketsStandard,
        gachaTicketsPremium: result.gachaTicketsPremium,
        dumpWorkshopPoints: result.dumpWorkshopPoints,
        crashWorkshopPoints: result.crashWorkshopPoints,
        hillWorkshopPoints: result.hillWorkshopPoints,
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
): HourlyAdClaimResult | null {
  try {
    const raw = window.localStorage.getItem(
      `${GRANT_STORAGE_PREFIX}${hourBucket}`,
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HourlyAdClaimResult;
    if (!parsed?.reward?.kind || typeof parsed.reward.amount !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function rollHourlyAdReward(): HourlyAdReward {
  const entry =
    HOURLY_AD_REWARD_POOL[
      Math.floor(Math.random() * HOURLY_AD_REWARD_POOL.length)
    ]!;
  const amount =
    entry.fixedAmount ??
    randomInt(entry.min ?? 100, entry.max ?? 300);
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
  monumentPoints?: number;
};
