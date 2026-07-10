export type GameId =
  | "yanmar"
  | "johndeere"
  | "manitou"
  | "wirtgen"
  | "voegle"
  | "gehl"
  | "hamm"
  | "kleemann";

export interface GameConfig {
  id: GameId;
  number: number;
  brandKo: string;
  brandEn: string;
  mission: string;
  description: string;
  duration: number;
  color: string;
  headerColor: string;
  controlType: "dpad" | "steering" | "buttons" | "excavator";
  /** Animated sprite sheet used on home cards and in Phaser gameplay */
  spriteSheet: string;
}

export const GAMES: GameConfig[] = [
  {
    id: "yanmar",
    number: 1,
    brandKo: "얀마",
    brandEn: "YANMAR",
    mission: "굴착·하역 아케이드 챌린지",
    description:
      "1인칭 운전실에서 듀얼 조이스틱으로 SV08-1을 조종하세요. 주황 굴착 구역에서 흙을 채취해 초록 하역 구역에 투하하면 점수와 스타·쿠폰 보상을 획득합니다. 장비강화로 적재량·크리티컬을 높여보세요.",
    duration: 0,
    color: "#E53935",
    headerColor: "#C62828",
    controlType: "excavator",
    spriteSheet: "/games/yanmar/sprite.png",
  },
  {
    id: "johndeere",
    number: 2,
    brandKo: "존디어",
    brandEn: "JOHN DEERE",
    mission: "트랙터로 밭 갈기",
    description:
      "트랙터를 운전해 밭을 고르게 갈아주세요. 조향 휠로 방향을 조절하며 전체 구역을 완료하세요.",
    duration: 90,
    color: "#2E7D32",
    headerColor: "#1B5E20",
    controlType: "steering",
    spriteSheet: "/games/johndeere/sprite.png",
  },
  {
    id: "manitou",
    number: 3,
    brandKo: "마니또",
    brandEn: "MANITOU",
    mission: "톤백 옮기기",
    description:
      "지게차로 톤백을 집어 목표 위치에 배치하세요. 정확한 위치에 놓을수록 높은 점수를 받습니다.",
    duration: 90,
    color: "#8B1A1A",
    headerColor: "#6B0F0F",
    controlType: "dpad",
    spriteSheet: "/games/manitou/sprite.png",
  },
  {
    id: "wirtgen",
    number: 4,
    brandKo: "빌트겐",
    brandEn: "WIRTGEN",
    mission: "도로 작업하기",
    description:
      "도로 작업 장비를 운전해 도로를 정비하세요. 조향으로 경로를 따라 이동하며 작업을 완료합니다.",
    duration: 75,
    color: "#1565C0",
    headerColor: "#0D47A1",
    controlType: "steering",
    spriteSheet: "/games/wirtgen/sprite.png",
  },
  {
    id: "voegle",
    number: 5,
    brandKo: "보겔",
    brandEn: "VÖGELE",
    mission: "아스팔트 포장하기",
    description:
      "포장 장비로 아스팔트를 깔아 도로를 완성하세요. 일정 시간 안에 구간 포장을 마치세요.",
    duration: 90,
    color: "#00838F",
    headerColor: "#006064",
    controlType: "steering",
    spriteSheet: "/games/voegle/sprite.png",
  },
  {
    id: "gehl",
    number: 6,
    brandKo: "겔",
    brandEn: "GEHL",
    mission: "축사에서 퇴비 옮기기",
    description:
      "로더로 축사의 퇴비를 집어 지정 구역으로 운반하세요. D-pad로 장비를 조작합니다.",
    duration: 90,
    color: "#F9A825",
    headerColor: "#F57F17",
    controlType: "dpad",
    spriteSheet: "/games/gehl/sprite.png",
  },
  {
    id: "hamm",
    number: 7,
    brandKo: "햄",
    brandEn: "HAMM",
    mission: "도로 다지기",
    description:
      "롤러로 도로를 고르게 다져주세요. 전체 구간을 압착하여 안전한 도로를 만드세요.",
    duration: 90,
    color: "#EF6C00",
    headerColor: "#E65100",
    controlType: "steering",
    spriteSheet: "/games/hamm/sprite.png",
  },
  {
    id: "kleemann",
    number: 8,
    brandKo: "클래만",
    brandEn: "KLEEMANN",
    mission: "암석 분쇄 및 선별하기",
    description:
      "크러셔로 암석을 분쇄하고 크기별로 선별하세요. 버튼으로 작업 속도를 조절합니다.",
    duration: 90,
    color: "#1A237E",
    headerColor: "#0D1642",
    controlType: "buttons",
    spriteSheet: "/games/kleemann/sprite.png",
  },
];

