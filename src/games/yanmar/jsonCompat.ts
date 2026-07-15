import type { Prisma } from "@/generated/prisma/client";

export function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
