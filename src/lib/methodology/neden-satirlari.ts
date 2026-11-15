// "NEDEN BU SIRADA?" — bir atın modeldeki sırasını belirleyen EN BÜYÜK tekil sinyal katkıları (admin analiz kartı, 2026-11-15).
// Eski kart "aile" katkı toplamlarını + bütünlük sayaçlarını gösteriyordu: işaret-sayımı (ör. +0.0003 de "pozitif aile" sayılıyordu)
// ve kayıtlı sonuçlarda ayırt edicilik yoktu (arac-butunluk-dogrulama.mts: 1. sıradaki at BANKO/ILK3/ILK6/YETERSİZ bütünlükte
// %30/%36/%33/%30 kazanıyor — fark gürültü içinde). Bu fonksiyon gerçek model katkısını (β·z) doğrudan, okunaklı adla gösterir.

/** Sinyal kodu → okunaklı ad + (ham değerin yorumu). `hamNotu`: kartta ham değerin yanına konan kısa açıklama. */
export const SINYAL_BILGI: Record<string, { ad: string; ham?: (v: number) => string }> = {
  fMean: { ad: "Son 6 yarış derece ort.", ham: (v) => `ort. ${v.toFixed(1)} · sınıfa bakmaz` },
  lastWon: { ad: "Son yarışını kazandı", ham: (v) => (v >= 1 ? "evet" : "hayır") },
  dususDelta: { ad: "Sınıf değişimi (önceki yarışa göre)", ham: (v) => (v > 0 ? `${v.toFixed(0)} basamak DÜŞÜŞ` : v < 0 ? `${(-v).toFixed(0)} basamak YÜKSELİŞ` : "aynı sınıf") },
  jokeyPIT: { ad: "Jokey seviyesi (son 365 gün)", ham: (v) => `%${v.toFixed(1)} kazanma` },
  antrenorPIT: { ad: "Antrenör seviyesi (son 365 gün)", ham: (v) => `%${v.toFixed(1)} kazanma` },
  hpRel: { ad: "Handikap puanı (sahaya göre)", ham: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(0)} HP` },
  kiloRel: { ad: "Taşıdığı kilo (sahaya göre)", ham: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)} kg` },
  kgsLog: { ad: "Dinlenme süresi (KGS)", ham: (v) => `${Math.round(Math.expm1(v))} gün` },
  sexE: { ad: "Cins", ham: (v) => (v >= 1 ? "erkek (e)" : "e dışı (dişi, iğdiş vb.)") },
  hizDerecesi: { ad: "Hız derecesi" },
  h2hNetSkor: { ad: "Baş başa (rakiplerle ortak yarış)" },
  zeminToleransi: { ad: "Zemin toleransı" },
  zeminMesafeDeneyim: { ad: "Zemin+mesafe deneyimi" },
  yarisGidisatiSkoru: { ad: "Yarış gidişatı (tempo uyumu)" },
  sireOrani: { ad: "Pedigri" },
  ACC_CLOSE_RES: { ad: "Kapanış gücü (Accurace)" },
  ACC_LATE: { ad: "Geç segment hızı (Accurace)" },
  ACC_SPEED: { ad: "Hız artığı (Accurace)" },
  PS_front: { ad: "Öne çıkma uyumu" },
  PS_closerFit: { ad: "Kapanışçı uyumu (geriden gelen profil)" },
  jokeyFormuGenel: { ad: "Jokey formu (son 30 gün)" },
  galopKalite: { ad: "Galop kalitesi" },
  antrenorOraniGenel: { ad: "Antrenör oranı" },
  sireOraniBirlesik: { ad: "Pedigri (baba+anne+anne babası)" },
};

export type NedenSinyal = { kod: string; ad: string; katki: number; ham: string | null };
export type NedenSatirlari = { arti: NedenSinyal[]; eksi: NedenSinyal[] };
type Girdi = { kod: string; hamDeger?: number | null; katki: number; observed?: boolean };

/** Bir attaki tekil sinyallerden |katkı| ≥ eşik olanların en büyük `n` artı ve eksi tanesi. Gözlemsiz sinyal sayılmaz. */
export function nedenSatirlari(sinyaller: Girdi[] | undefined, opts: { esik?: number; n?: number } = {}): NedenSatirlari {
  const esik = opts.esik ?? 0.1, n = opts.n ?? 3;
  const liste: NedenSinyal[] = (sinyaller ?? [])
    .filter((s) => s.observed !== false && Number.isFinite(s.katki) && Math.abs(s.katki) >= esik)
    .map((s) => {
      const b = SINYAL_BILGI[s.kod];
      const ham = b?.ham && s.hamDeger != null && Number.isFinite(s.hamDeger) ? b.ham(s.hamDeger) : null;
      return { kod: s.kod, ad: b?.ad ?? s.kod, katki: s.katki, ham };
    });
  return {
    arti: liste.filter((s) => s.katki > 0).sort((a, b) => b.katki - a.katki).slice(0, n),
    eksi: liste.filter((s) => s.katki < 0).sort((a, b) => a.katki - b.katki).slice(0, n),
  };
}
