// ROTAGANYAN ANALİZ MOTORU V1.0 — EĞİTİME-UYGUN TAM ÖZELLİK HESAPLAYICI (kullanıcı talimatı,
// 2026-10-20: "EĞİTİMİ BAŞLAT"). unified-family-engine.ts'in TAM sürümünden FARKI: PIST_DURUM_01
// (PIT güvenliği yalnız canlı yarışta var) ve DAV_START_RISK (seçilim yanlılığı) — ve ondan
// türeyen TMP_DAV_KULVAR_01 — hiç HESAPLANMAZ bile (yalnız predict-v1.ts'te DIŞARIDA
// BIRAKILMAKLA kalmaz, bu dosya onları eğitim önbelleğine HİÇ YAZMAZ — güvenlik engeli iki
// kat). Bunun dışında 10 ailenin TÜM hesaplayıcıları DEĞİŞTİRİLMEDEN, DOĞRUDAN import edilir.
//
// `loadTempoContext`/`loadGalopPaceIndex`'in DİSK'ten yüklenen sürümleri kullanılır (kullanıcı
// kararı, 2026-10-19: "DB'ye TEKRAR ağır tam-arşiv sorgusu atma") — PIST_DURUM atlandığı için
// o context'e hiç ihtiyaç yok.

import { db } from "@/lib/db";
import { buildFeatureVectorsForRace, type RunnerFeatureVector, type SignalEntry } from "./feature-vector";
import type { TempoContext } from "../features/tempo";
import { computeGenPedigriForRace } from "../features/gen-pedigri";
import { computeIdman01, groupKey, splitsToT200Points } from "../features/idman-galop";
import { computeJokeyTrend30 } from "../features/int-jokey-trend";
import { computeAntrenorTrend30 } from "../features/ant-trainer";
import { computeDavTakiDegisikligi } from "../features/dav-taki";
import { computeRakH2HForRace, computeRakGapForRace } from "../features/rak-rakip-gucu";
import { computeKulvar01, computeTempoStilKulvarInteraction } from "../features/int-tempo-stil-kulvar";
import { computeFormGalopDinlenmeInteraction } from "../features/int-form-galop-dinlenme";
import { computeJokeyFormTempoInteraction } from "../features/int-jokey-form-tempo";
import type { AccuraceRun } from "@/lib/accurace/types";
import fs from "node:fs";

const ACCURACE_SNAPSHOT_PATH = "src/lib/motor-v1/artifacts/accurace-archive-snapshot.json";
const GALLOP_SNAPSHOT_PATH = "src/lib/motor-v1/artifacts/gallop-archive-snapshot.json";

export function loadTempoContextFromDisk(): TempoContext {
  const snap = JSON.parse(fs.readFileSync(ACCURACE_SNAPSHOT_PATH, "utf8")) as { builtAt: string; runs: (Omit<AccuraceRun, "date"> & { date: string })[] };
  const byTjk = new Map<number, AccuraceRun[]>();
  for (const r of snap.runs) {
    const run: AccuraceRun = { ...r, date: new Date(r.date) };
    const arr = byTjk.get(run.tjk);
    if (arr) arr.push(run); else byTjk.set(run.tjk, [run]);
  }
  return { byTjk };
}
export type GalopPaceIndex = Map<string, { tarih: Date; t200: number }[]>;
export function loadGalopPaceIndexFromDisk(): GalopPaceIndex {
  const snap = JSON.parse(fs.readFileSync(GALLOP_SNAPSHOT_PATH, "utf8")) as { builtAt: string; rows: { date: string; splits: unknown }[] };
  const index: GalopPaceIndex = new Map();
  for (const r of snap.rows) {
    const splits = r.splits as Record<string, string | null> | null;
    if (!splits) continue;
    const key = groupKey(splits.pist ?? null, splits.ic_dis ?? null);
    const points = splitsToT200Points(splits);
    if (points.length === 0) continue;
    const t200 = points.reduce((a, b) => a + b, 0) / points.length;
    const arr = index.get(key) ?? [];
    arr.push({ tarih: new Date(r.date), t200 });
    index.set(key, arr);
  }
  return index;
}

function entry(code: string, family: string, rawValue: number | null, observed: boolean, missingReason: string | null): SignalEntry {
  return { code, family, rawValue, observed, coverageState: null, asOfSafe: true, missingReason };
}
function hamCarpim(code: string, family: string, parcalar: { value: number | null; observed: boolean; label: string }[]): SignalEntry {
  const eksik = parcalar.filter((p) => !p.observed || p.value == null).map((p) => `${p.label} gözlemsiz`);
  if (eksik.length > 0) return entry(code, family, null, false, eksik.join("; "));
  const value = parcalar.reduce((acc, p) => acc * p.value!, 1);
  return entry(code, family, value, true, null);
}

