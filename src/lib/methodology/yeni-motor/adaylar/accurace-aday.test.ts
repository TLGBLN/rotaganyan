import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ACC_GUN_MS, AccDeposu, accBilesenleri, accNormalize, type AccHam, type AccKaydi } from "./accurace-aday";
import { SINYAL_KAYDI } from "../sinyal-kaydi";

const T0 = Date.UTC(2026, 8, 1);
const kayit = (id: string, atId: number, gun: number, sure: number, erken: number | null, yuzey: AccKaydi["yuzey"] = "KUM", mesafe = 1300): AccKaydi => ({ yarisId: id, atId, tarih: T0 + gun * ACC_GUN_MS, hip: "BURSA", irk: "INGILIZ", yuzey, mesafe, sure, erken, erkenTahmin: false, son800: erken == null ? null : sure - erken });
const sentetik = () => {
  const l: AccKaydi[] = []; let s = 11; const r = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (let a = 1; a <= 50; a++) for (let k = 0; k < 4; k++) { const erken = 30 + r() * 4; const sure = 80 + r() * 6; l.push(kayit(`y${a}-${k}`, a, k * 6 + Math.floor(r() * 3), sure, sure - 50 - (erken - 30) * 0.6 - r())); }
  return l;
};

describe("ACCURACE adayı (aktif sinyal DEĞİL)", () => {
  it("SINYAL_KAYDI: kullanıcı onaylı beş aile (bu aday modül ayrıca yalnız araştırma amaçlıdır)", () => { expect(SINYAL_KAYDI.length).toBe(5); });
  it("normalleştirme: 800 m ayrımı, tahmin işareti, monotonluk", () => {
    const ham = (kontrol: { m: number; ms: number }[]): AccHam => ({ yarisId: "x", atId: 1, tarih: T0, hip: "BURSA", irk: "INGILIZ", yuzey: "KUM", mesafe: 1300, sureMs: 84000, kontrol });
    const tam = accNormalize(ham([{ m: 400, ms: 25000 }, { m: 500, ms: 31000 }, { m: 600, ms: 37000 }, { m: 1300, ms: 84000 }])).kayit!; expect(tam.erken).toBeCloseTo(31); expect(tam.son800).toBeCloseTo(53); expect(tam.erkenTahmin).toBe(false);
    const tah = accNormalize(ham([{ m: 400, ms: 25000 }, { m: 600, ms: 37000 }, { m: 1300, ms: 84000 }])).kayit!; expect(tah.erken).toBeCloseTo(31); expect(tah.erkenTahmin).toBe(true);
    expect(accNormalize(ham([{ m: 400, ms: 40000 }, { m: 500, ms: 31000 }, { m: 1300, ms: 84000 }])).red).toMatch(/monoton/);
    expect(accNormalize({ ...ham([]), yuzey: null }).red).toMatch(/zemin/); expect(accNormalize({ ...ham([]), atId: null }).red).toMatch(/ata/);
    expect(accNormalize({ ...ham([{ m: 100, ms: 8000 }]), mesafe: 900, sureMs: 60000 }).kayit!.son800).toBeNull(); // <1000 m: bitiriş hesaplanmaz
  });
  it("SIZINTI: t ve sonrası bozulunca (aynı gün sahte kayıt dahil) bileşenler BİREBİR aynı", () => {
    const k = sentetik(); const d = new AccDeposu(k); const t = T0 + 20 * ACC_GUN_MS; const b = d.gelecegiBoz(t, 5); let dolu = 0;
    for (let a = 1; a <= 50; a++) { const x = accBilesenleri(d.gorunum(t), a, "KUM"), y = accBilesenleri(b.gorunum(t), a, "KUM"); expect(y).toEqual(x); if (x.accHiz != null && x.accBitiris != null) dolu++; }
    expect(dolu).toBeGreaterThan(20);
  });
  it("hedef günün kaydı (yarışın kendisi) görünmez", () => {
    const t = T0 + 10 * ACC_GUN_MS; const d = new AccDeposu([kayit("a", 7, 5, 84, 31), kayit("hedef", 7, 10, 80, 29)]); expect(d.gorunum(t).atKayitlari(7).map((x) => x.yarisId)).toEqual(["a"]);
  });
  it("zemin karıştırılmaz; eksik veri null (0 puan değil)", () => {
    const k = sentetik(); k.push(kayit("cim", 999, 3, 80, 30, "CIM")); const d = new AccDeposu(k); const b = accBilesenleri(d.gorunum(T0 + 20 * ACC_GUN_MS), 999, "KUM");
    expect(b.accHiz).toBeNull(); expect(b.accBitiris).toBeNull(); expect(b.yarislar[0]!.disla).toMatch(/zemin farklı/);
    expect(accBilesenleri(d.gorunum(T0 + 20 * ACC_GUN_MS), 123456, "KUM").accHiz).toBeNull();
  });
  it("yapısal: saf dosya (db/ağ/saat/rastgele/eski motor import ETMEZ)", () => {
    const kod = fs.readFileSync(path.join(__dirname, "accurace-aday.ts"), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    expect(/from\s+["']/.test(kod)).toBe(false); expect(/\bDate\b|Math\.random|fetch\(|prisma|\bdb\b|process\.|winner|result|kazan|ganyan/.test(kod)).toBe(false);
  });
});
