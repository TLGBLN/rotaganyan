"use server";
// Jokey Son 30 Gün Formu — ROTAGANYAN Jokey Son 30 Gün Performans Standardı (2026-10-11
// kullanıcı spesifikasyonu). JockeyStatSync KULLANMAZ. Kendi RaceDay+Race+Runner+Result
// geçmişimizden (yalnız raceDate'ten ÖNCEKİ yarışlar) hesaplanır. V5.46.1 scorer/weights'e
// BAĞLANMAZ — yalnız veri üretimi + admin/analiz gösterimi (narrative katmanı).
//
// KRİTİK TASARIM KARARI (kullanıcı, verbatim): "Jokey atın model skorunu şu anda
// değiştirmesin, fakat analiz kararını değiştirebilsin." Bu dosyadaki HİÇBİR fonksiyon
// v546-1-engine.ts'i, weights.json'ı veya bandeNoktala'yı ÇAĞIRMAZ/ETKİLEMEZ — yalnız
// ayrı bir "analiz heuristic'i" üretir. jokey30Form'un GERÇEK bir model feature'ı olması
// kararı yalnız frozen-PIT walk-forward OOS'tan geçip β kazanırsa verilir (bkz. scripts/
// v5461-audit/ — bu dosya o pipeline'a DOKUNMAZ, registry'ye ayrı bir FUTURE_CANDIDATE
// kaydı düşülür).
import { db } from "@/lib/db";
import { finishPos } from "@/lib/race-result";
import { reliability, K_REF_MIN_SAMPLE, classifyEtkinFormDurum, type JokeyGuncelForm, type JokeyHipodromForm } from "@/lib/jokey-form";

// Saf tipler/sabitler/sınıflandırma/metin-üretimi src/lib/jokey-form.ts'e taşındı ("use
// server" dosyaları YALNIZ ASYNC fonksiyon export edebilir. DÜZELTME (build'de yakalandı):
// `export type {...}` re-export'u bile Next.js'in Server Actions derleyicisinde "bu isimde
// bir action yok" hatasına yol açıyor (statik analiz, type-erasure'dan ÖNCE isimleri
// topluyor) — bu yüzden type'lar BURADA HİÇ re-export edilmiyor. Admin sayfası/
// V5AnalysisPanel/testler DOĞRUDAN @/lib/jokey-form'dan import eder.

/**
 * TÜM jokeyler için tek bulk sorgudan Son 30 Gün + (varsa) hipodrom formu üretir.
 * asOfDate: yalnız bundan KESİNLİKLE ÖNCEKİ yarışlar kullanılır (PIT). K_REF, son 30 günü
 * KESİNLİKLE DIŞLAR (kullanıcı spesifikasyonu madde 1) — kademeli: önce 31-180 gün, örneklem
 * (K_REF_MIN_SAMPLE=20) yetersizse 31-365 gün, hâlâ yetersizse son-30-gün-hariç TÜM geçmiş
 * (örneklem şartı YOK, mevcut veri ne ise o kullanılır — veri DIŞLANMAZ, yalnız kademe
 * genişler).
 */
