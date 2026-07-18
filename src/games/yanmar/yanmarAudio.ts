import {
  bgmVolumeToGain,
  volumeToGain,
  type HornId,
  type SoundSettings,
} from "./soundSettings";
import {
  getSoundSettings,
  subscribeSoundSettings,
} from "./soundSettingsStore";
import {
  isPageAudioSealed,
  registerPageAudioHooks,
} from "@/lib/pageAudioLifecycle";
import {
  getSiteLegendBgmPlayGen,
  isSiteLegendBgmMasterEnabled,
} from "@/lib/siteLegendBgmRegistry";
import {
  isWebAudioBgmPlaying,
  setWebAudioBgmGain,
  startWebAudioBgm,
  stopWebAudioBgm,
  suspendWebAudioBgmContext,
} from "@/lib/siteLegendWebAudioBgm";
import { clearBrowserMediaSession } from "@/lib/clearBrowserMediaSession";

const SOUND_BASE = "/sounds/yanmar";

const HORN_SRC: Record<HornId, string> = {
  1: `${SOUND_BASE}/horn-1.wav`,
  2: `${SOUND_BASE}/horn-2.wav`,
  3: `${SOUND_BASE}/horn-3.wav`,
  4: `${SOUND_BASE}/horn-4.wav`,
};

const BREAKER_SRC = `${SOUND_BASE}/breaker.wav`;
const INGAME_BGM_SRC = "/sounds/site-legend/ingame-bgm.ogg";
const HORN_BASE_VOLUME = 0.88;
const BREAKER_BASE_GAIN = 0.92;
/** Ignore brief contact flicker so the loop does not restart mid-strike. */
const BREAKER_STOP_GRACE_MS = 120;

const GLOBAL_CTRL = "__ykYanmarAudioCtrl";

type GlobalBag = typeof globalThis & {
  [GLOBAL_CTRL]?: YanmarAudioController;
};

function bag(): GlobalBag {
  return globalThis as GlobalBag;
}

class YanmarAudioController {
  private hornCache = new Map<HornId, HTMLAudioElement>();
  private hornId: HornId = 1;
  private unlocked = false;
  private sfxEnabled = true;
  private breakerSfxEnabled = true;
  /** False until store hydrates — avoids playing before Off is applied. */
  private bgmEnabled = false;
  private bgmVolume = 28;
  private sfxVolume = 85;
  private active = false;
  private bgmGestureBound = false;
  private storeSubscribed = false;
  private bgmStartToken = 0;
  private readonly onBgmGesture = () => {
    if (isPageAudioSealed()) return;
    if (!this.active || !this.bgmEnabled || !isSiteLegendBgmMasterEnabled()) {
      return;
    }
    this.startBgm();
  };
  private breakerWanted = false;
  private audioCtx: AudioContext | null = null;
  private breakerBuffer: AudioBuffer | null = null;
  private breakerBufferLoading: Promise<AudioBuffer | null> | null = null;
  private breakerSource: AudioBufferSourceNode | null = null;
  private breakerGain: GainNode | null = null;
  private breakerStopTimer: ReturnType<typeof setTimeout> | null = null;
  private lifecycleBound = false;

  private ensureStoreSubscription() {
    if (typeof window === "undefined" || this.storeSubscribed) return;
    this.storeSubscribed = true;
    this.bindLifecycle();
    this.applySettings(getSoundSettings());
    subscribeSoundSettings((settings) => {
      this.applySettings(settings);
    });
  }

