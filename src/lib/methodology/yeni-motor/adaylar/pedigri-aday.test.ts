import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PED_GUN_MS, PED_MIN_PG_N, PedigriDeposu, mesafeBandi, pedAnahtar, pedGrup, pedSatir, type PedKayit } from "./pedigri-aday";
import { SINYAL_KAYDI } from "../sinyal-kaydi";

const G = PED_GUN_MS; const T = 100 * G; const GR = "K|O";
const pk = (atId: number, gun: number, kazandi: 0 | 1, sire: string | null, dam: string | null, damSire: string | null, grup = GR): PedKayit => ({ atId, tarih: gun * G, grup, kazandi, sire, dam, damSire });
/** Taban: 100 farklı at, 1 start her biri, P_g = 0.2 (20 galibiyet) — baba 'S1' 10 yavru, 4 galibiyet. */
function taban(): PedKayit[] { const l: PedKayit[] = []; for (let i = 0; i < 100; i++) l.push(pk(i, 10 + (i % 80), i < 20 ? 1 : 0, i < 10 ? "S1" : "S" + (i % 7 + 2), "D" + i, "M" + (i % 5))); return l; }
describe("PEDİGRİ aday hesabı", () => {
  it("SINYAL_KAYDI: kullanıcı onaylı beş aile (bu aday modül ayrıca yalnız araştırma amaçlıdır)", () => { expect(SINYAL_KAYDI.length).toBe(5); });
  it("anahtar normalizasyonu ve koşul grupları", () => { expect(pedAnahtar("  papa  clem (USA) ")).toBe("PAPA CLEM (USA)"); expect(pedAnahtar("")).toBeNull(); expect(pedAnahtar(null)).toBeNull(); expect(mesafeBandi(1300)).toBe("K"); expect(mesafeBandi(1400)).toBe("O"); expect(mesafeBandi(1900)).toBe("O"); expect(mesafeBandi(2000)).toBe("U"); expect(pedGrup("K", 1600)).toBe("K|O"); });
  it("formül: P̂ = (W + k·P_g)/(N + k), artık = P̂ − P_g (hedef atın kendisi YOK)", () => {
    const l = taban(); const d = new PedigriDeposu(l).gorunum(T); const s = pedSatir(d, "SIRE", "S1", GR, 9999, 10); const W = l.filter((r) => r.sire === "S1" && r.kazandi === 1).length, N = l.filter((r) => r.sire === "S1").length; const pg = l.filter((r) => r.kazandi === 1).length / l.length;
    expect(s.w).toBe(W); expect(s.n).toBe(N); expect(s.pg).toBeCloseTo(pg, 12); expect(s.phat!).toBeCloseTo((W + 10 * pg) / (N + 10), 12); expect(s.artik!).toBeCloseTo(s.phat! - pg, 12);
  });
  it("KENDİ STARTLARI ÇIKARILIR: aynı atın geçmişi hat istatistiğine girmez (W, N ve P_g'den)", () => {
    const l = taban(); const d = new PedigriDeposu(l).gorunum(T); const baba = pedSatir(d, "SIRE", "S1", GR, 3, 10); const tum = pedSatir(d, "SIRE", "S1", GR, 9999, 10); // at 3: S1 yavrusu, kazandi=1
    expect(baba.n).toBe(tum.n - 1); expect(baba.w).toBe(tum.w - 1); expect(baba.kendiCikarilan).toBe(1); expect(baba.pgN).toBe(99);
  });
  it("hat anahtarı yoksa NULL; P_g için yeterli start yoksa NULL (sıfır değil)", () => {
    const d = new PedigriDeposu(taban()).gorunum(T); expect(pedSatir(d, "DAM", null, GR, 1, 10).phat).toBeNull(); const az = new PedigriDeposu(taban().slice(0, PED_MIN_PG_N - 5)).gorunum(T); expect(pedSatir(az, "SIRE", "S1", GR, 9999, 10).phat).toBeNull();
    expect(pedSatir(d, "SIRE", "YOK", GR, 9999, 10).phat!).toBeCloseTo(d.toplam("*|*|" + GR).w / d.toplam("*|*|" + GR).n, 12); // bilinmeyen hat: P̂ = P_g, artık 0
  });
  it("as-of: yarış günü (tarih = t) ve sonrası kullanılmaz", () => {
    const l = [...taban(), pk(500, 100, 1, "S1", "DX", "MX"), pk(501, 101, 1, "S1", "DY", "MY")]; const d = new PedigriDeposu(l).gorunum(T); expect(d.toplam("SIRE|S1|" + GR).n).toBe(10); expect(d.toplam("*|*|" + GR).n).toBe(100);
  });
  it("SIZINTI: t ve sonrası bozulunca (aynı gün ve sonrasına sahte yavru startlar dahil) değerler BİREBİR aynı", () => {
    const l = taban(); for (let i = 0; i < 30; i++) l.push(pk(200 + i, 100 + (i % 4), i % 2 === 0 ? 1 : 0, "S1", "D" + i, "M" + (i % 5))); const dep = new PedigriDeposu(l); const x = dep.gorunum(T), y = dep.gelecegiBoz(T, 7).gorunum(T);
    for (const hat of ["SIRE", "DAM", "DAMSIRE"] as const) for (const [a, id] of [["S1", 3], ["D3", 3], ["M1", 8], ["S4", 40]] as [string, number][]) for (const k of [10, 30]) expect(pedSatir(y, hat, a, GR, id, k)).toEqual(pedSatir(x, hat, a, GR, id, k));
  });
  it("bağımsız yeniden hesap: düz döngü ile aynı (kendi startları çıkarılmış)", () => {
    const l: PedKayit[] = []; for (let i = 0; i < 300; i++) l.push(pk(i % 120, 1 + ((i * 7) % 150), (i * 13) % 6 === 0 ? 1 : 0, "S" + (i % 9), "D" + (i % 40), "M" + (i % 11), i % 3 ? GR : "Ç|U")); const g = new PedigriDeposu(l).gorunum(T);
    for (const [hat, a, id, grup] of [["SIRE", "S2", 5, GR], ["DAM", "D3", 7, GR], ["DAMSIRE", "M4", 11, "Ç|U"], ["SIRE", "S0", 119, GR]] as ["SIRE" | "DAM" | "DAMSIRE", string, number, string][]) {
      let W = 0, N = 0, GW = 0, GN = 0; for (const r of l) { if (r.tarih >= T || r.grup !== grup || r.atId === id) continue; GN++; GW += r.kazandi; const k = hat === "SIRE" ? r.sire : hat === "DAM" ? r.dam : r.damSire; if (k === a) { N++; W += r.kazandi; } }
      const bek = (W + 20 * (GW / GN)) / (N + 20); expect(pedSatir(g, hat, a, grup, id, 20).phat!).toBeCloseTo(bek, 12);
    }
  });
  it("yapısal: saf dosya (db/ağ/saat/rastgele/sonuç import ETMEZ)", () => {
    const kod = fs.readFileSync(path.join(__dirname, "pedigri-aday.ts"), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n"); expect(/from\s+["']/.test(kod)).toBe(false); expect(/\bDate\b|Math\.random|fetch\(|prisma|\bdb\b|process\.|winner|result|ganyan/.test(kod)).toBe(false);
  });
});
