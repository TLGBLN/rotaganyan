// TR Accurace Sectional Intelligence V1 — FORWARD/AGF-RESIDUAL DOĞRULAMA (2026-10-02)
//
// Soru: Sectional Intelligence özellikleri (EARLY_DEFICIT, SLOWDOWN/REBOUND, Actual Pace
// Profile...) bir atın SONRAKİ yarışındaki, AGF'nin (piyasa) ZATEN beklediğinin ÜSTÜNDE/
// ALTINDA performansıyla ilişkili mi? Yalnız "bitiriş sırasıyla ilişkili" YETMEZ — AGF
// kontrol edildikten SONRA da ilişki kalıyor mu, asıl soru bu (bkz. kullanıcı talimatı).
//
// Leak-free: her örnek için kaynak (source) Accurace yarışının TARİHİ, hedef (target)
// TR yarışının tarihinden KESİN ÖNCE olmalı (date(source) < date(target)). Hedef yarış
// = o atın normalizeName ile eşleşen, source'tan SONRAKİ EN YAKIN TR yarışı — scratched
// değil, ekuriGroup YOK (AGF yorumunu bulandırmasın diye kasıtlı dışlandı, bkz. rapor),
// agf dolu, Result'u var.
//
// Metrik: residual = won(0/1) - (agf/100)  [AGF-implied olasılığa göre KALİBRASYON ARTIĞI]
// Her özellik AYRI test edilir (tek bir keyfi SECTIONAL_SCORE'a TOPLANMAZ — kullanıcı
// talimatı). Bootstrap RACE-CLUSTERED (hedef raceId'ye göre) — aynı yarıştaki atlar
// bağımsız örnek SAYILMAZ (sıfır-toplamlı won değişkeni + paylaşılan AGF yapısı).
//
// Kullanım: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-sectional-forward-agf-residual.mts
import { db } from "./src/lib/db";
import {
  segmentlereAyir,
  sahaSegmentIstatistikleri,
  relativeSplitSD,
  hesaplaErkenBolumKaybi,
  tespitSegmentAnomalileri,
  hesaplaGercekTempoProfili,
  type SectionalCheckpoint,
} from "./src/lib/methodology/sectional-intelligence";

const MIN_SAHA = 4;
const MIN_CHECKPOINTS = 8;
const MIN_GECMIS_ORNEK = 3; // self-normalized deficit için gereken geçmiş Accurace yarış sayısı
const B_BOOTSTRAP = 2000;

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

type HedefKaydi = { date: number; raceId: string; agf: number; won: boolean };

type OrnekSatiri = {
  sourceDate: number;
  targetRaceId: string;
  won: boolean;
  agf: number;
  residual: number;
  // features
  deficit100mSn: number | null;
  deficit200mSn: number | null;
  initialPositionDeficit: number | null;
  selfNormalizedDeficit100mSn: number | null;
  slowdown: boolean;
  slowdownRebound: boolean;
  lateRecovery: boolean;
  paceCollapse: boolean;
  erkenGoreliTempoSD: number | null;
  ortaGoreliTempoSD: number | null;
  gecGoreliTempoSD: number | null;
  pozisyonKazanciKaybi: number | null;
  signDivergence: boolean; // deficit100mSn ve selfNormalizedDeficit100mSn ZIT işaretli mi
};

