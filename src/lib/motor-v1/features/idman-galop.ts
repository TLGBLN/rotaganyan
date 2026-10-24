// ROTAGANYAN ANALİZ MOTORU v1.0 — İLİŞKİ #2 (yarısı): FORM × GALOP × DİNLENME.
// Registry IDMAN_01 formülü BİREBİR uygulanır: T_200 = 200·t_split/d_split (herhangi bir
// split uzunluğunu 200m-eşdeğerine normalize eder — FARKLI uzunluktaki galoplar bu sayede
// karşılaştırılabilir ölçeğe gelir, kullanıcı uyarısı: "karşılaştırılamayan galopları aynı
// ölçekteymiş gibi değerlendirme" tam olarak BU normalizasyonla karşılanır).
// Z_galop = (median(T_200)-T_200)/(1.4826·MAD+ε) — POPÜLASYON (bu atın KENDİ geçmişi DEĞİL,
// aynı pist/iç-dış bağlamdaki TÜM atların galopları) karşılaştırma grubudur — IDMAN_01'in
// kendi sorusu "RAKİPLERE göre ne kadar hızlıydı?" bunu gerektirir (hiz-derecesi-hesapla.ts'in
// HIZ_01 için kurduğu popülasyon-ortalaması deseniyle AYNI mimari, ayrı kod).
//
// GERÇEK VERİ DOĞRULAMASI (2026-10-18): Gallop.splits örnekleri çekildi — anahtarlar
// "200"/"400"/"600"/"800"/"1000"/"1200"/"1400" (çoğu satırda yalnız 1-2'si dolu) +
// "pist" (Kum/Sentetik/Çim) + "ic_dis" ("İç"/""). Zaman formatı "0.MM.SS" — hiz-derecesi-
// hesapla.ts::hizSureyiSaniyeyeCevir ile AYNI ("dk.sn.yüzde" 3-parçalı) — YENİDEN
// YAZILMADI, DOĞRUDAN import edildi.

import { db } from "@/lib/db";
import { hizSureyiSaniyeyeCevir } from "@/lib/methodology/hiz-derecesi-hesapla";
import { median, medianAbsoluteDeviation } from "./common";

const GALOP_DIST_KEYS = ["200", "400", "600", "800", "1000", "1200", "1400"] as const;

type GalopPoint = { tarih: Date; t200: number };
type GalopPaceIndex = Map<string, GalopPoint[]>;

export function groupKey(pist: string | null, icDis: string | null): string {
  return `${pist ?? "BILINMIYOR"}|${icDis === "İç" ? "IC" : "DIS"}`;
}

/** Bir Gallop.splits satırının TÜM dolu (sayısal) alanlarından T_200 noktalarını üretir. */
export function splitsToT200Points(splits: unknown): number[] {
  if (!splits || typeof splits !== "object") return [];
  const rec = splits as Record<string, string | null>;
  const out: number[] = [];
  for (const key of GALOP_DIST_KEYS) {
    const raw = rec[key];
    if (!raw) continue;
    const saniye = hizSureyiSaniyeyeCevir(raw);
    if (saniye == null || saniye <= 0) continue;
    const dist = Number(key);
    out.push((200 * saniye) / dist);
  }
  return out;
}

const ONBELLEK_TTL_MS = 6 * 60 * 60 * 1000;
let onbellekCache: { index: GalopPaceIndex; zaman: number } | null = null;

/** TÜM Gallop arşivini BİR KEZ yükler (pahalı, HIZ_01'in tumOnbellegiGetir deseniyle AYNI
 *  6 saatlik TTL'li önbellek) — çağıran taraf bir toplu tur boyunca AYNI index'i paylaşmalı. */
