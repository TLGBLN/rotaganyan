// YENİ MOTOR — ADAY HESAP: TEMPO (kullanıcı tanımı, 2026-11-17). BU DOSYADA YALNIZ ERKEN_HIZ VE KOSU_STILI VAR; LIDERLIK_BASKISI SONRAKİ AŞAMA. AKTİF SİNYAL DEĞİLDİR: SINYAL_KAYDI'na EKLENMEDİ.
// Eski Runner.raceStyle / accurace v2 KULLANILMAZ. SAF: veritabanı / ağ / saat / rastgelelik YOK. Yalnız hedef yarış gününden KESİNLİKLE önceki (tarih < t) kayıtlar; hedef yarışın kendi ara zamanları/sıraları kullanılmaz.
// Katsayı ÖĞRENİLMEZ. Eksik veri 0 puan sayılmaz (null).
//   ERKEN_HIZ:  V = 400 / (T600 − T200)  [m/s]; ilk 100 m (çıkış) ve 100–200 m dışarıda; V, aynı ırk+yüzey+hipodrom+mesafe referansında (seviye 2: hipodromsuz) yüzdelik puana çevrilir.
//   KOSU_STILI: S = 1 − (1/3)·Σ_{d∈{200,400,600}} (R_d − 1)/(N − 1)  (1'e yakın = ön, 0'a yakın = geride); istikrar = geçmiş yarışlardaki S'nin standart sapması.
export const TEMPO_GUN_MS = 86400000;
/** BİLDİRİLEN SABİTLER (öğrenilmedi; kullanıcı onayına tabi). */
export const TEMPO_SABITLERI = { minGrupN: 30, sonNYaris: 3, minSahaN: 4, minHizMs: 10, maksHizMs: 20, pencereBasM: 200, pencereSonM: 600 } as const;
export type TempoYuzey = "KUM" | "CIM" | "SENTETIK";
export type TempoHam = { yarisId: string; atId: number | null; tarih: number; hip: string; irk: string | null; yuzey: TempoYuzey | null; mesafe: number; sahaN: number; siraGecerli: boolean; kontrol: { m: number; ms: number; place: number }[] };
export type TempoKaydi = { yarisId: string; atId: number; tarih: number; hip: string; irk: string; yuzey: TempoYuzey; mesafe: number; sahaN: number; t200: number | null; t600: number | null; v: number | null; r200: number | null; r400: number | null; r600: number | null; s: number | null };

/** Ham kaydı normalleştirir; hesaplanamayan alan null kalır (uydurma yok). */
export function tempoNormalize(h: TempoHam): { kayit: TempoKaydi | null; red: string | null } {
  if (h.atId == null) return { kayit: null, red: "ata bağlı değil" }; if (h.irk == null) return { kayit: null, red: "ırk bilinmiyor" }; if (h.yuzey == null) return { kayit: null, red: "zemin bilinmiyor" }; if (!(h.mesafe >= TEMPO_SABITLERI.pencereSonM)) return { kayit: null, red: "mesafe < 600 m" };
  const k = [...h.kontrol].sort((a, b) => a.m - b.m); for (let i = 1; i < k.length; i++) if (!(k[i]!.ms > k[i - 1]!.ms)) return { kayit: null, red: "ara zamanlar monoton değil" };
  const c = (m: number) => k.find((x) => x.m === m);
  const c200 = c(200), c600 = c(600); let v: number | null = null, t200: number | null = null, t600: number | null = null;
  if (c200 && c600) { const dt = (c600.ms - c200.ms) / 1000; const hz = 400 / dt; if (dt > 0 && hz >= TEMPO_SABITLERI.minHizMs && hz <= TEMPO_SABITLERI.maksHizMs) { v = hz; t200 = c200.ms / 1000; t600 = c600.ms / 1000; } }
  let r200: number | null = null, r400: number | null = null, r600: number | null = null, s: number | null = null;
  if (h.siraGecerli && h.sahaN >= TEMPO_SABITLERI.minSahaN) { const a = c(200), b = c(400), d = c(600); if (a && b && d) { r200 = a.place; r400 = b.place; r600 = d.place; const N = h.sahaN; s = 1 - ((r200 - 1) / (N - 1) + (r400 - 1) / (N - 1) + (r600 - 1) / (N - 1)) / 3; } }
  return { red: null, kayit: { yarisId: h.yarisId, atId: h.atId, tarih: h.tarih, hip: h.hip, irk: h.irk, yuzey: h.yuzey, mesafe: h.mesafe, sahaN: h.sahaN, t200, t600, v, r200, r400, r600, s } };
}