export const AVAILABLE_GAME_IDS: GameId[] = ["yanmar"];

export function isGameAvailable(id: string): boolean {
  return AVAILABLE_GAME_IDS.includes(id as GameId);
}

export function getGameById(id: string): GameConfig | undefined {
  return GAMES.find((g) => g.id === id);
}

export interface SeasonInfo {
  key: string;
  year: number;
  season: number;
  label: string;
  endsAt: Date;
}

/** Asia/Seoul (KST, UTC+9). All season boundaries use KST midnight. */
export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function getKstParts(date = new Date()) {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return {
    year: kst.getUTCFullYear(),
    /** 0–11 */
    month: kst.getUTCMonth(),
    day: kst.getUTCDate(),
    hours: kst.getUTCHours(),
    minutes: kst.getUTCMinutes(),
    seconds: kst.getUTCSeconds(),
  };
}

function getSeasonNumber(month: number): number {
  return Math.floor(month / 3) + 1;
}

export function getSeasonKey(date = new Date()): string {
  const { year, month } = getKstParts(date);
  const season = getSeasonNumber(month);
  return `${year}-${season}`;
}

export function parseSeasonKey(key: string): { year: number; season: number } | null {
  const match = key.match(/^(\d{4})-([1-4])$/);
  if (!match) return null;
  return { year: Number(match[1]), season: Number(match[2]) };
}

/** 시즌 키와 이전 월간 키(2026-07 등)를 함께 조회해 레거시 점수를 포함합니다. */
export function getSeasonPeriodKeys(seasonKey: string): string[] {
  const parsed = parseSeasonKey(seasonKey);
  if (!parsed) return [seasonKey];

  const keys = new Set<string>([seasonKey]);
  const startMonth = (parsed.season - 1) * 3 + 1;
  for (let month = startMonth; month < startMonth + 3; month++) {
    keys.add(`${parsed.year}-${String(month).padStart(2, "0")}`);
  }
  return Array.from(keys);
}

export function legacyMonthKeyToSeasonKey(monthKey: string): string | null {
  const match = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const season = Math.floor((month - 1) / 3) + 1;
  return `${year}-${season}`;
}

export function getSeasonEndDate(seasonKey: string): Date {
  const parsed = parseSeasonKey(seasonKey);
  if (!parsed) return new Date();
  let nextYear = parsed.year;
  let nextSeasonStartMonth = parsed.season * 3;
  if (nextSeasonStartMonth >= 12) {
    nextYear += 1;
    nextSeasonStartMonth = 0;
  }
  // Next season starts at KST 00:00 → end of current season is 1ms before that.
  return new Date(
    Date.UTC(nextYear, nextSeasonStartMonth, 1, 0, 0, 0, 0) - KST_OFFSET_MS - 1,
  );
}

export function formatSeasonLabel(seasonKey: string): string {
  const parsed = parseSeasonKey(seasonKey);
  if (!parsed) return seasonKey;
  return `${parsed.year}년 ${parsed.season}시즌`;
}

export function getSeasonInfo(date = new Date()): SeasonInfo {
  const key = getSeasonKey(date);
  const parsed = parseSeasonKey(key)!;
  return {
    key,
    year: parsed.year,
    season: parsed.season,
    label: formatSeasonLabel(key),
    endsAt: getSeasonEndDate(key),
  };
}

/** Previous seasons going backward from `fromKey` (inclusive of fromKey). */
export function listRecentSeasonKeys(fromKey: string, count: number): string[] {
  const parsed = parseSeasonKey(fromKey);
  if (!parsed || count < 1) return [];

  const keys: string[] = [];
  let year = parsed.year;
  let season = parsed.season;
  for (let i = 0; i < count; i++) {
    keys.push(`${year}-${season}`);
    season -= 1;
    if (season < 1) {
      season = 4;
      year -= 1;
    }
  }
  return keys;
}

export function formatSeasonRemaining(endsAt: Date, now = new Date()): string {
  const ms = Math.max(0, endsAt.getTime() - now.getTime());
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  const days = Math.floor(ms / dayMs);
  const hours = Math.floor((ms % dayMs) / hourMs);
  return `${days}일${hours}시간`;
}

/** @deprecated Use getSeasonKey for ranking periods */
export function getMonthKey(date = new Date()): string {
  return getSeasonKey(date);
}

export function calculateStars(progress: number): number {
  if (progress >= 100) return 3;
  if (progress >= 80) return 2;
  if (progress >= 50) return 1;
  return 0;
}

export function calculateScore(progress: number, timeLeft: number): number {
  return Math.round(progress * 10 + timeLeft * 2);
}
