// KALICI ARAÇ (2026-09-22) — J1: Jokey Gerçek Form Research Generator.
// Amaç: jokeyFormDegisimiZ ARAŞTIRMA sinyalinin leakage-safe historical feature dataset'ini
// üretip yalnız VERİ KALİTESİ raporunu vermek — HENÜZ regresyon fit ETMEZ, production'a
// HİÇBİR dokunuş yapmaz (V5.46 champion sabit, β eklenmez).
//
// Kaynak veri: scratchpad'deki model-veri-yg4-jokeyeffect.json (39.877 satır, 2026-01-01→
// 2026-09-10) — 13 A-katmanı ham özelliği + yakinsama2Plus'ın 5 alt-bileşeni (pistUzmani,
// sireOrani, ajiGalibiyetVarMi, agfFark, sinifDususu) + sire/zemin-mesafe (B-katmanı) + win
// zaten içeriyor. runnerId/raceId ile DB'ye join edilip tjkJokeyId (Faz J0) + gerçek tarih
// eklenir. NOT: cache 2026-09-10'da kesiliyor — en yeni ~11-12 gün (forward-capture dönemi
// dahil) bu ilk pass'te YOK, ayrı bir tazeleme adımı gerektirir (rapor içinde belirtiliyor).
//
// Metodoloji (kullanıcı spesifikasyonu, 2026-09-22, birebir):
//   - S_neutral: V5.46'nın GERÇEK skor zincirini (agirlikSetleriIcinKategori+harmanliSkorla+
//     bKatmaniUygula, v5-engine.ts'ten BİREBİR import) yeniden kurar, SONRA jokeyOrani VE
//     idmJokey katkılarını çıkarır, yakinsama2Plus'ı at-jokey bileşeni HARİÇ 4 bileşenden
//     yeniden hesaplayıp o TEK katkıyı değiştirir. B-katmanı (sire/zemin-mesafe) DOKUNULMAZ.
//   - Variant A: yalnız jokey-neutral (AGF dahil). Variant B: jokey-neutral + market-blind
//     (AGF_KATKI_INDEKSLERI de çıkarılır, v5-engine.ts'in marketBlindOlasiliklariHesapla'sıyla
//     AYNI 3 indeks).
//   - Kalibrasyon (T=1.5, lider eşiği %70 genel/%35 Handikap) NEUTRAL skor üzerinde YENİDEN
//     uygulanır — production'ın nihai P(WIN)'inden pay çıkarmak MATEMATİKSEL OLARAK YANLIŞ
//     olur (SINYAL-FORMULLERI.md §4 ile AYNI formül, v5-engine.ts'in private effektifSkorlar/
//     softmaxHam'ı export edilmediği için burada BİREBİR yeniden uygulanıyor — production kodu
//     DEĞİŞMEDİ, yalnız reuse edilemeyen bir private helper'ın AYNI matematiği kopyalandı).
//   - Dead-heat: y = 1/winnerCount (o yarışta win=1 olan satır sayısı).
//   - As-of D-1: bir ride'ın formu hesaplanırken YALNIZ o ride'ın tarihinden KESİN ÖNCEKİ
//     (D-1 ve öncesi) ride'lar kullanılır — aynı gün önceki yarışlar bile HARİÇ.
//   - QC (dondurulmuş, optimize EDİLMEDİ): N90>=30, N275>=60, E90>=2, E275>=4.
//
// Kullanım: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-jokey-form-generator.mts
import { readFileSync, writeFileSync } from "fs";
import {
  agirlikSetleriIcinKategori,
  harmanliSkorla,
  bKatmaniUygula,
  toFeatureVector,
  AGF_KATKI_INDEKSLERI,
  type Faz1RunnerV5,
} from "./src/lib/methodology/v5-engine";
import { db } from "./src/lib/db";

const CACHE_PATH =
  "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\model-veri-yg4-jokeyeffect.json";
const OUT_PATH =
  "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\jokey-form-dataset.json";

const ASIRI_GUVEN_LIDER_ESIGI = 0.7;
const ASIRI_GUVEN_LIDER_ESIGI_HANDIKAP = 0.35;
const ASIRI_GUVEN_SICAKLIGI = 1.5;

