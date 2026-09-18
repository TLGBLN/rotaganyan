// KALICI ARAÇ — 2026-09-17, V5.46/canlı ağırlıklara DOKUNMAZ, salt Champion/Challenger testi.
// Amaç: "Saf Model'in AGF-dışı bloğu güçlü sinyal taşıyor, AGF bloğu bazı gerçek değer
// adaylarını aşağı çekiyor" bulgusunun ("üstte olup aşağı çekilen ama kazanan" 39 vaka)
// doğru sonraki testi — kullanıcı kararı: AGF katkısını TAMAMEN silmek (λ=0) veya olduğu
// gibi bırakmak (λ=1) yerine, TEK bir λ parametresiyle AGF bloğunun ağırlığını profillemek:
//   S_i(λ) = S_nonmarket,i + λ·S_market,i + S_B-katmani,i
//   S_market,i = katkı(agfSirasi) + katkı(agfPayi) + katkı(agfPayi²)
// λ=1 → tam üretim (V5.46). λ=0 → Saf Model (AGF'siz). Ara değerler AGF'yi SİLMEDEN
// ağırlığını ölçekler. λ̂, TRAIN'de LogLoss'u minimize eden GRID noktası olarak bulunur,
// sonra dokunulmamış kronolojik TEST'te λ=1 (production) vs λ=λ̂ (challenger) paired
// bootstrap ile karşılaştırılır — bkz. proje hafızası feedback_champion_challenger_logloss_birincil
// (ΔLL = LL_challenger - LL_production, challenger kazanırsa NEGATİF).
//
// λ değişkeni sürekli bir katsayı DEĞİL, sabit bir GRID taraması — tek serbestlik derecesi
// olduğu için (S_market zaten üç sabit katsayıyla hesaplanmış TEK bir sayı/at) gradyan
// inişine gerek yok, kaba grid + TEST'te paired bootstrap yeterli ve daha şeffaf.
//
// Çalıştırma:
//   node --env-file=.env node_modules/tsx/dist/cli.mjs arac-agf-market-scale-test.mts
import { readFileSync } from "fs";
import {
  agirlikSetleriIcinKategori,
  harmanliSkorla,
  bKatmaniUygula,
  toFeatureVector,
  AGF_KATKI_INDEKSLERI,
  type Faz1RunnerV5,
} from "./src/lib/methodology/v5-engine";

const DATA_PATH = "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\model-veri-yg4.json";
const COVERAGE_START_DATE = "2026-07-01";
const SEED = 5462026;
const LAMBDA_GRID = [0, 0.25, 0.5, 0.75, 1.0, 1.25];

type Row = {
  raceId: string; runnerId: string; no: number; win: 0 | 1; kategori: string;
  agfSirasi: number; idmJokey: 0 | 1; jokeyOrani: number; antrenorOrani: number; agfPayi: number;
  h2hNetSkor: number; hizDerecesi: number; zeminToleransi: number; sonIdmanSprint: 0 | 1;
  takiEklendiMi: 0 | 1; takiCikarildiMi: 0 | 1; yarisGidisatiSkoru: number;
  sireOrani: number; zeminMesafeDeneyim: number;
  pistUzmani: 0 | 1; ajiGalibiyetVarMi: 0 | 1; agfFark: number; sinifDususu: 0 | 1;
  hpPuani: number; surface: string;
  yakinsama2Plus?: 0 | 1;
  [k: string]: unknown;
};

