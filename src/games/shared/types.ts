import type { GameId } from "@/lib/games";

export interface GameResult {
  gameId: GameId;
  progress: number;
  playTime: number;
  timeLeft: number;
  completed: boolean;
}

export interface MissionConfig {
  gameId: GameId;
  duration: number;
  target: number;
  missionType:
    | "collect"
    | "fill"
    | "deliver"
    | "drive"
    | "pave"
    | "compact"
    | "sort"
    | "excavate";
  brandColor: number;
  headerColor: number;
}

export type GameEndCallback = (result: GameResult) => void;
