-- CreateTable
CREATE TABLE "TickerNotice" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TickerNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TickerWinEvent" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TickerWinEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TickerNotice_active_sortOrder_idx" ON "TickerNotice"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "TickerWinEvent_createdAt_idx" ON "TickerWinEvent"("createdAt");
