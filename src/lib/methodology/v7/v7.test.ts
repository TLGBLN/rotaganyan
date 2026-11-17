import { describe, expect, it } from "vitest";
import { bosModelOlasiliklari, v7Durum } from "./bos-model";
import { bootstrapGA, kabulKarari } from "./ozellik-kabul";

// Deterministik sentetik kazanç: tutarlı pozitif, gürültü, kat-tutarsız
const tohumlu = (n: number, ort: number, sd: number, tohum = 3) => { let s = tohum; const r = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; return Array.from({ length: n }, () => ort + sd * (r() + r() + r() - 1.5) * 2); };
const katlar = (n: number, k = 5) => Array.from({ length: n }, (_, i) => i % k);

describe("V7 başlangıç modeli", () => {
  it("her ata 1/N; toplam 1; geçersiz N boş", () => { const p = bosModelOlasiliklari(8); expect(p).toHaveLength(8); expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12); expect(new Set(p).size).toBe(1); expect(bosModelOlasiliklari(0)).toEqual([]); });
  it("sinyalsiz motor ASLA yayınlanabilir değil; kabul edilmiş özellik + nihai doğrulama olmadan da değil", () => {
    expect(v7Durum(0, true).yayinlanabilir).toBe(false); expect(v7Durum(0, false).yayinlanabilir).toBe(false);
    expect(v7Durum(3, false).yayinlanabilir).toBe(false); expect(v7Durum(3, true).yayinlanabilir).toBe(true);
  });
});

describe("V7 özellik kabul protokolü", () => {
  it("tutarlı pozitif kazanç + as-of kanıtı → KABUL", () => { const g = tohumlu(1500, 0.01, 0.02); const s = kabulKarari({ kazanc: g, fold: katlar(g.length), asOfKaniti: true }); expect(s.kabul).toBe(true); expect(s.altGA).toBeGreaterThan(0); });
  it("as-of kanıtı yoksa ne kadar iyi görünürse görünsün REDDEDİLİR", () => { const g = tohumlu(1500, 0.05, 0.02); const s = kabulKarari({ kazanc: g, fold: katlar(g.length), asOfKaniti: false }); expect(s.kabul).toBe(false); expect(s.neden).toContain("as-of"); });
  it("gürültü (ortalama 0) REDDEDİLİR", () => { const g = tohumlu(1500, 0, 0.05, 11); const s = kabulKarari({ kazanc: g, fold: katlar(g.length), asOfKaniti: true }); expect(s.kabul).toBe(false); });
  it("ortalama pozitif ama yalnız tek katta → kararsız REDDEDİLİR", () => { const n = 2000; const fold = katlar(n); const g = tohumlu(n, 0, 0.01, 5).map((v, i) => (fold[i] === 0 ? v + 0.08 : v - 0.002)); const s = kabulKarari({ kazanc: g, fold, asOfKaniti: true, minKat: 3 }); expect(s.kabul).toBe(false); });
  it("test yarışı yoksa reddeder; bootstrap deterministik (aynı tohum aynı sonuç)", () => { expect(kabulKarari({ kazanc: [], fold: [], asOfKaniti: true }).kabul).toBe(false); const g = tohumlu(300, 0.01, 0.03); expect(bootstrapGA(g, 200, 9)).toEqual(bootstrapGA(g, 200, 9)); });
});
