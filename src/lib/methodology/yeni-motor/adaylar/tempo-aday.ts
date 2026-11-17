// YENİ MOTOR — ADAY HESAP: TEMPO (kullanıcı tanımı, 2026-11-17/18): ERKEN_HIZ, KOSU_STILI, LIDERLIK_BASKISI. AKTİF SİNYAL DEĞİLDİR: SINYAL_KAYDI'na EKLENMEDİ.
// Eski Runner.raceStyle / accurace v2 KULLANILMAZ. SAF: veritabanı / ağ / saat / rastgelelik YOK. Yalnız hedef yarış gününden KESİNLİKLE önceki (tarih < t) kayıtlar; hedef yarışın kendi ara zamanları/sıraları kullanılmaz.
// Katsayı ÖĞRENİLMEZ. Eksik veri 0 puan sayılmaz (null).
//   ERKEN_HIZ:  V = 400 / (T600 − T200) [m/s]; ilk 100 m (çıkış) ve 100–200 m dışarıda; V, aynı ırk+yüzey+hipodrom+mesafe referansında (seviye 2: hipodromsuz) yüzdelik puana çevrilir.
//   KOSU_STILI: S = 1 − (1/3)·Σ_{d∈{200,400,600}} (R_d − 1)/(N − 1)  (N = TJK'daki GERÇEK koşan at sayısı; 800 m dahil DEĞİL). 1'e yakın = ön. Sınıflandırma YOK; istikrar = son 3 yarışta S standart sapması.
//   LIDERLIK_BASKISI (v2, 2026-11-18; ESKİ σ-formülü İPTAL — erken hızın ters kopyasıydı, r=−0,96): P_öncü = (1+k)/(2+n) (k: son n uygun yarışın kaçında 400 m VE 600 m'de KALICI ön gruptaydı; ön grup = sıra ≤ max(2, ⌈0.20·N⌉));
//     B_h = P_h · Σ_{j≠h} P_j · exp(−|V_h − V_j| / τ); V = ERKEN_HIZ yüzdeliği; τ = geçmiş benzer yarışlarda atlar arası erken hız (yüzdelik) farklarının medyanı.
export const TEMPO_GUN_MS = 86400000;
/** BİLDİRİLEN SABİTLER (öğrenilmedi; kullanıcı kararı veya onayına tabi varsayım). */
export const TEMPO_SABITLERI = { minGrupN: 30, sonNYaris: 3, minSahaN: 4, minHizMs: 10, maksHizMs: 20, pencereBasM: 200, pencereSonM: 600, onGrupMinSira: 2, onGrupOran: 0.2, minTauYaris: 10, tauMinAtYarista: 4 } as const;
export type TempoYuzey = "KUM" | "CIM" | "SENTETIK";
/** sahaN = TJK'daki GERÇEK koşan at sayısı. siraGecerli: o yarışın Accurace kayıtlarında 200/400/600'de sıralar 1..(kayıtlı at sayısı) geçerli permütasyon mu (çağıran hesaplar). */
export type TempoHam = { yarisId: string; atId: number | null; tarih: number; hip: string; irk: string | null; yuzey: TempoYuzey | null; mesafe: number; sahaN: number; siraGecerli: boolean; kontrol: { m: number; ms: number; place: number }[] };
export type TempoKaydi = { yarisId: string; atId: number; tarih: number; hip: string; irk: string; yuzey: TempoYuzey; mesafe: number; sahaN: number; t200: number | null; t600: number | null; v: number | null; r200: number | null; r400: number | null; r600: number | null; s: number | null; onGrupKalici: boolean | null };

/** Ham kaydı normalleştirir; hesaplanamayan alan null kalır (uydurma yok). */
export function tempoNormalize(h: TempoHam): { kayit: TempoKaydi | null; red: string | null } {
  if (h.atId == null) return { kayit: null, red: "ata bağlı değil" }; if (h.irk == null) return { kayit: null, red: "ırk bilinmiyor" }; if (h.yuzey == null) return { kayit: null, red: "zemin bilinmiyor" }; if (!(h.mesafe >= TEMPO_SABITLERI.pencereSonM)) return { kayit: null, red: "mesafe < 600 m" };
  const k = [...h.kontrol].sort((a, b) => a.m - b.m); for (let i = 1; i < k.length; i++) if (!(k[i]!.ms > k[i - 1]!.ms)) return { kayit: null, red: "ara zamanlar monoton değil" };
  const c = (m: number) => k.find((x) => x.m === m);
  const c200 = c(200), c600 = c(600); let v: number | null = null, t200: number | null = null, t600: number | null = null;
  if (c200 && c600) { const dt = (c600.ms - c200.ms) / 1000; const hz = 400 / dt; if (dt > 0 && hz >= TEMPO_SABITLERI.minHizMs && hz <= TEMPO_SABITLERI.maksHizMs) { v = hz; t200 = c200.ms / 1000; t600 = c600.ms / 1000; } }
  let r200: number | null = null, r400: number | null = null, r600: number | null = null, s: number | null = null, onGrupKalici: boolean | null = null;
  if (h.siraGecerli && h.sahaN >= TEMPO_SABITLERI.minSahaN) { const a = c(200), b = c(400), d = c(600);
    if (a && b && d && a.place <= h.sahaN && b.place <= h.sahaN && d.place <= h.sahaN) { r200 = a.place; r400 = b.place; r600 = d.place; const N = h.sahaN; s = 1 - ((r200 - 1) / (N - 1) + (r400 - 1) / (N - 1) + (r600 - 1) / (N - 1)) / 3;
      const lim = Math.max(TEMPO_SABITLERI.onGrupMinSira, Math.ceil(TEMPO_SABITLERI.onGrupOran * N)); onGrupKalici = r400 <= lim && r600 <= lim; /* kalıcı ön grup: 400 m VE 600 m */ } }
  return { red: null, kayit: { yarisId: h.yarisId, atId: h.atId, tarih: h.tarih, hip: h.hip, irk: h.irk, yuzey: h.yuzey, mesafe: h.mesafe, sahaN: h.sahaN, t200, t600, v, r200, r400, r600, s, onGrupKalici } };
}

