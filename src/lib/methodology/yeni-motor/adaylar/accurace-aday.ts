// YENİ MOTOR — ADAY HESAP: ACCURACE (kullanıcı tanımı, 2026-11-17: ACC_HIZ + ACC_BITIRIS). AKTİF SİNYAL DEĞİLDİR: SINYAL_KAYDI'na EKLENMEDİ.
// Koşu stili / liderlik baskısı BURADA YOK (TEMPO modülünün işi). Eski accurace/v2 motoruna veya katsayılarına BAKILMAZ.
// SAF: veritabanı / ağ / saat / rastgelelik YOK. Tüm referanslar YALNIZ hedef yarış gününden KESİNLİKLE önceki (tarih < t) kayıtlardan hesaplanır; hedef günün kayıtları (hedef yarışın kendisi dahil) dışarıda kalır.
// Katsayı ÖĞRENİLMEZ; ağırlık (w_H) YOKTUR; iki bileşen AYRI tutulur. Eksik veri 0 puan sayılmaz: hesaplanamayan bileşen null'dır.
export const ACC_GUN_MS = 86400000;
/** BİLDİRİLEN SABİTLER (öğrenilmedi; kullanıcı onayına tabi teknik varsayımlar). */
export const ACC_SABITLERI = { minGrupN: 30, sonNYaris: 3, sonBolumM: 800, minMesafeBitirisM: 1000, minHizMs: 10, maksHizMs: 18 } as const;

export type AccYuzey = "KUM" | "CIM" | "SENTETIK";
export type AccHam = { yarisId: string; atId: number | null; tarih: number; hip: string; irk: string | null; yuzey: AccYuzey | null; mesafe: number; sureMs: number; kontrol: { m: number; ms: number }[] };
export type AccKaydi = {
  yarisId: string; atId: number; tarih: number; hip: string; irk: string; yuzey: AccYuzey; mesafe: number;
  sure: number; // bitiş süresi (sn)
  erken: number | null; // (mesafe−800). metredeki kümülatif süre (sn)
  erkenTahmin: boolean; // true = o noktada ölçüm yok, komşu kontrol noktalarından doğrusal tahmin
  son800: number | null; // sure − erken
};

/** Ham kaydı normalleştirir; kullanılamayanı NEDENİYLE reddeder (uydurma yok). */
export function accNormalize(h: AccHam): { kayit: AccKaydi | null; red: string | null } {
  if (h.atId == null) return { kayit: null, red: "ata bağlı değil" }; if (h.irk == null) return { kayit: null, red: "ırk bilinmiyor" }; if (h.yuzey == null) return { kayit: null, red: "zemin bilinmiyor" };
  if (!(h.sureMs > 0) || !(h.mesafe > 0)) return { kayit: null, red: "süre/mesafe yok" };
  const sure = h.sureMs / 1000; const hiz = h.mesafe / sure; if (hiz < ACC_SABITLERI.minHizMs || hiz > ACC_SABITLERI.maksHizMs) return { kayit: null, red: "hız makul değil" };
  const k = [...h.kontrol].filter((x) => x.ms > 0 && x.m > 0 && x.m <= h.mesafe).sort((a, b) => a.m - b.m);
  for (let i = 1; i < k.length; i++) if (!(k[i]!.ms > k[i - 1]!.ms)) return { kayit: null, red: "kontrol noktaları monoton değil" };
  let erken: number | null = null, tahmin = false, son800: number | null = null;
  if (h.mesafe >= ACC_SABITLERI.minMesafeBitirisM) {
    const hedefM = h.mesafe - ACC_SABITLERI.sonBolumM; const tam = k.find((x) => x.m === hedefM);
    if (tam) erken = tam.ms / 1000;
    else { const alt = [...k].reverse().find((x) => x.m < hedefM), ust = k.find((x) => x.m > hedefM && x.m <= h.mesafe); if (alt && ust) { erken = (alt.ms + ((ust.ms - alt.ms) * (hedefM - alt.m)) / (ust.m - alt.m)) / 1000; tahmin = true; } }
    if (erken != null) { son800 = sure - erken; if (!(son800 > 0) || ACC_SABITLERI.sonBolumM / son800 < ACC_SABITLERI.minHizMs || ACC_SABITLERI.sonBolumM / son800 > ACC_SABITLERI.maksHizMs) { erken = null; son800 = null; tahmin = false; } }
  }
  return { red: null, kayit: { yarisId: h.yarisId, atId: h.atId, tarih: h.tarih, hip: h.hip, irk: h.irk, yuzey: h.yuzey, mesafe: h.mesafe, sure, erken, erkenTahmin: tahmin, son800 } };
}

