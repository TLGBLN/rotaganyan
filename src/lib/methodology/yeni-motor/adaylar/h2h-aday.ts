// YENİ MOTOR — ADAY HESAP: H2H_NET_SKOR (kullanıcı tanımı; parametre kararları 2026-11-18). AKTİF SİNYAL DEĞİLDİR: SINYAL_KAYDI'na EKLENMEDİ. Banko ayrıştırması için ARAŞTIRMA adayı.
// SAF: veritabanı / ağ / saat / rastgelelik YOK. Yalnız hedef yarış gününden KESİNLİKLE önceki (tarih < t) ortak yarışlar. Hiç ortak yarış yoksa değer NULL (sıfır DEĞİL).
//   X_{h,j,r} = +1 (h rakibini geçti) / −1 (geçildi) / 0 (eşit sıra)      (iki atın da bitiş sırası biliniyorsa)
//   H2H_{h,j} = Σ_r w_r·X / (Σ_r w_r + λ)       H2H_NET_h = ortalama_{j ∈ M_h} H2H_{h,j}     M_h: bugünkü rakiplerden, geçmişte ≥1 (ağırlığı > 0) ortak yarışı olanlar
//   w_r = 0,5^(gün/yarıÖmür) × mesafeBenzerliği(min/max oranı)   ANA hesap yalnız AYNI yüzey karşılaşmalarını kullanır (yuzey "AYNI"); farklı yüzey ayrı hesap (yuzey "FARKLI").
//   Yüzey bilinmiyorsa ("?": ıslak/ağır vb. dahil durum bilgisi yoksa) o karşılaşma HER İKİ hesaptan da dışarıdadır (eksik; "normal" varsayılmaz).
// yarıÖmür ve λ SABİTLENMEDİ (kullanıcı kararı): çağıran taraf 90/180/365 ve 1/3/5 değerlerini karşılaştırır; H2H_VARSAYILAN yalnız raporlama için bir başlangıçtır, SEÇİM DEĞİLDİR.
export const H2H_GUN_MS = 86400000;
export type H2HPar = { yarimOmurGun: number; lambda: number; yuzey: "AYNI" | "FARKLI" };
export const H2H_VARSAYILAN: H2HPar = { yarimOmurGun: 180, lambda: 3, yuzey: "AYNI" };
/** yarisKey: aynı yarışı tanımlayan anahtar (şehir|tarih|koşu no). sira: bitiş sırası (1 = kazanan). yuzey "?" = bilinmiyor. */
export type H2HKayit = { yarisKey: string; atId: number; tarih: number; sira: number; yuzey: string; mesafe: number };
export const mesafeBenzerligi = (a: number, b: number) => (a > 0 && b > 0 ? Math.min(a, b) / Math.max(a, b) : 0);
export class H2HDeposu {
  private idx = new Map<number, H2HKayit[]>();
  constructor(readonly kayitlar: H2HKayit[]) { for (const r of kayitlar) { const e = this.idx.get(r.atId) ?? []; e.push(r); this.idx.set(r.atId, e); } for (const e of this.idx.values()) e.sort((a, b) => a.tarih - b.tarih); }
  /** Sızıntı dedektörü: tarih ≥ t kayıtların sırası bozulur; aynı güne (t) ve geleceğe sahte ortak yarışlar eklenir. */
  gelecegiBoz(t: number, tohum = 1): H2HDeposu {
    let s = tohum; const r = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; const yeni: H2HKayit[] = [];
    for (const x of this.kayitlar) { if (x.tarih < t) { yeni.push(x); continue; } yeni.push({ ...x, sira: 1 + Math.floor(r() * 12) }); }
    const atlar = [...this.idx.keys()]; for (let i = 0; i < atlar.length; i++) for (let k = 1; k <= 3; k++) { const j = atlar[(i + k) % atlar.length]!; if (j === atlar[i]) continue; const key = "bozuk|" + i + "|" + k; yeni.push({ yarisKey: key, atId: atlar[i]!, tarih: t + H2H_GUN_MS * (k - 1), sira: 1, yuzey: "K", mesafe: 1400 }, { yarisKey: key, atId: j, tarih: t + H2H_GUN_MS * (k - 1), sira: 5, yuzey: "K", mesafe: 1400 }); }
    return new H2HDeposu(yeni);
  }
  gorunum(t: number): H2HGorunum { return new H2HGorunum(this, t); }
  _at(id: number) { return this.idx.get(id); }
}
export class H2HGorunum {
  constructor(private readonly d: H2HDeposu, readonly t: number) {}
  /** Atın t'den KESİNLİKLE önceki kayıtları (eskiden yeniye). */
  atKayitlari(atId: number): H2HKayit[] { const e = this.d._at(atId); return e ? e.filter((x) => x.tarih < this.t) : []; }
}
export type H2HCift = { deger: number | null; n: number; agirlikToplam: number; galibiyet: number; maglubiyet: number };
/** H2H_{h,j}: kullanılabilir ortak yarış yoksa deger = null. hedef: bugünkü yarışın yüzeyi ("K"/"Ç"/"S"/"?") ve mesafesi. */
export function h2hCift(g: H2HGorunum, h: number, j: number, hedef: { yuzey: string; mesafe: number }, par: H2HPar = H2H_VARSAYILAN): H2HCift {
  const jMap = new Map<string, H2HKayit>(); for (const x of g.atKayitlari(j)) jMap.set(x.yarisKey, x); let sw = 0, swx = 0, n = 0, gal = 0, mag = 0;
  if (hedef.yuzey === "?") return { deger: null, n: 0, agirlikToplam: 0, galibiyet: 0, maglubiyet: 0 };
  for (const a of g.atKayitlari(h)) { const b = jMap.get(a.yarisKey); if (!b) continue; if (a.yuzey === "?") continue; const ayni = a.yuzey === hedef.yuzey; if ((par.yuzey === "AYNI") !== ayni) continue;
    const sim = mesafeBenzerligi(a.mesafe, hedef.mesafe); if (sim <= 0) continue; const x = a.sira < b.sira ? 1 : a.sira > b.sira ? -1 : 0; const gun = (g.t - a.tarih) / H2H_GUN_MS; const w = Math.pow(0.5, gun / par.yarimOmurGun) * sim; sw += w; swx += w * x; n++; if (x > 0) gal++; else if (x < 0) mag++; }
  return { deger: n > 0 ? swx / (sw + par.lambda) : null, n, agirlikToplam: sw, galibiyet: gal, maglubiyet: mag };
}
export type H2HNet = { deger: number | null; nRakip: number; toplamRakip: number; ciftler: { j: number; c: H2HCift }[] };
/** H2H_NET_h: bugünkü rakiplerle (≥1 kullanılabilir ortak yarış) çift değerlerinin ortalaması; hiç yoksa null; veri olan rakip sayısı ayrıca gösterilir. */
export function h2hNet(g: H2HGorunum, h: number, rakipler: number[], hedef: { yuzey: string; mesafe: number }, par: H2HPar = H2H_VARSAYILAN): H2HNet {
  const ciftler: { j: number; c: H2HCift }[] = []; for (const j of rakipler) { if (j === h) continue; const c = h2hCift(g, h, j, hedef, par); if (c.deger != null) ciftler.push({ j, c }); }
  return { deger: ciftler.length ? ciftler.reduce((s, x) => s + x.c.deger!, 0) / ciftler.length : null, nRakip: ciftler.length, toplamRakip: rakipler.filter((j) => j !== h).length, ciftler };
}
/** Birden çok parametre kümesi için TEK geçişte h2hNet (hız için); her kümenin sonucu h2hNet(…, par) ile BİREBİR aynıdır (testle doğrulanır). */
export function h2hNetCoklu(g: H2HGorunum, h: number, rakipler: number[], hedef: { yuzey: string; mesafe: number }, pars: H2HPar[]): H2HNet[] {
  const base = rakipler.filter((j) => j !== h); const sonuc = pars.map(() => [] as { j: number; c: H2HCift }[]);
  if (hedef.yuzey !== "?") {
    const mine = g.atKayitlari(h);
    for (const j of base) { const jMap = new Map<string, H2HKayit>(); for (const x of g.atKayitlari(j)) jMap.set(x.yarisKey, x); const ortak: { x: number; sim: number; gun: number; ayni: boolean }[] = [];
      for (const a of mine) { const b = jMap.get(a.yarisKey); if (!b || a.yuzey === "?") continue; const sim = mesafeBenzerligi(a.mesafe, hedef.mesafe); if (sim <= 0) continue; ortak.push({ x: a.sira < b.sira ? 1 : a.sira > b.sira ? -1 : 0, sim, gun: (g.t - a.tarih) / H2H_GUN_MS, ayni: a.yuzey === hedef.yuzey }); }
      if (!ortak.length) continue;
      pars.forEach((par, i) => { let sw = 0, swx = 0, n = 0, gal = 0, mag = 0; for (const o of ortak) { if ((par.yuzey === "AYNI") !== o.ayni) continue; const w = Math.pow(0.5, o.gun / par.yarimOmurGun) * o.sim; sw += w; swx += w * o.x; n++; if (o.x > 0) gal++; else if (o.x < 0) mag++; } if (n > 0) sonuc[i]!.push({ j, c: { deger: swx / (sw + par.lambda), n, agirlikToplam: sw, galibiyet: gal, maglubiyet: mag } }); }); }
  }
  return sonuc.map((ciftler) => ({ deger: ciftler.length ? ciftler.reduce((s, x) => s + x.c.deger!, 0) / ciftler.length : null, nRakip: ciftler.length, toplamRakip: base.length, ciftler }));
}