export async function getJokeyFormTablosu(
  asOfDate: Date = new Date(),
  hippodromeId?: string | null
): Promise<Map<string, { guncel: JokeyGuncelForm; hipodrom: JokeyHipodromForm | null }>> {
  const son30Baslangic = new Date(asOfDate.getTime() - 30 * 86400000);
  const ref180Baslangic = new Date(asOfDate.getTime() - 180 * 86400000);
  const ref365Baslangic = new Date(asOfDate.getTime() - 365 * 86400000);

  const runners = await db.runner.findMany({
    where: { scratched: false, jockey: { not: null }, race: { result: { isNot: null }, raceDay: { date: { lt: asOfDate } } } },
    select: {
      no: true,
      jockey: true,
      race: {
        select: {
          raceDay: { select: { date: true, hippodromeId: true } },
          result: { select: { actualOrder: true, winnerNos: true } },
        },
      },
    },
  });

  type Toplam = { start: number; win: number; top3: number };
  const son30ByJokey = new Map<string, Toplam>();
  const ref180ByJokey = new Map<string, Toplam>(); // (son30Baslangic, ref180Baslangic] — yani 31-180 gün önce
  const ref365ByJokey = new Map<string, Toplam>(); // (son30Baslangic, ref365Baslangic] — yani 31-365 gün önce
  const careerEx30ByJokey = new Map<string, Toplam>(); // < son30Baslangic — son 30 gün HARİÇ tüm geçmiş
  const hipoByJokey = new Map<string, Toplam>();
  const ekle = (m: Map<string, Toplam>, jokey: string, win: number, top3: number) => {
    const t = m.get(jokey) ?? { start: 0, win: 0, top3: 0 };
    t.start++; t.win += win; t.top3 += top3;
    m.set(jokey, t);
  };

  for (const r of runners) {
    const jokey = r.jockey!;
    const pos = finishPos(r.race.result!.actualOrder, r.no, r.race.result!.winnerNos);
    if (pos == null) continue;
    const win = pos === 1 ? 1 : 0;
    const top3 = pos <= 3 ? 1 : 0;
    const d = r.race.raceDay.date;

    if (d >= son30Baslangic) {
      // PIT: d < asOfDate zaten WHERE'de garanti; son 30 gün penceresi.
      ekle(son30ByJokey, jokey, win, top3);
    } else {
      // Son 30 gün HARİÇ (kullanıcı kuralı — K_REF'e ASLA son 30 gün karışmaz).
      ekle(careerEx30ByJokey, jokey, win, top3);
      if (d >= ref180Baslangic) ekle(ref180ByJokey, jokey, win, top3);
      if (d >= ref365Baslangic) ekle(ref365ByJokey, jokey, win, top3);
    }
    if (hippodromeId && r.race.raceDay.hippodromeId === hippodromeId) ekle(hipoByJokey, jokey, win, top3);
  }

  function secKRef(jokey: string): { kRef: number; tier: JokeyGuncelForm["kRefTier"]; n: number } {
    const t180 = ref180ByJokey.get(jokey);
    if (t180 && t180.start >= K_REF_MIN_SAMPLE) return { kRef: t180.win / t180.start, tier: "31-180", n: t180.start };
    const t365 = ref365ByJokey.get(jokey);
    if (t365 && t365.start >= K_REF_MIN_SAMPLE) return { kRef: t365.win / t365.start, tier: "31-365", n: t365.start };
    const career = careerEx30ByJokey.get(jokey);
    if (career && career.start > 0) return { kRef: career.win / career.start, tier: "career-ex30", n: career.start };
    // Hiç referans verisi yok (jokeyin son 30 gün HARİCİNDE hiç kaydı yok) — K_REF
    // hesaplanamaz, formDelta de null kalır (buildGuncel içinde ele alınır).
    return { kRef: 0, tier: "none", n: 0 };
  }

  const sonuc = new Map<string, { guncel: JokeyGuncelForm; hipodrom: JokeyHipodromForm | null }>();
  for (const jokey of new Set(runners.map((r) => r.jockey!))) {
    const s = son30ByJokey.get(jokey) ?? { start: 0, win: 0, top3: 0 };
    const career = careerEx30ByJokey.get(jokey) ?? { start: 0, win: 0, top3: 0 };
    const { kRef, tier, n } = secKRef(jokey);
    const son30WinRate = s.start > 0 ? s.win / s.start : 0;
    const careerWinRate = career.start > 0 ? career.win / career.start : 0; // geriye-uyumluluk + hipodrom shrink hedefi
    const formDelta = s.start > 0 && tier !== "none" ? son30WinRate - kRef : null;
    const rel = reliability(s.start);
    const etkinForm = formDelta != null ? formDelta * rel : null;

    const guncel: JokeyGuncelForm = {
      son30Start: s.start, son30Win: s.win, son30WinRate,
      son30Top3: s.top3, son30Top3Rate: s.start > 0 ? s.top3 / s.start : 0,
      kRef, kRefTier: tier, kRefSampleN: n,
      formDelta,
      reliability: rel,
      etkinForm,
      durum: etkinForm != null ? classifyEtkinFormDurum(etkinForm * 100) : null,
      uzunDonemStart: career.start, uzunDonemWinRate: careerWinRate,
    };

    let hipodrom: JokeyHipodromForm | null = null;
    if (hippodromeId) {
      const h = hipoByJokey.get(jokey) ?? { start: 0, win: 0, top3: 0 };
      const relH = reliability(h.start);
      // Hipodrom shrink hedefi K_REF (career-ex30) — eski kodda "uzunDonemWinRate" (tüm
      // geçmiş, son 30 dahil) idi; artık K_REF ile AYNI "son 30 hariç" disiplinini paylaşıyor.
      const shrinkTarget = tier !== "none" ? kRef : careerWinRate;
      const hamWin = h.start > 0 ? h.win / h.start : shrinkTarget;
      const careerTop3Rate = career.start > 0 ? career.top3 / career.start : 0;
      const hamTop3 = h.start > 0 ? h.top3 / h.start : careerTop3Rate;
      const shrinkWin = relH * hamWin + (1 - relH) * shrinkTarget;
      const shrinkTop3 = relH * hamTop3 + (1 - relH) * careerTop3Rate;
      hipodrom = {
        hipoStart: h.start, hipoWin: h.win, hipoWinRateHam: hamWin, hipoWinRateShrink: shrinkWin,
        hipoTop3: h.top3, hipoTop3RateHam: hamTop3, hipoTop3RateShrink: shrinkTop3,
        hippoDelta: shrinkWin - shrinkTarget, reliability: relH,
      };
    }
    sonuc.set(jokey, { guncel, hipodrom });
  }
  return sonuc;
}
