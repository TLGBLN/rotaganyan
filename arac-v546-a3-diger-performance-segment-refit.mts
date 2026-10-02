// FAZ A3 — SON AÇIK DOSYA: "Diğer" segmentinde Performance bloğunun segment-İÇİ
// refit-aware testi (2026-10-02, kullanıcı tasarımı)
//
// Zincir: D^fixed_Performance,Diğer=-0.0209 (anlamlı negatif, A1/A2) — Hız'ın KENDİ
// A1.5 analizinde production katsayısının dönem içinde yön değiştirdiği görüldü —
// ama GLOBAL Performance refit (A3.3) belirsiz çıktı (-0.020, GA=[-0.057,0.021]).
// Tek eksik halka: Diğer segmentinin KENDİ TRAIN'inde FULL vs FULL-minus-Performance
// refit (segment-içi, GLOBAL'e havuzlanmadan).
//
// Performance = h2hNetSkor + hizDerecesi + zeminMesafeDeneyim.
// Sonuç üç şekilde okunur (kullanıcının kendi çerçevesi):
//   RefitD ≈ 0           → mevcut sabit parametrizasyon problemi, blok unique değil
//   RefitD > 0, CI > 0   → blok gerçekten bilgi taşıyor, mevcut katsayılar yanlış kullanıyor
//   RefitD < 0, CI < 0   → blok bu dönemde gerçekten zarar veriyor, ayrı challenger gerekçesi
//
// Production'a dokunulmadı — yalnız teşhis. Bu testle Faz A (Signal Anatomy) KAPANIYOR.
import { db } from "./src/lib/db";
import { hibritMaidenSatisMi } from "./src/lib/methodology/v5-engine";
import { kategoriTespit } from "./src/lib/methodology/v2-engine";

const B_BOOTSTRAP = 1000;
const TUM_KODLAR = [
  "agfSirasi", "idmJokey", "jokeyOrani", "antrenorOrani", "agfPayi", "h2hNetSkor", "hizDerecesi",
  "agfPayi2", "zeminToleransi", "yakinsama2Plus", "sonIdmanSprint", "takiDegisikligi", "yarisGidisatiSkoru",
  "sireOrani", "zeminMesafeDeneyim",
] as const;
type Kod = (typeof TUM_KODLAR)[number];
const PERFORMANCE: Kod[] = ["h2hNetSkor", "hizDerecesi", "zeminMesafeDeneyim"];

type RunnerRec = { no: number; isWinner: boolean; standart: Record<Kod, number> };
type RaceRec = { raceId: string; date: number; runners: RunnerRec[] };

function segmentBelirle(classType: string): string {
  if (hibritMaidenSatisMi(classType)) return "Hibrit";
  const kat = kategoriTespit(classType);
  if (kat === "1a" || kat === "1b") return "Düşük Şart";
  if (kat === "2") return "Handikap";
  return "Diğer";
}

