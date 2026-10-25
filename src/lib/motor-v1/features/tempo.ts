// ROTAGANYAN ANALİZ MOTORU v1.0 — TEMPO-STİL ailesi (registry: TEMPO_01 liderlik eğilimi,
// TEMPO_02 rakip baskısı, TEMPO_03 tek-liderlik göstergesi, TEMPO_04 tempo-stil uyumu).
//
// KULLANICI TALİMATI (2026-10-17): "Mevcut Runner.raceStyle, pace-analizi.ts, Accurace
// styleVector ve rivalPressure verilerini inceleyin. Aynı bilgiyi farklı sinyallerle
// tekrar hesaplamayın." — Araştırma (bkz. Explore ajanı raporu) şunu doğruladı:
//   - Runner.raceStyle DB alanı CANLI (sync-time) bir ÖNBELLEK — backtest/offline hesap
//     için GÜVENİLMEZ (veri-toplama.ts:1033 kendi yorumunda bunu zaten söylüyor).
//   - src/lib/accurace/features.ts'teki styleVector()/rivalPressure() ZATEN as-of-safe
//     (r.date >= target.date satırları atlıyor), zaman+mesafe ağırlıklı, Dirichlet-
//     düzgünleştirilmiş 6-kovalı [kaçak,ön,takip,orta,bekle,geri] dağılım üretiyor — TAM
//     OLARAK TEMPO_01'in p_lead,i'si. v546-1-engine.ts (deneysel, skora BAĞLI DEĞİL) bu
//     ikisini zaten front/lone/closerFit için kullanıyor — AYNI formüller burada BİLİNÇLİ
//     OLARAK yeniden kullanılıyor (icat edilmiyor), yalnız motor-v1'in Feature/
//     CoverageState sözleşmesine SARILIYOR.
//
// SİNYAL BÜTÜNLÜĞÜ UYARISI (kullanıcı talimatı §D): TEMPO_01-04 AYNI styleVector/
// rivalPressure kaynağından türetilir — bütünlük/oy sisteminde DÖRT BAĞIMSIZ OY değil,
// TEK bir korelasyonlu bilgi kümesi sayılmalıdır (MARKET ailesinin AGF alt-sinyalleri için
// uygulanan AYNI disiplin).
//
// 2026-10-17 İKİ TERMİNOLOJİ DÜZELTMESİ (kullanıcı uyarısı, hesaplama DEĞİŞMEDİ — yalnız
// adlandırma/rapor dili):
//   1) styleVector[0] ("kaçak" kovası payı) HENÜZ kalibre edilmiş bir P(öne gider) OLARAK
//      doğrulanmadı — yalnız geçmiş ilk-çeyrek sıra gözlemlerinin düzgünleştirilmiş bir
//      ORANI. Bu yüzden TEMPO_01-04'ün çıktıları kod/rapor genelinde "olasılık" değil
//      "eğilim/gösterge" (tendency/indicator) olarak adlandırılır.
//   2) TEMPO_03'teki Π(1-vec0_j) çarpımı, rakiplerin "öne gitme" davranışının istatistiksel
//      BAĞIMSIZ olduğunu VARSAYAR — bu varsayım doğrulanmadı (gerçekte en fazla bir at
//      gerçekten önde bitirebilir, olaylar negatif korele olabilir). Bu yüzden `value` alanı
//      "tek-liderlik OLASILIĞI" değil "tek-liderlik GÖSTERGESİ" olarak adlandırılır.

import { accuraceKosulari } from "@/lib/accurace/loader";
import { styleVector, rivalPressure, lateSegmentSpeed } from "@/lib/accurace/features";
import type { AccuraceRun, StyleFeature, TargetRace, Feature } from "@/lib/accurace/types";
import { classifyCoverage, type CoverageState } from "./common";

export type TempoContext = { byTjk: Map<number, AccuraceRun[]> };

// RAN RCA aynı sabit Accurace snapshot'ını hem D hem V1 TEMPO'da kullanır.
// Yalnız çağıran açıkça runs verdiğinde çalışır; mevcut disk/production yolu değişmez.
// Tarih kısıtlamasını styleVector(r.date < target.date) aynen uygular.
const suppliedTempoContexts = new WeakMap<AccuraceRun[], TempoContext>();
export function tempoContextFromRuns(runs: AccuraceRun[]): TempoContext {
  const cached = suppliedTempoContexts.get(runs);
  if (cached) return cached;
  const byTjk = new Map<number, AccuraceRun[]>();
  for (const r of runs) {
    const existing = byTjk.get(r.tjk);
    if (existing) existing.push(r);
    else byTjk.set(r.tjk, [r]);
  }
  const ctx = { byTjk };
  suppliedTempoContexts.set(runs, ctx);
  return ctx;
}

