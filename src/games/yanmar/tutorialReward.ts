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
import { cappedCurrencyIncrement } from "@/lib/currency";
import {
  TUTORIAL_REWARDS,
  isCurrencyTutorialReward,
  isGearTutorialReward,
  type TutorialStepId,
} from "./tutorialProgress";

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export async function grantTutorialReward(
  tx: Tx,
  userId: string,
  stepId: TutorialStepId,
  gameId = "yanmar",
) {
  const reward = TUTORIAL_REWARDS[stepId];
  if (!reward) {
    return { granted: false as const, reason: "no_reward" as const };
  }

  if (isCurrencyTutorialReward(reward)) {
    const stars = Math.max(0, reward.stars ?? 0);
    const enhanceCores = Math.max(0, reward.enhanceCores ?? 0);
    const gachaTicketsStandard = Math.max(0, reward.gachaTicketsStandard ?? 0);
    const gachaTicketsPremium = Math.max(0, reward.gachaTicketsPremium ?? 0);
    if (
      stars <= 0 &&
      enhanceCores <= 0 &&
      gachaTicketsStandard <= 0 &&
      gachaTicketsPremium <= 0
    ) {
      return { granted: false as const, reason: "no_reward" as const };
    }

    const before = await tx.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    });
    const { next: nextCurrency, granted: grantedStars } = cappedCurrencyIncrement(
      before?.currency ?? 0,
      stars,
    );

    const user = await tx.user.update({
      where: { id: userId },
      data: {
        ...(grantedStars > 0 ? { currency: nextCurrency } : {}),
        ...(enhanceCores > 0
          ? { enhanceCores: { increment: enhanceCores } }
          : {}),
        ...(gachaTicketsStandard > 0
          ? { gachaTicketsStandard: { increment: gachaTicketsStandard } }
          : {}),
        ...(gachaTicketsPremium > 0
          ? { gachaTicketsPremium: { increment: gachaTicketsPremium } }
          : {}),
      },
      select: {
        currency: true,
        enhanceCores: true,
        gachaTicketsStandard: true,
        gachaTicketsPremium: true,
      },
    });

    return {
      granted: true as const,
      kind: "currency" as const,
      currency: user.currency,
      enhanceCores: user.enhanceCores,
      gachaTicketsStandard: user.gachaTicketsStandard,
      gachaTicketsPremium: user.gachaTicketsPremium,
      grantedStars,
      grantedEnhanceCores: enhanceCores,
      grantedGachaTicketsStandard: gachaTicketsStandard,
      grantedGachaTicketsPremium: gachaTicketsPremium,
    };
  }

  if (!isGearTutorialReward(reward)) {
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
    kind: "gear" as const,
    item: created,
    nameSnapshot: data.nameSnapshot,
    gradeLabel: ITEM_GRADE_LABEL[data.grade],
    slotLabel: GEAR_SLOT_LABEL[data.slot],
  };
}

/** @deprecated Prefer grantTutorialReward */
export async function grantTutorialRewardGear(
  tx: Tx,
  userId: string,
  stepId: TutorialStepId,
  gameId = "yanmar",
) {
  return grantTutorialReward(tx, userId, stepId, gameId);
}
