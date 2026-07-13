import type { HornId } from "./soundSettings";

const SOUND_BASE = "/sounds/yanmar";

const HORN_SRC: Record<HornId, string> = {
  1: `${SOUND_BASE}/horn-1.wav`,
  2: `${SOUND_BASE}/horn-2.wav`,
  3: `${SOUND_BASE}/horn-3.wav`,
  4: `${SOUND_BASE}/horn-4.wav`,
};

class YanmarAudioController {
  private hornCache = new Map<HornId, HTMLAudioElement>();
  private hornId: HornId = 1;
  private unlocked = false;

  setActive(_active: boolean) {
    // BGM / workplace loops removed; reserved for future ambient audio.
  }

  setHornId(hornId: HornId) {
    this.hornId = hornId;
  }

  /** Call from a user gesture so subsequent playback can start. */
  unlock() {
    if (typeof window === "undefined" || this.unlocked) return;
    const probe = new Audio(HORN_SRC[this.hornId]);
    probe.volume = 0;
    void probe
      .play()
      .then(() => {
        probe.pause();
        probe.src = "";
        this.unlocked = true;
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
      });
    } catch {
      // ignore
    }
  }

  dispose() {
    for (const audio of this.hornCache.values()) {
      audio.pause();
      audio.src = "";
    }
    this.hornCache.clear();
  }
}

export const yanmarAudio = new YanmarAudioController();
