export type ChatGearSnapshot = {
  itemId: string;
  nameSnapshot: string;
  slot: string;
  grade: string;
  enhanceLevel: number;
  mainOption: unknown;
  subOptions: unknown;
  masterOption: unknown;
  durability?: number;
  durabilityMax?: number;
};

export type ChatWireMessage = {
  id: string;
  kind: "USER" | "SYSTEM";
  channel: number | null;
  userId: string | null;
  nickname: string | null;
  body: string;
  gearSnapshot: ChatGearSnapshot | null;
  createdAt: string;
};

export type ChatNotice = {
  id: string;
  message: string;
};
