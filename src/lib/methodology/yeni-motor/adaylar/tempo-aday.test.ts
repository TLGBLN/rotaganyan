import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { TEMPO_GUN_MS, TempoDeposu, tempoBilesenleri, tempoNormalize, type TempoHam, type TempoKaydi } from "./tempo-aday";
import { SINYAL_KAYDI } from "../sinyal-kaydi";

const T0 = Date.UTC(2026, 8, 1);
const kayit = (id: string, atId: number, gun: number, v: number | null, s: number | null): TempoKaydi => ({ yarisId: id, atId, tarih: T0 + gun * TEMPO_GUN_MS, hip: "BURSA", irk: "INGILIZ", yuzey: "KUM", mesafe: 1300, sahaN: 10, t200: v == null ? null : 14, t600: v == null ? null : 14 + 400 / v, v, r200: 3, r400: 3, r600: 3, s });
const sentetik = () => { const l: TempoKaydi[] = []; let q = 13; const r = () => (q = (q * 1664525 + 1013904223) % 4294967296) / 4294967296; for (let a = 1; a <= 50; a++) for (let k = 0; k < 4; k++) l.push(kayit(`y${a}-${k}`, a, k * 6 + Math.floor(r() * 3), 14 + r() * 2, r())); return l; };

describe("TEMPO adayı (ERKEN_HIZ + KOSU_STILI; aktif sinyal DEĞİL)", () => {
  it("SINYAL_KAYDI hâlâ BOŞ", () => { expect(SINYAL_KAYDI.length).toBe(0); });
  it("formüller: V = 400/(T600−T200); S = 1 − (1/3)Σ(R−1)/(N−1)", () => {
    const ham: TempoHam = { yarisId: "x", atId: 1, tarih: T0, hip: "BURSA", irk: "INGILIZ", yuzey: "KUM", mesafe: 1300, sahaN: 10, siraGecerli: true, kontrol: [{ m: 100, ms: 8000, place: 5 }, { m: 200, ms: 14000, place: 1 }, { m: 400, ms: 28000, place: 4 }, { m: 600, ms: 42000, place: 10 }, { m: 1300, ms: 90000, place: 5 }] };
    const k = tempoNormalize(ham).kayit!; expect(k.v).toBeCloseTo(400 / 28); // (42−14)=28 sn → 14,2857 m/s
    expect(k.s).toBeCloseTo(1 - (0 / 9 + 3 / 9 + 9 / 9) / 3);
    expect(tempoNormalize({ ...ham, siraGecerli: false }).kayit!.s).toBeNull(); expect(tempoNormalize({ ...ham, sahaN: 3 }).kayit!.s).toBeNull();
    expect(tempoNormalize({ ...ham, kontrol: [{ m: 200, ms: 14000, place: 1 }, { m: 400, ms: 12000, place: 1 }] }).red).toMatch(/monoton/);
    expect(tempoNormalize({ ...ham, mesafe: 500 }).red).toMatch(/600/); expect(tempoNormalize({ ...ham, yuzey: null }).red).toMatch(/zemin/);
  });
  it("SIZINTI: t ve sonrası bozulunca (aynı gün sahte dahil) bileşenler BİREBİR aynı", () => {
    const d = new TempoDeposu(sentetik()); const t = T0 + 20 * TEMPO_GUN_MS; const b = d.gelecegiBoz(t, 9); let dolu = 0;
    for (let a = 1; a <= 50; a++) { const x = tempoBilesenleri(d.gorunum(t), a), y = tempoBilesenleri(b.gorunum(t), a); expect(y).toEqual(x); if (x.erkenHiz != null && x.stil != null) dolu++; }
    expect(dolu).toBeGreaterThan(20);
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