  private bindLifecycle() {
    if (this.lifecycleBound) return;
    this.lifecycleBound = true;
    registerPageAudioHooks("yanmar-audio", {
      pause: () => {
        this.breakerWanted = false;
        this.stopBreakerImmediate();
        this.stopBgm(false);
        this.unbindBgmGesture();
        void suspendWebAudioBgmContext("ingame");
        if (this.audioCtx && this.audioCtx.state === "running") {
          void this.audioCtx.suspend().catch(() => undefined);
        }
      },
      resume: () => {
        if (isPageAudioSealed()) return;
        if (document.visibilityState !== "visible") return;
        if (this.audioCtx && this.audioCtx.state === "suspended") {
          void this.audioCtx.resume().catch(() => undefined);
        }
        if (this.active) this.syncBgm();
      },
      exit: () => {
        this.breakerWanted = false;
        this.stopBreakerImmediate();
        this.unbindBgmGesture();
        this.stopBgm(true);
        if (this.audioCtx) {
          void this.audioCtx.close().catch(() => undefined);
          this.audioCtx = null;
          this.breakerBuffer = null;
          this.breakerBufferLoading = null;
          this.breakerGain = null;
        }
        for (const audio of this.hornCache.values()) {
          try {
            audio.pause();
            audio.src = "";
          } catch {
            // ignore
          }
        }
        this.hornCache.clear();
        clearBrowserMediaSession();
      },
    });
  }

  private applySettings(settings: SoundSettings) {
    this.bgmEnabled = settings.bgmEnabled;
    this.bgmVolume = settings.bgmVolume;
    this.sfxEnabled = settings.sfxEnabled;
    this.sfxVolume = settings.sfxVolume;
    this.breakerSfxEnabled = settings.breakerSfxEnabled;
    this.hornId = settings.hornId;
    this.applyBreakerGain();
    this.applyHornVolumes();
    this.syncBreakerPlayback();
    if (!settings.bgmEnabled || !isSiteLegendBgmMasterEnabled()) {
      this.bgmEnabled = false;
      this.unbindBgmGesture();
      this.stopBgm(true);
      return;
    }
    this.applyBgmVolume();
    this.syncBgm();
  }

  setActive(active: boolean) {
    this.ensureStoreSubscription();
    if (this.active === active) {
      if (active) this.syncBgm();
      return;
    }
    this.active = active;
    if (!active) {
      this.breakerWanted = false;
      this.stopBreakerImmediate();
      this.stopBgm(false);
      this.unbindBgmGesture();
      return;
    }
    this.applySettings(getSoundSettings());
    this.syncBgm();
  }

  setBgmEnabled(enabled: boolean) {
    this.bgmEnabled = enabled;
    this.syncBgm();
  }

  setBgmVolume(volume0to100: number) {
    this.bgmVolume = Math.max(0, Math.min(100, Math.round(volume0to100)));
    this.applyBgmVolume();
  }

  setSfxEnabled(enabled: boolean) {
    this.sfxEnabled = enabled;
    this.syncBreakerPlayback();
  }

  setSfxVolume(volume0to100: number) {
    this.sfxVolume = Math.max(0, Math.min(100, Math.round(volume0to100)));
    this.applyBreakerGain();
    this.applyHornVolumes();
  }

  setBreakerSfxEnabled(enabled: boolean) {
    this.breakerSfxEnabled = enabled;
    this.syncBreakerPlayback();
  }

  setHornId(hornId: HornId) {
    this.hornId = hornId;
  }

  private canPlayBreaker() {
    return this.sfxEnabled && this.breakerSfxEnabled;
  }

  private syncBreakerPlayback() {
    if (!this.canPlayBreaker()) {
      this.stopBreakerImmediate();
      return;
    }
    if (this.breakerWanted) {
      void this.startBreaker();
    }
  }

  private applyBgmVolume() {
    setWebAudioBgmGain("ingame", bgmVolumeToGain(this.bgmVolume));
  }

  private applyBreakerGain() {
    if (this.breakerGain) {
      this.breakerGain.gain.value =
        BREAKER_BASE_GAIN * volumeToGain(this.sfxVolume);
    }
  }

  private applyHornVolumes() {
    const volume = HORN_BASE_VOLUME * volumeToGain(this.sfxVolume);
    for (const audio of this.hornCache.values()) {
      audio.volume = volume;
    }
  }

