// ROTAGANYAN ANALİZ MOTORU — Saf Model (D)'nin 15 sinyalinin GERÇEK hesaplayıcı bağlantısı.
//
// Bu dosya src/lib/methodology/v546-1-engine.ts'i (V5.46.1, production, DOKUNULMAYAN dosya)
// İTHAL ETMEZ ve DEĞİŞTİRMEZ — onun KENDİSİNİN kullandığı AYNI alt-seviye point-in-time
// birincil kaynaklardan (gatherFaz1V5Historical, @/lib/accurace/features, pace-analizi)
// bağımsızca yeniden derler. İki bilinen, bu oturumda DOĞRULANMIŞ düzeltme burada uygulanır:
//
//  1) evidenceObserved düzeltmesi (6 sinyal): idmJokey/zeminMesafeDeneyim için v546-1-engine.ts
//     henüz bu düzeltmeyi taşımıyor (yalnız zeminToleransi/takiDegisikligi/yarisGidisatiSkoru/
//     sireOrani taşıyor) — galopSayisi>0 / zeminMesafeOrnekSayisi>0 ile GERÇEK gözlem ayrımı
//     burada TAMAMLANIR. observed=false durumunda raw HER ZAMAN null (asla 0 fallback).
//  2) PS_front/PS_lone/PS_closerFit DÜZELTİLMİŞ formülü (arac-v5461-saf-abcd-karsilastirma.mts
//     ::computeYeniPS'ten alınan, D-config karşılaştırmasında CANONICAL seçilen sürüm):
//     front = rakiplerin ORTALAMASI (toplamı DEĞİL), lone = GERÇEK çarpımsal tek-lider,
//     closerFit = own.closer × (yeni) front. v546-1-engine.ts'in ESKİ toplam-tabanlı formülü
//     KULLANILMAZ.
//
// AGF ailesi (agfSirasi/agfPayi/agfPayi2/yakinsama2Plus) kesinlikle BURADA YOK — temel
// kazanma-olasılığı özellik vektörüne asla girmez (kullanıcı kuralı).
//
// Nokta-zamanlı güvenlik: gatherFaz1V5Historical canlı AGF senkronizasyonu YAPMAZ, race.raceDay.date
// cutoff'una göre sızıntısız hesaplar — hem eğitim hem canlı-eşdeğeri tahmin AYNI fonksiyonu çağırır.

import { db } from "@/lib/db";
import { gatherFaz1V5Historical, type Faz1RunnerV5, type Faz1SonucV5 } from "@/lib/methodology/v5-engine";
import { tumOnbellegiGetir } from "@/server/actions/hiz-derecesi.actions";
import { getV5461SireOzetleriForRace } from "@/server/actions/v5461-sire.actions";
import { breedToIrk } from "@/lib/sire-stat-match";
import { pitSirePercent, speedObservedAsOf } from "./pit-sire-speed";
import { fetchAccuraceGecmisKayitlari, normalizeHorseName } from "@/lib/methodology/veri-toplama";
import {
  analizEtTekYaris,
  hesaplaCokYarisEgilimi,
  hesaplaYuzdelikSelfVsSiblings,
  hesaplaYarisGidisati,
  type PaceCheckpoint,
} from "@/lib/methodology/pace-analizi";
import { hesaplaTempoTasimaGucuMap } from "@/server/actions/tempo-tasima-gucu.actions";
import { accuraceKosulari, tjkAtIdOf } from "@/lib/accurace/loader";
import {
  closingResidual,
  lateSegmentSpeed,
  speedResidual,
  styleVector,
  rivalPressure,
  makeBaselineCache,
  makeClosingBaselineCache,
} from "@/lib/accurace/features";
import type { AccuraceRun, Breed, Surface, StyleFeature, TargetRace } from "@/lib/accurace/types";

/** D (Saf Model) ailesinden canonical isimlere eşlenen 15 sinyalin kaynak kodları. */
export const SAF_MODEL_SIGNAL_CODES = [
  "idmJokey",
  "h2hNetSkor",
  "hizDerecesi",
  "zeminToleransi",
  "zeminMesafeDeneyim",
  "sonIdmanSprint",
  "takiDegisikligi",
  "yarisGidisatiSkoru",
  "sireOrani",
  "ACC_CLOSE_RES",
  "ACC_LATE",
  "ACC_SPEED",
  "PS_front",
  "PS_lone",
  "PS_closerFit",
] as const;
export type SafModelSignalCode = (typeof SAF_MODEL_SIGNAL_CODES)[number];

