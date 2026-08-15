export type YanmarGuideTabId = "start" | "controls" | "work" | "growth";

export type YanmarGuideVisualCard = {
  id: string;
  image: string;
  /** Optional secondary badge image (e.g. reward icon). */
  badgeImage?: string;
  /** Show numbered step chips (1 → 2 → 3) when true. */
  steps?: boolean;
};

export type YanmarGuideTabDef = {
  id: YanmarGuideTabId;
  /** Short lead paragraph under the tab title. */
  hasLead?: boolean;
  /** Hero banner image at top of the tab panel. */
  heroImage?: string;
  cards: readonly YanmarGuideVisualCard[];
};

/**
 * Tabbed 「게임방법」 schema.
 * Display copy lives in messages under yanmar.guide.tabs.{id}
 * and yanmar.guide.panels.{id}
 */
export const YANMAR_GUIDE_TABS: readonly YanmarGuideTabDef[] = [
  {
    id: "start",
    hasLead: true,
    heroImage: "/images/yanmar/2d/excavator-side-diagram-premium.png",
    cards: [
      {
        id: "path",
        image: "/images/yanmar/2d/cockpit/quest-premium.png?v=3",
        steps: true,
      },
      {
        id: "loop",
        image: "/images/yanmar/2d/workshop-coin-dump.svg",
        badgeImage: "/images/star-currency.svg",
        steps: true,
      },
      {
        id: "modes",
        image: "/images/yanmar/2d/chassis/light.png?v=3",
      },
    ],
  },
  {
    id: "controls",
    hasLead: true,
    heroImage: "/images/yanmar/2d/excavator-side-diagram-premium.png",
    cards: [
      {
        id: "leftLever",
        image: "/images/yanmar/2d/cockpit/function-premium.png",
      },
      {
        id: "rightLever",
        image: "/images/yanmar/2d/gear/bucket-normal.png?v=14",
      },
      {
        id: "travel",
        image: "/images/yanmar/2d/gear/track-normal.png?v=14",
      },
      {
        id: "functionMenu",
        image: "/images/yanmar/2d/cockpit/menu-premium.png",
      },
      {
        id: "pedals",
        image: "/images/yanmar/2d/cockpit/attachment-pedal-front.png",
        badgeImage: "/images/yanmar/2d/cockpit/horn-hud-premium.png",
      },
      {
        id: "camera",
        image: "/images/yanmar/2d/cockpit/auto-premium.png",
      },
    ],
  },
  {
    id: "work",
    hasLead: true,
    heroImage: "/images/yanmar/2d/rock-haul-truck-premium-preview.png",
    cards: [
      {
        id: "bucket",
        image: "/images/yanmar/2d/attachments/bucket.png",
        badgeImage: "/images/yanmar/2d/workshop-coin-dump.svg",
        steps: true,
      },
      {
        id: "breaker",
        image: "/images/yanmar/2d/attachments/breaker.png?v=2",
        badgeImage: "/images/yanmar/2d/workshop-coin-crash.svg",
        steps: true,
      },
      {
        id: "grapple",
        image: "/images/yanmar/2d/attachments/grapple.png",
        badgeImage: "/images/yanmar/2d/workshop-coin-hill.svg",
        steps: true,
      },
    ],
  },
  {
    id: "growth",
    hasLead: true,
    heroImage: "/images/yanmar/2d/cockpit/upgrade-anvil-premium.png?v=2",
    cards: [
      {
        id: "unlocks",
        image: "/images/yanmar/2d/chassis/models/ViO17_1.png",
        steps: true,
      },
      {
        id: "rewards",
        image: "/images/star-currency.svg",
        badgeImage: "/images/yanmar/2d/enhance-core.png?v=3",
      },
      {
        id: "gear",
        image: "/images/yanmar/2d/gear/arm-normal.png?v=14",
        badgeImage: "/images/yanmar/2d/gacha-ticket-standard.svg",
      },
      {
        id: "quests",
        image: "/images/yanmar/2d/cockpit/quest-premium.png?v=3",
      },
      {
        id: "field",
        image: "/images/yanmar/2d/cockpit/repair-tent-premium.png?v=2",
        badgeImage: "/images/yanmar/2d/street-speed-buff.svg",
      },
    ],
  },
] as const;