  /** Call from a user gesture so subsequent playback can start. */
  unlock() {
    if (typeof window === "undefined") return;
    this.ensureStoreSubscription();
    void this.ensureAudioContext();
    this.syncBgm();
    if (this.unlocked) return;
    const probe = new Audio(HORN_SRC[this.hornId]);
    probe.volume = 0;
    void probe
      .play()
      .then(() => {
        probe.pause();
        probe.src = "";
        this.unlocked = true;
        void this.ensureBreakerBuffer();
        this.syncBgm();
      })
      .catch(() => {
        probe.src = "";
      });
  }

  private syncBgm() {
    if (isPageAudioSealed()) {
      this.stopBgm(false);
      this.unbindBgmGesture();
      return;
    }
    if (
      this.active &&
      this.bgmEnabled &&
      isSiteLegendBgmMasterEnabled()
    ) {
      this.startBgm();
      this.bindBgmGesture();
    } else {
      this.stopBgm(true);
      this.unbindBgmGesture();
    }
  }

  private bindBgmGesture() {
    if (typeof window === "undefined" || this.bgmGestureBound) return;
    window.addEventListener("pointerdown", this.onBgmGesture, { passive: true });
    window.addEventListener("keydown", this.onBgmGesture);
    this.bgmGestureBound = true;
  }

  private unbindBgmGesture() {
    if (typeof window === "undefined" || !this.bgmGestureBound) return;
    window.removeEventListener("pointerdown", this.onBgmGesture);
    window.removeEventListener("keydown", this.onBgmGesture);
    this.bgmGestureBound = false;
  }

  private startBgm() {
    if (
      isPageAudioSealed() ||
      !this.active ||
      !this.bgmEnabled ||
      !isSiteLegendBgmMasterEnabled()
    ) {
      return;
    }
    if (isWebAudioBgmPlaying("ingame")) {
      this.applyBgmVolume();
      return;
    }
    const gen = getSiteLegendBgmPlayGen();
    const token = ++this.bgmStartToken;
    void startWebAudioBgm(
      "ingame",
      INGAME_BGM_SRC,
      bgmVolumeToGain(this.bgmVolume),
    ).then((ok) => {
      if (
        !ok ||
        token !== this.bgmStartToken ||
        gen !== getSiteLegendBgmPlayGen() ||
        isPageAudioSealed() ||
        !this.active ||
        !this.bgmEnabled ||
        !isSiteLegendBgmMasterEnabled()
      ) {
        stopWebAudioBgm("ingame", false);
        return;
      }
      this.unlocked = true;
      this.unbindBgmGesture();
      clearBrowserMediaSession();
    });
  }

  private stopBgm(reset = true) {
    this.bgmStartToken += 1;
    stopWebAudioBgm("ingame", reset);
    clearBrowserMediaSession();
  }

  playHorn(hornId: HornId = this.hornId) {
    if (typeof window === "undefined") return;
    if (!this.sfxEnabled) return;
    let audio = this.hornCache.get(hornId);
    if (!audio) {
      audio = new Audio(HORN_SRC[hornId]);
      audio.preload = "auto";
      this.hornCache.set(hornId, audio);
    }
    audio.volume = HORN_BASE_VOLUME * volumeToGain(this.sfxVolume);
    try {
      audio.currentTime = 0;
      void audio.play().then(() => {
        this.unlocked = true;
        void this.ensureAudioContext();
      });
    } catch {
      // ignore
    }
  }

  /**
   * Loop breaker SFX while the tip is striking active asphalt with the pedal held.
   * Pass false when the strike stops (pedal up, tip leaves asphalt, etc.).
   */
  setBreakerHammering(hammering: boolean) {
    if (hammering) {
      this.clearBreakerStopTimer();
      if (this.breakerWanted && this.breakerSource) return;
      this.breakerWanted = true;
      if (!this.canPlayBreaker()) return;
      void this.startBreaker();
      return;
    }

    if (!this.breakerWanted) return;
    this.breakerWanted = false;
    this.scheduleBreakerStop();
  }

