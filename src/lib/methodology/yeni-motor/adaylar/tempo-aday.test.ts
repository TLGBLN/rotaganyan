import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { TEMPO_GUN_MS, TempoDeposu, liderlikBaskisi, tempoBilesenleri, tempoNormalize, type TempoHam, type TempoKaydi } from "./tempo-aday";
import { SINYAL_KAYDI } from "../sinyal-kaydi";

const T0 = Date.UTC(2026, 8, 1);
const kayit = (id: string, atId: number, gun: number, v: number | null, s: number | null, onGrup: boolean | null = false): TempoKaydi => ({ yarisId: id, atId, tarih: T0 + gun * TEMPO_GUN_MS, hip: "BURSA", irk: "INGILIZ", yuzey: "KUM", mesafe: 1300, sahaN: 10, t200: v == null ? null : 14, t600: v == null ? null : 14 + 400 / v, v, r200: 3, r400: 3, r600: 3, s, onGrup, onGrupHepsi: onGrup });
const sentetik = () => { const l: TempoKaydi[] = []; let q = 13; const r = () => (q = (q * 1664525 + 1013904223) % 4294967296) / 4294967296; for (let a = 1; a <= 50; a++) for (let k = 0; k < 4; k++) l.push(kayit(`y${Math.floor((a - 1) / 5)}-${k}`, a, k * 6 + Math.floor(r() * 3), 14 + r() * 2, r(), r() < 0.5)); return l; };

