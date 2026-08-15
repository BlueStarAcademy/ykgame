export type YanmarGuideItemId = string;

export type YanmarGuideSectionDef = {
  id: string;
  itemIds: readonly string[];
  hasIntro?: boolean;
};

/**
 * Stable ids for 「게임방법」 help content.
 * Display copy lives in messages under yanmar.guide.sections.{id}
 */
export const YANMAR_GUIDE_SECTIONS: readonly YanmarGuideSectionDef[] = [
  {
    id: "modes",
    hasIntro: true,
    itemIds: ["game", "practice", "tutorial", "ride"],
  },
  {
    id: "controls",
    itemIds: ["leftLever", "rightLever", "travel", "functionMenu", "pedals", "camera"],
  },
  {
    id: "attachments",
    hasIntro: true,
    itemIds: ["bucket", "breaker", "grapple"],
  },
  {
    id: "rewards",
    hasIntro: true,
    itemIds: ["soilDump", "crash", "rockDump", "stars", "coupons"],
  },
  {
    id: "unlocks",
    hasIntro: true,
    itemIds: ["tier1", "tier2", "tier3", "flood", "sportsMeet"],
  },
  {
    id: "quests",
    itemIds: ["daily", "repeat", "mission"],
  },
  {
    id: "gear",
    itemIds: ["gacha", "enhance", "chassis"],
  },
  {
    id: "workshop",
    itemIds: ["facility", "shopBuff"],
  },
  {
    id: "field",
    itemIds: ["fieldStar", "speedBuff", "repairTent"],
  },
  {
    id: "season",
    itemIds: ["ranking", "mailbox", "saveExit"],
  },
] as const;
