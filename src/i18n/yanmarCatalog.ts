import type { GearSlot, ItemGrade } from "@/games/yanmar/gearCatalog";
import type { MaintenanceFluidId, MaintenancePointKind } from "@/games/yanmar/maintenance";
import type { MonumentUpgradeKey } from "@/games/yanmar/monument";
import type {
  WorkshopId,
  WorkshopShopItemId,
  WorkshopUpgradeKey,
} from "@/games/yanmar/workshop";

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

export function gearSlotLabel(t: TranslateFn, slot: GearSlot): string {
  return t(`catalog.slots.${slot}`);
}

export function gearGradeLabel(t: TranslateFn, grade: ItemGrade): string {
  return t(`catalog.grades.${grade}`);
}

export function gearGradePrefix(t: TranslateFn, grade: ItemGrade): string {
  return t(`catalog.gradePrefix.${grade}`);
}

export function gearItemDisplayName(
  t: TranslateFn,
  slot: GearSlot,
  grade: ItemGrade,
): string {
  return `${gearGradePrefix(t, grade)} ${t(`catalog.gear.${slot}.name`)}`;
}

export function gearStatLabel(t: TranslateFn, statKey: string): string {
  return t(`catalog.stats.${statKey}`);
}

export function monumentUpgradeLabel(
  t: TranslateFn,
  key: MonumentUpgradeKey,
): string {
  return t(`monument.catalog.upgrades.${key}.label`);
}

export function monumentQuestLabel(
  t: TranslateFn,
  metric: string,
  target: number,
): string {
  return t(`monument.catalog.questMetrics.${metric}`, { target });
}

export function workshopLabel(t: TranslateFn, id: WorkshopId): string {
  return t(`workshop.catalog.workshops.${id}.label`);
}

export function workshopPointsLabel(t: TranslateFn, id: WorkshopId): string {
  return t(`workshop.catalog.workshops.${id}.pointsLabel`);
}

export function workshopUpgradeLabel(
  t: TranslateFn,
  key: WorkshopUpgradeKey,
): string {
  return t(`workshop.catalog.upgrades.${key}.label`);
}

export function workshopUpgradeDescription(
  t: TranslateFn,
  key: WorkshopUpgradeKey,
): string {
  return t(`workshop.catalog.upgrades.${key}.description`);
}

export function workshopQuestLabel(t: TranslateFn, id: string): string {
  return t(`workshop.catalog.quests.${id}`);
}

export function workshopShopItemLabel(
  t: TranslateFn,
  id: WorkshopShopItemId,
): string {
  return t(`workshop.catalog.shop.${id}.label`);
}

export function workshopShopItemDescription(
  t: TranslateFn,
  id: WorkshopShopItemId,
): string {
  return t(`workshop.catalog.shop.${id}.description`);
}

export function maintenanceFluidLabel(
  t: TranslateFn,
  id: MaintenanceFluidId,
): string {
  return t(`repair.catalog.fluids.${id}.label`);
}

export function maintenanceFluidBlurb(
  t: TranslateFn,
  id: MaintenanceFluidId,
): string {
  return t(`repair.catalog.fluids.${id}.blurb`);
}

export function maintenanceFluidWhyReplace(
  t: TranslateFn,
  id: MaintenanceFluidId,
): string {
  return t(`repair.catalog.fluids.${id}.whyReplace`);
}

export function maintenancePointKindLabel(
  t: TranslateFn,
  kind: MaintenancePointKind,
): string {
  return t(`repair.catalog.pointKinds.${kind}`);
}
