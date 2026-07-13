/** Preset reasons shown in admin sanction UI */
export const SANCTION_REASON_PRESETS = [
  "부정 행위 / 어뷰징",
  "욕설·비매너 행위",
  "운영 정책 위반",
  "비정상 이용 의심",
] as const;

export const SANCTION_REASON_CUSTOM = "__custom__";

export type SanctionReasonPreset = (typeof SANCTION_REASON_PRESETS)[number];
