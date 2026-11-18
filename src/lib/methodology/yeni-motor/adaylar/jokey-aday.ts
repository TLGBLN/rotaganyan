// YENİ MOTOR — ADAY HESAP: JOKEY MODELİ v1.0 (kullanıcı tanımı, 2026-11-18): J_SEVIYE, J_FORM30, J_BEKLENTI. AKTİF SİNYAL DEĞİLDİR: SINYAL_KAYDI'na EKLENMEDİ.
// SAF: veritabanı / ağ / saat / rastgelelik YOK. Yalnız hedef yarış gününden KESİNLİKLE önceki (tarih < t) binişler; aynı gün (hedef yarış ve ondan önceki koşular dahil) ve sonrası görünmez.
// Katsayı ÖĞRENİLMEZ. Eksik veri sıfır/negatif sayılmaz: geçmişi olmayan jokey için değer null ("veri yok").
//   Pencereler: referans = [t−365 gün, t−30 gün)  (son 30 gün HARİÇ);  son 30 gün = [t−30 gün, t).
//   J_SEVIYE   = P_ref = W_ref / N_ref                                            (genel seviye; bağımsız katkıyı KANITLAMAZ)
//   J_FORM30   = N30/(N30+8) · (W30/N30 − P_ref)                                  (güncel form: son 30 gün oranının KENDİ geçmiş seviyesinden farkı; örnek ağırlığı N/(N+8))
//   J_BEKLENTI = Σ(Y_i − P_i) / (N + k)                                           (son 30 gün: gerçekleşen − jokeyden BAĞIMSIZ yarış-öncesi beklenen galibiyet; yalnız P_i'si bilinen binişler; k GEÇİCİ SABİT, öğrenilmedi)
export const JOKEY_GUN_MS = 86400000;
/** formKatsayi = 8: kullanıcı tanımı. beklentiK = 8: ÖĞRENİLMEDİ; kullanıcı onayına tabi geçici sabit (J_FORM30'daki 8 ile aynı ölçekte). */
export const JOKEY_SABITLERI = { refGun: 365, sonGun: 30, formKatsayi: 8, beklentiK: 8 } as const;
/** pBaz: o biniş için jokeyden BAĞIMSIZ, o yarışın ÖNCESİNDEKİ bilgilerle hesaplanmış kazanma olasılığı; yoksa null (güvenilir olasılık yok). */
export type BinisKaydi = { raceId: string; tarih: number; jokey: string; kazandi: 0 | 1; pBaz: number | null };

const ikili = (a: number[], x: number) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m]! < x) lo = m + 1; else hi = m; } return lo; };

export class JokeyDeposu {
  private idx = new Map<string, { t: number[]; k: BinisKaydi[] }>();
  constructor(readonly kayitlar: BinisKaydi[]) { for (const r of [...kayitlar].sort((a, b) => a.tarih - b.tarih)) { const e = this.idx.get(r.jokey) ?? { t: [], k: [] }; e.t.push(r.tarih); e.k.push(r); this.idx.set(r.jokey, e); } }
  /** Sızıntı dedektörü: tarih ≥ t olan binişlerin sonucu ve pBaz'ı bozulur; aynı güne (t) ve geleceğe uç değerli sahte binişler eklenir. */
  gelecegiBoz(t: number, tohum = 1): JokeyDeposu {
    let s = tohum; const r = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; const yeni: BinisKaydi[] = [];
    for (const x of this.kayitlar) { if (x.tarih < t) { yeni.push(x); continue; } yeni.push({ ...x, kazandi: r() < 0.5 ? 1 : 0, pBaz: x.pBaz == null ? null : r() }); }
    for (const j of this.idx.keys()) for (let i = 0; i < 12; i++) yeni.push({ raceId: "bozuk-" + j + i, tarih: t + JOKEY_GUN_MS * (i % 3), jokey: j, kazandi: 1, pBaz: 0.01 });
    return new JokeyDeposu(yeni);
  }
  gorunum(t: number): JokeyGorunum { return new JokeyGorunum(this, t); }
  _j(j: string) { return this.idx.get(j); }
}
export class JokeyGorunum {
  constructor(private readonly d: JokeyDeposu, readonly t: number) {}
  /** Jokeyin t'den KESİNLİKLE önceki binişleri (eskiden yeniye). */
  binisleri(jokey: string): BinisKaydi[] { const e = this.d._j(jokey); if (!e) return []; return e.k.slice(0, ikili(e.t, this.t)); }
}

export type JokeyBilesenleri = {
  seviye: { pRef: number | null; wRef: number; nRef: number }; // J_SEVIYE (ham oran + biniş sayısı)
  form30: { deger: number | null; n30: number; w30: number; oran30: number | null; agirlik: number | null }; // J_FORM30
  beklenti: { deger: number | null; w: number; e: number; nBilinen: number; nToplam: number; k: number }; // J_BEKLENTI (w,e,nBilinen: yalnız P_i'si bilinen binişler; nToplam: son 30 gündeki tüm biniş)
  guven: { toplamGecmis: number; ilkBinisGunOnce: number | null };
};
/** Bir jokeyin yarış-öncesi JOKEY bileşenleri; üçü AYRI tutulur (genel seviye, güncel form ve beklenti farkı birbirine karıştırılmaz). */
export function jokeyBilesenleri(g: JokeyGorunum, jokey: string): JokeyBilesenleri {
  const t = g.t; const gecmis = g.binisleri(jokey); const sonBas = t - JOKEY_SABITLERI.sonGun * JOKEY_GUN_MS, refBas = t - JOKEY_SABITLERI.refGun * JOKEY_GUN_MS;
  const ref = gecmis.filter((b) => b.tarih >= refBas && b.tarih < sonBas), son = gecmis.filter((b) => b.tarih >= sonBas);
  const wRef = ref.reduce((s, b) => s + b.kazandi, 0), nRef = ref.length; const pRef = nRef > 0 ? wRef / nRef : null;
  const n30 = son.length, w30 = son.reduce((s, b) => s + b.kazandi, 0); const oran30 = n30 > 0 ? w30 / n30 : null; const ag = n30 > 0 ? n30 / (n30 + JOKEY_SABITLERI.formKatsayi) : null;
  const deger = n30 > 0 && pRef != null ? (n30 / (n30 + JOKEY_SABITLERI.formKatsayi)) * (w30 / n30 - pRef) : null;
  const bil = son.filter((b) => b.pBaz != null); const wB = bil.reduce((s, b) => s + b.kazandi, 0), eB = bil.reduce((s, b) => s + b.pBaz!, 0); const beklentiDeger = bil.length > 0 ? (wB - eB) / (bil.length + JOKEY_SABITLERI.beklentiK) : null;
  return {
    seviye: { pRef, wRef, nRef }, form30: { deger, n30, w30, oran30, agirlik: ag }, beklenti: { deger: beklentiDeger, w: wB, e: eB, nBilinen: bil.length, nToplam: n30, k: JOKEY_SABITLERI.beklentiK },
    guven: { toplamGecmis: gecmis.length, ilkBinisGunOnce: gecmis.length ? Math.round((t - gecmis[0]!.tarih) / JOKEY_GUN_MS) : null },
  };
}
