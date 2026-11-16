-- TJK pedigri günlük yenileme kuyruğu + günlük görüntü arşivi (yalnız yeni tablolar; mevcut verilere dokunmaz)
CREATE TABLE "TjkPedigriSyncUnit" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,
    "pistId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "rowCount" INTEGER,
    "eksik" INTEGER,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "TjkPedigriSyncUnit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TjkPedigriSnapshot" (
    "id" TEXT NOT NULL,
    "snapshotDate" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "notlar" TEXT,
    "payload" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TjkPedigriSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TjkPedigriSyncUnit_day_kind_year_groupId_pistId_key" ON "TjkPedigriSyncUnit"("day", "kind", "year", "groupId", "pistId");
CREATE INDEX "TjkPedigriSyncUnit_day_status_idx" ON "TjkPedigriSyncUnit"("day", "status");
CREATE UNIQUE INDEX "TjkPedigriSnapshot_snapshotDate_key" ON "TjkPedigriSnapshot"("snapshotDate");
