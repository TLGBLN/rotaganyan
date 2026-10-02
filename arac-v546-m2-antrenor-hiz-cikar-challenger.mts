// CHALLENGER M2 — "Antrenör+Hız Çıkar" (2026-10-02, kullanıcının acil talebi üzerine)
//
// Bugünkü Coupon Value Audit'te (disagreement forensic, n=94 post-08-17) model AGF'den
// AYRIŞTIĞINDA kaybettiği ayaklarda EN SIK geriye iten 2 sinyal: antrenorOrani (18/94,
// ort. katkı -0.222) ve hizDerecesi (10/94, en güçlü ort. katkı -0.273) — ikisi de zaten
// Faz A1.5'te "yüksek etki/düşük kanıtlanmış değer" (antrenor) ve "coefficient
// non-stationarity olası" (hız, "Diğer" segmentinde) diye işaretlenmişti. Bu, o kuşkuyu
// doğrudan gerçek kaybedilen-kupon vakalarıyla destekleyen YENİ bir kanıt katmanı.
//
// NOT: agfPayi bu listede YOK — aynı gün Challenger M1 onu zaten test etti ve DEV'de
// INFERIOR bulundu (ΔLL=+0.091). Aynı günde ikinci kez test etmeden çıkarmak, bilinen
// bir başarısızlığı tekrarlamak olurdu.
//
// Champion : V5.46 FULL (15 sinyal, GERÇEK yayınlanan katkılar)
// Challenger M2 : V5.46 - {antrenorOrani, hizDerecesi} — kalan 13 sinyal TRAIN'de
//            YENİDEN FİT edilir.
//
// PRE-REGISTERED (DEV görülmeden sabitlendi, M1 ile AYNI protokol):
//   ε = 0.01 (race-level LogLoss). GA üst sınırı<0→SUPERIOR |<ε→NON-INFERIOR |>ε→INFERIOR
//   TRAIN(60%)/DEV(20%)/TEST(20%, kilitli), kronolojik.
//
// Production'a DOKUNULMADI — yalnız test.
import { db } from "./src/lib/db";
import { softmax, hibritMaidenSatisMi } from "./src/lib/methodology/v5-engine";
import { kategoriTespit } from "./src/lib/methodology/v2-engine";

const B_BOOTSTRAP = 2000;
const EPSILON = 0.01;
const TUM_KODLAR = [
  "agfSirasi", "idmJokey", "jokeyOrani", "antrenorOrani", "agfPayi", "h2hNetSkor", "hizDerecesi",
  "agfPayi2", "zeminToleransi", "yakinsama2Plus", "sonIdmanSprint", "takiDegisikligi", "yarisGidisatiSkoru",
  "sireOrani", "zeminMesafeDeneyim",
] as const;
type Kod = (typeof TUM_KODLAR)[number];
const CIKARILACAK: Kod[] = ["antrenorOrani", "hizDerecesi"];
const CHALLENGER_KODLARI = TUM_KODLAR.filter((k) => !CIKARILACAK.includes(k));

type RunnerRec = { no: number; isWinner: boolean; standart: Record<Kod, number>; katki: Record<Kod, number> };
type RaceRec = { raceId: string; date: number; segment: string; liderEsigi: number; runners: RunnerRec[] };

function segmentBelirle(classType: string): string {
  if (hibritMaidenSatisMi(classType)) return "Hibrit";
  const kat = kategoriTespit(classType);
  if (kat === "1a" || kat === "1b") return "Düşük Şart";
  if (kat === "2") return "Handikap";
  return "Diğer";
}
function liderEsigiHesaplaYerel(classType: string): number { return kategoriTespit(classType) === "2" ? 0.35 : 0.7; }