async function main() {
  console.log("1/4 — Hedef (next-race) arama tablosu kuruluyor (Runner × Race × Result)...");
  const runners = await db.runner.findMany({
    where: {
      scratched: false,
      ekuriGroup: null,
      agf: { not: null },
      race: { raceDay: { hippodrome: { isForeign: false } } },
    },
    select: {
      name: true,
      no: true,
      agf: true,
      raceId: true,
      race: { select: { raceDay: { select: { date: true } } } },
    },
  });
  const raceIds = [...new Set(runners.map((r) => r.raceId))];
  const results = await db.result.findMany({ where: { raceId: { in: raceIds } }, select: { raceId: true, winnerNos: true } });
  const winnerByRace = new Map(results.map((r) => [r.raceId, new Set(r.winnerNos)]));

  const hedefByHorse = new Map<string, HedefKaydi[]>();
  for (const r of runners) {
    const kazananlar = winnerByRace.get(r.raceId);
    if (!kazananlar) continue; // sonuç henüz yok
    const norm = normalizeName(r.name);
    const liste = hedefByHorse.get(norm) ?? [];
    liste.push({ date: r.race.raceDay.date.getTime(), raceId: r.raceId, agf: r.agf!, won: kazananlar.has(r.no) });
    hedefByHorse.set(norm, liste);
  }
  for (const liste of hedefByHorse.values()) liste.sort((a, b) => a.date - b.date);
  console.log(`   ${hedefByHorse.size} farklı at için hedef aday havuzu hazır (toplam ${runners.length} runner satırı).`);

  console.log("2/4 — Accurace geçmişi (kendi-geçmişi normalizasyonu için) yükleniyor...");
  const tumSplitsGecmisIcin = await db.accuraceHorseSplit.findMany({
    select: { horseName: true, checkpoints: true, accuraceRace: { select: { date: true } } },
  });
  const gecmis100mByHorse = new Map<string, { date: number; ms: number }[]>();
  for (const s of tumSplitsGecmisIcin) {
    const seg100 = segmentlereAyir(s.checkpoints as unknown as SectionalCheckpoint[]).find((x) => x.from === 0 && x.to === 100);
    if (!seg100) continue;
    const norm = normalizeName(s.horseName);
    const liste = gecmis100mByHorse.get(norm) ?? [];
    liste.push({ date: s.accuraceRace.date.getTime(), ms: seg100.durationMs });
    gecmis100mByHorse.set(norm, liste);
  }
  for (const liste of gecmis100mByHorse.values()) liste.sort((a, b) => a.date - b.date);

  console.log("3/4 — Her Accurace yarışı için saha istatistikleri + özellikler + hedef eşleme...");
  const accRaces = await db.accuraceRace.findMany({
    select: {
      id: true,
      date: true,
      length: true,
      splits: { select: { horseName: true, checkpoints: true, runnerId: true } },
    },
  });

  const ornekler: OrnekSatiri[] = [];
  let atlananSahaKucuk = 0, atlananCpAz = 0, atlananHedefYok = 0;

  for (const ar of accRaces) {
    if (!ar.length || ar.splits.length < MIN_SAHA) { atlananSahaKucuk += ar.splits.length < MIN_SAHA ? ar.splits.length : 0; continue; }
    const sahaSegmentleri = ar.splits.map((s) => segmentlereAyir(s.checkpoints as unknown as SectionalCheckpoint[]));
    const sahaStatleri = sahaSegmentIstatistikleri(sahaSegmentleri);
    const sourceDateMs = ar.date.getTime();

    for (let i = 0; i < ar.splits.length; i++) {
      const split = ar.splits[i];
      const checkpoints = split.checkpoints as unknown as SectionalCheckpoint[];
      if (checkpoints.length < MIN_CHECKPOINTS) { atlananCpAz++; continue; }

      const norm = normalizeName(split.horseName);
      const hedefler = hedefByHorse.get(norm);
      const hedef = hedefler?.find((h) => h.date > sourceDateMs); // SIRALI liste, ilk uygun = en yakın
      if (!hedef) { atlananHedefYok++; continue; }

      const gecmis = (gecmis100mByHorse.get(norm) ?? []).filter((g) => g.date < sourceDateMs);
      const kendiGecmis100mOrtalamasiMs =
        gecmis.length >= MIN_GECMIS_ORNEK ? gecmis.reduce((a, b) => a + b.ms, 0) / gecmis.length : null;

      const segmentler = sahaSegmentleri[i];
      const relativeSplits = segmentler.map((s) => ({
        from: s.from, to: s.to,
        sd: relativeSplitSD(s, sahaStatleri.find((st) => st.from === s.from && st.to === s.to)),
      }));
      const erkenBolumKaybi = hesaplaErkenBolumKaybi(segmentler, sahaStatleri, ar.splits.length, checkpoints, kendiGecmis100mOrtalamasiMs);
      const anomaliler = tespitSegmentAnomalileri(relativeSplits);
      const tempoProfili = hesaplaGercekTempoProfili(relativeSplits, checkpoints, ar.length);

      const slowdown = anomaliler.some((a) => a.tip === "SLOWDOWN");
      const slowdownRebound = anomaliler.some((a) => a.tip === "SLOWDOWN") && anomaliler.some((a) => a.tip === "REBOUND");

      const signDivergence =
        erkenBolumKaybi.deficit100mSn != null &&
        erkenBolumKaybi.selfNormalizedDeficit100mSn != null &&
        Math.sign(erkenBolumKaybi.deficit100mSn) !== 0 &&
        Math.sign(erkenBolumKaybi.selfNormalizedDeficit100mSn) !== 0 &&
        Math.sign(erkenBolumKaybi.deficit100mSn) !== Math.sign(erkenBolumKaybi.selfNormalizedDeficit100mSn);

      ornekler.push({
        sourceDate: sourceDateMs,
        targetRaceId: hedef.raceId,
        won: hedef.won,
        agf: hedef.agf,
        residual: (hedef.won ? 1 : 0) - hedef.agf / 100,
        deficit100mSn: erkenBolumKaybi.deficit100mSn,
        deficit200mSn: erkenBolumKaybi.deficit200mSn,
        initialPositionDeficit: erkenBolumKaybi.initialPositionDeficit,
        selfNormalizedDeficit100mSn: erkenBolumKaybi.selfNormalizedDeficit100mSn,
        slowdown,
        slowdownRebound,
        lateRecovery: tempoProfili.gecToparlanma,
        paceCollapse: tempoProfili.paceCollapse,
        erkenGoreliTempoSD: tempoProfili.erkenGoreliTempoSD,
        ortaGoreliTempoSD: tempoProfili.ortaGoreliTempoSD,
        gecGoreliTempoSD: tempoProfili.gecGoreliTempoSD,
        pozisyonKazanciKaybi: tempoProfili.pozisyonKazanciKaybi,
        signDivergence,
      });
    }
  }

  console.log(`   ${ornekler.length} eşleşmiş (source→target) örnek üretildi.`);
  console.log(`   Atlanan: saha<${MIN_SAHA} (${atlananSahaKucuk} at-satırı), checkpoints<${MIN_CHECKPOINTS} (${atlananCpAz}), hedef yok (${atlananHedefYok})`);

  console.log("4/4 — Race-clustered bootstrap testleri (B=" + B_BOOTSTRAP + ")...\n");
  raporla(ornekler);
}

