"use client";

import { DEFAULT_SOUND_SETTINGS, type SoundSettings } from "./soundSettings";
import {
  getSoundSettings,
  setSoundSettings,
  subscribeSoundSettings,
} from "./soundSettingsStore";
import { useCallback, useSyncExternalStore } from "react";

export function useSoundSettings(): [
  SoundSettings,
  (
    patch:
      | Partial<SoundSettings>
      | ((prev: SoundSettings) => SoundSettings),
  ) => SoundSettings,
] {
  const settings = useSyncExternalStore(
    subscribeSoundSettings,
    getSoundSettings,
    () => DEFAULT_SOUND_SETTINGS,
  );

  const update = useCallback(
    (
      patch:
        | Partial<SoundSettings>
        | ((prev: SoundSettings) => SoundSettings),
    ) => setSoundSettings(patch),
    [],
  );

  return [settings, update];
}
