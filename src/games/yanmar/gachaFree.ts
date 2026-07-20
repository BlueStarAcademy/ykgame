/** KST 일일 무료 뽑기 */

export const GACHA_FREE_STANDARD_PER_DAY = 3;
export const GACHA_FREE_PREMIUM_PER_DAY = 1;
/** 일반 무료 뽑기 사이 쿨타임 (초) */
export const GACHA_FREE_STANDARD_COOLDOWN_SEC = 300;

export type GachaFreeBanner = "STANDARD" | "PREMIUM";

export type GachaFreeUserFields = {
  gachaFreeDayKey: string | null;
  gachaFreeStandardUsed: number;
  gachaFreePremiumUsed: number;
  gachaFreeStandardCooldownAt: Date | null;
};

export type GachaFreeStatus = {
  dayKey: string;
  standard: {
    limit: number;
    used: number;
    remaining: number;
    cooldownRemainingMs: number;
    available: boolean;
  };
  premium: {
    limit: number;
    used: number;
    remaining: number;
    available: boolean;
  };
};

/** Asia/Seoul 기준 날짜 키 (YYYY-MM-DD) */
export function getGachaFreeDayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** 다음 무료 뽑기 초기화(KST 자정)까지 남은 ms */
export function getMsUntilNextGachaFreeReset(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = kst.getUTCFullYear();
  const month = kst.getUTCMonth();
  const day = kst.getUTCDate();
  const nextMidnightUtc =
    Date.UTC(year, month, day + 1, 0, 0, 0, 0) - 9 * 60 * 60 * 1000;
  return Math.max(0, nextMidnightUtc - now.getTime());
}

function clampUsed(value: number, limit: number) {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(limit, Math.floor(value));
}

export function resolveGachaFreeCounters(
  fields: GachaFreeUserFields,
  now = new Date(),
): {
  dayKey: string;
  standardUsed: number;
  premiumUsed: number;
  cooldownAt: Date | null;
  dayRolled: boolean;
} {
  const dayKey = getGachaFreeDayKey(now);
  const dayRolled = fields.gachaFreeDayKey !== dayKey;
  if (dayRolled) {
    return {
      dayKey,
      standardUsed: 0,
      premiumUsed: 0,
      cooldownAt: null,
      dayRolled: true,
    };
  }
  return {
    dayKey,
    standardUsed: clampUsed(
      fields.gachaFreeStandardUsed,
      GACHA_FREE_STANDARD_PER_DAY,
    ),
    premiumUsed: clampUsed(
      fields.gachaFreePremiumUsed,
      GACHA_FREE_PREMIUM_PER_DAY,
    ),
    cooldownAt: fields.gachaFreeStandardCooldownAt,
    dayRolled: false,
  };
}

export function buildGachaFreeStatus(
  fields: GachaFreeUserFields,
  now = new Date(),
): GachaFreeStatus {
  const resolved = resolveGachaFreeCounters(fields, now);
  const stdRemaining = Math.max(
    0,
    GACHA_FREE_STANDARD_PER_DAY - resolved.standardUsed,
  );
  const premRemaining = Math.max(
    0,
    GACHA_FREE_PREMIUM_PER_DAY - resolved.premiumUsed,
  );
  const cooldownRemainingMs =
    resolved.cooldownAt && stdRemaining > 0
      ? Math.max(0, resolved.cooldownAt.getTime() - now.getTime())
      : 0;

  return {
    dayKey: resolved.dayKey,
    standard: {
      limit: GACHA_FREE_STANDARD_PER_DAY,
      used: resolved.standardUsed,
      remaining: stdRemaining,
      cooldownRemainingMs,
      available: stdRemaining > 0 && cooldownRemainingMs <= 0,
    },
    premium: {
      limit: GACHA_FREE_PREMIUM_PER_DAY,
      used: resolved.premiumUsed,
      remaining: premRemaining,
      available: premRemaining > 0,
    },
  };
}

/**
 * 캐시된 무료 상태가 전날이면 당일 잔여로 다시 계산한다.
 * (접속 유지 중 0시가 지나도 UI가 즉시 갱신되도록)
 */
export function withGachaFreeDayRollover(
  status: GachaFreeStatus,
  now = new Date(),
): GachaFreeStatus {
  if (status.dayKey === getGachaFreeDayKey(now)) return status;
  return buildGachaFreeStatus(
    {
      gachaFreeDayKey: null,
      gachaFreeStandardUsed: 0,
      gachaFreePremiumUsed: 0,
      gachaFreeStandardCooldownAt: null,
    },
    now,
  );
}

export const GACHA_FREE_USER_SELECT = {
  gachaFreeDayKey: true,
  gachaFreeStandardUsed: true,
  gachaFreePremiumUsed: true,
  gachaFreeStandardCooldownAt: true,
} as const;
