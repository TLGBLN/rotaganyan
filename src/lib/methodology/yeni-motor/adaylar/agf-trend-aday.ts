// YENİ MOTOR — ARAŞTIRMA HESABI: AGF_TREND (kullanıcı isteği 2026-11-18). AKTİF SİNYAL DEĞİLDİR; MOTORA/KUPONA GİRMEZ (kullanıcı kararı 2026-11-14: AGF yalnız DEĞERLENDİRMEDE). SINYAL_KAYDI'na EKLENMEDİ.
// SAF: veritabanı / ağ / saat / rastgelelik YOK. Yalnız yarış başlangıcından KESİNLİKLE önce (t < başlangıç) alınmış AGF kesitleri kullanılır.
//   AGF_SEVIYE  = ln(son AGF)                      piyasa kapanışa yakın düzeyi (yalnız karşılaştırma için)
//   AGF_TREND   = son − ilk  (yüzde puan)          koddaki mevcut tanım (agf-trend.actions.ts): ASIL sinyal puan farkıdır
//   AGF_TREND_G = ln(son / ilk)                    göreli değişim (küçük paydada gürültülü; yalnız karşılaştırma)
//   AGF_TREND_E = (başlangıçtan ≥ erkenSaat önceki son kesit) − ilk     kapanışa YAKIN piyasa bilgisini dışarıda bırakan duyarlılık
// Tek kesitli atlarda trend NULL ("anlamlı trend yok"); sıfır DEĞİL.
export const AGF_SAAT_MS = 3600000;
/** t: kesit zamanı (ms, UTC); agf: yüzde (örn. 12.5). */
export type AgfNokta = { t: number; agf: number };
export type AgfOzellik = { n: number; ilk: number | null; son: number | null; sonGecikmeSaat: number | null; seviye: number | null; trend: number | null; trendG: number | null; trendE: number | null; nErken: number };

/** Race.time "SS:DD" TR duvar saati (UTC+3 sabit) + gün (ms, UTC gece yarısı) → gerçek UTC başlangıç; ayrıştırılamazsa null (sessiz varsayım YOK). */
export function yarisBaslangicUtc(gunMs: number, saat: string | null): number | null {
  const m = (saat ?? "").match(/^(\d{1,2}):(\d{2})$/); if (!m) return null; const h = Number(m[1]), d = Number(m[2]); if (h > 23 || d > 59) return null; return gunMs + (h - 3) * AGF_SAAT_MS + d * 60000;
}
/** Başlangıçtan ÖNCEKİ (kesin t < baslangic) kesitlerden özellikler. */
export function agfOzellik(noktalar: AgfNokta[], baslangic: number, erkenSaat = 2): AgfOzellik {
  const p = noktalar.filter((x) => x.t < baslangic && Number.isFinite(x.agf)).sort((a, b) => a.t - b.t); const n = p.length;
  if (n === 0) return { n: 0, ilk: null, son: null, sonGecikmeSaat: null, seviye: null, trend: null, trendG: null, trendE: null, nErken: 0 };
  const ilk = p[0]!.agf, son = p[n - 1]!.agf; const erken = p.filter((x) => x.t <= baslangic - erkenSaat * AGF_SAAT_MS);
  return {
    n, ilk, son, sonGecikmeSaat: (baslangic - p[n - 1]!.t) / AGF_SAAT_MS,
    seviye: son > 0 ? Math.log(son) : null,
    trend: n >= 2 ? Math.round((son - ilk) * 1e6) / 1e6 : null,
    trendG: n >= 2 && ilk > 0 && son > 0 ? Math.log(son / ilk) : null,
    trendE: erken.length >= 2 ? Math.round((erken[erken.length - 1]!.agf - ilk) * 1e6) / 1e6 : null,
    nErken: erken.length,
  };
}
/** Sızıntı dedektörü: başlangıç ve sonrasındaki kesitlerin değeri bozulur, sonrasına uç değerli sahte kesitler eklenir. */
export function agfGelecegiBoz(noktalar: AgfNokta[], baslangic: number, tohum = 1): AgfNokta[] {
  let s = tohum; const r = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const yeni = noktalar.map((x) => (x.t < baslangic ? x : { t: x.t, agf: r() * 60 }));
  yeni.push({ t: baslangic, agf: 55 }, { t: baslangic + AGF_SAAT_MS, agf: 0.5 }, { t: baslangic + 5 * AGF_SAAT_MS, agf: 70 }); return yeni;
}

export type AgfPencere = { d: number | null; spanDk: number | null };
/**
 * EŞİT UZUNLUKTA pencere (kullanıcı isteği 2026-11-18): son kesite sabitlenir. d = son − (son kesitten EN AZ `dakika` önceki EN SON kesit); böyle bir kesit yoksa NULL.
 * spanDk = o iki kesit arasındaki GERÇEK süre (≥ dakika; kesit aralığı düzensiz olduğu için pencere tam eşit olmayabilir — raporlanır). Yalnız başlangıçtan KESİN önceki kesitler.
 */
export function agfSonPencere(noktalar: AgfNokta[], baslangic: number, dakika: number): AgfPencere {
  const p = noktalar.filter((x) => x.t < baslangic && Number.isFinite(x.agf)).sort((a, b) => a.t - b.t); if (p.length < 2) return { d: null, spanDk: null };
  const son = p[p.length - 1]!; const hedef = son.t - dakika * 60000; let ref: AgfNokta | null = null; for (const x of p) if (x.t <= hedef) ref = x; if (ref == null) return { d: null, spanDk: null };
  return { d: Math.round((son.agf - ref.agf) * 1e6) / 1e6, spanDk: (son.t - ref.t) / 60000 };
}
