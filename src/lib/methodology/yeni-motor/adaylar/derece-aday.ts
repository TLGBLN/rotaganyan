// YENİ MOTOR — ADAY HESAP: SON_6_DERECE (SON6) ve HIZ_DERECESI (kullanıcı tanımı, 2026-11-18). AKTİF SİNYAL DEĞİLDİR: SINYAL_KAYDI'na EKLENMEDİ.
// TJK RESMÎ bitiş süresi (HorseRaceHistoryCache "time") kullanılır; Accurace zamanıyla KARIŞTIRILMAZ. SAF: veritabanı / ağ / saat / rastgelelik YOK.
// Yalnız hedef yarış gününden KESİNLİKLE önceki (tarih < t) satırlar (hem atın geçmişi hem referans). Eksik/geçersiz süreye puan UYDURULMAZ.
//   Z_i   = (μ − T_i)/σ        T_i: resmî bitiş süresi; μ,σ: aynı ırk+yüzey+hipodrom+mesafe grubunun (n ≥ 30; yoksa hipodromsuz) tarihsel ortalaması/sapması (t'den önceki satırlar). Yüksek Z = hızlı.
//   SON6  = (6Z1+5Z2+4Z3+3Z4+2Z5+Z6)/21   Z1 = EN SON yarış; 6'dan az uygun yarış varsa mevcut yarışların ağırlıkları kendi toplamlarına bölünür (yeniden normalize).
//   HIZ_DERECESI = (en iyi 2 Z'nin ortalaması), son 6 uygun yarış içinden; tek uygun yarış varsa o yarışın Z'si ve "düşük güven" işareti.
export const DERECE_GUN_MS = 86400000;
export const DERECE_SABITLERI = { minGrupN: 30, sonN: 6, agirliklar: [6, 5, 4, 3, 2, 1] } as const;
export type DereceKaydi = { atId: number; tarih: number; irk: "INGILIZ" | "ARAP"; yuzey: string; hip: string; mesafe: number; sure: number };

const ikili = (a: number[], x: number) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m]! < x) lo = m + 1; else hi = m; } return lo; };
const anahtar = (r: DereceKaydi, sev: 1 | 2) => (sev === 1 ? [r.irk, r.yuzey, r.hip, r.mesafe].join("|") : [r.irk, r.yuzey, r.mesafe].join("|"));
class Seri { private ham: { t: number; x: number }[] = []; t: number[] = []; n: number[] = [0]; sx: number[] = [0]; sxx: number[] = [0];
  ekle(t: number, x: number) { this.ham.push({ t, x }); } kapat() { this.ham.sort((a, b) => a.t - b.t); this.t = this.ham.map((h) => h.t); for (const h of this.ham) { this.n.push(this.n[this.n.length - 1]! + 1); this.sx.push(this.sx[this.sx.length - 1]! + h.x); this.sxx.push(this.sxx[this.sxx.length - 1]! + h.x * h.x); } this.ham = []; } }

