import type { GameId } from "@/lib/games";
import { GAMES } from "@/lib/games";
import type { MissionConfig } from "./shared/types";

function hexToNum(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

const MISSION_META: Record<
  GameId,
  Pick<MissionConfig, "target" | "duration" | "missionType">
> = {
  yanmar: { target: 10, duration: 90, missionType: "excavate" },
  johndeere: { target: 16, duration: 90, missionType: "fill" },
  manitou: { target: 5, duration: 90, missionType: "deliver" },
  wirtgen: { target: 20, duration: 75, missionType: "drive" },
  voegle: { target: 30, duration: 90, missionType: "pave" },
  gehl: { target: 6, duration: 90, missionType: "deliver" },
  hamm: { target: 35, duration: 90, missionType: "compact" },
  kleemann: { target: 12, duration: 90, missionType: "sort" },
};

export function getMissionConfig(gameId: GameId): MissionConfig {
  const game = GAMES.find((g) => g.id === gameId)!;
  const meta = MISSION_META[gameId];
  return {
    gameId,
    ...meta,
    brandColor: hexToNum(game.color),
    headerColor: hexToNum(game.headerColor),
  };
}

export async function loadSceneClass(gameId: GameId) {
  const scenes = await import("./scenes/MissionScenes");
  switch (gameId) {
    case "yanmar":
      return scenes.CollectMissionScene;
    case "johndeere":
    case "wirtgen":
      return scenes.DriveMissionScene;
    case "manitou":
    case "gehl":
      return scenes.DeliverMissionScene;
    case "voegle":
      return scenes.PaveMissionScene;
    case "hamm":
      return scenes.CompactMissionScene;
    case "kleemann":
      return scenes.SortMissionScene;
    default:
      return scenes.CollectMissionScene;
  }
}

export function isValidGameId(id: string): id is GameId {
  return GAMES.some((g) => g.id === id);
}
