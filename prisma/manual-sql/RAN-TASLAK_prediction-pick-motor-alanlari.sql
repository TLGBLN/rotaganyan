-- ROTAGANYAN ANALİZ MOTORU — Prediction/Pick şema önerisi — SADECE TASLAK, UYGULANMADI.
--
-- ⚠ BU DOSYA ÇALIŞTIRILMADI (ne Claude ne otomatik bir migration tarafından). Kullanıcı
-- talimatı: "Bu görevde de GERÇEK bir prisma migrate/db push ÇALIŞTIRMA — şema önerisini
-- somut bir migration taslağı olarak HAZIRLA ve raporda SUN, ama uygulama." Bu dosya o
-- taslaktır. Üretime geçerken (route yeni motoru çağırmaya başladığında) kullanıcı kendi
-- ortamında gözden geçirip `npx prisma db execute --file ...` veya karşılık gelen Prisma
-- migration ile elle uygulamalı.
--
-- GÜNCELLEME (2026-10-25, Faz 1 Aşama 1 — kullanıcının kritik bulgusu): İLK taslak
-- (ranOriginalRank/ranPublishedRank/ranSignalSnapshot) RanPredictionSnapshot'ın o ANKİ
-- DAR halini (code/raw/observed/reliability) yansıtıyordu — explainRunner'ın GERÇEK ürettiği
-- standardizedValue/learnedCoefficient/scoreContribution/missingIndicator* alanlarını
-- taşımıyordu. snapshot-integrity.ts bu oturumda GENİŞLETİLDİ (RanSignalSnapshotEntry artık
-- bu alanların HEPSİNİ taşıyor) — ranSignalSnapshot (JSONB, tek kolon) bu genişlemeyi HİÇBİR
-- ŞEMA DEĞİŞİKLİĞİ GEREKTİRMEDEN otomatik kapsıyor (JSONB serbest-şekilli, kolon başına alan
-- açmaya gerek YOK) — ama winProbability/finalScore/featureCodeOrder/preRaceDataSnapshotId
-- (RanPredictionSnapshot'a bu oturumda eklenen AYRI, yapılı alanlar) için YENİ kolonlar
-- gerekiyor, aşağıda eklendi. İKİNCİ DÜZELTME: TIMESTAMPTZ → TIMESTAMP(3) — bu projenin
-- TÜM DateTime kolonları (bkz. prisma/migrations/20260616182642_npm_run_db_seed/migration.sql,
-- publishedAt/createdAt/updatedAt) TIMESTAMP(3) kullanıyor, TIMESTAMPTZ bu projede HİÇ
-- kullanılmıyor — Prisma'nın `DateTime` → Postgres eşlemesi bu projede (timezone:false,
-- varsayılan) TIMESTAMP(3)'tür, TIMESTAMPTZ yazmak şema TUTARSIZLIĞI yaratırdı.
--
-- NEDEN YENİ, AYRI KOLONLAR (var olan rank/manualOverride/featureSnapshot'a DOKUNULMUYOR):
--  - V5.46.1 (production) hâlâ Prediction.manualOverride + Pick.rank + Pick.featureSnapshot
--    kullanıyor — bu motor onlara DOKUNMAZ, V5.46.1'in davranışı BİREBİR aynı kalır.
--  - Yeni motorun alanları `ran` önekiyle ayrı: hem isim çarpışması hem "hangi motorun
--    alanı bu?" karışıklığı İMKANSIZ hale gelir.
--  - Hepsi NULLABLE/additive — var olan satırlar etkilenmez, geriye dönük uyumlu.
--  - runnerId İÇİN yeni kolon YOK — Pick.runnerId ZATEN var (Runner'a FK, nullable) ve
--    RanPredictionSnapshot.runnerId ile AYNI anlam/tip; motor bu tahmini KAYDEDERKEN zaten
--    dolduracağı ortak alan, "ran" önekiyle ikinci bir kopya AÇMAK çift-kaynak/çift-sayım
--    riski yaratırdı (bkz. "Karma Çift Sayım Kontrolü" kalıcı kuralı).
--
-- Prediction (RACE başına TEK satır — motor sürüm kimliği + üretim zamanı + kullanılan
-- özellik sırası BURADA, bir yarışın TÜM Pick'leri aynı motor çalışmasından/aynı kod
-- sırasından geldiği için race-level'de taşınır, HER Pick'te TEKRARLANMAZ):
ALTER TABLE "Prediction" ADD COLUMN IF NOT EXISTS "ranEngineVersion" TEXT;
ALTER TABLE "Prediction" ADD COLUMN IF NOT EXISTS "ranWeightsFingerprint" TEXT;
ALTER TABLE "Prediction" ADD COLUMN IF NOT EXISTS "ranGeneratedAt" TIMESTAMP(3);
-- UNIFIED_MODEL_CODES'un bu üretim anındaki TAM sırası (string[], JSONB dizi) —
-- validateSnapshot'ın "kod kümesi/sırası güncel mi" karşılaştırmasının GİRDİSİ bu kolondan
-- okunur; motor kodu değişip yeniden deploy edilirse yeni satırlar yeni sırayı taşır, eski
-- satırlar KENDİ ürettikleri andaki sırayı KORUR (geriye dönük tahminler bozulmaz).
ALTER TABLE "Prediction" ADD COLUMN IF NOT EXISTS "ranFeatureCodeOrder" JSONB;

-- Pick (koşucu başına TEK satır):
--  - ranOriginalRank: motorun KENDİ ürettiği sıra — hiçbir elle müdahale bunu DEĞİŞTİRMEZ
--    (snapshot-integrity.ts::applyManualOverride'ın BİREBİR aynadığı kural).
--  - ranPublishedRank: yayınlanan/elle değiştirilmiş sıra — kullanıcı arayüzünde GÖSTERİLEN,
--    kupon/sıralama bunu okur. Başlangıçta ranOriginalRank'e eşit yazılır.
--  - ranWinProbability: scoreRace'in softmax çıktısı (saha içi toplam=1.0, matematiksel garanti).
--  - ranFinalScore: explainRunner'ın totalScore'u (= ranSignalSnapshot'taki TÜM satırların
--    scoreContribution+missingIndicatorContribution toplamı — Σkatkı=finalScore testiyle
--    doğrulanan İKİ BAĞIMSIZ hesap yolu, bkz. snapshot-integrity.test.ts).
--  - ranPreRaceDataSnapshotId: computePreRaceDataSnapshotId'nin çıktısı — "bu satırın ham
--    verisi hangi anlık görüntüden geldi" kimliği (weightsFingerprint'ten BAĞIMSIZ bir
--    kavram — o ağırlıkların kimliği, bu VERİNİN kimliği).
--  - ranSignalSnapshot: UNIFIED_MODEL_CODES'taki (şu an 36) HER kod için explainRunner'ın
--    ürettiği TAM satır {code, family, raw, observed, reliability, coverageState,
--    modelVersion, standardizedValue, learnedCoefficient, scoreContribution,
--    missingIndicatorCoefficient, missingIndicatorContribution} — snapshot-integrity.ts::
--    RanSignalSnapshotEntry[] birebir (bkz. toRanSignalSnapshotEntry).
ALTER TABLE "Pick" ADD COLUMN IF NOT EXISTS "ranOriginalRank" INTEGER;
ALTER TABLE "Pick" ADD COLUMN IF NOT EXISTS "ranPublishedRank" INTEGER;
ALTER TABLE "Pick" ADD COLUMN IF NOT EXISTS "ranWinProbability" DOUBLE PRECISION;
ALTER TABLE "Pick" ADD COLUMN IF NOT EXISTS "ranFinalScore" DOUBLE PRECISION;
ALTER TABLE "Pick" ADD COLUMN IF NOT EXISTS "ranPreRaceDataSnapshotId" TEXT;
ALTER TABLE "Pick" ADD COLUMN IF NOT EXISTS "ranSignalSnapshot" JSONB;

-- Denetim/sorgu kolaylığı: "bu yarışın ran alanları dolu mu" ve "elle değiştirilmiş mi"
-- (ranOriginalRank <> ranPublishedRank) sorguları için indeks.
--
-- NOT (Prisma şema DSL sınırlaması — statik doğrulama bulgusu): bu KISMİ indeks (WHERE
-- koşullu) Prisma'nın schema.prisma `@@index([...])` sözdiziminde TEMSİL EDİLEMEZ (Prisma 7.8
-- itibarıyla partial index desteği YOK) — bu yüzden `prisma migrate dev` ile schema.prisma'dan
-- OTOMATİK üretilemez, elle bir migration dosyasına (ör. `prisma migrate dev --create-only`
-- ile boş bir migration oluşturup bu SQL'i İÇİNE yapıştırarak) eklenmesi gerekir. schema.prisma
-- diff'inde (aşağıda) bu yüzden kasıtlı olarak YALNIZ alan tanımları var, @@index satırı YOK
-- — aksi halde `prisma migrate dev` schema.prisma ile DB arasında "drift" (şema sürüklenmesi)
-- algılayıp bu indeksi SİLMEYE çalışabilirdi.
CREATE INDEX IF NOT EXISTS "Pick_ranOriginalRank_ranPublishedRank_idx"
  ON "Pick" ("ranOriginalRank", "ranPublishedRank")
  WHERE "ranOriginalRank" IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- GERİ DÖNÜŞ (ROLLBACK) SQL'İ (kullanıcı talimatı madde 5c — AÇIKÇA yazıldı):
-- Tüm eklenen kolonlar NULLABLE/additive olduğu için (hiçbir NOT NULL/DEFAULT/FK YOK,
-- hiçbir var olan kolona DOKUNULMADI) bu rollback GÜVENLİDİR — var olan hiçbir veriyi/
-- davranışı etkilemez, yalnız bu taslağın eklediklerini geri alır. Sıra ÖNEMLİ: indeks
-- kolonlardan ÖNCE silinmeli (bir kolonu kullanan indeks varken o kolonu silmek Postgres'te
-- hataya yol açmaz ama DROP INDEX'i önce yapmak daha temiz/açık bir sıra).
--
-- DROP INDEX IF EXISTS "Pick_ranOriginalRank_ranPublishedRank_idx";
--
-- ALTER TABLE "Pick" DROP COLUMN IF EXISTS "ranSignalSnapshot";
-- ALTER TABLE "Pick" DROP COLUMN IF EXISTS "ranPreRaceDataSnapshotId";
-- ALTER TABLE "Pick" DROP COLUMN IF EXISTS "ranFinalScore";
-- ALTER TABLE "Pick" DROP COLUMN IF EXISTS "ranWinProbability";
-- ALTER TABLE "Pick" DROP COLUMN IF EXISTS "ranPublishedRank";
-- ALTER TABLE "Pick" DROP COLUMN IF EXISTS "ranOriginalRank";
--
-- ALTER TABLE "Prediction" DROP COLUMN IF EXISTS "ranFeatureCodeOrder";
-- ALTER TABLE "Prediction" DROP COLUMN IF EXISTS "ranGeneratedAt";
-- ALTER TABLE "Prediction" DROP COLUMN IF EXISTS "ranWeightsFingerprint";
-- ALTER TABLE "Prediction" DROP COLUMN IF EXISTS "ranEngineVersion";
-- ───────────────────────────────────────────────────────────────────────────

-- ───────────────────────────────────────────────────────────────────────────
-- Karşılık gelen prisma/schema.prisma DIFF (yalnız referans — bu dosya schema.prisma'yı
-- DEĞİŞTİRMEZ, kullanıcı kendi `prisma migrate dev` akışına uygun şekilde elle eklemeli.
-- Kısmi indeks YUKARIDAKİ NOT nedeniyle buraya DAHİL EDİLMEDİ — elle migration dosyasına
-- eklenmeli):
--
-- model Prediction {
--   ...
--   manualOverride Boolean    @default(false)   // V5.46.1 — DOKUNULMADI
--   ...
--   ranEngineVersion       String?
--   ranWeightsFingerprint  String?
--   ranGeneratedAt         DateTime?
--   ranFeatureCodeOrder    Json?
--   ...
-- }
--
-- model Pick {
--   ...
--   rank           Int                          // V5.46.1 — DOKUNULMADI, hâlâ onun sırası
--   runnerId       String?                       // ZATEN VAR — RanPredictionSnapshot.runnerId
--                                                 // BUNA yazılır, yeni kolon AÇILMAZ.
--   ...
--   ranOriginalRank          Int?
--   ranPublishedRank         Int?
--   ranWinProbability        Float?
--   ranFinalScore            Float?
--   ranPreRaceDataSnapshotId String?
--   ranSignalSnapshot        Json?
--   ...
-- }
-- ───────────────────────────────────────────────────────────────────────────

-- ───────────────────────────────────────────────────────────────────────────
-- STATİK DOĞRULAMA KANITI (kullanıcı talimatı madde 5a — gerçek, ayrı bir Postgres test
-- instance'ı bu ortamda YOK; aşağıdaki kontroller GERÇEKTEN yapıldı, uydurulmadı):
--  1) Her ALTER TABLE ... ADD COLUMN IF NOT EXISTS → idempotent (iki kez çalıştırılsa bile
--     hata vermez), hiçbir NOT NULL/DEFAULT/CHECK/FK kısıtı YOK → mevcut satırlar için
--     otomatik NULL, hiçbir yazma/okuma davranışı BOZULMAZ.
--  2) Kolon adları ("ran" önekli) mevcut şemada (prisma/schema.prisma, grep ile doğrulandı)
--     ÇAKIŞMIYOR — Prediction/Pick modellerinde "ran"-önekli HİÇBİR alan YOK.
--  3) DOUBLE PRECISION/TEXT/TIMESTAMP(3)/JSONB/INTEGER tipleri, BU PROJENİN kendi geçmiş
--     migration'larında (prisma/migrations/20260616182642_npm_run_db_seed/migration.sql
--     ve sonrakiler) Float?/String?/DateTime?/Json?/Int? için KULLANDIĞI GERÇEK Postgres
--     karşılıklarıyla (grep ile doğrulandı) BİREBİR eşleşiyor — TIMESTAMPTZ gibi bu projede
--     HİÇ görülmeyen bir tip KULLANILMIYOR (önceki taslağın düzeltilen hatası).
--  4) GERÇEK schema.prisma ÜZERİNDE `npx prisma validate` + `npx prisma format` çalıştırıldı
--     (dokunmadan) — geçerli kaldı. AYRICA (daha güçlü kanıt): yukarıdaki DIFF'in KENDİSİ
--     geçici bir kopyaya (prisma/schema.ran-draft-test.prisma, bu oturumda OLUŞTURULUP
--     DOĞRULANDIKTAN SONRA SİLİNDİ — gerçek schema.prisma'ya HİÇ YAZILMADI) spliced edildi
--     ve `npx prisma validate --schema=...` + `npx prisma format --schema=...` bu kopyaya
--     karşı GERÇEKTEN çalıştırıldı → "The schema ... is valid" (gerçek CLI çıktısı). Yani
--     yalnız "eklemeden önce şema sağlıklıydı" değil, "önerilen alanların KENDİSİ de geçerli
--     Prisma DSL'i" doğrulandı — tek eksik, GERÇEK bir Postgres'e karşı `prisma migrate dev`
--     çalıştırıp migration dosyası ÜRETMEK (kullanıcı talimatı bunu AÇIKÇA yasaklıyor).
-- ───────────────────────────────────────────────────────────────────────────
