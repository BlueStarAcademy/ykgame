import { calculateScore, calculateStars } from "@/lib/games";

export interface DiggingScoreState {
  dumped: number;
  target: number;
  timeLeft: number;
  duration: number;
}

export function createScoreState(target: number, duration: number): DiggingScoreState {
  return { dumped: 0, target, timeLeft: duration, duration };
}

export function getProgress(state: DiggingScoreState): number {
  return Math.min(100, Math.round((state.dumped / state.target) * 100));
}

export function getGameScore(state: DiggingScoreState): number {
  return calculateScore(getProgress(state), Math.ceil(state.timeLeft));
}

export function getStars(state: DiggingScoreState): number {
  return calculateStars(getProgress(state));
}

export function tickTimer(state: DiggingScoreState, dt: number) {
  state.timeLeft = Math.max(0, state.timeLeft - dt);
}

export function isComplete(state: DiggingScoreState): boolean {
  return state.dumped >= state.target;
}

export function isTimeUp(state: DiggingScoreState): boolean {
  return state.timeLeft <= 0;
}
