/** 랜딩에서 선택한 체험 유형 (탑승 vs 게임) */

import { withPwaQuery } from "@/lib/pwa-mode";

export type ExperienceMode = "ride" | "game";

export const EXPERIENCE_STORAGE_KEY = "ykgame_experience";

export function setExperienceMode(mode: ExperienceMode): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(EXPERIENCE_STORAGE_KEY, mode);
}

export function getExperienceMode(): ExperienceMode | null {
  if (typeof sessionStorage === "undefined") return null;
  const value = sessionStorage.getItem(EXPERIENCE_STORAGE_KEY);
  return value === "ride" || value === "game" ? value : null;
}

export function experienceDestination(mode: ExperienceMode): string {
  return mode === "ride" ? "/ride" : "/home";
}

export function buildExperienceEntryHref(
  mode: ExperienceMode,
  session: { nickname?: string | null } | null | undefined,
): string {
  const dest = experienceDestination(mode);
  if (session?.nickname) return withPwaQuery(dest);
  if (session) return withPwaQuery("/nickname");
  const callback = encodeURIComponent(dest);
  return withPwaQuery(`/login?callbackUrl=${callback}`);
}
