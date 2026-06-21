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
  controlType: "dpad" | "steering" | "buttons";
}

export const GAMES: GameConfig[] = [
  {
    id: "yanmar",
    number: 1,
    brandKo: "얀마",
    brandEn: "YANMAR",
    mission: "굴삭기로 흙을 퍼서 옮기기",
    description:
      "굴삭기를 조작해 흙을 파서 목표 지점까지 옮기세요. D-pad로 이동하고 버튼으로 작업합니다.",
    duration: 90,
    color: "#E53935",
    headerColor: "#C62828",
    controlType: "dpad",
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
  },
];

export function getGameById(id: string): GameConfig | undefined {
  return GAMES.find((g) => g.id === id);
}

export function getMonthKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
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
