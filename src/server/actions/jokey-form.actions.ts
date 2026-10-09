"use server";
// Jokey Son 30 Gün + Hipodrom Formu — PIT/as-of, JockeyStatSync KULLANMAZ. Kendi
// RaceDay+Race+Runner+Result geçmişimizden (yalnız raceDate'ten ÖNCEKİ yarışlar) hesaplanır.
// V5.46.1 scorer/weights'e BAĞLANMAZ — yalnız veri üretimi + admin görünümü.
import { db } from "@/lib/db";
import { finishPos } from "@/lib/race-result";

export interface JokeyGuncelForm {
  son30Start: number;
  son30Win: number;
  son30WinRate: number;
  son30Top3: number;
  son30Top3Rate: number;
  uzunDonemStart: number;
  uzunDonemWinRate: number;
  formDelta: number | null; // son30WinRate - uzunDonemWinRate; son30Start=0 ise null (hesaplanmaz)
  reliability: number; // son30Start/(son30Start+k)
}

export interface JokeyHipodromForm {
  hipoStart: number;
  hipoWin: number;
  hipoWinRateHam: number;
  hipoWinRateShrink: number; // reliability*ham + (1-reliability)*uzunDonemWinRate
  hipoTop3: number;
  hipoTop3RateHam: number;
  hipoTop3RateShrink: number;
  hippoDelta: number; // hipoWinRateShrink - uzunDonemWinRate
  reliability: number;
}

// Beyan edilmiş sabit (galibiyet seyrek bir olay — V5.46'daki k=2'den daha büyük seçildi,
// sonuca göre ayarlanmadı). n_eff/(n_eff+k).
const RELIABILITY_K = 8;
function reliability(n: number, k = RELIABILITY_K): number {
  return n <= 0 ? 0 : n / (n + k);
}

/**
 * TÜM jokeyler için tek bulk sorgudan Son 30 Gün + (varsa) hipodrom formu üretir.
 * asOfDate: yalnız bundan KESİNLİKLE ÖNCEKİ yarışlar kullanılır (PIT). hippodromeId
 * verilirse o hipodromdaki (tarih sınırı olmaksızın — yalnız asOfDate'ten önce) geçmiş de
 * hesaplanır ve jokeyin kendi uzun-dönem oranına shrink edilir.
 */
export async function getJokeyFormTablosu(
  asOfDate: Date = new Date(),
  hippodromeId?: string | null
): Promise<Map<string, { guncel: JokeyGuncelForm; hipodrom: JokeyHipodromForm | null }>> {
  const son30Baslangic = new Date(asOfDate.getTime() - 30 * 86400000);

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
  const uzunByJokey = new Map<string, Toplam>();
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
    ekle(uzunByJokey, jokey, win, top3);
    if (r.race.raceDay.date >= son30Baslangic) ekle(son30ByJokey, jokey, win, top3);
    if (hippodromeId && r.race.raceDay.hippodromeId === hippodromeId) ekle(hipoByJokey, jokey, win, top3);
  }

  const sonuc = new Map<string, { guncel: JokeyGuncelForm; hipodrom: JokeyHipodromForm | null }>();
  for (const jokey of new Set(runners.map((r) => r.jockey!))) {
    const s = son30ByJokey.get(jokey) ?? { start: 0, win: 0, top3: 0 };
    const u = uzunByJokey.get(jokey) ?? { start: 0, win: 0, top3: 0 };
    const son30WinRate = s.start > 0 ? s.win / s.start : 0;
    const uzunDonemWinRate = u.start > 0 ? u.win / u.start : 0;
    const uzunDonemTop3Rate = u.start > 0 ? u.top3 / u.start : 0;

    const guncel: JokeyGuncelForm = {
      son30Start: s.start, son30Win: s.win, son30WinRate,
      son30Top3: s.top3, son30Top3Rate: s.start > 0 ? s.top3 / s.start : 0,
      uzunDonemStart: u.start, uzunDonemWinRate,
      formDelta: s.start > 0 ? son30WinRate - uzunDonemWinRate : null,
      reliability: reliability(s.start),
    };

    let hipodrom: JokeyHipodromForm | null = null;
    if (hippodromeId) {
      const h = hipoByJokey.get(jokey) ?? { start: 0, win: 0, top3: 0 };
      const relH = reliability(h.start);
      const hamWin = h.start > 0 ? h.win / h.start : uzunDonemWinRate;
      const hamTop3 = h.start > 0 ? h.top3 / h.start : uzunDonemTop3Rate;
      const shrinkWin = relH * hamWin + (1 - relH) * uzunDonemWinRate;
      const shrinkTop3 = relH * hamTop3 + (1 - relH) * uzunDonemTop3Rate;
      hipodrom = {
        hipoStart: h.start, hipoWin: h.win, hipoWinRateHam: hamWin, hipoWinRateShrink: shrinkWin,
        hipoTop3: h.top3, hipoTop3RateHam: hamTop3, hipoTop3RateShrink: shrinkTop3,
        hippoDelta: shrinkWin - uzunDonemWinRate, reliability: relH,
      };
    }
    sonuc.set(jokey, { guncel, hipodrom });
  }
  return sonuc;
}
