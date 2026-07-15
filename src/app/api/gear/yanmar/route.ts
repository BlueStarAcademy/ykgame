import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureYanmarGearMigration } from "@/games/yanmar/gearMigrate";
import { loadUserFinalStats } from "@/games/yanmar/gearService";
import { getPlayerLevelProgress } from "@/lib/playerLevel";
import { CHASSIS_CATALOG, CHASSIS_CLASS_LABEL } from "@/games/yanmar/chassisCatalog";
import { GEAR_SLOT_LABEL, ITEM_GRADE_LABEL, MAIN_OPTION_BY_SLOT, SUB_OPTION_POOL, GEAR_INVENTORY_BASE, clampGearInventorySlots, getGearInventoryExpandCost, type ItemGrade, type GearSlot } from "@/games/yanmar/gearCatalog";
import { buildItemName, canonicalizeMainOption, canonicalizeSubOptions } from "@/games/yanmar/gearGenerate";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const migration = await ensureYanmarGearMigration(tx, session.user.id);
    const loaded = await loadUserFinalStats(tx, session.user.id);
    const user = await tx.user.findUnique({
      where: { id: session.user.id },
      select: {
        currency: true,
        totalXp: true,
        enhanceCores: true,
        gearInventorySlots: true,
      },
    });
    return { migration, loaded, user };
  });

  const progress = getPlayerLevelProgress(result.user?.totalXp ?? 0);
  const inventorySlots = clampGearInventorySlots(
    result.user?.gearInventorySlots ?? GEAR_INVENTORY_BASE,
  );

  return NextResponse.json({
    currency: result.user?.currency ?? 0,
    enhanceCores: result.user?.enhanceCores ?? 0,
    inventorySlots,
    expandCost: getGearInventoryExpandCost(inventorySlots),
    totalXp: result.user?.totalXp ?? 0,
    playerLevel: progress.level,
    migration: result.migration,
    chassis: {
      activeId: result.loaded.loadout?.activeChassisId ?? "ViO17_1",
      ownedIds: result.loaded.ownedChassisIds,
      catalog: CHASSIS_CATALOG.map((c) => ({
        ...c,
        classLabel: CHASSIS_CLASS_LABEL[c.chassisClass],
      })),
    },
    repair: result.loaded.repair,
    maintenance: result.loaded.maintenance,
    stats: result.loaded.stats,
    items: result.loaded.items.map((item) => {
      const slot = item.slot as GearSlot;
      const grade = item.grade as ItemGrade;
      const mainOption = canonicalizeMainOption(
        slot,
        grade,
        item.enhanceLevel,
        item.mainOption as Parameters<typeof canonicalizeMainOption>[3],
      );
      const subOptions = canonicalizeSubOptions(item.subOptions);
      return {
        id: item.id,
        slot,
        slotLabel: GEAR_SLOT_LABEL[slot],
        grade,
        gradeLabel: ITEM_GRADE_LABEL[grade],
        enhanceLevel: item.enhanceLevel,
        failBonus: item.failBonus,
        mainOption,
        mainLabel: MAIN_OPTION_BY_SLOT[slot]?.label,
        subOptions,
        masterOption: item.masterOption,
        nameSnapshot: buildItemName(grade, subOptions, slot),
        durability: item.durability,
        durabilityMax: item.durabilityMax,
        equippedSlot: item.equippedSlot,
      };
    }),
    subOptionDefs: SUB_OPTION_POOL,
  });
}