/** TÜM Accurace arşivini BİR KEZ yükler (pahalı) — çağıran taraf bir yarış/toplu eğitim
 *  turu boyunca AYNI context'i paylaşmalı (history-source.ts'teki resolver deseniyle AYNI
 *  N+1 önleme disiplini).
 *  2026-10-24 — PERF: computeUnifiedFamiliesForRace (predictRaceV1'in gerçek yolu) bu
 *  fonksiyonu HER YARIŞ icin YENIDEN cagiriyordu, parametre olarak paylasilan context KABUL
 *  ETMIYORDU (trainable-features.ts'in disk-onbellekli yolunun aksine) — tek yarislik
 *  predictRaceV1 cagrisi 150-300 saniye suruyordu (toplu 1140 yaris testinde 0.01 yaris/sn).
 *  Surec-omurlu modul-seviyesi onbellek: DAVRANIS/SONUC DEGISMEZ, yalniz DB gidis-donusu
 *  TEKILLESTIRILIR (tumArsiviGetir/tumOnbellegiGetir ile AYNI proje deseni). */
let cachedTempoContext: Promise<TempoContext> | null = null;
export async function loadTempoContext(): Promise<TempoContext> {
  if (cachedTempoContext) return cachedTempoContext;
  cachedTempoContext = loadTempoContextUncached();
  return cachedTempoContext;
}
const ACCURACE_SNAPSHOT_PATH = "src/lib/motor-v1/artifacts/accurace-archive-snapshot.json";
async function loadTempoContextUncached(): Promise<TempoContext> {
  // 2026-10-24 — PERF duzeltmesinin devami: trainable-features.ts'in KENDI disk onbellegi
  // zaten vardi (bu oturumda daha once kurulmus), ben bunu KULLANMIYORDUM. Varsa disk'ten
  // (aninda), yoksa (ilk kurulum/snapshot eksikse) canli DB'den oku — davranis/kapsam AYNI,
  // yalniz kaynak hizli ise onu tercih eder.
  const fsMod = await import("node:fs");
  if (fsMod.existsSync(ACCURACE_SNAPSHOT_PATH)) {
    const snap = JSON.parse(fsMod.readFileSync(ACCURACE_SNAPSHOT_PATH, "utf8")) as { builtAt: string; runs: (Omit<AccuraceRun, "date"> & { date: string })[] };
    const byTjk = new Map<number, AccuraceRun[]>();
    for (const r of snap.runs) {
      const run: AccuraceRun = { ...r, date: new Date(r.date) } as AccuraceRun;
      const arr = byTjk.get(run.tjk);
      if (arr) arr.push(run); else byTjk.set(run.tjk, [run]);
    }
    console.log(`[loadTempoContext] DISK onbellekten yuklendi (builtAt=${snap.builtAt}), ${snap.runs.length} kayit.`);
    return { byTjk };
  }
  console.log(`[loadTempoContext] Disk onbellegi yok, canli DB'den cekiliyor (yavas)...`);
  const runs = await accuraceKosulari();
  const byTjk = new Map<number, AccuraceRun[]>();
  for (const r of runs) {
    const a = byTjk.get(r.tjk);
    if (a) a.push(r);
    else byTjk.set(r.tjk, [r]);
  }
  return { byTjk };
}

function pastRunCount(tjkAtId: number, target: TargetRace, ctx: TempoContext): number {
  return (ctx.byTjk.get(tjkAtId) ?? []).filter((r) => r.date < target.date).length;
}

function styleOf(tjkAtId: number | null, target: TargetRace, ctx: TempoContext): StyleFeature {
  if (tjkAtId == null) return { vec: null, observed: false, reliability: 0, effectiveN: 0, missingReason: "NO_STYLE_HISTORY" };
  return styleVector(ctx.byTjk.get(tjkAtId) ?? [], target);
}

export type TempoStyleResult = {
  vec: number[] | null; // [kaçak, ön_grup, takip, orta, bekle, geri]
  leadTendency: number | null; // TEMPO_01 — p_lead,i = vec[0]
  frontGroupTendency: number | null; // vec[0]+vec[1] — TEMPO_02/04'ün "front" tanımı (v546-1 ile AYNI)
  pastRunCount: number; // N'den bağımsız TOPLAM geçmiş Accurace koşusu
  effectiveN: number; // styleVector'ın zaman/mesafe ağırlıklı etkin örneklemi
  reliability: number;
  observed: boolean;
  missingReason: StyleFeature["missingReason"];
  coverageState: CoverageState;
};

