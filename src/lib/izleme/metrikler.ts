// İzleme metrikleri — SAF fonksiyonlar (DB/React yok), birim testli. Dashboard servisi ve bileşenleri bunları kullanır.

export type YarisKaydi = {
  raceId: string;
  tarih: string; // YYYY-MM-DD
  hip: string;
  raceNo: number;
  classType: string;
  surum: string; // model sürümü adı
  alanBuyuklugu: number;
  /** at no → modelin (normalize) kazanma olasılığı */
  model: Record<string, number>;
  /** at no → yarıştan önceki SON AGF payı (normalize); yoksa null. YALNIZ karşılaştırma referansı — modele girmez. */
  piyasa: Record<string, number> | null;
  kazananlar: number[];
  bankoAdayi: boolean;
};

export const normalize = (o: Record<string, number>): Record<string, number> => {
  const s = Object.values(o).reduce((a, b) => a + b, 0);
  if (!(s > 0)) return o;
  const r: Record<string, number> = {};
  for (const [k, v] of Object.entries(o)) r[k] = v / s;
  return r;
};

export type YarisMetrik = { ll: number; t1: number; t3: number; topP: number; top3P: number };
/** Tek yarış için: kazananın olasılığından LogLoss, Top1/Top3 isabeti, en iyi atın olasılığı ve ilk-3 olasılık toplamı. */
export function yarisMetrik(p: Record<string, number>, kazananlar: number[]): YarisMetrik {
  const sirali = Object.entries(p).map(([n, v]) => [Number(n), v] as const).sort((a, b) => b[1] - a[1]);
  const kazP = Math.max(...kazananlar.map((n) => p[String(n)] ?? 0), 1e-9);
  return {
    ll: -Math.log(kazP),
    t1: sirali.length && kazananlar.includes(sirali[0][0]) ? 1 : 0,
    t3: sirali.slice(0, 3).some(([n]) => kazananlar.includes(n)) ? 1 : 0,
    topP: sirali[0]?.[1] ?? 0,
    top3P: sirali.slice(0, 3).reduce((s, [, v]) => s + v, 0),
  };
}

export const ort = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);

export type Aralik = { oran: number; lo: number; hi: number };
/** Wilson %95 güven aralığı (oranlar için; küçük n'de normal yaklaşımdan güvenilir). */
export function wilson(x: number, n: number): Aralik {
  if (n <= 0) return { oran: NaN, lo: NaN, hi: NaN };
  const p = x / n, z = 1.96, d = 1 + (z * z) / n, c = p + (z * z) / (2 * n), m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { oran: p, lo: Math.max(0, (c - m) / d), hi: Math.min(1, (c + m) / d) };
}

/** Ortalama için bootstrap %95 aralığı (sabit tohum → sayfa her yüklendiğinde AYNI sonuç). n<8 → aralık yok. */
export function bootstrapAralik(v: number[], B = 1000): { m: number; lo: number; hi: number } {
  const m = ort(v);
  if (v.length < 8) return { m, lo: NaN, hi: NaN };
  let seed = 12345;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const bs: number[] = [];
  for (let b = 0; b < B; b++) { let q = 0; for (let i = 0; i < v.length; i++) q += v[Math.floor(rnd() * v.length)]; bs.push(q / v.length); }
  bs.sort((a, b) => a - b);
  return { m, lo: bs[Math.floor(B * 0.025)], hi: bs[Math.ceil(B * 0.975) - 1] };
}

export type MetrikSatiri = { top1: number; top3: number; ll: number };
export type DilimOzeti = {
  ad: string;
  n: number;
  model: MetrikSatiri | null;
  top1Aralik: Aralik | null;
  top3Aralik: Aralik | null;
  /** piyasa verisi olan alt küme */
  nPiyasa: number;
  piyasa: MetrikSatiri | null;
  /** aynı alt kümede modelin metrikleri (ΔLL'nin eşleşmiş karşılaştırması için) */
  modelPiyasaAltKumesinde: MetrikSatiri | null;
  /** ΔLL = model − piyasa (negatif = model daha iyi) */
  fark: { m: number; lo: number; hi: number } | null;
};

const satir = (ms: YarisMetrik[]): MetrikSatiri => ({ top1: ort(ms.map((x) => x.t1)), top3: ort(ms.map((x) => x.t3)), ll: ort(ms.map((x) => x.ll)) });

export function dilimOzeti(ad: string, kayitlar: YarisKaydi[]): DilimOzeti {
  if (!kayitlar.length) return { ad, n: 0, model: null, top1Aralik: null, top3Aralik: null, nPiyasa: 0, piyasa: null, modelPiyasaAltKumesinde: null, fark: null };
  const mm = kayitlar.map((k) => yarisMetrik(k.model, k.kazananlar));
  const pk = kayitlar.filter((k) => k.piyasa);
  const pm = pk.map((k) => yarisMetrik(k.piyasa!, k.kazananlar));
  const mmP = pk.map((k) => yarisMetrik(k.model, k.kazananlar));
  return {
    ad, n: kayitlar.length,
    model: satir(mm),
    top1Aralik: wilson(mm.reduce((s, x) => s + x.t1, 0), mm.length),
    top3Aralik: wilson(mm.reduce((s, x) => s + x.t3, 0), mm.length),
    nPiyasa: pk.length,
    piyasa: pk.length ? satir(pm) : null,
    modelPiyasaAltKumesinde: pk.length ? satir(mmP) : null,
    fark: pk.length ? bootstrapAralik(mmP.map((x, i) => x.ll - pm[i].ll)) : null,
  };
}

