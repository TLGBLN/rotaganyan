// V5.46 KÖR NOKTA KURTARMA TESTİ — Sectional Edge adayı (2026-10-02)
//
// 2026-09-19'da AYNI gate (AGF sırası≥4 + Saf Model sırası≤3 + Final sırası≥5) ile
// Antrenör Oranı ve İdman-Jokey Uyumu aileleri TAM popülasyonda (n=1291) test edilip
// REDDEDİLMİŞTİ (bkz. proje hafızası: independent-signal-rescue-reddedildi.md) — eşik
// sıkılaştıkça gerçek kazanma oranı YÜKSELMEDİ, DÜŞTÜ. O memory'nin kendi notu: "Hız
// Derecesi/Yarış Gidişatı hiç test edilmedi" — Sectional/context-fit ailesi de bu
// kategoride, daha önce HİÇ bu gate ile test edilmedi.
//
// KRİTİK FARK (kullanıcı talimatı): 46 kazanan ata geriye dönüp ortak özellik aramak
// SURVIVORSHIP BIAS'tır (IndependentSignalRescue'nun "5 örnekten genelleme" hatasının
// büyütülmüş hali). Bu script TÜM popülasyonu (kazanan/kaybeden FARK ETMEKSİZİN, gate'e
// giren HERKESİ) kullanır.
//
// Hipotez: "Sectional AGF'siz/genel olarak işe yarıyor mu" (ÖNCEKİ test, V1/V2 — CEVAP:
// HAYIR) DEĞİL, "Sectional YALNIZ V5.46'nın AGF+SafModel'in birlikte düşük sıraladığı
// belirli kör noktasında işe yarıyor mu" (BU test).
//
// Model: S_challenger,i = log(P_V546,i) + γ·G_i·Z(SectionalEdge_i)
//   P_V546,i = Pick.scoreExact/100 (YAYINLANAN, zaten kalibre edilmiş olasılık — V5.46
//              SIFIRDAN yeniden hesaplanmadı, AYNEN kullanıldı)
//   G_i = 1[AGFRank_i≥4 ∧ SafModelRank_i≤3 ∧ FinalRank_i≥5] (AYNI gate, IndependentSignalRescue)
//   SectionalEdge = V2'nin DONDURULMUŞ formülü (HorseRelative→PaceAdjusted(a,b)→
//                   LatentAbility→Reliability→TodayPaceFit), HİÇBİR parametre bu testte
//                   değiştirilmedi/yeniden ayarlanmadı.
// γ: YALNIZ TRAIN'de fit edilir (1 parametre). DEV'de ΔLL=LL(challenger)-LL(V5.46),
// race-level bootstrap, 95% GA üst sınır<0 olmalı. Geçmezse TEST açılmaz.
//
// Kullanım: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-v546-independent-signal-rescue-sectional.mts
import { db } from "./src/lib/db";
import {
  segmentlereAyir, sahaSegmentIstatistikleri, relativeSplitSD, hesaplaGercekTempoProfili,
  type SectionalCheckpoint,
} from "./src/lib/methodology/sectional-intelligence";
import {
  analizEtTekYaris, hesaplaCokYarisEgilimi, hesaplaErkenHizYuzdelikleri, hesaplaYarisGidisati,
  type PaceCheckpoint, type AtTempoProfili, type TempoSenaryosu,
} from "./src/lib/methodology/pace-analizi";

const MIN_SAHA = 4;
const MIN_CHECKPOINTS = 8;
const B_BOOTSTRAP = 1000;
const V546_PENCERE_1 = { start: new Date("2026-09-12T10:00:00+03:00"), end: new Date("2026-09-18T22:30:00+03:00") };
const V546_PENCERE_2 = { start: new Date("2026-09-19T00:15:00+03:00"), end: new Date() };
function v546DonemindeMi(t: Date): boolean {
  return (t >= V546_PENCERE_1.start && t <= V546_PENCERE_1.end) || (t >= V546_PENCERE_2.start && t <= V546_PENCERE_2.end);
}

function normalizeName(s: string): string {
  return s.replace(/\s*\([A-ZİĞÜŞÖÇ]{2,4}\)\s*$/i, "").toLocaleUpperCase("tr-TR").replace(/I/g, "I")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}
