// ROTAGANYAN ANALİZ MOTORU v1.0 — SINIF ailesi (registry: SINIF_01, SINIF_02).
//
// KULLANICI DÜZELTMESİ #1 (kritik, uygulandı): basit bitiriş-yüzdesi (R) medyanı YANLIŞ —
// 10 atlı bir Maiden'de de 10 atlı bir Grup'ta da R medyanı hep 0,5 çıkar. Doğru yaklaşım:
//   C_r,t = median(Â_1,t, ..., Â_N,t), Â = HIZ_01 (zaten normalize, zaten point-in-time).
//
// KULLANICI DÜZELTMESİ #2 (kritik, uygulandı): atın KENDİ HIZ_01'i medyana dahilse,
// "rakip kalitesi" ölçümü atın kendi gücünden etkilenir (kendi kendini karşılaştırma
// yanlılığı). Düzeltme — LEAVE-ONE-OUT:
//   C_{r,-i} = median_{j≠i}(Â_j,t)
// Hem BUGÜNKÜ hedef yarış hem atın HER BİR geçmiş yarışı için uygulanır; geçmiş yarışın
// rakip gücü de O YARIŞIN KENDİ TARİHİNDEKİ verilerle hesaplanır (getHizDerecesiForRace
// zaten raceDay.date'i cutoff olarak kullanıyor — bugünkü hız geçmişe TAŞINMAZ).
//
// KULLANICI DÜZELTMESİ #3 (kritik, uygulandı): tek gözlemden gelen SINIF_01 "medyan"ı
// güvenilir sayılamaz. Çözüm — ham değer + gözlem sayısı + 0'a (HIZ_01'in doğal, z-skor
// kökenli nötr referansı) doğru shrinkage AYRI AYRI saklanır; "gerçek sıfır" ile "düşük-
// güven nedeniyle sıfıra küçültülmüş" KARIŞTIRILMAZ (bkz. SinifResult.rawValue vs
// SinifResult.value).

import { db } from "@/lib/db";
import { getHizDerecesiForRace, getHizDerecesiGozlemliForRace } from "@/server/actions/hiz-derecesi.actions";
import { median, timeDecayWeight, weightedAverage, shrinkageFactor, classifyCoverage, type CoverageState } from "./common";
import {
  parseHistoryRows,
  parseTjkDate,
  rowsBeforeCutoff,
  createFieldSizeResolver,
  type HistoryRow,
  type FieldSizeResolverFn,
} from "./history-source";

export type RaceClassStrength = {
  value: number | null; // C_{r,-i} — atın KENDİSİ HARİÇ rakiplerin medyan HIZ_01'i
  fieldSize: number; // kaç RAKİBİN (hariç tutulan at sayılmaz) HIZ_01'i medyana girdi
};

/**
 * C_{r,-i} — bir yarışın (raceId), VERİLEN at (excludeTjkAtId) HARİÇ rakiplerinin medyan
 * HIZ_01'i. excludeTjkAtId verilmezse (ör. o yarışta bu atın tjkAtId'si bilinmiyor)
 * normal (hariç tutmasız) medyan döner — ama bu durum çağıran tarafça (confidence
 * düşürülerek) işaretlenmeli, burada SESSİZCE geçilmez.
 */
type ClassStrengthInputs = {
  values: Map<number, number>;
  observed: Map<number, boolean>;
  runners: { no: number; tjkAtId: number | null }[];
};

// Paylaşım yalnız çağıranın verdiği classStrengthCache'in ömrü kadardır.
// Farklı yarış analizleri ve production'ın doğrudan computeRaceClassStrength
// çağrıları arasında süresiz/işlem-geneli veri tutulmaz (WeakMap key GC olabilir).
const scopedRaceInputs = new WeakMap<
  Map<string, Promise<RaceClassStrength>>,
  Map<string, Promise<ClassStrengthInputs>>
>();

function loadClassStrengthInputs(raceId: string, includeRunners: boolean): Promise<ClassStrengthInputs> {
  return Promise.all([
    getHizDerecesiForRace(raceId),
    getHizDerecesiGozlemliForRace(raceId),
    includeRunners
      ? db.runner.findMany({ where: { raceId, scratched: false }, select: { no: true, tjkAtId: true } })
      : Promise.resolve([] as { no: number; tjkAtId: number | null }[]),
  ]).then(([values, observed, runners]) => ({ values, observed, runners }));
}

export async function computeRaceClassStrength(
  raceId: string,
  excludeTjkAtId?: number | null,
  classStrengthCache?: Map<string, Promise<RaceClassStrength>>
): Promise<RaceClassStrength> {
  let inputs: ClassStrengthInputs;
  if (classStrengthCache != null && excludeTjkAtId != null) {
    let scoped = scopedRaceInputs.get(classStrengthCache);
    if (!scoped) {
      scoped = new Map();
      scopedRaceInputs.set(classStrengthCache, scoped);
    }
    let pending = scoped.get(raceId);
    if (!pending) {
      pending = loadClassStrengthInputs(raceId, true);
      scoped.set(raceId, pending);
    }
    inputs = await pending;
  } else {
    // Önceki bağımsız/doğrudan çağrılar için aynı sorgu ve sonuç davranışı.
    inputs = await loadClassStrengthInputs(raceId, excludeTjkAtId != null);
  }
  const { values, observed, runners } = inputs;
  const excludeNo = excludeTjkAtId != null ? runners.find((r) => r.tjkAtId === excludeTjkAtId)?.no : undefined;

  const observedValues: number[] = [];
  for (const [no, v] of values) {
    if (!observed.get(no)) continue;
    if (excludeNo != null && no === excludeNo) continue; // kendi kendini hariç tut
    observedValues.push(v);
  }
  if (observedValues.length === 0) return { value: null, fieldSize: 0 };
  return { value: median(observedValues), fieldSize: observedValues.length };
}