export class DereceDeposu {
  private atIdx = new Map<number, DereceKaydi[]>(); private grp = new Map<string, Seri>();
  constructor(readonly kayitlar: DereceKaydi[]) {
    for (const r of kayitlar) { const e = this.atIdx.get(r.atId) ?? []; e.push(r); this.atIdx.set(r.atId, e); for (const sev of [1, 2] as const) { const k = sev + "#" + anahtar(r, sev); const s = this.grp.get(k) ?? new Seri(); s.ekle(r.tarih, r.sure); this.grp.set(k, s); } }
    for (const e of this.atIdx.values()) e.sort((a, b) => a.tarih - b.tarih); for (const s of this.grp.values()) s.kapat();
  }
  /** Sızıntı dedektörü: tarih ≥ t satırların süresi bozulur; aynı güne (t) ve geleceğe uç değerli sahte satırlar eklenir. */
  gelecegiBoz(t: number, tohum = 1): DereceDeposu {
    let s = tohum; const r = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; const yeni: DereceKaydi[] = [];
    for (const x of this.kayitlar) { if (x.tarih < t) { yeni.push(x); continue; } yeni.push({ ...x, sure: x.sure * (0.8 + r() * 0.4) }); yeni.push({ ...x, atId: x.atId, tarih: x.tarih + DERECE_GUN_MS * Math.floor(r() * 20), sure: x.sure * 0.7 }); }
    for (const [atId, e] of this.atIdx) { const ref = e[0]; if (ref) for (let i = 0; i < 4; i++) yeni.push({ ...ref, atId, tarih: t, sure: ref.sure * 0.6 }); }
    return new DereceDeposu(yeni);
  }
  gorunum(t: number): DereceGorunum { return new DereceGorunum(this, t); }
  _at(id: number) { return this.atIdx.get(id); } _grp(k: string) { return this.grp.get(k); }
}
export type DereceGrup = { mu: number; sd: number; n: number; seviye: 1 | 2; anahtar: string; refEnYeni: number };
export class DereceGorunum {
  constructor(private readonly d: DereceDeposu, readonly t: number) {}
  /** Atın t'den KESİNLİKLE önceki satırları (eskiden yeniye). */
  atKayitlari(atId: number): DereceKaydi[] { const e = this.d._at(atId); if (!e) return []; return e.filter((x) => x.tarih < this.t); }
  grup(r: DereceKaydi): DereceGrup | null {
    for (const sev of [1, 2] as const) { const k = sev + "#" + anahtar(r, sev); const s = this.d._grp(k); if (!s) continue; const i = ikili(s.t, this.t); const n = s.n[i]!; if (n < DERECE_SABITLERI.minGrupN) continue; const mu = s.sx[i]! / n; const v = (s.sxx[i]! - n * mu * mu) / (n - 1); if (!(v > 1e-9)) continue; return { mu, sd: Math.sqrt(v), n, seviye: sev, anahtar: k, refEnYeni: s.t[i - 1]! }; }
    return null;
  }
}
export type DereceYaris = { kayit: DereceKaydi; z: number; grup: DereceGrup; sira: number; agirlik: number; kullanilan: boolean }; // sira: 1 = en son
export type DereceBilesenleri = {
  son6: number | null; hizDerecesi: number | null;
  yarislar: DereceYaris[]; // son 6 UYGUN yarış (en yeni önce)
  guven: { uygunToplam: number; kullanilan: number; tekYarisDusukGuven: boolean; sonYarisGun: number | null; enGevsekSeviye: number | null };
};
/** Bir atın yarış-öncesi SON6 ve HIZ_DERECESI değerleri (YALNIZ as-of görünüm). */
export function dereceBilesenleri(g: DereceGorunum, atId: number): DereceBilesenleri {
  const uygun: { kayit: DereceKaydi; z: number; grup: DereceGrup }[] = []; for (const k of g.atKayitlari(atId)) { const gr = g.grup(k); if (gr) uygun.push({ kayit: k, z: (gr.mu - k.sure) / gr.sd, grup: gr }); }
  const son = uygun.slice(-DERECE_SABITLERI.sonN).reverse(); const yaris: DereceYaris[] = son.map((u, i) => ({ ...u, sira: i + 1, agirlik: DERECE_SABITLERI.agirliklar[i]!, kullanilan: true }));
  const ag = sum(yaris.map((y) => y.agirlik)); const sonZ = [...yaris].map((y) => y.z).sort((a, b) => b - a);
  const sonTarih = g.atKayitlari(atId).length ? g.atKayitlari(atId)[g.atKayitlari(atId).length - 1]!.tarih : null;
  return {
    son6: yaris.length ? sum(yaris.map((y) => y.agirlik * y.z)) / ag : null,
    hizDerecesi: yaris.length === 0 ? null : yaris.length === 1 ? sonZ[0]! : (sonZ[0]! + sonZ[1]!) / 2,
    yarislar: yaris, guven: { uygunToplam: uygun.length, kullanilan: yaris.length, tekYarisDusukGuven: yaris.length === 1, sonYarisGun: sonTarih == null ? null : Math.round((g.t - sonTarih) / DERECE_GUN_MS), enGevsekSeviye: yaris.length ? Math.max(...yaris.map((y) => y.grup.seviye)) : null },
  };
}
function sum(a: number[]) { return a.reduce((s, x) => s + x, 0); }