const ikili = (a: number[], x: number) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m]! < x) lo = m + 1; else hi = m; } return lo; };
const TOL = 1e-9; const anahtar = (r: { irk: string; yuzey: string; hip: string; mesafe: number }, sev: 1 | 2) => (sev === 1 ? [r.irk, r.yuzey, r.hip, r.mesafe].join("|") : [r.irk, r.yuzey, r.mesafe].join("|"));

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
      yeni.push({ ...x, v: x.v == null ? null : x.v * (0.7 + r() * 0.6), s: x.s == null ? null : r(), r200: x.r200 == null ? null : 1 + Math.floor(r() * x.sahaN), onGrupKalici: x.onGrupKalici == null ? null : r() < 0.5 });
      yeni.push({ ...x, yarisId: x.yarisId + "#sahte", tarih: x.tarih + TEMPO_GUN_MS * Math.floor(r() * 20), v: x.v == null ? null : x.v * 1.5, s: 1, onGrupKalici: true }); }
    for (const [atId, e] of this.atIdx) { const ref = e[0]; if (ref) yeni.push({ ...ref, yarisId: "bozuk-ayni-gun-" + atId, tarih: t, v: ref.v == null ? null : ref.v * 1.4, s: 0, onGrupKalici: true }); }
    return new TempoDeposu(yeni);
  }
  gorunum(t: number): TempoGorunum { return new TempoGorunum(this, t); }
  _at(id: number) { return this.atIdx.get(id); } _grp(k: string) { return this.grp.get(k); }
}

export type ErkenRef = { pct: number; z: number; mu: number; sd: number; n: number; seviye: 1 | 2; anahtar: string; refEnYeni: number };
export type TauSonuc = { tau: number; seviye: 1 | 2; anahtar: string; nYaris: number; nCift: number; refEnYeni: number };
export class TempoGorunum {
  private cache = new Map<string, TempoKaydi[]>(); private tauCache = new Map<string, TauSonuc | null>();
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
  /** τ: hedef yarışın benzer geçmiş yarışlarında (aynı ırk+yüzey+hipodrom+mesafe; yoksa hipodromsuz; ≥ minTauYaris yarış) atlar arası ERKEN_HIZ yüzdelik farklarının (|ΔV|, tüm çiftler) MEDYANI. Yalnız t'den önceki yarışlar. */
  tau(hedef: { irk: string; yuzey: string; hip: string; mesafe: number }): TauSonuc | null {
    const ck = [hedef.irk, hedef.yuzey, hedef.hip, hedef.mesafe].join("|"); if (this.tauCache.has(ck)) return this.tauCache.get(ck)!; let sonuc: TauSonuc | null = null;
    for (const sev of [1, 2] as const) {
      const key = sev + "#" + anahtar(hedef, sev); const u = this.uyeler(key); if (u.length < TEMPO_SABITLERI.minGrupN) continue;
      const vs = u.map((x) => x.v!).sort((a, b) => a - b); const n = vs.length; const lowerIdx = (x: number) => ikili(vs, x), pct = (v: number) => (100 * (lowerIdx(v - TOL) + 0.5 * (lowerIdx(v + TOL) - lowerIdx(v - TOL)))) / n;
      const yarislar = new Map<string, number[]>(); for (const x of u) { const a = yarislar.get(x.yarisId) ?? []; a.push(pct(x.v!)); yarislar.set(x.yarisId, a); }
      const uygun = [...yarislar.values()].filter((a) => a.length >= TEMPO_SABITLERI.tauMinAtYarista); if (uygun.length < TEMPO_SABITLERI.minTauYaris) continue;
      const farklar: number[] = []; for (const a of uygun) for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) farklar.push(Math.abs(a[i]! - a[j]!));
      farklar.sort((a, b) => a - b); const m = farklar.length; const med = m % 2 ? farklar[(m - 1) / 2]! : (farklar[m / 2 - 1]! + farklar[m / 2]!) / 2; if (!(med > 1e-9)) continue;
      sonuc = { tau: med, seviye: sev, anahtar: key, nYaris: uygun.length, nCift: m, refEnYeni: Math.max(...u.map((x) => x.tarih)) }; break;
    }
    this.tauCache.set(ck, sonuc); return sonuc;
  }
}

