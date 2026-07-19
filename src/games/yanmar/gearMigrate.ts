import type { PrismaClient } from "@/generated/prisma/client";
import { cappedCurrencyIncrement } from "@/lib/currency";
import { getYanmarSpentUpgradeCost, type YanmarEquipmentPart } from "./equipment";
import { DEFAULT_CHASSIS_ID } from "./chassisCatalog";
import { GEAR_SLOTS } from "./gearCatalog";
import { createStarterGear } from "./gearGenerate";
import { calculateFinalYanmarStats } from "./gearStats";
import { asJson } from "./jsonCompat";

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends" | "$use"
>;

/**
 * Refunds all legacy part upgrades as full stars, deletes upgrade rows,
 * grants starter gear + ViO17-1 chassis if not yet migrated.
 */
export async function ensureYanmarGearMigration(
  tx: Tx,
  userId: string,
  gameId = "yanmar",
) {
  const existing = await tx.userChassisLoadout.findUnique({
    where: { userId_gameId: { userId, gameId } },
  });
  if (existing?.migratedAt) {
    return { migrated: false as const, refundStars: 0 };
  }

  const rows = await tx.userEquipmentUpgrade.findMany({
    where: { userId, gameId },
    select: { part: true, level: true },
  });
  const levels: Partial<Record<YanmarEquipmentPart, number>> = {};
  for (const row of rows) {
    levels[row.part as YanmarEquipmentPart] = row.level;
  }
  const refundStars = getYanmarSpentUpgradeCost(levels);

  if (rows.length > 0) {
    await tx.userEquipmentUpgrade.deleteMany({ where: { userId, gameId } });
  }
  let grantedRefund = 0;
  if (refundStars > 0) {
    const current = await tx.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    });
    const { next, granted } = cappedCurrencyIncrement(
      current?.currency ?? 0,
      refundStars,
    );
    grantedRefund = granted;
    await tx.user.update({
      where: { id: userId },
      data: { currency: next },
    });
  }

  const durabilityMax = calculateFinalYanmarStats({
    chassisId: DEFAULT_CHASSIS_ID,
  }).durabilityMaxPerPiece;

  const gearCount = await tx.gearItem.count({ where: { userId, gameId } });
  if (gearCount === 0) {
    for (const slot of GEAR_SLOTS) {
      const starter = createStarterGear(slot, durabilityMax);
      await tx.gearItem.create({
        data: {
          userId,
          gameId,
          slot,
          grade: starter.grade,
          enhanceLevel: 0,
          failBonus: 0,
          mainOption: asJson(starter.mainOption),
          subOptions: asJson(starter.subOptions),
          masterOption: starter.masterOption ? asJson(starter.masterOption) : undefined,
          nameSnapshot: starter.nameSnapshot,
          durability: starter.durability,
          durabilityMax: starter.durabilityMax,
          equippedSlot: slot,
        },
      });
    }
  }

  await tx.userChassisLoadout.upsert({
    where: { userId_gameId: { userId, gameId } },
    create: {
      userId,
      gameId,
      activeChassisId: DEFAULT_CHASSIS_ID,
      ownedChassisIds: [DEFAULT_CHASSIS_ID],
      migratedAt: new Date(),
    },
    update: {
      migratedAt: new Date(),
      activeChassisId: existing?.activeChassisId ?? DEFAULT_CHASSIS_ID,
      ownedChassisIds: existing?.ownedChassisIds ?? [DEFAULT_CHASSIS_ID],
    },
  });

  const fillNow = new Date();
  const existingRepair = await tx.userRepairState.findUnique({
    where: { userId_gameId: { userId, gameId } },
  });
  await tx.userRepairState.upsert({
    where: { userId_gameId: { userId, gameId } },
    create: {
      userId,
      gameId,
      buffKind: "NONE",
      engineOilFilledAt: fillNow,
      engineOilFilterFilledAt: fillNow,
      hydraulicOilFilledAt: fillNow,
      hydraulicFilterFilledAt: fillNow,
      fuelFilterFilledAt: fillNow,
      gearOilFilledAt: fillNow,
    },
    update: {
      ...(!existingRepair?.engineOilFilledAt
        ? { engineOilFilledAt: fillNow }
        : {}),
      ...(!existingRepair?.engineOilFilterFilledAt
        ? { engineOilFilterFilledAt: fillNow }
        : {}),
      ...(!existingRepair?.hydraulicOilFilledAt
        ? { hydraulicOilFilledAt: fillNow }
        : {}),
      ...(!existingRepair?.hydraulicFilterFilledAt
        ? { hydraulicFilterFilledAt: fillNow }
        : {}),
      ...(!existingRepair?.fuelFilterFilledAt
        ? { fuelFilterFilledAt: fillNow }
        : {}),
      ...(!existingRepair?.gearOilFilledAt ? { gearOilFilledAt: fillNow } : {}),
    },
  });

  return { migrated: true as const, refundStars: grantedRefund };
}