export type SafModelRawSignal = {
  code: SafModelSignalCode;
  raw: number | null;
  observed: boolean;
  reliability: number;
  dataSource: string;
  missingReason: string | null;
};

export type SafModelRunnerSignals = {
  runnerId: string;
  no: number;
  name: string;
  signals: SafModelRawSignal[];
};

export type SafModelRaceSignals = {
  raceId: string;
  race: Faz1SonucV5["race"];
  runners: SafModelRunnerSignals[];
};

const yuzeyKoduFromSurface = (s: string): Surface | null => (s === "CIM" || s === "KUM" || s === "SENTETIK" ? (s as Surface) : null);
const breedKoduFromBreed = (b: string): Breed | null => (b === "ARAP" || b === "INGILIZ" ? (b as Breed) : null);

function sig(
  code: SafModelSignalCode,
  raw: number | null,
  observed: boolean,
  reliability: number,
  dataSource: string,
  missingReason: string | null = null
): SafModelRawSignal {
  if (!observed) return { code, raw: null, observed: false, reliability: 0, dataSource, missingReason: missingReason ?? "gözlem yok" };
  if (raw == null || !Number.isFinite(raw)) {
    return { code, raw: null, observed: false, reliability: 0, dataSource, missingReason: "gözlemli ama raw geçersiz (NaN/null) — güvenlik için gözlemsiz işaretlendi" };
  }
  return { code, raw, observed: true, reliability, dataSource, missingReason: null };
}

/**
 * D'nin 15 sinyalinin TEK yarış için gerçek, point-in-time hesaplanmış ham değerleri.
 * `preloadedRuns` verilirse accuraceKosulari() tekrar çağrılmaz (çoklu yarış toplu
 * toplamada N+1 önleme — arac-v5461-saf-v3-veri-topla.mts'teki AYNI desen).
 */
