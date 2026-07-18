/**
 * Tracks every Site Legend looping BGM Audio element so Off / page-exit
 * can silence HMR orphans that no longer have a live controller.
 *
 * Also owns a master on/off gate + play generation so in-flight `audio.play()`
 * promises cannot resurrect BGM after the user turns it off (pause during a
 * pending play is ignored by some browsers until play resolves).
 *
 * Preferred BGM path is Web Audio (`siteLegendWebAudioBgm`) so playback does
 * not appear in the OS media player; HTMLAudioElement kill remains for orphans.
 */

import { clearBrowserMediaSession } from "@/lib/clearBrowserMediaSession";
import {
  stopAllWebAudioBgms,
  stopWebAudioBgm,
} from "@/lib/siteLegendWebAudioBgm";

const REGISTRY_KEY = "__ykSiteLegendBgmAudioRegistry";
const INGAME_KEY = "__ykSiteLegendIngameBgmAudio";
const LOGIN_KEY = "__ykSiteLegendLoginBgmAudio";
const MASTER_KEY = "__ykSiteLegendBgmMasterEnabled";
const PLAY_GEN_KEY = "__ykSiteLegendBgmPlayGen";

type GlobalBag = typeof globalThis & {
  [REGISTRY_KEY]?: Set<HTMLAudioElement>;
  [INGAME_KEY]?: HTMLAudioElement | null;
  [LOGIN_KEY]?: HTMLAudioElement | null;
  [MASTER_KEY]?: boolean;
  [PLAY_GEN_KEY]?: number;
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

/** Latest settings-backed master gate (true only after settings say On). */
export function isSiteLegendBgmMasterEnabled(): boolean {
  return bag()[MASTER_KEY] === true;
}

export function getSiteLegendBgmPlayGen(): number {
  return bag()[PLAY_GEN_KEY] ?? 0;
}

/**
 * Sync the master gate from sound settings. When Off, bumps play gen so
 * in-flight play() callbacks abort even if pause() during pending play is ignored.
 */
export function setSiteLegendBgmMasterEnabled(enabled: boolean) {
  const g = bag();
  g[MASTER_KEY] = enabled;
  if (!enabled) {
    g[PLAY_GEN_KEY] = (g[PLAY_GEN_KEY] ?? 0) + 1;
  }
}

/** Hard-stop every known Site Legend BGM element (login + in-game + orphans). */
export function killAllSiteLegendBgms(opts?: { unload?: boolean }) {
  if (typeof window === "undefined") return;
  const unload = opts?.unload !== false;
  const kill = unload ? unloadHtmlAudio : silenceHtmlAudio;

  stopAllWebAudioBgms({ disposeContext: unload });

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

  clearBrowserMediaSession();
}

/** Stop only the login/title BGM (leave in-game alone). */
export function killLoginSiteLegendBgm(opts?: { unload?: boolean }) {
  if (typeof window === "undefined") return;
  const unload = opts?.unload !== false;
  const kill = unload ? unloadHtmlAudio : silenceHtmlAudio;

  stopWebAudioBgm("login", unload);

  const login = bag()[LOGIN_KEY];
  if (login) {
    kill(login);
    if (unload) {
      registry().delete(login);
      bag()[LOGIN_KEY] = null;
    }
  }
  clearBrowserMediaSession();
}
