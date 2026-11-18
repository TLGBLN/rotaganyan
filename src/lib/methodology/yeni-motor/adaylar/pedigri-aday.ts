// YENİ MOTOR — ADAY HESAP: PEDİGRİ (kullanıcı tanımı, 2026-11-18): PED_SIRE, PED_DAM, PED_DAMSIRE. AKTİF SİNYAL DEĞİLDİR: SINYAL_KAYDI'na EKLENMEDİ.
// SAF: veritabanı / ağ / saat / rastgelelik YOK. Yalnız hedef yarış gününden KESİNLİKLE önceki (tarih < t) yavru startları; aynı gün ve sonrası görünmez.
//   P̂_{l,g} = (W_{l,g} + k·P_g) / (N_{l,g} + k)
//   l: soy hattı (SIRE = baba; DAM = anne → diğer yavrular/kardeşler; DAMSIRE = anne-babası → o soydan gelenler); g: koşul = zemin × mesafe bandı (K ≤1300 / O 1400–1900 / U ≥2000).
//   W: hattın o koşuldaki yavru galibiyetleri, N: startları; P_g: aynı koşulda TÜM startların galibiyet oranı (karşılaştırılabilir yarışların genel kazanma oranı); k: az örnekli hatları dengeleyen parametre (ÖĞRENİLMEZ; çağıran verir, önceden bildirilen değerler yan yana raporlanır).
//   Çıktı 'artık' = P̂ − P_g (koşula göre sapma). Hat anahtarı yoksa veya P_g için yeterli start yoksa değer NULL (sıfır DEĞİL).
// ÖRTÜŞME KORUMASI (kullanıcı talimatı): hedef atın KENDİ geçmiş startları W, N ve P_g'den ÇIKARILIR (aynı atın kendi geçmişi soy hattı istatistiğine ikinci kez girmez → SON6/ACC_HIZ ile çift sayım olmaz).
export const PED_GUN_MS = 86400000;
export const PED_MIN_PG_N = 50; // P_g için en az start (altında değer NULL)
export type PedHat = "SIRE" | "DAM" | "DAMSIRE";
/** grup: zemin|mesafeBandı (pedGrup). kazandi: o startı kazandı mı (0/1). sire/dam/damSire: atın soy anahtarları (pedAnahtar). */
export type PedKayit = { atId: number; tarih: number; grup: string; kazandi: 0 | 1; sire: string | null; dam: string | null; damSire: string | null };
export const pedAnahtar = (s: string | null | undefined): string | null => { const t = (s ?? "").replace(/\s+/g, " ").trim().toLocaleUpperCase("tr"); return t ? t : null; };
export const mesafeBandi = (m: number) => (m <= 1300 ? "K" : m <= 1900 ? "O" : "U");
export const pedGrup = (yuzey: string, mesafe: number) => `${yuzey}|${mesafeBandi(mesafe)}`;
const hatAnahtari = (r: PedKayit, hat: PedHat) => (hat === "SIRE" ? r.sire : hat === "DAM" ? r.dam : r.damSire);
const ikili = (a: number[], x: number) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m]! < x) lo = m + 1; else hi = m; } return lo; };
type Idx = { t: number[]; n: number[]; w: number[] };
export class PedigriDeposu {
  private idx = new Map<string, Idx>(); private at = new Map<number, PedKayit[]>();
  constructor(readonly kayitlar: PedKayit[]) {
    const ekle = (key: string, r: PedKayit) => { const e = this.idx.get(key) ?? { t: [], n: [0], w: [0] }; e.t.push(r.tarih); e.n.push(e.n[e.n.length - 1]! + 1); e.w.push(e.w[e.w.length - 1]! + r.kazandi); this.idx.set(key, e); };
    for (const r of [...kayitlar].sort((a, b) => a.tarih - b.tarih)) { for (const hat of ["SIRE", "DAM", "DAMSIRE"] as PedHat[]) { const a = hatAnahtari(r, hat); if (a != null) ekle(`${hat}|${a}|${r.grup}`, r); } ekle(`*|*|${r.grup}`, r); const l = this.at.get(r.atId) ?? []; l.push(r); this.at.set(r.atId, l); }
  }
  /** Sızıntı dedektörü: tarih ≥ t kayıtların sonucu bozulur; aynı güne ve geleceğe uç değerli sahte yavru startları eklenir. */
  gelecegiBoz(t: number, tohum = 1): PedigriDeposu {
    let s = tohum; const r = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; const yeni: PedKayit[] = [];
    for (const x of this.kayitlar) { if (x.tarih < t) { yeni.push(x); continue; } yeni.push({ ...x, kazandi: r() < 0.5 ? 1 : 0 }); }
    const hatlar = new Set<string>(); for (const x of this.kayitlar) hatlar.add(`${x.sire}|${x.dam}|${x.damSire}|${x.grup}`);
    let k = 0; for (const h of hatlar) { const [si, da, ms, ...gp] = h.split("|"); for (let i = 0; i < 6; i++) yeni.push({ atId: -1000 - k++, tarih: t + PED_GUN_MS * (i % 3), grup: gp.join("|"), kazandi: 1, sire: si === "null" ? null : si!, dam: da === "null" ? null : da!, damSire: ms === "null" ? null : ms! }); }
    return new PedigriDeposu(yeni);
  }
  gorunum(t: number): PedigriGorunum { return new PedigriGorunum(this, t); }
  _i(key: string) { return this.idx.get(key); }
  _a(atId: number) { return this.at.get(atId); }
}
export class PedigriGorunum {
  constructor(private readonly d: PedigriDeposu, readonly t: number) {}
  toplam(key: string) { const e = this.d._i(key); if (!e) return { n: 0, w: 0 }; const k = ikili(e.t, this.t); return { n: e.n[k]!, w: e.w[k]! }; }
  /** Atın t'den KESİN önceki kendi startları. */
  atKayitlari(atId: number): PedKayit[] { const e = this.d._a(atId); return e ? e.filter((x) => x.tarih < this.t) : []; }
}
export type PedSonuc = { phat: number | null; artik: number | null; w: number; n: number; pg: number | null; pgN: number; kendiCikarilan: number };
/** Hat/koşul için düzeltilmiş başarı; hedef atın kendi startları çıkarılır. anahtar null ise tüm alanlar null. */
export function pedSatir(g: PedigriGorunum, hat: PedHat, anahtar: string | null, grup: string, atId: number, k: number): PedSonuc {
  const bos: PedSonuc = { phat: null, artik: null, w: 0, n: 0, pg: null, pgN: 0, kendiCikarilan: 0 }; if (anahtar == null) return bos;
  const own = g.atKayitlari(atId).filter((r) => r.grup === grup); const ownHat = own.filter((r) => hatAnahtari(r, hat) === anahtar); const ownN = ownHat.length, ownW = ownHat.reduce((s, r) => s + r.kazandi, 0);
  const l = g.toplam(`${hat}|${anahtar}|${grup}`); const gl = g.toplam(`*|*|${grup}`); const W = l.w - ownW, N = l.n - ownN; const pgN = gl.n - own.length; const pgW = gl.w - own.reduce((s, r) => s + r.kazandi, 0);
  if (pgN < PED_MIN_PG_N) return { ...bos, w: W, n: N, pgN, kendiCikarilan: ownN };
  const pg = pgW / pgN; const phat = (W + k * pg) / (N + k); return { phat, artik: phat - pg, w: W, n: N, pg, pgN, kendiCikarilan: ownN };
}