/**
 * TEMPO_01 — atın liderlik/ön-grup EĞİLİMİ. Sabit +/- bir "stil puanı" ÜRETMEZ — [0,1]
 * aralığında bir ORAN (geçmiş ilk-çeyrek sıra gözlemlerinin Dirichlet-düzgünleştirilmiş payı).
 * 2026-10-17 kullanıcı düzeltmesi: bu oranın KALİBRE EDİLMİŞ bir P(öne gider) olduğu HENÜZ
 * doğrulanmadı (ör. gerçek liderlik oranlarıyla kalibrasyon eğrisi çizilmedi) — bu yüzden
 * "leadTendency" (eğilim) olarak adlandırılır, "leadProbability" DEĞİL.
 */
export function computeTempoLiderlikEgilimi(tjkAtId: number | null, target: TargetRace, ctx: TempoContext): TempoStyleResult {
  if (tjkAtId == null) {
    return {
      vec: null, leadTendency: null, frontGroupTendency: null, pastRunCount: 0,
      effectiveN: 0, reliability: 0, observed: false, missingReason: "NO_STYLE_HISTORY",
      coverageState: "IDENTITY_UNRESOLVED",
    };
  }
  const n = pastRunCount(tjkAtId, target, ctx);
  const sf = styleOf(tjkAtId, target, ctx);
  const coverageState: CoverageState = n === 0 ? "TRUE_DEBUTANT" : classifyCoverage(true, n, Math.round(sf.effectiveN));
  return {
    vec: sf.vec,
    leadTendency: sf.vec ? sf.vec[0] : null,
    frontGroupTendency: sf.vec ? sf.vec[0] + sf.vec[1] : null,
    pastRunCount: n,
    effectiveN: sf.effectiveN,
    reliability: sf.reliability,
    observed: sf.observed,
    missingReason: sf.missingReason,
    coverageState,
  };
}

export type TempoPressureResult = {
  leadPressure: number | null; // Σ_{j≠i} vec0_j — registry'nin TAM/literal formülü
  frontGroupPressure: number | null; // Σ_{j≠i} (vec0_j+vec1_j) — v546-1'in "front"u (DAHA GENİŞ)
  nObservedRivals: number;
  nMissingRivals: number;
};

/**
 * TEMPO_02 — rakip tempo baskısı. Hedef at HER ZAMAN kendi rakip grubundan dışlanır (SINIF
 * ailesindeki leave-one-out disiplinin AYNISI). `rivalTjkAtIds` ÇAĞIRAN TARAFÇA, atın KENDİ
 * koşucu kimliğine (runnerId/no) göre ÖNCEDEN dışlanmış olarak verilir — tjkAtId EŞİTLİĞİNE
 * göre filtreleme YAPILMAZ, çünkü iki farklı at da tjkAtId=null (kimlik bilinmiyor) olabilir
 * ve bu durumda eşitlik testi YANLIŞ atı dışlardı.
 */
export function computeTempoRakipBaskisi(
  rivalTjkAtIds: (number | null)[],
  target: TargetRace,
  ctx: TempoContext
): TempoPressureResult {
  const rivalStyles = rivalTjkAtIds.map((id) => styleOf(id, target, ctx));
  const { vec, nObserved, nMissing } = rivalPressure(rivalStyles);
  return {
    leadPressure: vec ? vec[0] : null,
    frontGroupPressure: vec ? vec[0] + vec[1] : null,
    nObservedRivals: nObserved,
    nMissingRivals: nMissing,
  };
}

export type TempoTekLiderGostergesiResult = {
  value: number | null; // LONE_i = leadTendency_i · Π_{j≠i}(1-leadTendency_j) — bir GÖSTERGE, kalibre OLASILIK DEĞİL
  ownLeadTendency: number | null;
  nObservedRivals: number;
  nMissingRivals: number;
};

