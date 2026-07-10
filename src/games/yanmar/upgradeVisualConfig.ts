import type { YanmarEquipmentPart } from "./equipment";

export const YANMAR_UPGRADE_VISUALS = {
  excavatorDiagram: "/images/yanmar/2d/excavator-side-diagram-premium.png",
  dumpTruckDiagram: "/images/yanmar/2d/dump-truck-premium-preview.png",
  excavatorHotspots: {
    BOOM: { x: 0.45, y: 0.24, label: "붐" },
    ARM: { x: 0.18, y: 0.34, label: "암" },
    BUCKET: { x: 0.11, y: 0.52, label: "버킷" },
    ENGINE: { x: 0.74, y: 0.5, label: "엔진" },
  },
  truckUpgrades: [
    { part: "TRUCK_CAPACITY" as const, label: "하역량" },
    { part: "TRUCK_SPEED" as const, label: "트럭속도" },
    { part: "CRASH_RESPAWN" as const, label: "Crash복귀" },
    { part: "HAUL_TRUCK_SPEED" as const, label: "돌트럭복귀" },
  ],
} as const;

export type UpgradeExcavatorPart = keyof typeof YANMAR_UPGRADE_VISUALS.excavatorHotspots;
export type UpgradeTruckPart = (typeof YANMAR_UPGRADE_VISUALS.truckUpgrades)[number]["part"];

export function isTruckUpgradePart(part: YanmarEquipmentPart): part is UpgradeTruckPart {
  return (
    part === "TRUCK_CAPACITY" ||
    part === "TRUCK_SPEED" ||
    part === "CRASH_RESPAWN" ||
    part === "HAUL_TRUCK_SPEED"
  );
}
