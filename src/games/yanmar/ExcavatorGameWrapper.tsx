"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameResult } from "@/games/shared/types";
import { getMissionConfig } from "@/games/registry";
import type { ControlMask, ExcavatorControlState } from "./controls";
import { filterInput } from "./controls";
import { CockpitOverlay } from "./CockpitOverlay";
import { TutorialIntro } from "./TutorialIntro";
import {
  ExcavatorScene,
  createInitialSim,
  createInitialTerrain,
  type ExcavatorSimState,
} from "./ExcavatorScene";
import type { TerrainData } from "./terrain";
import {
  createScoreState,
  getProgress,
  isComplete,
  isTimeUp,
  tickTimer,
  type DiggingScoreState,
} from "./scoring";
import {
  ALL_CONTROLS,
  checkTutorialStepComplete,
  TUTORIAL_STEPS,
  type GameMode,
  type TutorialStep,
} from "./tutorial";

interface ExcavatorGameWrapperProps {
  onEnd: (result: GameResult) => void;
  immersive?: boolean;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function resetSim(sim: ExcavatorSimState) {
  const init = createInitialSim();
  Object.assign(sim, init);
}

export function ExcavatorGameWrapper({ onEnd, immersive = false }: ExcavatorGameWrapperProps) {
  const config = getMissionConfig("yanmar");
  const [mode, setMode] = useState<GameMode>("intro");
  const [tutorialIndex, setTutorialIndex] = useState(0);
  const [input, setInput] = useState<ExcavatorControlState>({
    left: { x: 0, y: 0 },
    right: { x: 0, y: 0 },
    travel: 0,
  });
  const [hud, setHud] = useState({ progress: 0, timeLeft: config.duration, bucketLoad: 0 });
  const [stepCompleteFlash, setStepCompleteFlash] = useState(false);
  const endedRef = useRef(false);
  const elapsedRef = useRef(0);
  const tutorialDumpRef = useRef(0);
  const tutorialCompletingRef = useRef(false);
  const tutorialIndexRef = useRef(0);
  const lastHudProgressRef = useRef(-1);

  const inputRef = useRef(input);
  inputRef.current = input;

  const modeRef = useRef<GameMode>(mode);
  modeRef.current = mode;

  const simRef = useRef<ExcavatorSimState>(createInitialSim());
  const terrainRef = useRef<TerrainData>(createInitialTerrain());
  const scoreRef = useRef<DiggingScoreState>(
    createScoreState(config.target, config.duration),
  );

  const tutorialStep: TutorialStep | null =
    mode === "tutorial" ? TUTORIAL_STEPS[tutorialIndex] ?? null : null;

  const tutorialStepRef = useRef<TutorialStep | null>(tutorialStep);
  tutorialStepRef.current = tutorialStep;
  tutorialIndexRef.current = tutorialIndex;

  const allowed: ControlMask =
    mode === "game" ? ALL_CONTROLS : (tutorialStep?.allowed ?? ALL_CONTROLS);

  const allowedRef = useRef<ControlMask>(allowed);
  allowedRef.current = allowed;

  const startGame = useCallback(() => {
    resetSim(simRef.current);
    terrainRef.current = createInitialTerrain();
    scoreRef.current = createScoreState(config.target, config.duration);
    tutorialDumpRef.current = 0;
    endedRef.current = false;
    elapsedRef.current = 0;
    lastHudProgressRef.current = -1;
    setHud({ progress: 0, timeLeft: config.duration, bucketLoad: 0 });
    setMode("game");
  }, [config.duration, config.target]);

  const startTutorial = useCallback(() => {
    resetSim(simRef.current);
    terrainRef.current = createInitialTerrain();
    tutorialDumpRef.current = 0;
    tutorialCompletingRef.current = false;
    setTutorialIndex(0);
    setMode("tutorial");
  }, []);

  const advanceTutorial = useCallback(() => {
    if (tutorialCompletingRef.current) return;
    tutorialCompletingRef.current = true;
    setStepCompleteFlash(true);
    window.setTimeout(() => setStepCompleteFlash(false), 600);

    const next = tutorialIndexRef.current + 1;
    if (next >= TUTORIAL_STEPS.length) {
      startGame();
    } else {
      setTutorialIndex(next);
    }
    window.setTimeout(() => {
      tutorialCompletingRef.current = false;
    }, 800);
  }, [startGame]);

  const handleTutorialTick = useCallback(() => {
    if (modeRef.current !== "tutorial") return;
    const step = tutorialStepRef.current;
    if (!step) return;
    if (
      checkTutorialStepComplete(step, simRef.current, tutorialDumpRef.current)
    ) {
      advanceTutorial();
    }
    const load = simRef.current.bucketLoad;
    setHud((h) =>
      Math.abs(h.bucketLoad - load) < 0.02 ? h : { ...h, bucketLoad: load },
    );
  }, [advanceTutorial]);

  const handleProgress = useCallback(
    (dumped: number, progress: number) => {
      if (progress !== lastHudProgressRef.current) {
        lastHudProgressRef.current = progress;
        setHud((h) => ({
          ...h,
          progress,
          bucketLoad: simRef.current.bucketLoad,
        }));
      }
      if (!endedRef.current && dumped >= config.target) {
        endedRef.current = true;
        onEnd({
          gameId: "yanmar",
          progress: 100,
          playTime: Math.round(elapsedRef.current),
          timeLeft: Math.ceil(scoreRef.current.timeLeft),
          completed: true,
        });
      }
    },
    [config.target, onEnd],
  );

  useEffect(() => {
    if (mode !== "game") return;
    let raf: number;
    let last = performance.now();

    const tick = (now: number) => {
      if (endedRef.current) return;
      const dt = (now - last) / 1000;
      last = now;
      elapsedRef.current += dt;
      tickTimer(scoreRef.current, dt);
      setHud((h) => ({
        ...h,
        timeLeft: scoreRef.current.timeLeft,
        bucketLoad: simRef.current.bucketLoad,
        progress: getProgress(scoreRef.current),
      }));

      if (isTimeUp(scoreRef.current) && !isComplete(scoreRef.current)) {
        endedRef.current = true;
        onEnd({
          gameId: "yanmar",
          progress: getProgress(scoreRef.current),
          playTime: Math.round(elapsedRef.current),
          timeLeft: 0,
          completed: false,
        });
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, onEnd]);

  useEffect(() => {
    const keys = new Set<string>();
    const updateKeys = () => {
      const left = { x: 0, y: 0 };
      const right = { x: 0, y: 0 };
      let travel = 0;
      if (keys.has("a") || keys.has("arrowleft")) left.x = -1;
      if (keys.has("d") || keys.has("arrowright")) left.x = 1;
      if (keys.has("q")) left.y = -1;
      if (keys.has("e")) left.y = 1;
      if (keys.has("w") || keys.has("arrowup")) travel = 1;
      if (keys.has("s") || keys.has("arrowdown")) travel = -1;
      if (keys.has("j")) right.x = -1;
      if (keys.has("l")) right.x = 1;
      if (keys.has("i")) right.y = 1;
      if (keys.has("k")) right.y = -1;
      setInput(filterInput({ left, right, travel }, allowedRef.current));
    };
    const down = (e: KeyboardEvent) => {
      keys.add(e.key.toLowerCase());
      updateKeys();
    };
    const up = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
      updateKeys();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const cockpitBottom = immersive ? "bottom-[44%]" : "bottom-[46%]";

  return (
    <div
      className={`relative touch-manipulation ${immersive ? "h-full w-full" : "mx-auto w-full max-w-lg"}`}
    >
      <div
        className={`relative w-full overflow-hidden bg-black ${
          immersive ? "h-full" : "h-[520px] rounded-b-xl shadow-lg"
        }`}
      >
        {mode === "game" && (
          <div className="absolute left-0 right-0 top-0 z-20 flex justify-between p-2">
            <div className="rounded-lg bg-black/60 px-3 py-1 text-sm font-bold text-white">
              진행: {hud.progress}%
            </div>
            <div className="rounded-lg bg-black/60 px-3 py-1 text-sm font-bold text-white">
              {formatTime(hud.timeLeft)}
            </div>
          </div>
        )}

        {mode === "tutorial" && tutorialStep && (
          <div className="absolute right-2 z-20 rounded bg-black/40 px-1.5 py-0.5 text-[9px] text-white/70"
            style={{ bottom: `calc(${((682 / 1024) * 100).toFixed(1)}% + 2.75rem)` }}
          >
            {tutorialIndex + 1}/{TUTORIAL_STEPS.length}
          </div>
        )}

        {mode === "game" && (
          <>
            <div className="absolute left-2 top-10 z-20 rounded-lg bg-black/50 px-2 py-1 text-xs text-white">
              적재 {Math.round(hud.bucketLoad * 100)}%
            </div>
            <div className="absolute right-2 top-10 z-20 rounded-lg bg-orange-600/80 px-2 py-1 text-[10px] text-white">
              🟠 굴착구역
            </div>
            <div className="absolute right-2 top-[4.5rem] z-20 rounded-lg bg-green-600/80 px-2 py-1 text-[10px] text-white">
              🟢 덤프존
            </div>
          </>
        )}

        {stepCompleteFlash && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
            <div className="rounded-xl bg-emerald-500/90 px-4 py-2 text-sm font-bold text-white shadow-lg">
              ✓ 완료!
            </div>
          </div>
        )}

        {mode !== "intro" && (
          <div className={`absolute inset-x-0 top-0 z-0 ${cockpitBottom}`}>
            <ExcavatorScene
              inputRef={inputRef}
              simRef={simRef}
              terrainRef={terrainRef}
              scoreRef={scoreRef}
              modeRef={modeRef}
              allowedRef={allowedRef}
              tutorialStepRef={tutorialStepRef}
              tutorialDumpRef={tutorialDumpRef}
              onProgress={handleProgress}
              onTutorialTick={handleTutorialTick}
            />
          </div>
        )}

        {mode !== "intro" && (
          <CockpitOverlay
            input={input}
            onInputChange={(next) =>
              setInput(filterInput(next, allowedRef.current))
            }
            allowed={allowed}
            tutorialStep={tutorialStep}
            onSkipTutorial={mode === "tutorial" ? startGame : undefined}
          />
        )}

        {mode === "game" && (
          <button
            type="button"
            onClick={startTutorial}
            className="absolute bottom-[46%] right-3 z-20 rounded-lg bg-black/55 px-2.5 py-1 text-xs text-white backdrop-blur hover:bg-black/70"
          >
            조작 연습
          </button>
        )}

        {mode === "intro" && (
          <TutorialIntro onStartTutorial={startTutorial} onSkip={startGame} />
        )}
      </div>
      {!immersive && (
        <p className="mt-2 text-center text-xs text-gray-400">
          얀마 · 굴삭기로 흙을 퍼서 옮기기
        </p>
      )}
    </div>
  );
}
