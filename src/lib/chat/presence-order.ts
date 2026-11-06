import {
  CHAT_CHANNEL_MAX,
  CHAT_CHANNEL_MIN,
} from "@/lib/chat-constants";

/** Exported for unit tests — pure channel selection helper. */
export function nextAutoChannels(
  preferred: number,
  min = CHAT_CHANNEL_MIN,
  max = CHAT_CHANNEL_MAX,
): number[] {
  const start = preferred < min || preferred > max ? min : preferred;
  const list: number[] = [];
  for (let ch = start; ch <= max; ch += 1) list.push(ch);
  for (let ch = min; ch < start; ch += 1) list.push(ch);
  return list;
}