// FEATURE_NAMES sırası (v5-engine.ts toFeatureVector ile BİREBİR):
const IDX = {
  agfSirasi: 0, idmJokey: 1, jokeyOrani: 2, antrenorOrani: 3, agfPayi: 4, h2hNetSkor: 5,
  hizDerecesi: 6, agfPayi2: 7, zeminToleransi: 8, yakinsama2Plus: 9, sonIdmanSprint: 10,
  takiDegisikligi: 11, yarisGidisatiSkoru: 12,
};

type CacheRow = {
  raceId: string; runnerId: string; no: number; win: 0 | 1; kategori: string;
  agfSirasi: number; idmJokey: 0 | 1; jokeyOrani: number; antrenorOrani: number; agfPayi: number;
  h2hNetSkor: number; hizDerecesi: number; zeminToleransi: number; sonIdmanSprint: 0 | 1;
  takiEklendiMi: 0 | 1; takiCikarildiMi: 0 | 1; yarisGidisatiSkoru: number;
  sireOrani: number; zeminMesafeDeneyim: number;
  pistUzmani: 0 | 1; ajiGalibiyetVarMi: 0 | 1; agfFark: number; sinifDususu: 0 | 1;
  [k: string]: unknown;
};

function softmax(scores: number[]): number[] {
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}
// v5-engine.ts'in private effektifSkorlar+softmaxHam'ıyla BİREBİR AYNI matematik (bkz. dosya
// başı not) — production kodu import EDİLEMEDİĞİ için burada yeniden uygulanıyor, DEĞİŞTİRİLMEDİ.
function kalibreliOlasilik(scores: number[], liderEsigi: number): number[] {
  const raw = softmax(scores);
  const maxRaw = Math.max(...raw);
  const T = maxRaw >= liderEsigi ? ASIRI_GUVEN_SICAKLIGI : 1;
  return softmax(scores.map((s) => s / T));
}

function yakinsama2PlusNeutral(runners: CacheRow[]): number[] {
  // arac-yeni-sinyal-challenger-test.mts'teki yakinsama2PlusEkle ile AYNI desen — yalnız
  // ajiGalibiyetVarMi (at-jokey bileşeni) HARİÇ tutuluyor, kullanıcı talebi.
  const sireSirali = [...runners].sort((a, b) => (b.sireOrani ?? 0) - (a.sireOrani ?? 0));
  const sireRankOf = new Map(sireSirali.map((r, i) => [r, i + 1]));
  return runners.map((r) => {
    const pistUzmaniPoz = (r.pistUzmani ?? 0) === 1;
    const sirePoz = (sireRankOf.get(r) ?? 999) <= 2;
    const agfTrendPoz = (r.agfFark ?? 0) >= 1.0;
    const sinifDususuPoz = (r.sinifDususu ?? 0) === 1;
    const sayi = [pistUzmaniPoz, sirePoz, agfTrendPoz, sinifDususuPoz].filter(Boolean).length;
    return sayi >= 2 ? 1 : 0;
  });
}

// 2026-09-22 KRİTİK DÜZELTME: model-veri-yg4-jokeyeffect.json cache'inde `agfPayi2` VE tam
// `yakinsama2Plus` (yalnız 5 alt-bileşeni: pistUzmani/sireOrani/ajiGalibiyetVarMi/agfFark/
// sinifDususu var) DOĞRUDAN ALAN OLARAK YOK — toFeatureVector bunları ham `r.agfPayi2`/
// `r.yakinsama2Plus` olarak okuyor, eksik olunca undefined→NaN→TÜM softmax'ı (Math.max NaN
// içerince NaN döner) bozuyordu (ilk çalıştırmada TÜM pA/pB null çıktı, kök neden burada
// bulundu). Bu fonksiyon FULL (ajiGalibiyetVarMi DAHİL — S_full için gerekli) yakinsama2Plus'ı
// hesaplayıp agfPayi2 ile birlikte satırlara ekler.
function eksikTurevAlanlariEkle(runners: CacheRow[]): (CacheRow & { agfPayi2: number; yakinsama2Plus: number })[] {
  const sireSirali = [...runners].sort((a, b) => (b.sireOrani ?? 0) - (a.sireOrani ?? 0));
  const sireRankOf = new Map(sireSirali.map((r, i) => [r, i + 1]));
  return runners.map((r) => {
    const pistUzmaniPoz = (r.pistUzmani ?? 0) === 1;
    const sirePoz = (sireRankOf.get(r) ?? 999) <= 2;
    const ajiPoz = (r.ajiGalibiyetVarMi ?? 0) === 1;
    const agfTrendPoz = (r.agfFark ?? 0) >= 1.0;
    const sinifDususuPoz = (r.sinifDususu ?? 0) === 1;
    const sayi = [pistUzmaniPoz, sirePoz, ajiPoz, agfTrendPoz, sinifDususuPoz].filter(Boolean).length;
    return { ...r, agfPayi2: r.agfPayi * r.agfPayi, yakinsama2Plus: sayi >= 2 ? 1 : 0 };
  });
}

