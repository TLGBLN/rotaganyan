// FAZ A1 — V5.46 Signal Anatomy (2026-10-02, kullanıcı tasarımı)
//
// Amaç: production β'lara DOKUNMADAN (refit yok, yeni sinyal yok) mevcut V5.46'nın
// 15 skor bileşeninin (13 A-katmanı + Sire + Zemin+Mesafe) GERÇEK canlı katkılarını
// çıkarmak — hangi sinyal skoru ne kadar oynatıyor (magnitude), hangileri aynı bilgiyi
// taşıyor (korelasyon), hangilerinin gerçek operasyonel değeri var (fixed-weight
// full-minus-one, yeniden softmax+kalibrasyon ile).
//
// VERİ KAYNAĞI — kritik keşif: Pick.featureSnapshot.tumSinyaller (13 A-katmanı,
// kod/hamDeğer/standartDeğer/katki) VE featureSnapshot.bKatmani (sireKatkisi,
// zeminMesafeKatkisi, ikisinin de "uygulandiMi" bayrağı) HER YAYINLANAN tahmin için
// GERÇEK, O ANKİ (point-in-time, leak-free) değerleri saklıyor — hiçbir şey yeniden
// hesaplanmadı, Runner.raceStyle gibi geriye dönük güncellenebilir bir alan KULLANILMADI.
// featureSnapshot.motorEtiketi kendi kendini belgeliyor ("V5.46 — ...") — bu, tarih
// penceresinden DAHA GÜVENİLİR bir V5.46-dönemi filtresi (önceki scriptlerin elle
// bakım gerektiren V546_PENCERE_1/2 tarih aralıklarının YERİNE geçer).
//
// S_FULL,i = Σ(13 A-katmanı katki) + sireKatkisi + zeminMesafeKatkisi — BU TAM OLARAK
// gerçek production skorudur (terfi/garanti kuralları olasılığı DEĞİŞTİRMEZ, yalnız
// GÖSTERİM SIRASINI değiştirir — bkz. faz2V5Sirala: olasilik softmax'tan hemen sonra
// sabitlenir, terfi'ler yalnız `sirali`yi yeniden dizer).
//
// KAPSAM (kullanıcı): yalnız Contribution Magnitude + Correlation + Fixed-weight
// Full-minus-one. REFIT YOK. β DEĞİŞİKLİĞİ YOK. Production'a hiçbir etkisi yok.
//
// Kullanım: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-v546-signal-anatomy-faz-a1.mts
import { db } from "./src/lib/db";
import { softmax, liderEsigiHesapla, hibritMaidenSatisMi } from "./src/lib/methodology/v5-engine";
import { kategoriTespit } from "./src/lib/methodology/v2-engine";

const B_BOOTSTRAP = 1000;
const A_KATMANI_KODLARI = [
  "agfSirasi", "idmJokey", "jokeyOrani", "antrenorOrani", "agfPayi", "h2hNetSkor", "hizDerecesi",
  "agfPayi2", "zeminToleransi", "yakinsama2Plus", "sonIdmanSprint", "takiDegisikligi", "yarisGidisatiSkoru",
] as const;
const TUM_SINYAL_KODLARI = [...A_KATMANI_KODLARI, "sireOrani", "zeminMesafeDeneyim"] as const;
type SinyalKodu = (typeof TUM_SINYAL_KODLARI)[number];

type RunnerKayit = {
  no: number; isWinner: boolean;
  katki: Record<SinyalKodu, number>;
  aktif: Record<SinyalKodu, boolean>;
};
type RaceKayit = { raceId: string; classType: string; segment: string; liderEsigi: number; runners: RunnerKayit[] };

function segmentBelirle(classType: string): string {
  if (hibritMaidenSatisMi(classType)) return "Hibrit";
  const kat = kategoriTespit(classType);
  if (kat === "1a" || kat === "1b") return "Düşük Şart";
  if (kat === "2") return "Handikap";
  return "Diğer";
}

