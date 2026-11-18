import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { JOKEY_GUN_MS, JokeyDeposu, jokeyBilesenleri, type BinisKaydi } from "./jokey-aday";
import { SINYAL_KAYDI } from "../sinyal-kaydi";

const T = Date.UTC(2026, 10, 16);
const b = (gun: number, kazandi: 0 | 1, pBaz: number | null = null, jokey = "J"): BinisKaydi => ({ raceId: "r" + Math.random().toString(36).slice(2), tarih: T - gun * JOKEY_GUN_MS, jokey, kazandi, pBaz });
const seri = (n: number, w: number, gunBas: number, gunSon: number, pBaz: number | null = null, jokey = "J") => Array.from({ length: n }, (_, i) => b(gunBas - Math.floor(((gunBas - gunSon) * i) / Math.max(1, n - 1)), i < w ? 1 : 0, pBaz, jokey));

describe("JOKEY adayı (J_SEVIYE, J_FORM30, J_BEKLENTI; aktif sinyal DEĞİL)", () => {
  it("SINYAL_KAYDI: kullanıcı onaylı beş aile (bu aday modül ayrıca yalnız araştırma amaçlıdır)", () => { expect(SINYAL_KAYDI.length).toBe(5); });
  it("J_SEVIYE = W_ref/N_ref; J_FORM30 = N30/(N30+8)·(W30/N30 − P_ref) (sayısal örnek)", () => {
    const l = [...seri(100, 12, 200, 40), ...seri(100, 18, 29, 1)]; const r = jokeyBilesenleri(new JokeyDeposu(l).gorunum(T), "J");
    expect(r.seviye).toMatchObject({ nRef: 100, wRef: 12 }); expect(r.seviye.pRef).toBeCloseTo(0.12); expect(r.form30.n30).toBe(100); expect(r.form30.oran30).toBeCloseTo(0.18);
    expect(r.form30.agirlik).toBeCloseTo(100 / 108); expect(r.form30.deger).toBeCloseTo((100 / 108) * (0.18 - 0.12));
  });
  it("pencere sınırları: t−30 gün son 30'a, t−31 gün referansa; t−365 dahil, t−366 dışı; aynı gün ve sonrası görünmez", () => {
    const l = [b(30, 1), b(31, 0), b(365, 1), b(366, 1), b(0, 1), b(-3, 1)]; const r = jokeyBilesenleri(new JokeyDeposu(l).gorunum(T), "J");
    expect(r.form30.n30).toBe(1); expect(r.form30.w30).toBe(1); expect(r.seviye.nRef).toBe(2); expect(r.seviye.wRef).toBe(1); expect(r.guven.toplamGecmis).toBe(4);
  });
  it("geçmişi olmayan jokey: değerler null (veri yok, negatif sayılmaz); referansı olmayan jokeyde J_FORM30 null", () => {
    const r0 = jokeyBilesenleri(new JokeyDeposu([b(5, 1)]).gorunum(T), "YOK"); expect(r0.seviye.pRef).toBeNull(); expect(r0.form30.deger).toBeNull(); expect(r0.beklenti.deger).toBeNull();
    const r1 = jokeyBilesenleri(new JokeyDeposu([b(5, 1), b(6, 0)]).gorunum(T), "J"); expect(r1.seviye.pRef).toBeNull(); expect(r1.form30.deger).toBeNull(); expect(r1.form30.oran30).toBeCloseTo(0.5);
  });
  it("J_BEKLENTI = Σ(Y−P)/(N+k); yalnız P'si bilinen binişler; hiç olasılık yoksa ÜRETİLMEZ", () => {
    const l = [...Array.from({ length: 20 }, (_, i) => b(2 + i, i < 5 ? 1 : 0, 0.15)), b(3, 0, null), b(4, 1, null)]; const r = jokeyBilesenleri(new JokeyDeposu(l).gorunum(T), "J"); // 20 bilinen: 5 galibiyet, ΣP=3 ; 2 bilinmeyen
    expect(r.beklenti).toMatchObject({ nBilinen: 20, nToplam: 22, w: 5, k: 8 }); expect(r.beklenti.e).toBeCloseTo(3); expect(r.beklenti.deger).toBeCloseTo((5 - 3) / (20 + 8));
    expect(jokeyBilesenleri(new JokeyDeposu([b(2, 1, null), b(3, 0, null)]).gorunum(T), "J").beklenti.deger).toBeNull();
  });
  it("SIZINTI: t ve sonrası bozulunca (aynı gün sahte dahil) bileşenler BİREBİR aynı", () => {
    const l: BinisKaydi[] = []; for (let j = 1; j <= 20; j++) l.push(...seri(60, j % 7, 300, 1, 0.1, "J" + j), ...Array.from({ length: 8 }, (_, i) => b(-i, 1, 0.2, "J" + j))); const d = new JokeyDeposu(l); const x = d.gorunum(T), y = d.gelecegiBoz(T, 7).gorunum(T);
    for (let j = 1; j <= 20; j++) expect(jokeyBilesenleri(y, "J" + j)).toEqual(jokeyBilesenleri(x, "J" + j));
  });
  it("yapısal: saf dosya (db/ağ/saat/rastgele/sonuç import ETMEZ)", () => {
    const kod = fs.readFileSync(path.join(__dirname, "jokey-aday.ts"), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    expect(/from\s+["']/.test(kod)).toBe(false); expect(/\bDate\b|Math\.random|fetch\(|prisma|\bdb\b|process\.|winner|result|ganyan/.test(kod)).toBe(false);
  });
});