export type SinifResult = {
  rawValue: number | null; // ham medyan (küçültme UYGULANMADAN) — bilgi kaybolmasın
  value: number | null; // shrinkage uygulanmış (0'a doğru küçültülmüş) nihai değer
  observationCount: number;
  totalHistoryRows: number;
  coverageState: CoverageState;
};

export const SINIF_SHRINKAGE_K = 4; // GEÇİCİ — eğitimden doğrulanana kadar (bkz. common.ts PLACEHOLDER_HALF_LIFE_DAYS ile AYNI dürüstlük ilkesi)

function orderedPastRows(rows: HistoryRow[], cutoff: Date): HistoryRow[] {
  return rowsBeforeCutoff(rows, cutoff)
    .map((r) => ({ row: r, date: parseTjkDate(r.date)! }))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((x) => x.row);
}

/** SINIF_01 — atın geçmiş yarışlarının C_{r,-i} değerlerinin ağırlıklı ortalaması, her biri
 *  o yarışta KENDİSİ HARİÇ rakiplerden hesaplanmış. Az gözlemde 0'a (HIZ_01'in doğal
 *  nötr referansı) doğru küçültülür — `value` İLE `rawValue` AYRI saklanır. */
export async function computeSinifLevel(
  tjkAtId: number | null,
  rowsJson: unknown,
  cutoff: Date,
  halfLifeDays: number,
  resolver: FieldSizeResolverFn = createFieldSizeResolver(),
  classStrengthCache: Map<string, Promise<RaceClassStrength>> = new Map()
): Promise<SinifResult> {
  const allRows = orderedPastRows(parseHistoryRows(rowsJson), cutoff);

  if (tjkAtId == null) {
    return { rawValue: null, value: null, observationCount: 0, totalHistoryRows: allRows.length, coverageState: "IDENTITY_UNRESOLVED" };
  }
  if (allRows.length === 0) {
    return { rawValue: null, value: null, observationCount: 0, totalHistoryRows: 0, coverageState: "TRUE_DEBUTANT" };
  }

  const points: { value: number | null; weight: number | null }[] = [];
  let observationCount = 0;

  for (const row of allRows) {
    if (observationCount >= 5) break;
    const resolved = await resolver(row);
    if (resolved == null) continue;

    const cacheKey = `${resolved.raceId}:${tjkAtId}`;
    let pending = classStrengthCache.get(cacheKey);
    if (!pending) {
      pending = computeRaceClassStrength(resolved.raceId, tjkAtId, classStrengthCache);
      classStrengthCache.set(cacheKey, pending);
    }
    const strength = await pending;
    if (strength.value == null) continue;

    const rowDate = parseTjkDate(row.date)!;
    const deltaDays = (cutoff.getTime() - rowDate.getTime()) / 86_400_000;
    const w = timeDecayWeight(deltaDays, halfLifeDays);
    if (w == null) continue;
    points.push({ value: strength.value, weight: w });
    observationCount++;
  }

  const rawValue = weightedAverage(points);
  const coverageState: CoverageState = classifyCoverage(true, allRows.length, observationCount);
  if (rawValue == null) {
    return { rawValue: null, value: null, observationCount, totalHistoryRows: allRows.length, coverageState };
  }
  // Shrinkage: 0 (HIZ_01'in doğal nötr noktası) yönünde, gözlem sayısına göre küçültülür.
  const shrink = shrinkageFactor(observationCount, SINIF_SHRINKAGE_K);
  const value = shrink * rawValue; // (1-shrink)*0 terimi sıfır olduğu için düşüyor

  return { rawValue, value, observationCount, totalHistoryRows: allRows.length, coverageState };
}

/** SINIF_02 — bugünkü hedef yarışın C_{r,-i}'si (bu atı HARİÇ tutarak) eksi atın geçmiş
 *  SINIF_01'i (shrinkage uygulanmış `value`, ham DEĞİL — küçük örneklemde aşırı kesin
 *  bir "fark" iddia edilmesin diye). */
export async function computeSinifChange(
  targetRaceId: string,
  tjkAtId: number | null,
  rowsJson: unknown,
  cutoff: Date,
  halfLifeDays: number
): Promise<{ value: number | null; today: number | null; historical: SinifResult }> {
  const [today, historical] = await Promise.all([
    computeRaceClassStrength(targetRaceId, tjkAtId),
    computeSinifLevel(tjkAtId, rowsJson, cutoff, halfLifeDays),
  ]);
  if (today.value == null || historical.value == null) {
    return { value: null, today: today.value, historical };
  }
  return { value: today.value - historical.value, today: today.value, historical };
}