/** Bu dosyanın ürettiği TÜM kodlar — eğitime ADAY (coverage denetiminden SONRA filtrelenir).
 *  PIST_DURUM_01/DAV_START_RISK/TMP_DAV_KULVAR_01 bilerek BURADA DA YOK. */
export const FULL_CANDIDATE_CODES = [
  "FORM_01", "FORM_02", "FORM_03", "HIZ_01", "SINIF_01", "PMZ_01", "PMZ_02", "FORM_x_ZEMIN",
  "TEMPO_01", "TEMPO_02", "TEMPO_03", "TEMPO_04", "JOKEY_01", "JOKEY_02", "JOKEY_03", "JOKEY_04",
  "KILO_01", "KILO_02", "KILO_03", "KILO_04", // saf 20
  "GEN_SIRE_01", "GEN_DAM_01", "GEN_DAMSIRE_01", "GEN_SIRE_PMZ_01", // GEN (4)
  "IDMAN_01", "KULVAR_01_HAM", // FRM/TMP standalone (2)
  "JOKEY_TREND30", "ANT_TREND30", // JOK/ANT trend (2)
  "DAV_TAKI_EKLENDI", "DAV_TAKI_CIKARILDI", // DAV (2, START_RISK HARİÇ)
  "RAK_H2H_01", "RAK_GAP_01", // RAK (2)
  "GEN_PMZ_YET_01", "YET_PMZ_01", "FRM_GEN_01", "FRM_IDMAN_DINLENME_01", "JOK_FRM_TMP_01",
  "ANT_FRM_01", "TMP_DAV_01", "FRM_GALOP_ANT_01", "YET_PMZ_RAK_01", "KIL_PMZ_YET_01",
  "RAK_YET_TMP_01", "TMP_KULVAR_01", // 11 ilişki (13'ten TMP_DAV_KULVAR_01 ÇIKARILDI)
] as const;
export type FullCandidateCode = (typeof FULL_CANDIDATE_CODES)[number];

export type TrainableRaceResult = {
  raceId: string;
  date: string;
  winnerNo: number | null;
  runners: { no: number; name: string; vectors: SignalEntry[] }[];
};

