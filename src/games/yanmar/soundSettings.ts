const STORAGE_KEY = "ykgame:yanmar:sound-settings:v6";
/** Previous keys kept for one-shot migration. */
const LEGACY_STORAGE_KEYS = [
  "ykgame:yanmar:sound-settings:v5",
  "ykgame:yanmar:sound-settings:v4",
  "ykgame:yanmar:sound-settings:v3",
  "ykgame:yanmar:sound-settings:v2",
  "ykgame:yanmar:sound-settings:v1",
] as const;

export const HORN_OPTIONS = [
  { id: 1 as const, label: "경적1" },
  { id: 2 as const, label: "경적2" },
  { id: 3 as const, label: "경적3" },
  { id: 4 as const, label: "경적4" },
];

export type HornId = (typeof HORN_OPTIONS)[number]["id"];

export const SFX_DETAIL_OPTIONS = [
  { id: "horn", label: "경적" },
  { id: "enhance", label: "강화 결과" },
  { id: "ui", label: "UI 클릭" },
  { id: "engine", label: "엔진 시동·정지" },
  { id: "travel", label: "주행" },
  { id: "breaker", label: "브레이커" },
  { id: "soil", label: "흙 적재·하역" },
  { id: "service", label: "정비소 진입" },
  { id: "monument", label: "기념비 진입" },
  { id: "star", label: "스타 획득" },
  { id: "buff", label: "버프 획득" },
  { id: "item", label: "장비 획득" },
  { id: "masterItem", label: "마스터 장비 획득" },
  { id: "sports", label: "운동회 카운트다운" },
  { id: "roulette", label: "룰렛 회전" },
  { id: "attachment", label: "어태치먼트 해금" },
] as const;

export type SfxDetailId = (typeof SFX_DETAIL_OPTIONS)[number]["id"];

export type SfxDetailSettings = Record<
  SfxDetailId,
  { enabled: boolean; volume: number }
>;

export const DEFAULT_SFX_DETAILS: SfxDetailSettings =
  Object.fromEntries(
    SFX_DETAIL_OPTIONS.map(({ id }) => [id, { enabled: true, volume: 100 }]),
  ) as SfxDetailSettings;

export interface SoundSettings {
  hornId: HornId;
  /** In-game / title looping BGM; persisted with settings menu toggle. */
  bgmEnabled: boolean;
  /** BGM loudness 0–100. */
  bgmVolume: number;
  /** Master gate for effect sounds. */
  sfxEnabled: boolean;
  /** Master SFX loudness 0–100. */
  sfxVolume: number;
  /** Breaker strike loop SFX (under master sfx). */
  breakerSfxEnabled: boolean;
  /** Per-effect gate and relative loudness (under master SFX). */
  sfxDetails: SfxDetailSettings;
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  hornId: 1,
  bgmEnabled: true,
  /** Kept modest so looping BGM does not bury horns / breaker. */
  bgmVolume: 28,
  sfxEnabled: true,
  sfxVolume: 85,
  breakerSfxEnabled: true,
  sfxDetails: DEFAULT_SFX_DETAILS,
};

/**
 * Extra attenuation on BGM relative to the 0–100 slider.
 * Keeps title/in-game beds under SFX at the same slider reading.
 */
export const BGM_MIX_GAIN = 0.52;

function isHornId(value: unknown): value is HornId {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function clampVolume(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeSfxDetails(value: unknown): SfxDetailSettings {
  const raw = value && typeof value === "object" ? value : {};
  return Object.fromEntries(
    SFX_DETAIL_OPTIONS.map(({ id }) => {
      const candidate = (raw as Partial<SfxDetailSettings>)[id];
      return [
        id,
        {
          enabled:
            typeof candidate?.enabled === "boolean"
              ? candidate.enabled
              : DEFAULT_SFX_DETAILS[id].enabled,
          volume: clampVolume(
            candidate?.volume,
            DEFAULT_SFX_DETAILS[id].volume,
          ),
        },
      ];
    }),
  ) as SfxDetailSettings;
}

function isValidSettings(value: unknown): value is SoundSettings {
  if (!value || typeof value !== "object") return false;
  const settings = value as Partial<SoundSettings>;
  return (
    isHornId(settings.hornId) &&
    isBoolean(settings.bgmEnabled) &&
    typeof settings.bgmVolume === "number" &&
    Number.isFinite(settings.bgmVolume) &&
    isBoolean(settings.sfxEnabled) &&
    typeof settings.sfxVolume === "number" &&
    Number.isFinite(settings.sfxVolume) &&
    isBoolean(settings.breakerSfxEnabled) &&
    settings.sfxDetails != null
  );
}

function normalizeSettings(partial: Partial<SoundSettings> & { hornId: HornId }): SoundSettings {
  return {
    hornId: partial.hornId,
    bgmEnabled: isBoolean(partial.bgmEnabled)
      ? partial.bgmEnabled
      : DEFAULT_SOUND_SETTINGS.bgmEnabled,
    bgmVolume: clampVolume(partial.bgmVolume, DEFAULT_SOUND_SETTINGS.bgmVolume),
    sfxEnabled: isBoolean(partial.sfxEnabled)
      ? partial.sfxEnabled
      : DEFAULT_SOUND_SETTINGS.sfxEnabled,
    sfxVolume: clampVolume(partial.sfxVolume, DEFAULT_SOUND_SETTINGS.sfxVolume),
    breakerSfxEnabled: isBoolean(partial.breakerSfxEnabled)
      ? partial.breakerSfxEnabled
      : DEFAULT_SOUND_SETTINGS.breakerSfxEnabled,
    sfxDetails: normalizeSfxDetails(partial.sfxDetails),
  };
}

function migrateFromLegacy(raw: string | null): SoundSettings | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const legacy = parsed as Partial<SoundSettings> & { hornId?: unknown };
    if (!isHornId(legacy.hornId)) return null;
    return normalizeSettings({ ...legacy, hornId: legacy.hornId });
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
        return normalizeSettings(parsed);
      }
      window.localStorage.removeItem(STORAGE_KEY);
    }

    for (const key of LEGACY_STORAGE_KEYS) {
      const migrated = migrateFromLegacy(window.localStorage.getItem(key));
      if (migrated) {
        // Old factory defaults buried SFX under BGM — nudge those to the new mix.
        const remixed =
          migrated.bgmVolume === 40 && migrated.sfxVolume === 75
            ? {
                ...migrated,
                bgmVolume: DEFAULT_SOUND_SETTINGS.bgmVolume,
                sfxVolume: DEFAULT_SOUND_SETTINGS.sfxVolume,
              }
            : migrated;
        saveSoundSettings(remixed);
        window.localStorage.removeItem(key);
        return remixed;
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
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(normalizeSettings(settings)),
    );
  } catch {
    // ignore quota / private mode
  }
}

export function volumeToGain(volume0to100: number): number {
  return clampVolume(volume0to100, 0) / 100;
}

/** BGM slider → element/AudioContext gain (includes mix bed attenuation). */
export function bgmVolumeToGain(volume0to100: number): number {
  return volumeToGain(volume0to100) * BGM_MIX_GAIN;
}
