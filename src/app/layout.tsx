import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "YK건기 중장비 체험",
  description:
    "YK건기 중장비를 게임으로 직접 체험하세요. 얀마 굴착기 1인칭 시뮬레이터와 8종 브랜드 미니게임.",
  // v2 filename busts cached manifests that still forced landscape from older builds
  manifest: "/manifest-v2.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "YKGAME",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-orientations": "portrait",
    "screen-orientation": "portrait",
    "x5-orientation": "portrait",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#C62828",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
