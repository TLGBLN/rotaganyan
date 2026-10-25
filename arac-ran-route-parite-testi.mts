// ROTAGANYAN ANALİZ MOTORU — ROUTE/DOĞRUDAN ÇAĞRI PARİTE TESTİ (kullanıcı talimatı madde 8).
//
// route.ts'in iş mantığını taşıyan runRanEngineForRace(raceId) — /api/admin/test-ran-engine
// POST handler'ının auth kontrolünden SONRA çağırdığı AYNI fonksiyon — GERÇEK bir yarış için
// çalıştırılır. Aynı yarış için buildUnifiedFeatureVectorsForRace + loadTrainedModel +
// scoreRace + explainRunner AYRI/doğrudan çağrılarak ("bağımsız kabul testi script'inin
// kullandığı AYNI paylaşılan fonksiyonlar") ikinci bir hesap üretilir. İki hesap BİREBİR
// (score/probability/rank/explainRunner satırları) eşleşmezse script FAIL ile çıkar.
//
// NOT: Bu script hiçbir DB YAZMA yapmaz (raceId'yi okuma amaçlı seçer, skorlama salt-okuma).
import { db } from "./src/lib/db";
import { buildUnifiedFeatureVectorsForRace } from "./src/lib/rotaganyan-analiz-motoru/feature-calculators/unified-feature-vector";
import { loadTrainedModel } from "./src/lib/rotaganyan-analiz-motoru/load-trained-model";
import { scoreRace, explainRunner } from "./src/lib/motor-v1/engine/training";
import { runRanEngineForRace } from "./src/app/api/admin/test-ran-engine/route";
import { validateSnapshot } from "./src/lib/rotaganyan-analiz-motoru/snapshot-integrity";
import { UNIFIED_MODEL_CODES } from "./src/lib/rotaganyan-analiz-motoru/feature-calculators/unified-feature-vector";

async function pickRaceId(): Promise<string> {
  const explicit = process.env.RAN_PARITY_RACE_ID;
  if (explicit) return explicit;
  const race = await db.race.findFirst({
    where: { runners: { some: { scratched: false } } },
    orderBy: { raceDay: { date: "desc" } },
    select: { id: true, raceNo: true, raceDay: { select: { date: true, hippodrome: { select: { name: true } } } } },
  });
  if (!race) throw new Error("Hiç yarış bulunamadı — RAN_PARITY_RACE_ID ile elle bir raceId verin.");
  console.log(`Seçilen yarış: ${race.raceDay.hippodrome.name} — ${race.raceNo}.Koşu (${race.raceDay.date.toISOString().slice(0, 10)}), raceId=${race.id}`);
  return race.id;
}

