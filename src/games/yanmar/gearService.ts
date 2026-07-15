import type { PrismaClient } from "@/generated/prisma/client";
import {
  WORK_GEAR_DROP_BASE_CHANCE,
  WORK_GEAR_DROP_GRADES,
  GEAR_INVENTORY_BASE,
  clampGearInventorySlots,
  GEAR_SLOTS,
  GEAR_SLOT_LABEL,
  ITEM_GRADE_LABEL,
  WORK_CORE_DROP,
  type GearSlot,
  type ItemGrade,
  type MasterOptionKey,
} from "./gearCatalog";
import { createGearItem, pickGrade, pickSlot, canonicalizeMainOption, canonicalizeSubOptions } from "./gearGenerate";
import type { MasterOptionInst } from "./gearGenerate";
import { calculateFinalYanmarStats, type EquippedGearInput } from "./gearStats";
import type { ChassisModelId } from "./chassisCatalog";
import { parseOwnedChassisIds } from "./chassisCatalog";
import type { MainOptionInst } from "./gearGenerate";
import { asJson } from "./jsonCompat";

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

const FULL_INVENTORY_MAIL_STARS: Record<ItemGrade, number> = {
  NORMAL: 8,
  ENHANCED: 20,
  PRECISION: 50,
  MASTER: 120,
};

export function parseGearJson<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  return raw as T;
}

export function toEquippedInputs(
  items: {
    slot: string;
    durability: number;
    equippedSlot: string | null;
    grade: string;
    enhanceLevel: number;
    mainOption: unknown;
    subOptions: unknown;
    masterOption: unknown;
  }[],
): EquippedGearInput[] {
  return items
    .filter((i) => i.equippedSlot)
    .map((i) => {
      const slot = i.slot as EquippedGearInput["slot"];
      const grade = i.grade as ItemGrade;
      const enhanceLevel = i.enhanceLevel;
      const raw = parseGearJson<MainOptionInst | null>(i.mainOption, null);
      return {
        slot,
        durability: i.durability,
        data: {
          slot,
          grade,
          enhanceLevel,
          mainOption: canonicalizeMainOption(slot, grade, enhanceLevel, raw),
          subOptions: canonicalizeSubOptions(i.subOptions),
          masterOption: i.masterOption
            ? parseGearJson<MasterOptionInst | null>(i.masterOption, null)
            : null,
        },
      };
    });
}

export async function loadUserFinalStats(
  tx: Tx | PrismaClient,
  userId: string,
  gameId = "yanmar",
) {
  const [loadout, items, repair] = await Promise.all([
    tx.userChassisLoadout.findUnique({ where: { userId_gameId: { userId, gameId } } }),
    tx.gearItem.findMany({ where: { userId, gameId } }),
    tx.userRepairState.findUnique({ where: { userId_gameId: { userId, gameId } } }),
  ]);

  let repairBuff: "NONE" | "SMALL" | "LARGE" = "NONE";
  if (
    repair?.buffKind &&
    repair.buffKind !== "NONE" &&
    repair.buffExpiresAt &&
    repair.buffExpiresAt.getTime() > Date.now()
  ) {
    repairBuff = repair.buffKind as "SMALL" | "LARGE";
  }

  const chassisId = (loadout?.activeChassisId ?? "ViO17_1") as ChassisModelId;
  const equipped = toEquippedInputs(items);
  const stats = calculateFinalYanmarStats({
    chassisId,
    equipped,
    repairBuff,
    repairState: repair,
  });

  return {
    stats,
    loadout,
    items,
    repair,
    maintenance: stats.maintenance,
    ownedChassisIds: parseOwnedChassisIds(loadout?.ownedChassisIds),
  };
}

export type WorkDropTrigger =
  | "soilDump"
  | "breaker"
  | "hillDump"
  | "dumpTruckFull"
  | "haulTruckFull";

const DROP_MASTER_KEY: Record<WorkDropTrigger, MasterOptionKey> = {
  soilDump: "soilDumpGearDrop",
  breaker: "breakerGearDrop",
  hillDump: "hillDumpGearDrop",
  dumpTruckFull: "dumpTruckFullGearDrop",
  haulTruckFull: "haulTruckFullGearDrop",
};

export function workDropChance(
  trigger: WorkDropTrigger,
  activeMasters: Partial<Record<MasterOptionKey, MasterOptionInst>>,
) {
  const key = DROP_MASTER_KEY[trigger];
  const bonus = activeMasters[key];
  let chance = WORK_GEAR_DROP_BASE_CHANCE;
  if (bonus) {
    // value 10 → ×1.10, +10 승단 후 20 → ×1.20
    chance *= 1 + Math.max(0, bonus.value) / 100;
  }
  return chance;
}

export type WorkGearDropClientPayload = {
  nameSnapshot: string;
  grade: ItemGrade;
  slot: GearSlot;
  mailed: boolean;
};

