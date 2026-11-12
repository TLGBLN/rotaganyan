// V5.46.1 — dondurulmuş (FREEZE) canlı skor motoru. Yalnız frozen 16 sinyali, frozen β/μ/σ'yu
// uygular. B-katmanı YOK, sıcaklık düzeltmesi YOK, segment override YOK (kullanıcı kararı
// 2026-10-07, bkz. weights/v546-1-weights.json "overrideKurali"). Mevcut V5.46 (v5-engine.ts)
// bu dosyadan ETKİLENMEZ — rollback/arşiv olarak değişmeden kalır.
//
// Mimari ilke: V5.46.1 kendi feature'larını SIFIRDAN hesaplamaz. 12 ana sinyal için V5.46'nın
// zaten üretim-doğrulanmış gatherFaz1V5()'ini ÇAĞIRIR (parity garantisi — aynı fonksiyon, aynı
// sonuç). Yalnız H2H/Hız/Sprint için V5.46.1'in missing≠0 sözleşmesi gereken "gözlemli mi"
// bayrağını, V5.46'ya EKLENEN (davranışını değiştirmeyen) yeni alanlardan okur. 4 Accurace
// sinyali src/lib/accurace/features.ts'teki (offline ile BİREBİR AYNI) fonksiyonlarla canlı
// hesaplanır.
import { db } from "@/lib/db";
import { gatherFaz1V5, type Faz1RunnerV5, type Faz1SonucV5 } from "./v5-engine";
import { getHizDerecesiGozlemliForRace } from "@/server/actions/hiz-derecesi.actions";
import { fetchAccuraceGecmisKayitlari, normalizeHorseName } from "@/lib/methodology/veri-toplama";
import { analizEtTekYaris, hesaplaCokYarisEgilimi, hesaplaYuzdelikSelfVsSiblings, hesaplaYarisGidisati, type PaceCheckpoint } from "@/lib/methodology/pace-analizi";
import { hesaplaTempoTasimaGucuMap } from "@/server/actions/tempo-tasima-gucu.actions";
import { accuraceKosulari, tjkAtIdOf } from "@/lib/accurace/loader";
import {
  closingResidual, lateSegmentSpeed, speedResidual, styleVector, rivalPressure,
  makeBaselineCache, makeClosingBaselineCache,
} from "@/lib/accurace/features";
import type { AccuraceRun, Breed, Surface, StyleFeature, TargetRace } from "@/lib/accurace/types";
import weightsJson from "./weights/v546-1-weights.json";
// 2026-11-10 kullanıcı kararı ("18 sinyal yapacağız bunları da ekleyerek") — Antrenör Oranı/
// Jokey Formu/Galop Kalitesi + Dam/DamSire'ın sireOrani'ye eklenmesi. galopSkoru/pedigriSkoru
// ./pedigri-galop-ortak.ts'de (ran-v2.ts ile PAYLAŞILAN, döngüsel import'suz tek kaynak).
import { galopSkoru, pedigriSkoru } from "./pedigri-galop-ortak";
import { getJokeyFormTablosu } from "@/server/actions/jokey-form.actions";
import { getPitSeviyeSinyalleri, type PitSeviye } from "@/server/actions/pit-seviye.actions";
import { getV5461DamOzetleriForRace, getV5461DamsireOzetleriForRace, type V5461DamlineOzet } from "@/server/actions/v5461-damline.actions";

type FrozenWeights = {
  version: string;
  featureNames: string[];
  weights: number[];
  means: number[];
  stds: number[];
};
const W = weightsJson as FrozenWeights;
if (W.featureNames.length !== W.weights.length || W.weights.length !== W.means.length || W.means.length !== W.stds.length) {
  throw new Error(`V5.46.1 weights.json tutarsız: featureNames=${W.featureNames.length} weights=${W.weights.length} means=${W.means.length} stds=${W.stds.length}`);
}
if (new Set(W.featureNames).size !== W.featureNames.length) throw new Error("V5.46.1 weights.json: tekrarlı feature adı var");
if (!W.weights.every(Number.isFinite) || !W.means.every(Number.isFinite) || !W.stds.every(Number.isFinite)) {
  throw new Error("V5.46.1 weights.json: NaN/Infinity içeriyor");
}

