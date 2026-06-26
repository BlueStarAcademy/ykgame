"use client";

import type { GameId } from "@/lib/games";
import { getSpriteSheetPath, SPRITE_FRAME_COUNT, SPRITE_FRAME_WIDTH } from "@/games/shared/equipmentArt";

interface GameCardSpriteProps {
  gameId: GameId;
  className?: string;
}

export function GameCardSprite({ gameId, className = "" }: GameCardSpriteProps) {
  const sheetWidth = SPRITE_FRAME_WIDTH * SPRITE_FRAME_COUNT;

  return (
    <div
      role="img"
      aria-hidden
      className={`game-card-sprite ${className}`}
      style={{
        backgroundImage: `url(${getSpriteSheetPath(gameId)})`,
        width: SPRITE_FRAME_WIDTH,
        height: 64,
        backgroundSize: `${sheetWidth}px 64px`,
      }}
    />
  );
}
