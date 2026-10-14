// CorrectionCandidate Registry — CLOSED-LOOP mimarisinin karar kaydı. İzole raw-SQL tablo
// (RcaScanSnapshot/TempCalShadowObservation ile AYNI desen — schema.prisma'ya eklenmez).
//
// 2026-10-09 kullanıcı kararı (KESİN): "Production'ı etkileyen hiçbir Correction otomatik
// aktive edilmesin. Tüm gate'ler PASS olunca status=READY_FOR_APPROVAL olsun. Admin onayıyla
// ACTIVE'e geçsin. Rollback da insan onayı gerektirsin." Bu servis bu kuralı YAPISAL olarak
// uygular: `onayla()`/`rollbackOnayla()` dışında HİÇBİR fonksiyon status'u ACTIVE/ROLLED_BACK
// yapamaz — otomatik koddan (cron, gate-runner) asla çağrılmaz, yalnız admin action'dan.
//
// FAZ 2E (entegrasyon, 2026-10-14 kullanıcı kararı) — tablo kurulumu ARTIK sayfa-okuma
// yolunda DEĞİL: `ensureCorrectionCandidateTable()` önceden `rowlariGetir()`'in İÇİNDE
// her çağrıda koşulsuz çalışıyordu (idempotent ama yine de her GET'te bir DDL). Artık
// yalnız açık/kontrollü bir kurulum adımından (bkz. prisma/manual-sql/2026-10-14_
// correction_candidate_setup.sql, veya elle `ensureCorrectionCandidateTable()` çağrısı)
// çağrılmalı. Sayfa SADECE okur; tablo yoksa `tumAdaylarGuvenli()` bunu AÇIKÇA
// `{ok:false, reason:"TABLE_NOT_SET_UP"}` olarak işaretler (sessizce [] DEĞİL) — UI bunu
// ayrı bir banner ile gösterir. BAŞKA bir DB hatası (bağlantı/izin vb.) ASLA yutulmaz,
// olduğu gibi fırlatılır.
import { db } from "@/lib/db";

/** Postgres'in "relation does not exist" hatasını (42P01) Prisma'nın raw-query hata
 *  sarmalayıcısından güvenilir şekilde ayırt eder — yalnız BU hata sessizce ele alınır,
 *  başka hiçbir DB hatası bu fonksiyonun ardından gizlenmez. */
function isMissingTableError(e: unknown): boolean {
  const err = e as { code?: string; meta?: { code?: string }; message?: string } | null;
  if (!err) return false;
  if (err.meta?.code === "42P01") return true;
  return /relation .* does not exist/i.test(err.message ?? "");
}

export type CorrectionStatus =
  | "DETECTED" | "NEEDS_TEST_DESIGN" | "OOS_TESTING" | "OOS_FAIL" | "OOS_PASS"
  | "SHADOW_TESTING" | "SHADOW_FAIL" | "READY_FOR_APPROVAL"
  | "ACTIVE" | "ROLLBACK_CANDIDATE" | "ROLLED_BACK";

export type CorrectionType = "DATA_FIX" | "FEATURE_CHALLENGER" | "CALIBRATION_CHALLENGER" | "ALLOCATOR_CHALLENGER";

// 2026-10-09 Faz-1 kuralı: RCA bir candidate ÖNEREBİLİR ama yeni OOS test kodu otomatik
// ÜRETEMEZ. Yalnız burada listelenen tipler için ÖNCEDEN DOĞRULANMIŞ bir walk-forward
// evaluator var (bugüne kadar elle yazılmış, aynı desen tekrar kullanılabilir) — bunlar
// dışındaki her type otomatik DETECTED/OOS_TESTING'e giremez, NEEDS_TEST_DESIGN'da bekler.
export const DOGRULANMIS_EVALUATOR_TIPLERI: readonly CorrectionType[] = ["ALLOCATOR_CHALLENGER", "CALIBRATION_CHALLENGER"];

export interface CorrectionCandidateRow {
  id: string; createdAt: Date; type: CorrectionType; status: CorrectionStatus;
  rootCauseCategory: string; scope: string; evidence: unknown;
  oldRule: unknown; newRule: unknown;
  oosMetrics: unknown | null; shadowMetrics: unknown | null;
  approvedBy: string | null; activatedAt: Date | null;
  rollbackReason: string | null; rolledBackAt: Date | null;
  updatedAt: Date;
}

export async function ensureCorrectionCandidateTable(): Promise<void> {
  await db.$executeRaw`
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
    )
  `;
  await db.$executeRaw`CREATE INDEX IF NOT EXISTS "CorrectionCandidate_status_idx" ON "CorrectionCandidate" ("status")`;
}

// DİKKAT: artık ensureCorrectionCandidateTable() ÇAĞIRMIYOR — bkz. dosya başı notu.
async function rowlariGetir(where: string, params: unknown[] = []): Promise<CorrectionCandidateRow[]> {
  return db.$queryRawUnsafe<CorrectionCandidateRow[]>(`SELECT * FROM "CorrectionCandidate" ${where} ORDER BY "createdAt" DESC`, ...params);
}

export type CorrectionCandidateReadResult =
  | { ok: true; rows: CorrectionCandidateRow[] }
  | { ok: false; reason: "TABLE_NOT_SET_UP" };

/** Kontrollü okuma — tablo kurulmadıysa bunu AÇIKÇA bildirir, başka bir DB hatasını
 *  ASLA yutmaz (yeniden fırlatır). UI bu ayrımı görüp uygun mesajı gösterebilsin diye. */