export interface V461FeatureDetay {
  ad: string;
  raw: number | null;
  observed: boolean;
  reliability: number; // temel (eski V5.46) sinyallerde 1, Accurace'te gerçek reliability
  z: number;
  beta: number;
  contribution: number;
}
export interface V461Pick {
  runnerId: string;
  no: number;
  ad: string;
  score: number;
  probability: number;
  rank: number;
  features: V461FeatureDetay[];
}
export interface V461Sonuc {
  raceId: string;
  engineVersion: "V5.46.1";
  generatedAt: string;
  race: Faz1SonucV5["race"];
  picks: V461Pick[];
  warnings: string[];
}

function bandeNoktala(weights: FrozenWeights, ad: string, raw: number | null, observed: boolean, reliability: number): V461FeatureDetay {
  const idx = weights.featureNames.indexOf(ad);
  if (idx < 0) throw new Error(`V5.46.1: bilinmeyen feature adı '${ad}' (weights.json'da yok)`);
  const beta = weights.weights[idx];
  if (!observed || raw == null) return { ad, raw: null, observed: false, reliability: 0, z: 0, beta, contribution: 0 };
  const sd = weights.stds[idx] || 1e-9;
  const z = (raw - weights.means[idx]) / sd;
  const contribution = reliability * z * beta;
  return { ad, raw, observed: true, reliability, z, beta, contribution };
}

// 2026-10-23 P1 düzeltmesi (kullanıcı talebi — Saf Model'i GERÇEK, bağımsız eğitilmiş bir
// 16-özellikli model yapmak): ham sinyal toplama mantığı scoreV461'den AYRIŞTIRILDI ki hem
// scoreV461 (19 özellik, frozen W) hem yeni scoreV461Saf (16 özellik, AGF'siz, KENDİ W'si)
// AYNI üretim-doğrulanmış ham veriyi kullansın — kopya/sürüklenme riski YOK. scoreV461'in
// DAVRANIŞI bu refaktörle DEĞİŞMEDİ (aynı hesap, yalnız iki fonksiyona bölündü).
export type RawSinyalGirdi = { ad: string; raw: number | null; observed: boolean; reliability: number; evidenceObserved?: boolean };
// 2026-10-24 — styleDebug: PS ailesi (front/lone/closerFit) formul DENEYLERI icin HAM
// stil vektorlerini (atin kendisi + rakiplerin toplami) tasir. Salt-ekleme: mevcut PS_*
// hesaplamasini/davranisini DEGISTIRMEZ, yalnizca zaten hesaplanmis h/F degerlerini disari
// acar (arac-*.mts deney script'leri icin) — scoreV461/A modeli bu alani hic OKUMAZ.
export type V461RawRunner = {
  r: Faz1RunnerV5;
  rawSinyaller: RawSinyalGirdi[];
  styleDebug?: { ownVec: number[] | null; rivalVec: number[] | null; ownObserved: boolean; rivalObservedCount: number; rivalMissingCount: number };
};
export type V461RawSonuc = { raceId: string; race: Faz1SonucV5["race"]; runners: V461RawRunner[]; warnings: string[] };

