// Prediction-to-HomeKupon Auto Synchronization (2026-09-21, bkz. plan) — iki tetikleyici:
// (1) `upsertPrediction` sonrası ANLIK `after()` çağrısı (rebuildAffectedHomeKupons), ve
// (2) 5 dakikalık reconciliation cron'u (reconcileAllActiveHomeKupons) — (1) tek başına
// fail-safe SAYILMAZ (geçici hata/hiçbir sonraki Prediction değişikliği olmazsa kupon
// SÜRESİZ bayat kalabilir), (2) kaçırılan HERHANGİ bir senkronu en geç 5 dakikada onarır.
import { db } from "@/lib/db";
import { recordKuponSyncRun } from "@/server/services/kupon-sync-state.service";
import { syncHomeKupon } from "@/server/actions/home-kupon.actions";
import {
  dependencyHashForRace,
  normalizeManualOverrides,
  manualOverridesHash,
  buildKey as computeBuildKey,
  poolStartTime,
  type DependencyRaceInput,
} from "@/lib/methodology/kupon-dependency-hash";
import {
  stakeForHippodrome,
  YEDILI_GANYAN_STAKE_PER_COMBINATION,
  LIMITS,
  TOLERANCES,
  YEDILI_LIMITS,
  YEDILI_TOLERANCES,
  YEDILI_GANYAN_SLOT,
} from "@/lib/methodology/kupon-auto-fill";

type HomeKuponLeg = { raceNo: number; narrow: number[]; normal: number[]; wide: number[] };

// 2026-09-24 — Sistem Anatomisi Kupon sensörü: gerçek stake/limit çözümleme mantığını
// (slot===7 mi, hangi hipodrom indirimli mi) reuse etmek için dışa açıldı — sensör kendi
// kopyasını yazmasın diye (kullanıcı talimatı: "birim bedeli sensöre hard-code etme").
export function optimizerConfigFor(baseHippodromeName: string, slot: number) {
  if (slot === YEDILI_GANYAN_SLOT) {
    return { stakePerCombination: YEDILI_GANYAN_STAKE_PER_COMBINATION, limits: YEDILI_LIMITS, tolerances: YEDILI_TOLERANCES };
  }
  return { stakePerCombination: stakeForHippodrome(baseHippodromeName), limits: LIMITS, tolerances: TOLERANCES };
}

/** Bir raceId'yi İÇEREN, `sourcePredictionsHash` DOLU (rollout-öncesi legacy'ler HARİÇ —
 * bkz. plan PİVOT-2 madde 15c) tüm aktif HomeKupon satırlarını bulur. */
export async function findActiveHomeKuponsForRace(raceId: string) {
  const race = await db.race.findUnique({
    where: { id: raceId },
    select: { raceNo: true, raceDay: { select: { date: true, hippodrome: { select: { name: true } } } } },
  });
  if (!race) return [];

  const candidates = await db.homeKupon.findMany({
    where: {
      date: race.raceDay.date,
      hippodromeName: { startsWith: race.raceDay.hippodrome.name },
      isActive: true,
      sourcePredictionsHash: { not: null },
    },
    select: { id: true, hippodromeName: true, date: true, slot: true, legs: true, manualOverrides: true },
  });

  return candidates.filter((k) => {
    const legs = k.legs as unknown as HomeKuponLeg[];
    return Array.isArray(legs) && legs.some((l) => l.raceNo === race.raceNo);
  });
}

/** `upsertPrediction` sonrası ANLIK tetik — bu raceId'yi içeren TÜM aktif havuzları
 * `syncHomeKupon` ile yeniden senkronlar. Hatalar birbirini ETKİLEMEZ. */
export async function rebuildAffectedHomeKupons(raceId: string): Promise<void> {
  const affected = await findActiveHomeKuponsForRace(raceId);
  if (affected.length === 0) return;

  const t0 = Date.now();
  const settled = await Promise.allSettled(
    affected.map((k) => {
      const legs = k.legs as unknown as HomeKuponLeg[];
      const raceNos = legs.map((l) => l.raceNo);
      return syncHomeKupon({
        hippodromeName: k.hippodromeName,
        date: k.date.toISOString().slice(0, 10),
        slot: k.slot,
        raceNos,
        manualOverrides: k.manualOverrides ?? {},
        source: "prediction-change",
      });
    })
  );
  const failed = settled.filter((s) => s.status === "rejected") as PromiseRejectedResult[];
  await recordKuponSyncRun({
    ok: failed.length === 0,
    durationMs: Date.now() - t0,
    processed: affected.length,
    synced: affected.length - failed.length,
    error: failed.length > 0 ? String(failed[0].reason) : undefined,
    source: "prediction-change",
  });
}