export async function computeTrainableFeaturesForRace(
  raceId: string,
  tempoCtx: TempoContext,
  galopPaceIndex: GalopPaceIndex
): Promise<TrainableRaceResult | null> {
  const race = await db.race.findUnique({
    where: { id: raceId },
    select: {
      breed: true, surface: true, distance: true,
      raceDay: { select: { date: true } },
      result: { select: { actualOrder: true, winnerNos: true } },
      runners: {
        where: { scratched: false },
        select: { no: true, name: true, sire: true, dam: true, damSire: true, tjkAtId: true, jockey: true, trainer: true, startNo: true, equipment: true, gallops: { select: { date: true, splits: true } } },
      },
    },
  });
  if (!race || race.runners.length === 0) return null;
  const cutoff = race.raceDay.date;
  const winnerNo = race.result?.winnerNos?.[0] ?? (Array.isArray(race.result?.actualOrder) ? Number(race.result!.actualOrder[0]) : null);

  const safVectors = await buildFeatureVectorsForRace(raceId, tempoCtx);
  const safByNo = new Map(safVectors.map((v) => [v.no, v]));

  const tjkIds = race.runners.map((r) => r.tjkAtId).filter((x): x is number => x != null);
  const cacheRows = tjkIds.length
    ? await db.horseRaceHistoryCache.findMany({ where: { tjkAtId: { in: tjkIds } }, select: { tjkAtId: true, rowsJson: true } })
    : [];
  const rowsJsonByTjk = new Map(cacheRows.map((c) => [c.tjkAtId, c.rowsJson]));

  const pmzHam = new Map(race.runners.map((r) => {
    const v = safByNo.get(r.no);
    const pmz = v?.signals.find((s) => s.code === "PMZ_01");
    return [r.no, pmz?.observed ? pmz.rawValue : null] as const;
  }));
  const genResults = await computeGenPedigriForRace(
    race.runners.map((r) => ({ no: r.no, sire: r.sire, dam: r.dam, damSire: r.damSire, tjkAtId: r.tjkAtId })),
    race.breed, race.surface, race.distance, cutoff, pmzHam
  );
  const genByNo = new Map(genResults.map((g) => [g.no, g.signals]));

  const rakByNo = computeRakH2HForRace(
    race.runners.map((r) => ({ no: r.no, name: r.name, tjkAtId: r.tjkAtId, rowsJson: rowsJsonByTjk.get(r.tjkAtId ?? -1) ?? [] })),
    cutoff
  );
  const rakGapByNo = computeRakGapForRace(
    race.runners.map((r) => {
      const v = safByNo.get(r.no);
      const h = v?.signals.find((s) => s.code === "HIZ_01");
      const s = v?.signals.find((s) => s.code === "SINIF_01");
      return { no: r.no, hiz01: h?.rawValue ?? null, hiz01Observed: !!h?.observed, sinif01: s?.rawValue ?? null, sinif01Observed: !!s?.observed };
    })
  );

  // PERF (kullanıcı bulgusu, 2026-10-22): bu ikisi öncesinde runner-bazında SIRAYLA await
  // ediliyordu (10-18 at × 2 ayrı DB gidiş-dönüşü = yarış başına 20-36 ardışık round-trip,
  // yavaşlığın asıl kaynağı — PC değil). Davranış/sonuç AYNI, yalnız eşzamanlı çekiliyor.
  const jokeyTrendPairs = await Promise.all(race.runners.map(async (r) => [r.no, await computeJokeyTrend30(r.jockey, cutoff)] as const));
  const jokeyTrendByNo = new Map(jokeyTrendPairs);
  const antTrendPairs = await Promise.all(race.runners.map(async (r) => [r.no, await computeAntrenorTrend30(r.trainer, cutoff)] as const));
  const antTrendByNo = new Map(antTrendPairs);

  // DAV BACKFILL BOSLUGU DUZELTMESI (2026-10-22): yarisin HICBIR kosucusunda equipment
  // doldurulmamissa (ham veride dogrulandi: TRAIN+HOLDOUT'un %77.3'u bu durumda), DAV
  // "0/1" degil observed=false dondurmeli — bkz. dav-taki.ts.
  const raceEquipmentBackfilled = race.runners.some((r) => r.equipment != null && r.equipment.trim() !== "");

  const out: TrainableRaceResult["runners"] = [];
  for (const r of race.runners) {
    const v = safByNo.get(r.no);
    const sig = (code: string) => v?.signals.find((s) => s.code === code) ?? null;
    const form01 = sig("FORM_01"), form02 = sig("FORM_02"), form03 = sig("FORM_03");
    const hiz01 = sig("HIZ_01"), sinif01 = sig("SINIF_01");
    const pmz01 = sig("PMZ_01"), tempo01 = sig("TEMPO_01");
    const kilo01 = sig("KILO_01");
    const rowsJson = rowsJsonByTjk.get(r.tjkAtId ?? -1) ?? [];

    const gen = genByNo.get(r.no) ?? [];
    const genSire = gen.find((g) => g.code === "GEN_SIRE_01")!;
    const genDam = gen.find((g) => g.code === "GEN_DAM_01")!;
    const genDamSire = gen.find((g) => g.code === "GEN_DAMSIRE_01")!;
    const genSirePmz = gen.find((g) => g.code === "GEN_SIRE_PMZ_01")!;

    const idman = computeIdman01(r.gallops, cutoff, galopPaceIndex);
    const idmanEntry = entry("IDMAN_01", "FRM", idman.value, idman.observed, idman.missingReason);

    const kulvar = computeKulvar01(r.startNo, race.runners.length);

    const jokeyTrend = jokeyTrendByNo.get(r.no)!;
    const jokeyTrendEntry = entry("JOKEY_TREND30", "JOK", jokeyTrend.value, jokeyTrend.observed, jokeyTrend.missingReason);

    const antTrend = antTrendByNo.get(r.no)!;
    const antEntry = entry("ANT_TREND30", "ANT", antTrend.value, antTrend.observed, antTrend.missingReason);

    const dav = computeDavTakiDegisikligi(r.equipment, r.tjkAtId, rowsJson, cutoff, raceEquipmentBackfilled);

    const rak = rakByNo.get(r.no)!;
    const rakGap = rakGapByNo.get(r.no)!;

    const fgd = computeFormGalopDinlenmeInteraction(form01?.rawValue ?? null, !!form01?.observed, idman.value, idman.observed, form03?.rawValue ?? null);
    const jft = computeJokeyFormTempoInteraction(jokeyTrend.value, jokeyTrend.observed, form02?.rawValue ?? null, !!form02?.observed, tempo01?.rawValue ?? null, !!tempo01?.observed);
    const tsk = computeTempoStilKulvarInteraction(kulvar, tempo01?.rawValue ?? null, !!tempo01?.observed);

    const genPmzYet = hamCarpim("GEN_PMZ_YET_01", "INTERACTION", [
      { value: genSire.rawValue, observed: genSire.observed, label: "GEN_SIRE_01" },
      { value: pmz01?.rawValue ?? null, observed: !!pmz01?.observed, label: "PMZ_01" },
      { value: sinif01?.rawValue ?? null, observed: !!sinif01?.observed, label: "SINIF_01" },
    ]);
    const yetPmz = hamCarpim("YET_PMZ_01", "INTERACTION", [
      { value: hiz01?.rawValue ?? null, observed: !!hiz01?.observed, label: "HIZ_01" },
      { value: pmz01?.rawValue ?? null, observed: !!pmz01?.observed, label: "PMZ_01" },
    ]);
    const frmGen = hamCarpim("FRM_GEN_01", "INTERACTION", [
      { value: form02?.rawValue ?? null, observed: !!form02?.observed, label: "FORM_02" },
      { value: genSire.rawValue, observed: genSire.observed, label: "GEN_SIRE_01" },
    ]);
    const antFrm = hamCarpim("ANT_FRM_01", "INTERACTION", [
      { value: antTrend.value, observed: antTrend.observed, label: "ANT_TREND30" },
      { value: form02?.rawValue ?? null, observed: !!form02?.observed, label: "FORM_02" },
    ]);
    const tmpDav = hamCarpim("TMP_DAV_01", "INTERACTION", [
      { value: tempo01?.rawValue ?? null, observed: !!tempo01?.observed, label: "TEMPO_01" },
      { value: dav.signals[0]?.rawValue ?? null, observed: !!dav.signals[0]?.observed, label: "DAV_TAKI_EKLENDI" },
    ]);
    const frmGalopAnt = hamCarpim("FRM_GALOP_ANT_01", "INTERACTION", [
      { value: form01?.rawValue ?? null, observed: !!form01?.observed, label: "FORM_01" },
      { value: idman.value, observed: idman.observed, label: "IDMAN_01" },
      { value: antTrend.value, observed: antTrend.observed, label: "ANT_TREND30" },
    ]);
    const yetPmzRak = hamCarpim("YET_PMZ_RAK_01", "INTERACTION", [
      { value: hiz01?.rawValue ?? null, observed: !!hiz01?.observed, label: "HIZ_01" },
      { value: pmz01?.rawValue ?? null, observed: !!pmz01?.observed, label: "PMZ_01" },
      { value: rak.rawValue, observed: rak.observed, label: "RAK_H2H_01" },
    ]);
    const kilPmzYet = hamCarpim("KIL_PMZ_YET_01", "INTERACTION", [
      { value: kilo01?.rawValue ?? null, observed: !!kilo01?.observed, label: "KILO_01" },
      { value: pmz01?.rawValue ?? null, observed: !!pmz01?.observed, label: "PMZ_01" },
      { value: hiz01?.rawValue ?? null, observed: !!hiz01?.observed, label: "HIZ_01" },
    ]);
    const rakYetTmp = hamCarpim("RAK_YET_TMP_01", "INTERACTION", [
      { value: rak.rawValue, observed: rak.observed, label: "RAK_H2H_01" },
      { value: hiz01?.rawValue ?? null, observed: !!hiz01?.observed, label: "HIZ_01" },
      { value: tempo01?.rawValue ?? null, observed: !!tempo01?.observed, label: "TEMPO_01" },
    ]);

    const allSignals: SignalEntry[] = [
      ...(v?.signals ?? []),
      genSire, genDam, genDamSire, genSirePmz,
      idmanEntry, { ...kulvar, coverageState: null },
      jokeyTrendEntry, antEntry,
      ...dav.signals, // START_RISK bu fonksiyonda hiç ÇAĞRILMADI — listede YOK
      { ...rak, code: rak.code }, { ...rakGap, code: rakGap.code },
      genPmzYet, yetPmz, frmGen,
      { ...fgd, coverageState: null }, { ...jft, coverageState: null }, { ...tsk, coverageState: null },
      antFrm, tmpDav, frmGalopAnt, yetPmzRak, kilPmzYet, rakYetTmp,
    ];
    out.push({ no: r.no, name: r.name, vectors: allSignals });
  }

  return { raceId, date: cutoff.toISOString(), winnerNo, runners: out };
}