const ikili = (a: number[], x: number) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m]! < x) lo = m + 1; else hi = m; } return lo; };
const TOL = 1e-9; const anahtar = (r: TempoKaydi, sev: 1 | 2) => (sev === 1 ? [r.irk, r.yuzey, r.hip, r.mesafe].join("|") : [r.irk, r.yuzey, r.mesafe].join("|"));

export class TempoDeposu {
  private atIdx = new Map<number, TempoKaydi[]>(); private grp = new Map<string, { t: number[]; k: TempoKaydi[] }>();
  constructor(readonly kayitlar: TempoKaydi[]) {
    for (const r of [...kayitlar].sort((a, b) => a.tarih - b.tarih)) { const e = this.atIdx.get(r.atId) ?? []; e.push(r); this.atIdx.set(r.atId, e);
      if (r.v != null) for (const sev of [1, 2] as const) { const key = sev + "#" + anahtar(r, sev); const g = this.grp.get(key) ?? { t: [], k: [] }; g.t.push(r.tarih); g.k.push(r); this.grp.set(key, g); } }
  }
  /** Sızıntı dedektörü: tarih ≥ t kayıtlar bozulur; aynı güne (t) ve geleceğe uç değerli sahte kayıtlar eklenir. */
  gelecegiBoz(t: number, tohum = 1): TempoDeposu {
    let s = tohum; const r = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; const yeni: TempoKaydi[] = [];
    for (const x of this.kayitlar) { if (x.tarih < t) { yeni.push(x); continue; }
      yeni.push({ ...x, v: x.v == null ? null : x.v * (0.7 + r() * 0.6), s: x.s == null ? null : r(), r200: x.r200 == null ? null : 1 + Math.floor(r() * x.sahaN) });
      yeni.push({ ...x, yarisId: x.yarisId + "#sahte", tarih: x.tarih + TEMPO_GUN_MS * Math.floor(r() * 20), v: x.v == null ? null : x.v * 1.5, s: 1 }); }
    for (const [atId, e] of this.atIdx) { const ref = e[0]; if (ref) yeni.push({ ...ref, yarisId: "bozuk-ayni-gun-" + atId, tarih: t, v: ref.v == null ? null : ref.v * 1.4, s: 0 }); }
    return new TempoDeposu(yeni);
  }
  gorunum(t: number): TempoGorunum { return new TempoGorunum(this, t); }
  _at(id: number) { return this.atIdx.get(id); } _grp(k: string) { return this.grp.get(k); }
}

export type ErkenRef = { pct: number; z: number; mu: number; sd: number; n: number; seviye: 1 | 2; anahtar: string; refEnYeni: number };
export class TempoGorunum {
  private cache = new Map<string, TempoKaydi[]>();
  constructor(private readonly d: TempoDeposu, readonly t: number) {}
  /** Atın t'den KESİNLİKLE önceki kayıtları (eskiden yeniye). */
  atKayitlari(atId: number): TempoKaydi[] { const e = this.d._at(atId); if (!e) return []; return e.slice(0, ikili(e.map((x) => x.tarih), this.t)); }
  private uyeler(key: string): TempoKaydi[] { let u = this.cache.get(key); if (!u) { const g = this.d._grp(key); u = g ? g.k.slice(0, ikili(g.t, this.t)) : []; this.cache.set(key, u); } return u; }
  erken(r: TempoKaydi): ErkenRef | null {
    if (r.v == null) return null;
    for (const sev of [1, 2] as const) { const key = sev + "#" + anahtar(r, sev); const u = this.uyeler(key); if (u.length < TEMPO_SABITLERI.minGrupN) continue;
      const n = u.length; const mu = u.reduce((s, x) => s + x.v!, 0) / n; const sd = Math.sqrt(u.reduce((s, x) => s + (x.v! - mu) ** 2, 0) / (n - 1)); if (!(sd > 1e-6)) continue;
      const alt = u.filter((x) => x.v! < r.v! - TOL).length, es = u.filter((x) => Math.abs(x.v! - r.v!) <= TOL).length;
      return { pct: (100 * (alt + 0.5 * es)) / n, z: (r.v - mu) / sd, mu, sd, n, seviye: sev, anahtar: key, refEnYeni: Math.max(...u.map((x) => x.tarih)) }; }
    return null;
  }
}

