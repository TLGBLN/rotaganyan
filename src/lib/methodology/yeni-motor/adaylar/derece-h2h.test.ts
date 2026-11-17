import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DERECE_GUN_MS, DereceDeposu, dereceBilesenleri, type DereceKaydi } from "./derece-aday";
import { H2H_GUN_MS, H2H_SABITLERI, H2HDeposu, h2hCift, h2hNet, type H2HKayit } from "./h2h-aday";
import { SINYAL_KAYDI } from "../sinyal-kaydi";

const T = Date.UTC(2026, 10, 16);
const dk = (atId: number, gun: number, sure: number, hip = "BURSA", mesafe = 1400, yuzey = "K", irk: "INGILIZ" | "ARAP" = "INGILIZ"): DereceKaydi => ({ atId, tarih: T - gun * DERECE_GUN_MS, irk, yuzey, hip, mesafe, sure });
// referans grubu: 40 satır, süre 90.00 ± simetrik (ort. 90, sd bilinen)
const referans = () => { const l: DereceKaydi[] = []; for (let i = 0; i < 40; i++) l.push(dk(1000 + i, 100 + i, 90 + (i % 2 === 0 ? 1 : -1) * (1 + Math.floor(i / 2) * 0.1))); return l; };
const istat = () => { const t = referans().map((x) => x.sure); const mu = t.reduce((a, b) => a + b, 0) / t.length; const sd = Math.sqrt(t.reduce((s, x) => s + (x - mu) ** 2, 0) / (t.length - 1)); return { mu, sd }; };

