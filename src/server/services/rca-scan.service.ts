// RCA Günlük Otomatik Tarama — Prisma şema drift'inden İZOLE (2026-10-09 kullanıcı kararı).
// RcaScanSnapshot YALNIZ raw SQL ile yönetilir (ResearchSnapshotRun'daki AYNI desen):
// schema.prisma'ya EKLENMEZ, `prisma db push`/`migrate` bu tabloyu HİÇ görmez, 51 live-only
// tablo drift'ine karışmaz. Mevcut hiçbir tabloya/index'e DOKUNMAZ (yalnız CREATE IF NOT
// EXISTS). Yalnız $executeRaw tagged-template kullanılır (SQL tamamen sabit, interpolasyon
// yok) — $executeRawUnsafe gerekmedi.
import { db } from "@/lib/db";
import weights461 from "@/lib/methodology/weights/v546-1-weights.json";
import { getRootCauseRaporu, RCA_VERSION, KACAN_TOP_N } from "./root-cause.service";

const MODEL_VERSION = (weights461 as { version: string }).version; // "V5.46.1"

export async function ensureRcaScanTable(): Promise<void> {
  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS "RcaScanSnapshot" (
      "id"                  TEXT NOT NULL PRIMARY KEY,
      "scanDate"            TIMESTAMPTZ(3) NOT NULL,
      "pencere"             TEXT NOT NULL,
      "modelVersion"        TEXT NOT NULL,
      "rcaVersion"          TEXT NOT NULL,
      "missThreshold"       INTEGER NOT NULL,
      "missSayisi"          INTEGER NOT NULL,
      "controlSayisi"       INTEGER NOT NULL,
      "olculemeyenSayisi"   INTEGER NOT NULL,
      "candidateKodlar"     TEXT[] NOT NULL DEFAULT '{}',
      "yeniCandidateKodlar" TEXT[] NOT NULL DEFAULT '{}',
      "patternlerJson"      JSONB NOT NULL,
      "createdAt"           TIMESTAMPTZ(3) NOT NULL DEFAULT now()
    )
  `;
  await db.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "RcaScanSnapshot_scanDate_pencere_key"
      ON "RcaScanSnapshot" ("scanDate", "pencere")
  `;
  await db.$executeRaw`
    CREATE INDEX IF NOT EXISTS "RcaScanSnapshot_pencere_scanDate_idx"
      ON "RcaScanSnapshot" ("pencere", "scanDate" DESC)
  `;
}

export type RcaScanRow = {
  scanDate: Date; pencere: string; modelVersion: string; rcaVersion: string; missThreshold: number;
  missSayisi: number; controlSayisi: number; olculemeyenSayisi: number;
  candidateKodlar: string[]; yeniCandidateKodlar: string[]; patternlerJson: unknown; createdAt: Date;
};

const PENCERELER: { key: string; gun: number }[] = [{ key: "1g", gun: 1 }, { key: "7g", gun: 7 }, { key: "30g", gun: 30 }];

/** Her pencere için RCA'yı yeniden hesaplar, önceki AYNI pencere taramasıyla kıyaslayıp
 *  yeni candidate'leri bulur, tek bir UPSERT'le (aynı gün tekrar çalışırsa unique-index
 *  hatası YERİNE güncelleme) kaydeder. Prediction/Pick/model/weights'e YAZMAZ. */
export async function calistirRcaTaramasi(): Promise<{ pencere: string; candidateSayisi: number; yeniCandidateSayisi: number }[]> {
  await ensureRcaScanTable();
  const bugun = new Date(); bugun.setUTCHours(0, 0, 0, 0);
  const sonuc: { pencere: string; candidateSayisi: number; yeniCandidateSayisi: number }[] = [];

  for (const p of PENCERELER) {
    const rapor = await getRootCauseRaporu({ gun: "tum", gunSayisi: p.gun });
    const candidateKodlar = [...new Set(rapor.patternler.filter((x) => x.candidate).map((x) => x.kod))];

    const onceki = await db.$queryRaw<{ candidateKodlar: string[] }[]>`
      SELECT "candidateKodlar" FROM "RcaScanSnapshot"
      WHERE "pencere" = ${p.key} AND "scanDate" < ${bugun}
      ORDER BY "scanDate" DESC LIMIT 1
    `;
    const oncekiKodlar = new Set(onceki[0]?.candidateKodlar ?? []);
    const yeniCandidateKodlar = candidateKodlar.filter((k) => !oncekiKodlar.has(k));

    const id = `rca_${p.key}_${bugun.toISOString().slice(0, 10)}`;
    await db.$executeRaw`
      INSERT INTO "RcaScanSnapshot"
        ("id","scanDate","pencere","modelVersion","rcaVersion","missThreshold",
         "missSayisi","controlSayisi","olculemeyenSayisi","candidateKodlar","yeniCandidateKodlar","patternlerJson")
      VALUES
        (${id}, ${bugun}, ${p.key}, ${MODEL_VERSION}, ${RCA_VERSION}, ${KACAN_TOP_N},
         ${rapor.missSayisi}, ${rapor.controlSayisi}, ${rapor.olculemeyenSayisi},
         ${candidateKodlar}, ${yeniCandidateKodlar}, ${JSON.stringify(rapor.patternler)}::jsonb)
      ON CONFLICT ("scanDate","pencere") DO UPDATE SET
        "modelVersion" = EXCLUDED."modelVersion", "rcaVersion" = EXCLUDED."rcaVersion",
        "missThreshold" = EXCLUDED."missThreshold", "missSayisi" = EXCLUDED."missSayisi",
        "controlSayisi" = EXCLUDED."controlSayisi", "olculemeyenSayisi" = EXCLUDED."olculemeyenSayisi",
        "candidateKodlar" = EXCLUDED."candidateKodlar", "yeniCandidateKodlar" = EXCLUDED."yeniCandidateKodlar",
        "patternlerJson" = EXCLUDED."patternlerJson"
    `;
    sonuc.push({ pencere: p.key, candidateSayisi: candidateKodlar.length, yeniCandidateSayisi: yeniCandidateKodlar.length });
  }
  return sonuc;
}

/** /admin/root-cause üstündeki "son otomatik tarama" banner'ı için — salt okuma. */
export async function sonRcaTaramalari(): Promise<RcaScanRow[]> {
  try {
    return await db.$queryRaw<RcaScanRow[]>`
      SELECT DISTINCT ON ("pencere") * FROM "RcaScanSnapshot" ORDER BY "pencere", "scanDate" DESC
    `;
  } catch {
    return []; // tablo henüz oluşturulmadıysa (cron hiç çalışmadıysa) sessizce boş dön
  }
}
