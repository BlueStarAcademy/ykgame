import {
  DEFAULT_SOUND_SETTINGS,
  loadSoundSettings,
  saveSoundSettings,
  type SoundSettings,
} from "./soundSettings";
import {
  killAllSiteLegendBgms,
  setSiteLegendBgmMasterEnabled,
} from "@/lib/siteLegendBgmRegistry";

type SoundSettingsListener = (settings: SoundSettings) => void;

let current: SoundSettings = { ...DEFAULT_SOUND_SETTINGS };
let hydrated = false;
const listeners = new Set<SoundSettingsListener>();

function ensureHydrated(): SoundSettings {
  if (typeof window === "undefined") {
    return { ...DEFAULT_SOUND_SETTINGS };
  }
  if (!hydrated) {
    current = loadSoundSettings();
    hydrated = true;
    // Gate must match storage before any controller can call play().
    setSiteLegendBgmMasterEnabled(current.bgmEnabled);
  }
  return current;
}

export function getSoundSettings(): SoundSettings {
  return ensureHydrated();
}

export function subscribeSoundSettings(
  listener: SoundSettingsListener,
): () => void {
  ensureHydrated();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(settings: SoundSettings) {
  for (const listener of listeners) {
    listener(settings);
  }
}

export function setSoundSettings(
  patch:
    | Partial<SoundSettings>
    | ((prev: SoundSettings) => SoundSettings),
): SoundSettings {
  const prev = ensureHydrated();
  const next =
    typeof patch === "function" ? patch({ ...prev }) : { ...prev, ...patch };
  current = next;
  saveSoundSettings(next);
  // Cancel in-flight play() BEFORE kill/emit — pause during pending play is
  // ignored by some browsers, and late .then() must see Off immediately.
  setSiteLegendBgmMasterEnabled(next.bgmEnabled);
  if (!next.bgmEnabled) {
    killAllSiteLegendBgms({ unload: true });
  }
  emit(next);
  return next;
}
