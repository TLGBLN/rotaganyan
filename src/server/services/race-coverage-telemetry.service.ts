// 2026-09-22 — V5.46 LIVE Audit Protocol, FAZ E sonrası kullanıcı kararı: cache-mimarisi
// düzeltmesinin (HOT/WARM/COLD, bkz. tjk-at-profil.adapter.ts syncHorseStatsCache) modele
// giden veriyi GERÇEKTEN iyileştirdiğini yalnız FORWARD (yeni, yayından sonraki) yarışlarda
// tahmin anında (sonuç bilinmeden) ölçerek kanıtlayabiliriz. Bu servis, bir Prediction
// YAYINLANDIĞI anda çağrılır (upsertPrediction'dan after() ile, bloklamayan) — Prediction'ın
// kendisine DOKUNMAZ, ayrı bir gözlem kaydı (RaceCoverageTelemetry) yazar.
//
// KRİTİK KURAL (FAZ A.1 dersi): coverage HİÇBİR ZAMAN contribution'dan (β×z) türetilmez,
// yalnız ham usableAccuraceCount (Accurace geçmiş kaydı sayısı, as-of raceDate) üzerinden.
import { db } from "@/lib/db";
import { classTypeGroup } from "@/server/services/admin.service";

const TRAILING_COUNTRY_CODE_RE = /\s*\([A-Z]{2,3}\)\s*$/;
function accuraceQueryNames(names: string[]): string[] {
  const out = new Set<string>();
  for (const n of names) {
    out.add(n);
    const stripped = n.replace(TRAILING_COUNTRY_CODE_RE, "").trim();
    if (stripped) out.add(stripped);
  }
  return [...out];
}

function ygStatus(active: number): "NONE" | "LOW" | "PARTIAL" | "FULL" {
  if (active === 0) return "NONE";
  if (active <= 2) return "LOW";
  if (active <= 5) return "PARTIAL";
  return "FULL";
}

type RunnerDetail = {
  horse: string;
  tjkAtId: number | null;
  usableAccuraceCount: number;
  cacheUpdatedAt: string | null;
  cacheAgeHours: number | null;
  sourceObserved: boolean; // usableAccuraceCount >= 3 (ham veri, contribution DEĞİL)
  productionEligible: boolean; // bu segmentte yarisGidisatiSkoru β=0 mı (Handikap'ta false)
};

/** Bir raceId için coverage telemetrisini hesaplar ve RaceCoverageTelemetry'ye yazar.
 *  Hata durumunda SESSİZCE yutulur — Prediction akışını asla etkilemez (çağıran taraf
 *  zaten after() içinde çağırıyor, ama fonksiyonun kendisi de savunmacı). */
export async function captureRaceCoverageTelemetry(raceId: string): Promise<void> {
  try {
    const race = await db.race.findUnique({
      where: { id: raceId },
      select: {
        classType: true,
        raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
        prediction: { select: { createdAt: true } },
        runners: { where: { scratched: false }, select: { name: true, tjkAtId: true } },
      },
    });
    if (!race || !race.prediction || race.runners.length === 0) return;

    const grup = classTypeGroup(race.classType);
    // yarisGidisatiSkoru β=0 olan TEK segment Handikap (bkz. WEIGHTS_DIGER_HANDIKAP, v5-engine.ts)
    const productionEligible = grup !== "Handikap Koşular";

    const names = accuraceQueryNames(race.runners.map((r) => r.name));
    const accRows = names.length
      ? await db.accuraceHorseSplit.findMany({
          where: { horseName: { in: names }, accuraceRace: { date: { lt: race.raceDay.date } } },
          select: { horseName: true },
        })
      : [];
    const accCountByName = new Map<string, number>();
    for (const r of accRows) accCountByName.set(r.horseName, (accCountByName.get(r.horseName) ?? 0) + 1);

    const tjkAtIds = race.runners.map((r) => r.tjkAtId).filter((id): id is number => id != null);
    const [statsCaches, historyCaches] = await Promise.all([
      tjkAtIds.length ? db.horseStatsCache.findMany({ where: { tjkAtId: { in: tjkAtIds } }, select: { tjkAtId: true, updatedAt: true } }) : Promise.resolve([]),
      tjkAtIds.length ? db.horseRaceHistoryCache.findMany({ where: { tjkAtId: { in: tjkAtIds } }, select: { tjkAtId: true, updatedAt: true } }) : Promise.resolve([]),
    ]);
    const statsUpdatedById = new Map(statsCaches.map((c) => [c.tjkAtId, c.updatedAt]));
    const historyUpdatedById = new Map(historyCaches.map((c) => [c.tjkAtId, c.updatedAt]));

    const now = Date.now();
    let ygActive = 0;
    let cacheFresh = 0;
    let cacheStale = 0;
    const runnersJson: RunnerDetail[] = [];

    for (const run of race.runners) {
      const stripped = run.name.replace(TRAILING_COUNTRY_CODE_RE, "").trim();
      const usable = (accCountByName.get(run.name) ?? 0) + (stripped !== run.name ? accCountByName.get(stripped) ?? 0 : 0);
      const sourceObserved = usable >= 3;
      if (sourceObserved) ygActive++;

      let cacheUpdatedAt: Date | null = null;
      if (run.tjkAtId != null) {
        const s = statsUpdatedById.get(run.tjkAtId);
        const h = historyUpdatedById.get(run.tjkAtId);
        if (s && h) cacheUpdatedAt = s.getTime() < h.getTime() ? s : h; // ikisinden ESKİ olan — ikisi de taze OLMALI
        else cacheUpdatedAt = s ?? h ?? null;
      }
      // Basit, tek-eşikli tazelik (3 gün — WARM SLA'sı, çoğu at için geçerli varsayım;
      // kesin tier hesabı syncHorseStatsCache'in kendi mantığında, burada yalnız gözlem).
      const cacheAgeHours = cacheUpdatedAt ? (now - cacheUpdatedAt.getTime()) / 3_600_000 : null;
      const fresh = cacheAgeHours != null && cacheAgeHours <= 72;
      if (run.tjkAtId != null) { if (fresh) cacheFresh++; else cacheStale++; }

      runnersJson.push({
        horse: run.name,
        tjkAtId: run.tjkAtId,
        usableAccuraceCount: usable,
        cacheUpdatedAt: cacheUpdatedAt?.toISOString() ?? null,
        cacheAgeHours: cacheAgeHours != null ? Math.round(cacheAgeHours * 10) / 10 : null,
        sourceObserved,
        productionEligible,
      });
    }

    const fieldSize = race.runners.length;
    await db.raceCoverageTelemetry.create({
      data: {
        raceId,
        predictionCreatedAt: race.prediction.createdAt,
        raceDate: race.raceDay.date,
        hippodrome: race.raceDay.hippodrome.name,
        raceClass: race.classType,
        classTypeGroup: grup,
        fieldSize,
        ygActiveRunnerCount: ygActive,
        ygCoverageRatio: fieldSize > 0 ? ygActive / fieldSize : 0,
        ygStatus: ygStatus(ygActive),
        cacheFreshCount: cacheFresh,
        cacheStaleCount: cacheStale,
        runnersJson: runnersJson as unknown as object,
      },
    });
  } catch (e) {
    console.error("[captureRaceCoverageTelemetry] hata (Prediction akışını ETKİLEMEZ):", e);
  }
}
