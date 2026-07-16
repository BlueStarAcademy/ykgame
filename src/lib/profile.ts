import type { ChassisModelId } from "@/games/yanmar/chassisCatalog";
import {
  CHASSIS_CATALOG,
  DEFAULT_CHASSIS_ID,
} from "@/games/yanmar/chassisCatalog";
import { chassisModelThumbSrc } from "@/games/yanmar/gearArt";

/** 닉네임 변경(최초 설정 제외) 비용 */
export const NICKNAME_CHANGE_COST_STARS = 300;

export function isValidProfileAvatarId(
  id: unknown,
): id is ChassisModelId {
  return (
    typeof id === "string" && CHASSIS_CATALOG.some((c) => c.id === id)
  );
}

export function resolveProfileAvatarId(
  profileAvatarId: string | null | undefined,
  fallbackChassisId?: string | null,
): ChassisModelId {
  if (isValidProfileAvatarId(profileAvatarId)) return profileAvatarId;
  if (isValidProfileAvatarId(fallbackChassisId)) return fallbackChassisId;
  return DEFAULT_CHASSIS_ID;
}

export function profileAvatarSrc(
  profileAvatarId: string | null | undefined,
  fallbackChassisId?: string | null,
): string {
  const id = resolveProfileAvatarId(profileAvatarId, fallbackChassisId);
  return chassisModelThumbSrc(id);
}