/** 5 dakikalık reconciliation cron'unun çekirdeği — `after()`'ın kaçırdığı HERHANGİ bir
 * senkronu onarır. Freshness kriteri yalnız `sourcePredictionsHash` DEĞİL, TÜM
 * `expectedBuildKey`dir (Prediction + manualOverrides + optimizer kod-revizyonu
 * değişikliklerinin ÜÇÜNÜ de tek karşılaştırmada yakalar — bkz. plan PİVOT-2 madde 15e
 * son düzeltmesi). Pool-start freeze BURADA da uygulanır (yalnız gereksiz iş yapmamak
 * için — asıl garanti `syncHomeKupon`'un kendi içinde). */
export async function reconcileAllActiveHomeKupons(): Promise<{ checked: number; synced: number }> {
  const t0 = Date.now();
  try {
    const result = await reconcileAllActiveHomeKuponsInner();
    await recordKuponSyncRun({ ok: true, durationMs: Date.now() - t0, processed: result.checked, synced: result.synced, source: "reconcile" });
    return result;
  } catch (e) {
    await recordKuponSyncRun({ ok: false, durationMs: Date.now() - t0, error: e instanceof Error ? e.message : String(e), source: "reconcile" });
    throw e;
  }
}

async function reconcileAllActiveHomeKuponsInner(): Promise<{ checked: number; synced: number }> {
  const rows = await db.homeKupon.findMany({
    where: { isActive: true, sourcePredictionsHash: { not: null } },
    select: { id: true, hippodromeName: true, date: true, slot: true, legs: true, manualOverrides: true, buildKey: true },
  });

  let checked = 0;
  let synced = 0;

  for (const row of rows) {
    const legs = row.legs as unknown as HomeKuponLeg[];
    if (!Array.isArray(legs) || legs.length === 0) continue;
    const raceNos = legs.map((l) => l.raceNo);
    const baseHippodromeName = row.hippodromeName.split(" — ")[0];
    const dateIso = row.date.toISOString().slice(0, 10);

    const races = await db.race.findMany({
      where: { raceNo: { in: raceNos }, raceDay: { date: row.date, hippodrome: { name: baseHippodromeName } } },
      select: {
        raceNo: true,
        time: true,
        runners: { select: { id: true, no: true, scratched: true, ekuriGroup: true } },
        prediction: {
          select: {
            pistDuyarliligi: true,
            gecmisRiskSeviyesi: true,
            picks: { select: { runnerId: true, score: true, scoreExact: true } },
          },
        },
      },
    });
    if (races.length === 0) continue;

    // Pool-start freeze — yalnız gereksiz işten kaçınmak için (asıl garanti syncHomeKupon içinde).
    const startTime = poolStartTime(dateIso, races.map((r) => r.time));
    if (startTime && Date.now() >= startTime.getTime()) continue;

    checked++;

    const dependencyInput: DependencyRaceInput[] = races.map((r) => {
      const scoreByRunnerId = new Map<string, number | null>();
      for (const p of r.prediction?.picks ?? []) {
        if (p.runnerId) scoreByRunnerId.set(p.runnerId, p.scoreExact ?? p.score ?? null);
      }
      return {
        raceNo: r.raceNo,
        pistDuyarliligi: r.prediction?.pistDuyarliligi ?? null,
        gecmisRiskSeviyesi: r.prediction?.gecmisRiskSeviyesi ?? null,
        runners: r.runners.map((run) => ({
          no: run.no,
          scratched: run.scratched,
          ekuriGroup: run.ekuriGroup,
          olasilik: (scoreByRunnerId.get(run.id) ?? 0) / 100,
        })),
      };
    });

    const optimizerConfig = optimizerConfigFor(baseHippodromeName, row.slot);
    const currentSourceHash = dependencyHashForRace(dependencyInput, optimizerConfig);
    const normalizedOverrides = normalizeManualOverrides(row.manualOverrides ?? {}, raceNos);
    const currentOverridesHash = manualOverridesHash(normalizedOverrides);
    const expectedBuildKey = computeBuildKey(row.hippodromeName, row.slot, dateIso, currentSourceHash, currentOverridesHash);

    if (expectedBuildKey === row.buildKey) continue; // GÜNCEL, dokunma

    synced++;
    await syncHomeKupon({
      hippodromeName: row.hippodromeName,
      date: dateIso,
      slot: row.slot,
      raceNos,
      manualOverrides: row.manualOverrides ?? {},
      source: "reconcile",
    }).catch(() => { /* bir sonraki turda tekrar denenir */ });
  }

  return { checked, synced };
}
