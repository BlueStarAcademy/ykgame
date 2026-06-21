"use client";

import { useEffect, useRef, useState } from "react";
import type { GameId } from "@/lib/games";
import { getGameById } from "@/lib/games";
import { getMissionConfig, loadSceneClass } from "@/games/registry";
import type { GameResult } from "@/games/shared/types";
import { GameResultScreen } from "./GameResultScreen";

interface PhaserGameWrapperProps {
  gameId: GameId;
}

export function PhaserGameWrapper({ gameId }: PhaserGameWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<{ destroy: (v: boolean) => void } | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const game = getGameById(gameId);

  useEffect(() => {
    if (!containerRef.current || result) return;

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
          setResult(gameResult);
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
  }, [gameId, result]);

  if (result) {
    return <GameResultScreen gameId={gameId} result={result} />;
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <div
        className="mb-2 rounded-t-xl px-4 py-3 text-white"
        style={{ backgroundColor: game?.headerColor }}
      >
        <p className="text-sm font-bold">{game?.brandEn}</p>
        <p className="text-xs opacity-90">{game?.mission}</p>
      </div>
      <div
        ref={containerRef}
        className="h-[480px] w-full overflow-hidden rounded-b-xl bg-sky-200 shadow-lg"
      />
    </div>
  );
}
