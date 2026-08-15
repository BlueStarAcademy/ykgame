import { containsProfanity } from "@/lib/profanity";

/** 닉네임 변경(최초 설정 제외) 비용 */
export const NICKNAME_CHANGE_COST_STARS = 2000;

export const PROFILE_AVATAR_IDS = [
  "initial",
  "yanmar-01",
  "yanmar-02",
  "yanmar-03",
  "yanmar-04",
  "yanmar-05",
  "yanmar-06",
  "yanmar-07",
  "yanmar-08",
  "yanmar-09",
  "yanmar-10",
] as const;
export type ProfileAvatarId = (typeof PROFILE_AVATAR_IDS)[number];

/** 한글 음절 등 유니코드 코드포인트 기준 길이 */
export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 7;

export function nicknameCharLength(value: string): number {
  return Array.from(value).length;
}

export type NicknameValidationError =
  | "EMPTY"
  | "TOO_SHORT"
  | "TOO_LONG"
  | "INVALID_TYPE"
  | "PROFANITY";

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
  if (containsProfanity(nickname)) {
    return {
      ok: false,
      code: "PROFANITY",
      message: "부적절한 단어가 있습니다.",
    };
  }
  return { ok: true, nickname };
}

export function isValidProfileAvatarId(
  id: unknown,
): id is ProfileAvatarId {
  return (
    typeof id === "string" &&
    (PROFILE_AVATAR_IDS as readonly string[]).includes(id)
  );
}

export function resolveProfileAvatarId(
  profileAvatarId: string | null | undefined,
): ProfileAvatarId {
  if (isValidProfileAvatarId(profileAvatarId)) return profileAvatarId;
  if (profileAvatarId === "yanmar") return "yanmar-01";
  return "initial";
}

export function profileAvatarSrc(
  profileAvatarId: string | null | undefined,
): string | null {
  const avatarId = resolveProfileAvatarId(profileAvatarId);
  return avatarId === "initial"
    ? null
    : `/images/yanmar/2d/avatars/${avatarId}.png?v=1`;
}
