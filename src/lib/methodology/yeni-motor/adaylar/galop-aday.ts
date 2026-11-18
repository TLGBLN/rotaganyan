// YENİ MOTOR — ADAY HESAP: GALOP (kullanıcı tanımı, 2026-11-17: GALOP_KAPASITE + GALOP_HAZIRLIK).
// BU DOSYA AKTİF SİNYAL DEĞİLDİR: SINYAL_KAYDI'na EKLENMEDİ; yalnız bileşenleri ölçer. Modele ekleme kullanıcı onayına bağlıdır.
// SAF: veritabanı / ağ / saat / rastgelelik YOK. Tüm referanslar (grup ortalaması, kapanış regresyonu, efor dağılımı) YALNIZ hedef yarış gününden
// KESİNLİKLE önceki (tarih < t) galoplardan hesaplanır. Katsayı ÖĞRENİLMEZ; eşikler aşağıda sabit ve bildirilmiştir.
// Eksik veri 0 puan sayılmaz: hesaplanamayan bileşen null'dır.
export const GUN_MS = 86400000;
/** BİLDİRİLEN SABİTLER (öğrenilmedi; kullanıcı onayına tabi teknik varsayımlar). */
export const GALOP_SABITLERI = { minGrupN: 30, minEforN: 100, sonNGalop: 3, siklikPenceresiGun: 28, oncekiKosuYoksaGun: 60, minHizMs: 10, maksHizMs: 18 } as const;

export type GalopHam = { atId: number; tarih: number; track: string | null; form: string | null; jokey: string | null; splits: Record<string, string | null> | null; irk: string | null; yasGrubu: string | null };
export type GalopTur = "GALOP" | "SPRINT" | "KENTER" | "BILINMIYOR";
export type GalopKaydi = {
  atId: number; tarih: number; tur: GalopTur; pist: "KUM" | "CIM" | "SENTETIK" | null; icDis: "IC" | "DIS" | null;
  efor: number | null; // 5=Çok rahat(ÇR) 4=Rahat(R) 3=Hafif rahat(HR) 2=Hafif çalışarak(HÇ) 1=Çalışarak(Ç)
  mesafe: number; sure: number; son400: number | null; irk: string | null; yasGrubu: string | null; jokey: string | null;
};

const ANAHTARLAR = ["200", "400", "600", "800", "1000", "1200", "1400"] as const;
/** TJK süre biçimi "d.ss.yy" ("0.52.70" → 52.70 sn). */
export function sureSn(s: string | null | undefined): number | null {
  if (!s) return null; const m = s.match(/^(\d+)\.(\d{2})\.(\d{1,2})$/); if (!m) return null;
  const yuz = m[3]!.length === 1 ? parseInt(m[3]!, 10) * 10 : parseInt(m[3]!, 10); return parseInt(m[1]!, 10) * 60 + parseInt(m[2]!, 10) + yuz / 100;
}
const EFOR: Record<string, number> = { "ÇR": 5, "R": 4, "HR": 3, "HÇ": 2, "Ç": 1, "Çok Rahat": 5, "Rahat": 4, "Hafif Çalışarak": 2, "Çalışarak": 1 };
const TUR: Record<string, GalopTur> = { Galop: "GALOP", Sprint: "SPRINT", Kenter: "KENTER" };
const PIST: Record<string, "KUM" | "CIM" | "SENTETIK"> = { Kum: "KUM", "Çim": "CIM", Sentetik: "SENTETIK" };

