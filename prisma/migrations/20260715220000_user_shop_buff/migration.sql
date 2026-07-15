-- CreateTable
CREATE TABLE "UserShopBuff" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL DEFAULT 'yanmar',
    "itemId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserShopBuff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserShopBuff_userId_gameId_expiresAt_idx" ON "UserShopBuff"("userId", "gameId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserShopBuff_userId_gameId_itemId_key" ON "UserShopBuff"("userId", "gameId", "itemId");

-- AddForeignKey
ALTER TABLE "UserShopBuff" ADD CONSTRAINT "UserShopBuff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
