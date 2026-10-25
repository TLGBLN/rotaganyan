// ROTAGANYAN ANALIZ MOTORU — BAGIMSIZ KABUL TESTI icin EN SON (en guncel) sonuclu yarislari
// toplar (kronolojik AZALAN, bugune en yakindan geriye). Ana collector (arac-ran-egitim-veri-
// topla.mts) GUNCEL_MOTOR_BASLANGIC'tan ILERI (artan) sirayla topluyor — bu script ONUN TAM
// TERSI yonde calisir, ki bu TEK model egitiminde/lambda secisinde HIC KULLANILMAMIS, gercekten
// "daha once hicbir gelistirme kararini etkilememis" bir kronolojik dilim elde edilsin
// (kullanici talimati madde 5). AYNI buildUnifiedFeatureVectorsForRace fonksiyonu kullanilir —
// hesaplama kodu ikinci bir kopya DEGIL.
import fs from "node:fs";
import { db } from "./src/lib/db";
import { accuraceKosulari } from "./src/lib/accurace/loader";
import { buildUnifiedFeatureVectorsForRace } from "./src/lib/rotaganyan-analiz-motoru/feature-calculators/unified-feature-vector";
import type { RunnerFeatureVector } from "./src/lib/motor-v1/engine/feature-vector";

const CHECKPOINT_PATH = process.env.RAN_CHECKPOINT ?? "C:/tmp/ran-egitim-verisi-SON-checkpoint.json";
const OUT_PATH = process.env.RAN_OUT ?? "C:/tmp/ran-egitim-verisi-SON.json";
const LIMIT = Number(process.env.RAN_LIMIT ?? "60");
const CONCURRENCY = Number(process.env.RAN_CONCURRENCY ?? "6");
const MIN_DATE = process.env.RAN_MIN_DATE ? new Date(process.env.RAN_MIN_DATE) : null;
const MAX_RETRY = 3;

type RanEgitimSatiri = { raceId: string; tarih: string; winnerNo: number | null; vectors: RunnerFeatureVector[] };

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T | null> {
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try { return await fn(); }
    catch (e) {
      console.log(`  [RETRY ${attempt}/${MAX_RETRY}] ${label}: ${(e as Error).message?.slice(0, 160)}`);
      if (attempt === MAX_RETRY) return null;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  return null;
}

async function main() {
  const t0 = Date.now();
  console.log("Accurace arşivini TEK SEFERDE çekiyorum...");
  const preloadedRuns = await accuraceKosulari();
  console.log(`Accurace arşivi hazır: ${preloadedRuns.length} kayıt, ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const races = await db.race.findMany({
    where: {
      result: { isNot: null },
      runners: { some: { scratched: false } },
      ...(MIN_DATE ? { raceDay: { date: { gte: MIN_DATE } } } : {}),
    },
    orderBy: { raceDay: { date: "desc" } },
    select: { id: true, raceDay: { select: { date: true } }, runners: { where: { scratched: false }, select: { id: true } } },
    take: LIMIT * 3,
  });
  const eligible = races.filter((r) => r.runners.length >= 3).slice(0, LIMIT);
  console.log(`Toplam ${eligible.length} uygun yarış (EN GÜNCELDEN geriye, saha>=3, LIMIT=${LIMIT}), tarih aralığı: ${eligible[eligible.length - 1]?.raceDay.date.toISOString().slice(0, 10)}..${eligible[0]?.raceDay.date.toISOString().slice(0, 10)}`);

  let checkpoint: Record<string, RanEgitimSatiri> = {};
  if (fs.existsSync(CHECKPOINT_PATH)) {
    try { checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT_PATH, "utf8")); console.log(`Checkpoint: ${Object.keys(checkpoint).length} yarış zaten var.`); } catch {}
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
    const results = await Promise.all(batch.map(async (race) => {
      const r = await withRetry(() => buildUnifiedFeatureVectorsForRace(race.id, preloadedRuns), race.id);
      if (!r || r.vectors.length === 0) return null;
      const dbRace = await db.race.findUnique({ where: { id: race.id }, select: { result: { select: { winnerNos: true } } } });
      const winnerNo = dbRace?.result?.winnerNos?.[0] ?? null;
      const satir: RanEgitimSatiri = { raceId: race.id, tarih: race.raceDay.date.toISOString().slice(0, 10), winnerNo, vectors: r.vectors };
      return satir;
    }));
    for (let j = 0; j < batch.length; j++) {
      const r = results[j];
      if (r && r.winnerNo != null) checkpoint[batch[j].id] = r; else failed.push(batch[j].id);
    }
    done += batch.length;
    fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(checkpoint));
    const hiz = (done - (eligible.length - remaining.length)) / ((Date.now() - tBatch0) / 1000);
    console.log(`${done}/${eligible.length} (${failed.length} başarısız) — ${hiz.toFixed(2)} yarış/sn [checkpoint yazıldı]`);
  }

  console.log(`\nSONUÇ: ${Object.keys(checkpoint).length}/${eligible.length} başarılı.`);
  fs.writeFileSync(OUT_PATH, JSON.stringify(Object.values(checkpoint)));
  console.log(`YAZILDI: ${OUT_PATH} (${Object.keys(checkpoint).length} yarış), süre ${((Date.now() - t0) / 60000).toFixed(1)} dk`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
