import { LandingPage } from "@/components/landing/LandingPage";
import { auth } from "@/lib/auth";
import { buildExperienceEntryHref } from "@/lib/experience-mode";

export default async function RootPage() {
  const session = await auth();

  return (
    <LandingPage
      rideHref={buildExperienceEntryHref("ride", session?.user)}
      gameHref={buildExperienceEntryHref("game", session?.user)}
    />
  );
}
