import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["bcryptjs", "pg", "@prisma/client", "@prisma/adapter-pg"],
};

export default nextConfig;
