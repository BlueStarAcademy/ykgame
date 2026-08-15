/** Shared slot-reel spin for hourly ads and maintenance bonus. */

export function spinEase(t: number) {
  const clamped = Math.min(1, Math.max(0, t));
  const quint = 1 - (1 - clamped) ** 5;
  const expo = clamped === 1 ? 1 : 1 - 2 ** (-10 * clamped);
  return quint * 0.72 + expo * 0.28;
}

export function runRewardReelSpin(options: {
  getItemHeight: () => number;
  stopIndex: number;
  durationMs: number;
  spinningRef: { current: boolean };
  stopRequestedRef: { current: boolean };
  rafRef: { current: number };
  applyOffset: (px: number) => void;
  onDone: () => void;
}) {
  const {
    getItemHeight,
    stopIndex,
    durationMs,
    spinningRef,
    stopRequestedRef,
    rafRef,
    applyOffset,
    onDone,
  } = options;

  spinningRef.current = true;
  stopRequestedRef.current = false;
  let fromOffset = 0;
  let segmentStart = 0;
  let segmentDuration = durationMs;
  let finishing = false;
  let started = false;

  const endOffsetNow = () => stopIndex * Math.max(1, getItemHeight());

  const frame = (now: number) => {
    if (!spinningRef.current) return;

    if (!started) {
      if (getItemHeight() < 1) {
        rafRef.current = requestAnimationFrame(frame);
        return;
      }
      started = true;
      segmentStart = now;
      fromOffset = 0;
      applyOffset(0);
    }

    const endOffset = endOffsetNow();

    if (!finishing && stopRequestedRef.current) {
      finishing = true;
      const progress = Math.min(1, (now - segmentStart) / segmentDuration);
      fromOffset = fromOffset + (endOffset - fromOffset) * spinEase(progress);
      segmentStart = now;
      const remain = 1 - progress;
      segmentDuration = Math.min(1600, Math.max(900, remain * 1800));
    }

    const t = Math.min(1, (now - segmentStart) / segmentDuration);
    const offset = fromOffset + (endOffset - fromOffset) * spinEase(t);
    applyOffset(offset);

    if (t >= 1) {
      spinningRef.current = false;
      applyOffset(endOffset);
      onDone();
      return;
    }

    rafRef.current = requestAnimationFrame(frame);
  };

  rafRef.current = requestAnimationFrame(frame);
}
