"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { YkGeongiLogo } from "@/components/brand/YkGeongiLogo";
import { GAMES } from "@/lib/games";
import { COMPANY, EXPERIENCE_STEPS } from "@/lib/landing-content";
import { LandingEquipmentCard } from "./LandingEquipmentCard";
import { LandingPromoPopup } from "./LandingPromoPopup";
import { PwaExperienceButton } from "./PwaExperienceButton";
import { PwaInstallButton } from "./PwaInstallButton";
import { WebExperienceSection } from "./WebExperienceSection";

interface LandingPageProps {
  gameHref: string;
}

export function LandingPage({ gameHref }: LandingPageProps) {
  const t = useTranslations("landing");
  const stats = [
    t("statYears"),
    t("statBrands"),
    t("statCenters"),
    t("statNetwork"),
  ];
  const steps = [
    { title: t("step1Title"), desc: t("step1Desc") },
    { title: t("step2Title"), desc: t("step2Desc") },
    { title: t("step3Title"), desc: t("step3Desc") },
    { title: t("step4Title"), desc: t("step4Desc") },
  ];

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
              {t("heroTitle")}
            </h1>
          </div>
          <p className="mt-1 max-w-xs text-[10px] leading-relaxed text-gray-400">
            {t("companyTagline")}
          </p>
        </header>

        <div className="mt-2 space-y-2">
          <WebExperienceSection compact />
          <div className="mx-auto flex w-full max-w-[280px] gap-2">
            <PwaInstallButton />
            <PwaExperienceButton
              href={gameHref}
              experienceMode="game"
              className="landing-cta landing-cta-game flex min-w-0 flex-1 items-center justify-center rounded-xl px-3 py-2.5 text-xs font-bold text-white shadow-md"
            >
              {t("gameExperience")}
            </PwaExperienceButton>
          </div>
        </div>
      </div>

      <div className="landing-scroll relative z-10 mx-auto w-full max-w-lg flex-1 overflow-y-auto px-4 pb-10">
        <section className="landing-stats mb-7 mt-1 grid grid-cols-4 divide-x divide-gray-100">
          {COMPANY.stats.map((s, index) => (
            <div key={s.label} className="px-1 py-1 text-center">
              <p className="text-base font-semibold tracking-tight text-gray-900">{s.value}</p>
              <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-gray-400">
                {stats[index]}
              </p>
            </div>
          ))}
        </section>

        <section className="mb-8">
          <div className="landing-section-head mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-red-500">
              {t("globalLineupEyebrow")}
            </p>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-gray-900">
              {t("globalLineupTitle")}
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
              {t("globalLineupDesc")}
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
              {t("howToPlayEyebrow")}
            </p>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-gray-900">
              {t("howToPlayTitle")}
            </h2>
          </div>
          <div className="space-y-2">
            {EXPERIENCE_STEPS.map((item, index) => (
              <div key={item.step} className="landing-step flex items-center gap-3">
                <span className="landing-step-num">{item.step}</span>
                <div className="min-w-0 flex-1 border-b border-gray-50 pb-3">
                  <p className="text-sm font-medium text-gray-900">{steps[index].title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-gray-400">
                    {steps[index].desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="landing-footer pt-5 text-center">
          <p className="text-[11px] font-medium tracking-wide text-gray-500">{COMPANY.name}</p>
          <p className="mt-1 text-[10px] text-gray-300">
            {t("footerPrompt")}
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
