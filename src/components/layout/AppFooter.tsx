const FEATURES = [
  { icon: "🏆", title: "간단한 조작", desc: "누구나 쉽게!" },
  { icon: "🎮", title: "짧은 미션", desc: "1~2분 완료!" },
  { icon: "💎", title: "보상 & 수집", desc: "별 모으기!" },
  { icon: "📊", title: "기록 & 랭킹", desc: "점수 도전!" },
];

interface AppFooterProps {
  showFeatures?: boolean;
}

export function AppFooter({ showFeatures = false }: AppFooterProps) {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
      {showFeatures && (
        <div className="mx-auto max-w-lg border-b border-gray-100 px-3 py-2.5">
          <div className="grid grid-cols-4 gap-1.5">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-lg bg-gray-50 px-1 py-1.5 text-center"
              >
                <div className="text-base leading-none">{f.icon}</div>
                <p className="mt-0.5 text-[9px] font-bold leading-tight text-gray-800">
                  {f.title}
                </p>
                <p className="text-[8px] leading-tight text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mx-auto flex h-9 max-w-lg items-center justify-center px-4">
        <p className="text-[10px] text-gray-400">
          © YK건기 · 장비를 쉽고 재미있게 체험하는 미니게임
        </p>
      </div>
    </footer>
  );
}
