const RESUME_IN_GAME_KEY = "yk-resume-ingame";

/** 이 페이지 로드에서 재개 여부를 한 번만 결정 (Strict Mode 이중 effect 대비). */
let resumeDecision: boolean | null = null;

/** 관리자 페이지 등에서 돌아올 때 인게임으로 바로 재진입하기 위한 플래그. */
export function markResumeInGame(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(RESUME_IN_GAME_KEY, "1");
  resumeDecision = null;
}

/** 플래그를 읽고 이 페이지 로드에서 재사용할 수 있게 캐시. */
export function shouldResumeInGame(): boolean {
  if (resumeDecision !== null) return resumeDecision;
  if (typeof sessionStorage === "undefined") {
    resumeDecision = false;
    return false;
  }
  const marked = sessionStorage.getItem(RESUME_IN_GAME_KEY) === "1";
  if (marked) {
    sessionStorage.removeItem(RESUME_IN_GAME_KEY);
  }
  resumeDecision = marked;
  return marked;
}