// arac-yeni-sinyal-challenger-test.mts ile AYNI (yakınsama sinyali ham veride yok, backfill
// edilmedi bu dosyada — burada da AYNI 5-kural yaklaşıklamasıyla türetiliyor).
function yakinsama2PlusEkle(runners: Row[]) {
  const sireSirali = [...runners].sort((a, b) => (b.sireOrani ?? 0) - (a.sireOrani ?? 0));
  const sireRankOf = new Map(sireSirali.map((r, i) => [r, i + 1]));
  for (const r of runners) {
    const pistUzmaniPoz = (r.pistUzmani ?? 0) === 1;
    const sirePoz = (sireRankOf.get(r) ?? 999) <= 2;
    const ajiPoz = (r.ajiGalibiyetVarMi ?? 0) === 1;
    const agfTrendPoz = (r.agfFark ?? 0) >= 1.0;
    const sinifDususuPoz = (r.sinifDususu ?? 0) === 1;
    const sayi = [pistUzmaniPoz, sirePoz, ajiPoz, agfTrendPoz, sinifDususuPoz].filter(Boolean).length;
    r.yakinsama2Plus = sayi >= 2 ? 1 : 0;
  }
}

/** v5-engine.ts'in GERÇEK zincirini birebir çağırıp (1) tam üretim skorunu (λ=1) VE
 *  (2) S_market'ı (yalnız AGF_KATKI_INDEKSLERI'ndeki 3 terimin toplamı) ayrı döner —
 *  S_nonmarket = skorlar - S_market, S(λ) = skorlar - (1-λ)·S_market formülüyle her λ için
 *  yeniden kurulabilir (harmanliSkorla/bKatmaniUygula'yı λ başına TEKRAR ÇAĞIRMAYA gerek yok
 *  — bu saf bir doğrusal ölçekleme, ayrı bir hesap gerektirmiyor). */
function hesaplaSVeMarket(runners: Row[], kategori: string): { skorlar: number[]; sMarket: number[] } {
  const setler = agirlikSetleriIcinKategori(kategori);
  const harmanlar = runners.map((r) => harmanliSkorla(toFeatureVector(r as unknown as Faz1RunnerV5), setler));
  const skorlarHam = harmanlar.map((h) => h.skor);
  const sMarket = harmanlar.map((h) => AGF_KATKI_INDEKSLERI.reduce((toplam, idx) => toplam + h.katkilar[idx], 0));
  const runnersDoldurulmus = runners.map((r) => ({ ...r, zeminMesafeDeneyimSeviyesi: r.zeminMesafeDeneyim !== 0 ? "tam" : "yok" }));
  const sahteClassType = kategori === "1a" || kategori === "1b" ? "MAIDEN" : kategori === "2" ? "Handikap 1" : "ŞARTLI 3";
  const { skorlar } = bKatmaniUygula(skorlarHam, runnersDoldurulmus as unknown as Faz1RunnerV5[], sahteClassType);
  return { skorlar, sMarket };
}

function skorLambda(skorlar: number[], sMarket: number[], lambda: number): number[] {
  return skorlar.map((s, i) => s - (1 - lambda) * sMarket[i]);
}

function softmax(scores: number[]): number[] {
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

function groupByRace(rows: Row[]): { raceId: string; kategori: string; runners: Row[] }[] {
  const byRace = new Map<string, Row[]>();
  for (const r of rows) {
    const arr = byRace.get(r.raceId) ?? [];
    arr.push(r);
    byRace.set(r.raceId, arr);
  }
  return [...byRace.entries()].map(([raceId, runners]) => ({ raceId, kategori: runners[0].kategori, runners }));
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function bootstrapResample<T>(arr: T[], rng: () => number): T[] {
  const n = arr.length;
  const out = new Array<T>(n);
  for (let i = 0; i < n; i++) out[i] = arr[Math.floor(rng() * n)];
  return out;
}
function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)));
  return sorted[idx];
}

type Grup = { skorlar: number[]; sMarket: number[]; winnerIdx: number };

function logLossAtLambda(gruplar: Grup[], lambda: number): number {
  let sum = 0;
  for (const g of gruplar) {
    const probs = softmax(skorLambda(g.skorlar, g.sMarket, lambda));
    sum += -Math.log(Math.max(probs[g.winnerIdx], 1e-12));
  }
  return sum / gruplar.length;
}

