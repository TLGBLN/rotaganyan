// ROTAGANYAN ANALİZ MOTORU — eğitim verisi toplama (SALT-OKUNUR, production DB'ye yazmaz).
//
// buildUnifiedFeatureVectorsForRace (src/lib/rotaganyan-analiz-motoru/feature-calculators/
// unified-feature-vector.ts) HER yarış için D(15)+V1(21)=36 kanonik sinyali point-in-time
// hesaplar — bu script SADECE o fonksiyonu çoklu yarışta çağırıp JSON'a yazar. Eğitim
// (arac-ran-egit-ve-degerlendir.mts) ve bu toplama AYNI buildUnifiedFeatureVectorsForRace'i
// kullanır — iki ayrı hesaplama kodu YOK (parite).
//
// GUNCEL_MOTOR_BASLANGIC sonrası (2026-08-15+) sonuçlu yarışlar, kronolojik sırayla.
import fs from "node:fs";
import { createHash } from "node:crypto";
import { db } from "./src/lib/db";
import { GUNCEL_MOTOR_BASLANGIC } from "./src/server/services/admin.service";
import { accuraceKosulari } from "./src/lib/accurace/loader";
import { buildUnifiedFeatureVectorsForRace } from "./src/lib/rotaganyan-analiz-motoru/feature-calculators/unified-feature-vector";
import type { RunnerFeatureVector } from "./src/lib/motor-v1/engine/feature-vector";

const CHECKPOINT_PATH = process.env.RAN_CHECKPOINT ?? "C:/tmp/ran-egitim-verisi-checkpoint.json";
const OUT_PATH = process.env.RAN_OUT ?? "C:/tmp/ran-egitim-verisi.json";
const LIMIT = Number(process.env.RAN_LIMIT ?? "0") || undefined;
const CONCURRENCY = Number(process.env.RAN_CONCURRENCY ?? "10");
const MAX_RETRY = 3;
// Explicit PIT rebuild window. Defaults preserve the existing collector behavior.
const DATE_FROM = process.env.RAN_DATE_FROM ?? null;
const DATE_TO = process.env.RAN_DATE_TO ?? null;
const DATASET_TAG = process.env.RAN_DATASET_TAG ?? null;
const COHORT_PATH = process.env.RAN_COHORT_FILE ?? null;
function parseDay(day: string | null, name: string): Date | null {
  if (!day) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(name + " must be YYYY-MM-DD");
  const date = new Date(day + "T00:00:00.000Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== day) {
    throw new Error(name + " is not a valid calendar day");
  }
  return date;
}

export type RanEgitimSatiri = {
  raceId: string;
  tarih: string; // YYYY-MM-DD
  winnerNo: number | null;
  vectors: RunnerFeatureVector[];
};

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T | null> {
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      return await fn();
    } catch (e) {
      console.log(`  [RETRY ${attempt}/${MAX_RETRY}] ${label}: ${(e as Error).message?.slice(0, 160)}`);
      if (attempt === MAX_RETRY) return null;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  return null;
}

