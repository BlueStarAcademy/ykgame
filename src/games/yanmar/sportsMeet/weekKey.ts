import { getWorkshopWeekKey } from "../workshop/economy";

/** Re-export KST Monday week key. */
export { getWorkshopWeekKey as getSportsMeetWeekKey };

/** Previous Monday week key (7 days before current weekKey Monday). */
export function getPreviousSportsMeetWeekKey(now = new Date()): string {
  const current = getWorkshopWeekKey(now);
  const [y, m, d] = current.split("-").map(Number);
  const mondayUtc = Date.UTC(y, m - 1, d) - 7 * 24 * 60 * 60 * 1000;
  const prev = new Date(mondayUtc);
  const yy = prev.getUTCFullYear();
  const mm = String(prev.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(prev.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Week index from a Monday weekKey — stable across clients. */
export function weekIndexFromWeekKey(weekKey: string): number {
  const [y, m, d] = weekKey.split("-").map(Number);
  if (![y, m, d].every((n) => Number.isFinite(n))) return 0;
  const mondayUtcMs = Date.UTC(y, m - 1, d);
  // 1970-01-05 was a Monday UTC; align so indices stay non-negative.
  const epochMonday = Date.UTC(1970, 0, 5);
  return Math.floor((mondayUtcMs - epochMonday) / (7 * 24 * 60 * 60 * 1000));
}

export function getSportsMeetDayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function getMsUntilNextSportsMeetDayReset(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = kst.getUTCFullYear();
  const month = kst.getUTCMonth();
  const day = kst.getUTCDate();
  const nextMidnightUtc =
    Date.UTC(year, month, day + 1, 0, 0, 0, 0) - 9 * 60 * 60 * 1000;
  return Math.max(0, nextMidnightUtc - now.getTime());
}
