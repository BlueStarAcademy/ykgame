import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 하단 콕핏 조작과 Next DevTools 드래그 인디케이터가 겹치면
  // releasePointerCapture NotFoundError가 날 수 있어 개발 인디케이터를 끈다.
  // (에러 오버레이는 그대로 표시됨)
  devIndicators: false,
  serverExternalPackages: ["bcryptjs", "pg", "@prisma/client", "@prisma/adapter-pg"],
  async headers() {
    return [
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source:
          "/games/:path*.:ext(png|jpg|jpeg|webp|gif|svg|ico|avif|json|mp3|ogg|wav|woff|woff2|ttf|otf)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