type MesafeDilimi = "SPRINT" | "ORTA" | "UZUN";
function mesafeDilimi(d: number): MesafeDilimi { return d <= 1300 ? "SPRINT" : d <= 1900 ? "ORTA" : "UZUN"; }
function tempoZorlukAgirligi(so: Record<TempoSenaryosu, number>): number { return (so.MUCADELELI + so.COK_YUKSEK + so.DAGILMA_RISKI) / 100; }

type KaynakGirdi = {
  date: number; surface: string; dilim: MesafeDilimi; erkenSD: number | null; gecSD: number | null;
  hrEarly: number | null; hrLate: number | null; paceAdjusted: number | null;
  tekYarisSonucu: ReturnType<typeof analizEtTekYaris>; erkenHizYuzdelik: number | null;
};

async function main() {
  console.log("1/7 — V5.46 dönemi hedef yarışlar (TÜM runner'lar, kazanan/kaybeden AYRIMI YOK) kuruluyor...");
  const picks = await db.pick.findMany({
    where: {
      prediction: {
        published: true, publishedAt: { not: null },
        race: { raceDay: { hippodrome: { isForeign: false, name: { not: "Karma" } } }, result: { isNot: null } },
      },
    },
    select: {
      rank: true, scoreExact: true, marketBlindProb1: true, runnerId: true,
      prediction: {
        select: {
          publishedAt: true, raceId: true,
          race: {
            select: {
              surface: true, distance: true,
              raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
              result: { select: { winnerNos: true } },
            },
          },
        },
      },
    },
  });
  const runnerIds = [...new Set(picks.map((p) => p.runnerId).filter((x): x is string => !!x))];
  const runners = await db.runner.findMany({
    where: { id: { in: runnerIds } },
    select: { id: true, no: true, name: true, agf: true, scratched: true, ekuriGroup: true },
  });
  const runnerById = new Map(runners.map((r) => [r.id, r]));

  type HedefRunner = {
    no: number; name: string; agfRaw: number | null; scoreExactVal: number; marketBlind: number | null; finalRank: number;
  };
  type HedefYaris = { raceId: string; date: number; surface: string; distance: number; winnerNos: Set<number>; runners: HedefRunner[] };
  const byRace = new Map<string, HedefYaris>();

  for (const p of picks) {
    if (!p.prediction.publishedAt || !v546DonemindeMi(p.prediction.publishedAt)) continue;
    if (!p.runnerId) continue;
    const runner = runnerById.get(p.runnerId);
    if (!runner || runner.scratched || runner.ekuriGroup != null) continue;
    if (p.scoreExact == null) continue;
    const winnerNos = new Set(p.prediction.race.result?.winnerNos ?? []);
    if (winnerNos.size === 0) continue;

    const raceId = p.prediction.raceId;
    const y = byRace.get(raceId) ?? {
      raceId, date: p.prediction.race.raceDay.date.getTime(), surface: p.prediction.race.surface,
      distance: p.prediction.race.distance, winnerNos, runners: [],
    };
    y.runners.push({ no: runner.no, name: runner.name, agfRaw: runner.agf, scoreExactVal: p.scoreExact, marketBlind: p.marketBlindProb1, finalRank: p.rank });
    byRace.set(raceId, y);
  }
  const hedefYarislar = [...byRace.values()].filter((y) => y.runners.length >= 4).sort((a, b) => a.date - b.date);
  const nTrain = Math.floor(hedefYarislar.length * 0.6);
  const nDev = Math.floor(hedefYarislar.length * 0.2);
  const train = hedefYarislar.slice(0, nTrain);
  const dev = hedefYarislar.slice(nTrain, nTrain + nDev);
  const test = hedefYarislar.slice(nTrain + nDev);
  console.log(`   TRAIN=${train.length}  DEV=${dev.length}  TEST=${test.length}\n`);

  console.log("2/7 — Gate hesaplanıyor (AGFRank≥4 ∧ SafModelRank≤3 ∧ FinalRank≥5)...");
  type GateInfo = { agfRank: number | null; safRank: number | null; gate: boolean };
  const gateByRaceRunner = new Map<string, GateInfo>();
  let gatedToplam = 0;
  for (const y of hedefYarislar) {
    const agfSirali = [...y.runners].filter((r) => r.agfRaw != null).sort((a, b) => b.agfRaw! - a.agfRaw!);
    const agfRankByNo = new Map(agfSirali.map((r, i) => [r.no, i + 1]));
    const safSirali = [...y.runners].filter((r) => r.marketBlind != null).sort((a, b) => b.marketBlind! - a.marketBlind!);
    const safRankByNo = new Map(safSirali.map((r, i) => [r.no, i + 1]));
    for (const r of y.runners) {
      const agfRank = agfRankByNo.get(r.no) ?? null;
      const safRank = safRankByNo.get(r.no) ?? null;
      const gate = agfRank != null && safRank != null && agfRank >= 4 && safRank <= 3 && r.finalRank >= 5;
      if (gate) gatedToplam++;
      gateByRaceRunner.set(`${y.raceId}|${r.no}`, { agfRank, safRank, gate });
    }
  }
  console.log(`   Gate'e giren toplam runner: ${gatedToplam} / ${hedefYarislar.reduce((s, y) => s + y.runners.length, 0)}\n`);

  console.log("3/7 — SectionalEdge — V2'nin DONDURULMUŞ pipeline'ı (hiçbir parametre değiştirilmedi)...");
  const trainBoundaryDate = train[train.length - 1].date;
  const accRaces = await db.accuraceRace.findMany({
    select: { date: true, length: true, splits: { select: { horseName: true, checkpoints: true } }, race: { select: { surface: true } } },
  });
  const kaynakByHorse = new Map<string, KaynakGirdi[]>();
  for (const ar of accRaces) {
    if (!ar.length || !ar.race?.surface || ar.splits.length < MIN_SAHA) continue;
    const sahaSegmentleri = ar.splits.map((s) => segmentlereAyir(s.checkpoints as unknown as SectionalCheckpoint[]));
    const sahaStatleri = sahaSegmentIstatistikleri(sahaSegmentleri);
    const sahaPaceSonuclari = ar.splits.map((s) => analizEtTekYaris(s.checkpoints as unknown as PaceCheckpoint[], ar.length!, ar.splits.length));
    const gecerliSahaYuzdelik = hesaplaErkenHizYuzdelikleri(sahaPaceSonuclari.filter((s): s is NonNullable<typeof s> => s != null));
    let yi = 0;
    const dilim = mesafeDilimi(ar.length);
    for (let i = 0; i < ar.splits.length; i++) {
      const split = ar.splits[i];
      const checkpoints = split.checkpoints as unknown as SectionalCheckpoint[];
      if (checkpoints.length < MIN_CHECKPOINTS) continue;
      const tekYarisSonucu = sahaPaceSonuclari[i];
      const erkenHizYuzdelik = tekYarisSonucu ? gecerliSahaYuzdelik[yi++] : null;
      const relativeSplits = sahaSegmentleri[i].map((s) => ({ from: s.from, to: s.to, sd: relativeSplitSD(s, sahaStatleri.find((st) => st.from === s.from && st.to === s.to)) }));
      const tempoProfili = hesaplaGercekTempoProfili(relativeSplits, checkpoints, ar.length);
      const norm = normalizeName(split.horseName);
      const liste = kaynakByHorse.get(norm) ?? [];
      liste.push({ date: ar.date.getTime(), surface: ar.race.surface, dilim, erkenSD: tempoProfili.erkenGoreliTempoSD, gecSD: tempoProfili.gecGoreliTempoSD, hrEarly: null, hrLate: null, paceAdjusted: null, tekYarisSonucu, erkenHizYuzdelik });
      kaynakByHorse.set(norm, liste);
    }
  }
  for (const liste of kaynakByHorse.values()) liste.sort((a, b) => a.date - b.date);

  const MIN_SD_TABANI = 0.1;
  for (const liste of kaynakByHorse.values()) {
    const kohortGecmisi = new Map<string, { erken: number[]; gec: number[] }>();
    for (const k of liste) {
      const key = `${k.surface}|${k.dilim}`;
      const h = kohortGecmisi.get(key);
      if (h && h.erken.length >= 3) {
        const ortErken = h.erken.reduce((a, b) => a + b, 0) / h.erken.length;
        const sdErken = Math.sqrt(h.erken.reduce((s, v) => s + (v - ortErken) ** 2, 0) / h.erken.length);
        const ortGec = h.gec.reduce((a, b) => a + b, 0) / h.gec.length;
        const sdGec = Math.sqrt(h.gec.reduce((s, v) => s + (v - ortGec) ** 2, 0) / h.gec.length);
        if (k.erkenSD != null && sdErken >= MIN_SD_TABANI) k.hrEarly = (k.erkenSD - ortErken) / sdErken;
        if (k.gecSD != null && sdGec >= MIN_SD_TABANI) k.hrLate = (k.gecSD - ortGec) / sdGec;
      }
      if (k.erkenSD != null && k.gecSD != null) {
        const yeni = kohortGecmisi.get(key) ?? { erken: [], gec: [] };
        yeni.erken.push(k.erkenSD); yeni.gec.push(k.gecSD);
        kohortGecmisi.set(key, yeni);
      }
    }
  }
  const trainCiftler: { x: number; y: number }[] = [];
  for (const liste of kaynakByHorse.values()) for (const k of liste) {
    if (k.date < trainBoundaryDate && k.hrEarly != null && k.hrLate != null && Math.abs(k.hrEarly) <= 10 && Math.abs(k.hrLate) <= 10) trainCiftler.push({ x: k.hrEarly, y: k.hrLate });
  }
  const { a, b } = olsFit(trainCiftler);
  console.log(`   PaceAdjusted OLS: a=${fmt(a)} b=${fmt(b)} (n=${trainCiftler.length}) — V2 ile AYNI olmalı (aynı veri, aynı prosedür)`);
  for (const liste of kaynakByHorse.values()) for (const k of liste) {
    if (k.hrEarly != null && k.hrLate != null && Math.abs(k.hrEarly) <= 10 && Math.abs(k.hrLate) <= 10) k.paceAdjusted = k.hrLate - (a + b * k.hrEarly);
  }

  console.log("\n4/7 — Her hedef yarış-runner için SectionalEdge hesaplanıyor (point-in-time)...");
  const edgeByRaceRunner = new Map<string, number>();
  let islenen = 0;
  for (const y of hedefYarislar) {
    const dilim = mesafeDilimi(y.distance);
    const profiller: (AtTempoProfili | null)[] = y.runners.map((r) => {
      const norm = normalizeName(r.name);
      const gecmis = (kaynakByHorse.get(norm) ?? []).filter((k) => k.date < y.date && k.tekYarisSonucu != null);
      if (gecmis.length < 3) return null;
      const egilim = hesaplaCokYarisEgilimi(gecmis.map((k) => k.tekYarisSonucu!), gecmis.map((k) => k.erkenHizYuzdelik));
      return egilim ? { dagilim: egilim.dagilim, erkenHizGucu: egilim.erkenHizGucu, n: egilim.n } : null;
    });
    const gidisat = hesaplaYarisGidisati(profiller, y.distance);
    const zorluk = tempoZorlukAgirligi(gidisat.senaryoOlasiliklari);
    y.runners.forEach((r) => {
      const norm = normalizeName(r.name);
      const kohortGecmis = (kaynakByHorse.get(norm) ?? []).filter((k) => k.date < y.date && k.surface === y.surface && k.dilim === dilim && k.paceAdjusted != null).slice(-3);
      const n = kohortGecmis.length;
      let latentAbility = 0, consistencyFactor = 1;
      if (n > 0) {
        const degerler = kohortGecmis.map((k) => k.paceAdjusted!);
        latentAbility = degerler.reduce((s, v) => s + v, 0) / n;
        if (n >= 2) { const sd = Math.sqrt(degerler.reduce((s, v) => s + (v - latentAbility) ** 2, 0) / n); consistencyFactor = 1 / (1 + sd); }
      }
      const reliability = Math.min(n / 3, 1) * consistencyFactor;
      edgeByRaceRunner.set(`${y.raceId}|${r.no}`, latentAbility * zorluk * reliability);
    });
    islenen++;
    if (islenen % 1000 === 0) console.log(`   ${islenen}/${hedefYarislar.length}...`);
  }
  console.log(`   Tamamlandı.\n`);

  console.log("5/7 — TRAIN standardizasyonu + γ fit (TEK parametre, YALNIZ gate içinde aktif)...");
  const trainEdge = train.flatMap((y) => y.runners.map((r) => edgeByRaceRunner.get(`${y.raceId}|${r.no}`)!));
  const edgeOrt = trainEdge.reduce((a2, b2) => a2 + b2, 0) / trainEdge.length;
  const edgeSD = Math.sqrt(trainEdge.reduce((s, v) => s + (v - edgeOrt) ** 2, 0) / trainEdge.length) || 1;
  const Z = (raceId: string, no: number) => (edgeByRaceRunner.get(`${raceId}|${no}`)! - edgeOrt) / edgeSD;
  const G = (raceId: string, no: number) => (gateByRaceRunner.get(`${raceId}|${no}`)?.gate ? 1 : 0);

  const gamma = fit1D(train, G, Z);
  console.log(`   γ (TRAIN) = ${fmt(gamma)}\n`);

  console.log("6/7 — DEV testi: ΔLL(challenger-V5.46), race-level bootstrap...");
  const devSonuc = deltaLLBootstrap(dev, G, Z, gamma);
  const gecti = devSonuc.lo != null && devSonuc.hi != null && devSonuc.hi < 0;
  console.log(`   DEV ΔLL = ${fmt(devSonuc.nokta)}  95% GA=[${fmt(devSonuc.lo)}, ${fmt(devSonuc.hi)}]  ${gecti ? "★ GEÇTİ" : "(geçmedi)"}\n`);

  if (gecti) {
    console.log("TEST (kilitli) açılıyor...");
    const gammaFinal = fit1D([...train, ...dev], G, Z);
    const testSonuc = deltaLLBootstrap(test, G, Z, gammaFinal);
    const testGecti = testSonuc.lo != null && testSonuc.hi != null && testSonuc.hi < 0;
    console.log(`   γ(TRAIN+DEV)=${fmt(gammaFinal)}  TEST ΔLL=${fmt(testSonuc.nokta)}  95% GA=[${fmt(testSonuc.lo)}, ${fmt(testSonuc.hi)}]  ${testGecti ? "★★ DOĞRULANDI" : "(doğrulanmadı)"}\n`);
  } else {
    console.log("TEST açılmadı (DEV geçilemedi).\n");
  }

  console.log("7/7 — Operasyonel metrikler (γ'dan BAĞIMSIZ, yalnız Z-sıralaması ile)...\n");
  raporlaOperasyonel("TRAIN", train, G, Z);
  raporlaOperasyonel("DEV", dev, G, Z);
  raporlaOperasyonel("TEST", test, G, Z);

  console.log("\n--- Gate içindeki SectionalEdge (Z) dağılımı: kazananlar vs kaybedenler ---");
  for (const [ad, set] of [["TRAIN", train], ["DEV", dev]] as const) {
    const kazanan: number[] = [], kaybeden: number[] = [];
    for (const y of set) for (const r of y.runners) {
      if (!G(y.raceId, r.no)) continue;
      (y.winnerNos.has(r.no) ? kazanan : kaybeden).push(Z(y.raceId, r.no));
    }
    const ort = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : NaN);
    console.log(`${ad}: kazanan n=${kazanan.length} ort.Z=${fmt(ort(kazanan))}  |  kaybeden n=${kaybeden.length} ort.Z=${fmt(ort(kaybeden))}`);
  }
}

