import type { YanmarEquipmentPart } from "./equipment";

export const YANMAR_UPGRADE_VISUALS = {
  excavatorDiagram: "/images/yanmar/2d/excavator-side-diagram-premium.png",
  dumpTruckDiagram: "/images/yanmar/2d/dump-truck-premium-preview.png",
  hotspots: {
    BOOM: { x: 0.32, y: 0.24, label: "붐" },
    ARM: { x: 0.18, y: 0.38, label: "암" },
    BUCKET: { x: 0.11, y: 0.6, label: "버킷" },
    ENGINE: { x: 0.74, y: 0.5, label: "엔진" },
    TRUCK_CAPACITY: { x: 0.82, y: 0.83, label: "하역량" },
    TRUCK_SPEED: { x: 0.92, y: 0.83, label: "트럭속도" },
  } satisfies Record<YanmarEquipmentPart, { x: number; y: number; label: string }>,
} as const;

export type UpgradeHotspotPart = keyof typeof YANMAR_UPGRADE_VISUALS.hotspots;