const ikili = (a: number[], x: number) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m]! < x) lo = m + 1; else hi = m; } return lo; };
const TOL = 1e-9;
const anahtar = (r: AccKaydi, sev: 1 | 2) => (sev === 1 ? [r.irk, r.yuzey, r.hip, r.mesafe].join("|") : [r.irk, r.yuzey, r.mesafe].join("|"));

export class AccDeposu {
  private atIdx = new Map<number, AccKaydi[]>(); private grp = new Map<string, { t: number[]; k: AccKaydi[] }>(); private yarisMin = new Map<string, number>();
  constructor(readonly kayitlar: AccKaydi[]) {
    const sirali = [...kayitlar].sort((a, b) => a.tarih - b.tarih);
    for (const r of sirali) {
      const e = this.atIdx.get(r.atId) ?? []; e.push(r); this.atIdx.set(r.atId, e);
      for (const sev of [1, 2] as const) { const key = sev + "#" + anahtar(r, sev); const g = this.grp.get(key) ?? { t: [], k: [] }; g.t.push(r.tarih); g.k.push(r); this.grp.set(key, g); }
      if (r.son800 != null) { const m = this.yarisMin.get(r.yarisId); if (m == null || r.son800 < m) this.yarisMin.set(r.yarisId, r.son800); }
    }
  }
  /** Sızıntı dedektörü: tarih ≥ t olan kayıtların süre/ara zamanı bozulur; AYNI GÜNE (t) ve geleceğe uç değerli sahte kayıtlar eklenir. */
  gelecegiBoz(t: number, tohum = 1): AccDeposu {
    let s = tohum; const r = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; const yeni: AccKaydi[] = [];
    for (const x of this.kayitlar) {
      if (x.tarih < t) { yeni.push(x); continue; }
      yeni.push({ ...x, sure: x.sure * (0.8 + r() * 0.4), erken: x.erken == null ? null : x.erken * (0.8 + r() * 0.4), son800: x.son800 == null ? null : x.son800 * (0.8 + r() * 0.4) });
      yeni.push({ ...x, yarisId: x.yarisId + "#sahte", tarih: x.tarih + ACC_GUN_MS * Math.floor(r() * 20), sure: x.sure * 0.7, erken: x.erken == null ? null : x.erken * 0.7, son800: x.son800 == null ? null : x.son800 * 0.5 });
    }
    for (const [atId] of this.atIdx) { const ref = (this.atIdx.get(atId) ?? [])[0]; if (ref) yeni.push({ ...ref, yarisId: "bozuk-ayni-gun-" + atId, tarih: t, sure: ref.sure * 0.6, erken: ref.erken == null ? null : ref.erken * 0.6, son800: ref.son800 == null ? null : ref.son800 * 0.5 }); }
    return new AccDeposu(yeni);
  }
  gorunum(t: number): AccGorunum { return new AccGorunum(this, t); }
  _at(id: number) { return this.atIdx.get(id); } _grp(k: string) { return this.grp.get(k); } _yarisMin(id: string) { return this.yarisMin.get(id); }
}

