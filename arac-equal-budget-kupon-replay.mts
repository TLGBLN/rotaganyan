// EQUAL-BUDGET KUPON REPLAY — 2026-09-17, V5.46/gerçek kupon verisine YAZMAZ, salt gözlem.
// Amaç: A (tek-slot, mevcut) vs B (çoklu-slot, nitelikli tüm adaylar) — coverage-only
// testin GÖREMEDİĞİ asıl soru: B, Normal/Geniş kademede admin'in GERÇEK davranışı taklit
// edildiğinde daha çok isabet ediyor mu, maliyeti ne kadar artırıyor?
//
// METODOLOJİ (kullanıcı kararı, 2026-09-17):
// - Ekonomik (narrow) KORUNUR, B hiç dokunmaz — yalnız Normal/Geniş test edilir.
// - "Admin ekstra atı hangi kademeye eklerdi" sorusu AMPİRİK öğrenilir: P(Normal'e dahil|
//   karar) ve P(Geniş'e dahil|karar) oranları YALNIZ TRAIN döneminden (kronolojik ilk %75
//   HomeKupon) hesaplanır, TEST/OOS döneminde (son %25) DONDURULMUŞ olarak uygulanır —
//   test verisine bakarak kural uydurma (leakage) YOK.
// - karar etiketi zaten yarıştan ÖNCE (canlı yayın anında) üretiliyor — bu yüzden
//   deterministic "ekle" kuralına gerek yok, ampirik oran güvenle kullanılabilir.
// - Rate, Monte Carlo ile uygulanır (B_MC tekrar, ortalama al) — kesirli "0.72 at" diye
//   bir şey yok, her tekrarda coin-flip'le dahil/hariç kararı verilir.
//
// Çalıştırma:
//   node --env-file=.env node_modules/tsx/dist/cli.mjs arac-equal-budget-kupon-replay.mts
import { db } from "./src/lib/db";
import { startOfDay, endOfDay } from "date-fns";
import { gatherFaz1V5Historical, faz2V5Sirala, AGF_KATKI_INDEKSLERI } from "./src/lib/methodology/v5-engine";

const SAF_MODEL_DEGER_ESIGI = 5;
const ALTILI_STAKE = 1.25;
const YEDILI_STAKE = 2;
const DUSUK_UCRETLI_HIPODROMLAR = ["Diyarbakır", "Şanlıurfa", "Elazığ"];
const MC = 200;