function raporlaOperasyonel(ad: string, yarislar: any[], G: (r: string, n: number) => number, Z: (r: string, n: number) => number) {
  let gatedYarisSayisi = 0, rescue1 = 0, rescue2 = 0, ilk6DisiKazananSayisi = 0, rescueIleYakalanan = 0;
  for (const y of yarislar) {
    const gatedRunners = y.runners.filter((r: any) => G(y.raceId, r.no) === 1);
    const kazananDisarida = y.runners.some((r: any) => y.winnerNos.has(r.no) && r.finalRank > 6);
    if (kazananDisarida) ilk6DisiKazananSayisi++;
    if (gatedRunners.length === 0) continue;
    gatedYarisSayisi++;
    const siraliZ = [...gatedRunners].sort((a: any, b: any) => Z(y.raceId, b.no) - Z(y.raceId, a.no));
    const top1 = siraliZ[0];
    const top2 = siraliZ.slice(0, 2);
    if (y.winnerNos.has(top1.no)) rescue1++;
    if (top2.some((r: any) => y.winnerNos.has(r.no))) rescue2++;
    if (kazananDisarida && y.winnerNos.has(top1.no)) rescueIleYakalanan++;
  }
  console.log(`${ad}: gate'e giren yarış=${gatedYarisSayisi}  Rescue@1=${rescue1} (%${gatedYarisSayisi ? ((rescue1 / gatedYarisSayisi) * 100).toFixed(1) : "?"})  Rescue@2=${rescue2} (%${gatedYarisSayisi ? ((rescue2 / gatedYarisSayisi) * 100).toFixed(1) : "?"})  |  ilk6-dışı kazanan=${ilk6DisiKazananSayisi}, +1 rescue ile yakalanan=${rescueIleYakalanan} (%${ilk6DisiKazananSayisi ? ((rescueIleYakalanan / ilk6DisiKazananSayisi) * 100).toFixed(1) : "?"})`);
}

