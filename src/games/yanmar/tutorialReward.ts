import type { PrismaClient } from "@/generated/prisma/client";
import { calculateFinalYanmarStats } from "./gearStats";
import { createGearItem } from "./gearGenerate";
import { asJson } from "./jsonCompat";
import { DEFAULT_CHASSIS_ID } from "./chassisCatalog";
import {
  GEAR_SLOT_LABEL,
  ITEM_GRADE_LABEL,
  clampGearInventorySlots,
  GEAR_INVENTORY_BASE,
} from "./gearCatalog";
import { TUTORIAL_REWARDS, type TutorialStepId } from "./tutorialProgress";

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export async function grantTutorialRewardGear(
  tx: Tx,
  userId: string,
  stepId: TutorialStepId,
  gameId = "yanmar",
) {
  const reward = TUTORIAL_REWARDS[stepId];
  if (!reward) {
    return { granted: false as const, reason: "no_reward" as const };
  }

  const [loadout, items, user] = await Promise.all([
    tx.userChassisLoadout.findUnique({
      where: { userId_gameId: { userId, gameId } },
    }),
    tx.gearItem.findMany({
      where: { userId, gameId },
      select: { id: true },
    }),
    tx.user.findUnique({
      where: { id: userId },
      select: { gearInventorySlots: true },
    }),
  ]);

  const inventorySlots = clampGearInventorySlots(
    user?.gearInventorySlots ?? GEAR_INVENTORY_BASE,
  );
  if (items.length >= inventorySlots) {
    return { granted: false as const, reason: "inventory_full" as const };
  }

  const durabilityMax = calculateFinalYanmarStats({
    chassisId: loadout?.activeChassisId ?? DEFAULT_CHASSIS_ID,
  }).durabilityMaxPerPiece;
  const data = createGearItem(reward.slot, reward.grade, durabilityMax);
  const created = await tx.gearItem.create({
    data: {
      userId,
      gameId,
      slot: data.slot,
      grade: data.grade,
      enhanceLevel: 0,
      failBonus: 0,
      mainOption: asJson(data.mainOption),
      subOptions: asJson(data.subOptions),
      masterOption: data.masterOption ? asJson(data.masterOption) : undefined,
      nameSnapshot: data.nameSnapshot,
      durability: data.durability,
      durabilityMax: data.durabilityMax,
      equippedSlot: null,
    },
  });

  return {
    granted: true as const,
    item: created,
    nameSnapshot: data.nameSnapshot,
    gradeLabel: ITEM_GRADE_LABEL[data.grade],
    slotLabel: GEAR_SLOT_LABEL[data.slot],
  };
}