function stakeFor(hippodromeName: string): number {
  if (hippodromeName.includes("7'li Ganyan")) return YEDILI_STAKE;
  return DUSUK_UCRETLI_HIPODROMLAR.some((h) => hippodromeName.includes(h)) ? 1 : ALTILI_STAKE;
}
function kuponTutar(nosPerLeg: number[][], stake: number): number {
  const komb = nosPerLeg.reduce((a, nos) => a * Math.max(nos.length, 1), 1);
  return komb * stake;
}
function nonAgfKatkiToplami(katkilar: number[]): number {
  return katkilar.reduce((t, k, i) => (AGF_KATKI_INDEKSLERI.includes(i) ? t : t + k), 0);
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

type HomeKuponLeg = { raceNo: number; narrow: number[]; normal: number[]; wide: number[] };
type RaceInfo = {
  raceId: string;
  runners: { no: number; karar: string; nitelikli: boolean; winner: boolean }[];
};

async function resolveRaces(hippodromeName: string, date: Date, legs: HomeKuponLeg[]): Promise<Map<number, RaceInfo> | null> {
  const baseName = hippodromeName.split(" — ")[0];
  const races = await db.race.findMany({
    where: {
      raceNo: { in: legs.map((l) => l.raceNo) },
      raceDay: { date: { gte: startOfDay(date), lte: endOfDay(date) }, hippodrome: { name: baseName } },
    },
    select: { id: true, raceNo: true, result: { select: { winnerNos: true } } },
  });
  if (races.length !== legs.length) {
    if (process.env.DEBUG_REPLAY === "1") console.log(`  [debug] eşleşmedi: ${hippodromeName} ${date.toISOString().slice(0,10)} — beklenen ${legs.length} koşu, bulunan ${races.length}`);
    return null;
  }

  const map = new Map<number, RaceInfo>();
  for (const race of races) {
    if (!race.result) return null;
    const faz1 = await gatherFaz1V5Historical(race.id);
    if (!faz1 || faz1.runners.length < 2) return null;
    const sirali = faz2V5Sirala(faz1);
    const winnerNos = race.result.winnerNos;
    const runners = sirali.map((r, i) => ({
      no: r.no,
      karar: r.karar,
      nitelikli: i >= 6 && !r.ekuriIlk6Efektif && (r.marketBlindProb1 * 100 - r.agfPayi) >= SAF_MODEL_DEGER_ESIGI && nonAgfKatkiToplami(r.katkilar) > 0,
      winner: winnerNos.includes(r.no),
    }));
    map.set(race.raceNo, { raceId: race.id, runners });
  }
  return map;
}

async function main() {
  const all = await db.homeKupon.findMany({ orderBy: [{ date: "asc" }, { updatedAt: "asc" }] });
  const seen = new Set<string>();
  const dedup = all.filter((k) => {
    const key = `${k.hippodromeName}|${k.date.toISOString()}|${k.slot}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  console.log(`${dedup.length} tekil HomeKupon kaydı (kronolojik).\n`);

  const splitIdx = Math.floor(dedup.length * 0.75);
  const trainRaw = dedup.slice(0, splitIdx);
  const testRaw = dedup.slice(splitIdx);
  console.log(`TRAIN: ${trainRaw.length}, TEST: ${testRaw.length}\n`);

  // ── TRAIN: ampirik P(Normal'e dahil|karar), P(Geniş'e dahil|karar) öğren ──
  const kararSayaclari = new Map<string, { normalN: number; normalDahil: number; wideN: number; wideDahil: number }>();
  let trainIslenen = 0;
  for (const k of trainRaw) {
    const legs = k.legs as unknown as HomeKuponLeg[];
    if (!Array.isArray(legs) || legs.length === 0) continue;
    const raceMap = await resolveRaces(k.hippodromeName, k.date, legs);
    if (!raceMap) continue;
    trainIslenen++;
    for (const leg of legs) {
      const info = raceMap.get(leg.raceNo);
      if (!info) continue;
      for (const r of info.runners) {
        const s = kararSayaclari.get(r.karar) ?? { normalN: 0, normalDahil: 0, wideN: 0, wideDahil: 0 };
        // Yalnız admin'in GERÇEKTEN o kademeyi doldurduğu (leg.normal/wide boş değil) yarışlarda say
        if (leg.normal.length > 0) { s.normalN++; if (leg.normal.includes(r.no)) s.normalDahil++; }
        if (leg.wide.length > 0) { s.wideN++; if (leg.wide.includes(r.no)) s.wideDahil++; }
        kararSayaclari.set(r.karar, s);
      }
    }
  }
  console.log(`TRAIN'de işlenen HomeKupon: ${trainIslenen}/${trainRaw.length}\n`);
  console.log("── Ampirik oranlar (TRAIN, DONDURULACAK) ──");
  const oranlar = new Map<string, { pNormal: number; pWide: number }>();
  for (const [karar, s] of kararSayaclari) {
    const pNormal = s.normalN > 0 ? s.normalDahil / s.normalN : 0;
    const pWide = s.wideN > 0 ? s.wideDahil / s.wideN : 0;
    oranlar.set(karar, { pNormal, pWide });
    console.log(`  ${karar}: P(Normal'e dahil)=%${(pNormal * 100).toFixed(1)} (n=${s.normalN}), P(Geniş'e dahil)=%${(pWide * 100).toFixed(1)} (n=${s.wideN})`);
  }

  // ── TEST: replay ──
  console.log(`\n── TEST replay (Monte Carlo B_MC=${MC}) ──`);
  let testIslenen = 0;
  let a_normalHit = 0, a_wideHit = 0;
  let b_normalHitSum = 0, b_wideHitSum = 0;
  let a_normalMaliyet = 0, a_wideMaliyet = 0;
  let b_normalMaliyetSum = 0, b_wideMaliyetSum = 0;
  const rng = mulberry32(5462026);

  for (const k of testRaw) {
    const legs = k.legs as unknown as HomeKuponLeg[];
    if (!Array.isArray(legs) || legs.length === 0) continue;
    const raceMap = await resolveRaces(k.hippodromeName, k.date, legs);
    if (!raceMap) continue;
    const hasNormal = legs.some((l) => l.normal.length > 0);
    const hasWide = legs.some((l) => l.wide.length > 0);
    if (!hasNormal && !hasWide) continue;
    testIslenen++;
    const stake = stakeFor(k.hippodromeName);

    // A: gerçek geçmiş seçim (fallback: normal boşsa narrow, wide boşsa normal/narrow — üretim kuralı)
    const normalLegsA = legs.map((l) => (l.normal.length > 0 ? l.normal : l.narrow));
    const wideLegsA = legs.map((l) => (l.wide.length > 0 ? l.wide : l.normal.length > 0 ? l.normal : l.narrow));
    const winnerByLeg = legs.map((l) => raceMap.get(l.raceNo)!.runners.filter((r) => r.winner).map((r) => r.no));
    const aNormalHit = winnerByLeg.every((wns, i) => wns.some((w) => normalLegsA[i].includes(w)));
    const aWideHit = winnerByLeg.every((wns, i) => wns.some((w) => wideLegsA[i].includes(w)));
    if (hasNormal) { if (aNormalHit) a_normalHit++; a_normalMaliyet += kuponTutar(normalLegsA, stake); }
    if (hasWide) { if (aWideHit) a_wideHit++; a_wideMaliyet += kuponTutar(wideLegsA, stake); }

    // B: nitelikli ekstra atlar TRAIN oranlarıyla Monte Carlo dahil edilir
    let bNormalHitSayisi = 0, bWideHitSayisi = 0, bNormalMaliyetToplam = 0, bWideMaliyetToplam = 0;
    for (let mc = 0; mc < MC; mc++) {
      const normalLegsB = legs.map((l, i) => {
        const base = l.normal.length > 0 ? [...l.normal] : [...l.narrow];
        const info = raceMap.get(l.raceNo)!;
        for (const r of info.runners) {
          if (r.nitelikli && !base.includes(r.no)) {
            const oran = oranlar.get("Düşük Risk")?.pNormal ?? 0; // yeni-nitelikli -> Düşük Risk'e reclassify edilir
            if (rng() < oran) base.push(r.no);
          }
        }
        return base;
      });
      const wideLegsB = legs.map((l, i) => {
        const base = l.wide.length > 0 ? [...l.wide] : l.normal.length > 0 ? [...l.normal] : [...l.narrow];
        const info = raceMap.get(l.raceNo)!;
        for (const r of info.runners) {
          if (r.nitelikli && !base.includes(r.no)) {
            const oran = oranlar.get("Düşük Risk")?.pWide ?? 0;
            if (rng() < oran) base.push(r.no);
          }
        }
        return base;
      });
      if (hasNormal) {
        if (winnerByLeg.every((wns, i) => wns.some((w) => normalLegsB[i].includes(w)))) bNormalHitSayisi++;
        bNormalMaliyetToplam += kuponTutar(normalLegsB, stake);
      }
      if (hasWide) {
        if (winnerByLeg.every((wns, i) => wns.some((w) => wideLegsB[i].includes(w)))) bWideHitSayisi++;
        bWideMaliyetToplam += kuponTutar(wideLegsB, stake);
      }
    }
    if (hasNormal) { b_normalHitSum += bNormalHitSayisi / MC; b_normalMaliyetSum += bNormalMaliyetToplam / MC; }
    if (hasWide) { b_wideHitSum += bWideHitSayisi / MC; b_wideMaliyetSum += bWideMaliyetToplam / MC; }
  }

  console.log(`TEST işlenen HomeKupon: ${testIslenen}/${testRaw.length}\n`);
  const normalN = testRaw.length; // yaklaşık — asıl kesin sayaç aşağıda hasNormal/hasWide ile filtrelendi ama toplamda testIslenen kullanılabilir
  console.log("── NORMAL kademe ──");
  console.log(`  A isabet: ${a_normalHit}, B isabet (ort.): ${b_normalHitSum.toFixed(1)}`);
  console.log(`  A toplam maliyet: ${a_normalMaliyet.toFixed(2)} ₺, B toplam maliyet (ort.): ${b_normalMaliyetSum.toFixed(2)} ₺ (Δ%${((b_normalMaliyetSum / a_normalMaliyet - 1) * 100).toFixed(1)})`);
  console.log("── GENİŞ kademe ──");
  console.log(`  A isabet: ${a_wideHit}, B isabet (ort.): ${b_wideHitSum.toFixed(1)}`);
  console.log(`  A toplam maliyet: ${a_wideMaliyet.toFixed(2)} ₺, B toplam maliyet (ort.): ${b_wideMaliyetSum.toFixed(2)} ₺ (Δ%${((b_wideMaliyetSum / a_wideMaliyet - 1) * 100).toFixed(1)})`);
  console.log(`\nNOT: Bu "doğal maliyet" testi (Test A) — B'nin isabeti artırırken maliyeti de artırdığı senaryo.`);
  console.log(`Gerçek EQUAL-BUDGET testi (Test B, aynı ₺'de A vs B) için B'nin maliyet artışını dengelemek üzere`);
  console.log(`admin'in BAŞKA bir şeyi kısacağı bir "drop kuralı" gerekir — böyle bir kural mevcut kodda YOK,`);
  console.log(`icat edilmeden burada uygulanmadı.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
