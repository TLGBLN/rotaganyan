-- CreateTable
CREATE TABLE "TjkPedigriStat" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "tjkId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "country" TEXT,
    "breed" TEXT NOT NULL,
    "runnerCount" INTEGER NOT NULL,
    "winnerCount" INTEGER,
    "starts" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "seconds" INTEGER NOT NULL,
    "thirds" INTEGER NOT NULL,
    "fourths" INTEGER NOT NULL,
    "fifths" INTEGER NOT NULL,
    "earningsTRY" DOUBLE PRECISION NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TjkPedigriStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TjkPedigriStat_kind_tjkId_year_key" ON "TjkPedigriStat"("kind", "tjkId", "year");

-- CreateIndex
CREATE INDEX "TjkPedigriStat_kind_year_breed_idx" ON "TjkPedigriStat"("kind", "year", "breed");

-- CreateIndex
CREATE INDEX "TjkPedigriStat_normalizedName_kind_idx" ON "TjkPedigriStat"("normalizedName", "kind");