async function main() {
  console.log("1/5 — V5.46 dönemi Pick'ler (motorEtiketi ile — tarih penceresi DEĞİL) yükleniyor...");
  const rows: { featureSnapshot: any; runnerId: string | null; prediction_raceId: string; classType: string; winnerNos: number[] }[] =
    await db.$queryRawUnsafe(`
      SELECT p."featureSnapshot" as "featureSnapshot", p."runnerId" as "runnerId",
             pr."raceId" as "prediction_raceId", r."classType" as "classType", res."winnerNos" as "winnerNos"
      FROM "Pick" p
      JOIN "Prediction" pr ON pr.id = p."predictionId"
      JOIN "Race" r ON r.id = pr."raceId"
      JOIN "RaceDay" rd ON rd.id = r."raceDayId"
      JOIN "Hippodrome" h ON h.id = rd."hippodromeId"
      JOIN "Result" res ON res."raceId" = r.id
      WHERE p."featureSnapshot"->>'motorEtiketi' LIKE 'V5.46%'
        AND pr.published = true
        AND h."isForeign" = false AND h.name != 'Karma'
    `);
  console.log(`   ${rows.length} runner-pick satırı bulundu.\n`);

  console.log("2/5 — Runner.no eşleniyor, race-level yapı kuruluyor...");
  const runnerIds = [...new Set(rows.map((r) => r.runnerId).filter((x): x is string => !!x))];
  const runners = await db.runner.findMany({ where: { id: { in: runnerIds } }, select: { id: true, no: true, scratched: true, ekuriGroup: true } });
  const runnerById = new Map(runners.map((r) => [r.id, r]));

  const byRace = new Map<string, RaceKayit>();
  for (const row of rows) {
    if (!row.runnerId) continue;
    const runner = runnerById.get(row.runnerId);
    if (!runner || runner.scratched || runner.ekuriGroup != null) continue;
    const fs = row.featureSnapshot;
    const tumSinyaller: { kod: string; katki: number }[] = fs?.tumSinyaller ?? [];
    const bKatmani = fs?.bKatmani ?? {};

    const katki: Partial<Record<SinyalKodu, number>> = {};
    const aktif: Partial<Record<SinyalKodu, boolean>> = {};
    for (const s of tumSinyaller) {
      if ((A_KATMANI_KODLARI as readonly string[]).includes(s.kod)) {
        katki[s.kod as SinyalKodu] = s.katki;
        aktif[s.kod as SinyalKodu] = Math.abs(s.katki) > 1e-6;
      }
    }
    katki.sireOrani = bKatmani.sireKatkisi ?? 0;
    aktif.sireOrani = bKatmani.sireUygulandiMi === true;
    katki.zeminMesafeDeneyim = bKatmani.zeminMesafeKatkisi ?? 0;
    aktif.zeminMesafeDeneyim = bKatmani.zeminMesafeUygulandiMi === true;

    if (TUM_SINYAL_KODLARI.some((k) => katki[k] == null)) continue; // eksik kayıt, atla

    const raceId = row.prediction_raceId;
    const race = byRace.get(raceId) ?? {
      raceId, classType: row.classType, segment: segmentBelirle(row.classType),
      liderEsigi: liderEsigiHesapla(row.classType), runners: [],
    };
    race.runners.push({ no: runner.no, isWinner: row.winnerNos.includes(runner.no), katki: katki as Record<SinyalKodu, number>, aktif: aktif as Record<SinyalKodu, boolean> });
    byRace.set(raceId, race);
  }
  const yarislar = [...byRace.values()].filter((y) => y.runners.length >= 4 && y.runners.some((r) => r.isWinner));
  console.log(`   ${yarislar.length} yarış (≥4 runner, kazanan mevcut) kullanılabilir.\n`);

  console.log("3/5 — Race-centered contribution hesaplanıyor (C_ij - saha_ortalaması)...");
  type RCKayit = { raceId: string; segment: string; no: number; isWinner: boolean; rc: Record<SinyalKodu, number>; aktif: Record<SinyalKodu, boolean>; sFull: number };
  const rcKayitlari: RCKayit[] = [];
  for (const y of yarislar) {
    const ortalama: Partial<Record<SinyalKodu, number>> = {};
    for (const kod of TUM_SINYAL_KODLARI) {
      ortalama[kod] = y.runners.reduce((s, r) => s + r.katki[kod], 0) / y.runners.length;
    }
    for (const r of y.runners) {
      const rc: Partial<Record<SinyalKodu, number>> = {};
      for (const kod of TUM_SINYAL_KODLARI) rc[kod] = r.katki[kod] - ortalama[kod]!;
      const sFull = TUM_SINYAL_KODLARI.reduce((s, kod) => s + r.katki[kod], 0);
      rcKayitlari.push({ raceId: y.raceId, segment: y.segment, no: r.no, isWinner: r.isWinner, rc: rc as Record<SinyalKodu, number>, aktif: r.aktif, sFull });
    }
  }
  console.log(`   ${rcKayitlari.length} runner-satırı işlendi.\n`);

  console.log("4/5 — Contribution Magnitude + Correlation Matrix (GLOBAL + segment kırılımı)...\n");
  for (const seg of ["GLOBAL", "Düşük Şart", "Diğer", "Handikap", "Hibrit"]) {
    const subset = seg === "GLOBAL" ? rcKayitlari : rcKayitlari.filter((r) => r.segment === seg);
    if (subset.length === 0) continue;
    console.log(`\n========== ${seg} (n runner=${subset.length}, n yarış=${new Set(subset.map((r) => r.raceId)).size}) ==========`);
    magnitudeTablosu(subset);
  }

  console.log("\n\n--- Contribution Correlation Matrix (GLOBAL, Pearson) — en yüksek +/- eşleşmeler ---");
  korelasyonOzet(rcKayitlari);

  console.log("\n\n5/5 — Fixed-weight Full-minus-one ablation (race-level bootstrap, B=" + B_BOOTSTRAP + ")...");
  for (const seg of ["GLOBAL", "Düşük Şart", "Diğer", "Handikap", "Hibrit"]) {
    const subsetYarislar = seg === "GLOBAL" ? yarislar : yarislar.filter((y) => y.segment === seg);
    if (subsetYarislar.length < 10) { console.log(`\n${seg}: örneklem çok küçük (n=${subsetYarislar.length}), atlandı.`); continue; }
    console.log(`\n========== ${seg} (n yarış=${subsetYarislar.length}) — FIXED-WEIGHT OPERATIONAL VALUE ==========`);
    ablasyonTablosu(subsetYarislar);
  }

  console.log("\n\n--- AGF Üçlüsü Özel Tablo (GLOBAL) ---");
  agfUclusuTablosu(yarislar);
}

