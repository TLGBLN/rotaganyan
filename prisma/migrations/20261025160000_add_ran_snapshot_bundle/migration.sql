-- RAN shadow-only immutable snapshot. This migration is PREPARED but NOT EXECUTED.
-- No changes to Prediction, Pick, HomeKupon, production engine or publication.
CREATE TABLE "RanSnapshotBundle" (
  "id" TEXT NOT NULL,
  "bundleKey" TEXT NOT NULL,
  "engineVersion" TEXT NOT NULL,
  "weightsFingerprint" TEXT NOT NULL,
  "bundleGeneratedAt" TIMESTAMP(3) NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RanSnapshotBundle_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RanSnapshotBundle_bundleKey_key" ON "RanSnapshotBundle"("bundleKey");
CREATE INDEX "RanSnapshotBundle_createdAt_idx" ON "RanSnapshotBundle"("createdAt");
