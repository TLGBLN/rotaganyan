// V7 — AS-OF (yarış öncesi) VERİ DEPOSU. SAF, DB'siz, canlı koddan HİÇBİR ŞEY import etmez. 2026-11-17 kullanıcı kararı: yeni sinyaller ESKİ yarışlarda test edilebilir olacak ve SIZINTI olmayacak.
// Tasarım: bir özellik fonksiyonu veriyi YALNIZ AsOfGorunum üzerinden görür; görünüm hedef zaman t'den KESİNLİKLE önceki (tarih < t; aynı gün DAHİL DEĞİL) kayıtları verir. Özellik, deposuna doğrudan erişemez.
export type KosuKaydi = {
  raceId: string; tarih: number; // yarış günü, UTC gün başı (ms)
  hip: string; mesafe: number; yuzey: string | null; sinif: string; irk: string;
  atId: number | null; no: number; jokey: string | null; antrenor: string | null;
  kilo: number | null; hp: number | null; sira: number | null; // bitiş sırası (1 = kazanan), bilinmiyorsa null
  kazandi: 0 | 1; alan: number; // sahadaki at sayısı
};

const ikiliArama = (a: number[], x: number) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m]! < x) lo = m + 1; else hi = m; } return lo; }; // x'ten KÜÇÜK eleman sayısı

export class Deposu {
  readonly kayitlar: KosuKaydi[];
  private atIdx = new Map<number, { t: number[]; k: KosuKaydi[] }>(); private jokeyIdx = new Map<string, { t: number[]; k: KosuKaydi[] }>(); private antrenorIdx = new Map<string, { t: number[]; k: KosuKaydi[] }>(); private tumT: number[] = []; private tumKazanCum: number[] = [0];
  constructor(kayitlar: KosuKaydi[]) {
    this.kayitlar = [...kayitlar].sort((a, b) => a.tarih - b.tarih);
    const ekle = <K>(m: Map<K, { t: number[]; k: KosuKaydi[] }>, anahtar: K | null, k: KosuKaydi) => { if (anahtar == null) return; const e = m.get(anahtar) ?? { t: [], k: [] }; e.t.push(k.tarih); e.k.push(k); m.set(anahtar, e); };
    for (const k of this.kayitlar) { ekle(this.atIdx, k.atId, k); ekle(this.jokeyIdx, k.jokey, k); ekle(this.antrenorIdx, k.antrenor, k); this.tumT.push(k.tarih); this.tumKazanCum.push(this.tumKazanCum[this.tumKazanCum.length - 1]! + k.kazandi); }
  }
  /** Aynı kayıtlar, ama tarih ≥ t olanların SONUÇ alanları rastgele/uç değerlerle bozulmuş + uç değerli gelecek kayıtları eklenmiş (sızıntı dedektörü için). */
  gelecegiBoz(t: number, tohum = 1): Deposu {
    let s = tohum; const r = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; const yeni: KosuKaydi[] = [];
    for (const k of this.kayitlar) {
      if (k.tarih < t) { yeni.push(k); continue; }
      const sira = 1 + Math.floor(r() * Math.max(1, k.alan)); yeni.push({ ...k, sira, kazandi: sira === 1 ? 1 : 0, kilo: k.kilo == null ? null : 40 + r() * 40, hp: k.hp == null ? null : r() * 100, jokey: k.jokey == null ? null : k.jokey + (r() < 0.5 ? "" : "#"), mesafe: k.mesafe + (r() < 0.5 ? 0 : 200) });
      yeni.push({ ...k, tarih: k.tarih + 86400000 * (1 + Math.floor(r() * 30)), sira: 1, kazandi: 1, raceId: k.raceId + "#gelecek" });
    }
    return new Deposu(yeni);
  }
  gorunum(t: number): AsOfGorunum { return new AsOfGorunum(this, t); }
  /** Dahili — yalnız AsOfGorunum kullanır. */
  _at(id: number) { return this.atIdx.get(id); } _jokey(j: string) { return this.jokeyIdx.get(j); } _antrenor(a: string) { return this.antrenorIdx.get(a); }
  _tumOnce(t: number) { const n = ikiliArama(this.tumT, t); return { n, kazanan: this.tumKazanCum[n]! }; }
}

export class AsOfGorunum {
  constructor(private readonly d: Deposu, readonly t: number) {}
  private kes(e: { t: number[]; k: KosuKaydi[] } | undefined): KosuKaydi[] { if (!e) return []; const n = ikiliArama(e.t, this.t); return e.k.slice(0, n); }
  /** Atın t'den ÖNCEKİ (kesin) bahisleri, eskiden yeniye. */
  atGecmisi(atId: number | null): KosuKaydi[] { return atId == null ? [] : this.kes(this.d._at(atId)); }
  jokeyGecmisi(j: string | null): KosuKaydi[] { return j == null ? [] : this.kes(this.d._jokey(j)); }
  antrenorGecmisi(a: string | null): KosuKaydi[] { return a == null ? [] : this.kes(this.d._antrenor(a)); }
  /** t'den önceki TÜM bahislerin sayısı ve kazanan sayısı (as-of genel oran için). */
  genelOnce(): { n: number; kazanan: number } { return this.d._tumOnce(this.t); }
}
