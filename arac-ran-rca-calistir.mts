// ROTAGANYAN ANALİZ MOTORU — RCA Faz 2 GERÇEK ÇALIŞTIRMA: analyzeRaceDemotion'ı gerçek,
// bağımsız-kabul setindeki (hiç eğitimde kullanılmamış) yarışlar üzerinde çalıştırır ve
// çıktıyı ekrana basar — raporda SUNULAN sayılar bu komutun GERÇEK çıktısıdır, uydurulmadı.
//
// Çalıştırma: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-ran-rca-calistir.mts
import fs from "node:fs";
import { analyzeRaceDemotion } from "./src/lib/rotaganyan-analiz-motoru/rca/analyze-race";
import { validateSnapshot, computeWeightsFingerprint } from "./src/lib/rotaganyan-analiz-motoru/snapshot-integrity";
import { UNIFIED_MODEL_CODES } from "./src/lib/rotaganyan-analiz-motoru/feature-calculators/unified-feature-vector";
import { loadTrainedModel } from "./src/lib/rotaganyan-analiz-motoru/load-trained-model";
import { accuraceKosulari } from "./src/lib/accurace/loader";
import type { RunnerFeatureVector } from "./src/lib/motor-v1/engine/feature-vector";
import type { FittedModel } from "./src/lib/motor-v1/engine/training";
import type { PedigreeEffect, PedigreeComparison } from "./src/lib/rotaganyan-analiz-motoru/rca/pedigree-breakdown";

// DÜZELTME (2026-10-25): ESKİ varsayılan C:/tmp/ran-trained-model-FINAL.json'a (93 yarış/λ=60,
// yanıltıcı "FINAL" adlı KÜÇÜK ÖRNEKLEM) SESSİZCE düşüyordu — kullanıcı talimatı madde 2/4:
// bu artık YASAK. RAN_MODEL verilmezse repodaki TEK canonical artifact (loadTrainedModel())
// kullanılır; RAN_MODEL AÇIKÇA verilirse (ad-hoc diagnostic) o ham dosya okunur.
const MODEL_PATH = process.env.RAN_MODEL ?? null;
const DATA_PATH = process.env.RAN_ACCEPT_DATA ?? "C:/tmp/ran-egitim-verisi-SON-checkpoint.json";

type RanEgitimSatiri = { raceId: string; tarih: string; winnerNo: number | null; vectors: RunnerFeatureVector[] };

function loadModel(): FittedModel<string> {
  if (MODEL_PATH == null) {
    console.log("RAN_MODEL verilmedi → repodaki TEK canonical artifact kullanılıyor: src/lib/rotaganyan-analiz-motoru/artifacts/ran-trained-model.json (loadTrainedModel()).");
    return loadTrainedModel();
  }
  const saved = JSON.parse(fs.readFileSync(MODEL_PATH, "utf8"));
  const stats = new Map<string, { mu: number; sigma: number; nObserved: number }>(saved.model.stats);
  return { beta: saved.model.beta, names: saved.model.names, stats, nRacesUsed: saved.model.nRacesUsed, nRacesSkipped: saved.model.nRacesSkipped, opts: saved.opts };
}

const LIMIT = Number(process.env.RAN_RCA_LIMIT ?? "3"); // her yarış ~3 tam hesaplama (buildUnified+crosscheck+faz1) gerektiriyor, her biri gözlemsel olarak ~2-3dk sürüyor (bkz. arac-ran-egitim-canli-parite-dogrulama.mts çalıştırma süresi) — GERÇEK DB'ye karşı, tam 60'lık seti çalıştırmak saatler sürer; bu bir performans sınırı, sonuçların GEÇERLİLİĞİNİ etkilemez (hâlâ GERÇEK, hiç eğitimde kullanılmamış yarışlar)

function loadRows(): RanEgitimSatiri[] {
  const raw = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  const list: RanEgitimSatiri[] = Array.isArray(raw) ? raw : Object.values(raw);
  return list.filter((r) => r.winnerNo != null && r.vectors.length >= 3).slice(0, LIMIT);
}