describe("TEMPO adayı (ERKEN_HIZ + KOSU_STILI + LIDERLIK_BASKISI; aktif sinyal DEĞİL)", () => {
  it("SINYAL_KAYDI hâlâ BOŞ", () => { expect(SINYAL_KAYDI.length).toBe(0); });
  it("formüller: V = 400/(T600−T200); S (N = gerçek saha); ön grup = sıra ≤ max(2, ⌈0.2N⌉)", () => {
    const ham: TempoHam = { yarisId: "x", atId: 1, tarih: T0, hip: "BURSA", irk: "INGILIZ", yuzey: "KUM", mesafe: 1300, sahaN: 10, siraGecerli: true, kontrol: [{ m: 100, ms: 8000, place: 5 }, { m: 200, ms: 14000, place: 1 }, { m: 400, ms: 28000, place: 4 }, { m: 600, ms: 42000, place: 10 }, { m: 1300, ms: 90000, place: 5 }] };
    const k = tempoNormalize(ham).kayit!; expect(k.v).toBeCloseTo(400 / 28); expect(k.s).toBeCloseTo(1 - (0 / 9 + 3 / 9 + 9 / 9) / 3); expect(k.onGrup).toBe(true); expect(k.onGrupHepsi).toBe(false); // R200=1 ≤ 2
    const geride = tempoNormalize({ ...ham, kontrol: ham.kontrol.map((c) => (c.m === 200 ? { ...c, place: 5 } : c.m === 400 ? { ...c, place: 6 } : c.m === 600 ? { ...c, place: 7 } : c)) }).kayit!; expect(geride.onGrup).toBe(false);
    const buyuk = tempoNormalize({ ...ham, sahaN: 16, kontrol: ham.kontrol.map((c) => (c.m === 200 ? { ...c, place: 4 } : c)) }).kayit!; expect(buyuk.onGrup).toBe(true); // ⌈0.2·16⌉ = 4
    expect(tempoNormalize({ ...ham, siraGecerli: false }).kayit!.s).toBeNull(); expect(tempoNormalize({ ...ham, sahaN: 3 }).kayit!.s).toBeNull(); expect(tempoNormalize({ ...ham, sahaN: 9 }).kayit!.s).toBeNull(); // sıra 10 > saha 9
    expect(tempoNormalize({ ...ham, kontrol: [{ m: 200, ms: 14000, place: 1 }, { m: 400, ms: 12000, place: 1 }] }).red).toMatch(/monoton/);
    expect(tempoNormalize({ ...ham, mesafe: 500 }).red).toMatch(/600/); expect(tempoNormalize({ ...ham, yuzey: null }).red).toMatch(/zemin/);
  });
  it("P_öncü = (1+k)/(2+n); veri yoksa önsel 0.5 işaretli", () => {
    const d = new TempoDeposu([kayit("a", 1, 1, 15, 0.5, true), kayit("b", 1, 2, 15, 0.5, false), kayit("c", 1, 3, 15, 0.5, true), kayit("d", 1, 4, 15, 0.5, true)]);
    const g = d.gorunum(T0 + 10 * TEMPO_GUN_MS); const b = tempoBilesenleri(g, 1); expect(b.pOncu).toMatchObject({ k: 2, n: 3 }); expect(b.pOncu.p).toBeCloseTo(3 / 5); // son 3 (b,c,d): 2 ön grup
    const hic = tempoBilesenleri(g, 999).pOncu; expect(hic.p).toBe(0.5); expect(hic.veriYok).toBe(true);
  });
  it("B_h = Σ P_j·σ((V_j−V_h)/τ); bilinmeyen V toplama girmez", () => {
    const s = (x: number) => 1 / (1 + Math.exp(-x)); const r = liderlikBaskisi([{ v: 80, p: 0.6 }, { v: 60, p: 0.4 }, { v: null, p: 0.5 }], 10);
    expect(r[0]!.baski).toBeCloseTo(0.4 * s(-2)); expect(r[1]!.baski).toBeCloseTo(0.6 * s(2)); expect(r[2]!.baski).toBeNull(); expect(r[0]).toMatchObject({ bilinenRakip: 1, toplamRakip: 2 });
  });
  it("τ = benzer yarışlardaki atlar arası yüzdelik farkların medyanı", () => {
    const l: TempoKaydi[] = []; for (let y = 0; y < 12; y++) [15, 16, 17, 18].forEach((v, i) => l.push(kayit(`r${y}`, 100 + y * 4 + i, y, v, 0.5)));
    const t = new TempoDeposu(l).gorunum(T0 + 30 * TEMPO_GUN_MS).tau({ irk: "INGILIZ", yuzey: "KUM", hip: "BURSA", mesafe: 1300 }); expect(t).not.toBeNull(); expect(t!.tau).toBeCloseTo(37.5); expect(t!.nYaris).toBe(12);
    expect(new TempoDeposu(l.slice(0, 20)).gorunum(T0 + 30 * TEMPO_GUN_MS).tau({ irk: "INGILIZ", yuzey: "KUM", hip: "BURSA", mesafe: 1300 })).toBeNull(); // <30 üye / <10 yarış → bilinmiyor
  });
  it("SIZINTI: t ve sonrası bozulunca (aynı gün sahte dahil) bileşenler, P_öncü ve τ BİREBİR aynı", () => {
    const d = new TempoDeposu(sentetik()); const t = T0 + 20 * TEMPO_GUN_MS; const b = d.gelecegiBoz(t, 9); let dolu = 0; const h = { irk: "INGILIZ", yuzey: "KUM", hip: "BURSA", mesafe: 1300 };
    for (let a = 1; a <= 50; a++) { const x = tempoBilesenleri(d.gorunum(t), a), y = tempoBilesenleri(b.gorunum(t), a); expect(y).toEqual(x); if (x.erkenHiz != null && x.stil != null) dolu++; }
    expect(d.gorunum(t).tau(h)).toEqual(b.gorunum(t).tau(h)); expect(dolu).toBeGreaterThan(20);
  });
  it("hedef günün kaydı görünmez; veri yoksa null (0 puan değil)", () => {
    const t = T0 + 10 * TEMPO_GUN_MS; const d = new TempoDeposu([kayit("a", 7, 5, 15, 0.5), kayit("hedef", 7, 10, 16, 0.9)]); expect(d.gorunum(t).atKayitlari(7).map((x) => x.yarisId)).toEqual(["a"]);
    const b = tempoBilesenleri(new TempoDeposu(sentetik()).gorunum(T0 + 20 * TEMPO_GUN_MS), 999); expect(b.erkenHiz).toBeNull(); expect(b.stil).toBeNull();
  });
  it("yapısal: saf dosya (db/ağ/saat/rastgele/eski motor/sonuç import ETMEZ)", () => {
    const kod = fs.readFileSync(path.join(__dirname, "tempo-aday.ts"), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    expect(/from\s+["']/.test(kod)).toBe(false); expect(/\bDate\b|Math\.random|fetch\(|prisma|\bdb\b|process\.|winner|result|kazan|ganyan|raceStyle/.test(kod)).toBe(false);
  });
});
