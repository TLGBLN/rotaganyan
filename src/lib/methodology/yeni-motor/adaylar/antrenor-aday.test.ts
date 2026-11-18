import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ANT_GUN_MS, AntrenorDeposu, antrenorBilesenleri, type StartKaydi } from "./antrenor-aday";
import { SINYAL_KAYDI } from "../sinyal-kaydi";

const T = Date.UTC(2026, 10, 16);
let sayac = 0;
const s = (gun: number, kazandi: 0 | 1, alanN = 10, pBaz: number | null = null, antrenor = "A"): StartKaydi => ({ raceId: "r" + sayac++, tarih: T - gun * ANT_GUN_MS, antrenor, kazandi, alanN, pBaz });

describe("ANTRENÖR adayı (ANT_SEVIYE, ANT_BEKLENTI; aktif sinyal DEĞİL)", () => {
  it("SINYAL_KAYDI: kullanıcı onaylı beş aile (bu aday modül ayrıca yalnız araştırma amaçlıdır)", () => { expect(SINYAL_KAYDI.length).toBe(5); });
  it("ANT_SEVIYE = (W + k·P0)/(N + k); P0 = ortalama 1/alan (sayısal örnek)", () => {
    const l = Array.from({ length: 20 }, (_, i) => s(5 + i, i < 4 ? 1 : 0, 10)); const r = antrenorBilesenleri(new AntrenorDeposu(l).gorunum(T), "A");
    expect(r.seviye).toMatchObject({ n: 20, w: 4, k: 8 }); expect(r.seviye.p0).toBeCloseTo(0.1); expect(r.seviye.deger).toBeCloseTo((4 + 8 * 0.1) / 28); expect(r.seviye.agirlik).toBeCloseTo(20 / 28);
    const kar = antrenorBilesenleri(new AntrenorDeposu([s(3, 1, 8), s(4, 0, 12)]).gorunum(T), "A"); expect(kar.seviye.p0).toBeCloseTo((1 / 8 + 1 / 12) / 2); // yarış karışımına göre
  });
  it("az startlı antrenör uç değer almaz: 22 start / 10 galibiyet → oran %45,5 ama düzeltilmiş değer P0'a yaklaşır", () => {
    const l = Array.from({ length: 22 }, (_, i) => s(1 + i, i < 10 ? 1 : 0, 10)); const r = antrenorBilesenleri(new AntrenorDeposu(l).gorunum(T), "A");
    expect(r.seviye.oran).toBeCloseTo(10 / 22); expect(r.seviye.deger!).toBeLessThan(0.45); expect(r.seviye.deger!).toBeCloseTo((10 + 0.8) / 30);
  });
  it("pencere: t−365 dahil, t−366 dışı; aynı gün ve sonrası görünmez; geçmişi olmayan antrenör null", () => {
    const l = [s(365, 1), s(366, 1), s(0, 1), s(-4, 1), s(10, 0)]; const r = antrenorBilesenleri(new AntrenorDeposu(l).gorunum(T), "A");
    expect(r.seviye.n).toBe(2); expect(r.seviye.w).toBe(1); expect(r.guven.toplamGecmis).toBe(3);
    const bos = antrenorBilesenleri(new AntrenorDeposu(l).gorunum(T), "YOK"); expect(bos.seviye.deger).toBeNull(); expect(bos.beklenti.deger).toBeNull();
  });
  it("ANT_BEKLENTI = Σ(Y−P)/(N+k); yalnız P'si bilinen startlar; olasılık yoksa ÜRETİLMEZ", () => {
    const l = [...Array.from({ length: 10 }, (_, i) => s(2 + i, i < 2 ? 1 : 0, 10, 0.12)), s(20, 1, 10, null), s(21, 0, 10, null)]; const r = antrenorBilesenleri(new AntrenorDeposu(l).gorunum(T), "A");
    expect(r.beklenti).toMatchObject({ nBilinen: 10, nToplam: 12, w: 2, k: 8 }); expect(r.beklenti.e).toBeCloseTo(1.2); expect(r.beklenti.deger).toBeCloseTo((2 - 1.2) / 18);
    expect(antrenorBilesenleri(new AntrenorDeposu([s(2, 1), s(3, 0)]).gorunum(T), "A").beklenti.deger).toBeNull();
  });
  it("SIZINTI: t ve sonrası bozulunca (aynı gün sahte dahil) bileşenler BİREBİR aynı", () => {
    const l: StartKaydi[] = []; for (let a = 1; a <= 20; a++) { for (let i = 0; i < 40; i++) l.push(s(5 + i * 5, i % 5 === 0 ? 1 : 0, 8 + (i % 6), 0.1, "A" + a)); for (let i = 0; i < 8; i++) l.push(s(-i, 1, 9, 0.2, "A" + a)); }
    const d = new AntrenorDeposu(l); const x = d.gorunum(T), y = d.gelecegiBoz(T, 7).gorunum(T); for (let a = 1; a <= 20; a++) expect(antrenorBilesenleri(y, "A" + a)).toEqual(antrenorBilesenleri(x, "A" + a));
  });
  it("yapısal: saf dosya (db/ağ/saat/rastgele/sonuç import ETMEZ)", () => {
    const kod = fs.readFileSync(path.join(__dirname, "antrenor-aday.ts"), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    expect(/from\s+["']/.test(kod)).toBe(false); expect(/\bDate\b|Math\.random|fetch\(|prisma|\bdb\b|process\.|winner|result|ganyan/.test(kod)).toBe(false);
  });
});
