"use client";

interface TutorialIntroProps {
  onStartPractice: () => void;
  onEnterGame: () => void;
}

export function TutorialIntro({ onStartPractice, onEnterGame }: TutorialIntroProps) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xs overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-red-600 to-red-800 px-5 py-4 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-widest opacity-80">
            YANMAR
          </p>
          <h2 className="mt-1 text-lg font-bold">얀마 굴착기 체험</h2>
          <p className="mt-1 text-xs leading-relaxed opacity-90">
            연습모드에서 조작을 익히거나 게임모드로 점수에 도전하세요
          </p>
        </div>
        <div className="space-y-2 p-4 text-xs text-gray-600">
          <p>연습모드: 원하는 튜토리얼을 골라서 반복 연습</p>
          <p>게임모드: 90초 동안 굴착·하역 점수 획득</p>
          <p className="text-[11px] text-gray-400">
            연습모드에서는 자유동작도 사용할 수 있습니다
          </p>
        </div>
        <div className="flex flex-col gap-2 border-t border-gray-100 p-4">
          <button
            type="button"
            onClick={onStartPractice}
            className="w-full rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-500"
          >
            연습모드 입장
          </button>
          <button
            type="button"
            onClick={onEnterGame}
            className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            게임모드 입장
          </button>
        </div>
      </div>
    </div>
  );
}
