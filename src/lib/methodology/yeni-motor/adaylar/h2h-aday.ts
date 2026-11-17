// YENİ MOTOR — ADAY HESAP: H2H_NET_SKOR (kullanıcı tanımı, 2026-11-18). AKTİF SİNYAL DEĞİLDİR: SINYAL_KAYDI'na EKLENMEDİ.
// SAF: veritabanı / ağ / saat / rastgelelik YOK. Yalnız hedef yarış gününden KESİNLİKLE önceki (tarih < t) ortak yarışlar. Hiç ortak yarış yoksa değer NULL (sıfır DEĞİL).
//   X_{h,j,r} = +1 (h rakibini geçti) / −1 (geçildi) / 0 (eşit sıra)      (iki atın da bitiş sırası biliniyorsa)
//   H2H_{h,j} = Σ_r w_r·X / (Σ_r w_r + λ)       H2H_NET_h = ortalama_{j ∈ M_h} H2H_{h,j}     M_h: bugünkü rakiplerden, geçmişte ≥1 ortak yarışı olanlar
// w_r (güncellik × koşul benzerliği) ve λ kullanıcı tarafından TANIMLANMADI: aşağıdaki sabitler GEÇİCİ VARSAYIMDIR (öğrenilmedi; kullanıcı onayına tabi).
export const H2H_GUN_MS = 86400000;
export const H2H_SABITLERI = { yarimOmurGun: 90, farkliYuzeyAgirlik: 0.5, mesafeEsikM: 200, farkliMesafeAgirlik: 0.5, lambda: 1 } as const;
/** yarisKey: aynı yarışı tanımlayan anahtar (şehir|tarih|koşu no). sira: bitiş sırası (1 = kazanan). */
export type H2HKayit = { yarisKey: string; atId: number; tarih: number; sira: number; yuzey: string; mesafe: number };
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
/** H2H_{h,j}: ortak yarış yoksa deger = null. hedef: bugünkü yarışın yüzeyi ve mesafesi (benzerlik ağırlığı için). */
export function h2hCift(g: H2HGorunum, h: number, j: number, hedef: { yuzey: string; mesafe: number }): H2HCift {
  const jMap = new Map<string, H2HKayit>(); for (const x of g.atKayitlari(j)) jMap.set(x.yarisKey, x); let sw = 0, swx = 0, n = 0, gal = 0, mag = 0;
  for (const a of g.atKayitlari(h)) { const b = jMap.get(a.yarisKey); if (!b) continue; const x = a.sira < b.sira ? 1 : a.sira > b.sira ? -1 : 0; const gun = (g.t - a.tarih) / H2H_GUN_MS; const w = Math.pow(0.5, gun / H2H_SABITLERI.yarimOmurGun) * (a.yuzey === hedef.yuzey ? 1 : H2H_SABITLERI.farkliYuzeyAgirlik) * (Math.abs(a.mesafe - hedef.mesafe) <= H2H_SABITLERI.mesafeEsikM ? 1 : H2H_SABITLERI.farkliMesafeAgirlik); sw += w; swx += w * x; n++; if (x > 0) gal++; else if (x < 0) mag++; }
  return { deger: n > 0 ? swx / (sw + H2H_SABITLERI.lambda) : null, n, agirlikToplam: sw, galibiyet: gal, maglubiyet: mag };
}
export type H2HNet = { deger: number | null; nRakip: number; toplamRakip: number; ciftler: { j: number; c: H2HCift }[] };
/** H2H_NET_h: bugünkü rakiplerle (≥1 ortak yarış) çift değerlerinin ortalaması; hiç ortak yarış yoksa null; veri olan rakip sayısı ayrıca gösterilir. */
export function h2hNet(g: H2HGorunum, h: number, rakipler: number[], hedef: { yuzey: string; mesafe: number }): H2HNet {
  const ciftler: { j: number; c: H2HCift }[] = []; for (const j of rakipler) { if (j === h) continue; const c = h2hCift(g, h, j, hedef); if (c.deger != null) ciftler.push({ j, c }); }
  return { deger: ciftler.length ? ciftler.reduce((s, x) => s + x.c.deger!, 0) / ciftler.length : null, nRakip: ciftler.length, toplamRakip: rakipler.filter((j) => j !== h).length, ciftler };
}
