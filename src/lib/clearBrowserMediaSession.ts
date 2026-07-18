/** Drop OS / browser media-session chrome so game audio is not a "media player". */

const MEDIA_ACTIONS = [
  "play",
  "pause",
  "stop",
  "seekbackward",
  "seekforward",
  "seekto",
  "previoustrack",
  "nexttrack",
  "skipad",
] as const;

export function clearBrowserMediaSession() {
  if (typeof navigator === "undefined") return;
  const ms = navigator.mediaSession;
  if (!ms) return;
  try {
    ms.metadata = null;
  } catch {
    // ignore
  }
  try {
    ms.playbackState = "none";
  } catch {
    // ignore
  }
  for (const action of MEDIA_ACTIONS) {
    try {
      ms.setActionHandler(action, null);
    } catch {
      // unsupported action
    }
  }
}
