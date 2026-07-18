import type { ChassisModelId } from "@/games/yanmar/chassisCatalog";
import {
  CHASSIS_CATALOG,
  DEFAULT_CHASSIS_ID,
} from "@/games/yanmar/chassisCatalog";
import { chassisModelThumbSrc } from "@/games/yanmar/gearArt";

/** 닉네임 변경(최초 설정 제외) 비용 */
export const NICKNAME_CHANGE_COST_STARS = 300;

/** 한글 음절 등 유니코드 코드포인트 기준 길이 */
export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 6;

export function nicknameCharLength(value: string): number {
  return Array.from(value).length;
}

export type NicknameValidationError =
  | "EMPTY"
  | "TOO_SHORT"
  | "TOO_LONG"
  | "INVALID_TYPE";

export function validateNickname(
  value: unknown,
):
  | { ok: true; nickname: string }
  | { ok: false; code: NicknameValidationError; message: string } {
  if (typeof value !== "string") {
    return {
      ok: false,
      code: "INVALID_TYPE",
      message: `닉네임은 ${NICKNAME_MIN_LENGTH}~${NICKNAME_MAX_LENGTH}글자로 입력해 주세요.`,
    };
  }
  const nickname = value.trim();
  const length = nicknameCharLength(nickname);
  if (length === 0) {
    return {
      ok: false,
      code: "EMPTY",
      message: `닉네임은 ${NICKNAME_MIN_LENGTH}글자 이상 입력해 주세요.`,
    };
  }
  if (length < NICKNAME_MIN_LENGTH) {
    return {
      ok: false,
      code: "TOO_SHORT",
      message: `닉네임은 ${NICKNAME_MIN_LENGTH}글자 이상이어야 합니다. (현재 ${length}글자)`,
    };
  }
  if (length > NICKNAME_MAX_LENGTH) {
    return {
      ok: false,
      code: "TOO_LONG",
      message: `닉네임은 ${NICKNAME_MAX_LENGTH}글자 이하여야 합니다. (현재 ${length}글자)`,
    };
  }
  return { ok: true, nickname };
}

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
