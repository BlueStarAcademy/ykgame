import type { AuxiliaryControlState } from "./controls";

const STORAGE_PREFIX = "ykgame:yanmar:auxiliary-settings:v1";
const LOCAL_OWNER = "local";

export interface PersistedAuxiliarySettings {
  highSpeed: boolean;
  boomSwing: number;
}

function storageKey(ownerId: string) {
  return `${STORAGE_PREFIX}:${ownerId}`;
}

function isValidSettings(value: unknown): value is PersistedAuxiliarySettings {
  if (!value || typeof value !== "object") return false;
  const settings = value as Partial<PersistedAuxiliarySettings>;
  return (
    typeof settings.highSpeed === "boolean" &&
    typeof settings.boomSwing === "number" &&
    Number.isFinite(settings.boomSwing)
  );
}

function loadForOwner(ownerId: string): PersistedAuxiliarySettings | null {
  try {
    const raw = window.localStorage.getItem(storageKey(ownerId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidSettings(parsed)) {
      window.localStorage.removeItem(storageKey(ownerId));
      return null;
    }
    return {
      highSpeed: parsed.highSpeed,
      boomSwing: Math.max(-1, Math.min(1, parsed.boomSwing)),
    };
  } catch {
    return null;
  }
}

export function resolveAuxiliarySettingsOwner(userId?: string | null) {
  return userId?.trim() ? userId : LOCAL_OWNER;
}

export function loadAuxiliarySettingsForSession(
  userId?: string | null,
): PersistedAuxiliarySettings | null {
  const ownerId = resolveAuxiliarySettingsOwner(userId);
  const owned = loadForOwner(ownerId);
  if (owned || ownerId === LOCAL_OWNER) return owned;

  const local = loadForOwner(LOCAL_OWNER);
  if (local) saveAuxiliarySettings(ownerId, local);
  return local;
}

export function saveAuxiliarySettings(
  ownerId: string,
  settings: Pick<AuxiliaryControlState, "highSpeed" | "boomSwing">,
) {
  try {
    window.localStorage.setItem(
      storageKey(ownerId),
      JSON.stringify({
        highSpeed: settings.highSpeed,
        boomSwing: Math.max(-1, Math.min(1, settings.boomSwing)),
      } satisfies PersistedAuxiliarySettings),
    );
  } catch {
    // 로컬 저장이 차단되어도 현재 게임 조작은 유지한다.
  }
}
