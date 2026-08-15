/**
 * Singleton login/title BGM — Web Audio loop (not OS media player).
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
  getSiteLegendBgmPlayGen,
  isSiteLegendBgmMasterEnabled,
  killLoginSiteLegendBgm,
} from "@/lib/siteLegendBgmRegistry";
import {
  isWebAudioBgmPlaying,
  preloadWebAudioBgm,
  primeWebAudioBgmContext,
  setWebAudioBgmGain,
  startWebAudioBgm,
  stopWebAudioBgm,
  suspendWebAudioBgmContext,
} from "@/lib/siteLegendWebAudioBgm";
import { clearBrowserMediaSession } from "@/lib/clearBrowserMediaSession";

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
  window.removeEventListener("pointerdown", handler, { capture: true });
  window.removeEventListener("keydown", handler, { capture: true });
  // Legacy non-capture bindings from older builds.
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
  private enabled = false;
  private volume = bgmVolumeToGain(28);
  private allowed = false;
  private storeBound = false;
  private lifecycleBound = false;
  private startToken = 0;
  /** Set after a user gesture so later sync can resume without waiting again. */
  private gestureUnlocked = false;

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

    void preloadWebAudioBgm("login", LOGIN_BGM_SRC);
    this.sync();
  }

  private bindLifecycle() {
    if (this.lifecycleBound) return;
    this.lifecycleBound = true;
    registerPageAudioHooks("site-legend-login-bgm", {
      pause: () => {
        detachGestureHandler();
        killLoginSiteLegendBgm({ unload: false });
        void suspendWebAudioBgmContext("login");
      },
      resume: () => {
        if (isPageAudioSealed()) return;
        if (document.visibilityState !== "visible") return;
        this.sync();
      },
      exit: () => {
        detachGestureHandler();
        this.startToken += 1;
        this.gestureUnlocked = false;
        stopWebAudioBgm("login", true);
        clearBrowserMediaSession();
      },
    });
  }

  setAllowed(allowed: boolean) {
    this.allowed = allowed;
    if (allowed) {
      void preloadWebAudioBgm("login", LOGIN_BGM_SRC);
    }
    this.sync();
  }

  /** Call from CTA clicks so login BGM starts on the same gesture. */
  handleGesture() {
    if (isPageAudioSealed()) return;
    this.gestureUnlocked = true;
    // Resume on the gesture stack before any async decode/start.
    primeWebAudioBgmContext("login");
    this.tryPlay();
  }

  private applySettings(settings: SoundSettings) {
    const prevEnabled = this.enabled;
    const prevVolume = this.volume;
    this.enabled = settings.bgmEnabled;
    this.volume = bgmVolumeToGain(settings.bgmVolume);
    if (!this.enabled || !isSiteLegendBgmMasterEnabled()) {
      detachGestureHandler();
      if (prevEnabled) killLoginSiteLegendBgm({ unload: true });
      return;
    }
    if (prevVolume !== this.volume && isWebAudioBgmPlaying("login")) {
      setWebAudioBgmGain("login", this.volume);
    }
    // Volume-only changes: do not restart the loop.
    if (prevEnabled === this.enabled && prevVolume !== this.volume) {
      if (isWebAudioBgmPlaying("login")) {
        setWebAudioBgmGain("login", this.volume);
        return;
      }
      // Not audible yet — fall through to sync so a gesture can still start it.
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
      return;
    }

    this.bindGesture();
    // Always attempt play: prior site engagement / already-running context can
    // succeed without another tap; otherwise gesture handlers remain bound.
    this.tryPlay();
  }

  private tryPlay() {
    if (!wantsLoginBgm(this.allowed, this.enabled)) {
      killLoginSiteLegendBgm({ unload: false });
      return;
    }

    if (isWebAudioBgmPlaying("login")) {
      setWebAudioBgmGain("login", this.volume);
      detachGestureHandler();
      return;
    }

    const gen = getSiteLegendBgmPlayGen();
    const token = ++this.startToken;
    void startWebAudioBgm("login", LOGIN_BGM_SRC, this.volume).then((ok) => {
      // Stale attempt — do not tear down a newer successful start.
      if (token !== this.startToken) return;
      if (
        !ok ||
        gen !== getSiteLegendBgmPlayGen() ||
        !wantsLoginBgm(this.allowed, this.enabled)
      ) {
        if (!ok) {
          // Keep gesture listeners so the next tap can unlock autoplay.
          this.bindGesture();
        } else {
          stopWebAudioBgm("login", false);
          this.bindGesture();
        }
        return;
      }
      this.gestureUnlocked = true;
      detachGestureHandler();
      clearBrowserMediaSession();
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
    window.addEventListener("pointerdown", handler, { capture: true, passive: true });
    window.addEventListener("keydown", handler, { capture: true });
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