// 2026-10-23 P1 performans notu: accuraceKosulari() TÜM Accurace arşivini (binlerce yarış)
// sorgular, hiç önbelleklemez — tek yarışlık canlı skorlama için kabul edilebilir ama TOPLU
// eğitimde (yüzlerce yarış) her çağrıda yeniden çekilirse dakikalar/saatler sürer. `preloadedRuns`
// verilirse (eğitim script'i TEK SEFERDE çeker, tüm yarışlara PAYLAŞTIRIR) bu adım atlanır —
// VARSAYILAN (undefined) canlı/live-route davranışını AYNEN korur, geriye dönük UYUMLU.
export async function gatherV461RawSinyaller(raceId: string, preloadedRuns?: AccuraceRun[]): Promise<V461RawSonuc | null> {
  const warnings: string[] = [];
  const faz1 = await gatherFaz1V5(raceId);
  if (!faz1 || faz1.runners.length === 0) return null;

  const raceMeta = await db.race.findUnique({
    where: { id: raceId },
    select: { raceDay: { select: { date: true, hippodromeId: true } } },
  });
  const raceDate = raceMeta?.raceDay.date ?? new Date();
  const hippodromeId = raceMeta?.raceDay.hippodromeId ?? null;

  const target: TargetRace = {
    date: raceDate,
    length: faz1.race.distance,
    surface: yuzeyKoduFromSurface(faz1.race.surface),
  };
  const raceBreed = breedKoduFromBreed(faz1.race.breed);
  if (!target.surface) warnings.push(`Bilinmeyen yüzey: ${faz1.race.surface}`);
  if (!raceBreed) warnings.push(`Bilinmeyen ırk: ${faz1.race.breed}`);

  const runnerIds = faz1.runners.map((r) => r.id);
  const tjkOf = await tjkAtIdOf(runnerIds);
  const runs = preloadedRuns ?? (await accuraceKosulari());
  const byTjk = new Map<number, AccuraceRun[]>();
  for (const r of runs) { const a = byTjk.get(r.tjk) ?? []; a.push(r); byTjk.set(r.tjk, a); }
  const baselineAt = makeBaselineCache(runs);
  const closingBaselineAt = makeClosingBaselineCache(runs);

  const gecmisOf = (runnerId: string): AccuraceRun[] => {
    const tjk = tjkOf.get(runnerId);
    return tjk != null ? (byTjk.get(tjk) ?? []) : [];
  };
  const styleOf = new Map<string, StyleFeature>();
  for (const r of faz1.runners) styleOf.set(r.id, styleVector(gecmisOf(r.id), target));
  const hizGozlemli = await getHizDerecesiGozlemliForRace(raceId);

  const accGecmis = await fetchAccuraceGecmisKayitlari(faz1.runners.map((r) => r.ad), raceDate).catch(
    () => ({ son800AccuraceKayitlari: [], son800Siblings: [] }),
  );
  const siblingSayisiMap = new Map<string, number>();
  for (const s of accGecmis.son800Siblings) siblingSayisiMap.set(s.accuraceRaceId, (siblingSayisiMap.get(s.accuraceRaceId) ?? 0) + 1);
  const ilkYariHizByRaceId = new Map<string, number[]>();
  for (const s of accGecmis.son800Siblings) {
    const sonuc = analizEtTekYaris(s.checkpoints as unknown as PaceCheckpoint[], s.accuraceRace.length ?? 0, siblingSayisiMap.get(s.accuraceRaceId) ?? 0);
    if (!sonuc) continue;
    const arr = ilkYariHizByRaceId.get(s.accuraceRaceId) ?? [];
    arr.push(sonuc.ilkYariOrtHiz);
    ilkYariHizByRaceId.set(s.accuraceRaceId, arr);
  }
  const stilEgilimMap = new Map<string, ReturnType<typeof hesaplaCokYarisEgilimi>>();
  for (const r of faz1.runners) {
    const norm = normalizeHorseName(r.ad);
    const kayitlar = accGecmis.son800AccuraceKayitlari.filter((k) => normalizeHorseName(k.horseName) === norm);
    const sonuclar: NonNullable<ReturnType<typeof analizEtTekYaris>>[] = [];
    const yuzdelikler: (number | null)[] = [];
    for (const k of kayitlar) {
      const sonuc = analizEtTekYaris(k.checkpoints as unknown as PaceCheckpoint[], k.accuraceRace.length ?? 0, siblingSayisiMap.get(k.accuraceRaceId) ?? 0);
      if (!sonuc) continue;
      sonuclar.push(sonuc);
      const saha = ilkYariHizByRaceId.get(k.accuraceRaceId);
      yuzdelikler.push(saha ? hesaplaYuzdelikSelfVsSiblings(sonuc.ilkYariOrtHiz, saha) : null);
    }
    stilEgilimMap.set(r.id, hesaplaCokYarisEgilimi(sonuclar, yuzdelikler));
  }
  const tempoTasimaGucuByAd = await hesaplaTempoTasimaGucuMap(faz1.runners.map((r) => r.ad), raceDate).catch(() => new Map<string, number>());
  const tempoProfilleri = faz1.runners.map((r) => {
    const egilim = stilEgilimMap.get(r.id);
    return egilim ? { dagilim: egilim.dagilim, erkenHizGucu: egilim.erkenHizGucu, n: egilim.n } : null;
  });
  const tempoTasimaListesi = faz1.runners.map((r) => tempoTasimaGucuByAd.get(r.ad) ?? null);
  const gidisatSonucuV461 = hesaplaYarisGidisati(tempoProfilleri, faz1.race.distance, tempoTasimaListesi);
  const gidisatByRunnerIdV461 = new Map(faz1.runners.map((r, i) => [r.id, gidisatSonucuV461.atSonuclari[i]]));

  // 2026-11-10 kullanıcı kararı ("18 sinyal yapacağız") — Antrenör Oranı/Jokey Formu/Galop
  // Kalitesi (3 YENİ sinyal) + Dam/DamSire'ın sireOrani'ye eklenmesi (mevcut sinyal, yeniden
  // tanımlandı) için gereken ham veri — ran-v2.ts'in hesaplaRanV2'siyle AYNI kaynak/desen.
  const runnerIdsHepsi = faz1.runners.map((r) => r.id);
  const damDamSireRows = await db.runner.findMany({ where: { id: { in: runnerIdsHepsi } }, select: { id: true, dam: true, damSire: true } });
  const damDamSireByRunnerId = new Map(damDamSireRows.map((x) => [x.id, x]));
  const damNamesOrdered = faz1.runners.map((r) => damDamSireByRunnerId.get(r.id)?.dam ?? null);
  const damSireNamesOrdered = faz1.runners.map((r) => damDamSireByRunnerId.get(r.id)?.damSire ?? null);
  const [jokeyTablosu18, galopRows18, damOzetleri18, damSireOzetleri18, pitByRunnerId] = await Promise.all([
    getJokeyFormTablosu(raceDate, hippodromeId).catch(() => new Map<string, { guncel: { etkinForm: number | null } }>()),
    db.gallop.findMany({ where: { runnerId: { in: runnerIdsHepsi } }, orderBy: { date: "desc" }, select: { runnerId: true, date: true, splits: true, form: true, jockey: true } }).catch(() => []),
    getV5461DamOzetleriForRace(damNamesOrdered, faz1.race.breed, faz1.race.surface, faz1.race.distance, raceDate).catch(
      () => damNamesOrdered.map(() => ({ ornekKendiVeri: null, kYuzde: null }) as V5461DamlineOzet)
    ),
    getV5461DamsireOzetleriForRace(damSireNamesOrdered, faz1.race.breed, faz1.race.surface, faz1.race.distance, raceDate).catch(
      () => damSireNamesOrdered.map(() => ({ ornekKendiVeri: null, kYuzde: null }) as V5461DamlineOzet)
    ),
    getPitSeviyeSinyalleri(raceDate, runnerIdsHepsi).catch(() => new Map<string, PitSeviye>()),
  ]);
  const galop18ByRunnerId = new Map<string, { date: Date; splits: unknown; form: string | null; jockey: string | null }[]>();
  for (const g of galopRows18) {
    const arr = galop18ByRunnerId.get(g.runnerId) ?? [];
    arr.push(g);
    galop18ByRunnerId.set(g.runnerId, arr);
  }
  const pedigriBirlesikByRunnerId = new Map(
    faz1.runners.map((r, i) => [r.id, pedigriSkoru(r, damOzetleri18[i], damSireOzetleri18[i])])
  );

  const runners: V461RawRunner[] = faz1.runners.map((r: Faz1RunnerV5) => {
    const gecmis = gecmisOf(r.id);
    const cr = closingResidual(gecmis, target, closingBaselineAt);
    const la = lateSegmentSpeed(gecmis, target);
    const sp = speedResidual(gecmis, target, baselineAt);
    const h = styleOf.get(r.id)!;
    const rakipler = faz1.runners.filter((x) => x.id !== r.id).map((x) => styleOf.get(x.id)!);
    const F = rivalPressure(rakipler);
    const hR = h.reliability;
    const front = F.vec ? F.vec[0] + F.vec[1] : null;
    const lone = F.vec && h.vec ? h.vec[0] * Math.max(0, 1 - front!) : null;
    const closerFit = F.vec && h.vec ? (h.vec[4] + h.vec[5]) * front! : null;
    const paceObserved = h.observed && F.vec != null;

    const taki = r.takiCikarildiMi - r.takiEklendiMi;
    const rawSinyaller: RawSinyalGirdi[] = [
      { ad: "agfSirasi", raw: r.agfSirasi, observed: true, reliability: 1 },
      { ad: "agfPayi", raw: r.agfPayi, observed: true, reliability: 1 },
      { ad: "agfPayi2", raw: r.agfPayi * r.agfPayi, observed: true, reliability: 1 },
      { ad: "idmJokey", raw: r.idmJokey, observed: true, reliability: 1, evidenceObserved: r.galopSayisi > 0 },
      { ad: "h2hNetSkor", raw: r.h2hNetSkor, observed: r.h2hKarsilastirmaSayisi > 0, reliability: 1 },
      { ad: "hizDerecesi", raw: r.hizDerecesi, observed: hizGozlemli.get(r.no) ?? false, reliability: 1 },
      { ad: "zeminToleransi", raw: r.zeminToleransi, observed: true, reliability: 1, evidenceObserved: r.zeminToleransiGozlemli },
      { ad: "zeminMesafeDeneyim", raw: r.zeminMesafeDeneyim, observed: true, reliability: 1, evidenceObserved: r.zeminMesafeDeneyimSeviyesi !== "yok" },
      { ad: "yakinsama2Plus", raw: r.yakinsama2Plus, observed: true, reliability: 1 },
      { ad: "sonIdmanSprint", raw: r.sonIdmanSprint, observed: r.sonIdmanSprintGozlemli, reliability: 1 },
      { ad: "takiDegisikligi", raw: taki, observed: true, reliability: 1, evidenceObserved: r.takiDegisikligiGozlemli },
      { ad: "yarisGidisatiSkoru", raw: gidisatByRunnerIdV461.get(r.id)?.finalSkor ?? 0, observed: true, reliability: 1, evidenceObserved: gidisatByRunnerIdV461.get(r.id)?.finalSkor != null },
      { ad: "sireOrani", raw: r.sireOrani, observed: true, reliability: 1, evidenceObserved: (r.sireOrneklemKendiVeri ?? 0) > 0 },
      // 2026-11-10 kullanıcı kararı ("dam ve damsire ı var olan sire sinyaline eklenecek", sonra
      // "ŞARTLI1/27 ve Maiden/19 DIŞINDA değişmesin") — AYRI bir sinyal olarak eklendi (sireOrani
      // DEĞİŞTİRİLMEDİ, kanıtlanmış 15-özellik modelin train/serve tutarlılığı korunuyor).
      // pedigriSkoru (Sire+Dam+DamSire, her biri kendi örneklem eşiğinden bağımsız geçmeli) —
      // yalnız segment-bazlı modellerin featureNames'inde var, varsayılan modelde YOK.
      { ad: "sireOraniBirlesik", raw: pedigriBirlesikByRunnerId.get(r.id) ?? null, observed: true, reliability: 1, evidenceObserved: pedigriBirlesikByRunnerId.get(r.id) != null },
      { ad: "ACC_CLOSE_RES", raw: cr.observed ? cr.raw : null, observed: cr.observed, reliability: cr.reliability },
      { ad: "ACC_LATE", raw: la.observed ? la.raw : null, observed: la.observed, reliability: la.reliability },
      { ad: "ACC_SPEED", raw: sp.observed ? sp.raw : null, observed: sp.observed, reliability: sp.reliability },
      { ad: "PS_front", raw: paceObserved ? front : null, observed: paceObserved, reliability: hR },
      { ad: "PS_lone", raw: paceObserved ? lone : null, observed: paceObserved, reliability: hR },
      { ad: "PS_closerFit", raw: paceObserved ? closerFit : null, observed: paceObserved, reliability: hR },
      // 2026-11-10 kullanıcı kararı ("18 sinyal yapacağız bunları da ekleyerek") — 3 YENİ aday
      // sinyal: Antrenör Oranı (r.antrenorOrani, Faz1RunnerV5 içinde zaten hesaplı), Jokey
      // Formu (son 30 gün etkin form, getJokeyFormTablosu — RAN v2 ile AYNI kaynak), Galop
      // Kalitesi (galopSkoru, pedigri-galop-ortak.ts — RAN v2 ile AYNI fonksiyon).
      { ad: "antrenorOraniGenel", raw: r.antrenorOrani, observed: true, reliability: 1, evidenceObserved: r.antrenorOrani != null },
      { ad: "jokeyFormuGenel", raw: (r.jockey ? jokeyTablosu18.get(r.jockey)?.guncel.etkinForm : null) ?? null, observed: true, reliability: 1, evidenceObserved: (r.jockey ? jokeyTablosu18.get(r.jockey)?.guncel.etkinForm : null) != null },
      { ad: "galopKalite", raw: galopSkoru(galop18ByRunnerId.get(r.id) ?? [], faz1.race.breed, r.jockey), observed: true, reliability: 1, evidenceObserved: galopSkoru(galop18ByRunnerId.get(r.id) ?? [], faz1.race.breed, r.jockey) != null },
      // 2026-11-12 — jokey/antrenör SEVİYESİ + son yarış galibiyeti (pit-seviye.actions.ts). Veri yoksa
      // (hiç geçmiş sürüş / önceki yarış) observed=false → gerçek "veri yok", sıfır katkı.
      { ad: "jokeyPIT", raw: pitByRunnerId.get(r.id)?.jokeyPIT ?? null, observed: pitByRunnerId.get(r.id)?.jokeyPIT != null, reliability: 1 },
      { ad: "antrenorPIT", raw: pitByRunnerId.get(r.id)?.antrenorPIT ?? null, observed: pitByRunnerId.get(r.id)?.antrenorPIT != null, reliability: 1 },
      { ad: "lastWon", raw: pitByRunnerId.get(r.id)?.lastWon ?? null, observed: pitByRunnerId.get(r.id)?.lastWon != null, reliability: 1 },
    ];
    return {
      r,
      rawSinyaller,
      styleDebug: { ownVec: h.vec, rivalVec: F.vec, ownObserved: h.observed, rivalObservedCount: F.nObserved, rivalMissingCount: F.nMissing },
    };
  });

  return { raceId, race: faz1.race, runners, warnings };
}

