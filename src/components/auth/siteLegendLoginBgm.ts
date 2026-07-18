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
  getSiteLegendBgmPlayGen,
  isSiteLegendBgmMasterEnabled,
  killLoginSiteLegendBgm,
  setSharedLoginBgmAudio,
  silenceHtmlAudio,
  trackSiteLegendBgm,
} from "@/lib/siteLegendBgmRegistry";

const LOGIN_BGM_SRC = "/sounds/site-legend/login-bgm.ogg";

const GLOBAL_CTRL = "__ykSiteLegendLoginBgmCtrl";
const GLOBAL_GESTURE = "__ykSiteLegendLoginBgmGesture";
const GLOBAL_UNSUB = "__ykSiteLegendLoginBgmUnsub";

type GlobalBag = typeof globalThis & {
  [GLOBAL_CTRL]?: SiteLegendLoginBgmController;
  [GLOBAL_GESTURE]?: () => void;
  [GLOBAL_UNSUB]?: () => void;
};

function bag(): GlobalBag {
  return globalThis as GlobalBag;
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

function wantsLoginBgm(allowed: boolean, enabled: boolean) {
  return (
    allowed &&
    enabled &&
    isSiteLegendBgmMasterEnabled() &&
    !isPageAudioSealed()
  );
}

// Fast Refresh: drop gesture + old store subscription, replace controller.
if (typeof window !== "undefined") {
  detachGestureHandler();
  killLoginSiteLegendBgm({ unload: true });
  bag()[GLOBAL_UNSUB]?.();
  delete bag()[GLOBAL_UNSUB];
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
      const unsub = subscribeSoundSettings((settings) => {
        this.applySettings(settings);
      });
      bag()[GLOBAL_UNSUB]?.();
      bag()[GLOBAL_UNSUB] = unsub;
    } else {
      this.applySettings(getSoundSettings());
    }
  }

  private bindLifecycle() {
    if (this.lifecycleBound) return;
    this.lifecycleBound = true;
    registerPageAudioHooks("site-legend-login-bgm", {
      pause: () => {
        detachGestureHandler();
        killLoginSiteLegendBgm({ unload: false });
        this.audio = getSharedLoginBgmAudio();
      },
      resume: () => {
        if (isPageAudioSealed()) return;
        if (document.visibilityState !== "visible") return;
        this.sync();
      },
      exit: () => {
        detachGestureHandler();
        this.audio = null;
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
    if (!this.enabled || !isSiteLegendBgmMasterEnabled()) {
      detachGestureHandler();
      killLoginSiteLegendBgm({ unload: true });
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
      return;
    }

    if (!wantsLoginBgm(this.allowed, this.enabled)) {
      detachGestureHandler();
      // Only touch login BGM — do not nuke in-game when leaving the title screen.
      killLoginSiteLegendBgm({ unload: true });
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
    if (!wantsLoginBgm(this.allowed, this.enabled)) {
      killLoginSiteLegendBgm({ unload: false });
      return;
    }

    const audio = this.ensureAudio();
    if (!audio) return;

    const gen = getSiteLegendBgmPlayGen();
    audio.muted = false;
    audio.volume = this.volume;

    void audio
      .play()
      .then(() => {
        if (
          gen !== getSiteLegendBgmPlayGen() ||
          !wantsLoginBgm(this.allowed, this.enabled)
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
    if (!wantsLoginBgm(this.allowed, this.enabled)) return;
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