function olsFit(ciftler: { x: number; y: number }[]): { a: number; b: number } {
  const n = ciftler.length;
  if (n < 10) return { a: 0, b: 0 };
  const mx = ciftler.reduce((s, c) => s + c.x, 0) / n, my = ciftler.reduce((s, c) => s + c.y, 0) / n;
  let sxy = 0, sxx = 0;
  for (const c of ciftler) { sxy += (c.x - mx) * (c.y - my); sxx += (c.x - mx) ** 2; }
  const bb = sxx > 0 ? sxy / sxx : 0;
  return { a: my - bb * mx, b: bb };
}

function skorlar(y: any, G: (r: string, n: number) => number, Z: (r: string, n: number) => number, gamma: number): number[] {
  return y.runners.map((r: any) => Math.log(Math.max(r.scoreExactVal / 100, 1e-6)) + gamma * G(y.raceId, r.no) * Z(y.raceId, r.no));
}
function logSoftmaxKazanan(y: any, sk: number[]): number | null {
  const idx = y.runners.findIndex((r: any) => y.winnerNos.has(r.no));
  if (idx < 0) return null;
  const mx = Math.max(...sk);
  const lse = mx + Math.log(sk.reduce((s, v) => s + Math.exp(v - mx), 0));
  return sk[idx] - lse;
}
function raceLogLikToplam(yarislar: any[], G: any, Z: any, gamma: number): number {
  let t = 0;
  for (const y of yarislar) { const lp = logSoftmaxKazanan(y, skorlar(y, G, Z, gamma)); if (lp != null) t += lp; }
  return t;
}
function fit1D(train: any[], G: any, Z: any): number {
  let merkez = 0, aralik = 3, adim = 0.25;
  for (let tur = 0; tur < 4; tur++) {
    let enIyi = merkez, enIyiLL = -Infinity;
    for (let g = merkez - aralik; g <= merkez + aralik + 1e-9; g += adim) {
      const ll = raceLogLikToplam(train, G, Z, g);
      if (ll > enIyiLL) { enIyiLL = ll; enIyi = g; }
    }
    merkez = enIyi; aralik = adim * 2; adim = adim / 10;
  }
  return Math.round(merkez * 10000) / 10000;
}
function deltaLLBootstrap(yarislar: any[], G: any, Z: any, gamma: number, B = B_BOOTSTRAP): { nokta: number | null; lo: number | null; hi: number | null } {
  const farklar: number[] = [];
  for (const y of yarislar) {
    const idx = y.runners.findIndex((r: any) => y.winnerNos.has(r.no));
    if (idx < 0) continue;
    const logPBase = logSoftmaxKazanan(y, skorlar(y, G, Z, 0));
    const logPChal = logSoftmaxKazanan(y, skorlar(y, G, Z, gamma));
    if (logPBase == null || logPChal == null) continue;
    farklar.push(-logPChal - -logPBase);
  }
  if (farklar.length < 5) return { nokta: null, lo: null, hi: null };
  const nokta = farklar.reduce((a, b) => a + b, 0) / farklar.length;
  const dagilim: number[] = [];
  for (let i = 0; i < B; i++) { let t = 0; for (let j = 0; j < farklar.length; j++) t += farklar[Math.floor(Math.random() * farklar.length)]; dagilim.push(t / farklar.length); }
  dagilim.sort((a, b) => a - b);
  return { nokta, lo: dagilim[Math.floor(dagilim.length * 0.025)], hi: dagilim[Math.floor(dagilim.length * 0.975)] };
}
function fmt(v: number | null): string { return v == null || Number.isNaN(v) ? "?" : v.toFixed(5); }

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