export type HizRef = { pct: number; z: number; mu: number; sd: number; n: number; seviye: 1 | 2; anahtar: string; refEnYeni: number };
export type BitRef = { pct: number; a: number; b: number; sdRes: number; beklenen: number; artik: number; n: number; seviye: 1 | 2; anahtar: string; refEnYeni: number };

export class AccGorunum {
  private cache = new Map<string, AccKaydi[]>();
  constructor(private readonly d: AccDeposu, readonly t: number) {}
  /** Atın t'den KESİNLİKLE önceki kayıtları (eskiden yeniye). */
  atKayitlari(atId: number): AccKaydi[] { const e = this.d._at(atId); if (!e) return []; return e.slice(0, ikili(e.map((x) => x.tarih), this.t)); }
  private uyeler(key: string): AccKaydi[] { let u = this.cache.get(key); if (!u) { const g = this.d._grp(key); u = g ? g.k.slice(0, ikili(g.t, this.t)) : []; this.cache.set(key, u); } return u; }
  /** Yarışın en hızlı son 800'ü (yalnız t'den önceki kayıtlar; yarış t'den önceyse tamamı bellidir). */
  yarisIciEnHizliSon800(yarisId: string, tarih: number): number | null { return tarih < this.t ? this.d._yarisMin(yarisId) ?? null : null; }
  hiz(r: AccKaydi): HizRef | null {
    for (const sev of [1, 2] as const) {
      const key = sev + "#" + anahtar(r, sev); const u = this.uyeler(key); if (u.length < ACC_SABITLERI.minGrupN) continue;
      const n = u.length; const mu = u.reduce((s, x) => s + x.sure, 0) / n; const sd = Math.sqrt(u.reduce((s, x) => s + (x.sure - mu) ** 2, 0) / (n - 1)); if (!(sd > 1e-6)) continue;
      const yavas = u.filter((x) => x.sure > r.sure + TOL).length, esit = u.filter((x) => Math.abs(x.sure - r.sure) <= TOL).length;
      return { pct: (100 * (yavas + 0.5 * esit)) / n, z: (mu - r.sure) / sd, mu, sd, n, seviye: sev, anahtar: key, refEnYeni: Math.max(...u.map((x) => x.tarih)) };
    }
    return null;
  }
  bitis(r: AccKaydi): BitRef | null {
    if (r.erken == null || r.son800 == null) return null;
    for (const sev of [1, 2] as const) {
      const key = sev + "#" + anahtar(r, sev); const u = this.uyeler(key).filter((x) => x.erken != null && x.son800 != null && !x.erkenTahmin); if (u.length < ACC_SABITLERI.minGrupN) continue;
      const n = u.length; const mx = u.reduce((s, x) => s + x.erken!, 0) / n, my = u.reduce((s, x) => s + x.son800!, 0) / n; const sxx = u.reduce((s, x) => s + (x.erken! - mx) ** 2, 0), sxy = u.reduce((s, x) => s + (x.erken! - mx) * (x.son800! - my), 0); if (!(sxx > 1e-9)) continue;
      const b = sxy / sxx, a = my - b * mx; const res = u.map((x) => x.son800! - (a + b * x.erken!)); const sd = Math.sqrt(res.reduce((s, q) => s + q * q, 0) / (n - 2)); if (!(sd > 1e-6)) continue;
      const bek = a + b * r.erken, artik = r.son800 - bek; const kotu = res.filter((q) => q > artik + TOL).length, esit = res.filter((q) => Math.abs(q - artik) <= TOL).length;
      return { pct: (100 * (kotu + 0.5 * esit)) / n, a, b, sdRes: sd, beklenen: bek, artik, n, seviye: sev, anahtar: key, refEnYeni: Math.max(...u.map((x) => x.tarih)) };
    }
    return null;
  }
}