// ─── İstatistik yardımcıları ────────────────────────────────────────────────

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
  }
  if (dx2 === 0 || dy2 === 0) return NaN;
  return num / Math.sqrt(dx2 * dy2);
}

/** Race-clustered bootstrap: targetRaceId'ye göre kümelenmiş satırlardan, küme SAYISI
 *  kadar kümeyi YERİNE KOYARAK yeniden örnekler (satır değil, KÜME düzeyinde) — aynı
 *  yarıştaki atların birbirine bağımlı olduğu varsayımıyla tutarlı. */
function clusteredBootstrapCI(
  rows: OrnekSatiri[],
  statFn: (sample: OrnekSatiri[]) => number | null,
  B = B_BOOTSTRAP
): { nokta: number | null; lo: number | null; hi: number | null; n: number } {
  const byCluster = new Map<string, OrnekSatiri[]>();
  for (const r of rows) {
    const liste = byCluster.get(r.targetRaceId) ?? [];
    liste.push(r);
    byCluster.set(r.targetRaceId, liste);
  }
  const clusters = [...byCluster.values()];
  const nokta = statFn(rows);
  if (clusters.length < 5) return { nokta, lo: null, hi: null, n: rows.length };

  const dagilim: number[] = [];
  for (let b = 0; b < B; b++) {
    const ornekKumeler: OrnekSatiri[] = [];
    for (let i = 0; i < clusters.length; i++) {
      const idx = Math.floor(Math.random() * clusters.length);
      ornekKumeler.push(...clusters[idx]);
    }
    const s = statFn(ornekKumeler);
    if (s != null && !Number.isNaN(s)) dagilim.push(s);
  }
  dagilim.sort((a, b) => a - b);
  const lo = dagilim[Math.floor(dagilim.length * 0.025)] ?? null;
  const hi = dagilim[Math.floor(dagilim.length * 0.975)] ?? null;
  return { nokta, lo, hi, n: rows.length };
}

function fmt(v: number | null): string {
  if (v == null || Number.isNaN(v)) return "?";
  return v.toFixed(4);
}