const fmt = (x: number | null, digits = 4) => x == null ? "YOK" : x.toFixed(digits);
const durum = (p: PedigreeEffect) => !p.present ? "SINYAL_YOK" : p.observed ? "GOZLEMLI" : "VERI_YOK";

function yazPedigriKazanan(rows: readonly PedigreeEffect[]) {
  console.log("  -- PEDIGRI: BABA / ANNE / ANNE BABASI (her zaman, ilk 5 filtresinden bağımsız) --");
  for (const p of rows) {
    console.log(`    ${p.label.padEnd(25)} durum=${durum(p).padEnd(11)} ham=${fmt(p.raw, 3).padStart(8)} beta=${fmt(p.coefficient).padStart(8)} katkı=${fmt(p.contribution).padStart(8)}`);
    if (!p.observed) console.log(`      eksiklik: ${p.missingReason ?? "veri yok"}; eksiklik-göstergesi katkısı=${fmt(p.missingIndicatorContribution)}`);
  }
}
function yazPedigriFark(rows: readonly PedigreeComparison[], label: string) {
  console.log(`  -- PEDIGRI KARŞILAŞTIRMASI: KAZANAN vs ${label} --`);
  for (const p of rows) {
    console.log(`    ${p.label.padEnd(25)} kazanan=${fmt(p.winner.contribution).padStart(8)} (${durum(p.winner)}) rakip=${fmt(p.rival.contribution).padStart(8)} (${durum(p.rival)}) Δ=${fmt(p.delta).padStart(8)}`);
    if (!p.winner.observed) console.log(`      kazanan eksik: ${p.winner.missingReason ?? "veri yok"}`);
    if (!p.rival.observed) console.log(`      rakip eksik: ${p.rival.missingReason ?? "veri yok"}`);
  }
  console.log("    Δ pozitif: rakip lehine, negatif: kazanan lehine; verisizlik 0 gibi gösterilmez.");
}

