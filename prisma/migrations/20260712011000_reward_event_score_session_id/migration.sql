-- Reward API idempotency ledger. The stored JSON is the exact successful API
-- response and allows retries to replay without issuing rewards again.
CREATE TABLE "RewardEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "GameScore" ADD COLUMN "sessionId" TEXT;

CREATE UNIQUE INDEX "RewardEvent_userId_gameId_eventId_key"
    ON "RewardEvent"("userId", "gameId", "eventId");
CREATE INDEX "RewardEvent_userId_createdAt_idx"
    ON "RewardEvent"("userId", "createdAt");
CREATE UNIQUE INDEX "GameScore_userId_gameId_sessionId_key"
    ON "GameScore"("userId", "gameId", "sessionId");

ALTER TABLE "RewardEvent"
    ADD CONSTRAINT "RewardEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