// ─── Magnitude ──────────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)));
  return sorted[idx];
}

function magnitudeTablosu(subset: { rc: Record<SinyalKodu, number>; aktif: Record<SinyalKodu, boolean>; isWinner: boolean }[]) {
  const sdByKod: Partial<Record<SinyalKodu, number>> = {};
  for (const kod of TUM_SINYAL_KODLARI) {
    const vals = subset.map((r) => r.rc[kod]);
    const ort = vals.reduce((a, b) => a + b, 0) / vals.length;
    sdByKod[kod] = Math.sqrt(vals.reduce((s, v) => s + (v - ort) ** 2, 0) / vals.length);
  }
  const sdToplam = TUM_SINYAL_KODLARI.reduce((s, kod) => s + sdByKod[kod]!, 0) || 1;

  console.log("Sinyal".padEnd(20) + "Kapsam%".padStart(9) + "SD".padStart(9) + "Ort|C|".padStart(9) + "P10".padStart(8) + "P50".padStart(8) + "P90".padStart(8) + "Kazanan".padStart(10) + "Kaybeden".padStart(10) + "SDPay%".padStart(9));
  for (const kod of TUM_SINYAL_KODLARI) {
    const vals = subset.map((r) => r.rc[kod]);
    const sorted = [...vals].sort((a, b) => a - b);
    const aktifOrani = subset.filter((r) => r.aktif[kod]).length / subset.length;
    const meanAbs = vals.reduce((s, v) => s + Math.abs(v), 0) / vals.length;
    const kazananlar = subset.filter((r) => r.isWinner).map((r) => r.rc[kod]);
    const kaybedenler = subset.filter((r) => !r.isWinner).map((r) => r.rc[kod]);
    const ort = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
    console.log(
      kod.padEnd(20) +
      (aktifOrani * 100).toFixed(0).padStart(8) + "%" +
      sdByKod[kod]!.toFixed(3).padStart(9) +
      meanAbs.toFixed(3).padStart(9) +
      percentile(sorted, 0.1).toFixed(2).padStart(8) +
      percentile(sorted, 0.5).toFixed(2).padStart(8) +
      percentile(sorted, 0.9).toFixed(2).padStart(8) +
      ort(kazananlar).toFixed(3).padStart(10) +
      ort(kaybedenler).toFixed(3).padStart(10) +
      ((sdByKod[kod]! / sdToplam) * 100).toFixed(1).padStart(8) + "%"
    );
  }
}

