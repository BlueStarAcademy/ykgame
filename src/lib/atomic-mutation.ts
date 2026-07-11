/** True only when a conditional database mutation acquired one logical row. */
export function mutatedExactlyOne(count: number): boolean {
  return count === 1;
}
