import { LandingPage } from "@/components/landing/LandingPage";
import { auth } from "@/lib/auth";
import { withPwaQuery } from "@/lib/pwa-mode";

export default async function RootPage() {
  const session = await auth();

  let ctaHref = withPwaQuery("/login?callbackUrl=/home");
  if (session?.user) {
    ctaHref = session.user.nickname
      ? withPwaQuery("/home")
      : withPwaQuery("/nickname");
  }

  return <LandingPage ctaHref={ctaHref} />;
}