// ─── Korelasyon ─────────────────────────────────────────────────────────────

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; num += dx * dy; dx2 += dx * dx; dy2 += dy * dy; }
  return dx2 === 0 || dy2 === 0 ? 0 : num / Math.sqrt(dx2 * dy2);
}

function korelasyonOzet(rcKayitlari: RCKayit[]) {
  const matris: Record<string, Record<string, number>> = {};
  for (const j of TUM_SINYAL_KODLARI) {
    matris[j] = {};
    const xs = rcKayitlari.map((r) => r.rc[j]);
    for (const k of TUM_SINYAL_KODLARI) {
      if (j === k) { matris[j][k] = 1; continue; }
      matris[j][k] = pearson(xs, rcKayitlari.map((r) => r.rc[k]));
    }
  }
  console.log("Sinyal".padEnd(20) + "En yüksek (+)".padEnd(24) + "r".padStart(7) + "   En yüksek (−)".padEnd(24) + "r".padStart(7));
  for (const j of TUM_SINYAL_KODLARI) {
    const diger = TUM_SINYAL_KODLARI.filter((k) => k !== j);
    const enPozitif = diger.reduce((best, k) => (matris[j][k] > matris[j][best] ? k : best), diger[0]);
    const enNegatif = diger.reduce((best, k) => (matris[j][k] < matris[j][best] ? k : best), diger[0]);
    console.log(
      j.padEnd(20) + enPozitif.padEnd(24) + matris[j][enPozitif].toFixed(3).padStart(7) +
      "   " + enNegatif.padEnd(21) + matris[j][enNegatif].toFixed(3).padStart(7)
    );
  }
  console.log("\n(Tam 15×15 matris bellekte mevcut — istenirse ayrıca dökülebilir.)");
}

// ─── Fixed-weight Full-minus-one Ablation ───────────────────────────────────

function logSoftmaxKazananP(y: RaceKayit, probs: number[]): number {
  const idx = y.runners.findIndex((r) => r.isWinner);
  return probs[idx];
}

function skorHesapla(y: RaceKayit, haricKod: SinyalKodu | null): number[] {
  return y.runners.map((r) => TUM_SINYAL_KODLARI.reduce((s, kod) => (kod === haricKod ? s : s + r.katki[kod]), 0));
}

