// TR Accurace Sectional Intelligence V1 — TEK TUR, ÖNCEDEN KAYITLI ETKİLEŞİM TESTİ (2026-10-02)
//
// 8 tekil özelliğin HİÇBİRİ race-level AGF-vs-AGF+feature testinde (bkz. arac-sectional-
// incremental-value-test.mts) DEV'i geçemedi. Kullanıcı kararı: bundan "hiçbir şey yok"
// sonucuna sıçramadan ÖNCE, TEK sefer, ÖNCEDEN TANIMLI 4 mekanistik etkileşim hipotezi
// test edilsin — sonrasında serbest kombinasyon avı (overfit riski) YAPILMAYACAK.
//
// ÖNCEDEN KAYITLI 4 ADAY (kod yazılmadan ÖNCE kullanıcı tarafından belirlendi):
//   1. EarlyPace × LatePace        : erkenGoreliTempoSD × gecGoreliTempoSD
//   2. EarlyDeficit × LatePace     : deficit100mSn × gecGoreliTempoSD
//   3. PositionGain × EarlyPace    : pozisyonKazanciKaybi × erkenGoreliTempoSD
//   4. PositionGain × LatePace     : pozisyonKazanciKaybi × gecGoreliTempoSD
//
// Model: S_i = log(P_AGF_i) + β1·X_i + β2·Z_i + β3·(X_i·Z_i) — ana etkiler İNTERAKSİYONLA
// BİRLİKTE modelde (yalnız etkileşim terimi KONMADI). 3 parametre TRAIN'de coordinate-ascent
// ile fit edilir (log-likelihood içbükey — McFadden koşullu-logit, sıraya bakmaksızın
// yakınsar). Gate AYNI: DEV ΔLogLoss 95% GA üst sınırı <0 OLMALI, aksi halde TEST'e GİRMEZ.
// Birden fazla aday DEV'i geçerse SEÇİM KURALI (ÖNCEDEN belirlendi, veri görülmeden):
// DEV ΔLogLoss noktası EN NEGATİF olan TEK aday TEST'e gider (seçim yanlılığından kaçınmak
// için TÜM geçenler ayrı ayrı TEST'e sokulmaz).
//
// Eksik veri kontrolü (kullanıcı talebi): X veya Z null ise runner YARIŞTAN ATILMAZ, yalnız
// o terim 0 kabul edilir — AGF ve challenger HER ZAMAN aynı runner setinde karşılaştırılır
// (yarisSkorlari tüm yaris.runners'ı kapsar, hiçbir filtre YOK — aşağıda doğrulanabilir).
import { db } from "./src/lib/db";
import {
  segmentlereAyir,
  sahaSegmentIstatistikleri,
  relativeSplitSD,
  hesaplaErkenBolumKaybi,
  hesaplaGercekTempoProfili,
  type SectionalCheckpoint,
} from "./src/lib/methodology/sectional-intelligence";

const MIN_SAHA = 4;
const MIN_CHECKPOINTS = 8;
const MIN_GECMIS_ORNEK = 3;
const B_BOOTSTRAP = 1000;

