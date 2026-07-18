import { SiteLegendAuthScreen } from "@/components/auth/SiteLegendAuthScreen";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="pwa-auth-page site-legend-auth-page">
        <SiteLegendAuthScreen />
      </main>
    );
  }

  const { HomeAuthenticated } = await import("./HomeAuthenticated");
  return <HomeAuthenticated session={session} />;
}
