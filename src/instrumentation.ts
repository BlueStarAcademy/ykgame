import { ensureRailwayEnv } from "@/lib/app-env";

export async function register() {
  ensureRailwayEnv();
}

export const onRequestError = async () => {};
