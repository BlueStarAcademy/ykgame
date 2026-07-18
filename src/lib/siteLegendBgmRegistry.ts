/**
 * Tracks every Site Legend looping BGM Audio element so Off / page-exit
 * can silence HMR orphans that no longer have a live controller.
 */

const REGISTRY_KEY = "__ykSiteLegendBgmAudioRegistry";
const INGAME_KEY = "__ykSiteLegendIngameBgmAudio";
const LOGIN_KEY = "__ykSiteLegendLoginBgmAudio";

type GlobalBag = typeof globalThis & {
  [REGISTRY_KEY]?: Set<HTMLAudioElement>;
  [INGAME_KEY]?: HTMLAudioElement | null;
  [LOGIN_KEY]?: HTMLAudioElement | null;
};

function bag(): GlobalBag {
  return globalThis as GlobalBag;
}

function registry(): Set<HTMLAudioElement> {
  const g = bag();
  if (!g[REGISTRY_KEY]) g[REGISTRY_KEY] = new Set();
  return g[REGISTRY_KEY];
}

export function silenceHtmlAudio(audio: HTMLAudioElement) {
  try {
    audio.pause();
  } catch {
    // ignore
  }
  try {
    audio.currentTime = 0;
  } catch {
    // ignore
  }
  audio.muted = true;
  audio.volume = 0;
}

export function unloadHtmlAudio(audio: HTMLAudioElement) {
  silenceHtmlAudio(audio);
  try {
    audio.removeAttribute("src");
    audio.load();
  } catch {
    // ignore
  }
}

export function trackSiteLegendBgm(audio: HTMLAudioElement) {
  registry().add(audio);
}

export function untrackSiteLegendBgm(audio: HTMLAudioElement) {
  registry().delete(audio);
}

export function setSharedLoginBgmAudio(audio: HTMLAudioElement | null) {
  bag()[LOGIN_KEY] = audio;
  if (audio) trackSiteLegendBgm(audio);
}

export function getSharedLoginBgmAudio(): HTMLAudioElement | null {
  return bag()[LOGIN_KEY] ?? null;
}

export function setSharedIngameBgmAudio(audio: HTMLAudioElement | null) {
  bag()[INGAME_KEY] = audio;
  if (audio) trackSiteLegendBgm(audio);
}

export function getSharedIngameBgmAudio(): HTMLAudioElement | null {
  return bag()[INGAME_KEY] ?? null;
}

/** Hard-stop every known Site Legend BGM element (login + in-game + orphans). */
export function killAllSiteLegendBgms(opts?: { unload?: boolean }) {
  if (typeof window === "undefined") return;
  const unload = opts?.unload !== false;
  const kill = unload ? unloadHtmlAudio : silenceHtmlAudio;

  for (const audio of [...registry()]) {
    kill(audio);
    if (unload) registry().delete(audio);
  }

  const login = bag()[LOGIN_KEY];
  if (login) {
    kill(login);
    if (unload) bag()[LOGIN_KEY] = null;
  }

  const ingame = bag()[INGAME_KEY];
  if (ingame) {
    kill(ingame);
    if (unload) bag()[INGAME_KEY] = null;
  }
}
