-- Publish-time RCA snapshot — 2026-10-11 kullanıcı talebi.
--
-- BU TABLO prisma/schema.prisma'DA KASITLI OLARAK YOK (ResearchSnapshotRun/
-- ResearchPickSnapshot ile AYNI, önceden kanıtlanmış desen — bkz. src/lib/research/
-- snapshot-runtime.ts). Neden: repo'nun prisma/migrations geçmişi 2026-06-30'da duruyor,
-- ama canlı DB'de ondan SONRA eklenmiş, migration dosyası OLMAYAN kolonlar/tablolar VAR
-- (HomeKupon.buildKey/manualOverrides/sourcePredictionsHash de bu kategoride — bkz.
-- src/server/services/rca-root-subcause.service.ts'in yorumu). `prisma migrate dev`
-- bu sürüklenmeyi görüp DESTRUCTIVE bir reset isteyebilir — bu yüzden yeni tablo da
-- AYNI izole yoldan (bu dosya + $executeRaw/$queryRaw erişim, src/server/services/
-- rca-publish-snapshot.service.ts) ekleniyor, migration geçmişine GİRMİYOR.
--
-- UYGULAMA (Claude BU SQL'İ KENDİSİ ÇALIŞTIRMADI — sandbox "Production Reads/Writes"
-- izni vermiyor; kullanıcı kendi ortamında — örn. Supabase SQL Editor veya
-- `npx prisma db execute --file prisma/manual-sql/2026-10-11_publish_rca_snapshot.sql`
-- ile elle çalıştırmalı). Idempotent: IF NOT EXISTS kullanılıyor, güvenle tekrar
-- çalıştırılabilir.
--
-- ÖNKOŞUL UYARISI: HomeKupon.buildKey/manualOverrides/sourcePredictionsHash kolonlarının
-- GERÇEK fiziksel tipleri bu oturumda information_schema ile DOĞRULANAMADI (DB erişimi
-- sandbox tarafından reddedildi) — src/server/services/rca-root-subcause.service.ts'teki
-- TS tipinden (`buildKey: string | null; manualOverrides: unknown; sourcePredictionsHash:
-- string | null`) ÇIKARSANDI: buildKey/sourcePredictionsHash = text, manualOverrides =
-- jsonb. Bu üç kolonu BU DOSYA OLUŞTURMUYOR (zaten var) — yalnız varsayım burada
-- belgeleniyor, kullanıcı çalıştırmadan ÖNCE kendi DB'sinde teyit etmeli:
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'HomeKupon' AND column_name IN ('buildKey','manualOverrides','sourcePredictionsHash');

CREATE TABLE IF NOT EXISTS "PublishRcaSnapshot" (
  "id"                    TEXT PRIMARY KEY,
  "homeKuponId"           TEXT NOT NULL UNIQUE,
  "raceDay"               DATE NOT NULL,
  "hippodrome"            TEXT NOT NULL,          -- slug (örn. "istanbul", "karma")
  "hippodromeLabel"       TEXT NOT NULL,           -- gösterim adı ("İstanbul — 1. Altılı")
  "couponGroupType"       TEXT NOT NULL,           -- "altili" | "yedili-ganyan"
  "slot"                  INTEGER NOT NULL,
  "publishedAt"           TIMESTAMPTZ NOT NULL,
  "rcaSnapshotVersion"    INTEGER NOT NULL,        -- payload şema sürümü (PUBLISH_RCA_SNAPSHOT_SCHEMA_VERSION)
  "engineVersion"         TEXT NOT NULL,
  "weightsHash"           TEXT,
  "sourcePredictionsHash" TEXT NOT NULL,
  "manualOverride"        BOOLEAN NOT NULL DEFAULT FALSE,
  "legsJson"              JSONB NOT NULL,          -- PublishLegInput[] (her leg/runner: scoreExact/modelRank/agf/marketRank/fundamentalRank/ekuriGroup/scratched)
  "allocatorJson"         JSONB NOT NULL,          -- AllocatorInput (tier/budget/unitPrice/combinationLimit/selectedK/optimizerSelections/coverage/configHash)
  "publishJson"           JSONB NOT NULL,          -- { finalPublishedSelections, diff: { manualOverride, overrideAdded, overrideRemoved, entries } }
  "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "PublishRcaSnapshot_hippodrome_raceDay_idx" ON "PublishRcaSnapshot" ("hippodrome", "raceDay");
CREATE INDEX IF NOT EXISTS "PublishRcaSnapshot_manualOverride_idx" ON "PublishRcaSnapshot" ("manualOverride");
