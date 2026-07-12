import type { YanmarEquipmentPart } from "./equipment";

export type UpgradeAttachmentTab = "bucket" | "breaker" | "grapple";

export const YANMAR_UPGRADE_ATTACHMENT_TABS = [
  {
    id: "bucket" as const,
    label: "버켓",
    part: "BUCKET" as const,
    icon: "/images/yanmar/2d/attachments/bucket.png",
    diagram: "/images/yanmar/2d/excavator-side-diagram-premium.png",
  },
  {
    id: "breaker" as const,
    label: "브레이커",
    part: "CRASH_RESPAWN" as const,
    icon: "/images/yanmar/2d/attachments/breaker.png",
    diagram: "/images/yanmar/2d/excavator-side-diagram-breaker.png",
  },
  {
    id: "grapple" as const,
    label: "집게",
    part: "GRAPPLE_ADHESION" as const,
    icon: "/images/yanmar/2d/attachments/grapple.png",
    diagram: "/images/yanmar/2d/excavator-side-diagram-grapple.png",
  },
] as const;

export const YANMAR_UPGRADE_VISUALS = {
  excavatorDiagram: "/images/yanmar/2d/excavator-side-diagram-premium.png",
  dumpTruckDiagram: "/images/yanmar/2d/dump-truck-premium-preview.png",
  haulTruckDiagram: "/images/yanmar/2d/rock-haul-truck-premium-preview.png",
  excavatorHotspots: {
    BOOM: { x: 0.45, y: 0.24, label: "붐" },
    ARM: { x: 0.18, y: 0.34, label: "암" },
    ATTACHMENT: { x: 0.11, y: 0.52 },
    ENGINE: { x: 0.74, y: 0.5, label: "엔진" },
  },
  dumpTruckUpgrades: [
    { part: "TRUCK_CAPACITY" as const, label: "하역량" },
    { part: "TRUCK_SPEED" as const, label: "트럭속도" },
  ],
  haulTruckUpgrades: [
    { part: "HAUL_TRUCK_SPEED" as const, label: "돌트럭속도" },
    { part: "HILL_SAFE_LOAD" as const, label: "안전적재" },
  ],
} as const;

export type UpgradeExcavatorPart = "BOOM" | "ARM" | "ENGINE";
export type UpgradeDumpTruckPart =
  (typeof YANMAR_UPGRADE_VISUALS.dumpTruckUpgrades)[number]["part"];
export type UpgradeHaulTruckPart =
  (typeof YANMAR_UPGRADE_VISUALS.haulTruckUpgrades)[number]["part"];
export type UpgradeTruckPart = UpgradeDumpTruckPart | UpgradeHaulTruckPart;

export const EXCAVATOR_BODY_PARTS: UpgradeExcavatorPart[] = ["BOOM", "ARM", "ENGINE"];

export function getUpgradeAttachmentTab(
  id: UpgradeAttachmentTab,
): (typeof YANMAR_UPGRADE_ATTACHMENT_TABS)[number] {
  return (
    YANMAR_UPGRADE_ATTACHMENT_TABS.find((tab) => tab.id === id) ??
    YANMAR_UPGRADE_ATTACHMENT_TABS[0]
  );
}

export function isTruckUpgradePart(part: YanmarEquipmentPart): part is UpgradeTruckPart {
  return (
    part === "TRUCK_CAPACITY" ||
    part === "TRUCK_SPEED" ||
    part === "HAUL_TRUCK_SPEED" ||
    part === "HILL_SAFE_LOAD"
  );
}
