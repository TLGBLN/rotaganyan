-- S2 gölge kıyas kayıtları (yalnız yeni tablo; mevcut verilere dokunmaz)
CREATE TABLE "S2GolgeKiyas" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "tarih" TEXT NOT NULL,
    "hipodrom" TEXT NOT NULL,
    "kosuNo" INTEGER NOT NULL,
    "sinif" TEXT NOT NULL,
    "durum" TEXT NOT NULL,
    "neden" TEXT,
    "ayrinti" TEXT,
    "maxFarkPp" DOUBLE PRECISION,
    "kazananNo" INTEGER,
    "canliSira" INTEGER,
    "s2Sira" INTEGER,
    "canliP" DOUBLE PRECISION,
    "s2P" DOUBLE PRECISION,
    "atlarJson" JSONB,
    "agirlikS2" TEXT NOT NULL,
    "hesaplandi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "S2GolgeKiyas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "S2GolgeKiyas_raceId_key" ON "S2GolgeKiyas"("raceId");
CREATE INDEX "S2GolgeKiyas_tarih_idx" ON "S2GolgeKiyas"("tarih");
CREATE INDEX "S2GolgeKiyas_durum_idx" ON "S2GolgeKiyas"("durum");
