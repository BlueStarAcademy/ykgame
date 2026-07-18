/**
 * Singleton login/title BGM — one shared Audio across HMR/remounts.
 * Driven by the shared sound settings store + screen `allowed` flag.
 */

import {
  getSoundSettings,
  subscribeSoundSettings,
} from "@/games/yanmar/soundSettingsStore";
import { bgmVolumeToGain, type SoundSettings } from "@/games/yanmar/soundSettings";
import {
  isPageAudioSealed,
  registerPageAudioHooks,
} from "@/lib/pageAudioLifecycle";
import {
  getSharedLoginBgmAudio,
  killAllSiteLegendBgms,
  setSharedLoginBgmAudio,
  silenceHtmlAudio,
  trackSiteLegendBgm,
} from "@/lib/siteLegendBgmRegistry";

const LOGIN_BGM_SRC = "/sounds/site-legend/login-bgm.ogg";

const GLOBAL_CTRL = "__ykSiteLegendLoginBgmCtrl";
const GLOBAL_SHOULD_PLAY = "__ykSiteLegendLoginBgmShouldPlay";
const GLOBAL_GESTURE = "__ykSiteLegendLoginBgmGesture";
const GLOBAL_PLAY_GEN = "__ykSiteLegendLoginBgmPlayGen";

type GlobalBag = typeof globalThis & {
  [GLOBAL_CTRL]?: SiteLegendLoginBgmController;
  [GLOBAL_SHOULD_PLAY]?: boolean;
  [GLOBAL_GESTURE]?: () => void;
  [GLOBAL_PLAY_GEN]?: number;
};

function bag(): GlobalBag {
  return globalThis as GlobalBag;
}

function bumpPlayGen() {
  const g = bag();
  g[GLOBAL_PLAY_GEN] = (g[GLOBAL_PLAY_GEN] ?? 0) + 1;
  return g[GLOBAL_PLAY_GEN];
}

function currentPlayGen() {
  return bag()[GLOBAL_PLAY_GEN] ?? 0;
}

function setShouldPlay(value: boolean) {
  bag()[GLOBAL_SHOULD_PLAY] = value;
}

function getShouldPlay() {
  return bag()[GLOBAL_SHOULD_PLAY] === true;
}

function detachGestureHandler() {
  if (typeof window === "undefined") return;
  const g = bag();
  const handler = g[GLOBAL_GESTURE];
  if (!handler) return;
  window.removeEventListener("pointerdown", handler);
  window.removeEventListener("keydown", handler);
  g[GLOBAL_GESTURE] = undefined;
}

// Fast Refresh: seal + kill orphans, replace controller.
if (typeof window !== "undefined") {
  detachGestureHandler();
  killAllSiteLegendBgms({ unload: true });
  setShouldPlay(false);
  delete bag()[GLOBAL_CTRL];
}

class SiteLegendLoginBgmController {
  private audio: HTMLAudioElement | null = null;
  private enabled = false;
  private volume = bgmVolumeToGain(28);
  private allowed = false;
  private storeBound = false;
  private lifecycleBound = false;

  start() {
    if (typeof window === "undefined") return;

    this.bindLifecycle();

    if (!this.storeBound) {
      this.storeBound = true;
      this.applySettings(getSoundSettings());
      subscribeSoundSettings((settings) => {
        this.applySettings(settings);
      });
    } else {
      this.applySettings(getSoundSettings());
    }
  }

  private bindLifecycle() {
    if (this.lifecycleBound) return;
    this.lifecycleBound = true;
    registerPageAudioHooks("site-legend-login-bgm", {
      pause: () => {
        bumpPlayGen();
        setShouldPlay(false);
        detachGestureHandler();
        killAllSiteLegendBgms({ unload: false });
        this.audio = getSharedLoginBgmAudio();
      },
      resume: () => {
        if (isPageAudioSealed()) return;
        if (document.visibilityState !== "visible") return;
        this.sync();
      },
      exit: () => {
        bumpPlayGen();
        setShouldPlay(false);
        detachGestureHandler();
        this.audio = null;
        // page lifecycle already killAll's; keep local pointer clear.
      },
    });
  }

  setAllowed(allowed: boolean) {
    this.allowed = allowed;
    this.sync();
  }

  handleGesture() {
    if (isPageAudioSealed()) return;
    this.tryPlay();
  }

  private applySettings(settings: SoundSettings) {
    this.enabled = settings.bgmEnabled;
    this.volume = bgmVolumeToGain(settings.bgmVolume);
    if (!this.enabled) {
      bumpPlayGen();
      setShouldPlay(false);
      detachGestureHandler();
      // Store already killAll's on Off; keep local state consistent.
      this.audio = null;
      return;
    }
    if (this.audio && this.allowed) {
      this.audio.muted = false;
      this.audio.volume = this.volume;
    }
    this.sync();
  }

  private sync() {
    if (typeof window === "undefined") return;
    if (isPageAudioSealed()) {
      setShouldPlay(false);
      return;
    }

    const shouldPlay = this.allowed && this.enabled;
    setShouldPlay(shouldPlay);

    if (!shouldPlay) {
      bumpPlayGen();
      detachGestureHandler();
      killAllSiteLegendBgms({ unload: true });
      this.audio = null;
      return;
    }

    this.ensureAudio();
    this.bindGesture();
    this.tryPlay();
  }

  private ensureAudio() {
    if (typeof window === "undefined") return null;

    const existing = getSharedLoginBgmAudio();
    if (existing?.src) {
      this.audio = existing;
      trackSiteLegendBgm(existing);
      return existing;
    }
    if (existing) setSharedLoginBgmAudio(null);

    if (this.audio?.src) {
      setSharedLoginBgmAudio(this.audio);
      return this.audio;
    }

    const audio = new Audio(LOGIN_BGM_SRC);
    audio.loop = true;
    audio.preload = "auto";
    audio.muted = true;
    audio.volume = 0;
    this.audio = audio;
    setSharedLoginBgmAudio(audio);
    return audio;
  }

  private tryPlay() {
    if (
      isPageAudioSealed() ||
      !getShouldPlay() ||
      !(this.allowed && this.enabled)
    ) {
      bumpPlayGen();
      setShouldPlay(false);
      killAllSiteLegendBgms({ unload: false });
      return;
    }

    const audio = this.ensureAudio();
    if (!audio) return;

    const gen = currentPlayGen();
    audio.muted = false;
    audio.volume = this.volume;

    void audio
      .play()
      .then(() => {
        if (
          gen !== currentPlayGen() ||
          !getShouldPlay() ||
          isPageAudioSealed()
        ) {
          silenceHtmlAudio(audio);
          return;
        }
        detachGestureHandler();
      })
      .catch(() => {
        /* autoplay blocked until gesture */
      });
  }

  private bindGesture() {
    if (typeof window === "undefined") return;
    const g = bag();
    if (g[GLOBAL_GESTURE]) return;

    const handler = () => {
      getController().handleGesture();
    };
    g[GLOBAL_GESTURE] = handler;
    window.addEventListener("pointerdown", handler, { passive: true });
    window.addEventListener("keydown", handler);
  }
}

function getController(): SiteLegendLoginBgmController {
  const g = bag();
  if (!g[GLOBAL_CTRL]) {
    g[GLOBAL_CTRL] = new SiteLegendLoginBgmController();
  }
  return g[GLOBAL_CTRL];
}

export const siteLegendLoginBgm = getController();
