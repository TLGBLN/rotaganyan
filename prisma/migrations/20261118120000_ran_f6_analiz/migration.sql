-- CreateTable
CREATE TABLE "RanF6Analiz" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "surum" TEXT NOT NULL,
    "tur" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RanF6Analiz_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RanF6Analiz_raceId_idx" ON "RanF6Analiz"("raceId");

-- CreateIndex
CREATE UNIQUE INDEX "RanF6Analiz_raceId_surum_key" ON "RanF6Analiz"("raceId", "surum");


-- Row Level Security: yalniz sunucu (postgres, BYPASSRLS) kullanir; anon/authenticated erisemez. Politika YOK.
ALTER TABLE "RanF6Analiz" ENABLE ROW LEVEL SECURITY;
