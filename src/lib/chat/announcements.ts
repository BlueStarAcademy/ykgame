import {
  displayName,
  publishSystemChatMessage,
} from "@/lib/chat/messages";
import { getUserChatChannel } from "@/lib/chat/presence";
import type { ChatGearSnapshot } from "@/lib/chat/types";

export async function announceMasterEnhance10(options: {
  userId: string;
  nickname: string | null | undefined;
  item: {
    id: string;
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
}): Promise<void> {
  const channel = await getUserChatChannel(options.userId);
  if (channel == null) return;

  const name = displayName(options.nickname);
  const gearName = options.item.nameSnapshot;
  const gearSnapshot: ChatGearSnapshot = {
    itemId: options.item.id,
    nameSnapshot: gearName,
    slot: options.item.slot,
    grade: options.item.grade,
    enhanceLevel: options.item.enhanceLevel,
    mainOption: options.item.mainOption,
    subOptions: options.item.subOptions,
    masterOption: options.item.masterOption,
    durability: options.item.durability,
    durabilityMax: options.item.durabilityMax,
  };

  await publishSystemChatMessage({
    channel,
    userId: options.userId,
    nickname: name,
    body: `${name}님이 ${gearName}10강화에 성공하셨습니다!`,
    gearSnapshot,
  });
}

export async function announceSportsMeetTakeover(options: {
  winnerUserId: string;
  winnerNickname: string | null | undefined;
  previousUserId: string;
  previousNickname: string | null | undefined;
}): Promise<void> {
  const winner = displayName(options.winnerNickname);
  const previous = displayName(options.previousNickname);
  await publishSystemChatMessage({
    channel: null,
    userId: options.winnerUserId,
    nickname: winner,
    body: `굴착기 운동회에서 ${winner}님이 ${previous}님을 따돌리고 1위에 올랐습니다!`,
  });
}

export async function announceCouponWinChat(options: {
  nickname: string;
  message: string;
}): Promise<void> {
  await publishSystemChatMessage({
    channel: null,
    nickname: options.nickname,
    body: options.message,
  });
}