async function main() {
  console.log("1/5 — Veri yükleniyor (M1 ile AYNI kaynak)...");
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

  const byRace = new Map<string, RaceRec>();
  for (const row of rows) {
    if (!row.runnerId) continue;
    const runner = runnerById.get(row.runnerId);
    if (!runner || runner.scratched || runner.ekuriGroup != null) continue;
    const fs = row.featureSnapshot;
    const tumSinyaller: { kod: string; katki: number; standartDeger: number }[] = fs?.tumSinyaller ?? [];
    const bKatmani = fs?.bKatmani ?? {};
    const standart: Partial<Record<Kod, number>> = {}, katki: Partial<Record<Kod, number>> = {};
    for (const s of tumSinyaller) if ((TUM_KODLAR as readonly string[]).includes(s.kod)) { standart[s.kod as Kod] = s.standartDeger; katki[s.kod as Kod] = s.katki; }
    katki.sireOrani = bKatmani.sireKatkisi ?? 0;
    katki.zeminMesafeDeneyim = bKatmani.zeminMesafeKatkisi ?? 0;
    standart.sireOrani = katki.sireOrani;
    standart.zeminMesafeDeneyim = katki.zeminMesafeDeneyim;
    if (TUM_KODLAR.some((k) => katki[k] == null)) continue;

    const raceId = row.prediction_raceId;
    const race = byRace.get(raceId) ?? { raceId, date: new Date(row.date).getTime(), segment: segmentBelirle(row.classType), liderEsigi: liderEsigiHesaplaYerel(row.classType), runners: [] };
    race.runners.push({ no: runner.no, isWinner: (row.winnerNos as number[]).includes(runner.no), standart: standart as Record<Kod, number>, katki: katki as Record<Kod, number> });
    byRace.set(raceId, race);
  }
  const tumYarislar = [...byRace.values()].filter((y) => y.runners.length >= 4 && y.runners.some((r) => r.isWinner)).sort((a, b) => a.date - b.date);
  const nTrain = Math.floor(tumYarislar.length * 0.6);
  const nDev = Math.floor(tumYarislar.length * 0.2);
  const train = tumYarislar.slice(0, nTrain), dev = tumYarislar.slice(nTrain, nTrain + nDev), test = tumYarislar.slice(nTrain + nDev);
  console.log(`   n=${tumYarislar.length}  TRAIN=${train.length}  DEV=${dev.length}  TEST=${test.length} (kilitli)\n`);

  console.log("2/5 — Champion skorları (GERÇEK üretim katkıları, yeniden hesaplanmadı)...");
  const championProbs = (y: RaceRec) => softmax(y.runners.map((r) => TUM_KODLAR.reduce((s, k) => s + r.katki[k], 0)), y.liderEsigi);

  console.log("3/5 — Challenger M2: TRAIN'de 13-boyutlu refit...");
  const betaTrain = fitWeights(train, CHALLENGER_KODLARI);
  console.log(`   Challenger β (TRAIN): ${CHALLENGER_KODLARI.map((k) => `${k}=${betaTrain[k].toFixed(3)}`).join(", ")}\n`);
  const challengerProbs = (y: RaceRec, beta: Record<Kod, number>) => softmax(y.runners.map((r) => CHALLENGER_KODLARI.reduce((s, k) => s + beta[k] * r.standart[k], 0)), y.liderEsigi);

  function raceSonuc(y: RaceRec, beta: Record<Kod, number>) {
    const pChamp = championProbs(y), pChal = challengerProbs(y, beta);
    const idx = y.runners.findIndex((r) => r.isWinner);
    return { pChamp, pChal, idx };
  }
  function paired(yarislar: RaceRec[], beta: Record<Kod, number>) {
    return yarislar.map((y) => {
      const { pChamp, pChal, idx } = raceSonuc(y, beta);
      return { d: -Math.log(Math.max(pChal[idx], 1e-9)) - -Math.log(Math.max(pChamp[idx], 1e-9)), pChamp, pChal, idx, y };
    });
  }

  console.log("4/5 — DEV testi (pre-registered karar)...\n");
  const devSonuc = paired(dev, betaTrain);
  const ciDev = bootstrapCI(devSonuc.map((s) => s.d));
  const kararDev = karar(ciDev);
  console.log(`DEV ΔLL(Challenger-Champion) = ${ciDev.nokta.toFixed(5)}  95%GA=[${ciDev.lo.toFixed(5)},${ciDev.hi.toFixed(5)}]  → ${kararDev}`);

  if (kararDev === "INFERIOR") {
    console.log("\n→ TEST AÇILMAZ (pre-registered kural: üst sınır > ε). Challenger M2 bu turda İLERLEMEDİ. V5.46 DEĞİŞMEDİ.");
    return;
  }

  console.log("\nTEST (kilitli) açılıyor — TRAIN+DEV ile yeniden fit...");
  const betaFinal = fitWeights([...train, ...dev], CHALLENGER_KODLARI);
  const testSonuc = paired(test, betaFinal);
  const ciTest = bootstrapCI(testSonuc.map((s) => s.d));
  const kararTest = karar(ciTest);
  console.log(`TEST ΔLL(Challenger-Champion) = ${ciTest.nokta.toFixed(5)}  95%GA=[${ciTest.lo.toFixed(5)},${ciTest.hi.toFixed(5)}]  → ${kararTest}\n`);

  console.log("5/5 — İkincil metrikler (TEST)...\n");
  let top1C = 0, top1Ch = 0, top3C = 0, top3Ch = 0, rankFark = 0;
  for (const s of testSonuc) {
    const siraC = [...s.y.runners.keys()].sort((a, b) => s.pChamp[b] - s.pChamp[a]);
    const siraCh = [...s.y.runners.keys()].sort((a, b) => s.pChal[b] - s.pChal[a]);
    const rC = siraC.indexOf(s.idx) + 1, rCh = siraCh.indexOf(s.idx) + 1;
    if (rC === 1) top1C++; if (rCh === 1) top1Ch++;
    if (rC <= 3) top3C++; if (rCh <= 3) top3Ch++;
    rankFark += rCh - rC;
  }
  console.log(`Top1: Champion=${((top1C / testSonuc.length) * 100).toFixed(1)}%  Challenger=${((top1Ch / testSonuc.length) * 100).toFixed(1)}%`);
  console.log(`Top3: Champion=${((top3C / testSonuc.length) * 100).toFixed(1)}%  Challenger=${((top3Ch / testSonuc.length) * 100).toFixed(1)}%`);
  console.log(`Ortalama WinnerRank farkı (Challenger-Champion): ${(rankFark / testSonuc.length).toFixed(3)}`);
}

function karar(ci: { lo: number; hi: number }): "SUPERIOR" | "NON-INFERIOR" | "INFERIOR" {
  if (ci.hi < 0) return "SUPERIOR";
  if (ci.hi < EPSILON) return "NON-INFERIOR";
  return "INFERIOR";
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
            const mx = Math.max(...sk);
            const lse = mx + Math.log(sk.reduce((s, v) => s + Math.exp(v - mx), 0));
            ll += sk[idx] - lse;
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
function bootstrapCI(farklar: number[], B = B_BOOTSTRAP): { nokta: number; lo: number; hi: number } {
  const nokta = farklar.reduce((a, b) => a + b, 0) / farklar.length;
  const dagilim: number[] = [];
  for (let i = 0; i < B; i++) { let t = 0; for (let j = 0; j < farklar.length; j++) t += farklar[Math.floor(Math.random() * farklar.length)]; dagilim.push(t / farklar.length); }
  dagilim.sort((a, b) => a - b);
  return { nokta, lo: dagilim[Math.floor(dagilim.length * 0.025)], hi: dagilim[Math.floor(dagilim.length * 0.975)] };
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
