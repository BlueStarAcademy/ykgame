-- AlterTable
ALTER TABLE "UserChassisLoadout" ADD COLUMN "abilityAlloc" JSONB NOT NULL DEFAULT '{"strength":0,"agility":0,"stamina":0,"endurance":0,"balance":0,"technique":0}';