export type AccYaris = { kayit: AccKaydi; hiz: HizRef | null; bitis: BitRef | null; yarisIciSon800Fark: number | null; kullanimHiz: "SON3" | "ESKI" | "-"; kullanimBitis: "SON3" | "ESKI" | "-"; disla: string | null };
export type AccBilesenleri = {
  accHiz: number | null; accBitiris: number | null; // 0–100 yüzdelik puan (son 3 uygun yarışın ortalaması)
  yarislar: AccYaris[]; // t'den önceki TÜM kayıtlar, eskiden yeniye (dışlananlar nedeniyle)
  guven: { uygunHiz: number; uygunBitis: number; kullanilanHiz: number; kullanilanBitis: number; tahminAraZaman: number; sonYarisGun: number | null; ilkKullanilanGun: number | null; enGevsekSeviye: number | null; tumUygunHizOrt: number | null; tumUygunBitisOrt: number | null };
};

/** Bir atın yarış-öncesi ACCURACE bileşenleri. YALNIZ as-of görünümü kullanır. `yuzey`: hedef yarışın zemini (kum/çim/sentetik birbirine karıştırılmaz). */
export function accBilesenleri(g: AccGorunum, atId: number, yuzey: AccYuzey): AccBilesenleri {
  const liste = g.atKayitlari(atId); const yaris: AccYaris[] = liste.map((k) => {
    const uyumsuz = k.yuzey !== yuzey; const h = uyumsuz ? null : g.hiz(k); const b = uyumsuz ? null : g.bitis(k); const en = g.yarisIciEnHizliSon800(k.yarisId, k.tarih);
    return { kayit: k, hiz: h, bitis: b, yarisIciSon800Fark: k.son800 != null && en != null ? k.son800 - en : null, kullanimHiz: "-" as const, kullanimBitis: "-" as const, disla: uyumsuz ? `zemin farklı (${k.yuzey} ≠ ${yuzey}) — karıştırılmadı` : null };
  });
  const sec = (f: (y: AccYaris) => boolean, alan: "kullanimHiz" | "kullanimBitis") => { const u = yaris.filter(f); u.slice(-ACC_SABITLERI.sonNYaris).forEach((y) => (y[alan] = "SON3")); u.slice(0, Math.max(0, u.length - ACC_SABITLERI.sonNYaris)).forEach((y) => (y[alan] = "ESKI")); return u; };
  const uH = sec((y) => y.hiz != null, "kullanimHiz"), uB = sec((y) => y.bitis != null, "kullanimBitis");
  const ort = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
  const sonH = uH.slice(-ACC_SABITLERI.sonNYaris), sonB = uB.slice(-ACC_SABITLERI.sonNYaris); const kul = [...sonH, ...sonB]; const sevs = kul.flatMap((y) => [y.hiz?.seviye, y.bitis?.seviye]).filter((s): s is 1 | 2 => s != null);
  const son = liste.length ? liste[liste.length - 1]!.tarih : null; const ilkKul = kul.length ? Math.min(...kul.map((y) => y.kayit.tarih)) : null;
  return {
    accHiz: ort(sonH.map((y) => y.hiz!.pct)), accBitiris: ort(sonB.map((y) => y.bitis!.pct)), yarislar: yaris,
    guven: { uygunHiz: uH.length, uygunBitis: uB.length, kullanilanHiz: sonH.length, kullanilanBitis: sonB.length, tahminAraZaman: sonB.filter((y) => y.kayit.erkenTahmin).length, sonYarisGun: son == null ? null : Math.round((g.t - son) / ACC_GUN_MS), ilkKullanilanGun: ilkKul == null ? null : Math.round((g.t - ilkKul) / ACC_GUN_MS), enGevsekSeviye: sevs.length ? Math.max(...sevs) : null, tumUygunHizOrt: ort(uH.map((y) => y.hiz!.pct)), tumUygunBitisOrt: ort(uB.map((y) => y.bitis!.pct)) },
  };
}