function korelasyonTest(ornekler: OrnekSatiri[], ad: string, getir: (o: OrnekSatiri) => number | null) {
  const gecerli = ornekler.filter((o) => getir(o) != null);
  const sonuc = clusteredBootstrapCI(gecerli, (sample) => {
    const xs = sample.map((o) => getir(o)!);
    const ys = sample.map((o) => o.residual);
    return pearson(xs, ys);
  });
  const anlamli = sonuc.lo != null && sonuc.hi != null && (sonuc.lo > 0) === (sonuc.hi > 0) && sonuc.lo !== 0;
  console.log(`${ad.padEnd(34)} r=${fmt(sonuc.nokta)}  95% GA=[${fmt(sonuc.lo)}, ${fmt(sonuc.hi)}]  n=${sonuc.n}  ${anlamli ? "★ sıfırı içermiyor" : ""}`);
}

function grupFarkiTest(ornekler: OrnekSatiri[], ad: string, bayrak: (o: OrnekSatiri) => boolean) {
  const sonuc = clusteredBootstrapCI(ornekler, (sample) => {
    const grupTrue = sample.filter(bayrak);
    const grupFalse = sample.filter((o) => !bayrak(o));
    if (grupTrue.length < 10 || grupFalse.length < 10) return null;
    const ort = (xs: OrnekSatiri[]) => xs.reduce((a, b) => a + b.residual, 0) / xs.length;
    return ort(grupTrue) - ort(grupFalse);
  });
  const nTrue = ornekler.filter(bayrak).length;
  const anlamli = sonuc.lo != null && sonuc.hi != null && (sonuc.lo > 0) === (sonuc.hi > 0) && sonuc.lo !== 0;
  console.log(`${ad.padEnd(34)} Δresidual=${fmt(sonuc.nokta)}  95% GA=[${fmt(sonuc.lo)}, ${fmt(sonuc.hi)}]  n(true)=${nTrue}/${ornekler.length}  ${anlamli ? "★ sıfırı içermiyor" : ""}`);
}

function raporla(ornekler: OrnekSatiri[]) {
  console.log("── Sürekli özellikler (Pearson r, feature vs AGF-residual) ──");
  korelasyonTest(ornekler, "EARLY_100M_DEFICIT", (o) => o.deficit100mSn);
  korelasyonTest(ornekler, "EARLY_200M_DEFICIT", (o) => o.deficit200mSn);
  korelasyonTest(ornekler, "INITIAL_POSITION_DEFICIT", (o) => o.initialPositionDeficit);
  korelasyonTest(ornekler, "SELF_NORMALIZED_EARLY_DEFICIT", (o) => o.selfNormalizedDeficit100mSn);
  korelasyonTest(ornekler, "EARLY_RELATIVE_PACE_SD", (o) => o.erkenGoreliTempoSD);
  korelasyonTest(ornekler, "MID_RELATIVE_PACE_SD", (o) => o.ortaGoreliTempoSD);
  korelasyonTest(ornekler, "LATE_RELATIVE_PACE_SD", (o) => o.gecGoreliTempoSD);
  korelasyonTest(ornekler, "POSITION_GAIN_LOSS", (o) => o.pozisyonKazanciKaybi);

  console.log("\n── Kategorik özellikler (Δresidual = ort(flag=true) - ort(flag=false)) ──");
  grupFarkiTest(ornekler, "SLOWDOWN", (o) => o.slowdown);
  grupFarkiTest(ornekler, "SLOWDOWN_REBOUND", (o) => o.slowdownRebound);
  grupFarkiTest(ornekler, "LATE_RECOVERY", (o) => o.lateRecovery);
  grupFarkiTest(ornekler, "PACE_COLLAPSE", (o) => o.paceCollapse);

  console.log("\n── Özel inceleme: saha-içi vs kendi-geçmişi deficit ZIT işaretli mi (madde 9) ──");
  grupFarkiTest(ornekler, "SIGN_DIVERGENCE (saha-içi≠kendi)", (o) => o.signDivergence);

  console.log(`\nToplam örnek: ${ornekler.length}, ort. AGF-implied olasılık: ${(ornekler.reduce((a, b) => a + b.agf, 0) / ornekler.length / 100).toFixed(3)}, gerçek kazanma oranı: ${(ornekler.filter((o) => o.won).length / ornekler.length).toFixed(3)}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