export async function loadGalopPaceIndex(): Promise<GalopPaceIndex> {
  if (onbellekCache && Date.now() - onbellekCache.zaman < ONBELLEK_TTL_MS) return onbellekCache.index;
  const rows = await db.gallop.findMany({ select: { date: true, splits: true } });
  const index: GalopPaceIndex = new Map();
  for (const r of rows) {
    const splits = r.splits as Record<string, string | null> | null;
    if (!splits) continue;
    const key = groupKey(splits.pist ?? null, splits.ic_dis ?? null);
    const points = splitsToT200Points(splits);
    if (points.length === 0) continue;
    const t200 = points.reduce((a, b) => a + b, 0) / points.length; // bu galopun KENDİ içindeki birden fazla split ortalanır
    const arr = index.get(key) ?? [];
    arr.push({ tarih: r.date, t200 });
    index.set(key, arr);
  }
  onbellekCache = { index, zaman: Date.now() };
  return index;
}

export type Idman01Result = {
  value: number | null; // robust z-skor (yüksek = rakiplere göre YAVAŞ T_200, DÜŞÜK/NEGATİF = HIZLI — işaret eğitimde yorumlanır)
  observed: boolean;
  ownT200: number | null;
  ownGalopTarihi: string | null;
  populationMedian: number | null;
  populationN: number;
  missingReason: string | null;
};

const EPS = 1e-6;
const MIN_POPULASYON_N = 20; // az örneklemli bir pist/iç-dış kovasında z-skor güvenilmez sayılır

/**
 * IDMAN_01 — atın cutoff'tan ÖNCEKİ EN SON, en az bir sayısal split'i olan galopunun T_200'ü,
 * AYNI (pist, iç/dış) kovasındaki POPÜLASYONUN (TÜM atlar, yine cutoff'tan ÖNCE) robust
 * z-skoruna göre değerlendirilir. Galop kaydı yoksa (atların %68,4'ü, registry notu)
 * BAŞARISIZ sayılmaz — observed=false, 0/negatif ile KARIŞTIRILMAZ.
 */
export function computeIdman01(
  gallops: { date: Date; splits: unknown }[],
  cutoff: Date,
  paceIndex: GalopPaceIndex
): Idman01Result {
  const past = gallops
    .filter((g) => g.date.getTime() < cutoff.getTime())
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  let own: { tarih: Date; t200: number; key: string } | null = null;
  for (const g of past) {
    const splits = g.splits as Record<string, string | null> | null;
    if (!splits) continue;
    const points = splitsToT200Points(splits);
    if (points.length === 0) continue;
    own = { tarih: g.date, t200: points.reduce((a, b) => a + b, 0) / points.length, key: groupKey(splits.pist ?? null, splits.ic_dis ?? null) };
    break; // en SON (tarihçe sıralı) ilk geçerli galop
  }
  if (!own) {
    return { value: null, observed: false, ownT200: null, ownGalopTarihi: null, populationMedian: null, populationN: 0, missingReason: "cutoff'tan önce sayısal split içeren galop kaydı yok" };
  }

  const popAll = paceIndex.get(own.key) ?? [];
  const popPast = popAll.filter((p) => p.tarih.getTime() < cutoff.getTime()).map((p) => p.t200);
  if (popPast.length < MIN_POPULASYON_N) {
    return {
      value: null, observed: false, ownT200: own.t200, ownGalopTarihi: own.tarih.toISOString().slice(0, 10),
      populationMedian: popPast.length > 0 ? median(popPast) : null, populationN: popPast.length,
      missingReason: `popülasyon örneklemi yetersiz (n=${popPast.length}, min=${MIN_POPULASYON_N}) — kova: ${own.key}`,
    };
  }

  const med = median(popPast);
  const mad = medianAbsoluteDeviation(popPast) ?? 0;
  const z = (med - own.t200) / (1.4826 * mad + EPS); // DÜŞÜK T_200 = HIZLI -> med-own pozitif = HIZLI (işaret BİLİNÇLİ: pozitif z = hızlı)

  return {
    value: z, observed: true, ownT200: own.t200, ownGalopTarihi: own.tarih.toISOString().slice(0, 10),
    populationMedian: med, populationN: popPast.length, missingReason: null,
  };
}