export async function tumAdaylarGuvenli(): Promise<CorrectionCandidateReadResult> {
  try {
    return { ok: true, rows: await rowlariGetir("") };
  } catch (e) {
    if (isMissingTableError(e)) return { ok: false, reason: "TABLE_NOT_SET_UP" };
    throw e;
  }
}

/** Geriye-uyumluluk sarmalayıcısı — tablo yoksa [] döner (eski davranış korunur,
 *  ayrım isteyen çağıran tumAdaylarGuvenli() kullanmalı). */
export async function tumAdaylar(): Promise<CorrectionCandidateRow[]> {
  const r = await tumAdaylarGuvenli();
  return r.ok ? r.rows : [];
}
export async function adayGetir(id: string): Promise<CorrectionCandidateRow | null> { const r = await rowlariGetir(`WHERE "id" = $1`, [id]); return r[0] ?? null; }

/** RCA'nın ÖNERDİĞİ aday — yeni OOS test kodu OTOMATİK üretilmez. `type` için önceden
 *  doğrulanmış bir evaluator varsa status=DETECTED (OOS_TESTING'e girmeye hazır), yoksa
 *  status=NEEDS_TEST_DESIGN (elle test tasarımı bekler, otomatik gate'e GİREMEZ). */
export async function olusturAday(params: { type: CorrectionType; rootCauseCategory: string; scope: string; evidence: unknown; oldRule: unknown; newRule: unknown }): Promise<string> {
  await ensureCorrectionCandidateTable();
  const id = `cc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const baslangicDurumu: CorrectionStatus = DOGRULANMIS_EVALUATOR_TIPLERI.includes(params.type) ? "DETECTED" : "NEEDS_TEST_DESIGN";
  await db.$executeRaw`
    INSERT INTO "CorrectionCandidate" ("id","type","status","rootCauseCategory","scope","evidence","oldRule","newRule")
    VALUES (${id}, ${params.type}, ${baslangicDurumu}, ${params.rootCauseCategory}, ${params.scope}, ${JSON.stringify(params.evidence)}::jsonb, ${JSON.stringify(params.oldRule)}::jsonb, ${JSON.stringify(params.newRule)}::jsonb)
  `;
  return id;
}

/** OOS gate sonucunu kaydeder. PASS=true → status OOS_PASS, false → OOS_FAIL. ACTIVE'e GEÇMEZ. */
export async function kaydetOosSonucu(id: string, metrics: unknown, pass: boolean): Promise<void> {
  await db.$executeRaw`UPDATE "CorrectionCandidate" SET "oosMetrics" = ${JSON.stringify(metrics)}::jsonb, "status" = ${pass ? "OOS_PASS" : "OOS_FAIL"}, "updatedAt" = now() WHERE "id" = ${id}`;
}
/** Shadow gate sonucunu kaydeder. PASS=true → status READY_FOR_APPROVAL (insan onayı bekler), false → SHADOW_FAIL. ACTIVE'e GEÇMEZ. */
export async function kaydetShadowSonucu(id: string, metrics: unknown, pass: boolean): Promise<void> {
  await db.$executeRaw`UPDATE "CorrectionCandidate" SET "shadowMetrics" = ${JSON.stringify(metrics)}::jsonb, "status" = ${pass ? "READY_FOR_APPROVAL" : "SHADOW_FAIL"}, "updatedAt" = now() WHERE "id" = ${id}`;
}
export async function statusGuncelle(id: string, status: Extract<CorrectionStatus, "OOS_TESTING" | "SHADOW_TESTING">): Promise<void> {
  await db.$executeRaw`UPDATE "CorrectionCandidate" SET "status" = ${status}, "updatedAt" = now() WHERE "id" = ${id}`;
}

// ── YALNIZ İNSAN AKSİYONUNDAN ÇAĞRILIR — hiçbir cron/gate-runner bunları ÇAĞIRMAZ ──────────
/** Admin onayı — status READY_FOR_APPROVAL olmayan bir kaydı aktive ETMEZ (güvenlik). */
export async function onayla(id: string, onaylayan: string): Promise<{ ok: boolean; hata?: string }> {
  const aday = await adayGetir(id);
  if (!aday) return { ok: false, hata: "Aday bulunamadı" };
  if (aday.status !== "READY_FOR_APPROVAL") return { ok: false, hata: `Yalnız READY_FOR_APPROVAL aktive edilebilir (şu an: ${aday.status})` };
  await db.$executeRaw`UPDATE "CorrectionCandidate" SET "status" = 'ACTIVE', "approvedBy" = ${onaylayan}, "activatedAt" = now(), "updatedAt" = now() WHERE "id" = ${id}`;
  return { ok: true };
}
export async function rollbackOner(id: string, sebep: string): Promise<void> {
  await db.$executeRaw`UPDATE "CorrectionCandidate" SET "status" = 'ROLLBACK_CANDIDATE', "rollbackReason" = ${sebep}, "updatedAt" = now() WHERE "id" = ${id}`;
}
export async function rollbackOnayla(id: string, onaylayan: string): Promise<{ ok: boolean; hata?: string }> {
  const aday = await adayGetir(id);
  if (!aday) return { ok: false, hata: "Aday bulunamadı" };
  if (aday.status !== "ROLLBACK_CANDIDATE") return { ok: false, hata: `Yalnız ROLLBACK_CANDIDATE geri alınabilir (şu an: ${aday.status})` };
  await db.$executeRaw`UPDATE "CorrectionCandidate" SET "status" = 'ROLLED_BACK', "approvedBy" = ${onaylayan}, "rolledBackAt" = now(), "updatedAt" = now() WHERE "id" = ${id}`;
  return { ok: true };
}
