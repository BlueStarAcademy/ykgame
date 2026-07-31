-- Sports-meet ticket counters + weekly ranking tables
-- (schema drifted ahead of migrations on prod)

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sportsMeetDayKey" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sportsMeetAttemptsUsed" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "YanmarSportsMeetScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "patternId" INTEGER NOT NULL,
    "bestTimeMs" INTEGER NOT NULL,
    "playCount" INTEGER NOT NULL DEFAULT 1,
    "lastRunId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YanmarSportsMeetScore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "YanmarSportsMeetScore_userId_weekKey_key" ON "YanmarSportsMeetScore"("userId", "weekKey");
CREATE INDEX IF NOT EXISTS "YanmarSportsMeetScore_weekKey_bestTimeMs_idx" ON "YanmarSportsMeetScore"("weekKey", "bestTimeMs");
CREATE INDEX IF NOT EXISTS "YanmarSportsMeetScore_userId_weekKey_idx" ON "YanmarSportsMeetScore"("userId", "weekKey");

DO $$ BEGIN
  ALTER TABLE "YanmarSportsMeetScore" ADD CONSTRAINT "YanmarSportsMeetScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "YanmarSportsMeetWeekSettlement" (
    "weekKey" TEXT NOT NULL,
    "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "participantCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "YanmarSportsMeetWeekSettlement_pkey" PRIMARY KEY ("weekKey")
);

CREATE TABLE IF NOT EXISTS "YanmarSportsMeetRewardGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "stars" INTEGER NOT NULL,
    "mailId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YanmarSportsMeetRewardGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "YanmarSportsMeetRewardGrant_userId_weekKey_key" ON "YanmarSportsMeetRewardGrant"("userId", "weekKey");
CREATE INDEX IF NOT EXISTS "YanmarSportsMeetRewardGrant_weekKey_idx" ON "YanmarSportsMeetRewardGrant"("weekKey");

DO $$ BEGIN
  ALTER TABLE "YanmarSportsMeetRewardGrant" ADD CONSTRAINT "YanmarSportsMeetRewardGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