export type TempoYaris = { kayit: TempoKaydi; erken: ErkenRef | null; kullanimErken: "SON3" | "ESKI" | "-"; kullanimStil: "SON3" | "ESKI" | "-" };
export type TempoBilesenleri = {
  erkenHiz: number | null; // 0–100: son 3 uygun yarışın ERKEN_HIZ yüzdeliklerinin ortalaması
  erkenHizMs: number | null; // son 3 yarışın ham V ortalaması (m/s)
  stil: number | null; // son 3 yarışın S ortalaması (1 = ön, 0 = geride)
  stilSd: number | null; // son 3 yarışın S standart sapması (istikrar: düşük = istikrarlı); <2 yarışta null
  stilTum: number | null; stilTumSd: number | null; // t'den önceki TÜM uygun yarışlar (ayrı gösterilir; puana girmez)
  yarislar: TempoYaris[];
  guven: { uygunErken: number; uygunStil: number; kullanilanErken: number; kullanilanStil: number; sonYarisGun: number | null; enGevsekSeviye: number | null };
};
const ort = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const sd = (v: number[]) => { if (v.length < 2) return null; const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1)); };

/** Bir atın yarış-öncesi TEMPO bileşenleri (ERKEN_HIZ, KOSU_STILI). YALNIZ as-of görünümü kullanır. */
export function tempoBilesenleri(g: TempoGorunum, atId: number): TempoBilesenleri {
  const liste = g.atKayitlari(atId); const yaris: TempoYaris[] = liste.map((k) => ({ kayit: k, erken: g.erken(k), kullanimErken: "-" as const, kullanimStil: "-" as const }));
  const sec = (f: (y: TempoYaris) => boolean, alan: "kullanimErken" | "kullanimStil") => { const u = yaris.filter(f); u.slice(-TEMPO_SABITLERI.sonNYaris).forEach((y) => (y[alan] = "SON3")); u.slice(0, Math.max(0, u.length - TEMPO_SABITLERI.sonNYaris)).forEach((y) => (y[alan] = "ESKI")); return u; };
  const uE = sec((y) => y.erken != null, "kullanimErken"), uS = sec((y) => y.kayit.s != null, "kullanimStil"); const sonE = uE.slice(-TEMPO_SABITLERI.sonNYaris), sonS = uS.slice(-TEMPO_SABITLERI.sonNYaris);
  const sevs = sonE.map((y) => y.erken!.seviye); const son = liste.length ? liste[liste.length - 1]!.tarih : null;
  return {
    erkenHiz: ort(sonE.map((y) => y.erken!.pct)), erkenHizMs: ort(sonE.map((y) => y.kayit.v!)), stil: ort(sonS.map((y) => y.kayit.s!)), stilSd: sd(sonS.map((y) => y.kayit.s!)),
    stilTum: ort(uS.map((y) => y.kayit.s!)), stilTumSd: sd(uS.map((y) => y.kayit.s!)), yarislar: yaris,
    guven: { uygunErken: uE.length, uygunStil: uS.length, kullanilanErken: sonE.length, kullanilanStil: sonS.length, sonYarisGun: son == null ? null : Math.round((g.t - son) / TEMPO_GUN_MS), enGevsekSeviye: sevs.length ? Math.max(...sevs) : null },
  };
}