type Sonuc = {
  raceId: string; runnerId: string; tjkJokeyId: number | null; date: string; kategori: string;
  win: 0 | 1; winnerCount: number; y: number;
  pA: number; pB: number; rA: number; rB: number;
};

async function main() {
  console.log("Cache okunuyor...");
  const raw: CacheRow[] = JSON.parse(readFileSync(CACHE_PATH, "utf-8"));
  console.log(`  ${raw.length} satır.`);

  const raceIds = [...new Set(raw.map((r) => r.raceId))];
  const runnerIds = [...new Set(raw.map((r) => r.runnerId))];
  console.log(`Bulk join: ${raceIds.length} raceId, ${runnerIds.length} runnerId...`);

  const races = await db.race.findMany({
    where: { id: { in: raceIds } },
    select: { id: true, raceDay: { select: { date: true } } },
  });
  const dateByRaceId = new Map(races.map((r) => [r.id, r.raceDay.date.toISOString().slice(0, 10)]));

  const runners = await db.runner.findMany({
    where: { id: { in: runnerIds } },
    select: { id: true, tjkJokeyId: true },
  });
  const jokeyIdByRunnerId = new Map(runners.map((r) => [r.id, r.tjkJokeyId]));
  await db.$disconnect();

  const kimlikliSatir = raw.filter((r) => jokeyIdByRunnerId.get(r.runnerId) != null).length;
  console.log(`\nKimlik kapsamı: ${raw.length} satırdan ${kimlikliSatir} tanesinde tjkJokeyId var (%${((kimlikliSatir / raw.length) * 100).toFixed(1)}).`);

  // ── Race bazlı gruplama + S_neutral hesaplama ──────────────────────────
  const byRace = new Map<string, CacheRow[]>();
  for (const r of raw) {
    const arr = byRace.get(r.raceId) ?? [];
    arr.push(r);
    byRace.set(r.raceId, arr);
  }

  const sonuclar: Sonuc[] = [];
  let raceSayaci = 0;
  for (const [raceId, runnersInRaceHam] of byRace) {
    raceSayaci++;
    if (runnersInRaceHam.length < 2) continue;
    const runnersInRace = eksikTurevAlanlariEkle(runnersInRaceHam);
    const kategori = runnersInRace[0].kategori;
    const setler = agirlikSetleriIcinKategori(kategori);
    const yakinsamaNeutralBit = yakinsama2PlusNeutral(runnersInRace);

    const skorlarFull: number[] = [];
    const katkilarListesi: number[][] = [];
    const skorlarNeutralA: number[] = [];
    for (let i = 0; i < runnersInRace.length; i++) {
      const r = runnersInRace[i];
      const vec = toFeatureVector(r as unknown as Faz1RunnerV5);
      const { skor, katkilar } = harmanliSkorla(vec, setler);
      katkilarListesi.push(katkilar);
      skorlarFull.push(skor);

      // Yakınsama neutral z-skoru: AYNI ws.means/ws.stds ile, yalnız yeni raw bit kullanılarak.
      let yakinsamaNeutralKatki = 0;
      for (const ws of setler) {
        const z = ws.stds[IDX.yakinsama2Plus] > 1e-9 ? (yakinsamaNeutralBit[i] - ws.means[IDX.yakinsama2Plus]) / ws.stds[IDX.yakinsama2Plus] : 0;
        yakinsamaNeutralKatki += (ws.weights[IDX.yakinsama2Plus] * z) / setler.length;
      }
      const sNeutralA = skor - katkilar[IDX.idmJokey] - katkilar[IDX.jokeyOrani] - katkilar[IDX.yakinsama2Plus] + yakinsamaNeutralKatki;
      skorlarNeutralA.push(sNeutralA);
    }

    // B-katmanı (sire/zemin-mesafe) — DOKUNULMADI, zaten skor'un (toFeatureVector öncesi
    // DEĞİL, harmanliSkorla SONRASI) parçası değil, ayrı ekleniyor (v5-engine.ts deseniyle
    // BİREBİR aynı sırayla, bKatmaniUygula skorlarFull ÜZERİNE ekler).
    const sahteClassType = kategori === "1a" || kategori === "1b" ? "MAIDEN" : kategori === "2" ? "Handikap 1" : "ŞARTLI 3";
    const runnersDoldurulmus = runnersInRace.map((r) => ({ ...r, zeminMesafeDeneyimSeviyesi: r.zeminMesafeDeneyim !== 0 ? "tam" : "yok" }));
    const bFull = bKatmaniUygula(skorlarFull, runnersDoldurulmus as unknown as Faz1RunnerV5[], sahteClassType);
    const bNeutralA = bKatmaniUygula(skorlarNeutralA, runnersDoldurulmus as unknown as Faz1RunnerV5[], sahteClassType);
    const skorlarFullB = bFull.skorlar;
    const skorlarNeutralAB = bNeutralA.skorlar;

    // Variant B (market-blind): AGF katkıları (orijinal katkilarListesi'nden, B-katmanı
    // ÖNCESİ) skorlarNeutralAB'den ayrıca çıkarılır.
    const skorlarNeutralB = skorlarNeutralAB.map((s, i) => s - AGF_KATKI_INDEKSLERI.reduce((t, idx) => t + katkilarListesi[i][idx], 0));

    const liderEsigi = kategori === "2" ? ASIRI_GUVEN_LIDER_ESIGI_HANDIKAP : ASIRI_GUVEN_LIDER_ESIGI;
    const pA = kalibreliOlasilik(skorlarNeutralAB, liderEsigi);
    const pB = kalibreliOlasilik(skorlarNeutralB, liderEsigi);

    const winnerCount = runnersInRace.filter((r) => r.win === 1).length || 1;
    const date = dateByRaceId.get(raceId);
    if (!date) continue;

    for (let i = 0; i < runnersInRace.length; i++) {
      const r = runnersInRace[i];
      const y = r.win === 1 ? 1 / winnerCount : 0;
      sonuclar.push({
        raceId, runnerId: r.runnerId, tjkJokeyId: jokeyIdByRunnerId.get(r.runnerId) ?? null,
        date, kategori,
        win: r.win, winnerCount, y,
        pA: pA[i], pB: pB[i], rA: y - pA[i], rB: y - pB[i],
      });
    }
    if (raceSayaci % 500 === 0) console.log(`  ...${raceSayaci}/${byRace.size} koşu işlendi`);
  }
  console.log(`Toplam işlenen satır: ${sonuclar.length}`);

  // ── Jokey bazlı kronolojik indeks ────────────────────────────────────────
  const kimlikli = sonuclar.filter((s) => s.tjkJokeyId != null);
  const byJockey = new Map<number, Sonuc[]>();
  for (const s of kimlikli) {
    const arr = byJockey.get(s.tjkJokeyId!) ?? [];
    arr.push(s);
    byJockey.set(s.tjkJokeyId!, arr);
  }
  for (const arr of byJockey.values()) arr.sort((a, b) => a.date.localeCompare(b.date));

  console.log(`Benzersiz jokey (kimlikli): ${byJockey.size}`);

  writeFileSync(OUT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), rows: sonuclar }, null, 0));
  console.log(`\nAra veri kaydedildi: ${OUT_PATH}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
