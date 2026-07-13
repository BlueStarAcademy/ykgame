const STORAGE_KEY = "ykgame:yanmar:sound-settings:v3";

export const HORN_OPTIONS = [
  { id: 1 as const, label: "경적1" },
  { id: 2 as const, label: "경적2" },
  { id: 3 as const, label: "경적3" },
  { id: 4 as const, label: "경적4" },
];

export type HornId = (typeof HORN_OPTIONS)[number]["id"];

export interface SoundSettings {
  hornId: HornId;
  /** Reserved for future BGM; persisted so the toggle works when audio is added. */
  bgmEnabled: boolean;
  /** Currently gates breaker strike SFX (and future effect sounds). */
  sfxEnabled: boolean;
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  hornId: 1,
  bgmEnabled: true,
  sfxEnabled: true,
};

function isHornId(value: unknown): value is HornId {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isValidSettings(value: unknown): value is SoundSettings {
  if (!value || typeof value !== "object") return false;
  const settings = value as Partial<SoundSettings>;
  return (
    isHornId(settings.hornId) &&
    isBoolean(settings.bgmEnabled) &&
    isBoolean(settings.sfxEnabled)
  );
}

function migrateFromLegacy(raw: string | null): SoundSettings | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const legacy = parsed as Partial<SoundSettings> & { hornId?: unknown };
    if (!isHornId(legacy.hornId)) return null;
    return {
      hornId: legacy.hornId,
      bgmEnabled: isBoolean(legacy.bgmEnabled)
        ? legacy.bgmEnabled
        : DEFAULT_SOUND_SETTINGS.bgmEnabled,
      sfxEnabled: isBoolean(legacy.sfxEnabled)
        ? legacy.sfxEnabled
        : DEFAULT_SOUND_SETTINGS.sfxEnabled,
    };
  } catch {
    return null;
  }
}

export function loadSoundSettings(): SoundSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SOUND_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isValidSettings(parsed)) {
        return {
          hornId: parsed.hornId,
          bgmEnabled: parsed.bgmEnabled,
          sfxEnabled: parsed.sfxEnabled,
        };
      }
      window.localStorage.removeItem(STORAGE_KEY);
    }

    for (const key of [
      "ykgame:yanmar:sound-settings:v2",
      "ykgame:yanmar:sound-settings:v1",
    ]) {
      const migrated = migrateFromLegacy(window.localStorage.getItem(key));
      if (migrated) {
        saveSoundSettings(migrated);
        window.localStorage.removeItem(key);
        return migrated;
      }
    }

    return { ...DEFAULT_SOUND_SETTINGS };
  } catch {
    return { ...DEFAULT_SOUND_SETTINGS };
  }
}

export function saveSoundSettings(settings: SoundSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota / private mode
  }
}