/** Ham kaydı normalleştirir; kullanılamayanı NEDENİYLE reddeder (uydurma yok). */
export function galopNormalize(h: GalopHam): { kayit: GalopKaydi | null; red: string | null } {
  if (!h.splits) return { kayit: null, red: "splits-yok" };
  const v = ANAHTARLAR.map((k) => ({ m: parseInt(k, 10), s: sureSn(h.splits![k]) })).filter((x): x is { m: number; s: number } => x.s != null);
  if (v.length === 0) return { kayit: null, red: "sure-yok" };
  const son = v[v.length - 1]!; if (son.m < 400) return { kayit: null, red: "mesafe<400" };
  for (let i = 1; i < v.length; i++) if (!(v[i]!.s > v[i - 1]!.s)) return { kayit: null, red: "sure-monoton-degil" };
  const hiz = son.m / son.s; if (hiz < GALOP_SABITLERI.minHizMs || hiz > GALOP_SABITLERI.maksHizMs) return { kayit: null, red: "hiz-makul-degil" };
  const s400 = v.find((x) => x.m === 400)?.s ?? null;
  const ic = (h.splits["ic_dis"] ?? "").toString().toLocaleLowerCase("tr").replace("iç", "ic").replace("dış", "dis");
  return {
    red: null,
    kayit: {
      atId: h.atId, tarih: h.tarih, tur: (h.track ? TUR[h.track] : undefined) ?? "BILINMIYOR", pist: PIST[(h.splits["pist"] ?? "").toString()] ?? null,
      icDis: ic === "ic" ? "IC" : ic === "dis" ? "DIS" : null, efor: h.form ? EFOR[h.form] ?? null : null,
      mesafe: son.m, sure: son.s, son400: son.m > 400 ? s400 : null, irk: h.irk, yasGrubu: h.yasGrubu, jokey: h.jokey,
    },
  };
}
/** Mükerrer idman (aynı at+gün+tür+pist+iç/dış+mesafe+süreler) tek sayılır; efor bilgisi olan kopya tercih edilir. */
export function galopTekille(liste: GalopKaydi[]): GalopKaydi[] {
  const m = new Map<string, GalopKaydi>();
  for (const g of liste) { const k = [g.atId, g.tarih, g.tur, g.pist, g.icDis, g.mesafe, g.sure, g.son400].join("|"); const e = m.get(k); if (!e || (e.efor == null && g.efor != null)) m.set(k, g); }
  return [...m.values()];
}

const ikili = (a: number[], x: number) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m]! < x) lo = m + 1; else hi = m; } return lo; };
class KumSeri {
  private ham: { t: number; v: number[] }[] = []; private t: number[] = []; private cum: number[][] = [];
  constructor(private readonly k: number) {}
  ekle(t: number, v: number[]) { this.ham.push({ t, v }); }
  kapat() { this.ham.sort((a, b) => a.t - b.t); this.t = this.ham.map((x) => x.t); this.cum = [new Array(this.k).fill(0)]; for (const x of this.ham) this.cum.push(this.cum[this.cum.length - 1]!.map((s, j) => s + x.v[j]!)); this.ham = []; }
  /** t'den KESİNLİKLE önceki kayıtların sayısı ve toplamları. */
  oncesi(t: number): { n: number; s: number[] } { const n = ikili(this.t, t); return { n, s: this.cum[n]! }; }
}
const eksenAnahtar = (g: GalopKaydi, sev: 1 | 2 | 3): string | null => {
  if (g.pist == null || g.tur === "BILINMIYOR" || g.irk == null) return null;
  const temel = [g.mesafe, g.pist, g.tur];
  if (sev === 1) return g.yasGrubu == null || g.icDis == null ? null : [g.irk, g.yasGrubu, ...temel, g.icDis].join("|");
  if (sev === 2) return g.yasGrubu == null ? null : [g.irk, g.yasGrubu, ...temel].join("|");
  return [g.irk, ...temel].join("|");
};

export type GalopBilesenGalop = { tarih: number; mesafe: number; tur: GalopTur; hizZ: number | null; kapanisZ: number | null; eforZ: number | null; efor: number | null; referansSeviye: number | null };

