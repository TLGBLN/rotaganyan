-- CreateTable
CREATE TABLE "AgfSnapshot" (
    "id" TEXT NOT NULL,
    "runnerId" TEXT NOT NULL,
    "agf" DOUBLE PRECISION NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgfSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgfSnapshot_runnerId_capturedAt_idx" ON "AgfSnapshot"("runnerId", "capturedAt");

-- AddForeignKey
ALTER TABLE "AgfSnapshot" ADD CONSTRAINT "AgfSnapshot_runnerId_fkey" FOREIGN KEY ("runnerId") REFERENCES "Runner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
