const FEATURES = [
  { icon: "🕹️", title: "실감 조작", desc: "듀얼 조이스틱" },
  { icon: "⛏️", title: "굴착·하역", desc: "아케이드 점수" },
  { icon: "⭐", title: "보상 수집", desc: "스타·쿠폰" },
  { icon: "📊", title: "기록 도전", desc: "랭킹 경쟁" },
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
          © YK건기 · 실감 조작으로 체험하는 장비 아케이드
        </p>
      </div>
    </footer>
  );
}
