"use client";

/* eslint-disable react-hooks/immutability */

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameResult } from "@/games/shared/types";
import { getMissionConfig } from "@/games/registry";
import type { AuxiliaryControlState, ControlMask, ExcavatorControlState } from "./controls";
import {
  COCKPIT_LAYOUT,
  LOCKED_CONTROLS,
  createAuxiliaryControls,
  filterInput,
} from "./controls";
import { CockpitOverlay } from "./CockpitOverlay";
import { TutorialIntro } from "./TutorialIntro";
import {
  ExcavatorScene,
  createInitialSim,
  createInitialTerrain,
  type ExcavatorSimState,
} from "./ExcavatorScene";
import { createHydraulicVelocity, type HydraulicVelocity } from "./controls";
import { ExcavatorMinimap } from "./ExcavatorMinimap";
import { BoomLoadGauge } from "./DigHintPanel";
import { DumpHintPanel } from "./DumpHintPanel";
import { ControlsGuidePanel } from "./ControlsGuidePanel";
import { createDigFeedback, type DigFeedback } from "./bucket";
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
  waypointDistance,
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

function resetSim(sim: ExcavatorSimState, vel: HydraulicVelocity) {
  const init = createInitialSim();
  Object.assign(sim, init);
  Object.assign(vel, createHydraulicVelocity());
}

