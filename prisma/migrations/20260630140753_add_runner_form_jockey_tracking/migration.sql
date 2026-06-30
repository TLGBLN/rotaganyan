-- AlterTable
ALTER TABLE "Runner" ADD COLUMN     "jockeyChanged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "previousJockey" TEXT,
ADD COLUMN     "recentForm" TEXT;