/** Ham sinyallerden (gatherV461RawSinyaller çıktısı) softmax olasılıkları + sıralı pick listesi
 *  üretir — scoreV461 VE scoreV461Saf'ın PAYLAŞTIĞI ortak adım (kopya/sürüklenme riski yok). */
function puanlaVeSirala(
  weights: FrozenWeights,
  runners: V461RawRunner[],
  filtrele?: (ad: string) => boolean
): { r: Faz1RunnerV5; features: V461FeatureDetay[]; score: number; probability: number; rank: number }[] {
  const satirlar = runners.map(({ r, rawSinyaller }) => {
    const girdi = filtrele ? rawSinyaller.filter((s) => filtrele(s.ad)) : rawSinyaller;
    // 2026-11-10 — evidenceObserved bug düzeltmesi (idmJokey/zeminToleransi/zeminMesafeDeneyim/
    // takiDegisikligi/yarisGidisatiSkoru/sireOrani'nin gerçekte "sahte %100 gözlem" taşıdığı
    // bulgusu, bkz. v546-1-saf-weights-v3.json) KODLANDI ama SKORLAMAYA BAĞLANMADI bırakıldı —
    // bu değişiklik hiçbir modelle izole test edilmeden kanıtlanmış 15-özellik Saf Model'in
    // davranışını etkileyemez (2026-10-24'teki deneyde de net/tutarlı bir kazanç yoktu, AGF4+
    // sürprizlerde net hafif KÖTÜ çıkmıştı). bandeNoktala hâlâ eski s.observed'i okuyor — HİÇBİR
    // kategori/segment için davranış değişmedi. evidenceObserved alanı yalnız gösterim/teşhis
    // amaçlı feature detayına EKLENİYOR (UI'da kullanılabilir), skoru ETKİLEMİYOR.
    const features: V461FeatureDetay[] = girdi.map((s) => {
      const f = bandeNoktala(weights, s.ad, s.raw, s.observed, s.reliability);
      return s.evidenceObserved !== undefined ? Object.assign(f, { evidenceObserved: s.evidenceObserved }) : f;
    });
    const score = features.reduce((s, f) => s + f.contribution, 0);
    return { r, features, score };
  });
  const max = Math.max(...satirlar.map((s) => s.score));
  const exps = satirlar.map((s) => Math.exp(s.score - max));
  const toplam = exps.reduce((a, b) => a + b, 0);
  const probs = exps.map((e) => e / toplam);
  const siraliIdx = satirlar.map((_, i) => i).sort((a, b) => probs[b] - probs[a]);
  const rankOf = new Map<number, number>();
  siraliIdx.forEach((idx, sira) => rankOf.set(idx, sira + 1));
  return satirlar.map((s, i) => ({ ...s, probability: probs[i], rank: rankOf.get(i)! }));
}

