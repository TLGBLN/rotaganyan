// TR Accurace Sectional Intelligence V2 — LOW-PARAMETER CONDITIONAL ABILITY (2026-10-02)
//
// V1 (bkz. arac-sectional-incremental-value-test.mts + arac-sectional-interaction-test.mts)
// "son yarışın HAM sectional değeri" ile test etti — 8 tekil özellik + 4 etkileşim hiçbiri
// AGF'yi geçemedi. Kullanıcı hipotezi: asıl bilgi HAM son-koşu değerinde değil, atın
// TEKRARLANABİLİR sectional kabiliyetinde + bunun BUGÜNKÜ yarışa taşınabilirliğinde.
//
// Kullanıcının kesinleştirdiği mimari — "Low-Parameter Conditional Ability": kavram
// korunuyor ama veriden ÖĞRENİLEN parametre sayısı V1 ile AYNI disiplinde (3) tutuluyor:
//   HorseRelative     : atın KENDİ (yüzey+mesafe-dilimi) kohortuna göre z-normalize — 0 param
//   PaceAdjusted      : HR_late = a + b·HR_early (TEK global OLS, TRAIN-dönemi kaynak
//                       yarışlarıyla fit), residual = PaceAdjustedPerformance          — 2 param (a,b)
//   LatentAbility     : hedef yarışın (yüzey,mesafe-dilimi) kohortuna uyan SON 3 kaynak
//                       yarışın ortalama PaceAdjustedPerformance'ı                     — 0 param
//   Consistency/N     : deterministik Reliability = min(N/3,1) × 1/(1+SD(son3))        — 0 param
//   ContextSimilarity : ayrı ağırlık YOK — "aynı yüzey + aynı mesafe dilimi" zaten SERT
//                       kohort filtresi olarak LatentAbility'nin içine gömülü           — 0 param
//   TodayPaceFit      : bugünkü yarışın beklenen tempo ZORLUĞU (tempoZorlukAgirligi,
//                       race-level, atın KENDİSİNE özel değil — M1'deki at-özel
//                       TodayPaceScore'dan BİLİNÇLİ OLARAK FARKLI bir büyüklük, aksi halde
//                       aynı bilgiyi iki kez saymış oluruz)                             — 0 param
//   Final             : SectionalEdge = LatentAbility × TodayPaceFit × Reliability,
//                       TRAIN'de standardize edilip TEK γ ile modele girer             — 1 param
//
// NESTED BASELINE (kullanıcının kritik düzeltmesi — confound kontrolü):
//   M1 = log(AGF) + δ·TodayPaceScore       (TodayPaceScore = mevcut CANLI "Yarış Gidişatı"
//                                            sinyalinin point-in-time yeniden-hesabı)
//   M2 = log(AGF) + δ'·TodayPaceScore + γ·Z(SectionalEdge)
//   Asıl test: ΔLL = LL(M2) - LL(M1) (DEV'de, race-level bootstrap, 95% GA üst sınır <0)
// Böylece SectionalEdge'in kazancı varsa bunun TodayPaceScore'un KENDİSİNDEN değil,
// GERÇEKTEN yeni bir bilgiden geldiği garanti edilir.
//
// LEAK GÜVENLİĞİ DOĞRULANDI: arac-tam-at-inceleme.mts'in Runner.raceStyle'ı DOĞRUDAN
// okuduğu görüldü — bu alan GERİYE DÖNÜK güncellenebiliyor (updateRaceStyleForHorseNames),
// bu yüzden burada KULLANILMADI. TodayPaceScore/TodayPaceFit için gereken stil dağılımı
// HER hedef yarış için SIFIRDAN, yalnız o tarihten ÖNCEKİ Accurace kayıtlarından
// (analizEtTekYaris + hesaplaCokYarisEgilimi + hesaplaErkenHizYuzdelikleri saf
// fonksiyonlarıyla) yeniden hesaplanıyor.
//
// Aynı TRAIN(60%)/DEV(20%)/TEST(20%, kilitli) kronolojik bölüm, aynı filtreler
// (scratched=false, ekuriGroup=null, agf dolu, Result var, TR) — önceki iki scriptle BİREBİR.
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