export function ExcavatorGameWrapper({ onEnd, immersive = false }: ExcavatorGameWrapperProps) {
  const config = getMissionConfig("yanmar");
  const [mode, setMode] = useState<GameMode>("intro");
  const [tutorialIndex, setTutorialIndex] = useState(0);
  const [input, setInput] = useState<ExcavatorControlState>({
    left: { x: 0, y: 0 },
    right: { x: 0, y: 0 },
    travel: { left: 0, right: 0 },
  });
  const [auxiliary, setAuxiliary] = useState<AuxiliaryControlState>(
    createAuxiliaryControls,
  );
  const [hud, setHud] = useState({
    progress: 0,
    timeLeft: config.duration,
    bucketLoad: 0,
    goalDist: 0,
    boom: 0.45,
  });
  const [stepCompleteFlash, setStepCompleteFlash] = useState(false);
  const [showControlsGuide, setShowControlsGuide] = useState(false);
  const endedRef = useRef(false);
  const elapsedRef = useRef(0);
  const tutorialDumpRef = useRef(0);
  const tutorialCompletingRef = useRef(false);
  const tutorialIndexRef = useRef(0);
  const digFeedbackRef = useRef<DigFeedback>(createDigFeedback());
  const [digFeedback, setDigFeedback] = useState<DigFeedback>(createDigFeedback());
  const digHudTickRef = useRef(0);
  const lastHudProgressRef = useRef(-1);

  const syncDigHud = useCallback(() => {
    digHudTickRef.current += 1;
    if (digHudTickRef.current % 6 !== 0) return;
    const fb = digFeedbackRef.current;
    setDigFeedback((prev) =>
      prev.inDigZone === fb.inDigZone &&
      prev.inDumpZone === fb.inDumpZone &&
      prev.tipOnGround === fb.tipOnGround &&
      prev.bucketCurled === fb.bucketCurled &&
      prev.digging === fb.digging
        ? prev
        : { ...fb },
    );
    setHud((h) => {
      const boom = simRef.current.boom;
      if (Math.abs(h.boom - boom) < 0.01) return h;
      return { ...h, boom };
    });
  }, [setDigFeedback, setHud]);

  const inputRef = useRef(input);

  const modeRef = useRef<GameMode>(mode);

  const simRef = useRef<ExcavatorSimState>(createInitialSim());
  const velRef = useRef<HydraulicVelocity>(createHydraulicVelocity());
  const terrainRef = useRef<TerrainData>(createInitialTerrain());
  const scoreRef = useRef<DiggingScoreState>(
    createScoreState(config.target, config.duration),
  );

  const tutorialStep: TutorialStep | null =
    mode === "tutorial" ? TUTORIAL_STEPS[tutorialIndex] ?? null : null;

  const tutorialStepRef = useRef<TutorialStep | null>(tutorialStep);

  const baseAllowed: ControlMask =
    mode === "game" ? ALL_CONTROLS : (tutorialStep?.allowed ?? ALL_CONTROLS);
  const allowed: ControlMask = auxiliary.safetyLocked ? LOCKED_CONTROLS : baseAllowed;

  const allowedRef = useRef<ControlMask>(allowed);

  const auxiliaryRef = useRef<AuxiliaryControlState>(auxiliary);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    tutorialStepRef.current = tutorialStep;
    tutorialIndexRef.current = tutorialIndex;
  }, [tutorialIndex, tutorialStep]);

  useEffect(() => {
    allowedRef.current = allowed;
  }, [allowed]);

  useEffect(() => {
    auxiliaryRef.current = auxiliary;
  }, [auxiliary]);

  const handleAuxiliaryChange = useCallback((next: AuxiliaryControlState) => {
    setAuxiliary(next);
    if (next.safetyLocked) {
      setInput({
        left: { x: 0, y: 0 },
        right: { x: 0, y: 0 },
        travel: { left: 0, right: 0 },
      });
    }
  }, [setAuxiliary, setInput]);

  const startGame = useCallback(() => {
    resetSim(simRef.current, velRef.current);
    terrainRef.current = createInitialTerrain();
    scoreRef.current = createScoreState(config.target, config.duration);
    tutorialDumpRef.current = 0;
    endedRef.current = false;
    elapsedRef.current = 0;
    lastHudProgressRef.current = -1;
    setAuxiliary(createAuxiliaryControls());
    setHud({ progress: 0, timeLeft: config.duration, bucketLoad: 0, goalDist: 0, boom: 0.45 });
    setMode("game");
  }, [config.duration, config.target, setAuxiliary, setHud, setMode]);

  const startTutorial = useCallback(() => {
    resetSim(simRef.current, velRef.current);
    terrainRef.current = createInitialTerrain();
    tutorialDumpRef.current = 0;
    tutorialCompletingRef.current = false;
    tutorialIndexRef.current = 0;
    tutorialStepRef.current = TUTORIAL_STEPS[0] ?? null;
    setAuxiliary(createAuxiliaryControls());
    setTutorialIndex(0);
    setMode("tutorial");
  }, [setAuxiliary, setMode, setTutorialIndex]);

  const advanceTutorial = useCallback(() => {
    if (tutorialCompletingRef.current) return;
    tutorialCompletingRef.current = true;
    setStepCompleteFlash(true);
    window.setTimeout(() => setStepCompleteFlash(false), 600);

    const next = tutorialIndexRef.current + 1;
    tutorialIndexRef.current = next;
    tutorialStepRef.current = TUTORIAL_STEPS[next] ?? null;
    setTutorialIndex(next);

    window.setTimeout(() => {
      tutorialCompletingRef.current = false;
    }, 900);
  }, [setStepCompleteFlash, setTutorialIndex]);

  const handleTutorialTick = useCallback(() => {
    if (modeRef.current !== "tutorial") return;
    if (tutorialCompletingRef.current) return;

    const step = tutorialStepRef.current;
    if (!step) return;

    if (checkTutorialStepComplete(step, simRef.current, tutorialDumpRef.current)) {
      const next = tutorialIndexRef.current + 1;
      if (next >= TUTORIAL_STEPS.length) {
        startGame();
        return;
      }
      advanceTutorial();
    }
    const load = simRef.current.bucketLoad;
    setHud((h) => {
      const goalDist =
        step.waypoint != null
          ? Math.round(waypointDistance(simRef.current, step.waypoint))
          : h.goalDist;
      if (
        Math.abs(h.bucketLoad - load) < 0.02 &&
        h.goalDist === goalDist
      ) {
        return h;
      }
      return { ...h, bucketLoad: load, goalDist };
    });
    syncDigHud();
  }, [advanceTutorial, startGame, syncDigHud, setHud]);

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
    [config.target, onEnd, setHud],
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
      syncDigHud();

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
  }, [mode, onEnd, syncDigHud]);

  useEffect(() => {
    if (tutorialStep?.id !== "dig") return;
    const sim = simRef.current;
    sim.bucketLoad = 0;
    tutorialDumpRef.current = 0;
    if (sim.boom < 0.7) sim.boom = 0.75;
    if (sim.bucket < 0.5) sim.bucket = 0.75;
    setHud((h) => ({ ...h, bucketLoad: 0, boom: sim.boom }));
  }, [tutorialIndex, tutorialStep?.id]);

  useEffect(() => {
    if (tutorialStep?.id !== "dump") return;
    const sim = simRef.current;
    tutorialDumpRef.current = 0;
    if (sim.bucketLoad < 0.25) {
      sim.bucketLoad = 0.45;
      setHud((h) => ({ ...h, bucketLoad: sim.bucketLoad }));
    }
  }, [tutorialIndex, tutorialStep?.id]);

  useEffect(() => {
    const keys = new Set<string>();
    const updateKeys = () => {
      const left = { x: 0, y: 0 };
      const right = { x: 0, y: 0 };
      const travel = { left: 0, right: 0 };
      if (keys.has("a") || keys.has("arrowleft")) left.x = -1;
      if (keys.has("d") || keys.has("arrowright")) left.x = 1;
      if (keys.has("q")) left.y = -1;
      if (keys.has("e")) left.y = 1;
      if (keys.has("w") || keys.has("arrowup")) {
        travel.left = 1;
        travel.right = 1;
      }
      if (keys.has("s") || keys.has("arrowdown")) {
        travel.left = -1;
        travel.right = -1;
      }
      if (keys.has("z")) travel.left = 1;
      if (keys.has("x")) travel.right = 1;
      if (keys.has("c")) travel.left = -1;
      if (keys.has("v")) travel.right = -1;
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

  return (
    <div
      className={`relative touch-manipulation ${immersive ? "h-full w-full" : "mx-auto w-full max-w-lg"}`}
    >
      <div
        className={`relative w-full overflow-hidden bg-black ${
          immersive ? "h-full" : "h-[520px] rounded-b-xl shadow-lg"
        }`}
      >
        <ControlsGuidePanel
          open={showControlsGuide}
          onClose={() => setShowControlsGuide(false)}
          digFeedback={digFeedback}
          bucketLoad={hud.bucketLoad}
          boom={hud.boom}
        />

        {mode === "tutorial" && tutorialStep && (
          <div className="absolute left-2 top-2 z-40 w-[8.75rem] rounded-xl border border-amber-300/20 bg-black/75 p-2 text-white shadow-xl backdrop-blur-sm">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-amber-300">{tutorialStep.title}</p>
              <p className="mt-0.5 text-[10px] leading-tight text-white/85">
                {tutorialStep.instruction}
              </p>
            </div>
            <button
              type="button"
              onClick={startGame}
              className="mx-auto mt-2 block rounded bg-white/10 px-2 py-0.5 text-[9px] font-medium hover:bg-white/20"
            >
              건너뛰기
            </button>
          </div>
        )}

        {mode === "game" && (
          <div className="absolute left-0 right-0 top-0 z-20 flex justify-between p-2 pr-[8rem] pt-10">
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
            style={{
              bottom: `calc(${((COCKPIT_LAYOUT.height / COCKPIT_LAYOUT.width) * 100).toFixed(1)}% + 2.75rem)`,
            }}
          >
            {tutorialIndex + 1}/{TUTORIAL_STEPS.length}
          </div>
        )}

        {mode !== "intro" && (
          <ExcavatorMinimap
            simRef={simRef}
            terrainRef={terrainRef}
            tutorialStepRef={tutorialStepRef}
            visible
          />
        )}

        {mode === "tutorial" && tutorialStep?.id === "dump" ? (
          <DumpHintPanel
            bucketLoad={hud.bucketLoad}
            inDumpZone={digFeedback.inDumpZone}
            show
          />
        ) : null}

        {mode === "tutorial" && tutorialStep?.waypoint && (
          <div className="absolute left-2 top-[5.25rem] z-20 rounded-lg bg-sky-600/85 px-2 py-1 text-[10px] font-semibold text-white">
            목표까지 {hud.goalDist}m
          </div>
        )}

        {mode !== "intro" && (
          <div
            className="pointer-events-none absolute left-3 z-30 w-[min(13rem,46vw)] rounded-xl border border-white/10 bg-black/55 px-3 py-2 shadow-xl backdrop-blur-sm"
            style={{
              bottom: `calc(min(100vw, 32rem) * ${COCKPIT_LAYOUT.height / COCKPIT_LAYOUT.width} + 3.25rem)`,
            }}
          >
            <BoomLoadGauge bucketLoad={hud.bucketLoad} />
          </div>
        )}

        {mode === "game" && (
          <>
            <div className="absolute right-2 top-[8.75rem] z-20 rounded-lg bg-orange-600/80 px-2 py-1 text-[10px] text-white">
              🟠 굴착
            </div>
            <div className="absolute right-2 top-[10.5rem] z-20 rounded-lg bg-green-600/80 px-2 py-1 text-[10px] text-white">
              🟢 덤프
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
          <div className="absolute inset-0 z-0">
            <ExcavatorScene
              inputRef={inputRef}
              simRef={simRef}
              velRef={velRef}
              terrainRef={terrainRef}
              scoreRef={scoreRef}
              modeRef={modeRef}
              allowedRef={allowedRef}
              auxiliaryRef={auxiliaryRef}
              tutorialStepRef={tutorialStepRef}
              tutorialDumpRef={tutorialDumpRef}
              digFeedbackRef={digFeedbackRef}
              onProgress={handleProgress}
              onTutorialTick={handleTutorialTick}
            />
          </div>
        )}

        {mode !== "intro" && (
          <CockpitOverlay
            input={input}
            onInputChange={(next) =>
              setInput((current) =>
                filterInput(
                  typeof next === "function" ? next(current) : next,
                  allowedRef.current,
                ),
              )
            }
            auxiliary={auxiliary}
            onAuxiliaryChange={handleAuxiliaryChange}
            allowed={allowed}
            tutorialStep={tutorialStep}
          />
        )}

        {mode !== "intro" && (
          <button
            type="button"
            onClick={() => setShowControlsGuide(true)}
            className="absolute bottom-3 right-3 z-50 rounded-xl border border-white/20 bg-black/70 px-3 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-sm hover:bg-black/85"
          >
            기능정보
          </button>
        )}

        {mode === "game" && (
          <button
            type="button"
            onClick={startTutorial}
            className="absolute bottom-[57%] right-3 z-20 rounded-lg bg-black/55 px-2.5 py-1 text-xs text-white backdrop-blur hover:bg-black/70"
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