async function main() {
  const t0 = Date.now();
  console.log(`GUNCEL_MOTOR_BASLANGIC: ${GUNCEL_MOTOR_BASLANGIC.toISOString()}`);
  console.log("Accurace arşivini TEK SEFERDE çekiyorum...");
  const preloadedRuns = await accuraceKosulari();
  console.log(`Accurace arşivi hazır: ${preloadedRuns.length} kayıt, ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const from = parseDay(DATE_FROM, "RAN_DATE_FROM");
  const to = parseDay(DATE_TO, "RAN_DATE_TO");
  if (from && to && from > to) throw new Error("RAN_DATE_FROM after RAN_DATE_TO");
  const min = from && from > GUNCEL_MOTOR_BASLANGIC ? from : GUNCEL_MOTOR_BASLANGIC;
  const range = { gte: min, ...(to ? { lte: to } : {}) };
  if (to && to < min) throw new Error("RAN_DATE_TO predates GUNCEL_MOTOR_BASLANGIC");
  if (DATASET_TAG && (!DATE_FROM || !DATE_TO || !process.env.RAN_OUT || !process.env.RAN_CHECKPOINT)) {
    throw new Error("RAN_DATASET_TAG requires explicit RAN_DATE_FROM/TO, RAN_OUT and RAN_CHECKPOINT");
  }
  const stampPath = CHECKPOINT_PATH + ".source.json";
  // Read only immutable cohort race IDs/dates. NEVER reuse its old feature vectors.
  const originalCohortBytes = COHORT_PATH ? fs.readFileSync(COHORT_PATH,"utf8") : null;
  const originalCohort = originalCohortBytes ? JSON.parse(originalCohortBytes) as
    {raceId:string;tarih:string}[] : null;
  if (originalCohort && (!Array.isArray(originalCohort) ||
      originalCohort.length<20 ||
      originalCohort.some(r=>!r || typeof r.raceId!=="string" || typeof r.tarih!=="string") ||
      new Set(originalCohort.map(r=>r.raceId)).size!==originalCohort.length)) {
    throw new Error("RAN_PIT_COHORT_INVALID: expected unique race IDs and dates in array");
  }
  const cohortSha=originalCohortBytes ? createHash("sha256").update(originalCohortBytes).digest("hex") : null;
  const stamp = DATASET_TAG ? JSON.stringify({tag:DATASET_TAG,from:DATE_FROM,to:DATE_TO,cohortSha,engine:"RAN_PIT_SIRE_SPEED_20261025"}) : null;
  if (stamp) {
    if (fs.existsSync(CHECKPOINT_PATH) && !fs.existsSync(stampPath)) {
      throw new Error("RAN_PIT_UNSTAMPED_CHECKPOINT: will not replay old vectors from " + CHECKPOINT_PATH);
    }
    if (fs.existsSync(stampPath) && fs.readFileSync(stampPath,"utf8") !== stamp) {
      throw new Error("RAN_PIT_CHECKPOINT_SOURCE_MISMATCH: remove nothing; choose new paths");
    }
    if (!fs.existsSync(stampPath)) fs.writeFileSync(stampPath,stamp,{flag:"wx"});
    if (fs.existsSync(OUT_PATH) && !fs.existsSync(CHECKPOINT_PATH)) {
      throw new Error("RAN_PIT_OUTPUT_EXISTS_WITHOUT_CHECKPOINT: refusing overwrite");
    }
  }
  const races = await db.race.findMany({
    where: {
      raceDay: { date: range },
      result: { isNot: null },
      runners: { some: { scratched: false } },
    },
    select: { id: true, raceDay: { select: { date: true } }, runners: { where: { scratched: false }, select: { id: true } } },
  });
  let eligible = races.filter((r) => r.runners.length >= 3);
  eligible.sort((a, b) => a.raceDay.date.getTime() - b.raceDay.date.getTime());
  if (originalCohort) {
    const expected=new Map(originalCohort.map(r=>[r.raceId,r.tarih]));
    eligible=eligible.filter(r=>expected.has(r.id));
    if (eligible.length!==expected.size ||
        eligible.some(r=>r.raceDay.date.toISOString().slice(0,10)!==expected.get(r.id))) {
      throw new Error("RAN_PIT_COHORT_MISMATCH: original train+dev 300 raceIds/dates must match; refuse silently different sample");
    }
  }
  if (LIMIT && originalCohort) throw new Error("RAN_PIT_COHORT_DISALLOWS_LIMIT: requires all original races");
  if (LIMIT) eligible = eligible.slice(0, LIMIT);
  console.log(`Toplam ${eligible.length} uygun yarış (saha>=3, LIMIT=${LIMIT ?? "yok"}, tarih=${min.toISOString().slice(0,10)}..${DATE_TO ?? "acik"}).`);

  let checkpoint: Record<string, RanEgitimSatiri> = {};
  if (fs.existsSync(CHECKPOINT_PATH)) {
    try {
      checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT_PATH, "utf8"));
      console.log(`Checkpoint: ${Object.keys(checkpoint).length} yarış zaten var.`);
    } catch {}
  }
  const validIds = new Set(eligible.map((r) => r.id));
  checkpoint = Object.fromEntries(Object.entries(checkpoint).filter(([id]) => validIds.has(id)));

  const remaining = eligible.filter((r) => !checkpoint[r.id]);
  console.log(`Kalan: ${remaining.length} yarış.`);

  const failed: string[] = [];
  let done = eligible.length - remaining.length;
  const tBatch0 = Date.now();

  for (let i = 0; i < remaining.length; i += CONCURRENCY) {
    const batch = remaining.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (race) => {
        const r = await withRetry(() => buildUnifiedFeatureVectorsForRace(race.id, preloadedRuns), race.id);
        if (!r || r.vectors.length === 0) return null;
        const dbRace = await db.race.findUnique({
          where: { id: race.id },
          select: { result: { select: { winnerNos: true } }, runners: { where: { scratched: false }, select: { id: true, no: true } } },
        });
        const winnerNo = dbRace?.result?.winnerNos?.[0] ?? null;
        const satir: RanEgitimSatiri = {
          raceId: race.id,
          tarih: race.raceDay.date.toISOString().slice(0, 10),
          winnerNo,
          vectors: r.vectors,
        };
        return satir;
      })
    );
    for (let j = 0; j < batch.length; j++) {
      const r = results[j];
      if (r && r.winnerNo != null) checkpoint[batch[j].id] = r;
      else failed.push(batch[j].id);
    }
    done += batch.length;
    fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(checkpoint));
    const hiz = (done - (eligible.length - remaining.length)) / ((Date.now() - tBatch0) / 1000);
    console.log(`${done}/${eligible.length} (${failed.length} başarısız) — ${hiz.toFixed(2)} yarış/sn [checkpoint yazıldı]`);
  }

  console.log(`\nSONUÇ: ${Object.keys(checkpoint).length}/${eligible.length} başarılı, ${failed.length} başarısız.`);
  if (failed.length > 0) console.log(`Başarısız (ilk 20): ${JSON.stringify(failed.slice(0, 20))}`);
  const out = Object.values(checkpoint).sort((a, b) => (a.tarih < b.tarih ? -1 : a.tarih > b.tarih ? 1 : 0));
  if (originalCohort && out.length !== originalCohort.length) {
    throw new Error("RAN_PIT_INCOMPLETE_COHORT: " + out.length + "/" + originalCohort.length +
      " computed; checkpoint retained for safe resume, output/model NOT written");
  }
  fs.writeFileSync(OUT_PATH, JSON.stringify(out));
  console.log(`YAZILDI: ${OUT_PATH} (${out.length} yarış), toplam süre ${((Date.now() - t0) / 60000).toFixed(1)} dk`);
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("HATA:", e);
    process.exit(1);
  });
