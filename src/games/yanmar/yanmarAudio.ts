import type { HornId } from "./soundSettings";

const SOUND_BASE = "/sounds/yanmar";

const HORN_SRC: Record<HornId, string> = {
  1: `${SOUND_BASE}/horn-1.wav`,
  2: `${SOUND_BASE}/horn-2.wav`,
  3: `${SOUND_BASE}/horn-3.wav`,
  4: `${SOUND_BASE}/horn-4.wav`,
};

const BREAKER_SRC = `${SOUND_BASE}/breaker.wav`;
/** Ignore brief contact flicker so the loop does not restart mid-strike. */
const BREAKER_STOP_GRACE_MS = 120;

class YanmarAudioController {
  private hornCache = new Map<HornId, HTMLAudioElement>();
  private hornId: HornId = 1;
  private unlocked = false;
  private sfxEnabled = true;
  private bgmEnabled = true;
  private breakerWanted = false;
  private audioCtx: AudioContext | null = null;
  private breakerBuffer: AudioBuffer | null = null;
  private breakerBufferLoading: Promise<AudioBuffer | null> | null = null;
  private breakerSource: AudioBufferSourceNode | null = null;
  private breakerGain: GainNode | null = null;
  private breakerStopTimer: ReturnType<typeof setTimeout> | null = null;

  setActive(active: boolean) {
    // Future BGM: if (active && this.bgmEnabled) startBgm(); else stopBgm();
    if (!active) {
      this.breakerWanted = false;
      this.stopBreakerImmediate();
    }
  }

  setBgmEnabled(enabled: boolean) {
    this.bgmEnabled = enabled;
    // Future: start/stop BGM here when assets are wired (respect this.bgmEnabled).
  }

  setSfxEnabled(enabled: boolean) {
    this.sfxEnabled = enabled;
    if (!enabled) {
      this.breakerWanted = false;
      this.stopBreakerImmediate();
    } else if (this.breakerWanted) {
      void this.startBreaker();
    }
  }

  setHornId(hornId: HornId) {
    this.hornId = hornId;
  }

  /** Call from a user gesture so subsequent playback can start. */
  unlock() {
    if (typeof window === "undefined") return;
    void this.ensureAudioContext();
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
      })
      .catch(() => {
        probe.src = "";
      });
  }

  playHorn(hornId: HornId = this.hornId) {
    if (typeof window === "undefined") return;
    let audio = this.hornCache.get(hornId);
    if (!audio) {
      audio = new Audio(HORN_SRC[hornId]);
      audio.preload = "auto";
      audio.volume = 0.7;
      this.hornCache.set(hornId, audio);
    }
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
      if (!this.sfxEnabled) return;
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
    if (!ctx || !buffer || !this.breakerWanted || !this.sfxEnabled) return;
    if (this.breakerSource) return;

    const gain = ctx.createGain();
    gain.gain.value = 0.75;
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

  dispose() {
    this.breakerWanted = false;
    this.stopBreakerImmediate();
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
  }
}

export const yanmarAudio = new YanmarAudioController();