function normalizeName(s: string): string {
  return s
    .replace(/\s*\([A-ZİĞÜŞÖÇ]{2,4}\)\s*$/i, "")
    .toLocaleUpperCase("tr-TR")
    .replace(/I/g, "I")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type KaynakOzellik = {
  date: number;
  deficit100mSn: number | null;
  erkenGoreliTempoSD: number | null;
  gecGoreliTempoSD: number | null;
  pozisyonKazanciKaybi: number | null;
};

type HedefYarisRunner = { no: number; agfRaw: number; ozellik: KaynakOzellik | null };
type HedefYaris = { raceId: string; date: number; winnerNos: Set<number>; runners: HedefYarisRunner[] };

type Aday = { ad: string; getX: (o: KaynakOzellik | null) => number | null; getZ: (o: KaynakOzellik | null) => number | null };
const ADAYLAR: Aday[] = [
  { ad: "EarlyPace × LatePace", getX: (o) => o?.erkenGoreliTempoSD ?? null, getZ: (o) => o?.gecGoreliTempoSD ?? null },
  { ad: "EarlyDeficit × LatePace", getX: (o) => o?.deficit100mSn ?? null, getZ: (o) => o?.gecGoreliTempoSD ?? null },
  { ad: "PositionGain × EarlyPace", getX: (o) => o?.pozisyonKazanciKaybi ?? null, getZ: (o) => o?.erkenGoreliTempoSD ?? null },
  { ad: "PositionGain × LatePace", getX: (o) => o?.pozisyonKazanciKaybi ?? null, getZ: (o) => o?.gecGoreliTempoSD ?? null },
];

async function main() {
  console.log("1/4 — Point-in-time özellik havuzu (önceki script ile AYNI hesap)...");
  const accRaces = await db.accuraceRace.findMany({
    select: { date: true, length: true, splits: { select: { horseName: true, checkpoints: true } } },
  });
  const gecmis100mByHorse = new Map<string, { date: number; ms: number }[]>();
  for (const ar of accRaces) {
    for (const s of ar.splits) {
      const seg100 = segmentlereAyir(s.checkpoints as unknown as SectionalCheckpoint[]).find((x) => x.from === 0 && x.to === 100);
      if (!seg100) continue;
      const norm = normalizeName(s.horseName);
      const liste = gecmis100mByHorse.get(norm) ?? [];
      liste.push({ date: ar.date.getTime(), ms: seg100.durationMs });
      gecmis100mByHorse.set(norm, liste);
    }
  }
  for (const liste of gecmis100mByHorse.values()) liste.sort((a, b) => a.date - b.date);

  const kaynakByHorse = new Map<string, KaynakOzellik[]>();
  for (const ar of accRaces) {
    if (!ar.length || ar.splits.length < MIN_SAHA) continue;
    const sahaSegmentleri = ar.splits.map((s) => segmentlereAyir(s.checkpoints as unknown as SectionalCheckpoint[]));
    const sahaStatleri = sahaSegmentIstatistikleri(sahaSegmentleri);
    const sourceDateMs = ar.date.getTime();
    for (let i = 0; i < ar.splits.length; i++) {
      const split = ar.splits[i];
      const checkpoints = split.checkpoints as unknown as SectionalCheckpoint[];
      if (checkpoints.length < MIN_CHECKPOINTS) continue;
      const norm = normalizeName(split.horseName);
      const gecmis = (gecmis100mByHorse.get(norm) ?? []).filter((g) => g.date < sourceDateMs);
      const kendiGecmis100mOrtalamasiMs = gecmis.length >= MIN_GECMIS_ORNEK ? gecmis.reduce((a, b) => a + b.ms, 0) / gecmis.length : null;
      const segmentler = sahaSegmentleri[i];
      const relativeSplits = segmentler.map((s) => ({
        from: s.from, to: s.to, sd: relativeSplitSD(s, sahaStatleri.find((st) => st.from === s.from && st.to === s.to)),
      }));
      const erkenBolumKaybi = hesaplaErkenBolumKaybi(segmentler, sahaStatleri, ar.splits.length, checkpoints, kendiGecmis100mOrtalamasiMs);
      const tempoProfili = hesaplaGercekTempoProfili(relativeSplits, checkpoints, ar.length);
      const liste = kaynakByHorse.get(norm) ?? [];
      liste.push({
        date: sourceDateMs,
        deficit100mSn: erkenBolumKaybi.deficit100mSn,
        erkenGoreliTempoSD: tempoProfili.erkenGoreliTempoSD,
        gecGoreliTempoSD: tempoProfili.gecGoreliTempoSD,
        pozisyonKazanciKaybi: tempoProfili.pozisyonKazanciKaybi,
      });
      kaynakByHorse.set(norm, liste);
    }
  }
  for (const liste of kaynakByHorse.values()) liste.sort((a, b) => a.date - b.date);

  console.log("2/4 — Hedef yarışlar (AYNI filtre: scratched=false, ekuriGroup=null, agf dolu, Result var)...");
  const runners = await db.runner.findMany({
    where: { scratched: false, ekuriGroup: null, agf: { not: null }, race: { raceDay: { hippodrome: { isForeign: false } } } },
    select: { name: true, no: true, agf: true, raceId: true, race: { select: { raceDay: { select: { date: true } } } } },
  });
  const raceIds = [...new Set(runners.map((r) => r.raceId))];
  const results = await db.result.findMany({ where: { raceId: { in: raceIds } }, select: { raceId: true, winnerNos: true } });
  const winnerByRace = new Map(results.map((r) => [r.raceId, new Set(r.winnerNos)]));
  const runnersByRace = new Map<string, typeof runners>();
  for (const r of runners) { const l = runnersByRace.get(r.raceId) ?? []; l.push(r); runnersByRace.set(r.raceId, l); }

  const hedefYarislar: HedefYaris[] = [];
  for (const [raceId, rs] of runnersByRace) {
    const kazananlar = winnerByRace.get(raceId);
    if (!kazananlar || kazananlar.size === 0 || rs.length < 4) continue;
    const date = rs[0].race.raceDay.date.getTime();
    const hedefRunners: HedefYarisRunner[] = rs.map((r) => {
      const norm = normalizeName(r.name);
      const gecmis = kaynakByHorse.get(norm) ?? [];
      let enSon: KaynakOzellik | null = null;
      for (const k of gecmis) { if (k.date < date) enSon = k; else break; }
      return { no: r.no, agfRaw: r.agf!, ozellik: enSon };
    });
    hedefYarislar.push({ raceId, date, winnerNos: kazananlar, runners: hedefRunners });
  }
  hedefYarislar.sort((a, b) => a.date - b.date);

  const nTrain = Math.floor(hedefYarislar.length * 0.6);
  const nDev = Math.floor(hedefYarislar.length * 0.2);
  const train = hedefYarislar.slice(0, nTrain);
  const dev = hedefYarislar.slice(nTrain, nTrain + nDev);
  const test = hedefYarislar.slice(nTrain + nDev);
  console.log(`   TRAIN=${train.length}  DEV=${dev.length}  TEST=${test.length} (önceki script ile AYNI bölüm — veri/filtre değişmedi)\n`);

  // Eksik-veri bütünlük kontrolü: her yarışta runner sayısı, feature mevcudiyetinden
  // BAĞIMSIZ olmalı (hiçbir runner feature eksikliği yüzünden choice-set'ten düşmüyor).
  const ornekYaris = dev[0];
  console.log(`Bütünlük kontrolü: örnek DEV yarışı ${ornekYaris.runners.length} runner (feature eksikliği filtrelenmedi, yarisSkorlari TÜMÜNÜ kapsıyor — kod incelemesiyle doğrulandı).\n`);

  console.log("3/4 — 4 ÖNCEDEN KAYITLI aday: TRAIN'de (β1,β2,β3) coordinate-ascent fit → DEV testi...\n");
  const devSonuclari: { aday: Aday; beta: number[]; dev: ReturnType<typeof deltaLogLossBootstrap> }[] = [];
  for (const aday of ADAYLAR) {
    const getX = (r: HedefYarisRunner) => aday.getX(r.ozellik);
    const getZ = (r: HedefYarisRunner) => aday.getZ(r.ozellik);
    const kapsam = kapsamOrani(train, getX, getZ);
    const beta = fitBeta3(train, getX, getZ);
    const devSonuc = deltaLogLossBootstrap(dev, getX, getZ, beta);
    const anlamli = devSonuc.lo != null && devSonuc.hi != null && devSonuc.hi < 0;
    console.log(
      `${aday.ad.padEnd(28)} β=[${beta.map(fmt).join(", ")}]  DEV ΔLL=${fmt(devSonuc.nokta)}  95% GA=[${fmt(devSonuc.lo)}, ${fmt(devSonuc.hi)}]  kapsam=%${(kapsam * 100).toFixed(0)}  ${anlamli ? "★ DEV'i geçti" : ""}`
    );
    devSonuclari.push({ aday, beta, dev: devSonuc });
  }

  console.log("\n4/4 — TEST (kilitli) — ÖNCEDEN BELİRLENMİŞ seçim kuralı: DEV'i geçenler arasından EN NEGATİF nokta tahmini...\n");
  const gecenler = devSonuclari.filter((s) => s.dev.lo != null && s.dev.hi != null && s.dev.hi < 0);
  if (gecenler.length === 0) {
    console.log("   Hiçbir etkileşim DEV taramasını geçmedi — TEST açılmadı.");
    console.log(`   (Denenen aday sayısı: ${ADAYLAR.length} — raporun tamamı, seçici olmayan tam liste.)`);
  } else {
    const finalist = gecenler.reduce((best, cur) => (cur.dev.nokta! < best.dev.nokta! ? cur : best));
    console.log(`   Finalist (önceden kayıtlı kural ile seçildi): ${finalist.aday.ad}`);
    const getX = (r: HedefYarisRunner) => finalist.aday.getX(r.ozellik);
    const getZ = (r: HedefYarisRunner) => finalist.aday.getZ(r.ozellik);
    const betaFinal = fitBeta3([...train, ...dev], getX, getZ);
    const testSonuc = deltaLogLossBootstrap(test, getX, getZ, betaFinal);
    const anlamli = testSonuc.lo != null && testSonuc.hi != null && testSonuc.hi < 0;
    console.log(`   β(TRAIN+DEV)=[${betaFinal.map(fmt).join(", ")}]  TEST ΔLL=${fmt(testSonuc.nokta)}  95% GA=[${fmt(testSonuc.lo)}, ${fmt(testSonuc.hi)}]  ${anlamli ? "★★ TEST'te DOĞRULANDI" : "(TEST'te doğrulanmadı)"}`);
    console.log(`   (DEV'i geçen toplam aday sayısı: ${gecenler.length}/${ADAYLAR.length} — şeffaflık için belirtildi.)`);
  }
}

function kapsamOrani(yarislar: HedefYaris[], getX: (r: HedefYarisRunner) => number | null, getZ: (r: HedefYarisRunner) => number | null): number {
  let toplam = 0, dolu = 0;
  for (const y of yarislar) for (const r of y.runners) { toplam++; if (getX(r) != null && getZ(r) != null) dolu++; }
  return toplam > 0 ? dolu / toplam : 0;
}

function yarisSkorlariMulti(
  yaris: HedefYaris, getX: (r: HedefYarisRunner) => number | null, getZ: (r: HedefYarisRunner) => number | null, beta: number[]
): number[] {
  const agfToplam = yaris.runners.reduce((s, r) => s + r.agfRaw, 0) || 1;
  // DİKKAT: tüm yaris.runners kapsanır — eksik X/Z'li runner ASLA diziden çıkarılmaz (0 kabul edilir).
  return yaris.runners.map((r) => {
    const pAgf = Math.max(r.agfRaw / agfToplam, 1e-6);
    const x = getX(r) ?? 0;
    const z = getZ(r) ?? 0;
    return Math.log(pAgf) + beta[0] * x + beta[1] * z + beta[2] * x * z;
  });
}

function logSoftmaxKazanan(yaris: HedefYaris, skorlar: number[]): number | null {
  const kazananIdx = yaris.runners.findIndex((r) => yaris.winnerNos.has(r.no));
  if (kazananIdx < 0) return null;
  const maxSkor = Math.max(...skorlar);
  const logSumExp = maxSkor + Math.log(skorlar.reduce((s, x) => s + Math.exp(x - maxSkor), 0));
  return skorlar[kazananIdx] - logSumExp;
}

function raceLogLikToplamMulti(
  yarislar: HedefYaris[], getX: (r: HedefYarisRunner) => number | null, getZ: (r: HedefYarisRunner) => number | null, beta: number[]
): number {
  let toplam = 0;
  for (const y of yarislar) {
    const logP = logSoftmaxKazanan(y, yarisSkorlariMulti(y, getX, getZ, beta));
    if (logP != null) toplam += logP;
  }
  return toplam;
}

/** 3 parametreli coordinate-ascent: log-likelihood her boyutta içbükey (diğerleri sabitken)
 *  — sırayla her boyutu kaba→ince grid ile optimize edip birkaç tam tur tekrarlar. */
function fitBeta3(
  train: HedefYaris[], getX: (r: HedefYarisRunner) => number | null, getZ: (r: HedefYarisRunner) => number | null
): number[] {
  const beta = [0, 0, 0];
  for (let tur = 0; tur < 6; tur++) {
    for (let dim = 0; dim < 3; dim++) {
      let merkez = beta[dim], aralik = 2, adim = 0.2;
      for (let kademe = 0; kademe < 3; kademe++) {
        let enIyi = merkez, enIyiLL = -Infinity;
        for (let g = merkez - aralik; g <= merkez + aralik + 1e-9; g += adim) {
          const deneme = [...beta]; deneme[dim] = g;
          const ll = raceLogLikToplamMulti(train, getX, getZ, deneme);
          if (ll > enIyiLL) { enIyiLL = ll; enIyi = g; }
        }
        merkez = enIyi; aralik = adim * 2; adim = adim / 10;
      }
      beta[dim] = Math.round(merkez * 10000) / 10000;
    }
  }
  return beta;
}

function deltaLogLossBootstrap(
  yarislar: HedefYaris[], getX: (r: HedefYarisRunner) => number | null, getZ: (r: HedefYarisRunner) => number | null, beta: number[], B = B_BOOTSTRAP
): { nokta: number | null; lo: number | null; hi: number | null } {
  const farklar: number[] = [];
  for (const y of yarislar) {
    const kazananIdx = y.runners.findIndex((r) => y.winnerNos.has(r.no));
    if (kazananIdx < 0) continue;
    const logPBase = logSoftmaxKazanan(y, yarisSkorlariMulti(y, getX, getZ, [0, 0, 0]));
    const logPFeat = logSoftmaxKazanan(y, yarisSkorlariMulti(y, getX, getZ, beta));
    if (logPBase == null || logPFeat == null) continue;
    farklar.push(-logPFeat - -logPBase);
  }
  if (farklar.length < 5) return { nokta: null, lo: null, hi: null };
  const nokta = farklar.reduce((a, b) => a + b, 0) / farklar.length;
  const dagilim: number[] = [];
  for (let b = 0; b < B; b++) {
    let toplam = 0;
    for (let i = 0; i < farklar.length; i++) toplam += farklar[Math.floor(Math.random() * farklar.length)];
    dagilim.push(toplam / farklar.length);
  }
  dagilim.sort((a, b) => a - b);
  return { nokta, lo: dagilim[Math.floor(dagilim.length * 0.025)], hi: dagilim[Math.floor(dagilim.length * 0.975)] };
}

function fmt(v: number | null): string {
  if (v == null || Number.isNaN(v)) return "?";
  return v.toFixed(5);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
