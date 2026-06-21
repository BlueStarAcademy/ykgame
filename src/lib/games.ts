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