async function main() {
  const { db } = await import("./src/lib/db");
  const rawAll: Row[] = JSON.parse(readFileSync(DATA_PATH, "utf-8"));
  const tumRaceIdler = [...new Set(rawAll.map((r) => r.raceId))];
  const raceDates = await db.race.findMany({
    where: { id: { in: tumRaceIdler } },
    select: { id: true, raceDay: { select: { date: true } } },
  });
  const tarihByRaceId = new Map(raceDates.map((r) => [r.id, r.raceDay.date]));
  const kapsamaBaslangic = new Date(COVERAGE_START_DATE + "T00:00:00.000Z");
  const raw = rawAll.filter((r) => {
    const d = tarihByRaceId.get(r.raceId);
    return d && d >= kapsamaBaslangic;
  });
  await db.$disconnect();

  const raceGruplariHam = groupByRace(raw).filter((g) => g.runners.length >= 2);
  for (const g of raceGruplariHam) yakinsama2PlusEkle(g.runners);

  const dusukSart = raceGruplariHam.filter((g) => g.runners[0].kategori === "1a" || g.runners[0].kategori === "1b");
  const diger = raceGruplariHam.filter((g) => !(g.runners[0].kategori === "1a" || g.runners[0].kategori === "1b"));
  console.log(`Toplam: ${raceGruplariHam.length} koşu — Düşük-şart/maiden: ${dusukSart.length}, Diğer: ${diger.length}\n`);

  function test(etiket: string, gruplarHam: typeof raceGruplariHam) {
    console.log(`\n########## ${etiket} (${gruplarHam.length} koşu) ##########`);
    const splitIdx = Math.floor(gruplarHam.length * 0.75);
    const trainRaw = gruplarHam.slice(0, splitIdx);
    const testRaw = gruplarHam.slice(splitIdx);
    console.log(`Eğitim: ${trainRaw.length} koşu, Test: ${testRaw.length} koşu`);

    function hazirla(gruplarHam2: typeof raceGruplariHam): Grup[] {
      return gruplarHam2
        .map((g) => {
          const { skorlar, sMarket } = hesaplaSVeMarket(g.runners, g.kategori);
          const winnerIdx = g.runners.findIndex((r) => r.win === 1);
          return { skorlar, sMarket, winnerIdx };
        })
        .filter((g) => g.winnerIdx >= 0);
    }
    const trainGroups = hazirla(trainRaw);
    const testGroups = hazirla(testRaw);

    console.log(`\n  ── TRAIN grid taraması (LogLoss, düşük=iyi) ──`);
    let enIyiLambda = 1;
    let enIyiLL = Infinity;
    for (const lambda of LAMBDA_GRID) {
      const ll = logLossAtLambda(trainGroups, lambda);
      const isaret = lambda === 1 ? " ← mevcut üretim (λ=1)" : lambda === 0 ? " ← Saf Model (λ=0)" : "";
      console.log(`    λ=${lambda.toFixed(2)}: TRAIN LogLoss=${ll.toFixed(4)}${isaret}`);
      if (ll < enIyiLL) { enIyiLL = ll; enIyiLambda = lambda; }
    }
    console.log(`  λ̂ (TRAIN'de en düşük LogLoss) = ${enIyiLambda}`);

    const llProdTest = logLossAtLambda(testGroups, 1);
    const llChallengerTest = logLossAtLambda(testGroups, enIyiLambda);
    const deltaLL = llChallengerTest - llProdTest;
    console.log(`\n  ── TEST (dokunulmamış OOS) — TRAIN'in seçtiği λ̂ ──`);
    console.log(`  TEST LogLoss: production(λ=1)=${llProdTest.toFixed(4)}  challenger(λ=${enIyiLambda})=${llChallengerTest.toFixed(4)}  ΔLL=${deltaLL.toFixed(4)} ${deltaLL < 0 ? "(challenger DAHA İYİ)" : deltaLL > 0 ? "(challenger DAHA KÖTÜ)" : "(fark yok)"}`);

    const B = Number(process.env.BOOTSTRAP_B ?? 300);

    // 2026-09-17 kullanıcı talebi (metodolojik düzeltme): λ̂=1 TRAIN'de optimal çıkması,
    // "OOS'ta da kesin optimal" anlamına GELMEZ (katsayılar zaten AYNI eğitim likelihood'ı
    // üzerinde fit edildi — λ̂=1 kısmen beklenen bir sonuç). Bu yüzden burada SEÇİM
    // yapmıyoruz — yalnız 0.75/1.00/1.25'in OOS'taki davranışına salt GÖZLEM amaçlı
    // bakıyoruz ("sensitivity curve"). OOS'ta 0.75 belirgin iyi çıksa bile bu ANINDA bir
    // production değişikliği gerekçesi SAYILMAZ (o zaman OOS'a bakarak hipotez üretmiş
    // oluruz) — yeni forward holdout gerekir.
    console.log(`\n  ── OOS SENSITIVITY CURVE (yalnız gözlem, SEÇİM YAPILMIYOR) ──`);
    const gozlemLambdalari = [0.75, 1.0, 1.25];
    const gozlemLL = gozlemLambdalari.map((l) => ({ l, ll: logLossAtLambda(testGroups, l) }));
    for (const { l, ll } of gozlemLL) {
      console.log(`    λ=${l.toFixed(2)}: TEST LogLoss=${ll.toFixed(4)}${l === 1 ? " ← production" : ""}`);
    }
    const rng3 = mulberry32(SEED + 2);
    for (const l of [0.75, 1.25]) {
      const boot: number[] = [];
      for (let b = 0; b < B; b++) {
        const resample = bootstrapResample(testGroups, rng3);
        boot.push(logLossAtLambda(resample, l) - logLossAtLambda(resample, 1));
      }
      const sorted = [...boot].sort((a, b) => a - b);
      const lo = percentile(sorted, 0.025), hi = percentile(sorted, 0.975);
      const pNeg = boot.filter((v) => v < 0).length / boot.length;
      console.log(`    ΔLL(λ=${l} vs λ=1) bootstrap: %95 GA=[${lo.toFixed(4)}, ${hi.toFixed(4)}] P(ΔLL<0)=${(pNeg * 100).toFixed(1)}% ${hi < 0 || lo > 0 ? "(anlamlı fark)" : "(sıfırı içeriyor — market/non-market dengesi bu aralıkta stabil)"}`);
    }

    if (enIyiLambda === 1) {
      console.log(`\n  KARAR: λ̂=1 TRAIN'de optimal — mevcut AGF ağırlığı korunuyor. (Yukarıdaki sensitivity curve salt gözlem, production kararını DEĞİŞTİRMEZ.)`);
      return;
    }

    const rng = mulberry32(SEED);
    const deltaLLBoot: number[] = [];
    for (let b = 0; b < B; b++) {
      const resample = bootstrapResample(testGroups, rng);
      deltaLLBoot.push(logLossAtLambda(resample, enIyiLambda) - logLossAtLambda(resample, 1));
    }
    const sortedDelta = [...deltaLLBoot].sort((a, b) => a - b);
    const dLo = percentile(sortedDelta, 0.025);
    const dHi = percentile(sortedDelta, 0.975);
    const negatifSayisi = deltaLLBoot.filter((v) => v < 0).length;
    const signStability = negatifSayisi / deltaLLBoot.length;
    console.log(`  ΔLL bootstrap (B=${B}, TEST, paired): %95 GA=[${dLo.toFixed(4)}, ${dHi.toFixed(4)}] P(ΔLL<0)=${(signStability * 100).toFixed(1)}%`);
    console.log(`  KARAR: ${dHi < 0 ? `✓✓ ΔLL kesin negatif — λ=${enIyiLambda} production'dan (λ=1) İSTATİSTİKSEL OLARAK DAHA İYİ` : dLo > 0 ? "✗ ΔLL kesin pozitif — mevcut AGF ağırlığı (λ=1) DAHA İYİ" : "sıfırı içeriyor (kanıtlanamadı, mevcut λ=1 korunmalı)"}`);
  }

  test("ŞARTLI 1/19/27 + MAIDEN (düşük-şart)", dusukSart);
  test("DİĞER KOŞULAR", diger);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
