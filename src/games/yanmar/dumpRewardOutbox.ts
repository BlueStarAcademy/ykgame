export const DUMP_REWARD_BATCH_MAX_CHUNKS = 20;
export const DUMP_REWARD_BATCH_DEBOUNCE_MS = 400;

const STORAGE_PREFIX = "ykgame:yanmar:dump-reward-outbox:v1";
const EVENT_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export interface DumpRewardOutboxBatch {
  eventId: string;
  chunkCount: number;
  optimisticStars: number;
  optimisticXp: number;
  optimisticScore: number;
  createdAt: number;
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function isValidDumpRewardOutboxBatch(
  value: unknown,
): value is DumpRewardOutboxBatch {
  if (!value || typeof value !== "object") return false;
  const batch = value as Partial<DumpRewardOutboxBatch>;
  return (
    typeof batch.eventId === "string" &&
    EVENT_ID_PATTERN.test(batch.eventId) &&
    typeof batch.chunkCount === "number" &&
    Number.isInteger(batch.chunkCount) &&
    batch.chunkCount >= 1 &&
    batch.chunkCount <= DUMP_REWARD_BATCH_MAX_CHUNKS &&
    isFiniteNonNegative(batch.optimisticStars) &&
    isFiniteNonNegative(batch.optimisticXp) &&
    isFiniteNonNegative(batch.optimisticScore) &&
    isFiniteNonNegative(batch.createdAt)
  );
}

export function parseDumpRewardOutbox(serialized: string | null) {
  if (!serialized) return [] as DumpRewardOutboxBatch[];
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidDumpRewardOutboxBatch);
  } catch {
    return [];
  }
}

export function serializeDumpRewardOutbox(
  batches: readonly DumpRewardOutboxBatch[],
) {
  return JSON.stringify(batches.filter(isValidDumpRewardOutboxBatch));
}

export function mergeDumpRewardOutbox(
  batches: readonly DumpRewardOutboxBatch[],
  batch: DumpRewardOutboxBatch,
) {
  const valid = batches.filter(isValidDumpRewardOutboxBatch);
  if (!isValidDumpRewardOutboxBatch(batch)) return [...valid];
  const index = valid.findIndex((item) => item.eventId === batch.eventId);
  if (index < 0) return [...valid, batch];
  return valid.map((item, itemIndex) => (itemIndex === index ? batch : item));
}

export function removeDumpRewardOutboxBatch(
  batches: readonly DumpRewardOutboxBatch[],
  eventId: string,
) {
  return batches.filter(
    (batch) =>
      isValidDumpRewardOutboxBatch(batch) && batch.eventId !== eventId,
  );
}

export function dumpRewardOutboxStorageKey(userId: string) {
  return `${STORAGE_PREFIX}:${encodeURIComponent(userId)}`;
}