/**
 * TEMPO_03 — tek-liderlik GÖSTERGESİ (2026-10-17 kullanıcı düzeltmesi: "olasılık" DEĞİL —
 * hem girdi (leadTendency, henüz kalibre edilmemiş) hem birleştirme (aşağıdaki bağımsızlık
 * varsayımı) doğrulanmamış, bu yüzden çıktı bir OLASILIK iddiası TAŞIMAZ, yalnız sıralama/
 * karşılaştırma amaçlı bir göstergedir).
 *
 * KOŞULLU BAĞIMSIZLIK VARSAYIMI açıkça belirtilir (kullanıcı talimatı): her rakibin "öne
 * gitme" olayı istatistiksel BAĞIMSIZ kabul edilir — gerçekte birden fazla at aynı anda öne
 * gitmeye çalışırsa olaylar NEGATİF KORELE olabilir (yalnız biri gerçekten önde bitirebilir),
 * bu formül bu dinamiği YAKALAMAZ. v546-1-engine.ts'teki `1 - Σ(leadTendency_j)` DOĞRUSAL
 * yaklaşığı YERİNE burada registry'nin ORİJİNAL çarpım formülü (Π(1-leadTendency_j))
 * kullanıldı — AYNI veri (styleVector), FARKLI/daha-literal birleştirme.
 */
export function computeTempoTekLiderGostergesi(
  targetTjkAtId: number | null,
  rivalTjkAtIds: (number | null)[],
  target: TargetRace,
  ctx: TempoContext
): TempoTekLiderGostergesiResult {
  if (targetTjkAtId == null) return { value: null, ownLeadTendency: null, nObservedRivals: 0, nMissingRivals: 0 };
  const own = styleOf(targetTjkAtId, target, ctx);
  if (!own.observed || !own.vec) {
    return { value: null, ownLeadTendency: null, nObservedRivals: 0, nMissingRivals: rivalTjkAtIds.length };
  }
  let product = 1;
  let nObserved = 0;
  let nMissing = 0;
  for (const id of rivalTjkAtIds) {
    const rivalStyle = styleOf(id, target, ctx);
    if (!rivalStyle.observed || !rivalStyle.vec) {
      nMissing++;
      continue;
    }
    nObserved++;
    product *= Math.max(0, 1 - rivalStyle.vec[0]);
  }
  return { value: own.vec[0] * product, ownLeadTendency: own.vec[0], nObservedRivals: nObserved, nMissingRivals: nMissing };
}

export type TempoUyumResult = {
  closerPressureFit: number | null; // (bekle+geri)_own × frontGroupPressure_rakipler — v546-1'in closerFit'i, AYNEN
  lateSegmentSpeed: Feature | null; // HIZ_02'nin KENDİ motor-v1 modülü HENÜZ YOK — mevcut accurace fonksiyonu DOĞRUDAN kullanıldı
  coverageState: CoverageState;
};

/**
 * TEMPO_04 — tempo×stil uyumu. SERT KOŞUL YOK (kullanıcı uyarısı: "sert tempo oluştuğunda
 * bütün geriden gelenleri otomatik avantajlı kabul etmeyin"): closerPressureFit SÜREKLİ bir
 * çarpım, eşik/if-else dalı İÇERMEZ — rakip baskısı ve atın kendi geriden-gelme eğilimi ne
 * kadar büyükse değer o kadar büyür, ama hiçbir sabit kesme noktası YOK.
 * FORM/PMZ_02 ile bağlantı (kullanıcı talimatı) BİLİNÇLİ OLARAK bu fonksiyonun İÇİNE
 * SIKIŞTIRILMADI — ayrı sinyaller olarak kalıp NİHAİ RAPORUN anlatı katmanında BİRLİKTE
 * yorumlanıyor (motorun amacı tek tek puan toplamak değil, bkz. kullanıcının standing kuralı).
 */
export function computeTempoUyum(
  targetTjkAtId: number | null,
  rivalTjkAtIds: (number | null)[],
  target: TargetRace,
  ctx: TempoContext
): TempoUyumResult {
  if (targetTjkAtId == null) return { closerPressureFit: null, lateSegmentSpeed: null, coverageState: "IDENTITY_UNRESOLVED" };
  const own = styleOf(targetTjkAtId, target, ctx);
  const pressure = computeTempoRakipBaskisi(rivalTjkAtIds, target, ctx);
  const closerPressureFit =
    own.vec && pressure.frontGroupPressure != null ? (own.vec[4] + own.vec[5]) * pressure.frontGroupPressure : null;
  const history = ctx.byTjk.get(targetTjkAtId) ?? [];
  const ls = lateSegmentSpeed(history, target);
  const n = pastRunCount(targetTjkAtId, target, ctx);
  const coverageState: CoverageState = n === 0 ? "TRUE_DEBUTANT" : classifyCoverage(true, n, Math.round(own.effectiveN));
  return { closerPressureFit, lateSegmentSpeed: ls, coverageState };
}
