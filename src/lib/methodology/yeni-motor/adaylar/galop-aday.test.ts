import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { GUN_MS, GalopDeposu, galopBilesenleri, galopNormalize, galopTekille, sureSn, type GalopKaydi } from "./galop-aday";
import { SINYAL_KAYDI } from "../sinyal-kaydi";

const T0 = Date.UTC(2026, 8, 1);
const g = (atId: number, gun: number, sure: number, son400: number, efor: number | null = 4, mesafe = 800): GalopKaydi => ({ atId, tarih: T0 + gun * GUN_MS, tur: "GALOP", pist: "KUM", icDis: "IC", efor, mesafe, sure, son400, irk: "INGILIZ", yasGrubu: "2", jokey: null });
const sentetik = () => {
  const l: GalopKaydi[] = []; let s = 7; const r = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (let a = 1; a <= 60; a++) for (let k = 0; k < 4; k++) { const sure = 50 + r() * 6; l.push(g(a, k * 5 + Math.floor(r() * 3), sure, 24.5 + (sure - 50) * 0.45 + r(), 1 + Math.floor(r() * 5))); }
  return l;
};

describe("GALOP adayı (aktif sinyal DEĞİL)", () => {
  it("SINYAL_KAYDI: kullanıcı onaylı beş aile (bu aday modül ayrıca yalnız araştırma amaçlıdır)", () => { expect(SINYAL_KAYDI.length).toBe(5); });
  it("süre ayrıştırma ve normalleştirme", () => {
    expect(sureSn("0.52.70")).toBeCloseTo(52.7); expect(sureSn("1.04.20")).toBeCloseTo(64.2); expect(sureSn("")).toBeNull();
    const n = galopNormalize({ atId: 1, tarih: T0, track: "Galop", form: "R", jokey: null, splits: { "400": "0.25.20", "800": "0.52.70", pist: "Kum", ic_dis: "İç" }, irk: "INGILIZ", yasGrubu: "2" });
    expect(n.kayit).toMatchObject({ mesafe: 800, tur: "GALOP", pist: "KUM", icDis: "IC", efor: 4, son400: 25.2 });
    expect(galopNormalize({ atId: 1, tarih: T0, track: "Galop", form: "R", jokey: null, splits: { "400": "0.50.00", "800": "0.40.00" }, irk: null, yasGrubu: null }).red).toBe("sure-monoton-degil");
    expect(galopNormalize({ atId: 1, tarih: T0, track: "Normal", form: "Rahat", jokey: null, splits: { "400": "0.25.00" }, irk: null, yasGrubu: null }).kayit?.tur).toBe("BILINMIYOR");
  });
  it("mükerrer idman tek sayılır", () => { expect(galopTekille([g(1, 1, 51, 25), g(1, 1, 51, 25), g(1, 2, 51, 25)]).length).toBe(2); });
  it("SIZINTI DENETİMİ: tarih ≥ t olan her şey bozulunca bileşenler BİREBİR aynı", () => {
    const gal = sentetik(); const gun = new Map<number, number[]>(); for (let a = 1; a <= 60; a++) gun.set(a, [T0 - 9 * GUN_MS, T0 + 30 * GUN_MS]);
    const d = new GalopDeposu(gal, gun); const t = T0 + 12 * GUN_MS; const b = d.gelecegiBoz(t, 11);
    let kontrol = 0, dolu = 0;
    for (let a = 1; a <= 60; a++) { const x = galopBilesenleri(d.gorunum(t), a), y = galopBilesenleri(b.gorunum(t), a); expect(y).toEqual(x); kontrol++; if (x.hiz != null) dolu++; }
    expect(kontrol).toBe(60); expect(dolu).toBeGreaterThan(20); // test BOŞ geçmesin: referanslı bileşen gerçekten hesaplanıyor
  });
  it("tek galoplu atta trend BİLİNMİYOR (kötü puan değil null)", () => {
    const gal = sentetik(); gal.push(g(999, 3, 52, 26)); const d = new GalopDeposu(gal, new Map([[999, [T0 - 5 * GUN_MS]]]));
    const bl = galopBilesenleri(d.gorunum(T0 + 12 * GUN_MS), 999); expect(bl.trend).toBeNull(); expect(bl.hiz).not.toBeNull();
  });
  it("yarış günündeki/sonraki galop görünmez", () => {
    const d = new GalopDeposu([g(5, 12, 50, 25), g(5, 13, 50, 25)], new Map()); const v = d.gorunum(T0 + 12 * GUN_MS);
    expect(v.atGalopu(5).length).toBe(0);
  });
  it("yapısal: saf dosya (db/ağ/saat/rastgele/eski motor import ETMEZ)", () => {
    const kod = fs.readFileSync(path.join(__dirname, "galop-aday.ts"), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    expect(/from\s+["']/.test(kod)).toBe(false); expect(/\bDate\b|Math\.random|fetch\(|prisma|\bdb\b|process\./.test(kod)).toBe(false);
  });
});
