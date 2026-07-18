import {
  DEFAULT_SOUND_SETTINGS,
  loadSoundSettings,
  saveSoundSettings,
  type SoundSettings,
} from "./soundSettings";
import { killAllSiteLegendBgms } from "@/lib/siteLegendBgmRegistry";

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
  // Nuke every BGM element immediately on Off — including HMR orphans
  // that are no longer wired to a live controller listener.
  if (!next.bgmEnabled) {
    killAllSiteLegendBgms({ unload: true });
  }
  emit(next);
  return next;
}
