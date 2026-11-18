import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { AGF_SAAT_MS, agfGelecegiBoz, agfOzellik, yarisBaslangicUtc, type AgfNokta } from "./agf-trend-aday";
import { SINYAL_KAYDI } from "../sinyal-kaydi";

const S = AGF_SAAT_MS; const B = 100 * S; const nk = (saatOnce: number, agf: number): AgfNokta => ({ t: B - saatOnce * S, agf });
describe("AGF_TREND araştırma hesabı", () => {
  it("SINYAL_KAYDI hâlâ BOŞ", () => { expect(SINYAL_KAYDI.length).toBe(0); });
  it("trend = son − ilk (puan), seviye = ln(son), göreli = ln(son/ilk)", () => {
    const o = agfOzellik([nk(30, 16), nk(20, 15), nk(5, 14)], B); expect(o.n).toBe(3); expect(o.ilk).toBe(16); expect(o.son).toBe(14); expect(o.trend).toBeCloseTo(-2, 9); expect(o.seviye).toBeCloseTo(Math.log(14), 9); expect(o.trendG).toBeCloseTo(Math.log(14 / 16), 9); expect(o.sonGecikmeSaat).toBeCloseTo(5, 9);
  });
  it("tek kesitte trend NULL (sıfır değil); hiç kesit yoksa her şey NULL", () => {
    const o = agfOzellik([nk(5, 10)], B); expect(o.trend).toBeNull(); expect(o.trendG).toBeNull(); expect(o.seviye).toBeCloseTo(Math.log(10)); const e = agfOzellik([], B); expect(e.n).toBe(0); expect(e.seviye).toBeNull(); expect(e.trend).toBeNull();
  });
  it("başlangıç anı ve sonrası kullanılmaz (kesin t < başlangıç)", () => {
    const o = agfOzellik([nk(10, 12), nk(0, 99), { t: B + S, agf: 80 }], B); expect(o.n).toBe(1); expect(o.son).toBe(12);
  });
  it("erken trend: başlangıçtan ≥ erkenSaat önceki son kesit − ilk; yetersizse NULL", () => {
    const o = agfOzellik([nk(30, 10), nk(10, 12), nk(1, 20)], B, 2); expect(o.trendE).toBeCloseTo(2); expect(o.nErken).toBe(2); expect(agfOzellik([nk(30, 10), nk(1, 20)], B, 2).trendE).toBeNull();
  });
  it("AGF 0/negatif için log tabanlı değerler NULL", () => { const o = agfOzellik([nk(10, 5), nk(2, 0)], B); expect(o.seviye).toBeNull(); expect(o.trendG).toBeNull(); expect(o.trend).toBeCloseTo(-5); });
  it("yarisBaslangicUtc: TR duvar saati UTC+3; bozuk saat null", () => {
    const g = Date.UTC(2026, 10, 17); expect(yarisBaslangicUtc(g, "14:30")).toBe(g + 11.5 * S); expect(yarisBaslangicUtc(g, "00:30")).toBe(g - 2.5 * S); expect(yarisBaslangicUtc(g, null)).toBeNull(); expect(yarisBaslangicUtc(g, "25:00")).toBeNull(); expect(yarisBaslangicUtc(g, "abc")).toBeNull();
  });
  it("SIZINTI: başlangıç ve sonrası bozulunca/sahte kesit eklenince özellikler BİREBİR aynı", () => {
    const l: AgfNokta[] = []; for (let i = 0; i < 12; i++) l.push(nk(40 - i * 3, 5 + ((i * 7) % 11))); l.push(nk(0, 30), { t: B + 2 * S, agf: 40 });
    for (const es of [1, 2, 3]) expect(agfOzellik(agfGelecegiBoz(l, B, 9), B, es)).toEqual(agfOzellik(l, B, es));
  });
  it("bağımsız yeniden hesap (düz döngü)", () => {
    const l: AgfNokta[] = []; for (let i = 0; i < 15; i++) l.push({ t: B - (50 - i * 3.3) * S, agf: 3 + ((i * 13) % 17) }); let ilk = NaN, son = NaN, tIlk = Infinity, tSon = -Infinity; for (const x of l) if (x.t < B) { if (x.t < tIlk) { tIlk = x.t; ilk = x.agf; } if (x.t > tSon) { tSon = x.t; son = x.agf; } } const o = agfOzellik(l, B); expect(o.trend).toBeCloseTo(son - ilk, 9);
  });
  it("yapısal: saf dosya (db/ağ/saat/rastgele/sonuç import ETMEZ)", () => {
    const kod = fs.readFileSync(path.join(__dirname, "agf-trend-aday.ts"), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n"); expect(/from\s+["']/.test(kod)).toBe(false); expect(/\bDate\b|Math\.random|fetch\(|prisma|\bdb\b|process\.|winner|result|ganyan/.test(kod)).toBe(false);
  });
});
