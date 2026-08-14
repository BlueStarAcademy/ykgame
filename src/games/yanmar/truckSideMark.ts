/**
 * Truck bed side-panel branding band.
 *
 * Both trucks stiffen the bed sides with vertical ribs that stand further out
 * than the painted YK건기 wordmark, so a rib crossing the mark hides it.
 * Ribs inside the band are split into stubs above / below it, leaving a clean
 * painted area while the panel still reads as ribbed.
 */

export type SideMarkBand = {
  /** Mark centre in panel local space. */
  x: number;
  y: number;
  /** Keep-out half extents (mark half size + clearance). */
  clearX: number;
  clearY: number;
};

export type RibSegment = {
  /** Centre offset along the rib axis. */
  along: number;
  length: number;
  /** Untouched rib — safe to carry rib details like accent strips. */
  full: boolean;
};

/** Stubs shorter than this read as specks rather than ribs. */
const MIN_STUB_LENGTH = 0.14;

/**
 * Rib pieces for a rib centred at `x`, measured along the (tilted) rib axis.
 * Returns a single full-length piece when the rib clears the mark.
 */
export function ribSegmentsAroundMark(
  x: number,
  band: SideMarkBand,
  halfLength: number,
  minStub: number = MIN_STUB_LENGTH,
): RibSegment[] {
  if (Math.abs(x - band.x) >= band.clearX) {
    return [{ along: 0, length: halfLength * 2, full: true }];
  }

  const segments: RibSegment[] = [];
  const bandTop = band.y + band.clearY;
  const bandBottom = band.y - band.clearY;

  const topLength = halfLength - bandTop;
  if (topLength > minStub) {
    segments.push({
      along: (halfLength + bandTop) / 2,
      length: topLength,
      full: false,
    });
  }

  const bottomLength = bandBottom + halfLength;
  if (bottomLength > minStub) {
    segments.push({
      along: (bandBottom - halfLength) / 2,
      length: bottomLength,
      full: false,
    });
  }

  return segments;
}

/**
 * Rib piece position in panel local space.
 * A rib tilted by `tilt` about Z keeps its axis, so the stub centre shifts
 * along that rotated axis rather than straight up.
 */
export function ribSegmentOffset(
  x: number,
  along: number,
  tilt: number,
): [number, number] {
  return [x - Math.sin(tilt) * along, Math.cos(tilt) * along];
}
