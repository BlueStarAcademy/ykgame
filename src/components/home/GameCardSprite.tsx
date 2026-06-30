"use client";

import type { GameId } from "@/lib/games";
import { getSpriteSheetPath, SPRITE_FRAME_COUNT, SPRITE_FRAME_WIDTH } from "@/games/shared/equipmentArt";

const YANMAR_CARD_IMAGE = "/images/yanmar.webp";

interface GameCardSpriteProps {
  gameId: GameId;
  className?: string;
}

export function GameCardSprite({ gameId, className = "" }: GameCardSpriteProps) {
  if (gameId === "yanmar") {
    return (
      <div className={`game-card-yanmar-wrap ${className}`}>
        <div className="game-card-yanmar-flip">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={YANMAR_CARD_IMAGE}
            alt=""
            aria-hidden
            className="game-card-yanmar-image"
            width={39}
            height={48}
          />
        </div>
      </div>
    );
  }

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