export class GalopDeposu {
  private atIdx = new Map<number, GalopKaydi[]>(); private hiz = new Map<string, KumSeri>(); private kap = new Map<string, KumSeri>(); private eforSeri = new KumSeri(2);
  constructor(readonly galoplar: GalopKaydi[], readonly kosuGunleri: ReadonlyMap<number, readonly number[]>) {
    const sirali = [...galoplar].sort((a, b) => a.tarih - b.tarih);
    for (const g of sirali) {
      const e = this.atIdx.get(g.atId) ?? []; e.push(g); this.atIdx.set(g.atId, e);
      for (const sev of [1, 2, 3] as const) {
        const k = eksenAnahtar(g, sev); if (k == null) continue;
        const h = this.hiz.get(k) ?? new KumSeri(2); h.ekle(g.tarih, [g.sure, g.sure * g.sure]); this.hiz.set(k, h);
        if (g.son400 != null && g.mesafe > 400) { const c = this.kap.get(k) ?? new KumSeri(5); c.ekle(g.tarih, [g.sure, g.son400, g.sure * g.sure, g.sure * g.son400, g.son400 * g.son400]); this.kap.set(k, c); }
      }
      if (g.efor != null) this.eforSeri.ekle(g.tarih, [g.efor, g.efor * g.efor]);
    }
    for (const s of this.hiz.values()) s.kapat(); for (const s of this.kap.values()) s.kapat(); this.eforSeri.kapat();
  }
  /** Sızıntı dedektörü: tarih ≥ t olan galop değerleri/efor bozulur, uç değerli gelecek galop + gelecek koşu günü eklenir. */
  gelecegiBoz(t: number, tohum = 1): GalopDeposu {
    let s = tohum; const r = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; const yeni: GalopKaydi[] = [];
    for (const g of this.galoplar) {
      if (g.tarih < t) { yeni.push(g); continue; }
      yeni.push({ ...g, sure: g.sure * (0.8 + r() * 0.5), son400: g.son400 == null ? null : g.son400 * (0.8 + r() * 0.5), efor: g.efor == null ? null : 1 + Math.floor(r() * 5) });
      yeni.push({ ...g, tarih: g.tarih + GUN_MS * (1 + Math.floor(r() * 20)), sure: g.sure * 0.7, son400: g.son400 == null ? null : g.son400 * 0.7, efor: 5 });
    }
    const gun = new Map<number, number[]>(); for (const [k, v] of this.kosuGunleri) gun.set(k, [...v, t, t + GUN_MS * 3, t + GUN_MS * 9]);
    return new GalopDeposu(yeni, gun);
  }
  gorunum(t: number): GalopGorunum { return new GalopGorunum(this, t); }
  _at(id: number) { return this.atIdx.get(id); } _hiz(k: string) { return this.hiz.get(k); } _kap(k: string) { return this.kap.get(k); } _efor() { return this.eforSeri; }
}

export class GalopGorunum {
  constructor(private readonly d: GalopDeposu, readonly t: number) {}
  /** Atın t'den KESİNLİKLE önceki galopları (eskiden yeniye). */
  atGalopu(atId: number): GalopKaydi[] { const e = this.d._at(atId); if (!e) return []; return e.slice(0, ikili(e.map((x) => x.tarih), this.t)); }
  /** Atın t'den KESİNLİKLE önceki en son koşu günü; yoksa null. */
  oncekiKosu(atId: number): number | null { let m: number | null = null; for (const x of this.d.kosuGunleri.get(atId) ?? []) if (x < this.t && (m == null || x > m)) m = x; return m; }
  hizZ(g: GalopKaydi): { z: number; sev: number } | null {
    for (const sev of [1, 2, 3] as const) { const k = eksenAnahtar(g, sev); if (k == null) continue; const o = this.d._hiz(k)?.oncesi(this.t); if (!o || o.n < GALOP_SABITLERI.minGrupN) continue; const mu = o.s[0]! / o.n; const v = (o.s[1]! - o.n * mu * mu) / (o.n - 1); if (!(v > 1e-9)) continue; return { z: -(g.sure - mu) / Math.sqrt(v), sev }; }
    return null;
  }
  kapanisZ(g: GalopKaydi): number | null {
    if (g.son400 == null || g.mesafe <= 400) return null;
    for (const sev of [1, 2, 3] as const) {
      const k = eksenAnahtar(g, sev); if (k == null) continue; const o = this.d._kap(k)?.oncesi(this.t); if (!o || o.n < GALOP_SABITLERI.minGrupN) continue;
      const [sx, sy, sxx, sxy, syy] = o.s as [number, number, number, number, number]; const n = o.n; const den = n * sxx - sx * sx; if (!(den > 1e-9)) continue;
      const b = (n * sxy - sx * sy) / den; const a = (sy - b * sx) / n; const ssr = syy - a * sy - b * sxy; const v = ssr / (n - 2); if (!(v > 1e-9)) continue;
      return -(g.son400 - (a + b * g.sure)) / Math.sqrt(v);
    }
    return null;
  }
  eforZ(g: GalopKaydi): number | null {
    if (g.efor == null) return null; const o = this.d._efor().oncesi(this.t); if (o.n < GALOP_SABITLERI.minEforN) return null;
    const mu = o.s[0]! / o.n; const v = (o.s[1]! - o.n * mu * mu) / (o.n - 1); return v > 1e-9 ? (g.efor - mu) / Math.sqrt(v) : null;
  }
}

