-- Speeds up per-user season aggregates used by rankings / home stats.
CREATE INDEX "GameScore_gameId_monthKey_userId_idx" ON "GameScore"("gameId", "monthKey", "userId");
