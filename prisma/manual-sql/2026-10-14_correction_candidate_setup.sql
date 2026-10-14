-- CorrectionCandidate kurulumu — FAZ 2E (entegrasyon) 2026-10-14 kullanıcı kararı.
--
-- BU TABLO prisma/schema.prisma'DA KASITLI OLARAK YOK (RcaScanSnapshot/
-- ResearchSnapshotRun/PublishRcaSnapshot ile AYNI, önceden kabul edilmiş izole
-- raw-SQL deseni — bkz. src/server/services/rca-scan.service.ts, src/lib/research/
-- snapshot-runtime.ts). schema.prisma'ya EKLENMEZ, `prisma migrate`/`db push` bu
-- tabloyu HİÇ görmez.
--
-- NEDEN AYRI DOSYA: `src/server/services/correction-candidate.service.ts`'teki
-- `ensureCorrectionCandidateTable()` ÖNCEDEN her `tumAdaylar()` (sayfa okuma)
-- çağrısında KOŞULSUZ çalışıyordu — idempotent (IF NOT EXISTS) olsa da her admin
-- sayfa yüklemesinde bir DDL çalıştırmak doğru mimari değildi (2026-10-14 kullanıcı
-- kararı). Artık kurulum YALNIZ bu dosyadan (veya elle `ensureCorrectionCandidateTable()`
-- çağrısından) yapılır — sayfa SADECE okur, tablo yoksa "TABLE_NOT_SET_UP" olarak
-- AÇIKÇA bildirir (bkz. `tumAdaylarGuvenli()`), sessizce boş liste GÖSTERMEZ.
--
-- UYGULAMA (Claude BU SQL'İ KENDİSİ ÇALIŞTIRMADI — sandbox production DB yazma izni
-- vermiyor; kullanıcı kendi ortamında — örn. Supabase SQL Editor veya
-- `npx prisma db execute --file prisma/manual-sql/2026-10-14_correction_candidate_setup.sql`
-- ile elle çalıştırmalı). Idempotent: IF NOT EXISTS kullanılıyor, güvenle tekrar
-- çalıştırılabilir. NOT: bu tablo production DB'de BU OTURUMDAN ÖNCE zaten mevcut
-- bulundu (diag-missing-table-error.mts ile doğrulandı, "NO ERROR" döndü) — bu dosya
-- yalnız kalıcı/tekrarlanabilir kurulum kaydı olarak tutuluyor, yeni bir ortam
-- (staging/test DB) için gerekebilir.

CREATE TABLE IF NOT EXISTS "CorrectionCandidate" (
  "id"                TEXT NOT NULL PRIMARY KEY,
  "createdAt"         TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "type"              TEXT NOT NULL,
  "status"            TEXT NOT NULL,
  "rootCauseCategory" TEXT NOT NULL,
  "scope"             TEXT NOT NULL,
  "evidence"          JSONB NOT NULL,
  "oldRule"           JSONB NOT NULL,
  "newRule"           JSONB NOT NULL,
  "oosMetrics"        JSONB,
  "shadowMetrics"     JSONB,
  "approvedBy"        TEXT,
  "activatedAt"       TIMESTAMPTZ(3),
  "rollbackReason"    TEXT,
  "rolledBackAt"      TIMESTAMPTZ(3)
);

CREATE INDEX IF NOT EXISTS "CorrectionCandidate_status_idx" ON "CorrectionCandidate" ("status");