async function main() {
  const raceId = await pickRaceId();

  // 1) ROUTE'UN KULLANDIĞI YOL: runRanEngineForRace (handlePost'un auth sonrası çağırdığı AYNI fonksiyon)
  const routeResult = await runRanEngineForRace(raceId);

  // 2) BAĞIMSIZ/DOĞRUDAN YOL: arac-ran-bagimsiz-kabul-testi.mts'in kullandığı AYNI paylaşılan
  //    fonksiyonlarla, route'tan TAMAMEN ayrı bir çağrı zinciriyle yeniden hesapla.
  const { vectors: directVectors } = await buildUnifiedFeatureVectorsForRace(raceId);
  const model = loadTrainedModel();
  const directScored = scoreRace(directVectors, model);
  const directRanked = [...directScored].sort((a, b) => b.probability - a.probability);

  let failCount = 0;
  const fail = (msg: string) => {
    failCount++;
    console.error(`FAIL: ${msg}`);
  };

  if (routeResult.atlar.length !== directRanked.length) {
    fail(`at sayısı uyuşmuyor: route=${routeResult.atlar.length} direct=${directRanked.length}`);
  }

  for (let i = 0; i < directRanked.length; i++) {
    const d = directRanked[i];
    const r = routeResult.atlar[i];
    if (!r) { fail(`route'ta ${i}. sıra eksik (beklenen no=${d.no})`); continue; }
    if (r.no !== d.no) fail(`sıra ${i + 1}: no uyuşmuyor route=${r.no} direct=${d.no}`);
    if (r.score !== d.score) fail(`no=${d.no}: score uyuşmuyor route=${r.score} direct=${d.score}`);
    if (r.probability !== d.probability) fail(`no=${d.no}: probability uyuşmuyor route=${r.probability} direct=${d.probability}`);
    if (r.originalRank !== i + 1) fail(`no=${d.no}: originalRank=${r.originalRank} beklenen=${i + 1}`);
    if (r.publishedRank !== r.originalRank) fail(`no=${d.no}: publishedRank(${r.publishedRank}) !== originalRank(${r.originalRank}) — madde 7 ihlali`);

    const vec = directVectors.find((v) => v.no === d.no)!;
    const explained = explainRunner(vec, model);
    if (r.signals.length !== explained.rows.length) {
      fail(`no=${d.no}: signals.length uyuşmuyor route=${r.signals.length} direct=${explained.rows.length}`);
    } else {
      explained.rows.forEach((row, idx) => {
        const s = r.signals[idx];
        if (s.code !== row.code) fail(`no=${d.no} sinyal[${idx}]: code uyuşmuyor route=${s.code} direct=${row.code}`);
        if (s.raw !== row.rawValue) fail(`no=${d.no} sinyal[${row.code}]: raw uyuşmuyor route=${s.raw} direct=${row.rawValue}`);
        if (s.observed !== row.observed) fail(`no=${d.no} sinyal[${row.code}]: observed uyuşmuyor route=${s.observed} direct=${row.observed}`);
      });
    }
  }

  // İDEMPOTENCY: aynı raceId'yi İKİNCİ kez çalıştırmak (route yolu) AYNI score/rank'i üretmeli.
  const routeResult2 = await runRanEngineForRace(raceId);
  for (let i = 0; i < routeResult.atlar.length; i++) {
    const a = routeResult.atlar[i], b = routeResult2.atlar[i];
    if (a.no !== b.no || a.score !== b.score || a.probability !== b.probability || a.originalRank !== b.originalRank) {
      fail(`idempotency ihlali: sıra ${i + 1} ilk-çağrı no=${a.no}/score=${a.score} ikinci-çağrı no=${b.no}/score=${b.score}`);
    }
  }

  // MADDE 6: route'un ürettiği her pick, snapshot-integrity.ts'in KENDİ validateSnapshot
  // denetiminden OK geçmeli — "yanıt şekli RanPredictionSnapshot ile tutarlı" iddiasının
  // tip-seviyesinde değil, GERÇEK fonksiyon çağrısıyla kanıtı.
  for (const pick of routeResult.atlar) {
    const v = validateSnapshot(pick, {
      expectedCodes: UNIFIED_MODEL_CODES,
      expectedFingerprint: routeResult.weightsFingerprint,
      expectedEngineVersion: routeResult.engineVersion,
    });
    if (v.status !== "OK") fail(`no=${pick.no}: validateSnapshot STALE döndü — ${v.reasons.join("; ")}`);
    if (pick.originalRank !== pick.publishedRank) fail(`no=${pick.no}: originalRank !== publishedRank (ilk üretimde eşit olmalı)`);
  }

  console.log(`\nEngineVersion: ${routeResult.engineVersion}`);
  console.log(`weightsFingerprint: ${routeResult.weightsFingerprint}`);
  console.log(`Saha büyüklüğü: ${routeResult.atlar.length}`);
  console.log(`Sıra | No | Skor | Olasılık`);
  for (const a of routeResult.atlar) {
    console.log(`  ${a.originalRank}. | No ${a.no} (${a.name}) | score=${a.score.toFixed(6)} | p=${(a.probability * 100).toFixed(2)}%`);
  }

  if (failCount > 0) {
    console.error(`\n❌ PARİTE TESTİ BAŞARISIZ — ${failCount} uyuşmazlık.`);
    process.exit(1);
  }
  console.log(`\n✅ PARİTE TESTİ BAŞARILI — route (runRanEngineForRace) ile doğrudan scoreRace/explainRunner çağrısı BİREBİR aynı sonucu üretti (score/probability/rank/signals + idempotency).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("HATA:", e);
    process.exit(1);
  });
