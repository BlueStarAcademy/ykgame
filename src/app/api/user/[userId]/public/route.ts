import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseAbilityAlloc } from "@/games/yanmar/abilityAlloc";
import { DEFAULT_CHASSIS_ID } from "@/games/yanmar/chassisCatalog";
import {
  GEAR_SLOT_LABEL,
  ITEM_GRADE_LABEL,
  MAIN_OPTION_BY_SLOT,
  type GearSlot,
  type ItemGrade,
} from "@/games/yanmar/gearCatalog";
import {
  buildItemName,
  canonicalizeMainOption,
  canonicalizeSubOptions,
} from "@/games/yanmar/gearGenerate";
import { getPlayerLevelProgress } from "@/lib/playerLevel";
import { prisma } from "@/lib/prisma";
import type {
  PublicEquippedGearItem,
  PublicUserProfile,
} from "@/lib/public-profile";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  if (!userId?.trim()) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      nickname: true,
      profileAvatarId: true,
      totalXp: true,
      isActive: true,
      chassisLoadouts: {
        where: { gameId: "yanmar" },
        take: 1,
        select: {
          activeChassisId: true,
          abilityAlloc: true,
        },
      },
      gearItems: {
        where: { gameId: "yanmar", equippedSlot: { not: null } },
        select: {
          id: true,
          slot: true,
          grade: true,
          enhanceLevel: true,
          failBonus: true,
          mainOption: true,
          subOptions: true,
          masterOption: true,
          nameSnapshot: true,
          durability: true,
          durabilityMax: true,
          equippedSlot: true,
        },
      },
    },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const loadout = user.chassisLoadouts[0];
  const progress = getPlayerLevelProgress(user.totalXp);
  const nickname = user.nickname?.trim() || "익명의 조종사";

  const equippedGear: PublicEquippedGearItem[] = user.gearItems.map((item) => {
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
      masterOption: item.masterOption as PublicEquippedGearItem["masterOption"],
      nameSnapshot: buildItemName(grade, subOptions, slot),
      durability: item.durability,
      durabilityMax: item.durabilityMax,
      equippedSlot: item.equippedSlot as GearSlot | null,
    };
  });

  const profile: PublicUserProfile = {
    userId: user.id,
    nickname,
    profileAvatarId: user.profileAvatarId,
    totalXp: user.totalXp,
    level: progress.level,
    currentXp: progress.currentXp,
    requiredXp: progress.requiredXp,
    progressPct: progress.progressPct,
    activeChassisId: loadout?.activeChassisId ?? DEFAULT_CHASSIS_ID,
    abilityAlloc: parseAbilityAlloc(loadout?.abilityAlloc),
    equippedGear,
  };

  return NextResponse.json({ profile });
}
