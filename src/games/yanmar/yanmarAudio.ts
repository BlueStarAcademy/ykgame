import {
  bgmVolumeToGain,
  volumeToGain,
  type HornId,
  type SoundSettings,
  type SfxDetailId,
  type SfxDetailSettings,
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
  getWebAudioBgmSrcUrl,
  isWebAudioBgmPlaying,
  preloadWebAudioBgm,
  primeWebAudioBgmContext,
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
const ENHANCE_SUCCESS_SRC = `${SOUND_BASE}/enhance-success.wav`;
const ENHANCE_FAIL_SRC = `${SOUND_BASE}/enhance-fail.wav`;
const UI_CLICK_SRC = `${SOUND_BASE}/ui-click.wav`;
const ENGINE_START_SRC = `${SOUND_BASE}/engine-start.ogg`;
const ENGINE_OFF_SRC = `${SOUND_BASE}/engine-off.ogg`;
const SERVICE_ENTER_SRC = `${SOUND_BASE}/service-enter.ogg`;
const MONUMENT_ENTER_SRC = `${SOUND_BASE}/monument-enter.ogg`;
const STAR_ACQUIRE_SRC = `${SOUND_BASE}/star-acquire.ogg`;
const BUFF_ACQUIRE_SRC = `${SOUND_BASE}/buff-acquire.ogg`;
const ITEM_ACQUIRE_SRC = `${SOUND_BASE}/item-acquire.ogg`;
const MASTER_ITEM_ACQUIRE_SRC = `${SOUND_BASE}/master-item-acquire.ogg`;
const SPORTS_COUNTDOWN_SRC = `${SOUND_BASE}/countdown.ogg`;
const ATTACHMENT_UNLOCK_SRC = `${SOUND_BASE}/attachment-unlock.ogg`;
const TRAVEL_1_SRC = `${SOUND_BASE}/travel-1.ogg`;
const TRAVEL_2_SRC = `${SOUND_BASE}/travel-2.ogg`;
const TRAVEL_SRC: Record<TravelRpm, string> = {
  1: TRAVEL_1_SRC,
  2: TRAVEL_2_SRC,
};
const INGAME_BGM_SRC = "/sounds/site-legend/ingame-bgm.ogg";
const SPORTS_MEET_BGM_SRC = "/sounds/yanmar/sports-meet-bgm.ogg";
const HORN_BASE_VOLUME = 0.88;
const BREAKER_BASE_GAIN = 0.92;
const ENHANCE_SFX_BASE_VOLUME = 0.9;
const UI_CLICK_BASE_VOLUME = 0.72;
const ENGINE_START_BASE_VOLUME = 0.9;
const ENGINE_OFF_BASE_VOLUME = 0.88;
const SERVICE_ENTER_BASE_VOLUME = 0.85;
const MONUMENT_ENTER_BASE_VOLUME = 0.85;
const STAR_ACQUIRE_BASE_VOLUME = 0.88;
const BUFF_ACQUIRE_BASE_VOLUME = 0.88;
const ITEM_ACQUIRE_BASE_VOLUME = 0.88;
const MASTER_ITEM_ACQUIRE_BASE_VOLUME = 0.92;
const SPORTS_COUNTDOWN_BASE_VOLUME = 0.9;
const ROULETTE_SPIN_BASE_VOLUME = 0.78;
const ATTACHMENT_UNLOCK_BASE_VOLUME = 0.9;
/** Subtle granular sounds; keep them well below the hydraulic and travel loops. */
const SOIL_LOAD_BASE_GAIN = 0.16;
const SOIL_DUMP_BASE_GAIN = 0.22;
/** Keep under horns / breaker so travel drone does not dominate. */
const TRAVEL_BASE_GAIN = 0.48;
/** Crossfade length when building a seamless loop buffer from travel clips. */
const TRAVEL_LOOP_CROSSFADE_SEC = 0.14;
const TRAVEL_FADE_IN_SEC = 0.09;

const GLOBAL_CTRL = "__ykYanmarAudioCtrl";
const GLOBAL_CTRL_REV = "__ykYanmarAudioCtrlRev";
/** Bump when controller public surface changes (forces HMR refresh). */
const CTRL_REV = 12;

type TravelRpm = 1 | 2;

type GlobalBag = typeof globalThis & {
  [GLOBAL_CTRL]?: YanmarAudioController;
  [GLOBAL_CTRL_REV]?: number;
};

function bag(): GlobalBag {
  return globalThis as GlobalBag;
}

/**
 * Build a shorter buffer whose start/end crossfade so WebAudio `loop=true`
 * does not click at the seam when the source clip is not authored as seamless.
 */
function makeSeamlessLoopBuffer(
  ctx: AudioContext,
  source: AudioBuffer,
  crossfadeSec: number,
): AudioBuffer {
  const channels = source.numberOfChannels;
  const sampleRate = source.sampleRate;
  const fadeSamples = Math.min(
    Math.max(1, Math.floor(crossfadeSec * sampleRate)),
    Math.floor(source.length / 4),
  );
  if (fadeSamples < 64 || source.length <= fadeSamples * 2) {
    return source;
  }

  const outLen = source.length - fadeSamples;
  const out = ctx.createBuffer(channels, outLen, sampleRate);
  for (let ch = 0; ch < channels; ch++) {
    const src = source.getChannelData(ch);
    const dst = out.getChannelData(ch);
    for (let i = 0; i < outLen; i++) {
      if (i < fadeSamples) {
        const t = i / fadeSamples;
        // Equal-power-ish blend: end of clip into start so the loop seam matches.
        const a = Math.cos(t * 0.5 * Math.PI);
        const b = Math.sin(t * 0.5 * Math.PI);
        dst[i] = src[source.length - fadeSamples + i] * a + src[i] * b;
      } else {
        dst[i] = src[i];
      }
    }
  }
  return out;
}

/** Seamless mechanical reel ticks — slot-machine clacks, not a whoosh bed. */
function synthesizeRouletteSpinBuffer(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const ticksPerLoop = 16;
  const tickHz = 21;
  const duration = ticksPerLoop / tickHz;
  const frames = Math.max(1, Math.floor(rate * duration));
  const buffer = ctx.createBuffer(1, frames, rate);
  const samples = buffer.getChannelData(0);
  const tickInterval = Math.floor(frames / ticksPerLoop);

  let brown = 0;
  for (let i = 0; i < frames; i++) {
    brown = (brown + (Math.random() * 2 - 1) * 0.018) * 0.996;
    const rumble =
      Math.sin((2 * Math.PI * 62 * i) / rate) * 0.04 +
      Math.sin((2 * Math.PI * 93 * i) / rate) * 0.025;
    samples[i] = brown * 0.12 + rumble;
  }

  const clickLen = Math.max(8, Math.floor(rate * 0.014));
  for (let tick = 0; tick < ticksPerLoop; tick++) {
    const start = tick * tickInterval;
    const accent = tick % 4 === 0 ? 1.18 : 0.86 + (tick % 3) * 0.05;
    const freqA = 1680 + (tick % 5) * 70;
    const freqB = 720 + (tick % 4) * 40;
    for (let j = 0; j < clickLen && start + j < frames; j++) {
      const env = Math.exp(-j / (rate * 0.0032));
      const click =
        Math.sin((2 * Math.PI * freqA * j) / rate) * 0.52 +
        Math.sin((2 * Math.PI * freqB * j) / rate) * 0.28 +
        (Math.random() * 2 - 1) * 0.16;
      samples[start + j] += click * env * accent;
    }
  }

  let peak = 0.0001;
  for (let i = 0; i < frames; i++) {
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  const gain = 0.92 / peak;
  for (let i = 0; i < frames; i++) {
    samples[i] *= gain;
  }
  return buffer;
}

class YanmarAudioController {
  /** Decoded one-shot / loop SFX — Web Audio avoids OS media-player chrome. */
  private sfxBuffers = new Map<string, AudioBuffer>();
  private sfxBufferLoadings = new Map<string, Promise<AudioBuffer | null>>();
  private rouletteSpinSource: AudioBufferSourceNode | null = null;
  private rouletteSpinGain: GainNode | null = null;
  private rouletteSpinBuffer: AudioBuffer | null = null;
  private rouletteSpinToken = 0;
  private sportsCountdownSource: AudioBufferSourceNode | null = null;
  private engineStartSource: AudioBufferSourceNode | null = null;
  private hornId: HornId = 1;
  private unlocked = false;
  private sfxEnabled = true;
  private breakerSfxEnabled = true;
  private sfxDetails: SfxDetailSettings = getSoundSettings().sfxDetails;
  /** False until store hydrates — avoids playing before Off is applied. */
  private bgmEnabled = false;
  private bgmVolume = 28;
  private sfxVolume = 85;
  private active = false;
  private sportsMeetBgm = false;
  private bgmGestureBound = false;
  private storeSubscribed = false;
  private bgmStartToken = 0;
  private readonly onBgmGesture = () => {
    if (isPageAudioSealed()) return;
    if (!this.active || !this.bgmEnabled || !isSiteLegendBgmMasterEnabled()) {
      return;
    }
    // Resume on the gesture stack before any async decode/start.
    primeWebAudioBgmContext("ingame");
    this.startBgm();
  };
  private breakerWanted = false;
  private audioCtx: AudioContext | null = null;
  private breakerBuffer: AudioBuffer | null = null;
  private breakerBufferLoading: Promise<AudioBuffer | null> | null = null;
  private breakerSource: AudioBufferSourceNode | null = null;
  private breakerGain: GainNode | null = null;
  private travelWanted = false;
  private travelRpm: TravelRpm = 1;
  private travelBuffers = new Map<TravelRpm, AudioBuffer>();
  private travelBufferLoadings = new Map<
    TravelRpm,
    Promise<AudioBuffer | null>
  >();
  private travelSource: AudioBufferSourceNode | null = null;
  private travelGain: GainNode | null = null;
  private travelFadeToken = 0;
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
        this.travelWanted = false;
        this.stopBreakerImmediate();
        this.stopTravelImmediate();
        this.stopRouletteSpin();
        this.stopSportsCountdown();
        this.stopEngineStartImmediate();
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
        this.travelWanted = false;
        this.stopBreakerImmediate();
        this.stopTravelImmediate();
        this.stopRouletteSpin();
        this.stopSportsCountdown();
        this.stopEngineStartImmediate();
        this.unbindBgmGesture();
        this.stopBgm(true);
        if (this.audioCtx) {
          void this.audioCtx.close().catch(() => undefined);
          this.audioCtx = null;
          this.breakerBuffer = null;
          this.breakerBufferLoading = null;
          this.breakerGain = null;
          this.travelBuffers.clear();
          this.travelBufferLoadings.clear();
          this.travelGain = null;
          this.sfxBuffers.clear();
          this.sfxBufferLoadings.clear();
          this.rouletteSpinSource = null;
          this.rouletteSpinGain = null;
          this.rouletteSpinBuffer = null;
          this.sportsCountdownSource = null;
          this.engineStartSource = null;
        }
        clearBrowserMediaSession();
      },
    });
  }

  private applySettings(settings: SoundSettings) {
    const prevBgmEnabled = this.bgmEnabled;
    const prevSfxEnabled = this.sfxEnabled;
    const prevBreakerSfxEnabled = this.breakerSfxEnabled;
    const prevBgmVolume = this.bgmVolume;
    const prevSfxVolume = this.sfxVolume;
    const prevSfxDetails = this.sfxDetails;

    this.bgmEnabled = settings.bgmEnabled;
    this.bgmVolume = settings.bgmVolume;
    this.sfxEnabled = settings.sfxEnabled;
    this.sfxVolume = settings.sfxVolume;
    this.breakerSfxEnabled = settings.breakerSfxEnabled;
    this.sfxDetails = settings.sfxDetails;
    this.hornId = settings.hornId;

    const bgmEnableChanged = prevBgmEnabled !== this.bgmEnabled;
    const sfxEnableChanged =
      prevSfxEnabled !== this.sfxEnabled ||
      prevBreakerSfxEnabled !== this.breakerSfxEnabled;
    const bgmVolumeChanged = prevBgmVolume !== this.bgmVolume;
    const sfxVolumeChanged = prevSfxVolume !== this.sfxVolume;
    const sfxDetailsChanged =
      JSON.stringify(prevSfxDetails) !== JSON.stringify(this.sfxDetails);

    // Volume-only changes must never restart loops — just retarget gain.
    if (sfxVolumeChanged || sfxEnableChanged || sfxDetailsChanged) {
      this.applyBreakerGain();
      this.applyTravelGain();
      this.applyLiveWebSfxVolumes();
    }
    if (sfxEnableChanged || sfxDetailsChanged) {
      this.syncBreakerPlayback();
      this.syncTravelPlayback();
    }

    if (!settings.bgmEnabled || !isSiteLegendBgmMasterEnabled()) {
      this.bgmEnabled = false;
      this.unbindBgmGesture();
      if (prevBgmEnabled) this.stopBgm(true);
      return;
    }

    if (bgmVolumeChanged) {
      this.applyBgmVolume();
    }
    // Restart / start BGM only when enable toggles — not on volume drag.
    if (bgmEnableChanged || (!prevBgmEnabled && this.bgmEnabled)) {
      this.syncBgm();
    }
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
      this.travelWanted = false;
      this.stopBreakerImmediate();
      this.stopTravelImmediate();
      this.stopEngineStartImmediate();
      this.stopBgm(false);
      this.unbindBgmGesture();
      return;
    }
    this.applySettings(getSoundSettings());
    this.syncBgm();
  }

  /** Swap to sports-meet BGM while arena is active; restores worksite BGM on exit. */
  setSportsMeetBgm(enabled: boolean) {
    this.ensureStoreSubscription();
    if (this.sportsMeetBgm === enabled) {
      if (this.active) {
        primeWebAudioBgmContext("ingame");
        this.syncBgm();
      }
      return;
    }
    this.sportsMeetBgm = enabled;
    // Soft-stop graph only — keep AudioContext alive for the track swap.
    this.stopBgm(false);
    // Keep/resume context on the caller gesture before async decode of the new track.
    primeWebAudioBgmContext("ingame");
    if (enabled) {
      void preloadWebAudioBgm("ingame", SPORTS_MEET_BGM_SRC);
    }
    if (this.active) {
      this.syncBgm();
    }
  }

  private getBgmSrc() {
    return this.sportsMeetBgm ? SPORTS_MEET_BGM_SRC : INGAME_BGM_SRC;
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
    this.syncTravelPlayback();
  }

  setSfxVolume(volume0to100: number) {
    this.sfxVolume = Math.max(0, Math.min(100, Math.round(volume0to100)));
    this.applyBreakerGain();
    this.applyTravelGain();
    this.applyLiveWebSfxVolumes();
  }

  setBreakerSfxEnabled(enabled: boolean) {
    this.breakerSfxEnabled = enabled;
    this.syncBreakerPlayback();
  }

  setHornId(hornId: HornId) {
    this.hornId = hornId;
  }

  private canPlayBreaker() {
    return (
      this.sfxEnabled &&
      this.breakerSfxEnabled &&
      this.sfxDetails.breaker.enabled
    );
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

  private canPlayTravel() {
    return this.sfxEnabled && this.active && this.sfxDetails.travel.enabled;
  }

  private canPlayEffect(id: SfxDetailId) {
    return this.sfxEnabled && this.sfxDetails[id].enabled;
  }

  private effectGain(id: SfxDetailId) {
    return (
      volumeToGain(this.sfxVolume) *
      volumeToGain(this.sfxDetails[id].volume)
    );
  }

  private syncTravelPlayback() {
    if (!this.canPlayTravel()) {
      this.stopTravelImmediate();
      return;
    }
    if (this.travelWanted) {
      void this.startTravel();
    }
  }

  private applyBgmVolume() {
    setWebAudioBgmGain("ingame", bgmVolumeToGain(this.bgmVolume));
  }

  private applyBreakerGain() {
    if (this.breakerGain) {
      this.breakerGain.gain.value =
        BREAKER_BASE_GAIN * this.effectGain("breaker");
    }
  }

  private applyTravelGain() {
    if (!this.travelGain || !this.audioCtx || !this.travelWanted) return;
    const peak = TRAVEL_BASE_GAIN * this.effectGain("travel");
    this.travelGain.gain.cancelScheduledValues(this.audioCtx.currentTime);
    this.travelGain.gain.setValueAtTime(peak, this.audioCtx.currentTime);
  }

  private applyLiveWebSfxVolumes() {
    if (this.rouletteSpinGain) {
      this.rouletteSpinGain.gain.value =
        ROULETTE_SPIN_BASE_VOLUME * this.effectGain("roulette");
    }
  }

  /** Call from a user gesture so subsequent playback can start. */
  unlock() {
    if (typeof window === "undefined") return;
    this.ensureStoreSubscription();
    // Critical: resume AudioContexts while the gesture is still live.
    // Scene-ready / rAF unlocks cannot create an audible context on their own.
    primeWebAudioBgmContext("ingame");
    void this.ensureAudioContext().then((ctx) => {
      if (!ctx) return;
      this.unlocked = true;
      void this.ensureBreakerBuffer();
      void this.ensureSfxBuffer(ITEM_ACQUIRE_SRC);
      void this.ensureSfxBuffer(STAR_ACQUIRE_SRC);
      this.syncBgm();
    });
    void preloadWebAudioBgm("ingame", INGAME_BGM_SRC);
    void preloadWebAudioBgm("ingame", SPORTS_MEET_BGM_SRC);
    void this.ensureTravelBuffer(1);
    void this.ensureTravelBuffer(2);
    this.syncBgm();
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
    const wantedSrc = this.getBgmSrc();
    // Already on the desired track — never rebuild the graph for volume/sync.
    if (getWebAudioBgmSrcUrl("ingame") === wantedSrc) {
      this.applyBgmVolume();
      if (isWebAudioBgmPlaying("ingame")) {
        this.unbindBgmGesture();
        return;
      }
      // Graph may exist but be suspended — resume without reconnecting.
      primeWebAudioBgmContext("ingame");
      if (isWebAudioBgmPlaying("ingame")) {
        this.unbindBgmGesture();
        return;
      }
    }
    const gen = getSiteLegendBgmPlayGen();
    const token = ++this.bgmStartToken;
    void startWebAudioBgm(
      "ingame",
      wantedSrc,
      bgmVolumeToGain(this.bgmVolume),
    ).then((ok) => {
      // A newer start/stop superseded this attempt — leave the current graph alone.
      if (token !== this.bgmStartToken) return;
      if (
        !ok ||
        gen !== getSiteLegendBgmPlayGen() ||
        isPageAudioSealed() ||
        !this.active ||
        !this.bgmEnabled ||
        !isSiteLegendBgmMasterEnabled()
      ) {
        if (!ok) {
          this.bindBgmGesture();
        } else {
          stopWebAudioBgm("ingame", false);
          this.bindBgmGesture();
        }
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

  private async ensureSfxBuffer(src: string) {
    const cached = this.sfxBuffers.get(src);
    if (cached) return cached;
    const inflight = this.sfxBufferLoadings.get(src);
    if (inflight) return inflight;

    const loading = (async () => {
      const ctx = await this.ensureAudioContext();
      if (!ctx) return null;
      try {
        const res = await fetch(src);
        const data = await res.arrayBuffer();
        const buffer = await ctx.decodeAudioData(data.slice(0));
        this.sfxBuffers.set(src, buffer);
        return buffer;
      } catch {
        return null;
      } finally {
        this.sfxBufferLoadings.delete(src);
      }
    })();

    this.sfxBufferLoadings.set(src, loading);
    return loading;
  }

  /** Fire-and-forget one-shot via Web Audio (no OS media-player session). */
  private playWebAudioOneShot(src: string, volume: number) {
    void (async () => {
      const ctx = await this.ensureAudioContext();
      const buffer = await this.ensureSfxBuffer(src);
      if (!ctx || !buffer) return;
      const gain = ctx.createGain();
      gain.gain.value = Math.max(0, Math.min(1, volume));
      gain.connect(ctx.destination);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      source.onended = () => {
        try {
          source.disconnect();
        } catch {
          // ignore
        }
        try {
          gain.disconnect();
        } catch {
          // ignore
        }
      };
      try {
        source.start(0);
        this.unlocked = true;
        clearBrowserMediaSession();
      } catch {
        try {
          source.disconnect();
          gain.disconnect();
        } catch {
          // ignore
        }
      }
    })();
  }

  /**
   * One-shot that can be cut early (engine start / sports countdown).
   * Only one active source is tracked at a time for the given slot.
   */
  private playWebAudioTrackedOneShot(
    slot: "engineStart" | "sportsCountdown",
    src: string,
    volume: number,
  ) {
    void (async () => {
      if (slot === "engineStart") this.stopEngineStartImmediate();
      if (slot === "sportsCountdown") this.stopSportsCountdown();

      const ctx = await this.ensureAudioContext();
      const buffer = await this.ensureSfxBuffer(src);
      if (!ctx || !buffer) return;

      const gain = ctx.createGain();
      gain.gain.value = Math.max(0, Math.min(1, volume));
      gain.connect(ctx.destination);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      source.onended = () => {
        if (slot === "engineStart" && this.engineStartSource === source) {
          this.engineStartSource = null;
        }
        if (slot === "sportsCountdown" && this.sportsCountdownSource === source) {
          this.sportsCountdownSource = null;
        }
        try {
          source.disconnect();
        } catch {
          // ignore
        }
        try {
          gain.disconnect();
        } catch {
          // ignore
        }
      };
      try {
        source.start(0);
        this.unlocked = true;
        clearBrowserMediaSession();
      } catch {
        try {
          source.disconnect();
          gain.disconnect();
        } catch {
          // ignore
        }
        return;
      }
      if (slot === "engineStart") this.engineStartSource = source;
      if (slot === "sportsCountdown") this.sportsCountdownSource = source;
    })();
  }

  playHorn(hornId: HornId = this.hornId) {
    if (typeof window === "undefined") return;
    if (!this.canPlayEffect("horn")) return;
    this.playWebAudioOneShot(
      HORN_SRC[hornId],
      HORN_BASE_VOLUME * this.effectGain("horn"),
    );
  }

  playEnhanceResult(success: boolean) {
    if (typeof window === "undefined") return;
    if (!this.canPlayEffect("enhance")) return;
    this.playWebAudioOneShot(
      success ? ENHANCE_SUCCESS_SRC : ENHANCE_FAIL_SRC,
      ENHANCE_SFX_BASE_VOLUME * this.effectGain("enhance"),
    );
  }

  playUiClick() {
    if (typeof window === "undefined") return;
    if (!this.canPlayEffect("ui")) return;
    this.ensureStoreSubscription();
    this.playWebAudioOneShot(
      UI_CLICK_SRC,
      UI_CLICK_BASE_VOLUME * this.effectGain("ui"),
    );
  }

  /** One-shot when the cockpit engine start button switches On. */
  playEngineStart() {
    if (typeof window === "undefined") return;
    if (!this.canPlayEffect("engine")) return;
    this.ensureStoreSubscription();
    this.playWebAudioTrackedOneShot(
      "engineStart",
      ENGINE_START_SRC,
      ENGINE_START_BASE_VOLUME * this.effectGain("engine"),
    );
  }

  /** One-shot when the cockpit engine start button switches Off. */
  playEngineOff() {
    if (typeof window === "undefined") return;
    if (!this.canPlayEffect("engine")) return;
    this.ensureStoreSubscription();
    this.playWebAudioOneShot(
      ENGINE_OFF_SRC,
      ENGINE_OFF_BASE_VOLUME * this.effectGain("engine"),
    );
  }

  /** One-shot when the excavator enters the repair tent zone. */
  playServiceEnter() {
    if (typeof window === "undefined") return;
    if (!this.canPlayEffect("service")) return;
    this.ensureStoreSubscription();
    this.playWebAudioOneShot(
      SERVICE_ENTER_SRC,
      SERVICE_ENTER_BASE_VOLUME * this.effectGain("service"),
    );
  }

  /** One-shot when the excavator enters the monument / sculpture zone. */
  playMonumentEnter() {
    if (typeof window === "undefined") return;
    if (!this.canPlayEffect("monument")) return;
    this.ensureStoreSubscription();
    this.playWebAudioOneShot(
      MONUMENT_ENTER_SRC,
      MONUMENT_ENTER_BASE_VOLUME * this.effectGain("monument"),
    );
  }

  /** One-shot when stars are gained (street pickup or ad reward). */
  playStarAcquire() {
    if (typeof window === "undefined") return;
    if (!this.canPlayEffect("star")) return;
    this.ensureStoreSubscription();
    this.playWebAudioOneShot(
      STAR_ACQUIRE_SRC,
      STAR_ACQUIRE_BASE_VOLUME * this.effectGain("star"),
    );
  }

  /** One-shot when a timed buff is gained (street speed or shop). */
  playBuffAcquire() {
    if (typeof window === "undefined") return;
    if (!this.canPlayEffect("buff")) return;
    this.ensureStoreSubscription();
    this.playWebAudioOneShot(
      BUFF_ACQUIRE_SRC,
      BUFF_ACQUIRE_BASE_VOLUME * this.effectGain("buff"),
    );
  }

  /** One-shot when gear/equipment is acquired (drop or gacha). */
  playItemAcquire() {
    if (typeof window === "undefined") return;
    if (!this.canPlayEffect("item")) return;
    this.ensureStoreSubscription();
    this.playWebAudioOneShot(
      ITEM_ACQUIRE_SRC,
      ITEM_ACQUIRE_BASE_VOLUME * this.effectGain("item"),
    );
  }

  /** One-shot when MASTER-grade gear is acquired. */
  playMasterItemAcquire() {
    if (typeof window === "undefined") return;
    if (!this.canPlayEffect("masterItem")) return;
    this.ensureStoreSubscription();
    this.playWebAudioOneShot(
      MASTER_ITEM_ACQUIRE_SRC,
      MASTER_ITEM_ACQUIRE_BASE_VOLUME * this.effectGain("masterItem"),
    );
  }

  /** Full 5s sports-meet start countdown (played once when Start is pressed). */
  playSportsCountdown() {
    if (typeof window === "undefined") return;
    if (!this.canPlayEffect("sports")) return;
    this.ensureStoreSubscription();
    this.playWebAudioTrackedOneShot(
      "sportsCountdown",
      SPORTS_COUNTDOWN_SRC,
      SPORTS_COUNTDOWN_BASE_VOLUME * this.effectGain("sports"),
    );
  }

  /** Stop mid-countdown if the sports-meet run is aborted. */
  stopSportsCountdown() {
    const source = this.sportsCountdownSource;
    this.sportsCountdownSource = null;
    if (!source) return;
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

  /** Loop while a reward roulette reel is spinning. */
  playRouletteSpin() {
    if (typeof window === "undefined") return;
    if (!this.canPlayEffect("roulette")) return;
    this.ensureStoreSubscription();
    const token = ++this.rouletteSpinToken;
    void this.startRouletteSpin(token);
  }

  private async startRouletteSpin(token: number) {
    if (!this.canPlayEffect("roulette")) return;
    this.cutRouletteSpinNodes();
    const ctx = await this.ensureAudioContext();
    if (token !== this.rouletteSpinToken) return;
    if (!ctx || !this.canPlayEffect("roulette")) return;
    if (this.rouletteSpinSource) return;

    const buffer =
      this.rouletteSpinBuffer && this.rouletteSpinBuffer.sampleRate === ctx.sampleRate
        ? this.rouletteSpinBuffer
        : synthesizeRouletteSpinBuffer(ctx);
    this.rouletteSpinBuffer = buffer;

    const gain = ctx.createGain();
    gain.gain.value = ROULETTE_SPIN_BASE_VOLUME * this.effectGain("roulette");
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

    this.rouletteSpinGain = gain;
    this.rouletteSpinSource = source;
    this.unlocked = true;
    clearBrowserMediaSession();

    source.onended = () => {
      if (this.rouletteSpinSource === source) {
        this.rouletteSpinSource = null;
        this.rouletteSpinGain?.disconnect();
        this.rouletteSpinGain = null;
      }
    };
  }

  private cutRouletteSpinNodes() {
    const source = this.rouletteSpinSource;
    const gain = this.rouletteSpinGain;
    this.rouletteSpinSource = null;
    this.rouletteSpinGain = null;
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

  /** Cut roulette spin SFX the moment the reel lands. */
  stopRouletteSpin() {
    this.rouletteSpinToken += 1;
    this.cutRouletteSpinNodes();
    clearBrowserMediaSession();
  }

  /** One-shot when breaker/grapple unlock popup appears (Lv.10 / Lv.15). */
  playAttachmentUnlock() {
    if (typeof window === "undefined") return;
    if (!this.canPlayEffect("attachment")) return;
    this.ensureStoreSubscription();
    this.playWebAudioOneShot(
      ATTACHMENT_UNLOCK_SRC,
      ATTACHMENT_UNLOCK_BASE_VOLUME * this.effectGain("attachment"),
    );
  }

  /** Short granular scrape while the bucket is taking on soil. */
  playSoilLoad() {
    this.playSoilSound("load");
  }

  /** A slightly fuller cascade as soil leaves the bucket. */
  playSoilDump() {
    this.playSoilSound("dump");
  }

  private playSoilSound(kind: "load" | "dump") {
    if (typeof window === "undefined") return;
    if (!this.canPlayEffect("soil")) return;
    this.ensureStoreSubscription();
    void this.startSoilSound(kind);
  }

  private async startSoilSound(kind: "load" | "dump") {
    const ctx = await this.ensureAudioContext();
    if (!ctx || !this.canPlayEffect("soil")) return;

    const duration = kind === "load" ? 0.13 : 0.19;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    // Brown-ish noise sounds like loose earth, unlike the white-noise hiss of sand.
    let brown = 0;
    for (let i = 0; i < frames; i++) {
      brown = (brown + (Math.random() * 2 - 1) * 0.12) * 0.985;
      const grain = Math.random() * 2 - 1;
      samples[i] = brown * 0.82 + grain * 0.18;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = kind === "load" ? 520 : 350;
    filter.Q.value = kind === "load" ? 0.65 : 0.48;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    const peak =
      (kind === "load" ? SOIL_LOAD_BASE_GAIN : SOIL_DUMP_BASE_GAIN) *
      this.effectGain("soil");
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    try {
      source.start(now);
      this.unlocked = true;
    } catch {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    }
  }

  /**
   * Loop breaker SFX while the tip is striking active asphalt with the pedal held.
   * Pass false when the strike stops (pedal up, tip leaves asphalt, etc.).
   */
  setBreakerHammering(hammering: boolean) {
    if (hammering) {
      if (this.breakerWanted && this.breakerSource) return;
      this.breakerWanted = true;
      if (!this.canPlayBreaker()) return;
      void this.startBreaker();
      return;
    }

    if (!this.breakerWanted) return;
    this.breakerWanted = false;
    this.stopBreakerImmediate();
  }

  /**
   * Loop travel SFX while tracks are moving.
   * `rpm` 1 → travel-1.ogg, 2 → travel-2.ogg (seamless crossfaded buffers).
   */
  setTravelDriving(driving: boolean, rpm: TravelRpm = 1) {
    if (driving) {
      const rpmChanged = this.travelRpm !== rpm;
      this.travelWanted = true;
      this.travelRpm = rpm;
      if (!this.canPlayTravel()) return;
      if (this.travelSource && this.travelGain && this.audioCtx && !rpmChanged) {
        // Resume during volume ramp without restarting the buffer.
        this.travelFadeToken += 1;
        const peak = Math.max(
          0.0001,
          TRAVEL_BASE_GAIN * this.effectGain("travel"),
        );
        const now = this.audioCtx.currentTime;
        const current = Math.max(0.0001, this.travelGain.gain.value);
        this.travelGain.gain.cancelScheduledValues(now);
        this.travelGain.gain.setValueAtTime(current, now);
        this.travelGain.gain.exponentialRampToValueAtTime(
          peak,
          now + TRAVEL_FADE_IN_SEC,
        );
        return;
      }
      if (rpmChanged && this.travelSource) {
        // Swap clip on RPM toggle while still moving — quick restart with fade-in.
        this.stopTravelImmediate();
      }
      void this.startTravel();
      return;
    }

    if (!this.travelWanted) return;
    this.travelWanted = false;
    // Cut on lever release — no grace / fade-out linger.
    this.stopTravelImmediate();
  }

  /** Cut every action-bound loop immediately (engine off, safety lock, or input reset). */
  stopActionSounds() {
    this.breakerWanted = false;
    this.travelWanted = false;
    this.stopBreakerImmediate();
    this.stopTravelImmediate();
    this.stopEngineStartImmediate();
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
    gain.gain.value = BREAKER_BASE_GAIN * this.effectGain("breaker");
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

  private stopBreakerImmediate() {
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

  private async ensureTravelBuffer(rpm: TravelRpm) {
    const cached = this.travelBuffers.get(rpm);
    if (cached) return cached;
    const inflight = this.travelBufferLoadings.get(rpm);
    if (inflight) return inflight;

    const loading = (async () => {
      const ctx = await this.ensureAudioContext();
      if (!ctx) return null;
      try {
        const res = await fetch(TRAVEL_SRC[rpm]);
        const data = await res.arrayBuffer();
        const decoded = await ctx.decodeAudioData(data.slice(0));
        const seamless = makeSeamlessLoopBuffer(
          ctx,
          decoded,
          TRAVEL_LOOP_CROSSFADE_SEC,
        );
        this.travelBuffers.set(rpm, seamless);
        return seamless;
      } catch {
        return null;
      } finally {
        this.travelBufferLoadings.delete(rpm);
      }
    })();

    this.travelBufferLoadings.set(rpm, loading);
    return loading;
  }

  private async startTravel() {
    const rpm = this.travelRpm;
    const ctx = await this.ensureAudioContext();
    const buffer = await this.ensureTravelBuffer(rpm);
    if (
      !ctx ||
      !buffer ||
      !this.travelWanted ||
      this.travelRpm !== rpm ||
      !this.canPlayTravel()
    ) {
      return;
    }
    if (this.travelSource) return;

    const gain = ctx.createGain();
    const peak = Math.max(
      0.0001,
      TRAVEL_BASE_GAIN * this.effectGain("travel"),
    );
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + TRAVEL_FADE_IN_SEC);
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

    this.travelGain = gain;
    this.travelSource = source;
    this.unlocked = true;

    source.onended = () => {
      if (this.travelSource === source) {
        this.travelSource = null;
        this.travelGain?.disconnect();
        this.travelGain = null;
      }
    };
  }

  private stopTravelImmediate() {
    this.travelFadeToken += 1;
    const source = this.travelSource;
    const gain = this.travelGain;
    this.travelSource = null;
    this.travelGain = null;
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

  private stopEngineStartImmediate() {
    const source = this.engineStartSource;
    this.engineStartSource = null;
    if (!source) return;
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

  /** Soft teardown when leaving a play session — keeps decoded buffers for next run. */
  deactivate() {
    this.sportsMeetBgm = false;
    this.active = false;
    this.breakerWanted = false;
    this.travelWanted = false;
    this.stopSportsCountdown();
    this.stopRouletteSpin();
    this.stopBreakerImmediate();
    this.stopTravelImmediate();
    this.stopEngineStartImmediate();
    this.stopBgm(true);
    this.unbindBgmGesture();
  }

  dispose() {
    this.deactivate();
    stopWebAudioBgm("ingame", true);
    this.breakerBuffer = null;
    this.breakerBufferLoading = null;
    this.travelBuffers.clear();
    this.travelBufferLoadings.clear();
    this.sfxBuffers.clear();
    this.sfxBufferLoadings.clear();
    if (this.audioCtx) {
      void this.audioCtx.close().catch(() => undefined);
      this.audioCtx = null;
    }
    clearBrowserMediaSession();
  }
}

function getYanmarAudio(): YanmarAudioController {
  const g = bag();
  const existing = g[GLOBAL_CTRL];
  // HMR can keep a stale singleton missing newly added methods.
  if (!existing || g[GLOBAL_CTRL_REV] !== CTRL_REV) {
    try {
      existing?.deactivate();
    } catch {
      // ignore teardown errors from older controller shapes
    }
    g[GLOBAL_CTRL] = new YanmarAudioController();
    g[GLOBAL_CTRL_REV] = CTRL_REV;
  }
  return g[GLOBAL_CTRL]!;
}

export const yanmarAudio = getYanmarAudio();
