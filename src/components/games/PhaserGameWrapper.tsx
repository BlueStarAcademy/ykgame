"use client";

import { useEffect, useRef } from "react";
import type { GameId } from "@/lib/games";
import { getGameById } from "@/lib/games";
import { getMissionConfig, loadSceneClass } from "@/games/registry";
import type { GameResult } from "@/games/shared/types";

interface PhaserGameWrapperProps {
  gameId: GameId;
  onEnd: (result: GameResult) => void;
}

export function PhaserGameWrapper({ gameId, onEnd }: PhaserGameWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<{ destroy: (v: boolean) => void } | null>(null);
  const onEndRef = useRef(onEnd);
  const game = getGameById(gameId);

  onEndRef.current = onEnd;

  useEffect(() => {
    if (!containerRef.current) return;

    let destroyed = false;

    async function start() {
      const Phaser = (await import("phaser")).default;
      const config = getMissionConfig(gameId);
      const SceneClass = await loadSceneClass(gameId);

      class MissionScene extends SceneClass {
        constructor() {
          super(`mission-${gameId}`);
        }
      }

      if (destroyed || !containerRef.current) return;

      const phaserGame = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: containerRef.current.clientWidth || 360,
        height: 480,
        backgroundColor: "#87CEEB",
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        scene: MissionScene,
        input: { activePointers: 2 },
      });

      phaserGame.scene.start(`mission-${gameId}`, {
        config,
        onEnd: (gameResult: GameResult) => {
          onEndRef.current(gameResult);
          phaserGame.destroy(true);
        },
      });

      gameRef.current = phaserGame;
    }

    start();

    return () => {
      destroyed = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [gameId]);

  return (
    <div className="mx-auto w-full max-w-lg">
      <div
        ref={containerRef}
        className="h-[480px] w-full overflow-hidden rounded-b-xl bg-sky-200 shadow-lg"
      />
      <p className="mt-2 text-center text-xs text-gray-400">
        {game?.brandKo} · {game?.mission}
      </p>
    </div>
  );
}
