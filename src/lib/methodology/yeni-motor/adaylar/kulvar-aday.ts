// YENİ MOTOR — ADAY HESAP: KULVAR_ETKI (kullanıcı tanımı, 2026-11-18). AKTİF SİNYAL DEĞİLDİR: SINYAL_KAYDI'na EKLENMEDİ. Araştırma başlığı.
// SAF: veritabanı / ağ / saat / rastgelelik YOK. Yalnız hedef yarış gününden KESİNLİKLE önceki (tarih < t) kayıtlar; aynı gün ve sonrası görünmez.
//   K_h = (kapı − 1) / (kapıSayısı − 1)            kapı = FİZİKSEL start kapısı (Runner.startNo), at numarası DEĞİL; kapıSayısı = ilan edilen en yüksek kapı (koşmayan atların kapıları/boş kapılar DAHİL)
//   B_g = Σ_{i∈g}(Y_i − P_i) / (Σ_{i∈g} P_i(1 − P_i) + λ)      P_i: kulvar etkisi İÇERMEYEN yarış-öncesi kazanma olasılığı (çağıran verir)
//   Grupta hiç geçmiş kayıt yoksa değer NULL ("veri yok"); sıfır DEĞİL.
// λ ve grup tanımları SABİTLENMEDİ (kullanıcı onayına tabi): çağıran taraf varyantları yan yana raporlar; hiçbiri örneklem sonucuna göre SEÇİLMEZ.
export const KULVAR_GUN_MS = 86400000;
/** y: o atın kazanıp kazanmadığı (0/1; beraberlikte kazananlardan biri ise 1). p: kulvar etkisiz yarış-öncesi kazanma olasılığı. */
export type KulvarKayit = { tarih: number; grup: string; y: 0 | 1; p: number };

const ikili = (a: number[], x: number) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m]! < x) lo = m + 1; else hi = m; } return lo; };

export class KulvarDeposu {
  private idx = new Map<string, { t: number[]; n: number[]; sy: number[]; sp: number[]; sv: number[] }>();
  constructor(readonly kayitlar: KulvarKayit[]) {
    for (const r of [...kayitlar].sort((a, b) => a.tarih - b.tarih)) { const e = this.idx.get(r.grup) ?? { t: [], n: [0], sy: [0], sp: [0], sv: [0] }; e.t.push(r.tarih); e.n.push(e.n[e.n.length - 1]! + 1); e.sy.push(e.sy[e.sy.length - 1]! + r.y); e.sp.push(e.sp[e.sp.length - 1]! + r.p); e.sv.push(e.sv[e.sv.length - 1]! + r.p * (1 - r.p)); this.idx.set(r.grup, e); }
  }
  /** Sızıntı dedektörü: tarih ≥ t kayıtların sonucu/olasılığı bozulur; aynı güne ve geleceğe uç değerli sahte kayıtlar eklenir. */
  gelecegiBoz(t: number, tohum = 1): KulvarDeposu {
    let s = tohum; const r = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; const yeni: KulvarKayit[] = [];
    for (const x of this.kayitlar) { if (x.tarih < t) { yeni.push(x); continue; } yeni.push({ ...x, y: r() < 0.5 ? 1 : 0, p: r() }); }
    for (const g of this.idx.keys()) for (let i = 0; i < 12; i++) yeni.push({ tarih: t + KULVAR_GUN_MS * (i % 3), grup: g, y: 1, p: 0.01 });
    return new KulvarDeposu(yeni);
  }
  gorunum(t: number): KulvarGorunum { return new KulvarGorunum(this, t); }
  _g(g: string) { return this.idx.get(g); }
}
export class KulvarGorunum {
  constructor(private readonly d: KulvarDeposu, readonly t: number) {}
  /** Grubun t'den KESİNLİKLE önceki toplamları. */
  toplam(grup: string) { const e = this.d._g(grup); if (!e) return { n: 0, sy: 0, sp: 0, sv: 0 }; const k = ikili(e.t, this.t); return { n: e.n[k]!, sy: e.sy[k]!, sp: e.sp[k]!, sv: e.sv[k]! }; }
}
export type KulvarEtki = { deger: number | null; n: number; sy: number; sp: number; sv: number };
export function kulvarEtki(g: KulvarGorunum, grup: string | null, lambda: number): KulvarEtki {
  if (grup == null) return { deger: null, n: 0, sy: 0, sp: 0, sv: 0 }; const x = g.toplam(grup);
  return { deger: x.n > 0 ? (x.sy - x.sp) / (x.sv + lambda) : null, ...x };
}

// ───── grup tanımları (varyantlar; hiçbiri seçilmedi)
export type KulvarVaryant = "V1" | "V2" | "V3" | "V4";
export type KulvarYaris = { hip: string; yuzey: string; mesafe: number; n: number; kapi: number | null; nKapi: number };
export const sahaBandi = (n: number) => (n <= 7 ? "s1" : n <= 10 ? "s2" : "s3");
export const mesafeBandi = (m: number) => (m <= 1300 ? "kisa" : m <= 1900 ? "orta" : "uzun");
/** K_h = (kapı−1)/(kapıSayısı−1) ∈ [0,1]; kapıSayısı ≤ 1 ise null. */
export const kapiNormal = (kapi: number | null, nKapi: number) => (kapi != null && nKapi > 1 && kapi >= 1 && kapi <= nKapi ? (kapi - 1) / (nKapi - 1) : null);
export const kapiBolge = (k: number) => (k < 1 / 3 ? "ic" : k < 2 / 3 ? "orta" : "dis");
/**
 * V1: hipodrom|yüzey|mesafe|saha bandı|kapı        (kullanıcının yazdığı tanım; hücreler seyrek)
 * V2: hipodrom|yüzey|mesafe|kapı
 * V3: hipodrom|yüzey|mesafe bandı|K_h bölgesi (iç/orta/dış üçte bir)
 * V4: yüzey|mesafe bandı|saha bandı|K_h bölgesi    (tüm hipodromlar)
 * Kapı bilinmiyorsa / geçersizse null (veri yok).
 */
export function kulvarGrup(v: KulvarVaryant, y: KulvarYaris): string | null {
  const k = kapiNormal(y.kapi, y.nKapi); if (k == null) return null;
  switch (v) {
    case "V1": return [y.hip, y.yuzey, y.mesafe, sahaBandi(y.n), y.kapi].join("|");
    case "V2": return [y.hip, y.yuzey, y.mesafe, y.kapi].join("|");
    case "V3": return [y.hip, y.yuzey, mesafeBandi(y.mesafe), kapiBolge(k)].join("|");
    case "V4": return [y.yuzey, mesafeBandi(y.mesafe), sahaBandi(y.n), kapiBolge(k)].join("|");
  }
}
