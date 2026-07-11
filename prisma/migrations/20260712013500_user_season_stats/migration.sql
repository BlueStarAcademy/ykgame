-- Additive season aggregate table. Existing GameScore.monthKey values are kept
-- verbatim as seasonKey because historical monthly rows cannot be mapped to a
-- quarterly season reliably without an authoritative reprocessing window.
CREATE TABLE "UserSeasonStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "seasonKey" TEXT NOT NULL,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "totalStars" INTEGER NOT NULL DEFAULT 0,
    "totalPlayTime" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSeasonStats_pkey" PRIMARY KEY ("id")
);

INSERT INTO "UserSeasonStats" (
    "id",
    "userId",
    "gameId",
    "seasonKey",
    "totalScore",
    "totalStars",
    "totalPlayTime",
    "updatedAt"
)
SELECT
    'backfill_' || md5(
        gs."userId" || ':' || gs."gameId" || ':' || gs."monthKey"
    ),
    gs."userId",
    gs."gameId",
    gs."monthKey",
    SUM(gs.score)::INTEGER,
    SUM(gs.stars)::INTEGER,
    SUM(gs."playTime")::INTEGER,
    CURRENT_TIMESTAMP
FROM "GameScore" gs
GROUP BY gs."userId", gs."gameId", gs."monthKey";

CREATE UNIQUE INDEX "UserSeasonStats_userId_gameId_seasonKey_key"
    ON "UserSeasonStats"("userId", "gameId", "seasonKey");
CREATE INDEX "UserSeasonStats_gameId_seasonKey_totalScore_idx"
    ON "UserSeasonStats"("gameId", "seasonKey", "totalScore");
CREATE INDEX "UserSeasonStats_userId_gameId_seasonKey_idx"
    ON "UserSeasonStats"("userId", "gameId", "seasonKey");

ALTER TABLE "UserSeasonStats"
    ADD CONSTRAINT "UserSeasonStats_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
