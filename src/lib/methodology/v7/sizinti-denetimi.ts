// V7 — OTOMATİK SIZINTI DENETİMİ ("gelecek-bozma" metamorfik testi). SAF, DB'siz. Özellik kodunu OKUMAZ; yalnız davranışını sınar:
//   yarış günü t için özelliği (1) gerçek depoyla, (2) t ve sonrasındaki TÜM kayıtların sonuçları rastgele/uç değerlerle bozulmuş + uç değerli gelecek kayıtları eklenmiş depoyla hesaplar.
//   Özellik yarış öncesi bilgiyle hesaplanıyorsa iki değer BİREBİR aynı olmak zorundadır. Fark = SIZINTI (özellik gelecekteki/aynı gündeki veriye bakıyor).
// Not: özellik fonksiyonu yalnız AsOfGorunum alır; deposuna doğrudan erişen ya da global durum okuyan (kapanış) özellikler bu testte yakalanır, çünkü bozulan depo bu yolla görünür.
import { AsOfGorunum, Deposu, type KosuKaydi } from "./asof-veri";
export type Kosucu = { raceId: string; t: number; atId: number | null; no: number; jokey: string | null; antrenor: string | null; mesafe: number; yuzey: string | null; sinif: string; hip: string; kilo: number | null; hp: number | null; alan: number };
export type OzellikFn = (g: AsOfGorunum, k: Kosucu) => number | null;
export type SizintiRaporu = { gecti: boolean; denenen: number; farkli: number; ornekFark: { raceId: string; no: number; gercek: number | null; bozuk: number | null }[]; yorum: string };

const esit = (a: number | null, b: number | null) => (a == null || b == null ? a === b : Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)));

/** `ornekler`: denetlenecek koşucular (farklı yarış günlerinden). En fazla `maksTarih` farklı gün için bozuk depo kurulur (maliyet kontrolü). */
export function sizintiDenetimi(ozellik: OzellikFn, deposu: Deposu, ornekler: Kosucu[], maksTarih = 6, tohum = 1): SizintiRaporu {
  const gunler = [...new Set(ornekler.map((o) => o.t))].sort((a, b) => a - b); const secilen = gunler.filter((_, i) => i % Math.max(1, Math.ceil(gunler.length / maksTarih)) === 0).slice(0, maksTarih);
  let denenen = 0, farkli = 0; const ornekFark: SizintiRaporu["ornekFark"] = [];
  for (const t of secilen) {
    const bozuk = deposu.gelecegiBoz(t, tohum + t % 997); const g0 = deposu.gorunum(t), g1 = bozuk.gorunum(t);
    for (const o of ornekler.filter((x) => x.t === t)) { const a = ozellik(g0, o), b = ozellik(g1, o); denenen++; if (!esit(a, b)) { farkli++; if (ornekFark.length < 5) ornekFark.push({ raceId: o.raceId, no: o.no, gercek: a, bozuk: b }); } }
  }
  const gecti = denenen > 0 && farkli === 0;
  return { gecti, denenen, farkli, ornekFark, yorum: denenen === 0 ? "denetlenecek koşucu yok → KANIT YOK" : gecti ? "Gelecek verisi bozulunca özellik DEĞİŞMEDİ (" + denenen + " koşucu, " + secilen.length + " gün) → yarış-öncesi bilgiyle hesaplanıyor" : "SIZINTI: " + farkli + "/" + denenen + " koşucuda değer gelecekteki veri bozulunca DEĞİŞTİ" };
}
export type { KosuKaydi };