export function serializeWorkGearDrop(
  drop: Awaited<ReturnType<typeof tryWorkGearDrop>>,
): WorkGearDropClientPayload | null {
  if (drop.dropped) {
    return {
      nameSnapshot: drop.nameSnapshot,
      grade: drop.grade,
      slot: drop.slot,
      mailed: false,
    };
  }
  if (drop.reason === "inventory_full" && drop.mailed) {
    return {
      nameSnapshot: drop.nameSnapshot,
      grade: drop.grade,
      slot: drop.slot,
      mailed: true,
    };
  }
  return null;
}

export async function getUserGearInventorySlots(
  tx: Tx | PrismaClient,
  userId: string,
): Promise<number> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { gearInventorySlots: true },
  });
  return clampGearInventorySlots(
    user?.gearInventorySlots ?? GEAR_INVENTORY_BASE,
  );
}

export async function tryWorkGearDrop(
  tx: Tx,
  userId: string,
  trigger: WorkDropTrigger,
  gameId = "yanmar",
) {
  const { stats, items } = await loadUserFinalStats(tx, userId, gameId);
  const chance = workDropChance(trigger, stats.activeMasters);
  if (Math.random() >= chance) {
    return { dropped: false as const, reason: "miss" as const };
  }

  const grade = pickGrade(WORK_GEAR_DROP_GRADES);
  const slot = pickSlot();
  const durabilityMax = stats.durabilityMaxPerPiece;
  const data = createGearItem(slot, grade, durabilityMax);
  const inventorySlots = await getUserGearInventorySlots(tx, userId);

  if (items.length >= inventorySlots) {
    // 인벤 가득: 장비 대신 등급별 스타를 메일 지급 (드롭 성공 시에만 — 스팸 방지)
    const stars = FULL_INVENTORY_MAIL_STARS[grade];
    await tx.userMail.create({
      data: {
        userId,
        title: "장비 드롭 (인벤 가득 · 스타 전환)",
        body: `작업 중 [${ITEM_GRADE_LABEL[grade]}] ${data.nameSnapshot}(${GEAR_SLOT_LABEL[slot]})이(가) 나왔지만 인벤토리가 가득 차 장비를 받을 수 없습니다. 동일 가치로 ${stars} 스타를 우편으로 보냅니다. 장비를 분해·정리한 뒤 다시 작업해 주세요.`,
        currencyAmount: stars,
      },
    });
    return {
      dropped: false as const,
      reason: "inventory_full" as const,
      mailed: true as const,
      nameSnapshot: data.nameSnapshot,
      grade: data.grade,
      slot: data.slot,
      mailStars: stars,
    };
  }

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
    dropped: true as const,
    item: created,
    nameSnapshot: data.nameSnapshot,
    grade: data.grade,
    slot: data.slot,
  };
}

export async function tryWorkEnhanceCoresDrop(
  tx: Tx,
  userId: string,
  trigger: WorkDropTrigger,
) {
  const cfg = WORK_CORE_DROP[trigger];
  if (!cfg || Math.random() >= cfg.chance) {
    return { dropped: false as const, amount: 0 };
  }
  const amount =
    cfg.min === cfg.max
      ? cfg.min
      : cfg.min + Math.floor(Math.random() * (cfg.max - cfg.min + 1));
  if (amount <= 0) return { dropped: false as const, amount: 0 };
  const updated = await tx.user.update({
    where: { id: userId },
    data: { enhanceCores: { increment: amount } },
    select: { enhanceCores: true },
  });
  return {
    dropped: true as const,
    amount,
    enhanceCores: updated.enhanceCores,
  };
}

export function applyMasterScoreXpBonus(
  trigger: "soil" | "breaker" | "hill",
  baseScore: number,
  baseXp: number,
  activeMasters: Partial<Record<MasterOptionKey, MasterOptionInst>>,
) {
  let score = baseScore;
  let xp = baseXp;
  if (trigger === "soil") {
    const s = activeMasters.soilDumpScorePct;
    const x = activeMasters.soilDumpXpPct;
    if (s) score = Math.round(score * (1 + s.value / 100));
    if (x) xp = Math.round(xp * (1 + x.value / 100));
  } else if (trigger === "breaker") {
    const s = activeMasters.breakerScorePct;
    const x = activeMasters.breakerXpPct;
    if (s) score = Math.round(score * (1 + s.value / 100));
    if (x) xp = Math.round(xp * (1 + x.value / 100));
  } else {
    const s = activeMasters.hillDumpScorePct;
    const x = activeMasters.hillDumpXpPct;
    if (s) score = Math.round(score * (1 + s.value / 100));
    if (x) xp = Math.round(xp * (1 + x.value / 100));
  }
  return { score, xp };
}

export function applyWorkExpGainSub(
  xp: number,
  workExpGainBonus: number,
  opts?: { isMission?: boolean; workXpMult?: number },
) {
  if (opts?.isMission) return xp;
  const mult = opts?.workXpMult ?? 1;
  return Math.round(xp * (1 + workExpGainBonus) * mult);
}

export { GEAR_SLOTS };