const yuzeyKoduFromSurface = (s: string): Surface | null => (s === "CIM" || s === "KUM" || s === "SENTETIK" ? (s as Surface) : null);
const breedKoduFromBreed = (b: string): Breed | null => (b === "ARAP" || b === "INGILIZ" ? (b as Breed) : null);

/** V5.46.1 skorunu üretir. Production yazmaz, yalnız hesaplayıp döner (çağıran karar verir).
 *  2026-10-23 refaktör: ham sinyal toplama gatherV461RawSinyaller'a taşındı, softmax/sıralama
 *  puanlaVeSirala'ya taşındı — DAVRANIŞ DEĞİŞMEDİ (aynı girdi aynı çıktıyı üretir, parity testiyle
 *  doğrulanmalı), yalnız Saf Model'in (scoreV461Saf) AYNI ham veriyi yeniden kullanabilmesi için
 *  bölündü. */
export async function scoreV461(raceId: string): Promise<V461Sonuc | null> {
  const rawSonuc = await gatherV461RawSinyaller(raceId);
  if (!rawSonuc) return null;

  const sirali = puanlaVeSirala(W, rawSonuc.runners);
  const picks: V461Pick[] = sirali
    .map((s) => ({ runnerId: s.r.id, no: s.r.no, ad: s.r.ad, score: s.score, probability: s.probability, rank: s.rank, features: s.features }))
    .sort((a, b) => a.rank - b.rank);

  return { raceId, engineVersion: "V5.46.1", generatedAt: new Date().toISOString(), race: rawSonuc.race, picks, warnings: rawSonuc.warnings };
}