describe("SON6 / HIZ_DERECESI (TJK resmî süre; aktif sinyal DEĞİL)", () => {
  it("SINYAL_KAYDI hâlâ BOŞ", () => { expect(SINYAL_KAYDI.length).toBe(0); });
  // Bağımsız hesap: grup = t'den önceki TÜM satırlar (atın kendi geçmişi dahil, aynı grup); Z = (μ−T)/σ
  const zler = (l: DereceKaydi[], at: number) => { const o = l.filter((x) => x.tarih < T); const t = o.map((x) => x.sure); const mu = t.reduce((p, q) => p + q, 0) / t.length; const sd = Math.sqrt(t.reduce((p, q) => p + (q - mu) ** 2, 0) / (t.length - 1)); return o.filter((x) => x.atId === at).sort((p, q) => q.tarih - p.tarih).map((x) => (mu - x.sure) / sd); };
  it("Z = (μ−T)/σ ve SON6 = (6Z1+5Z2+4Z3+3Z4+2Z5+Z6)/21 (Z1 = en son yarış)", () => {
    const l = [...referans(), ...[88.5, 90, 91.5, 87, 91.5, 90].map((s, i) => dk(1, 5 + i * 5, s))]; const r = dereceBilesenleri(new DereceDeposu(l).gorunum(T), 1); const z = zler(l, 1);
    r.yarislar.forEach((y, i) => expect(y.z).toBeCloseTo(z[i]!, 10));
    expect(r.son6).toBeCloseTo((6 * z[0]! + 5 * z[1]! + 4 * z[2]! + 3 * z[3]! + 2 * z[4]! + z[5]!) / 21, 10);
    expect(r.hizDerecesi).toBeCloseTo(([...z].sort((p, q) => q - p)[0]! + [...z].sort((p, q) => q - p)[1]!) / 2, 10); expect(r.guven).toMatchObject({ uygunToplam: 6, kullanilan: 6, tekYarisDusukGuven: false });
  });
  it("6'dan az yarış: ağırlıklar mevcut yarışlarda yeniden normalize (3 yarış → /15)", () => {
    const l = [...referans(), dk(1, 5, 88.5), dk(1, 10, 90), dk(1, 15, 91.5)]; const r = dereceBilesenleri(new DereceDeposu(l).gorunum(T), 1); const z = zler(l, 1);
    expect(r.son6).toBeCloseTo((6 * z[0]! + 5 * z[1]! + 4 * z[2]!) / 15, 10);
  });
  it("tek uygun yarış: değer o yarışın Z'si, düşük güven işaretli; hiç yoksa null (0 puan değil)", () => {
    const l = [...referans(), dk(1, 5, 88)]; const r = dereceBilesenleri(new DereceDeposu(l).gorunum(T), 1); const z = zler(l, 1); expect(r.son6).toBeCloseTo(z[0]!, 10); expect(r.hizDerecesi).toBeCloseTo(z[0]!, 10); expect(r.guven.tekYarisDusukGuven).toBe(true);
    const b = dereceBilesenleri(new DereceDeposu(referans()).gorunum(T), 999); expect(b.son6).toBeNull(); expect(b.hizDerecesi).toBeNull();
    const kucuk = dereceBilesenleri(new DereceDeposu([dk(1, 5, 90), dk(2, 6, 91)]).gorunum(T), 1); expect(kucuk.son6).toBeNull(); // referans grubu n<30 → uydurma yok
  });
  it("HIZ_DERECESI son 6 içinden en iyi 2'nin ortalaması (7. yarış hesaba girmez)", () => {
    const l = [...referans(), dk(1, 100, 70), ...[89, 91, 89.5, 91, 90.5, 92].map((s, i) => dk(1, 5 + i * 5, s))]; const r = dereceBilesenleri(new DereceDeposu(l).gorunum(T), 1);
    const z = zler(l, 1).slice(0, 6).sort((p, q) => q - p); expect(r.yarislar.length).toBe(6); expect(r.hizDerecesi).toBeCloseTo((z[0]! + z[1]!) / 2, 10);
  });
  it("as-of: yarış günü ve sonrası satırlar hiçbir yerde (ne geçmiş ne referans) kullanılmaz", () => {
    const { mu, sd } = istat(); const l = [...referans(), dk(1, 5, mu), dk(1, 0, mu - 3 * sd), dk(1, -3, mu - 3 * sd)]; const r = dereceBilesenleri(new DereceDeposu(l).gorunum(T), 1); expect(r.yarislar.length).toBe(1);
  });
  it("SIZINTI: t ve sonrası bozulunca (aynı gün sahte dahil) değerler BİREBİR aynı", () => {
    const { mu, sd } = istat(); const l = [...referans()]; for (let a = 1; a <= 15; a++) for (let k = 0; k < 8; k++) l.push(dk(a, 10 + k * 7 - (k > 5 ? 20 : 0), mu + ((a * 7 + k * 3) % 5 - 2) * sd * 0.5)); const d = new DereceDeposu(l); const x = d.gorunum(T), y = d.gelecegiBoz(T, 5).gorunum(T);
    for (let a = 1; a <= 15; a++) expect(dereceBilesenleri(y, a)).toEqual(dereceBilesenleri(x, a));
  });
  it("yapısal: saf dosya (db/ağ/saat/rastgele/sonuç import ETMEZ)", () => {
    const kod = fs.readFileSync(path.join(__dirname, "derece-aday.ts"), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n"); expect(/from\s+["']/.test(kod)).toBe(false); expect(/\bDate\b|Math\.random|fetch\(|prisma|\bdb\b|process\.|winner|result|ganyan|accurace/i.test(kod)).toBe(false);
  });
});

const hk = (yarisKey: string, atId: number, gun: number, sira: number, yuzey = "K", mesafe = 1400): H2HKayit => ({ yarisKey, atId, tarih: T - gun * H2H_GUN_MS, sira, yuzey, mesafe });
describe("H2H_NET_SKOR (aktif sinyal DEĞİL)", () => {
  const hedef = { yuzey: "K", mesafe: 1400 };
  it("H2H_{h,j} = Σw·X/(Σw+λ): bugün ortak koşulda; w = 0,5^(gün/90) (benzerlik 1)", () => {
    const l = [hk("r1", 1, 0.0001, 2), hk("r1", 2, 0.0001, 5), hk("r2", 1, 90, 3), hk("r2", 2, 90, 1)]; const c = h2hCift(new H2HDeposu(l).gorunum(T), 1, 2, hedef);
    const w1 = Math.pow(0.5, 0.0001 / 90), w2 = 0.5; expect(c.n).toBe(2); expect(c.deger).toBeCloseTo((w1 * 1 + w2 * -1) / (w1 + w2 + H2H_SABITLERI.lambda)); expect(c.galibiyet).toBe(1); expect(c.maglubiyet).toBe(1);
  });
  it("eşit sıra → 0; ortak yarış yoksa NULL (sıfır değil); farklı yüzey/mesafe ağırlığı düşürür", () => {
    expect(h2hCift(new H2HDeposu([hk("r1", 1, 10, 3), hk("r1", 2, 10, 3)]).gorunum(T), 1, 2, hedef).deger).toBeCloseTo(0);
    expect(h2hCift(new H2HDeposu([hk("r1", 1, 10, 3), hk("r2", 2, 10, 3)]).gorunum(T), 1, 2, hedef).deger).toBeNull();
    const ayni = h2hCift(new H2HDeposu([hk("r1", 1, 10, 1), hk("r1", 2, 10, 4)]).gorunum(T), 1, 2, hedef), farkli = h2hCift(new H2HDeposu([hk("r1", 1, 10, 1, "Ç", 1400), hk("r1", 2, 10, 4, "Ç", 1400)]).gorunum(T), 1, 2, hedef);
    expect(farkli.deger!).toBeLessThan(ayni.deger!); expect(farkli.agirlikToplam).toBeCloseTo(ayni.agirlikToplam * H2H_SABITLERI.farkliYuzeyAgirlik);
  });
  it("az karşılaşmada λ aşırı puanı engeller: tek galibiyet 1'e değil < 1'e", () => { const c = h2hCift(new H2HDeposu([hk("r1", 1, 1, 1), hk("r1", 2, 1, 2)]).gorunum(T), 1, 2, hedef); expect(c.deger!).toBeLessThan(0.6); expect(c.deger!).toBeGreaterThan(0.4); });
  it("H2H_NET: yalnız ortak yarışı olan rakiplerin ortalaması; hiç yoksa null; veri olan rakip sayısı ayrı", () => {
    const l = [hk("a", 1, 5, 1), hk("a", 2, 5, 3), hk("b", 1, 5, 4), hk("b", 3, 5, 2)]; const g = new H2HDeposu(l).gorunum(T); const n = h2hNet(g, 1, [1, 2, 3, 4], hedef);
    expect(n.nRakip).toBe(2); expect(n.toplamRakip).toBe(3); const c12 = h2hCift(g, 1, 2, hedef).deger!, c13 = h2hCift(g, 1, 3, hedef).deger!; expect(n.deger).toBeCloseTo((c12 + c13) / 2);
    expect(h2hNet(g, 4, [1, 2, 3], hedef).deger).toBeNull();
  });
  it("as-of: yarış günü ve sonrası ortak yarışlar kullanılmaz", () => { const g = new H2HDeposu([hk("r1", 1, 0, 1), hk("r1", 2, 0, 5), hk("r2", 1, -3, 1), hk("r2", 2, -3, 5)]).gorunum(T); expect(h2hCift(g, 1, 2, hedef).deger).toBeNull(); });
  it("SIZINTI: t ve sonrası bozulunca (aynı gün sahte ortak yarışlar dahil) değerler BİREBİR aynı", () => {
    const l: H2HKayit[] = []; for (let r = 0; r < 30; r++) for (let a = 1; a <= 6; a++) l.push(hk("y" + r, a, 3 + r * 4 - (r > 24 ? 110 : 0), 1 + ((a * 5 + r * 3) % 6))); const d = new H2HDeposu(l); const x = d.gorunum(T), y = d.gelecegiBoz(T, 5).gorunum(T);
    for (let a = 1; a <= 6; a++) expect(h2hNet(y, a, [1, 2, 3, 4, 5, 6], hedef)).toEqual(h2hNet(x, a, [1, 2, 3, 4, 5, 6], hedef));
  });
  it("yapısal: saf dosya (db/ağ/saat/rastgele/sonuç import ETMEZ)", () => {
    const kod = fs.readFileSync(path.join(__dirname, "h2h-aday.ts"), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n"); expect(/from\s+["']/.test(kod)).toBe(false); expect(/\bDate\b|Math\.random|fetch\(|prisma|\bdb\b|process\.|winner|result|ganyan/.test(kod)).toBe(false);
  });
});
