// FAZ A2 — V5.46 İkili (105 çift) Redundancy/Synergy + Blok Ablasyonu (2026-10-02)
//
// A1+A1.5'in temiz temeli üzerine: 15 sinyalin TÜM C(15,2)=105 çiftini fixed-weight
// olarak (REFIT YOK, β DEĞİŞMEDİ) birlikte çıkarıp "Pair Excess Loss" ölçer:
//   D_j   = LL(M_-j)  - LL(M_FULL)      (A1'deki tekil ablation, burada yeniden hesaplandı)
//   D_k   = LL(M_-k)  - LL(M_FULL)
//   D_jk  = LL(M_-jk) - LL(M_FULL)      (ikisi birden çıkarılmış)
//   E_jk  = D_jk - D_j - D_k            ("Pair Excess Loss" — kullanıcı KASITLA "causal
//           synergy" DEMEDİ, yalnız tanımlayıcı bir ölçü) — E_jk>0: ikisi birlikte
//           çıkarılınca tek tek toplamından DAHA FAZLA zarar → fixed-weight düzeyinde
//           ikame/redundancy İHTİMALİYLE uyumlu (biri tek başına çıkınca diğeri
//           boşluğu dolduruyor olabilir). E_jk<0: etkiler üst üste biniyor/bağımlı olabilir.
//
// Sabit bloklar (baştan donduruldu, sonuca göre DEĞİŞTİRİLMEDİ):
//   Market: agfSirasi+agfPayi+agfPayi2 | Human: idmJokey+jokeyOrani+antrenorOrani
//   Performance: h2hNetSkor+hizDerecesi+zeminMesafeDeneyim
//   Context: zeminToleransi+yakinsama2Plus+yarisGidisatiSkoru
//   Micro: sonIdmanSprint+takiDegisikligi | Pedigree: sireOrani
//
// Her blok için: FULL-Block (blok tamamen çıkarılmış) VE Market-only→Market+Block
// (yalnız AGF üçlüsü vs AGF üçlüsü+blok) AYRI raporlanır.
//
// KAPSAM: refit YOK, production YOK. Bu turun sonunda shortlist seçimi YAPILMAZ —
// yalnız veri üretilir, A3 (refit-aware shortlist) AYRI bir onayla başlar.
import { db } from "./src/lib/db";
import { softmax, hibritMaidenSatisMi } from "./src/lib/methodology/v5-engine";
import { kategoriTespit } from "./src/lib/methodology/v2-engine";

const B_BOOTSTRAP = 1000;
const TUM_KODLAR = [
  "agfSirasi", "idmJokey", "jokeyOrani", "antrenorOrani", "agfPayi", "h2hNetSkor", "hizDerecesi",
  "agfPayi2", "zeminToleransi", "yakinsama2Plus", "sonIdmanSprint", "takiDegisikligi", "yarisGidisatiSkoru",
  "sireOrani", "zeminMesafeDeneyim",
] as const;
type Kod = (typeof TUM_KODLAR)[number];

const BLOKLAR: Record<string, Kod[]> = {
  Market: ["agfSirasi", "agfPayi", "agfPayi2"],
  Human: ["idmJokey", "jokeyOrani", "antrenorOrani"],
  Performance: ["h2hNetSkor", "hizDerecesi", "zeminMesafeDeneyim"],
  Context: ["zeminToleransi", "yakinsama2Plus", "yarisGidisatiSkoru"],
  Micro: ["sonIdmanSprint", "takiDegisikligi"],
  Pedigree: ["sireOrani"],
};

const IŞARETLİ_ÇİFTLER: [Kod, Kod][] = [
  ["antrenorOrani", "agfSirasi"], ["antrenorOrani", "agfPayi"], ["antrenorOrani", "jokeyOrani"],
  ["hizDerecesi", "agfSirasi"], ["hizDerecesi", "agfPayi"], ["hizDerecesi", "yarisGidisatiSkoru"], ["hizDerecesi", "h2hNetSkor"],
];
const AGF_UCLUSU: Kod[] = ["agfSirasi", "agfPayi", "agfPayi2"];

type RunnerRec = { no: number; isWinner: boolean; katki: Record<Kod, number> };
type RaceRec = { raceId: string; segment: string; liderEsigi: number; runners: RunnerRec[] };

function segmentBelirle(classType: string): string {
  if (hibritMaidenSatisMi(classType)) return "Hibrit";
  const kat = kategoriTespit(classType);
  if (kat === "1a" || kat === "1b") return "Düşük Şart";
  if (kat === "2") return "Handikap";
  return "Diğer";
}
function liderEsigiHesaplaYerel(classType: string): number {
  return kategoriTespit(classType) === "2" ? 0.35 : 0.7;
}

