// YENİ MOTOR — ADAY HESAP: ANTRENÖR MODELİ (kullanıcı tanımı, 2026-11-18): ANT_SEVIYE, ANT_BEKLENTI. AKTİF SİNYAL DEĞİLDİR: SINYAL_KAYDI'na EKLENMEDİ.
// SAF: veritabanı / ağ / saat / rastgelelik YOK. Yalnız hedef yarış gününden KESİNLİKLE önceki (tarih < t) startlar; aynı gün ve sonrası görünmez. Toplu (17.11 gibi) antrenör tablosu KULLANILMAZ.
// Katsayı ÖĞRENİLMEZ. Eksik veri sıfır sayılmaz: startı olmayan antrenör için değer null ("veri yok").
//   Pencere: [t−365 gün, t).
//   ANT_SEVIYE   = (W + k·P0) / (N + k)      W: galibiyet, N: start, P0: karşılaştırılabilir yarışlardaki genel kazanma oranı = antrenörün kendi startlarındaki 1/(sahadaki at sayısı) ortalaması (eşit-şans oranı; yarış karışımına göre)
//   ANT_BEKLENTI = Σ(Y_i − P_i) / (N + k)    P_i: ANTRENÖR ETKİSİ HARİÇ yarış-öncesi kazanma olasılığı; yalnız P_i'si bilinen startlar
// k: GEÇİCİ SABİT (öğrenilmedi; kullanıcı onayına tabi).
export const ANT_GUN_MS = 86400000;
export const ANT_SABITLERI = { refGun: 365, kSeviye: 8, kBeklenti: 8 } as const;
/** alanN: o yarıştaki gerçek koşan at sayısı. pBaz: antrenör etkisi hariç, o yarışın ÖNCESİNDE bilinen bilgilerle hesaplanmış kazanma olasılığı; yoksa null. */
export type StartKaydi = { raceId: string; tarih: number; antrenor: string; kazandi: 0 | 1; alanN: number; pBaz: number | null };

const ikili = (a: number[], x: number) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m]! < x) lo = m + 1; else hi = m; } return lo; };

export class AntrenorDeposu {
  private idx = new Map<string, { t: number[]; k: StartKaydi[] }>();
  constructor(readonly kayitlar: StartKaydi[]) { for (const r of [...kayitlar].sort((a, b) => a.tarih - b.tarih)) { const e = this.idx.get(r.antrenor) ?? { t: [], k: [] }; e.t.push(r.tarih); e.k.push(r); this.idx.set(r.antrenor, e); } }
  /** Sızıntı dedektörü: tarih ≥ t olan startların sonucu/pBaz/alanN'ı bozulur; aynı güne ve geleceğe uç değerli sahte startlar eklenir. */
  gelecegiBoz(t: number, tohum = 1): AntrenorDeposu {
    let s = tohum; const r = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; const yeni: StartKaydi[] = [];
    for (const x of this.kayitlar) { if (x.tarih < t) { yeni.push(x); continue; } yeni.push({ ...x, kazandi: r() < 0.5 ? 1 : 0, alanN: 4 + Math.floor(r() * 12), pBaz: x.pBaz == null ? null : r() }); }
    for (const a of this.idx.keys()) for (let i = 0; i < 12; i++) yeni.push({ raceId: "bozuk-" + a + i, tarih: t + ANT_GUN_MS * (i % 3), antrenor: a, kazandi: 1, alanN: 5, pBaz: 0.01 });
    return new AntrenorDeposu(yeni);
  }
  gorunum(t: number): AntrenorGorunum { return new AntrenorGorunum(this, t); }
  _a(a: string) { return this.idx.get(a); }
}
export class AntrenorGorunum {
  constructor(private readonly d: AntrenorDeposu, readonly t: number) {}
  /** Antrenörün t'den KESİNLİKLE önceki startları (eskiden yeniye). */
  startlari(antrenor: string): StartKaydi[] { const e = this.d._a(antrenor); if (!e) return []; return e.k.slice(0, ikili(e.t, this.t)); }
}

export type AntrenorBilesenleri = {
  seviye: { deger: number | null; w: number; n: number; oran: number | null; p0: number | null; k: number; agirlik: number | null }; // ANT_SEVIYE
  beklenti: { deger: number | null; w: number; e: number; nBilinen: number; nToplam: number; k: number }; // ANT_BEKLENTI (w,e,nBilinen: yalnız P_i'si bilinen startlar)
  guven: { toplamGecmis: number };
};
/** Bir antrenörün yarış-öncesi bileşenleri; seviye ve beklenti AYRI tutulur. */
export function antrenorBilesenleri(g: AntrenorGorunum, antrenor: string): AntrenorBilesenleri {
  const bas = g.t - ANT_SABITLERI.refGun * ANT_GUN_MS; const gec = g.startlari(antrenor); const p = gec.filter((s) => s.tarih >= bas);
  const n = p.length, w = p.reduce((s, x) => s + x.kazandi, 0); const p0 = n > 0 ? p.reduce((s, x) => s + 1 / x.alanN, 0) / n : null; const k = ANT_SABITLERI.kSeviye;
  const deger = n > 0 && p0 != null ? (w + k * p0) / (n + k) : null;
  const bil = p.filter((x) => x.pBaz != null); const wB = bil.reduce((s, x) => s + x.kazandi, 0), eB = bil.reduce((s, x) => s + x.pBaz!, 0);
  return {
    seviye: { deger, w, n, oran: n > 0 ? w / n : null, p0, k, agirlik: n > 0 ? n / (n + k) : null },
    beklenti: { deger: bil.length > 0 ? (wB - eB) / (bil.length + ANT_SABITLERI.kBeklenti) : null, w: wB, e: eB, nBilinen: bil.length, nToplam: n, k: ANT_SABITLERI.kBeklenti },
    guven: { toplamGecmis: gec.length },
  };
}
