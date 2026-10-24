// ROTAGANYAN ANALİZ MOTORU v1.0 — ORTAK ÖZELLİK VEKTÖRÜ (FeatureVector) katmanı.
//
// KULLANICI TALİMATI (2026-10-17): "Bu ailelerin hesaplama sonuçlarını ortak bir FeatureVector
// yapısında birleştirin." Bu dosya, TAMAMLANMIŞ 7 ailenin (FORM/HIZ/SINIF/PMZ/TEMPO/JOKEY/KILO)
// HİÇBİRİNİN hesaplama mantığını YENİDEN YAZMAZ — yalnız HEPSİNİ AYNI anda, AYNI paylaşılan
// (resolver/cache/tempoCtx) bağlamla çağırıp TEK bir, denetlenebilir yapıya TOPLAR. Her sinyal
// kendi ham değerini, gözlem durumunu, veri kapsamını ve eksik-veri gerekçesini AYNEN taşır —
// "registry'de ACTIVE yazması kullanıldığı anlamına gelmez" ilkesiyle, buradaki `observed`
// alanı salt VERİ durumunu yansıtır, bir sinyalin EĞİTİME/SKORA gerçekten girip girmediğini
// training.ts karar verir (bkz. o dosyadaki SIGNAL_CODES/toModelVector).

import { db } from "@/lib/db";
import { PLACEHOLDER_HALF_LIFE_DAYS, type CoverageState } from "../features/common";
import { computeFormLevel, computeFormTrend, computeLayoff } from "../features/form";
import { computeSpeedRatingForRace } from "../features/hiz";
import { computeSinifLevel } from "../features/sinif";
import { createFieldSizeResolver, type FieldSizeResolverFn } from "../features/history-source";
import {
  computePmzZeminUyumu,
  computePmzMesafeUyumu,
  createRaceContextCache,
  computeFormZeminEtkilesimi,
  type RaceContextCache,
} from "../features/pmz";
import {
  loadTempoContext,
  computeTempoLiderlikEgilimi,
  computeTempoRakipBaskisi,
  computeTempoTekLiderGostergesi,
  computeTempoUyum,
  type TempoContext,
} from "../features/tempo";
import { computeJokeySon30Form, computeJokeyUzunDonem, computeJokeyAtUyumu, computeJokeyStilUyumu } from "../features/jokey";
import {
  computeKiloSahaGoreli,
  computeKiloGecmiseGore,
  computeKiloMesafeEtkilesimHam,
  computeKiloHandikapEtkilesimHam,
} from "../features/kilo";
import { parseClassType } from "../features/sinif-classifier";
import type { RaceClassStrength } from "../features/sinif";
import type { TargetRace } from "@/lib/accurace/types";

export type SignalEntry = {
  code: string;
  family: string;
  rawValue: number | null;
  observed: boolean; // gözlem durumu — veri var mı
  coverageState: CoverageState | null; // veri kapsamı (uygulanabiliyorsa)
  asOfSafe: true; // zaman güvenliği — bu katmandaki TÜM fonksiyonlar point-in-time (AÇIKÇA taşınır, denetlenebilirlik için)
  missingReason: string | null;
};

export type RunnerFeatureVector = {
  raceId: string;
  no: number;
  name: string;
  tjkAtId: number | null;
  jockey: string | null;
  signals: SignalEntry[];
};

export type RaceBatchContext = {
  raceId: string;
  cutoff: Date;
  distance: number;
  surface: "CIM" | "KUM" | "SENTETIK";
  city: string;
  isHandicapStyle: boolean;
  resolver: FieldSizeResolverFn;
  raceContextCache: RaceContextCache;
  classStrengthCache: Map<string, Promise<RaceClassStrength>>;
  tempoCtx: TempoContext;
  hizMap: Map<number, { value: number | null; observed: boolean }>;
  fieldWeights: Map<number, number | null>;
  runners: { no: number; name: string; tjkAtId: number | null; jockey: string | null }[];
};

export async function loadRaceBatchContext(raceId: string, tempoCtx?: TempoContext): Promise<RaceBatchContext> {
  const race = await db.race.findUnique({
    where: { id: raceId },
    select: { distance: true, surface: true, classType: true, raceDay: { select: { date: true, hippodrome: { select: { name: true } } } } },
  });
  if (!race) throw new Error(`RotaGanyan v1.0: raceId bulunamadı: ${raceId}`);
  const runners = await db.runner.findMany({
    where: { raceId, scratched: false },
    select: { no: true, name: true, tjkAtId: true, jockey: true, weight: true },
  });
  const [hizMap, resolvedTempoCtx] = await Promise.all([
    computeSpeedRatingForRace(raceId),
    tempoCtx ? Promise.resolve(tempoCtx) : loadTempoContext(),
  ]);
  const fieldWeights = new Map<number, number | null>(
    runners.map(r => [r.no, r.weight ?? null])
  );
  const parsedClass = parseClassType(race.classType);
  return {
    raceId,
    cutoff: race.raceDay.date,
    distance: race.distance,
    surface: race.surface,
    city: race.raceDay.hippodrome.name,
    isHandicapStyle: parsedClass.isHandicapStyle,
    resolver: createFieldSizeResolver(),
    raceContextCache: createRaceContextCache(),
    classStrengthCache: new Map(),
    tempoCtx: resolvedTempoCtx,
    hizMap,
    fieldWeights,
    runners,
  };
}