  private async ensureAudioContext() {
    if (typeof window === "undefined") return null;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    if (!this.audioCtx) {
      this.audioCtx = new AC();
    }
    if (this.audioCtx.state === "suspended") {
      try {
        await this.audioCtx.resume();
      } catch {
        // ignore
      }
    }
    return this.audioCtx;
  }

  private async ensureBreakerBuffer() {
    if (this.breakerBuffer) return this.breakerBuffer;
    if (this.breakerBufferLoading) return this.breakerBufferLoading;

    this.breakerBufferLoading = (async () => {
      const ctx = await this.ensureAudioContext();
      if (!ctx) return null;
      try {
        const res = await fetch(BREAKER_SRC);
        const data = await res.arrayBuffer();
        const buffer = await ctx.decodeAudioData(data.slice(0));
        this.breakerBuffer = buffer;
        return buffer;
      } catch {
        return null;
      } finally {
        this.breakerBufferLoading = null;
      }
    })();

    return this.breakerBufferLoading;
  }

  private async startBreaker() {
    const ctx = await this.ensureAudioContext();
    const buffer = await this.ensureBreakerBuffer();
    if (!ctx || !buffer || !this.breakerWanted || !this.canPlayBreaker()) return;
    if (this.breakerSource) return;

    const gain = ctx.createGain();
    gain.gain.value = BREAKER_BASE_GAIN * volumeToGain(this.sfxVolume);
    gain.connect(ctx.destination);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    try {
      source.start(0);
    } catch {
      gain.disconnect();
      return;
    }

    this.breakerGain = gain;
    this.breakerSource = source;
    this.unlocked = true;

    source.onended = () => {
      if (this.breakerSource === source) {
        this.breakerSource = null;
        this.breakerGain?.disconnect();
        this.breakerGain = null;
      }
    };
  }

  private scheduleBreakerStop() {
    this.clearBreakerStopTimer();
    this.breakerStopTimer = setTimeout(() => {
      this.breakerStopTimer = null;
      if (!this.breakerWanted) {
        this.stopBreakerImmediate();
      }
    }, BREAKER_STOP_GRACE_MS);
  }

  private clearBreakerStopTimer() {
    if (this.breakerStopTimer == null) return;
    clearTimeout(this.breakerStopTimer);
    this.breakerStopTimer = null;
  }

  private stopBreakerImmediate() {
    this.clearBreakerStopTimer();
    const source = this.breakerSource;
    const gain = this.breakerGain;
    this.breakerSource = null;
    this.breakerGain = null;
    if (source) {
      try {
        source.onended = null;
        source.stop();
      } catch {
        // already stopped
      }
      try {
        source.disconnect();
      } catch {
        // ignore
      }
    }
    if (gain) {
      try {
        gain.disconnect();
      } catch {
        // ignore
      }
    }
  }

  /** Soft teardown when leaving a play session — keeps decoded buffers for next run. */
  deactivate() {
    this.active = false;
    this.breakerWanted = false;
    this.stopBreakerImmediate();
    this.stopBgm(true);
    this.unbindBgmGesture();
  }

  dispose() {
    this.deactivate();
    stopWebAudioBgm("ingame", true);
    this.breakerBuffer = null;
    this.breakerBufferLoading = null;
    if (this.audioCtx) {
      void this.audioCtx.close().catch(() => undefined);
      this.audioCtx = null;
    }
    for (const audio of this.hornCache.values()) {
      audio.pause();
      audio.src = "";
    }
    this.hornCache.clear();
    clearBrowserMediaSession();
  }
}

function getYanmarAudio(): YanmarAudioController {
  const g = bag();
  if (!g[GLOBAL_CTRL]) {
    g[GLOBAL_CTRL] = new YanmarAudioController();
  }
  return g[GLOBAL_CTRL];
}

export const yanmarAudio = getYanmarAudio();