export type KalibrasyonKutusu = { etiket: string; n: number; ortTahmin: number; gercek: Aralik };
/** Kalibrasyon: bir tahmin değerini (en iyi atın olasılığı VEYA ilk-3 olasılık toplamı) kutulara böl, kutu başına gerçek isabet oranı. */
export function kalibrasyon(kayitlar: YarisKaydi[], deger: "top1" | "top3", sinirlar: number[]): KalibrasyonKutusu[] {
  const ms = kayitlar.map((k) => yarisMetrik(k.model, k.kazananlar));
  const out: KalibrasyonKutusu[] = [];
  for (let i = 0; i < sinirlar.length - 1; i++) {
    const lo = sinirlar[i], hi = sinirlar[i + 1];
    const secili = ms.filter((m) => { const v = deger === "top1" ? m.topP : m.top3P; return v >= lo && v < hi; });
    if (!secili.length) { out.push({ etiket: `%${Math.round(lo * 100)}–${Math.round(Math.min(hi, 1) * 100)}`, n: 0, ortTahmin: NaN, gercek: { oran: NaN, lo: NaN, hi: NaN } }); continue; }
    out.push({
      etiket: `%${Math.round(lo * 100)}–${Math.round(Math.min(hi, 1) * 100)}`, n: secili.length,
      ortTahmin: ort(secili.map((m) => (deger === "top1" ? m.topP : m.top3P))),
      gercek: wilson(secili.reduce((s, m) => s + (deger === "top1" ? m.t1 : m.t3), 0), secili.length),
    });
  }
  return out;
}

export const TIP_GRUPLARI = ["Handikap", "ŞARTLI 2-5", "KV/Satış/Grup/Diğer", "Maiden/ŞARTLI 19", "ŞARTLI 1/27"] as const;
export function tipGrubu(classType: string): (typeof TIP_GRUPLARI)[number] {
  const u = classType.toUpperCase();
  if (u.includes("HANDIKAP")) return "Handikap";
  if (u.includes("MAIDEN") || u.includes("ŞARTLI 19")) return "Maiden/ŞARTLI 19";
  if (u.includes("ŞARTLI 1") || u.includes("ŞARTLI 27")) return "ŞARTLI 1/27";
  if (u.includes("ŞARTLI") || u.includes("SARTLI")) return "ŞARTLI 2-5";
  return "KV/Satış/Grup/Diğer";
}

export function alanBuyuklugu(n: number): "≤7 at" | "8–10 at" | "11+ at" {
  return n <= 7 ? "≤7 at" : n <= 10 ? "8–10 at" : "11+ at";
}

/** Banko adayı isabeti: model sırasındaki 1. at kazandı mı. */
export function bankoOzeti(kayitlar: YarisKaydi[]): { n: number; tuttu: number; aralik: Aralik } {
  const b = kayitlar.filter((k) => k.bankoAdayi);
  const tuttu = b.filter((k) => yarisMetrik(k.model, k.kazananlar).t1 === 1).length;
  return { n: b.length, tuttu, aralik: wilson(tuttu, b.length) };
}

export type DegerlendirmeDurumu = "yetersiz" | "beklenen" | "iyi" | "kotu";
/** Canlı ΔLL(model−piyasa) güven aralığını CV beklentisiyle (cvFark) karşılaştırır. n<150 → hüküm yok. */
export function degerlendir(fark: { m: number; lo: number; hi: number } | null, nPiyasa: number, cvFark: number, minN = 150): DegerlendirmeDurumu {
  if (!fark || nPiyasa < minN || !Number.isFinite(fark.lo)) return "yetersiz";
  if (fark.lo > cvFark) return "kotu";
  if (fark.hi < cvFark) return "iyi";
  return "beklenen";
}

export type SinyalDurumu = "ok" | "dusus" | "veriYok" | "yediGunYok";
/** Bir sinyalin canlı gözlem durumu: son 30 günde hiç kayıt yok → veriYok; son 7 günde yok → yediGunYok; 7 günlük gözlem oranı
 *  30 günlüğün 10+ puan altındaysa → dusus (veri kaynağı bozulmuş olabilir). Tablo ve Durum Özeti AYNI kuralı kullanır. */
export function sinyalDurumu(s: { n7: number; obs7: number; n30: number; obs30: number } | undefined): SinyalDurumu {
  if (!s || s.n30 === 0) return "veriYok";
  if (s.n7 === 0) return "yediGunYok";
  return s.obs7 / s.n7 < s.obs30 / s.n30 - 0.1 ? "dusus" : "ok";
}
