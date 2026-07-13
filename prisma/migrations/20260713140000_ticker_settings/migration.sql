-- CreateTable
CREATE TABLE "TickerSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "scrollSpeedPx" INTEGER NOT NULL DEFAULT 60,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TickerSettings_pkey" PRIMARY KEY ("id")
);

-- Default singleton row
INSERT INTO "TickerSettings" ("id", "scrollSpeedPx", "updatedAt")
VALUES ('default', 60, CURRENT_TIMESTAMP);