function ablasyonSatiri(yarislar: RaceKayit[], kod: SinyalKodu): {
  scoreSDShare: number; nokta: number | null; lo: number | null; hi: number | null;
  dTop1: number; dTop3: number; dWinnerRank: number; coverage: number;
} {
  const farklar: number[] = [];
  let top1Full = 0, top1Minus = 0, top3Full = 0, top3Minus = 0, rankFarkToplam = 0, n = 0;
  let aktifSayisi = 0, toplamRunner = 0;

  for (const y of yarislar) {
    const skorFull = skorHesapla(y, null);
    const skorMinus = skorHesapla(y, kod);
    const probsFull = softmax(skorFull, y.liderEsigi);
    const probsMinus = softmax(skorMinus, y.liderEsigi);

    const pFull = logSoftmaxKazananP(y, probsFull);
    const pMinus = logSoftmaxKazananP(y, probsMinus);
    farklar.push(-Math.log(Math.max(pMinus, 1e-9)) - -Math.log(Math.max(pFull, 1e-9)));
    n++;

    const siraliFullIdx = [...y.runners.keys()].sort((a, b) => probsFull[b] - probsFull[a]);
    const siraliMinusIdx = [...y.runners.keys()].sort((a, b) => probsMinus[b] - probsMinus[a]);
    const winnerIdx = y.runners.findIndex((r) => r.isWinner);
    const rankFull = siraliFullIdx.indexOf(winnerIdx) + 1;
    const rankMinus = siraliMinusIdx.indexOf(winnerIdx) + 1;
    rankFarkToplam += rankMinus - rankFull;
    if (rankFull === 1) top1Full++;
    if (rankMinus === 1) top1Minus++;
    if (rankFull <= 3) top3Full++;
    if (rankMinus <= 3) top3Minus++;

    for (const r of y.runners) { toplamRunner++; if (r.aktif[kod]) aktifSayisi++; }
  }

  const bootstrap = (() => {
    if (farklar.length < 5) return { nokta: null, lo: null, hi: null };
    const nokta = farklar.reduce((a, b) => a + b, 0) / farklar.length;
    const dagilim: number[] = [];
    for (let i = 0; i < B_BOOTSTRAP; i++) { let t = 0; for (let j2 = 0; j2 < farklar.length; j2++) t += farklar[Math.floor(Math.random() * farklar.length)]; dagilim.push(t / farklar.length); }
    dagilim.sort((a, b) => a - b);
    return { nokta, lo: dagilim[Math.floor(dagilim.length * 0.025)], hi: dagilim[Math.floor(dagilim.length * 0.975)] };
  })();

  return {
    scoreSDShare: 0, // ana tabloda magnitude'dan AYRICA raporlanıyor, burada N/A
    nokta: bootstrap.nokta, lo: bootstrap.lo, hi: bootstrap.hi,
    dTop1: (top1Minus - top1Full) / n, dTop3: (top3Minus - top3Full) / n,
    dWinnerRank: rankFarkToplam / n, coverage: aktifSayisi / toplamRunner,
  };
}

function ablasyonTablosu(yarislar: RaceKayit[]) {
  console.log("Sinyal".padEnd(20) + "ΔLL-remove".padStart(12) + "95% GA".padStart(22) + "ΔTop1".padStart(9) + "ΔTop3".padStart(9) + "ΔWinRank".padStart(10) + "Kapsam%".padStart(9) + "  Yorum");
  for (const kod of TUM_SINYAL_KODLARI) {
    const s = ablasyonSatiri(yarislar, kod);
    const anlamli = s.lo != null && s.hi != null && (s.lo > 0) === (s.hi > 0) && s.lo !== 0;
    const yorum = !anlamli ? "" : s.nokta! > 0 ? "çıkarmak KÖTÜLEŞTİRİYOR→yararlı" : "çıkarmak İYİLEŞTİRİYOR→zarar olabilir";
    const fmtPP = (v: number) => ((v >= 0 ? "+" : "") + (v * 100).toFixed(1)).padStart(9);
    console.log(
      kod.padEnd(20) +
      (s.nokta?.toFixed(5) ?? "?").padStart(12) +
      `[${s.lo?.toFixed(5) ?? "?"},${s.hi?.toFixed(5) ?? "?"}]`.padStart(22) +
      fmtPP(s.dTop1) +
      fmtPP(s.dTop3) +
      ((s.dWinnerRank >= 0 ? "+" : "") + s.dWinnerRank.toFixed(2)).padStart(10) +
      (s.coverage * 100).toFixed(0).padStart(8) + "%" +
      "  " + yorum
    );
  }
}

function agfUclusuTablosu(yarislar: RaceKayit[]) {
  for (const kod of ["agfSirasi", "agfPayi", "agfPayi2"] as SinyalKodu[]) {
    const s = ablasyonSatiri(yarislar, kod);
    console.log(`FULL - ${kod.padEnd(12)} ΔLL=${s.nokta?.toFixed(5)} 95%GA=[${s.lo?.toFixed(5)},${s.hi?.toFixed(5)}] ΔTop1=${(s.dTop1 * 100).toFixed(1)}pp ΔTop3=${(s.dTop3 * 100).toFixed(1)}pp`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
