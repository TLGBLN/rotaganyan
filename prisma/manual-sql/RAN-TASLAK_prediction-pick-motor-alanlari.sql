-- ROTAGANYAN ANALİZ MOTORU — Prediction/Pick şema önerisi — SADECE TASLAK, UYGULANMADI.
--
-- ⚠ BU DOSYA ÇALIŞTIRILMADI (ne Claude ne otomatik bir migration tarafından). Kullanıcı
-- talimatı: "Bu görevde de GERÇEK bir prisma migrate/db push ÇALIŞTIRMA — şema önerisini
-- somut bir migration taslağı olarak HAZIRLA ve raporda SUN, ama uygulama." Bu dosya o
-- taslaktır. Üretime geçerken (route yeni motoru çağırmaya başladığında) kullanıcı kendi
-- ortamında gözden geçirip `npx prisma db execute --file ...` veya karşılık gelen Prisma
-- migration ile elle uygulamalı.
--
-- NEDEN YENİ, AYRI KOLONLAR (var olan rank/manualOverride/featureSnapshot'a DOKUNULMUYOR):
--  - V5.46.1 (production) hâlâ Prediction.manualOverride + Pick.rank + Pick.featureSnapshot
--    kullanıyor — bu motor onlara DOKUNMAZ, V5.46.1'in davranışı BİREBİR aynı kalır.
--  - Yeni motorun alanları `ran` önekiyle ayrı: hem isim çarpışması hem "hangi motorun
--    alanı bu?" karışıklığı İMKANSIZ hale gelir.
--  - Hepsi NULLABLE/additive — var olan satırlar etkilenmez, geriye dönük uyumlu.
--
-- Prediction (RACE başına TEK satır — motor sürüm kimliği + üretim zamanı BURADA, bir
-- yarışın TÜM Pick'leri aynı motor çalışmasından geldiği için race-level'de taşınır):
ALTER TABLE "Prediction" ADD COLUMN IF NOT EXISTS "ranEngineVersion" TEXT;
ALTER TABLE "Prediction" ADD COLUMN IF NOT EXISTS "ranWeightsFingerprint" TEXT;
ALTER TABLE "Prediction" ADD COLUMN IF NOT EXISTS "ranGeneratedAt" TIMESTAMPTZ;

-- Pick (koşucu başına TEK satır):
--  - ranOriginalRank: motorun KENDİ ürettiği sıra — hiçbir elle müdahale bunu DEĞİŞTİRMEZ
--    (snapshot-integrity.ts::applyManualOverride'ın BİREBİR aynadığı kural).
--  - ranPublishedRank: yayınlanan/elle değiştirilmiş sıra — kullanıcı arayüzünde GÖSTERİLEN,
--    kupon/sıralama bunu okur. Başlangıçta ranOriginalRank'e eşit yazılır.
--  - ranSignalSnapshot: UNIFIED_MODEL_CODES'taki (şu an 36) HER kod için {code, raw,
--    observed, reliability} — snapshot-integrity.ts::RanSignalSnapshotEntry[] birebir.
ALTER TABLE "Pick" ADD COLUMN IF NOT EXISTS "ranOriginalRank" INTEGER;
ALTER TABLE "Pick" ADD COLUMN IF NOT EXISTS "ranPublishedRank" INTEGER;
ALTER TABLE "Pick" ADD COLUMN IF NOT EXISTS "ranSignalSnapshot" JSONB;

-- Denetim/sorgu kolaylığı: "bu yarışın ran alanları dolu mu" ve "elle değiştirilmiş mi"
-- (ranOriginalRank <> ranPublishedRank) sorguları için indeks.
CREATE INDEX IF NOT EXISTS "Pick_ranOriginalRank_ranPublishedRank_idx"
  ON "Pick" ("ranOriginalRank", "ranPublishedRank")
  WHERE "ranOriginalRank" IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- Karşılık gelen prisma/schema.prisma DIFF (yalnız referans — bu dosya schema.prisma'yı
-- DEĞİŞTİRMEZ, kullanıcı kendi `prisma migrate dev` akışına uygun şekilde elle eklemeli):
--
-- model Prediction {
--   ...
--   manualOverride Boolean    @default(false)   // V5.46.1 — DOKUNULMADI
--   ...
--   ranEngineVersion       String?
--   ranWeightsFingerprint  String?
--   ranGeneratedAt         DateTime?
--   ...
-- }
--
-- model Pick {
--   ...
--   rank           Int                          // V5.46.1 — DOKUNULMADI, hâlâ onun sırası
--   ...
--   ranOriginalRank    Int?
--   ranPublishedRank   Int?
--   ranSignalSnapshot  Json?
--   ...
--
--   @@index([ranOriginalRank, ranPublishedRank])
-- }
-- ───────────────────────────────────────────────────────────────────────────
