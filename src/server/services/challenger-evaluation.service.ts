import { db } from "@/lib/db";

// 2026-08-29 — V6 Aşama 3 (bkz. plan). ChallengerRun.championSnapshot/challengerOutput
// challenger-shadow-log.service.ts'in ozetle() fonksiyonuyla YAZILAN şekli — burada da
// aynı minimal şekil okunuyor. Değiştirilirse İKİSİ BİRDEN güncellenmeli.
export type RunOzet = { no: number; olasilik: number }[];

export type ChallengerMetrics = {
  n: number; // koşu sayısı (runnerCount değil)
  top1: number; // oran, 0-1
  top3: number; // oran, 0-1
  avgLogloss: number; // kazananın olasılığından, düşük daha iyi
  avgBrier: number; // her at için (olasilik-gerçek)^2 ortalaması, düşük daha iyi
};

const EPS = 1e-6;

// 2026-08-29 — B=500 bootstrap TEST etmiyor (bkz. arac-challenger-degerlendir.mjs, o
// yapıyor) — bu yalnız NOKTA tahmini/admin özeti için. Bootstrap CI olmadan bu sayılara
// "kanıtlanmış" gözüyle BAKILMAMALI (bu oturumun temel dersi — tek nokta asla yeterli
// değil, bkz. feedback_riski_once_soyle).
export function metrikleriHesapla(runs: { output: RunOzet; actualOrder: number[] }[]): ChallengerMetrics {
  let top1 = 0;
  let top3 = 0;
  let loglossToplam = 0;
  let brierToplam = 0;
  let brierSayisi = 0;
  let n = 0;

  for (const { output, actualOrder } of runs) {
    if (output.length === 0 || actualOrder.length === 0) continue;
    n++;
    const winner = actualOrder[0];
    const top3Set = new Set(actualOrder.slice(0, 3));
    const siraliOutput = [...output].sort((a, b) => b.olasilik - a.olasilik);

    if (siraliOutput[0]?.no === winner) top1++;
    if (siraliOutput.slice(0, 3).some((r) => r.no === winner)) top3++;

    const kazananSatir = output.find((r) => r.no === winner);
    const p = Math.max(EPS, Math.min(1 - EPS, kazananSatir?.olasilik ?? EPS));
    loglossToplam += -Math.log(p);

    for (const r of output) {
      const gercek = r.no === winner ? 1 : 0;
      brierToplam += (r.olasilik - gercek) ** 2;
      brierSayisi++;
    }
  }

  return {
    n,
    top1: n > 0 ? top1 / n : 0,
    top3: n > 0 ? top3 / n : 0,
    avgLogloss: n > 0 ? loglossToplam / n : 0,
    avgBrier: brierSayisi > 0 ? brierToplam / brierSayisi : 0,
  };
}

export type ChallengerEvaluationRapor = Record<string, { n: number; champion: ChallengerMetrics; challenger: ChallengerMetrics }>;

/** Sonucu gelmiş TÜM ChallengerRun'ları (evaluatedAt'ten bağımsız — bu yalnız bir "işaretleme",
 *  raporu HİÇ etkilemez) Result ile eşleştirip challengerKey başına champion/challenger
 *  metriklerini döndürür. n < 250-300 iken bu rapor YALNIZ bilgi amaçlıdır, karar için
 *  arac-challenger-degerlendir.mjs'in B=500 GA'sı beklenmeli (bkz. plan, asgari örneklem barajı). */
export async function evaluateChallengerRuns(): Promise<ChallengerEvaluationRapor> {
  const runs = await db.challengerRun.findMany({
    where: { race: { result: { isNot: null } } },
    select: {
      challengerKey: true,
      championSnapshot: true,
      challengerOutput: true,
      race: { select: { result: { select: { actualOrder: true } } } },
    },
  });

  const championGrouped = new Map<string, { output: RunOzet; actualOrder: number[] }[]>();
  const challengerGrouped = new Map<string, { output: RunOzet; actualOrder: number[] }[]>();

  for (const run of runs) {
    const actualOrder = Array.isArray(run.race.result?.actualOrder) ? (run.race.result.actualOrder as number[]) : [];
    if (actualOrder.length === 0) continue;
    const championOutput = run.championSnapshot as unknown as RunOzet;
    const challengerOutput = run.challengerOutput as unknown as RunOzet;

    if (!championGrouped.has(run.challengerKey)) championGrouped.set(run.challengerKey, []);
    if (!challengerGrouped.has(run.challengerKey)) challengerGrouped.set(run.challengerKey, []);
    championGrouped.get(run.challengerKey)!.push({ output: championOutput, actualOrder });
    challengerGrouped.get(run.challengerKey)!.push({ output: challengerOutput, actualOrder });
  }

  const rapor: ChallengerEvaluationRapor = {};
  for (const key of challengerGrouped.keys()) {
    rapor[key] = {
      n: challengerGrouped.get(key)!.length,
      champion: metrikleriHesapla(championGrouped.get(key) ?? []),
      challenger: metrikleriHesapla(challengerGrouped.get(key) ?? []),
    };
  }
  return rapor;
}

/** Sonucu gelmiş ama henüz işaretlenmemiş ChallengerRun'ları evaluatedAt=now ile işaretler —
 *  yalnız "bu satır artık değerlendirilebilir durumda" bilgisi, raporu (yukarıdaki fonksiyon
 *  zaten TÜM sonuçlanmışlara bakıyor) etkilemez. */
export async function markChallengerRunsEvaluated(): Promise<number> {
  const result = await db.challengerRun.updateMany({
    where: { evaluatedAt: null, race: { result: { isNot: null } } },
    data: { evaluatedAt: new Date() },
  });
  return result.count;
}
