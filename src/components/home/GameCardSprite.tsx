"use client";

import type { GameId } from "@/lib/games";

interface GameCardSpriteProps {
  gameId: GameId;
  className?: string;
}

export function GameCardSprite({ gameId, className = "" }: GameCardSpriteProps) {
  return (
    // Generated card art is decorative; the surrounding card carries the label.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/images/equipment-cards/${gameId}.webp`}
      alt=""
      aria-hidden
      draggable={false}
      className={`game-card-equipment-image ${className}`}
    />
  );
}