export type TempoYaris = { kayit: TempoKaydi; erken: ErkenRef | null; kullanimErken: "SON3" | "ESKI" | "-"; kullanimStil: "SON3" | "ESKI" | "-" };
export type POncu = { p: number; k: number; n: number; veriYok: boolean };
export type TempoBilesenleri = {
  erkenHiz: number | null; // 0–100: son 3 uygun yarışın ERKEN_HIZ yüzdeliklerinin ortalaması
  erkenHizMs: number | null; stil: number | null; stilSd: number | null; stilTum: number | null; stilTumSd: number | null;
  pOncu: POncu; // (1+k)/(2+n); n=0 ise önsel 0.5 (veriYok=true)
  yarislar: TempoYaris[];
  guven: { uygunErken: number; uygunStil: number; kullanilanErken: number; kullanilanStil: number; sonYarisGun: number | null; enGevsekSeviye: number | null };
};
const ort = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const sd = (v: number[]) => { if (v.length < 2) return null; const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1)); };

/** Bir atın yarış-öncesi TEMPO bileşenleri (ERKEN_HIZ, KOSU_STILI, P_öncü). YALNIZ as-of görünümü kullanır. */
export function tempoBilesenleri(g: TempoGorunum, atId: number): TempoBilesenleri {
  const liste = g.atKayitlari(atId); const yaris: TempoYaris[] = liste.map((k) => ({ kayit: k, erken: g.erken(k), kullanimErken: "-" as const, kullanimStil: "-" as const }));
  const sec = (f: (y: TempoYaris) => boolean, alan: "kullanimErken" | "kullanimStil") => { const u = yaris.filter(f); u.slice(-TEMPO_SABITLERI.sonNYaris).forEach((y) => (y[alan] = "SON3")); u.slice(0, Math.max(0, u.length - TEMPO_SABITLERI.sonNYaris)).forEach((y) => (y[alan] = "ESKI")); return u; };
  const uE = sec((y) => y.erken != null, "kullanimErken"), uS = sec((y) => y.kayit.s != null, "kullanimStil"); const sonE = uE.slice(-TEMPO_SABITLERI.sonNYaris), sonS = uS.slice(-TEMPO_SABITLERI.sonNYaris);
  const sevs = sonE.map((y) => y.erken!.seviye); const son = liste.length ? liste[liste.length - 1]!.tarih : null;
  const pL = yaris.filter((y) => y.kayit.onGrupKalici != null).slice(-TEMPO_SABITLERI.sonNYaris); const k = pL.filter((y) => y.kayit.onGrupKalici).length, n = pL.length;
  return {
    erkenHiz: ort(sonE.map((y) => y.erken!.pct)), erkenHizMs: ort(sonE.map((y) => y.kayit.v!)), stil: ort(sonS.map((y) => y.kayit.s!)), stilSd: sd(sonS.map((y) => y.kayit.s!)),
    stilTum: ort(uS.map((y) => y.kayit.s!)), stilTumSd: sd(uS.map((y) => y.kayit.s!)), pOncu: { p: (1 + k) / (2 + n), k, n, veriYok: n === 0 }, yarislar: yaris,
    guven: { uygunErken: uE.length, uygunStil: uS.length, kullanilanErken: sonE.length, kullanilanStil: sonS.length, sonYarisGun: son == null ? null : Math.round((g.t - son) / TEMPO_GUN_MS), enGevsekSeviye: sevs.length ? Math.max(...sevs) : null },
  };
}

export type BaskiSatiri = { baski: number | null; bilinenRakip: number; toplamRakip: number };
/** LIDERLIK_BASKISI v2: B_h = P_h · Σ_{j≠h} P_j · exp(−|V_h − V_j|/τ). V bilinmeyen rakip toplama GİRMEZ (sıfır sayılmaz; bilinenRakip/toplamRakip ile işaretlenir); V_h bilinmiyorsa B_h null. */
export function liderlikBaskisi(atlar: { v: number | null; p: number }[], tau: number): BaskiSatiri[] {
  return atlar.map((h, i) => { if (h.v == null) return { baski: null, bilinenRakip: 0, toplamRakip: atlar.length - 1 }; let toplam = 0, bil = 0; atlar.forEach((j, q) => { if (q === i || j.v == null) return; toplam += j.p * Math.exp(-Math.abs(h.v! - j.v) / tau); bil++; }); return { baski: h.p * toplam, bilinenRakip: bil, toplamRakip: atlar.length - 1 }; });
}