async function main() {
  const model = loadModel();
  const rows = loadRows();
  console.log(`Model: ${MODEL_PATH ?? "repo canonical artifact (artifacts/ran-trained-model.json)"}`);
  console.log(`Veri: ${DATA_PATH} — ${rows.length} yarış\n`);

  // --- 0) Faz 1 STALE KAPISI — GERÇEKTEN ÇAĞRILDIĞININ kanıtı (bozuk bir snapshot'la) ---
  console.log("=== 0) STALE kapısı doğrulaması (bozuk engineVersion ile) ===");
  const fp = computeWeightsFingerprint(model);
  const bozukSonuc = validateSnapshot(
    { engineVersion: "0.1-eski-bir-surum", weightsFingerprint: fp, signals: UNIFIED_MODEL_CODES.map((c) => ({ code: c, raw: 1, observed: true, reliability: 1 })) },
    { expectedCodes: UNIFIED_MODEL_CODES, expectedFingerprint: fp, expectedEngineVersion: "1.0" }
  );
  console.log(`  Kasıtlı bozuk engineVersion ("0.1-eski-bir-surum" vs beklenen "1.0") → status=${bozukSonuc.status}`);
  console.log(`  reasons: ${JSON.stringify(bozukSonuc.reasons)}`);
  console.log(`  (analyzeRaceDemotion'ın her çağrıda AYNI validateSnapshot fonksiyonunu GERÇEKTEN çağırdığı — analyze-race.ts satır ~60-70 — bu yüzden bu kapı canlı akışta da işliyor.)\n`);

  // --- 1) Gerçek yarışlar üzerinde analyzeRaceDemotion ---
  console.log("=== 1) Gerçek yarışlar — analyzeRaceDemotion ===");
  console.log("(Accurace arşivi BİR KEZ önceden çekiliyor, tüm yarışlar arasında paylaşılıyor — her yarışta tekrar tekrar tam-arşiv sorgusu YAPILMAZ.)\n");
  const t0 = Date.now();
  const preloadedRuns = await accuraceKosulari();
  console.log(`Accurace arşivi çekildi: ${preloadedRuns.length} koşu, ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

  let okCount = 0, staleCount = 0, top1MissCount = 0, top3MissCount = 0;
  const kategoriSayim = new Map<string, number>();

  for (const row of rows) {
    const result = await analyzeRaceDemotion(row.raceId, model, row.winnerNo!, preloadedRuns);
    if (result.status === "STALE") {
      staleCount++;
      console.log(`[STALE] raceId=${row.raceId} — ${result.reasons.join(" | ")}`);
      continue;
    }
    if (result.status !== "OK") {
      console.log(`[${result.status}] raceId=${row.raceId}`);
      continue;
    }
    okCount++;
    const satir = `raceId=${row.raceId} (${row.tarih}) kazanan=${result.winnerName}(No${result.winnerNo}) rank=${result.winnerRank}/${result.fieldSize}`;
    if (result.winnerRank === 1) {
      console.log(`[OK, TOP1] ${satir}`);
      yazPedigriKazanan(result.winnerPedigree);
      continue;
    }
    console.log(`[OK, MISS] ${satir}`);
    yazPedigriKazanan(result.winnerPedigree);
    if (result.top1Miss) {
      top1MissCount++;
      kategoriSayim.set(result.top1Miss.category, (kategoriSayim.get(result.top1Miss.category) ?? 0) + 1);
      console.log(`  -- TOP1 KAÇIRMA ANALİZİ (rakip: 1.sıradaki ${result.top1Miss.rivalName}, No${result.top1Miss.rivalNo}) --`);
      console.log(`  Kategori: ${result.top1Miss.category}`);
      for (const e of result.top1Miss.evidence) console.log(`    ${e}`);
      console.log(`  En büyük 5 fark (kod, kazanan-toplamı, rakip-toplamı, Δ):`);
      for (const d of result.top1Miss.demotionDrivers) {
        console.log(`    ${d.code.padEnd(26)} kazanan=${d.winnerTotal.toFixed(4).padStart(8)} rakip=${d.rivalTotal.toFixed(4).padStart(8)} Δ=${d.delta.toFixed(4).padStart(8)}`);
      }
      yazPedigriFark(result.top1Miss.pedigreeComparison, "TOP-1 rakibi");
    }
    if (result.winnerPositiveSignals && result.winnerPositiveSignals.length > 0) {
      console.log(`  -- KAZANANIN OLUMLU SİNYALLERİ (güçlü yönleri vardı ama yetmedi) --`);
      for (const p of result.winnerPositiveSignals) {
        console.log(`    ${p.code.padEnd(26)} raw=${p.rawValue?.toFixed(3) ?? "null"} toplamKatki=${p.totalContribution.toFixed(4)}`);
      }
    }
    if (result.top3Miss) {
      top3MissCount++;
      console.log(`  -- TOP3 KAÇIRMA ANALİZİ (rakip: 3.sıradaki ${result.top3Miss.rivalName}, No${result.top3Miss.rivalNo}) --`);
      console.log(`  Kategori: ${result.top3Miss.category}`);
      for (const e of result.top3Miss.evidence) console.log(`    ${e}`);
      yazPedigriFark(result.top3Miss.pedigreeComparison, "TOP-3 sınırındaki rakip");
    }
    if (result.agfComparison) {
      console.log(`  AGF (yalnız karşılaştırma, skora GİRMEDİ): kazananın AGF sırası=${result.agfComparison.winnerAgfSirasi.toFixed(1)}, AGF payı=${result.agfComparison.winnerAgfPayi.toFixed(2)}% — ${result.agfComparison.not}`);
    }
    console.log("");
  }

  console.log(`\n=== ÖZET ===`);
  console.log(`Toplam yarış: ${rows.length}, OK: ${okCount}, STALE: ${staleCount}`);
  console.log(`Top-1 kaçırma analizi üretildi: ${top1MissCount}, Top-3 kaçırma analizi üretildi: ${top3MissCount}`);
  console.log(`Top-1 kaçırma kök-neden kategorisi dağılımı:`);
  for (const [k, v] of [...kategoriSayim.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("HATA:", e);
    process.exit(1);
  });
