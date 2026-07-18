/** Cost to reach level N (index 0 = +1). Shared by all max-10 workshop upgrades. */
export const WORKSHOP_UPGRADE_COSTS_MAX10 = [
  20, 35, 55, 85, 130, 200, 310, 480, 740, 1150,
] as const;

/** Rock appraiser max-5 curve — feels like +3/+6/+8/+9/+10 of the max10 curve. */
export const ROCK_APPRAISER_COSTS = [55, 200, 480, 740, 1150] as const;

export const WORKSHOP_SHOP_WEEKLY_LIMIT = 3;

export const WORKSHOP_SHOP_PRICES = {
  ticket_standard: 280,
  ticket_premium: 750,
  enhance_core: 200,
} as const;

/** KST Monday date key `YYYY-MM-DD` for the week containing `now`. */
export function getWorkshopWeekKey(now = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay(); // 0=Sun … 6=Sat in KST wall clock via UTC getters
  const daysFromMonday = (day + 6) % 7;
  const monday = new Date(
    Date.UTC(
      kst.getUTCFullYear(),
      kst.getUTCMonth(),
      kst.getUTCDate() - daysFromMonday,
    ),
  );
  const y = monday.getUTCFullYear();
  const m = String(monday.getUTCMonth() + 1).padStart(2, "0");
  const d = String(monday.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getWorkshopUpgradeCost(
  upgradeKey: string,
  currentLevel: number,
): number | null {
  if (upgradeKey === "rock_appraiser") {
    if (currentLevel < 0 || currentLevel >= ROCK_APPRAISER_COSTS.length) {
      return null;
    }
    return ROCK_APPRAISER_COSTS[currentLevel]!;
  }
  if (currentLevel < 0 || currentLevel >= WORKSHOP_UPGRADE_COSTS_MAX10.length) {
    return null;
  }
  return WORKSHOP_UPGRADE_COSTS_MAX10[currentLevel]!;
}

export function getWorkshopUpgradeMaxLevel(upgradeKey: string): number {
  return upgradeKey === "rock_appraiser" ? 5 : 10;
}
