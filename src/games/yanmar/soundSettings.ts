const STORAGE_KEY = "ykgame:yanmar:sound-settings:v2";

export const HORN_OPTIONS = [
  { id: 1 as const, label: "경적1" },
  { id: 2 as const, label: "경적2" },
  { id: 3 as const, label: "경적3" },
  { id: 4 as const, label: "경적4" },
];

export type HornId = (typeof HORN_OPTIONS)[number]["id"];

export interface SoundSettings {
  hornId: HornId;
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  hornId: 1,
};

function isHornId(value: unknown): value is HornId {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

function isValidSettings(value: unknown): value is SoundSettings {
  if (!value || typeof value !== "object") return false;
  const settings = value as Partial<SoundSettings>;
  return isHornId(settings.hornId);
}

export function loadSoundSettings(): SoundSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SOUND_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Migrate hornId from v1 if present
      const legacy = window.localStorage.getItem(
        "ykgame:yanmar:sound-settings:v1",
      );
      if (legacy) {
        const parsed: unknown = JSON.parse(legacy);
        if (
          parsed &&
          typeof parsed === "object" &&
          isHornId((parsed as { hornId?: unknown }).hornId)
        ) {
          const next = { hornId: (parsed as SoundSettings).hornId };
          saveSoundSettings(next);
          window.localStorage.removeItem("ykgame:yanmar:sound-settings:v1");
          return next;
        }
      }
      return { ...DEFAULT_SOUND_SETTINGS };
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isValidSettings(parsed)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return { ...DEFAULT_SOUND_SETTINGS };
    }
    return { hornId: parsed.hornId };
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
