import type { NextConfig } from "next";
import { ensureAuthSecret } from "./scripts/ensure-auth-secret.mjs";

// Edge middleware는 Node crypto를 쓸 수 없으므로, dev/build 시작 시 AUTH_SECRET을 주입
ensureAuthSecret({ fatal: false });

const nextConfig: NextConfig = {};

export default nextConfig;