async function main() {
  console.log("Veri yükleniyor (yalnız 'Diğer' segmenti)...");
  const rows: any[] = await db.$queryRawUnsafe(`
    SELECT p."featureSnapshot" as "featureSnapshot", p."runnerId" as "runnerId",
           pr."raceId" as "prediction_raceId", r."classType" as "classType", rd.date as "date",
           res."winnerNos" as "winnerNos"
    FROM "Pick" p
    JOIN "Prediction" pr ON pr.id = p."predictionId"
    JOIN "Race" r ON r.id = pr."raceId"
    JOIN "RaceDay" rd ON rd.id = r."raceDayId"
    JOIN "Hippodrome" h ON h.id = rd."hippodromeId"
    JOIN "Result" res ON res."raceId" = r.id
    WHERE p."featureSnapshot"->>'motorEtiketi' LIKE 'V5.46%'
      AND pr.published = true AND h."isForeign" = false AND h.name != 'Karma'
  `);
  const runnerIds = [...new Set(rows.map((r) => r.runnerId).filter((x): x is string => !!x))];
  const runners = await db.runner.findMany({ where: { id: { in: runnerIds } }, select: { id: true, no: true, scratched: true, ekuriGroup: true } });
  const runnerById = new Map(runners.map((r) => [r.id, r]));

  const byRace = new Map<string, RaceRec & { segment: string }>();
  for (const row of rows) {
    if (!row.runnerId || segmentBelirle(row.classType) !== "Diğer") continue;
    const runner = runnerById.get(row.runnerId);
    if (!runner || runner.scratched || runner.ekuriGroup != null) continue;
    const fs = row.featureSnapshot;
    const tumSinyaller: { kod: string; standartDeger: number }[] = fs?.tumSinyaller ?? [];
    const bKatmani = fs?.bKatmani ?? {};
    const standart: Partial<Record<Kod, number>> = {};
    for (const s of tumSinyaller) if ((TUM_KODLAR as readonly string[]).includes(s.kod)) standart[s.kod as Kod] = s.standartDeger;
    standart.sireOrani = bKatmani.sireKatkisi ?? 0;
    standart.zeminMesafeDeneyim = bKatmani.zeminMesafeKatkisi ?? 0;
    if (TUM_KODLAR.some((k) => standart[k] == null)) continue;

    const raceId = row.prediction_raceId;
    const race = byRace.get(raceId) ?? { raceId, date: new Date(row.date).getTime(), segment: "Diğer", runners: [] };
    race.runners.push({ no: runner.no, isWinner: (row.winnerNos as number[]).includes(runner.no), standart: standart as Record<Kod, number> });
    byRace.set(raceId, race);
  }
  const digerYarislari = [...byRace.values()].filter((y) => y.runners.length >= 4 && y.runners.some((r) => r.isWinner)).sort((a, b) => a.date - b.date);
  const nTrain = Math.floor(digerYarislari.length * 0.7);
  const train = digerYarislari.slice(0, nTrain), dev = digerYarislari.slice(nTrain);
  console.log(`"Diğer" n=${digerYarislari.length}  TRAIN=${train.length}  DEV=${dev.length}\n`);

  const betaFull = fitWeights(train, TUM_KODLAR);
  const kodlarMinus = TUM_KODLAR.filter((k) => !PERFORMANCE.includes(k));
  const betaMinus = fitWeights(train, kodlarMinus);

  console.log(`FULL (Diğer-içi) refit β: ${TUM_KODLAR.map((k) => `${k}=${betaFull[k].toFixed(3)}`).join(", ")}`);
  console.log(`\nPerformance bloğundaki refit β'lar: h2hNetSkor=${betaFull.h2hNetSkor.toFixed(3)}  hizDerecesi=${betaFull.hizDerecesi.toFixed(3)}  zeminMesafeDeneyim=${betaFull.zeminMesafeDeneyim.toFixed(3)}`);
  console.log(`(Üretim 'diğer' β'ları: h2hNetSkor≈+0.099, hizDerecesi=+0.1220, zeminMesafeDeneyim=0.02 sabit katsayı×merkezlenmiş değer — doğrudan karşılaştırılabilir ölçekte DEĞİL, yön/işaret kıyaslanabilir)\n`);

  console.log("Diğer β'ların FULL→FULL-minus-Performance arasındaki DEĞİŞİMİ (telafi):");
  for (const k of kodlarMinus) {
    const fark = betaMinus[k] - betaFull[k];
    if (Math.abs(fark) >= 0.01) console.log(`   ${k.padEnd(20)} ${betaFull[k].toFixed(4)} → ${betaMinus[k].toFixed(4)}  (Δ=${fark >= 0 ? "+" : ""}${fark.toFixed(4)})`);
  }

  const devFullLL = dev.map((y) => loglossBeta(y, betaFull, TUM_KODLAR));
  const farklar = dev.map((y, i) => loglossBeta(y, betaMinus, kodlarMinus) - devFullLL[i]);
  const ci = bootstrapCI(farklar);
  console.log(`\nDEV logloss — FULL(Diğer-içi refit)=${(devFullLL.reduce((a,b)=>a+b,0)/devFullLL.length).toFixed(5)}  FULL-minus-Performance=${(farklar.reduce((a,b,i)=>a+b+devFullLL[i],0)/farklar.length).toFixed(5)}`);
  console.log(`\nSEGMENT-İÇİ REFIT-AWARE RefitD_Performance,Diğer = ${ci.nokta.toFixed(5)}  95%GA=[${ci.lo.toFixed(5)},${ci.hi.toFixed(5)}]`);
  if (ci.lo > 0 && ci.hi > 0) console.log("   → RefitD>0, CI>0: blok GERÇEKTEN bilgi taşıyor, mevcut katsayılar YANLIŞ KULLANIYOR olabilir.");
  else if (ci.lo < 0 && ci.hi < 0) console.log("   → RefitD<0, CI<0: blok bu dönemde GERÇEKTEN zarar veriyor — ayrı challenger gerekçesi oluşur.");
  else console.log("   → GA sıfırı kapsıyor: mevcut sabit parametrizasyon sorunu HİPOTEZİYLE tutarlı, blok'un kendisinin unique zararlı/faydalı olduğu KANITLANMADI.");
}

