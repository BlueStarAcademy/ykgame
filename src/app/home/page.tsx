import { AccountSanctionedView } from "@/components/auth/AccountSanctionedView";
import { GamePlayClient } from "@/components/games/GamePlayClient";
import { AppShell } from "@/components/layout/AppShell";
import { getSeasonInfo } from "@/lib/games";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserGameStatsForGames } from "@/lib/rankings";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.nickname) redirect("/nickname");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      currency: true,
      nickname: true,
      totalXp: true,
      isActive: true,
      sanctionReason: true,
    },
  });

  const nickname = user?.nickname ?? session.user.nickname ?? "";
  const currency = user?.currency ?? 0;
  const totalXp = user?.totalXp ?? 0;

  if (user && !user.isActive) {
    return (
      <AppShell nickname={nickname} currency={currency} role={session.user.role} hideFooter>
        <AccountSanctionedView
          nickname={nickname}
          reason={user.sanctionReason?.trim() || "운영 정책에 따른 이용 제한"}
        />
      </AppShell>
    );
  }

  const season = getSeasonInfo();
  const statsByGame = await getUserGameStatsForGames(
    ["yanmar"],
    session.user.id,
    season.key,
  );
  const yanmarStats = statsByGame.get("yanmar");

  return (
    <AppShell
      nickname={nickname}
      currency={currency}
      role={session.user.role}
      hideFooter
    >
      <GamePlayClient
        gameId="yanmar"
        lobbyProfile={{
          totalXp,
          seasonLabel: season.label,
          rank: yanmarStats?.rank ?? null,
          seasonScore: yanmarStats?.bestScore ?? 0,
          highlightGameName: "얀마",
        }}
      />
    </AppShell>
  );
}
