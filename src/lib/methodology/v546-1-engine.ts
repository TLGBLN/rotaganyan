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

function bandeNoktala(ad: string, raw: number | null, observed: boolean, reliability: number): V461FeatureDetay {
  const idx = W.featureNames.indexOf(ad);
  if (idx < 0) throw new Error(`V5.46.1: bilinmeyen feature adı '${ad}' (weights.json'da yok)`);
  const beta = W.weights[idx];
  if (!observed || raw == null) return { ad, raw: null, observed: false, reliability: 0, z: 0, beta, contribution: 0 };
  const sd = W.stds[idx] || 1e-9;
  const z = (raw - W.means[idx]) / sd;
  const contribution = reliability * z * beta;
  return { ad, raw, observed: true, reliability, z, beta, contribution };
}

const yuzeyKoduFromSurface = (s: string): Surface | null => (s === "CIM" || s === "KUM" || s === "SENTETIK" ? (s as Surface) : null);
const breedKoduFromBreed = (b: string): Breed | null => (b === "ARAP" || b === "INGILIZ" ? (b as Breed) : null);

/** V5.46.1 skorunu üretir. Production yazmaz, yalnız hesaplayıp döner (çağıran karar verir). */
export async function scoreV461(raceId: string): Promise<V461Sonuc | null> {
  const warnings: string[] = [];
  const faz1 = await gatherFaz1V5(raceId);
  if (!faz1 || faz1.runners.length === 0) return null;

  const raceMeta = await db.race.findUnique({
    where: { id: raceId },
    select: { raceDay: { select: { date: true } } },
  });
  const raceDate = raceMeta?.raceDay.date ?? new Date();

  const target: TargetRace = {
    date: raceDate,
    length: faz1.race.distance,
    surface: yuzeyKoduFromSurface(faz1.race.surface),
  };
  const raceBreed = breedKoduFromBreed(faz1.race.breed);
  if (!target.surface) warnings.push(`Bilinmeyen yüzey: ${faz1.race.surface}`);
  if (!raceBreed) warnings.push(`Bilinmeyen ırk: ${faz1.race.breed}`);

  // Canlı Accurace: aynı offline pipeline fonksiyonları (as-of, tjkAtId ile birleştirilmiş)
  const runnerIds = faz1.runners.map((r) => r.id);
  const tjkOf = await tjkAtIdOf(runnerIds);
  const runs = await accuraceKosulari();
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
  const hizGozlemli = await getHizDerecesiGozlemliForRace(raceId); // no -> boolean, V5.46'nın kendi hizByNo'suyla AYNI koşul

  // GIDISAT: 2026-10-07 parity denetiminde bulundu — V5.46'nın canlı yolu (gatherFaz1V5)
  // Runner.raceStyle ÖNBELLEĞİNİ okuyor (ayrı bir cron'un ürettiği, bu çağrıyla eşleşmesi
  // GARANTİ DEĞİL); offline eğitim verisi (arac-model-veri-olustur.mts) HER SEFERİNDE TAZE
  // hesaplıyor (fetchAccuraceGecmisKayitlari + analizEtTekYaris + hesaplaCokYarisEgilimi).
  // V5.46.1 burada offline ile AYNI taze hesabı kullanır — V5.46/v5-engine.ts'e DOKUNULMADI.
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

  const satirlar = faz1.runners.map((r: Faz1RunnerV5) => {
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
    const features: V461FeatureDetay[] = [
      bandeNoktala("agfSirasi", r.agfSirasi, true, 1),
      bandeNoktala("agfPayi", r.agfPayi, true, 1),
      bandeNoktala("agfPayi2", r.agfPayi * r.agfPayi, true, 1),
      bandeNoktala("idmJokey", r.idmJokey, true, 1),
      bandeNoktala("h2hNetSkor", r.h2hNetSkor, r.h2hKarsilastirmaSayisi > 0, 1),
      bandeNoktala("hizDerecesi", r.hizDerecesi, hizGozlemli.get(r.no) ?? false, 1),
      Object.assign(
        bandeNoktala("zeminToleransi", r.zeminToleransi, true, 1),
        { evidenceObserved: r.zeminToleransiGozlemli }
      ),
      bandeNoktala("zeminMesafeDeneyim", r.zeminMesafeDeneyim, true, 1),
      bandeNoktala("yakinsama2Plus", r.yakinsama2Plus, true, 1),
      bandeNoktala("sonIdmanSprint", r.sonIdmanSprint, r.sonIdmanSprintGozlemli, 1),
      Object.assign(
        bandeNoktala("takiDegisikligi", taki, true, 1),
        { evidenceObserved: r.takiDegisikligiGozlemli }
      ),
      Object.assign(
        bandeNoktala("yarisGidisatiSkoru", gidisatByRunnerIdV461.get(r.id)?.finalSkor ?? 0, true, 1),
        { evidenceObserved: gidisatByRunnerIdV461.get(r.id)?.finalSkor != null }
      ),
      Object.assign(
        bandeNoktala("sireOrani", r.sireOrani, true, 1),
        { evidenceObserved: (r.sireOrneklemKendiVeri ?? 0) > 0 }
      ),
      bandeNoktala("ACC_CLOSE_RES", cr.observed ? cr.raw : null, cr.observed, cr.reliability),
      bandeNoktala("ACC_LATE", la.observed ? la.raw : null, la.observed, la.reliability),
      bandeNoktala("ACC_SPEED", sp.observed ? sp.raw : null, sp.observed, sp.reliability),
      bandeNoktala("PS_front", paceObserved ? front : null, paceObserved, hR),
      bandeNoktala("PS_lone", paceObserved ? lone : null, paceObserved, hR),
      bandeNoktala("PS_closerFit", paceObserved ? closerFit : null, paceObserved, hR),
    ];
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

  const picks: V461Pick[] = satirlar.map((s, i) => ({
    runnerId: s.r.id, no: s.r.no, ad: s.r.ad,
    score: s.score, probability: probs[i], rank: rankOf.get(i)!,
    features: s.features,
  })).sort((a, b) => a.rank - b.rank);

  return { raceId, engineVersion: "V5.46.1", generatedAt: new Date().toISOString(), race: faz1.race, picks, warnings };
}
