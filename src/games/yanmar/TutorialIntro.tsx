"use client";

interface TutorialIntroProps {
  onStartTutorial: () => void;
  onSkip: () => void;
}

export function TutorialIntro({ onStartTutorial, onSkip }: TutorialIntroProps) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xs overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-red-600 to-red-800 px-5 py-4 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-widest opacity-80">
            YANMAR
          </p>
          <h2 className="mt-1 text-lg font-bold">조작 튜토리얼</h2>
          <p className="mt-1 text-xs leading-relaxed opacity-90">
            운전대를 하나씩 익힌 뒤 본 게임에 도전하세요
          </p>
        </div>
        <div className="space-y-2 p-4 text-xs text-gray-600">
          <p>① 주행 → ② 스윙 → ③ 암 → ④ 붐 → ⑤ 버킷 → ⑥ 굴착 → ⑦ 하역</p>
          <p className="text-[11px] text-gray-400">
            튜토리얼은 언제든 건너뛸 수 있습니다
          </p>
        </div>
        <div className="flex flex-col gap-2 border-t border-gray-100 p-4">
          <button
            type="button"
            onClick={onStartTutorial}
            className="w-full rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-500"
          >
            튜토리얼 시작
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            건너뛰고 바로 게임
          </button>
        </div>
      </div>
    </div>
  );
}
