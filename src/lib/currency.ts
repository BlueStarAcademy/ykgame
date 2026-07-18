/** Soft cap on holdable stars (user.currency). */
export const MAX_USER_CURRENCY = 1_000_000;

export function clampUserCurrency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_USER_CURRENCY, Math.floor(value)));
}

/**
 * Apply a star grant under the hold cap.
 * @returns next balance and how many stars were actually added
 */
export function cappedCurrencyIncrement(
  current: number,
  amount: number,
): { next: number; granted: number } {
  const cur = clampUserCurrency(current);
  const add = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  const next = clampUserCurrency(cur + add);
  return { next, granted: next - cur };
}
