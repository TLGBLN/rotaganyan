import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { KULVAR_GUN_MS, KulvarDeposu, kapiBolge, kapiNormal, kulvarEtki, kulvarGrup, type KulvarKayit, type KulvarYaris } from "./kulvar-aday";
import { SINYAL_KAYDI } from "../sinyal-kaydi";

const T = 100 * KULVAR_GUN_MS; const kk = (gun: number, grup: string, y: 0 | 1, p: number): KulvarKayit => ({ tarih: gun * KULVAR_GUN_MS, grup, y, p });
describe("KULVAR_ETKI aday hesabı", () => {
  it("SINYAL_KAYDI: kullanıcı onaylı beş aile (bu aday modül ayrıca yalnız araştırma amaçlıdır)", () => { expect(SINYAL_KAYDI.length).toBe(5); });
  it("formül: B = Σ(Y−P) / (ΣP(1−P) + λ), elle hesapla", () => {
    const l = [kk(10, "g", 1, 0.2), kk(20, "g", 0, 0.2), kk(30, "g", 0, 0.5), kk(40, "g", 1, 0.1)]; const e = kulvarEtki(new KulvarDeposu(l).gorunum(T), "g", 5);
    const sy = 2, sp = 1.0, sv = 0.16 + 0.16 + 0.25 + 0.09; expect(e.n).toBe(4); expect(e.deger!).toBeCloseTo((sy - sp) / (sv + 5), 12);
  });
  it("hiç geçmiş kayıt yoksa NULL (sıfır değil); grup null ise de NULL", () => {
    const g = new KulvarDeposu([kk(10, "g", 1, 0.2)]).gorunum(T); expect(kulvarEtki(g, "baska", 5).deger).toBeNull(); expect(kulvarEtki(g, null, 5).deger).toBeNull();
  });
  it("as-of: yarış günü (tarih = t) ve sonrası kullanılmaz, önceki gün kullanılır", () => {
    const l = [kk(99, "g", 1, 0.1), kk(100, "g", 1, 0.1), kk(101, "g", 1, 0.1)]; expect(kulvarEtki(new KulvarDeposu(l).gorunum(T), "g", 5).n).toBe(1);
  });
  it("λ az veriyi sıfıra çeker: n=1 galibiyet büyük değer vermez", () => { const e = kulvarEtki(new KulvarDeposu([kk(1, "g", 1, 0.1)]).gorunum(T), "g", 20); expect(e.deger!).toBeLessThan(0.05); expect(e.deger!).toBeGreaterThan(0); });
  it("SIZINTI: t ve sonrası bozulunca (aynı gün sahte kayıtlar dahil) değerler BİREBİR aynı", () => {
    const l: KulvarKayit[] = []; for (let r = 0; r < 300; r++) l.push(kk(1 + (r % 160), "g" + (r % 5), r % 7 === 0 ? 1 : 0, 0.05 + (r % 9) / 40)); const d = new KulvarDeposu(l); const x = d.gorunum(T), y = d.gelecegiBoz(T, 7).gorunum(T);
    for (let g = 0; g < 6; g++) for (const lam of [5, 20]) expect(kulvarEtki(y, "g" + g, lam)).toEqual(kulvarEtki(x, "g" + g, lam));
  });
  it("bağımsız yeniden hesap: düz döngü ile aynı", () => {
    const l: KulvarKayit[] = []; for (let r = 0; r < 400; r++) l.push(kk(1 + ((r * 7) % 150), "g" + (r % 4), (r * 13) % 11 === 0 ? 1 : 0, 0.03 + ((r * 5) % 17) / 60)); const g = new KulvarDeposu(l).gorunum(T);
    for (let q = 0; q < 4; q++) { let sy = 0, sp = 0, sv = 0, n = 0; for (const k of l) if (k.grup === "g" + q && k.tarih < T) { sy += k.y; sp += k.p; sv += k.p * (1 - k.p); n++; } expect(kulvarEtki(g, "g" + q, 10).deger!).toBeCloseTo((sy - sp) / (sv + 10), 12); expect(kulvarEtki(g, "g" + q, 10).n).toBe(n); }
  });
  it("K_h: fiziksel kapı normalizasyonu; geçersiz kapı null", () => {
    expect(kapiNormal(1, 10)).toBe(0); expect(kapiNormal(10, 10)).toBe(1); expect(kapiNormal(4, 7)).toBeCloseTo(0.5); expect(kapiNormal(null, 10)).toBeNull(); expect(kapiNormal(11, 10)).toBeNull(); expect(kapiNormal(1, 1)).toBeNull(); expect(kapiBolge(0.1)).toBe("ic"); expect(kapiBolge(0.5)).toBe("orta"); expect(kapiBolge(0.9)).toBe("dis");
  });
  it("grup anahtarları: kapı bilinmiyorsa null; V1 saha bandı ve kapıyı içerir; at numarası kullanılmaz", () => {
    const y: KulvarYaris = { hip: "Bursa", yuzey: "KUM", mesafe: 1400, n: 9, kapi: 3, nKapi: 12 };
    expect(kulvarGrup("V1", { ...y, kapi: null })).toBeNull(); expect(kulvarGrup("V1", y)).toBe("Bursa|KUM|1400|s2|3"); expect(kulvarGrup("V2", y)).toBe("Bursa|KUM|1400|3"); expect(kulvarGrup("V3", y)).toBe("Bursa|KUM|orta|ic"); expect(kulvarGrup("V4", y)).toBe("KUM|orta|s2|ic");
  });
  it("yapısal: saf dosya (db/ağ/saat/rastgele/sonuç import ETMEZ)", () => {
    const kod = fs.readFileSync(path.join(__dirname, "kulvar-aday.ts"), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n"); expect(/from\s+["']/.test(kod)).toBe(false); expect(/\bDate\b|Math\.random|fetch\(|prisma|\bdb\b|process\.|winner|result|ganyan/.test(kod)).toBe(false);
  });
});