async function main() {
  console.log("1/4 — Veri yükleniyor (A1/A1.5 ile AYNI kaynak: featureSnapshot, motorEtiketi='V5.46%')...");
  const rows: any[] = await db.$queryRawUnsafe(`
    SELECT p."featureSnapshot" as "featureSnapshot", p."runnerId" as "runnerId",
           pr."raceId" as "prediction_raceId", r."classType" as "classType", res."winnerNos" as "winnerNos"
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
    const tumSinyaller: { kod: string; katki: number }[] = fs?.tumSinyaller ?? [];
    const bKatmani = fs?.bKatmani ?? {};
    const katki: Partial<Record<Kod, number>> = {};
    for (const s of tumSinyaller) if ((TUM_KODLAR as readonly string[]).includes(s.kod)) katki[s.kod as Kod] = s.katki;
    katki.sireOrani = bKatmani.sireKatkisi ?? 0;
    katki.zeminMesafeDeneyim = bKatmani.zeminMesafeKatkisi ?? 0;
    if (TUM_KODLAR.some((k) => katki[k] == null)) continue;

    const raceId = row.prediction_raceId;
    const race = byRace.get(raceId) ?? { raceId, segment: segmentBelirle(row.classType), liderEsigi: liderEsigiHesaplaYerel(row.classType), runners: [] };
    race.runners.push({ no: runner.no, isWinner: (row.winnerNos as number[]).includes(runner.no), katki: katki as Record<Kod, number> });
    byRace.set(raceId, race);
  }
  const tumYarislar = [...byRace.values()].filter((y) => y.runners.length >= 4 && y.runners.some((r) => r.isWinner));
  console.log(`   ${tumYarislar.length} yarış kullanılabilir.\n`);

  const segmentler: Record<string, RaceRec[]> = {
    GLOBAL: tumYarislar,
    "Düşük Şart": tumYarislar.filter((y) => y.segment === "Düşük Şart"),
    "Diğer": tumYarislar.filter((y) => y.segment === "Diğer"),
    "Handikap": tumYarislar.filter((y) => y.segment === "Handikap"),
  };
  console.log(`   Segment n: Düşük Şart=${segmentler["Düşük Şart"].length}, Diğer=${segmentler["Diğer"].length}, Handikap=${segmentler["Handikap"].length}, Hibrit=N/A (cohort yok, bkz. A1.5)\n`);

  console.log("2/4 — 105 çiftin tamamı: D_j, D_k, D_jk, E_jk (GLOBAL, race-level bootstrap)...\n");
  const sonuclar105 = hesapla105Cift(tumYarislar);
  raporla105Ozet(sonuclar105);

  console.log("\n3/4 — Sabit blok ablasyonu (FULL-Block + Market→Market+Block), GLOBAL + segment kırılımı...");
  console.log("    (İŞARET KURALI, HER İKİ SÜTUNDA DA AYNI: pozitif = o blok/sinyal DEĞERLİ —");
  console.log("     FULL-Block: çıkarmak logloss'u ARTIRIYORSA (+) blok yararlı; Market→Market+Block:");
  console.log("     bloğu Market'e EKLEMEK logloss'u DÜŞÜRÜYORSA (+) blok Market'in ÜSTÜNE değer katıyor.)\n");
  for (const [segAd, yarislar] of Object.entries(segmentler)) {
    if (yarislar.length < 10) continue;
    console.log(`\n========== ${segAd} (n=${yarislar.length}) ==========`);
    blokTablosu(yarislar);
  }

  console.log("\n4/4 — AGF üçlüsü özel tablo + işaretli çiftler (GLOBAL)...\n");
  agfUclusuOzel(tumYarislar, sonuclar105);
  isaretliCiftlerOzel(sonuclar105);
}

// ─── Çekirdek skor/ablasyon ─────────────────────────────────────────────────

function softmaxHam(scores: number[]): number[] {
  const mx = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - mx));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}
function sHaric(r: RunnerRec, haric: Set<Kod>): number {
  let s = 0;
  for (const k of TUM_KODLAR) if (!haric.has(k)) s += r.katki[k];
  return s;
}
function loglossWinner(y: RaceRec, haric: Set<Kod>): number {
  const sk = y.runners.map((r) => sHaric(r, haric));
  const probs = softmax(sk, y.liderEsigi);
  const idx = y.runners.findIndex((r) => r.isWinner);
  return -Math.log(Math.max(probs[idx], 1e-9));
}
function siraVeTop(y: RaceRec, haric: Set<Kod>): { rank: number; top1: boolean; top3: boolean } {
  const sk = y.runners.map((r) => sHaric(r, haric));
  const probs = softmax(sk, y.liderEsigi);
  const idx = y.runners.findIndex((r) => r.isWinner);
  const sirali = [...y.runners.keys()].sort((a, b) => probs[b] - probs[a]);
  const rank = sirali.indexOf(idx) + 1;
  return { rank, top1: rank === 1, top3: rank <= 3 };
}

function bootstrapCI(farklar: number[], B = B_BOOTSTRAP): { nokta: number; lo: number; hi: number } {
  const nokta = farklar.reduce((a, b) => a + b, 0) / farklar.length;
  const dagilim: number[] = [];
  for (let i = 0; i < B; i++) { let t = 0; for (let j = 0; j < farklar.length; j++) t += farklar[Math.floor(Math.random() * farklar.length)]; dagilim.push(t / farklar.length); }
  dagilim.sort((a, b) => a - b);
  return { nokta, lo: dagilim[Math.floor(dagilim.length * 0.025)], hi: dagilim[Math.floor(dagilim.length * 0.975)] };
}

type ÇiftSonuç = { j: Kod; k: Kod; dJ: number; dK: number; dJK: number; eJK: { nokta: number; lo: number; hi: number }; dTop1: number; dTop3: number; dWinnerRank: number };

function hesapla105Cift(yarislar: RaceRec[]): ÇiftSonuç[] {
  const bos = new Set<Kod>();
  const llFull = yarislar.map((y) => loglossWinner(y, bos));
  const dTek: Record<Kod, number[]> = {} as any;
  for (const k of TUM_KODLAR) dTek[k] = yarislar.map((y, i) => loglossWinner(y, new Set([k])) - llFull[i]);

  const sonuclar: ÇiftSonuç[] = [];
  for (let a = 0; a < TUM_KODLAR.length; a++) {
    for (let b = a + 1; b < TUM_KODLAR.length; b++) {
      const j = TUM_KODLAR[a], k = TUM_KODLAR[b];
      const haricJK = new Set([j, k]);
      const dJKarray = yarislar.map((y, i) => loglossWinner(y, haricJK) - llFull[i]);
      const eArray = yarislar.map((_, i) => dJKarray[i] - dTek[j][i] - dTek[k][i]);
      const eCI = bootstrapCI(eArray);

      let top1Full = 0, top1JK = 0, top3Full = 0, top3JK = 0, rankFarkToplam = 0;
      for (const y of yarislar) {
        const f = siraVeTop(y, bos), jk = siraVeTop(y, haricJK);
        if (f.top1) top1Full++; if (jk.top1) top1JK++;
        if (f.top3) top3Full++; if (jk.top3) top3JK++;
        rankFarkToplam += jk.rank - f.rank;
      }
      sonuclar.push({
        j, k, dJ: dTek[j].reduce((s, v) => s + v, 0) / dTek[j].length, dK: dTek[k].reduce((s, v) => s + v, 0) / dTek[k].length,
        dJK: dJKarray.reduce((s, v) => s + v, 0) / dJKarray.length, eJK: eCI,
        dTop1: (top1JK - top1Full) / yarislar.length, dTop3: (top3JK - top3Full) / yarislar.length, dWinnerRank: rankFarkToplam / yarislar.length,
      });
    }
  }
  return sonuclar;
}

function anlamliMi(ci: { lo: number; hi: number }): boolean { return (ci.lo > 0 && ci.hi > 0) || (ci.lo < 0 && ci.hi < 0); }

function raporla105Ozet(sonuclar: ÇiftSonuç[]) {
  const anlamlilar = sonuclar.filter((s) => anlamliMi(s.eJK));
  console.log(`Toplam çift: ${sonuclar.length}  —  E_jk anlamlı (GA sıfırı dışlıyor) olan: ${anlamlilar.length}\n`);

  const enYuksekPozitif = [...sonuclar].sort((a, b) => b.eJK.nokta - a.eJK.nokta).slice(0, 10);
  console.log("--- En yüksek POZİTİF Pair Excess Loss (olası ikame/redundancy, ilk 10) ---");
  for (const s of enYuksekPozitif) {
    console.log(`${s.j.padEnd(20)} × ${s.k.padEnd(20)} E=${s.eJK.nokta.toFixed(5)} GA=[${s.eJK.lo.toFixed(5)},${s.eJK.hi.toFixed(5)}] ${anlamliMi(s.eJK) ? "★" : ""}  (D_j=${s.dJ.toFixed(4)} D_k=${s.dK.toFixed(4)} D_jk=${s.dJK.toFixed(4)})`);
  }
  const enDusukNegatif = [...sonuclar].sort((a, b) => a.eJK.nokta - b.eJK.nokta).slice(0, 10);
  console.log("\n--- En düşük NEGATİF Pair Excess Loss (üst üste binen/bağımlı etki, ilk 10) ---");
  for (const s of enDusukNegatif) {
    console.log(`${s.j.padEnd(20)} × ${s.k.padEnd(20)} E=${s.eJK.nokta.toFixed(5)} GA=[${s.eJK.lo.toFixed(5)},${s.eJK.hi.toFixed(5)}] ${anlamliMi(s.eJK) ? "★" : ""}  (D_j=${s.dJ.toFixed(4)} D_k=${s.dK.toFixed(4)} D_jk=${s.dJK.toFixed(4)})`);
  }
}

// ─── Blok tablosu ───────────────────────────────────────────────────────────

function blokTablosu(yarislar: RaceRec[]) {
  const bos = new Set<Kod>();
  const llFull = yarislar.map((y) => loglossWinner(y, bos));
  const marketKodlari = new Set(BLOKLAR["Market"]);
  const llMarketOnly = yarislar.map((y) => loglossWinner(y, new Set(TUM_KODLAR.filter((k) => !marketKodlari.has(k)))));

  console.log("Blok".padEnd(14) + "FULL-Block ΔLL".padStart(16) + "95%GA".padStart(22) + "  Market→Market+Block ΔLL".padStart(26) + "95%GA".padStart(22));
  for (const [blokAd, kodlar] of Object.entries(BLOKLAR)) {
    const haricBlok = new Set(kodlar);
    const farkFullBlock = yarislar.map((y, i) => loglossWinner(y, haricBlok) - llFull[i]);
    const ciFullBlock = bootstrapCI(farkFullBlock);

    let satirMarket = "—".padStart(26) + "—".padStart(22);
    if (blokAd !== "Market") {
      const haricMarketArtiBlok = new Set(TUM_KODLAR.filter((k) => !marketKodlari.has(k) && !kodlar.includes(k)));
      const llMarketArtiBlok = yarislar.map((y) => loglossWinner(y, haricMarketArtiBlok));
      const farkMarket = yarislar.map((_, i) => llMarketOnly[i] - llMarketArtiBlok[i]); // pozitif = blok eklenince İYİLEŞTİ
      const ciMarket = bootstrapCI(farkMarket);
      satirMarket = ciMarket.nokta.toFixed(5).padStart(26) + `[${ciMarket.lo.toFixed(5)},${ciMarket.hi.toFixed(5)}]`.padStart(22);
    }
    console.log(blokAd.padEnd(14) + ciFullBlock.nokta.toFixed(5).padStart(16) + `[${ciFullBlock.lo.toFixed(5)},${ciFullBlock.hi.toFixed(5)}]`.padStart(22) + satirMarket);
  }
}

// ─── Özel tablolar ──────────────────────────────────────────────────────────

function agfUclusuOzel(yarislar: RaceRec[], sonuclar105: ÇiftSonuç[]) {
  const bos = new Set<Kod>();
  const llFull = yarislar.map((y) => loglossWinner(y, bos));
  console.log("--- AGF Üçlüsü (GLOBAL) ---");
  for (let i = 0; i < AGF_UCLUSU.length; i++) {
    for (let j = i + 1; j < AGF_UCLUSU.length; j++) {
      const s = sonuclar105.find((x) => (x.j === AGF_UCLUSU[i] && x.k === AGF_UCLUSU[j]) || (x.j === AGF_UCLUSU[j] && x.k === AGF_UCLUSU[i]))!;
      console.log(`${s.j} × ${s.k}: D_j=${s.dJ.toFixed(4)} D_k=${s.dK.toFixed(4)} D_jk=${s.dJK.toFixed(4)} E_jk=${s.eJK.nokta.toFixed(5)} GA=[${s.eJK.lo.toFixed(5)},${s.eJK.hi.toFixed(5)}]`);
    }
  }
  const haricUclu = new Set(AGF_UCLUSU);
  const farkUclu = yarislar.map((y, i) => loglossWinner(y, haricUclu) - llFull[i]);
  const ciUclu = bootstrapCI(farkUclu);
  console.log(`ÜÇÜ BİRDEN çıkarılmış: ΔLL=${ciUclu.nokta.toFixed(5)} GA=[${ciUclu.lo.toFixed(5)},${ciUclu.hi.toFixed(5)}]`);
}

function isaretliCiftlerOzel(sonuclar105: ÇiftSonuç[]) {
  console.log("\n--- İşaretli çiftler (Antrenör/Hız, A1.5 bulgularını açıklayabilir) ---");
  for (const [j, k] of IŞARETLİ_ÇİFTLER) {
    const s = sonuclar105.find((x) => (x.j === j && x.k === k) || (x.j === k && x.k === j))!;
    console.log(`${s.j.padEnd(20)} × ${s.k.padEnd(20)} D_j=${s.dJ.toFixed(4)} D_k=${s.dK.toFixed(4)} D_jk=${s.dJK.toFixed(4)} E_jk=${s.eJK.nokta.toFixed(5)} GA=[${s.eJK.lo.toFixed(5)},${s.eJK.hi.toFixed(5)}] ${anlamliMi(s.eJK) ? "★" : ""}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