function entry(
  code: string,
  family: string,
  rawValue: number | null,
  observed: boolean,
  coverageState: CoverageState | null,
  missingReason: string | null = null
): SignalEntry {
  return { code, family, rawValue, observed, coverageState, asOfSafe: true, missingReason };
}

export async function buildFeatureVectorForRunner(
  ctx: RaceBatchContext,
  runner: { no: number; name: string; tjkAtId: number | null; jockey: string | null }
): Promise<RunnerFeatureVector> {
  const cache = runner.tjkAtId != null ? await db.horseRaceHistoryCache.findUnique({ where: { tjkAtId: runner.tjkAtId } }) : null;
  const rowsJson = cache?.rowsJson ?? [];
  const target: TargetRace = { date: ctx.cutoff, length: ctx.distance, surface: ctx.surface };
  const rivals = ctx.runners.filter((r) => r.no !== runner.no).map((r) => r.tjkAtId);

  const [form01, form02, form03, sinif01, pmz01, pmz02, formZemin, son30, uzunDonem, atUyumu, stilUyumu] = await Promise.all([
    computeFormLevel(runner.tjkAtId, rowsJson, ctx.cutoff, PLACEHOLDER_HALF_LIFE_DAYS, ctx.resolver),
    computeFormTrend(runner.tjkAtId, rowsJson, ctx.cutoff, PLACEHOLDER_HALF_LIFE_DAYS, ctx.resolver),
    Promise.resolve(computeLayoff(runner.tjkAtId, rowsJson, ctx.cutoff)),
    computeSinifLevel(runner.tjkAtId, rowsJson, ctx.cutoff, PLACEHOLDER_HALF_LIFE_DAYS, ctx.resolver, ctx.classStrengthCache),
    computePmzZeminUyumu(runner.tjkAtId, ctx.surface, rowsJson, ctx.cutoff, PLACEHOLDER_HALF_LIFE_DAYS, ctx.resolver, ctx.raceContextCache, ctx.classStrengthCache),
    computePmzMesafeUyumu(runner.tjkAtId, ctx.distance, rowsJson, ctx.cutoff, PLACEHOLDER_HALF_LIFE_DAYS, ctx.resolver, ctx.raceContextCache),
    computeFormZeminEtkilesimi(runner.tjkAtId, ctx.surface, rowsJson, ctx.cutoff, PLACEHOLDER_HALF_LIFE_DAYS, ctx.resolver),
    computeJokeySon30Form(runner.jockey, ctx.cutoff),
    computeJokeyUzunDonem(runner.jockey, ctx.cutoff),
    computeJokeyAtUyumu(runner.tjkAtId, runner.jockey, rowsJson, ctx.cutoff, PLACEHOLDER_HALF_LIFE_DAYS, ctx.resolver),
    computeJokeyStilUyumu(runner.jockey, runner.tjkAtId, target, ctx.tempoCtx),
  ]);

  const tempo01 = computeTempoLiderlikEgilimi(runner.tjkAtId, target, ctx.tempoCtx);
  const tempo02 = computeTempoRakipBaskisi(rivals, target, ctx.tempoCtx);
  const tempo03 = computeTempoTekLiderGostergesi(runner.tjkAtId, rivals, target, ctx.tempoCtx);
  const tempo04 = computeTempoUyum(runner.tjkAtId, rivals, target, ctx.tempoCtx);

  const hiz01 = ctx.hizMap.get(runner.no) ?? { value: null, observed: false };
  const ownWeight = ctx.fieldWeights.get(runner.no) ?? null;
  const fieldWeightList = ctx.runners.map((r) => ctx.fieldWeights.get(r.no) ?? null);
  const kilo01 = computeKiloSahaGoreli(ownWeight, fieldWeightList);
  const kilo02 = computeKiloGecmiseGore(ownWeight, runner.tjkAtId, rowsJson, ctx.cutoff, PLACEHOLDER_HALF_LIFE_DAYS);
  const kilo03 = computeKiloMesafeEtkilesimHam(kilo01.value, ctx.distance);
  const kilo04 = computeKiloHandikapEtkilesimHam(kilo01.value, ctx.isHandicapStyle);

  // JOKEY_04'ün CANLI kullanımı: bugünkü atın KENDİ stil kovasına (todayHorseStyleBucket)
  // karşılık gelen jokey-geçmişi bucket'ı seçilir — "jokey X stilde kazanıyor diye otomatik
  // avantaj" ÜRETİLMEZ, yalnız İLGİLİ kovanın betimsel değeri taşınır (kullanıcı uyarısı).
  const jokey04Bucket =
    stilUyumu.todayHorseStyleBucket === "ON_GRUP"
      ? stilUyumu.onGrupBucket
      : stilUyumu.todayHorseStyleBucket === "ORTA"
        ? stilUyumu.ortaBucket
        : stilUyumu.todayHorseStyleBucket === "GERI"
          ? stilUyumu.geriBucket
          : null;

  const signals: SignalEntry[] = [
    entry("FORM_01", "FORM", form01.value, form01.value != null, form01.coverageState),
    entry("FORM_02", "FORM", form02.value, form02.value != null, form02.coverageState),
    entry("FORM_03", "FORM", form03.value, form03.value != null, form03.coverageState),
    entry("HIZ_01", "HIZ", hiz01.value, hiz01.observed, null),
    entry("SINIF_01", "SINIF", sinif01.value, sinif01.value != null, sinif01.coverageState),
    entry("PMZ_01", "PIST_MESAFE_ZEMIN", pmz01.value, pmz01.value != null, pmz01.coverageState),
    entry("PMZ_02", "PIST_MESAFE_ZEMIN", pmz02.value, pmz02.value != null, pmz02.coverageState),
    entry("FORM_x_ZEMIN", "PIST_MESAFE_ZEMIN", formZemin.value, formZemin.value != null, formZemin.coverageState),
    entry("TEMPO_01", "TEMPO_STYLE", tempo01.leadTendency, tempo01.observed, tempo01.coverageState),
    entry("TEMPO_02", "TEMPO_STYLE", tempo02.frontGroupPressure, tempo02.frontGroupPressure != null, null),
    entry("TEMPO_03", "TEMPO_STYLE", tempo03.value, tempo03.value != null, null),
    entry("TEMPO_04", "TEMPO_STYLE", tempo04.closerPressureFit, tempo04.closerPressureFit != null, tempo04.coverageState),
    entry(
      "JOKEY_01", "JOKEY", son30?.shrunkResidualPerMount ?? null, son30 != null && son30.shrunkResidualPerMount != null,
      son30?.coverageState ?? null, son30 == null ? "jokey adı bilinmiyor" : null
    ),
    entry(
      "JOKEY_02", "JOKEY", uzunDonem?.shrunkResidualPerMount ?? null, uzunDonem != null && uzunDonem.shrunkResidualPerMount != null,
      uzunDonem?.coverageState ?? null, uzunDonem == null ? "jokey adı bilinmiyor" : null
    ),
    entry("JOKEY_03", "JOKEY", atUyumu.value, atUyumu.value != null, atUyumu.coverageState),
    entry(
      "JOKEY_04", "JOKEY", jokey04Bucket?.shrunkResidualPerMount ?? null, jokey04Bucket?.shrunkResidualPerMount != null,
      stilUyumu.coverageState, jokey04Bucket == null ? "bugünkü atın stil kovası belirsiz VEYA jokeyin o kovada geçmişi yok" : null
    ),
    entry("KILO_01", "KILO", kilo01.value, kilo01.value != null, null),
    entry("KILO_02", "KILO", kilo02.value, kilo02.value != null, kilo02.coverageState),
    entry("KILO_03", "KILO", kilo03, kilo03 != null, null),
    entry("KILO_04", "KILO", kilo04, kilo04 != null, null),
  ];

  return { raceId: ctx.raceId, no: runner.no, name: runner.name, tjkAtId: runner.tjkAtId, jockey: runner.jockey, signals };
}

// PERF (kullanıcı bulgusu, 2026-10-22): runner-bazında SIRAYLA await ediliyordu (10-18 at
// × kendi DB gidiş-dönüşleri = yarış başına onlarca ardışık round-trip — yavaşlığın asıl
// kaynağı, PC değil). Hem bu dosya hem unified-family-engine.ts (CANLI admin motoru) bu
// fonksiyonu kullanıyor — davranış/sonuç AYNI, yalnız eşzamanlı çekiliyor.
export async function buildFeatureVectorsForRace(raceId: string, tempoCtx?: TempoContext): Promise<RunnerFeatureVector[]> {
  const ctx = await loadRaceBatchContext(raceId, tempoCtx);
  return Promise.all(ctx.runners.map((r) => buildFeatureVectorForRunner(ctx, r)));
}
