import type { AbilityAlloc } from "@/games/yanmar/abilityAlloc";
import type { ChassisModelId } from "@/games/yanmar/chassisCatalog";
import type { GearSlot, ItemGrade } from "@/games/yanmar/gearCatalog";

/** Equipped gear snapshot for public profile (matches gear panel wire shape). */
export type PublicEquippedGearItem = {
  id: string;
  slot: GearSlot;
  slotLabel: string;
  grade: ItemGrade;
  gradeLabel: string;
  enhanceLevel: number;
  failBonus: number;
  mainOption: { key: string; value: number };
  mainLabel?: string;
  subOptions: {
    key: string;
    tier: number;
    value: number;
    rollMin: number;
    rollMax: number;
    isPercent?: boolean;
  }[];
  masterOption: {
    key: string;
    value: number;
    label: string;
    hideValue: boolean;
    isPercent: boolean;
  } | null;
  nameSnapshot: string;
  durability: number;
  durabilityMax: number;
  equippedSlot: GearSlot | null;
};

/** Safe subset of a player profile for other users (chat nickname click). */
export type PublicUserProfile = {
  userId: string;
  nickname: string;
  profileAvatarId: string | null;
  totalXp: number;
  level: number;
  currentXp: number;
  requiredXp: number;
  progressPct: number;
  activeChassisId: ChassisModelId | string;
  abilityAlloc: AbilityAlloc;
  equippedGear: PublicEquippedGearItem[];
};