export async function computeSafModelSignalsForRace(
  raceId: string,
  preloadedRuns?: AccuraceRun[],
  // FAZ 3 PERF (2026-10-25, teslim raporu madde 1): gatherFaz1V5Historical (v5-engine.ts,
  // V5.46.1'in KENDİSİNİN de kullandığı AĞIR fonksiyon — 11 paralel alt-sorgu/hesap) tek bir
  // analyzeRaceDemotion çağrısı içinde (buildUnifiedFeatureVectorsForRace → BU fonksiyon,
  // crosscheckAlternativeSignals → BU fonksiyon TEKRAR, + analyze-race.ts'in AGF karşılaştırması
  // için DOĞRUDAN) ÜÇ KEZ çağrılıyordu — GERÇEK profiling bunu doğruladı (bkz. teslim raporu).
  // v5-engine.ts'in KENDİSİNE (V5.46.1'in production dosyası, DOKUNULMAYAN) hiçbir cache
  // EKLENMEDİ — risk burada SADECE RAN'ın KENDİ çağrı grafiğinde (bu dosya + analyze-race.ts +
  // alt-signal-crosscheck.ts, hiçbiri V5.46.1 tarafından kullanılmıyor) bir ÇAĞIRANIN sonucu
  // PAYLAŞMASI/yeniden kullanması — v5-engine.ts'in KENDİ davranışı/performansı BİREBİR aynı
  // kalır (hâlâ her çağrıda kendi taze sorgularını yapar).
  preloadedFaz1?: Faz1SonucV5 | null
): Promise<SafModelRaceSignals | null> {
  const faz1 = preloadedFaz1 !== undefined ? preloadedFaz1 : await gatherFaz1V5Historical(raceId);
  if (!faz1 || faz1.runners.length === 0) return null;

  const raceMeta = await db.race.findUnique({ where: { id: raceId }, select: { raceDay: { select: { date: true } } } });
  const raceDate = raceMeta?.raceDay.date ?? new Date();
  const target: TargetRace = {
    date: raceDate,
    length: faz1.race.distance,
    surface: yuzeyKoduFromSurface(faz1.race.surface),
  };
  breedKoduFromBreed(faz1.race.breed); // şu an kullanılmıyor (reliability ayrımı ileride)

  const runnerIds = faz1.runners.map((r) => r.id);
  const tjkOf = await tjkAtIdOf(runnerIds);
  const runs = preloadedRuns ?? (await accuraceKosulari());
  const byTjk = new Map<number, AccuraceRun[]>();
  for (const r of runs) {
    const a = byTjk.get(r.tjk) ?? [];
    a.push(r);
    byTjk.set(r.tjk, a);
  }
  const baselineAt = makeBaselineCache(runs);
  const closingBaselineAt = makeClosingBaselineCache(runs);

  const gecmisOf = (runnerId: string): AccuraceRun[] => {
    const tjk = tjkOf.get(runnerId);
    return tjk != null ? byTjk.get(tjk) ?? [] : [];
  };
  const styleOf = new Map<string, StyleFeature>();
  for (const r of faz1.runners) styleOf.set(r.id, styleVector(gecmisOf(r.id), target));

  // RAN-only source repair. Production V5 engine is unchanged.
  // SIRE_HISTORY: only pre-race Runner/Result, exclude target horse's own starts.
  // SPEED: observed only if a usable population comparison existed before cutoff.
  const [pitMeta, speedHistory] = await Promise.all([
    db.runner.findMany({
      where: { id: { in: runnerIds } },
      select: { id: true, sire: true, tjkAtId: true },
    }),
    tumOnbellegiGetir(),
  ]);
  const pitById = new Map(pitMeta.map(r => [r.id, r]));
  if (faz1.runners.some(r => !pitById.has(r.id))) {
    throw new Error("RAN_PIT_INCOMPLETE_RUNNER_META");
  }
  const pitSire = await getV5461SireOzetleriForRace(
    faz1.runners.map(r => pitById.get(r.id)!.sire),
    faz1.race.breed, faz1.race.surface, faz1.race.distance,
    raceDate,
    faz1.runners.map(r => pitById.get(r.id)!.tjkAtId),
  );
  if (pitSire.length !== faz1.runners.length) throw new Error("RAN_PIT_SIRE_LENGTH_MISMATCH");
  const sirePctById = new Map(faz1.runners.map((r,i)=>[r.id,pitSirePercent(pitSire[i])]));
  const speedBreed = breedToIrk(faz1.race.breed);
  const hizGozlemli = new Map(faz1.runners.map(r=>{
    const id=pitById.get(r.id)!.tjkAtId;
    const observed=id != null && speedObservedAsOf(
      speedHistory.gecmis.get(id) ?? [], speedBreed, raceDate, speedHistory.paceIndex
    );
    return [r.no,observed] as const;
  }));

  const accGecmis = await fetchAccuraceGecmisKayitlari(faz1.runners.map((r) => r.ad), raceDate).catch(() => ({
    son800AccuraceKayitlari: [],
    son800Siblings: [],
  }));
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
  const gidisatSonucu = hesaplaYarisGidisati(tempoProfilleri, faz1.race.distance, tempoTasimaListesi);
  const gidisatByRunnerId = new Map(faz1.runners.map((r, i) => [r.id, gidisatSonucu.atSonuclari[i]]));

  const runners: SafModelRunnerSignals[] = faz1.runners.map((r: Faz1RunnerV5) => {
    const gecmis = gecmisOf(r.id);
    const cr = closingResidual(gecmis, target, closingBaselineAt);
    const la = lateSegmentSpeed(gecmis, target);
    const sp = speedResidual(gecmis, target, baselineAt);
    const own = styleOf.get(r.id)!;
    const rivals = faz1.runners.filter((x) => x.id !== r.id).map((x) => styleOf.get(x.id)!);

    // --- PS_front/PS_lone/PS_closerFit: DÜZELTİLMİŞ formül (computeYeniPS, D-config) ---
    // v546-1-engine.ts'in ESKİ (toplam-tabanlı rivalPressure().vec kullanan) formülü BURADA
    // KULLANILMAZ — her atın KENDİ styleVector'ü üzerinden ortalama/çarpımsal yeniden hesaplanır.
    const rivalsObserved = rivals.filter((s): s is StyleFeature => !!s?.observed && !!s.vec);
    let psFront: number | null = null;
    let psLone: number | null = null;
    let psCloserFit: number | null = null;
    let psObserved = false;
    if (own?.observed && own.vec && rivalsObserved.length > 0) {
      const rivalFronts = rivalsObserved.map((s) => s.vec![0] + s.vec![1]);
      const frontAvg = rivalFronts.reduce((a, b) => a + b, 0) / rivalFronts.length; // ORTALAMA, toplam DEĞİL
      const ownFront = own.vec[0] + own.vec[1];
      const ownCloser = own.vec[4] + own.vec[5];
      const loneProduct = rivalFronts.reduce((acc, f) => acc * Math.max(0, 1 - f), 1); // GERÇEK çarpım
      psFront = frontAvg;
      psLone = ownFront * loneProduct;
      psCloserFit = ownCloser * frontAvg;
      psObserved = true;
    }
    const psReliability = own?.reliability ?? 0;

    const taki = r.takiCikarildiMi - r.takiEklendiMi;
    const gidisat = gidisatByRunnerId.get(r.id);

    const signals: SafModelRawSignal[] = [
      // DÜZELTME 1/6: idmJokey observed artık galopSayisi>0 (gerçek galop verisi var mı),
      // "sahte 0" değil — galop yoksa idmJokey=0 İDMAN-JOKEY UYUMSUZLUĞU değil, VERİ EKSİKLİĞİ.
      sig("idmJokey", r.idmJokey, r.galopSayisi > 0, 1, "v5-engine.ts::gatherFaz1V5Historical (Gallop, cutoff'lu)", r.galopSayisi > 0 ? null : "bu at için hiç galop kaydı yok"),
      sig("h2hNetSkor", r.h2hNetSkor, r.h2hKarsilastirmaSayisi > 0, 1, "v5-engine.ts::h2hNetSkorHesapla (bugünkü rakiplerle ortak geçmiş, leak-free)", r.h2hKarsilastirmaSayisi > 0 ? null : "bugünkü rakiplerle ortak geçmiş yarış yok"),
      sig("hizDerecesi", r.hizDerecesi, hizGozlemli.get(r.no) ?? false, 1, "RAN-only speedObservedAsOf (cutoff, true historical pace reference)"),
      sig("zeminToleransi", r.zeminToleransi, r.zeminToleransiGozlemli, 1, "v5-engine.ts::hesaplaZeminToleransiMap (TjkDereceKaydi, leak-free)"),
      // DÜZELTME 2/6: zeminMesafeDeneyim observed artık zeminMesafeOrnekSayisi>0.
      sig("zeminMesafeDeneyim", r.zeminMesafeDeneyim, r.zeminMesafeOrnekSayisi > 0, 1, "v5-engine.ts (zemin+mesafe deneyimi, kategori bazlı)", r.zeminMesafeOrnekSayisi > 0 ? null : "aynı pist+zemin+mesafe kombinasyonunda geçmiş koşu yok"),
      sig("sonIdmanSprint", r.sonIdmanSprint, r.sonIdmanSprintGozlemli, 1, "v5-engine.ts (Gallop.track, en son galop)", r.sonIdmanSprintGozlemli ? null : "son galop kaydı yok"),
      sig("takiDegisikligi", taki, r.takiDegisikligiGozlemli, 1, "v5-engine.ts (SonYarisDetay.eklenenTaki/cikarilanTaki)", r.takiDegisikligiGozlemli ? null : "son yarış tarihi/takı bilgisi bilinmiyor"),
      sig("yarisGidisatiSkoru", gidisat?.finalSkor ?? null, gidisat?.finalSkor != null, 1, "pace-analizi.ts::hesaplaYarisGidisati (Accurace geçmişi, taze hesap)", gidisat?.finalSkor != null ? null : "yeterli Accurace geçmişi yok"),
      sig("sireOrani", sirePctById.get(r.id) ?? null, sirePctById.get(r.id) != null, 1, "RAN-only PIT getV5461SireOzetleriForRace (exclude own horse; shrink)", sirePctById.get(r.id) != null ? null : "yarış öncesi, kendi startları hariç aygır örneklemi yok"),
      sig("ACC_CLOSE_RES", cr.observed ? cr.raw : null, cr.observed, cr.reliability, "accurace/features.ts::closingResidual"),
      sig("ACC_LATE", la.observed ? la.raw : null, la.observed, la.reliability, "accurace/features.ts::lateSegmentSpeed"),
      sig("ACC_SPEED", sp.observed ? sp.raw : null, sp.observed, sp.reliability, "accurace/features.ts::speedResidual"),
      // DÜZELTME 3/6 (PS ailesi, 3 sinyal): düzeltilmiş ortalama/çarpımsal formül.
      sig("PS_front", psObserved ? psFront : null, psObserved, psReliability, "accurace/features.ts::styleVector (D-config düzeltilmiş: rakip ORTALAMASI)", psObserved ? null : "kendi veya tüm rakiplerin stil vektörü gözlemsiz"),
      sig("PS_lone", psObserved ? psLone : null, psObserved, psReliability, "accurace/features.ts::styleVector (D-config düzeltilmiş: gerçek çarpımsal tek-lider)", psObserved ? null : "kendi veya tüm rakiplerin stil vektörü gözlemsiz"),
      sig("PS_closerFit", psObserved ? psCloserFit : null, psObserved, psReliability, "accurace/features.ts::styleVector (D-config düzeltilmiş: own.closer × yeni front)", psObserved ? null : "kendi veya tüm rakiplerin stil vektörü gözlemsiz"),
    ];

    return { runnerId: r.id, no: r.no, name: r.ad, signals };
  });

  return { raceId, race: faz1.race, runners };
}