// 2026-10-23 P1 (kullanıcı talebi — "Gerçek Saf Model", AGF'siz BAĞIMSIZ eğitilmiş 16 özellik):
// agfSirasi/agfPayi/agfPayi2 ham sinyal listesine HİÇ GİRMİYOR (yalnız contribution'ı
// çıkarılmıyor — kendisi vektöre hiç dahil edilmiyor), bu yüzden Saf Model çıktısı AGF
// değerlerinden MATEMATİKSEL OLARAK bağımsızdır (bkz. v546-1-saf-engine.test.ts). Katsayılar
// AYRI bir dosyada (v546-1-saf-weights.json), AYRI eğitilmiş — eski 19-özellik β'ları
// KULLANILMIYOR.
export const SAF_MODEL_AGF_KODLARI = new Set(["agfSirasi", "agfPayi", "agfPayi2"]);

export type V461SafPick = { runnerId: string; no: number; ad: string; score: number; probability: number; rank: number; features: V461FeatureDetay[] };
export type AgfDestekOneri = { runnerId: string; no: number; ad: string; agfSirasi: number; agfPayi: number; safSirasi: number };
export type V461SafSonuc = {
  raceId: string; engineVersion: string; generatedAt: string; race: Faz1SonucV5["race"];
  picks: V461SafPick[]; warnings: string[]; agfDestekOnerisi: AgfDestekOneri[];
};