function normalizeName(s: string): string {
  return s.replace(/\s*\([A-ZİĞÜŞÖÇ]{2,4}\)\s*$/i, "").toLocaleUpperCase("tr-TR").replace(/I/g, "I")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

type MesafeDilimi = "SPRINT" | "ORTA" | "UZUN";
function mesafeDilimi(d: number): MesafeDilimi {
  if (d <= 1300) return "SPRINT";
  if (d <= 1900) return "ORTA";
  return "UZUN";
}

type KaynakGirdi = {
  date: number;
  surface: string;
  dilim: MesafeDilimi;
  erkenSD: number | null;
  gecSD: number | null;
  hrEarly: number | null;
  hrLate: number | null;
  paceAdjusted: number | null; // (a,b) fit edildikten SONRA doldurulur
  tekYarisSonucu: ReturnType<typeof analizEtTekYaris>;
  erkenHizYuzdelik: number | null;
};

async function main() {
  console.log("1/6 — Hedef yarışlar kuruluyor (önceki iki scriptle AYNI filtre/bölüm)...");
  const runners = await db.runner.findMany({
    where: { scratched: false, ekuriGroup: null, agf: { not: null }, race: { raceDay: { hippodrome: { isForeign: false } } } },
    select: { name: true, no: true, agf: true, raceId: true, race: { select: { raceDay: { select: { date: true } } } } },
  });
  const raceIds = [...new Set(runners.map((r) => r.raceId))];
  const results = await db.result.findMany({ where: { raceId: { in: raceIds } }, select: { raceId: true, winnerNos: true } });
  const winnerByRace = new Map(results.map((r) => [r.raceId, new Set(r.winnerNos)]));
  const runnersByRace = new Map<string, typeof runners>();
  for (const r of runners) { const l = runnersByRace.get(r.raceId) ?? []; l.push(r); runnersByRace.set(r.raceId, l); }

  type HedefRunner = { no: number; name: string; agfRaw: number };
  type HedefYaris = { raceId: string; date: number; distance: number; surface: string; winnerNos: Set<number>; runners: HedefRunner[] };

  const raceMeta = await db.race.findMany({ where: { id: { in: raceIds } }, select: { id: true, surface: true, distance: true } });
  const metaByRaceId = new Map(raceMeta.map((r) => [r.id, r]));

  const hedefYarislar: HedefYaris[] = [];
  for (const [raceId, rs] of runnersByRace) {
    const kazananlar = winnerByRace.get(raceId);
    const meta = metaByRaceId.get(raceId);
    if (!kazananlar || kazananlar.size === 0 || rs.length < 4 || !meta) continue;
    hedefYarislar.push({
      raceId, date: rs[0].race.raceDay.date.getTime(), distance: meta.distance, surface: meta.surface, winnerNos: kazananlar,
      runners: rs.map((r) => ({ no: r.no, name: r.name, agfRaw: r.agf! })),
    });
  }
  hedefYarislar.sort((a, b) => a.date - b.date);
  const nTrain = Math.floor(hedefYarislar.length * 0.6);
  const nDev = Math.floor(hedefYarislar.length * 0.2);
  const train = hedefYarislar.slice(0, nTrain);
  const dev = hedefYarislar.slice(nTrain, nTrain + nDev);
  const test = hedefYarislar.slice(nTrain + nDev);
  const trainBoundaryDate = train[train.length - 1].date;
  console.log(`   TRAIN=${train.length}  DEV=${dev.length}  TEST=${test.length}  (TRAIN sınır tarihi=${new Date(trainBoundaryDate).toISOString().slice(0, 10)})\n`);

  console.log("2/6 — Her Accurace kaynak yarışı için ham sectional + pace-sonuç hesaplanıyor...");
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

      const relativeSplits = sahaSegmentleri[i].map((s) => ({
        from: s.from, to: s.to, sd: relativeSplitSD(s, sahaStatleri.find((st) => st.from === s.from && st.to === s.to)),
      }));
      const tempoProfili = hesaplaGercekTempoProfili(relativeSplits, checkpoints, ar.length);

      const norm = normalizeName(split.horseName);
      const liste = kaynakByHorse.get(norm) ?? [];
      liste.push({
        date: ar.date.getTime(), surface: ar.race.surface, dilim,
        erkenSD: tempoProfili.erkenGoreliTempoSD, gecSD: tempoProfili.gecGoreliTempoSD,
        hrEarly: null, hrLate: null, paceAdjusted: null, tekYarisSonucu, erkenHizYuzdelik,
      });
      kaynakByHorse.set(norm, liste);
    }
  }
  for (const liste of kaynakByHorse.values()) liste.sort((a, b) => a.date - b.date);
  console.log(`   ${kaynakByHorse.size} farklı at için kaynak geçmiş hazır.\n`);

  console.log("3/6 — HorseRelative (kendi kohort-normu) sıralı/kademeli hesaplanıyor...");
  // Her at için KENDİ (surface,dilim) kohortundaki GEÇMİŞ (yalnız bu noktadan ÖNCEKİ)
  // erken/geç SD değerlerine göre z-normalize — kademeli (running) hesap, leak-free.
  for (const liste of kaynakByHorse.values()) {
    const kohortGecmisi = new Map<string, { erken: number[]; gec: number[] }>();
    for (const k of liste) {
      const key = `${k.surface}|${k.dilim}`;
      const h = kohortGecmisi.get(key);
      // MIN_SD_TABANI: n küçükken (özellikle n=2-3) SD tesadüfen sıfıra çok yakın çıkabilir
      // (iki geçmiş değer tesadüfen neredeyse eşit olabilir) — bu durumda bölme, anlamsız
      // derecede büyük bir z-skoru üretir (gerçek bir sinyal değil, sayısal kazadır). SD'nin
      // kendisi zaten saha-içi SD birimi olduğu için (tipik aralık ~0.3-2), 0.1 altı bir
      // kohort-içi SD'yi "yeterince ayrışmamış" sayıp HR hesaplanmıyor (null kalır).
      const MIN_SD_TABANI = 0.1;
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

  console.log("4/6 — PaceAdjusted: TEK global OLS (HR_late ~ a+b·HR_early), YALNIZ TRAIN-dönemi kaynak verisiyle fit...");
  const trainCiftler: { x: number; y: number }[] = [];
  for (const liste of kaynakByHorse.values()) {
    for (const k of liste) {
      // |z|>10 fiziksel olarak anlamsız (MIN_SD_TABANI'na rağmen sızabilecek nadir bir
      // sayısal aşırı değere karşı ikinci savunma hattı) — OLS tek bir aşırı değere çok
      // duyarlı olduğu için bu güvenlik ağı olmadan tüm fit bozulabilir.
      if (k.date < trainBoundaryDate && k.hrEarly != null && k.hrLate != null && Math.abs(k.hrEarly) <= 10 && Math.abs(k.hrLate) <= 10) {
        trainCiftler.push({ x: k.hrEarly, y: k.hrLate });
      }
    }
  }
  const { a, b } = olsFit(trainCiftler);
  console.log(`   a=${fmt(a)}  b=${fmt(b)}  (n=${trainCiftler.length} TRAIN-dönemi çift)`);
  for (const liste of kaynakByHorse.values()) {
    for (const k of liste) {
      if (k.hrEarly != null && k.hrLate != null && Math.abs(k.hrEarly) <= 10 && Math.abs(k.hrLate) <= 10) {
        k.paceAdjusted = k.hrLate - (a + b * k.hrEarly);
      }
    }
  }

  console.log("\n5/6 — Her hedef yarış için SectionalEdge + TodayPaceScore hesaplanıyor (point-in-time)...");
  type HedefOzellik = { sectionalEdgeRaw: number; todayPaceScore: number };
  const ozellikByRaceRunner = new Map<string, HedefOzellik>(); // key: raceId|no

  let islenen = 0;
  for (const y of hedefYarislar) {
    const dilim = mesafeDilimi(y.distance);
    const atIsimleri = y.runners.map((r) => r.name);

    // TodayPaceScore (M1) — point-in-time AtTempoProfili, Runner.raceStyle KULLANILMADI.
    const profiller: (AtTempoProfili | null)[] = y.runners.map((r) => {
      const norm = normalizeName(r.name);
      const gecmis = (kaynakByHorse.get(norm) ?? []).filter((k) => k.date < y.date && k.tekYarisSonucu != null);
      if (gecmis.length < 3) return null;
      const sonuclar = gecmis.map((k) => k.tekYarisSonucu!);
      const yuzdelikler = gecmis.map((k) => k.erkenHizYuzdelik);
      const egilim = hesaplaCokYarisEgilimi(sonuclar, yuzdelikler);
      return egilim ? { dagilim: egilim.dagilim, erkenHizGucu: egilim.erkenHizGucu, n: egilim.n } : null;
    });
    const gidisat = hesaplaYarisGidisati(profiller, y.distance);
    const zorluk = tempoZorlukAgirligi(gidisat.senaryoOlasiliklari);

    y.runners.forEach((r, i) => {
      const norm = normalizeName(r.name);
      const kohortGecmis = (kaynakByHorse.get(norm) ?? [])
        .filter((k) => k.date < y.date && k.surface === y.surface && k.dilim === dilim && k.paceAdjusted != null)
        .slice(-3); // son 3 UYGUN (aynı yüzey+dilim) kaynak yarış
      const n = kohortGecmis.length;
      let latentAbility = 0, consistencyFactor = 1;
      if (n > 0) {
        const degerler = kohortGecmis.map((k) => k.paceAdjusted!);
        latentAbility = degerler.reduce((s, v) => s + v, 0) / n;
        if (n >= 2) {
          const ort = latentAbility;
          const sd = Math.sqrt(degerler.reduce((s, v) => s + (v - ort) ** 2, 0) / n);
          consistencyFactor = 1 / (1 + sd);
        }
      }
      const reliability = Math.min(n / 3, 1) * consistencyFactor;
      const sectionalEdgeRaw = latentAbility * zorluk * reliability;
      const todayPaceScore = gidisat.atSonuclari[i]?.finalSkor ?? 0;
      ozellikByRaceRunner.set(`${y.raceId}|${r.no}`, { sectionalEdgeRaw, todayPaceScore });
    });
    islenen++;
    if (islenen % 1000 === 0) console.log(`   ${islenen}/${hedefYarislar.length} yarış işlendi...`);
  }
  console.log(`   Tamamlandı (${hedefYarislar.length} yarış).\n`);

  console.log("6/6 — TRAIN'de standardizasyon + nested conditional-logit fit (M1 vs M2) + DEV testi...\n");
  const trainEdgeDegerleri = train.flatMap((y) => y.runners.map((r) => ozellikByRaceRunner.get(`${y.raceId}|${r.no}`)!.sectionalEdgeRaw));
  const edgeOrt = trainEdgeDegerleri.reduce((a2, b2) => a2 + b2, 0) / trainEdgeDegerleri.length;
  const edgeSD = Math.sqrt(trainEdgeDegerleri.reduce((s, v) => s + (v - edgeOrt) ** 2, 0) / trainEdgeDegerleri.length) || 1;
  console.log(`   TRAIN SectionalEdge ham dağılımı: ort=${fmt(edgeOrt)} SD=${fmt(edgeSD)} (standardizasyon için TRAIN'de donduruldu)`);

  const getTodayPace = (raceId: string, no: number) => ozellikByRaceRunner.get(`${raceId}|${no}`)!.todayPaceScore;
  const getZEdge = (raceId: string, no: number) => (ozellikByRaceRunner.get(`${raceId}|${no}`)!.sectionalEdgeRaw - edgeOrt) / edgeSD;

  // M1: S = log(AGF) + δ·TodayPace — 1 parametre.
  const delta = fit1D(train, (y, r) => getTodayPace(y.raceId, r.no), 0);
  console.log(`   M1 (AGF+TodayPace) δ=${fmt(delta)}`);
  // M2: S = log(AGF) + δ'·TodayPace + γ·Z(SectionalEdge) — 2 parametre, BİRLİKTE fit.
  const [deltaM2, gammaM2] = fit2D(train, (y, r) => getTodayPace(y.raceId, r.no), (y, r) => getZEdge(y.raceId, r.no), [delta, 0]);
  console.log(`   M2 (AGF+TodayPace+SectionalEdge) δ'=${fmt(deltaM2)}  γ=${fmt(gammaM2)}\n`);

  const nestedDev = nestedDeltaLLBootstrap(dev, (y, r) => getTodayPace(y.raceId, r.no), (y, r) => getZEdge(y.raceId, r.no), delta, deltaM2, gammaM2);
  const gecti = nestedDev.lo != null && nestedDev.hi != null && nestedDev.hi < 0;
  console.log(`DEV — ΔLL(M2-M1) = ${fmt(nestedDev.nokta)}  95% GA=[${fmt(nestedDev.lo)}, ${fmt(nestedDev.hi)}]  ${gecti ? "★ SectionalEdge DEV'de M1'in ÜSTÜNE anlamlı katkı yaptı" : "(DEV'i geçmedi)"}`);

  if (!gecti) {
    console.log("\nSONUÇ: TEST açılmadı. SectionalEdge, TodayPace'in (mevcut Yarış Gidişatı sinyali) ÜSTÜNE anlamlı bir katkı göstermedi.");
    return;
  }

  console.log("\nTEST (kilitli) açılıyor — TRAIN+DEV ile yeniden fit...");
  const trainDev = [...train, ...dev];
  const deltaFinal1 = fit1D(trainDev, (y, r) => getTodayPace(y.raceId, r.no), 0);
  const [deltaFinal2, gammaFinal] = fit2D(trainDev, (y, r) => getTodayPace(y.raceId, r.no), (y, r) => getZEdge(y.raceId, r.no), [deltaFinal1, 0]);
  const nestedTest = nestedDeltaLLBootstrap(test, (y, r) => getTodayPace(y.raceId, r.no), (y, r) => getZEdge(y.raceId, r.no), deltaFinal1, deltaFinal2, gammaFinal);
  const testGecti = nestedTest.lo != null && nestedTest.hi != null && nestedTest.hi < 0;
  console.log(`TEST — ΔLL(M2-M1) = ${fmt(nestedTest.nokta)}  95% GA=[${fmt(nestedTest.lo)}, ${fmt(nestedTest.hi)}]  ${testGecti ? "★★ TEST'te DOĞRULANDI" : "(TEST'te doğrulanmadı)"}`);
}

function tempoZorlukAgirligi(senaryoOlasiliklari: Record<TempoSenaryosu, number>): number {
  return (senaryoOlasiliklari.MUCADELELI + senaryoOlasiliklari.COK_YUKSEK + senaryoOlasiliklari.DAGILMA_RISKI) / 100;
}

function olsFit(ciftler: { x: number; y: number }[]): { a: number; b: number } {
  const n = ciftler.length;
  if (n < 10) return { a: 0, b: 0 };
  const mx = ciftler.reduce((s, c) => s + c.x, 0) / n;
  const my = ciftler.reduce((s, c) => s + c.y, 0) / n;
  let sxy = 0, sxx = 0;
  for (const c of ciftler) { sxy += (c.x - mx) * (c.y - my); sxx += (c.x - mx) ** 2; }
  const b = sxx > 0 ? sxy / sxx : 0;
  const a = my - b * mx;
  return { a, b };
}

type HedefYarisGen = { raceId: string; date: number; winnerNos: Set<number>; runners: { no: number; agfRaw: number }[] };

function skorlar2(y: HedefYarisGen, getTP: (y: any, r: any) => number, getZE: (y: any, r: any) => number, delta: number, gamma: number): number[] {
  const agfToplam = y.runners.reduce((s, r) => s + r.agfRaw, 0) || 1;
  return y.runners.map((r) => {
    const pAgf = Math.max(r.agfRaw / agfToplam, 1e-6);
    return Math.log(pAgf) + delta * getTP(y, r) + gamma * getZE(y, r);
  });
}

function logSoftmaxKazanan(y: HedefYarisGen, sk: number[]): number | null {
  const idx = y.runners.findIndex((r) => y.winnerNos.has(r.no));
  if (idx < 0) return null;
  const mx = Math.max(...sk);
  const lse = mx + Math.log(sk.reduce((s, v) => s + Math.exp(v - mx), 0));
  return sk[idx] - lse;
}

function raceLogLikToplam(yarislar: any[], getTP: (y: any, r: any) => number, getZE: (y: any, r: any) => number, delta: number, gamma: number): number {
  let t = 0;
  for (const y of yarislar) { const lp = logSoftmaxKazanan(y, skorlar2(y, getTP, getZE, delta, gamma)); if (lp != null) t += lp; }
  return t;
}

function fit1D(train: any[], getTP: (y: any, r: any) => number, _unused: number): number {
  let merkez = 0, aralik = 3, adim = 0.25;
  for (let tur = 0; tur < 4; tur++) {
    let enIyi = merkez, enIyiLL = -Infinity;
    for (let g = merkez - aralik; g <= merkez + aralik + 1e-9; g += adim) {
      const ll = raceLogLikToplam(train, getTP, () => 0, g, 0);
      if (ll > enIyiLL) { enIyiLL = ll; enIyi = g; }
    }
    merkez = enIyi; aralik = adim * 2; adim = adim / 10;
  }
  return Math.round(merkez * 10000) / 10000;
}

function fit2D(train: any[], getTP: (y: any, r: any) => number, getZE: (y: any, r: any) => number, baslangic: [number, number]): [number, number] {
  let delta = baslangic[0], gamma = baslangic[1];
  for (let tur = 0; tur < 6; tur++) {
    // delta boyutu
    { let merkez = delta, aralik = 1, adim = 0.1;
      for (let k = 0; k < 3; k++) {
        let enIyi = merkez, enIyiLL = -Infinity;
        for (let g = merkez - aralik; g <= merkez + aralik + 1e-9; g += adim) {
          const ll = raceLogLikToplam(train, getTP, getZE, g, gamma);
          if (ll > enIyiLL) { enIyiLL = ll; enIyi = g; }
        }
        merkez = enIyi; aralik = adim * 2; adim = adim / 10;
      }
      delta = Math.round(merkez * 10000) / 10000; }
    // gamma boyutu
    { let merkez = gamma, aralik = 1, adim = 0.1;
      for (let k = 0; k < 3; k++) {
        let enIyi = merkez, enIyiLL = -Infinity;
        for (let g = merkez - aralik; g <= merkez + aralik + 1e-9; g += adim) {
          const ll = raceLogLikToplam(train, getTP, getZE, delta, g);
          if (ll > enIyiLL) { enIyiLL = ll; enIyi = g; }
        }
        merkez = enIyi; aralik = adim * 2; adim = adim / 10;
      }
      gamma = Math.round(merkez * 10000) / 10000; }
  }
  return [delta, gamma];
}

function nestedDeltaLLBootstrap(
  yarislar: any[], getTP: (y: any, r: any) => number, getZE: (y: any, r: any) => number,
  deltaM1: number, deltaM2: number, gammaM2: number, B = B_BOOTSTRAP
): { nokta: number | null; lo: number | null; hi: number | null } {
  const farklar: number[] = [];
  for (const y of yarislar) {
    const idx = y.runners.findIndex((r: any) => y.winnerNos.has(r.no));
    if (idx < 0) continue;
    const logPM1 = logSoftmaxKazanan(y, skorlar2(y, getTP, getZE, deltaM1, 0));
    const logPM2 = logSoftmaxKazanan(y, skorlar2(y, getTP, getZE, deltaM2, gammaM2));
    if (logPM1 == null || logPM2 == null) continue;
    farklar.push(-logPM2 - -logPM1); // logloss_M2 - logloss_M1
  }
  if (farklar.length < 5) return { nokta: null, lo: null, hi: null };
  const nokta = farklar.reduce((a, b) => a + b, 0) / farklar.length;
  const dagilim: number[] = [];
  for (let i = 0; i < B; i++) {
    let t = 0;
    for (let j = 0; j < farklar.length; j++) t += farklar[Math.floor(Math.random() * farklar.length)];
    dagilim.push(t / farklar.length);
  }
  dagilim.sort((a, b) => a - b);
  return { nokta, lo: dagilim[Math.floor(dagilim.length * 0.025)], hi: dagilim[Math.floor(dagilim.length * 0.975)] };
}

function fmt(v: number | null): string { return v == null || Number.isNaN(v) ? "?" : v.toFixed(5); }

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
