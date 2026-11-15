-- Aygır sayfasının Grup ve Pist süzgeçleri (mevcut satırlar -1 = "Tüm Gruplar / Tüm Pistler")
ALTER TABLE "TjkPedigriStat" ADD COLUMN "groupId" INTEGER NOT NULL DEFAULT -1,
ADD COLUMN "pistId" INTEGER NOT NULL DEFAULT -1;

-- DropIndex
DROP INDEX "TjkPedigriStat_kind_tjkId_year_key";
DROP INDEX "TjkPedigriStat_kind_year_breed_idx";

-- CreateIndex
CREATE UNIQUE INDEX "TjkPedigriStat_kind_tjkId_year_groupId_pistId_key" ON "TjkPedigriStat"("kind", "tjkId", "year", "groupId", "pistId");
CREATE INDEX "TjkPedigriStat_kind_year_groupId_pistId_breed_idx" ON "TjkPedigriStat"("kind", "year", "groupId", "pistId", "breed");