// 2026-11-06 — AGF Destek Katmanı ("EKLE" tasarımı, 2026-11-05 araştırmasında kalibre/
// doğrulandı: pencere=3, agfSirasiEsigi=4, 140-yarışlık nihai holdout'ta Net=+39, kayıp=0,
// B500 bootstrap %95 GA=[28,49] tamamen pozitif). Saf Model'in (AGF'siz) ilk-N'ine HİÇBİR
// at ÇIKARILMADAN — yalnız AGF'nin kuvvetle favori gördüğü (agfSirasi<=esigi) ve Saf
// Model'in dışında kalan atlar EK ÖNERİ olarak eklenir. Yapısal olarak kayıp üretemez
// (Saf Model'in kendi seçimi hiç dokunulmuyor), yalnız kurtarma potansiyeli ekler. AGF'nin
// ağırlık olarak değil, AYRI bir destek katmanı olarak kullanılması — bkz. kullanıcı kararı
// "agf modeli sinyallerden ayrılmalı destek olmalı".
const AGF_DESTEK_PENCERE_BOYU = 3;
const AGF_DESTEK_AGF_SIRASI_ESIGI = 4;

export function agfDestekOnerisiHesapla(picks: V461SafPick[], rawRunners: V461RawRunner[]): AgfDestekOneri[] {
  const safTopSet = new Set(picks.filter((p) => p.rank <= AGF_DESTEK_PENCERE_BOYU).map((p) => p.runnerId));
  const agfByRunnerId = new Map(
    rawRunners.map((rr) => {
      const agfSirasiSig = rr.rawSinyaller.find((s) => s.ad === "agfSirasi");
      const agfPayiSig = rr.rawSinyaller.find((s) => s.ad === "agfPayi");
      return [rr.r.id, { agfSirasi: agfSirasiSig?.raw ?? null, agfPayi: agfPayiSig?.raw ?? null }];
    })
  );
  const oneriler: AgfDestekOneri[] = [];
  for (const pick of picks) {
    if (safTopSet.has(pick.runnerId)) continue;
    const agf = agfByRunnerId.get(pick.runnerId);
    if (!agf || agf.agfSirasi == null || agf.agfPayi == null) continue;
    if (agf.agfSirasi <= AGF_DESTEK_AGF_SIRASI_ESIGI) {
      oneriler.push({ runnerId: pick.runnerId, no: pick.no, ad: pick.ad, agfSirasi: agf.agfSirasi, agfPayi: agf.agfPayi, safSirasi: pick.rank });
    }
  }
  return oneriler.sort((a, b) => a.agfSirasi - b.agfSirasi);
}

