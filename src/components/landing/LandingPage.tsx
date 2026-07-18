import Link from "next/link";
import { YkGeongiLogo } from "@/components/brand/YkGeongiLogo";
import { GAMES } from "@/lib/games";
import { COMPANY, EXPERIENCE_STEPS } from "@/lib/landing-content";
import { LandingEquipmentCard } from "./LandingEquipmentCard";
import { LandingPromoPopup } from "./LandingPromoPopup";
import { PwaExperienceButton } from "./PwaExperienceButton";
import { PwaInstallButton } from "./PwaInstallButton";
import { WebExperienceSection } from "./WebExperienceSection";

interface LandingPageProps {
  rideHref: string;
  gameHref: string;
}

export function LandingPage({ rideHref, gameHref }: LandingPageProps) {
  return (
    <main className="landing-page relative flex h-[100dvh] flex-col overflow-hidden text-gray-900">
      <LandingPromoPopup />
      <div className="landing-bg pointer-events-none absolute inset-0" aria-hidden />
      <div className="landing-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-lg shrink-0 px-3 pt-3 pb-2">
        <header className="flex flex-col items-center text-center">
          <div className="flex items-center justify-center gap-2.5">
            <YkGeongiLogo
              variant="black"
              priority
              className="landing-logo h-9 w-auto max-w-[9.5rem] object-contain object-left"
            />
            <h1 className="text-lg font-bold leading-tight tracking-tight text-gray-900">
              중장비 체험존
            </h1>
          </div>
          <p className="mt-1 max-w-xs text-[10px] leading-relaxed text-gray-400">
            {COMPANY.tagline}
          </p>
        </header>

        <div className="mt-2 space-y-2">
          <WebExperienceSection compact />
          <div className="mx-auto grid w-full max-w-[280px] grid-cols-2 gap-2">
            <PwaExperienceButton
              href={rideHref}
              experienceMode="ride"
              className="landing-cta landing-cta-ride flex items-center justify-center rounded-xl px-3 py-2.5 text-xs font-bold text-white shadow-md"
            >
              탑승 체험
            </PwaExperienceButton>
            <PwaExperienceButton
              href={gameHref}
              experienceMode="game"
              className="landing-cta landing-cta-game flex items-center justify-center rounded-xl px-3 py-2.5 text-xs font-bold text-white shadow-md"
            >
              게임 체험
            </PwaExperienceButton>
          </div>
          <PwaInstallButton />
          <p className="mx-auto max-w-[280px] text-center text-[9px] leading-relaxed text-gray-400">
            탑승 체험은 실제 조작감 시뮬레이터 · 게임 체험은 미션·보상·랭킹
          </p>
        </div>
      </div>

      <div className="landing-scroll relative z-10 mx-auto w-full max-w-lg flex-1 overflow-y-auto px-4 pb-10">
        <section className="landing-stats mb-7 mt-1 grid grid-cols-4 divide-x divide-gray-100">
          {COMPANY.stats.map((s) => (
            <div key={s.label} className="px-1 py-1 text-center">
              <p className="text-base font-semibold tracking-tight text-gray-900">{s.value}</p>
              <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-gray-400">
                {s.label}
              </p>
            </div>
          ))}
        </section>

        <section className="mb-8">
          <div className="landing-section-head mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-red-500">
              Global Lineup
            </p>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-gray-900">
              글로벌 브랜드 라인업
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
              YK건기가 수입·판매하는 8개 브랜드 중장비
            </p>
          </div>
          <div className="landing-equipment-grid">
            {GAMES.map((game) => (
              <LandingEquipmentCard key={game.id} game={game} />
            ))}
          </div>
        </section>

        <section className="mb-8">
          <div className="landing-section-head mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-red-500">
              How to Play
            </p>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-gray-900">
              체험 방법
            </h2>
          </div>
          <div className="space-y-2">
            {EXPERIENCE_STEPS.map((item) => (
              <div key={item.step} className="landing-step flex items-center gap-3">
                <span className="landing-step-num">{item.step}</span>
                <div className="min-w-0 flex-1 border-b border-gray-50 pb-3">
                  <p className="text-sm font-medium text-gray-900">{item.title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-gray-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="landing-footer pt-5 text-center">
          <p className="text-[11px] font-medium tracking-wide text-gray-500">{COMPANY.name}</p>
          <p className="mt-1 text-[10px] text-gray-300">
            탑승 체험과 게임 체험으로 장비를 만나보세요
          </p>
          <Link
            href={COMPANY.homepage}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-[10px] tracking-wide text-gray-300 transition hover:text-red-500"
          >
            sunnyyk.co.kr
          </Link>
        </footer>
      </div>
    </main>
  );
}