export type GalopBilesenleri = {
  // — Performans kapasitesi bileşenleri (z: karşılaştırılabilir grup referansına göre; + = daha iyi) —
  hiz: number | null; kapanis: number | null; efor: number | null;
  // — Yarışa hazırlık bileşenleri —
  trend: number | null; // aynı koşul grubunda son galopun ilk galoba göre hız-z farkı (+ = gelişme)
  sureklilik: number | null; // son 28 günde (önceki koşudan sonra) FARKLI idman günü sayısı
  // — Yön VARSAYILMAYAN betimleyiciler (bileşik puana GİRMEZ) —
  sonGalopGun: number | null; aradanDonusGun: number | null; yuk28Metre: number | null; sprintPayi28: number | null; maksBoslukGun: number | null;
  // — Veri güveni —
  guven: { oncekiKosuVar: boolean; pencereGalop: number; hizReferansli: number; kapanisReferansli: number; eforKayitli: number; trendCifti: number; enDusukReferansSeviye: number | null };
};

/** Bir atın yarış-öncesi GALOP bileşenleri. YALNIZ as-of görünümü kullanır (sızıntı yapısal olarak imkânsız; ayrıca metamorfik testle denetlenir). */
export function galopBilesenleri(g: GalopGorunum, atId: number): GalopBilesenleri {
  const t = g.t; const onceki = g.oncekiKosu(atId);
  const alt = onceki ?? t - GALOP_SABITLERI.oncekiKosuYoksaGun * GUN_MS;
  const pencere = g.atGalopu(atId).filter((x) => x.tarih > alt);
  const liste: GalopBilesenGalop[] = pencere.map((x) => { const h = g.hizZ(x); return { tarih: x.tarih, mesafe: x.mesafe, tur: x.tur, hizZ: h?.z ?? null, kapanisZ: g.kapanisZ(x), eforZ: g.eforZ(x), efor: x.efor, referansSeviye: h?.sev ?? null }; });
  const sonOrt = (f: (x: GalopBilesenGalop) => number | null) => { const v = liste.map(f).filter((z): z is number => z != null).slice(-GALOP_SABITLERI.sonNGalop); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  // trend: aynı (mesafe|tur|pist) grubunda ≥2 hız-z'li galop; en çok galopu/en yeni olan grup
  const gruplar = new Map<string, { tarih: number; z: number }[]>();
  pencere.forEach((x, i) => { const z = liste[i]!.hizZ; if (z == null) return; const k = [x.mesafe, x.tur, x.pist].join("|"); const e = gruplar.get(k) ?? []; e.push({ tarih: x.tarih, z }); gruplar.set(k, e); });
  let trend: number | null = null, trendCifti = 0; let enIyi: { tarih: number; z: number }[] | null = null;
  for (const e of gruplar.values()) if (e.length >= 2 && (enIyi == null || e.length > enIyi.length || (e.length === enIyi.length && e[e.length - 1]!.tarih > enIyi[enIyi.length - 1]!.tarih))) enIyi = e;
  if (enIyi) { trend = enIyi[enIyi.length - 1]!.z - enIyi[0]!.z; trendCifti = enIyi.length; }
  const p28 = pencere.filter((x) => x.tarih >= t - GALOP_SABITLERI.siklikPenceresiGun * GUN_MS);
  const gunler = [...new Set(p28.map((x) => x.tarih))].sort((a, b) => a - b);
  const bosluklar: number[] = []; for (let i = 1; i < gunler.length; i++) bosluklar.push((gunler[i]! - gunler[i - 1]!) / GUN_MS);
  const son = pencere.length ? pencere[pencere.length - 1]!.tarih : null;
  const sevler = liste.map((x) => x.referansSeviye).filter((s): s is number => s != null);
  return {
    hiz: sonOrt((x) => x.hizZ), kapanis: sonOrt((x) => x.kapanisZ), efor: sonOrt((x) => x.eforZ), trend,
    sureklilik: pencere.length === 0 ? null : gunler.length,
    sonGalopGun: son == null ? null : Math.round((t - son) / GUN_MS), aradanDonusGun: onceki == null ? null : Math.round((t - onceki) / GUN_MS),
    yuk28Metre: p28.length ? p28.reduce((a, x) => a + x.mesafe, 0) : null, sprintPayi28: p28.length ? p28.filter((x) => x.tur === "SPRINT").length / p28.length : null,
    maksBoslukGun: bosluklar.length ? Math.max(...bosluklar) : null,
    guven: { oncekiKosuVar: onceki != null, pencereGalop: pencere.length, hizReferansli: liste.filter((x) => x.hizZ != null).length, kapanisReferansli: liste.filter((x) => x.kapanisZ != null).length, eforKayitli: liste.filter((x) => x.efor != null).length, trendCifti, enDusukReferansSeviye: sevler.length ? Math.max(...sevler) : null },
  };
}