// 2026-11-10 kullanıcı kararı — ŞARTLI 1/27 ve Maiden/ŞARTLI 19'da varsayılan 15-özellik
// modelin GENEL (global) 18-özellik denemesi KÖTÜLEŞTİĞİ için (bkz. proje hafızası aynı
// tarihli not) yalnız bu İKİ segment için AYRI, küçük modeller eğitildi — geri kalan TÜM
// koşu tipleri varsayılan (çağıranın verdiği) ağırlığı DEĞİŞMEDEN kullanır. Sıra MAIDEN/
// ŞARTLI 19'un ÖNCE kontrol edilmesi (ŞARTLI 1'in "ŞARTLI 19" alt-string'ini yanlışlıkla
// yakalamaması için) — ran-v2.ts'teki kategoriBelirle ile AYNI mantık/sıra.
import segmentDusukDeneyimJson from "./weights/v546-1-saf-segment-dusuk-deneyim.json";
import segmentDusukDeneyimAccJson from "./weights/v546-1-saf-segment-dusuk-deneyim-acc.json";
const SEGMENT_DUSUK_DENEYIM_W = segmentDusukDeneyimJson as unknown as FrozenWeights;
const SEGMENT_DUSUK_DENEYIM_ACC_W = segmentDusukDeneyimAccJson as unknown as FrozenWeights;
function segmentAgirligiSec(classType: string, varsayilan: FrozenWeights): FrozenWeights {
  const c = classType.toUpperCase();
  if (c.includes("MAIDEN") || c.includes("ŞARTLI 19")) return SEGMENT_DUSUK_DENEYIM_ACC_W;
  if (c.includes("ŞARTLI 1") || c.includes("ŞARTLI 27")) return SEGMENT_DUSUK_DENEYIM_W;
  return varsayilan;
}

export async function scoreV461Saf(raceId: string, safWeightsVarsayilan: FrozenWeights): Promise<V461SafSonuc | null> {
  const rawSonuc = await gatherV461RawSinyaller(raceId);
  if (!rawSonuc) return null;

  const safWeights = segmentAgirligiSec(rawSonuc.race.classType, safWeightsVarsayilan);

  // 2026-11-10 BUG DÜZELTMESİ (kullanıcı bulgusu — "bilinmeyen feature adı 'yakinsama2Plus'"
  // çökmesi): filtre önceden SABİT SAF_MODEL_AGF_KODLARI'ydı (yalnız 3 AGF kodu) — Saf Model
  // 16'dan 15 özelliğe (yakinsama2Plus de çıkarılarak) indirildiğinde bu filtre GÜNCELLENMEMİŞTİ,
  // gatherV461RawSinyaller'ın ürettiği yakinsama2Plus ham sinyali hâlâ puanlaVeSirala'ya
  // geçiyor ama weights.json'da (artık 15 özellik) karşılığı YOK — bandeNoktala çöküyordu.
  // Artık filtre safWeights'in KENDİ featureNames'inden türetiliyor — özellik sayısı ileride
  // tekrar değişirse bu hata sınıfı BİR DAHA oluşmaz.
  const safFeatureSet = new Set(safWeights.featureNames);
  const sirali = puanlaVeSirala(safWeights, rawSonuc.runners, (ad) => safFeatureSet.has(ad));
  const picks: V461SafPick[] = sirali
    .map((s) => ({ runnerId: s.r.id, no: s.r.no, ad: s.r.ad, score: s.score, probability: s.probability, rank: s.rank, features: s.features }))
    .sort((a, b) => a.rank - b.rank);

  const agfDestekOnerisi = agfDestekOnerisiHesapla(picks, rawSonuc.runners);

  return { raceId, engineVersion: safWeights.version, generatedAt: new Date().toISOString(), race: rawSonuc.race, picks, warnings: rawSonuc.warnings, agfDestekOnerisi };
}

