// ROTAGANYAN ANALİZ MOTORU v1.0 — ANT/ANTRENÖR ailesi.
//
// KULLANICI TALİMATI (2026-10-19): "ANT ailesini yalnız registry'de bırakma... mevcut veri
// kaynaklarını inceleyerek hesaplanabilir özelliklerini motor akışına dahil et."
//
// Registry'nin ANT_01/02'si TrainerStatSync'i (yıl-kümülatif, zaman-penceresiz, CANLI/
// mutable) temel alıp "ÇÖZÜLMEMİŞ KRİTİK SORUN" diye bloke etmişti — bu, V5.46.1'in
// antrenorOrani'nde BULUNAN AYNI sızıntı sınıfı (bu oturumda daha önce doğrulandı). Çözüm,
// JOKEY_TREND30/getV5461SireOzetleriForRace'in AYNI deseni: TrainerStatSync'e HİÇ
// dokunmadan, Runner/Race/Result'tan HER çağrıda sıfırdan, cutoff'lu hesaplama.

import { db } from "@/lib/db";
import { finishPos } from "@/lib/race-result";
import { logit, shrinkageFactor } from "./common";

const ANT_TREND_SHRINKAGE_K = 15; // JOKEY_TREND30 ile AYNI dürüstlük ilkesi — GEÇİCİ
const MIN_BINIS_ICIN_GUVENILIR = 5;

type Mount = { position: number | null; fieldSize: number };

async function queryTrainerMounts(trainerName: string, windowStart: Date, windowEnd: Date): Promise<Mount[]> {
  const rows = await db.runner.findMany({
    where: { trainer: trainerName, scratched: false, race: { raceDay: { date: { gte: windowStart, lt: windowEnd } } } },
    select: {
      no: true,
      race: { select: { result: { select: { actualOrder: true, winnerNos: true } }, runners: { where: { scratched: false }, select: { id: true } } } },
    },
  });
  return rows.map((r) => ({
    position: finishPos(r.race.result?.actualOrder ?? null, r.no, r.race.result?.winnerNos ?? null),
    fieldSize: r.race.runners.length,
  }));
}

function laplaceP(wins: number, n: number): number {
  return (wins + 1) / (n + 2);
}

export type AntrenorTrendResult = {
  son30: { wins: number; observed: number; p: number | null };
  onceki30: { wins: number; observed: number; p: number | null };
  rawTrend: number | null;
  value: number | null;
  observed: boolean;
  mountQualityControlled: false; // JOKEY_TREND30 ile AYNI, acikca belirtilen kisit
  missingReason: string | null;
};

/**
 * ANT_TREND — antrenörün son-30-gün NAİF (1/saha-büyüklüğü referansı) galibiyet oranının,
 * önceki-30-güne göre logit farkı. JOKEY_TREND30 İLE BİREBİR AYNI mimari/dürüstlük
 * kısıtları (mountQualityControlled:false — at kalitesi düzeltmesi YOK).
 */
export async function computeAntrenorTrend30(trainerName: string | null, cutoff: Date): Promise<AntrenorTrendResult> {
  const empty = (missingReason: string): AntrenorTrendResult => ({
    son30: { wins: 0, observed: 0, p: null }, onceki30: { wins: 0, observed: 0, p: null },
    rawTrend: null, value: null, observed: false, mountQualityControlled: false, missingReason,
  });
  if (trainerName == null) return empty("antrenör adı bilinmiyor");

  const son30Start = new Date(cutoff.getTime() - 30 * 86_400_000);
  const onceki30Start = new Date(cutoff.getTime() - 60 * 86_400_000);

  const [son30Mounts, onceki30Mounts] = await Promise.all([
    queryTrainerMounts(trainerName, son30Start, cutoff),
    queryTrainerMounts(trainerName, onceki30Start, son30Start),
  ]);

  const stat = (mounts: Mount[]) => {
    let wins = 0, observed = 0;
    for (const m of mounts) { if (m.fieldSize >= 2 && m.position != null) { observed++; if (m.position === 1) wins++; } }
    return { wins, observed };
  };
  const s1 = stat(son30Mounts), s2 = stat(onceki30Mounts);

  if (s1.observed === 0 || s2.observed === 0) {
    return {
      son30: { wins: s1.wins, observed: s1.observed, p: s1.observed > 0 ? s1.wins / s1.observed : null },
      onceki30: { wins: s2.wins, observed: s2.observed, p: s2.observed > 0 ? s2.wins / s2.observed : null },
      rawTrend: null, value: null, observed: false, mountQualityControlled: false,
      missingReason: s1.observed === 0 && s2.observed === 0 ? "iki pencerede de hiç gözlemli biniş yok" : s1.observed === 0 ? "son 30 günde gözlemli biniş yok" : "önceki 30 günde gözlemli biniş yok",
    };
  }

  const p1 = laplaceP(s1.wins, s1.observed);
  const p2 = laplaceP(s2.wins, s2.observed);
  const rawTrend = logit(p1) - logit(p2);
  const combinedN = Math.min(s1.observed, s2.observed);
  const shrink = shrinkageFactor(combinedN, ANT_TREND_SHRINKAGE_K);
  const value = rawTrend * shrink;

  return {
    son30: { wins: s1.wins, observed: s1.observed, p: s1.wins / s1.observed },
    onceki30: { wins: s2.wins, observed: s2.observed, p: s2.wins / s2.observed },
    rawTrend, value, observed: true, mountQualityControlled: false,
    missingReason: combinedN < MIN_BINIS_ICIN_GUVENILIR ? `düşük örneklem (min(n1,n2)=${combinedN}) — ağır küçültüldü, UYDURULMADI` : null,
  };
}