function fitWeights(train: RaceRec[], kodlar: readonly Kod[]): Record<Kod, number> {
  const beta: Record<Kod, number> = Object.fromEntries(TUM_KODLAR.map((k) => [k, 0])) as Record<Kod, number>;
  for (let tur = 0; tur < 6; tur++) {
    for (const kod of kodlar) {
      let merkez = beta[kod], aralik = 2, adim = 0.2;
      for (let k = 0; k < 3; k++) {
        let enIyi = merkez, enIyiLL = -Infinity;
        for (let g = merkez - aralik; g <= merkez + aralik + 1e-9; g += adim) {
          const deneme = { ...beta, [kod]: g };
          let ll = 0;
          for (const y of train) {
            const sk = y.runners.map((r) => kodlar.reduce((s, kk) => s + deneme[kk] * r.standart[kk], 0));
            const idx = y.runners.findIndex((r) => r.isWinner);
            ll += Math.log(Math.max(softmaxHam(sk)[idx], 1e-9));
          }
          if (ll > enIyiLL) { enIyiLL = ll; enIyi = g; }
        }
        merkez = enIyi; aralik = adim * 2; adim = adim / 10;
      }
      beta[kod] = Math.round(merkez * 10000) / 10000;
    }
  }
  return beta;
}
function softmaxHam(scores: number[]): number[] {
  const mx = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - mx));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}
function loglossBeta(y: RaceRec, beta: Record<Kod, number>, kodlar: readonly Kod[]): number {
  const sk = y.runners.map((r) => kodlar.reduce((s, k) => s + beta[k] * r.standart[k], 0));
  const idx = y.runners.findIndex((r) => r.isWinner);
  return -Math.log(Math.max(softmaxHam(sk)[idx], 1e-9));
}
function bootstrapCI(farklar: number[], B = B_BOOTSTRAP): { nokta: number; lo: number; hi: number } {
  const nokta = farklar.reduce((a, b) => a + b, 0) / farklar.length;
  const dagilim: number[] = [];
  for (let i = 0; i < B; i++) { let t = 0; for (let j = 0; j < farklar.length; j++) t += farklar[Math.floor(Math.random() * farklar.length)]; dagilim.push(t / farklar.length); }
  dagilim.sort((a, b) => a - b);
  return { nokta, lo: dagilim[Math.floor(dagilim.length * 0.025)], hi: dagilim[Math.floor(dagilim.length * 0.975)] };
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
