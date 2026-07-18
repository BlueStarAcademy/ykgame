/**
 * 퀘스트 진행도 UI 표시값.
 * 주행거리(소수 m 누적)를 포함해 진행 숫자는 정수로만 보여준다.
 */
export function formatQuestProgressCurrent(
  progress: number,
  target: number,
  _metric?: string,
): number {
  const capped = Math.min(Math.max(0, progress), Math.max(0, target));
  return Math.floor(capped);
}
