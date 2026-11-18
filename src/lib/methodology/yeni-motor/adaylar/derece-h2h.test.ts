import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DERECE_GUN_MS, DereceDeposu, dereceBilesenleri, type DereceKaydi } from "./derece-aday";
import { H2H_GUN_MS, H2HDeposu, h2hCift, h2hNet, h2hNetCoklu, type H2HKayit } from "./h2h-aday";
import { SINYAL_KAYDI } from "../sinyal-kaydi";

const T = Date.UTC(2026, 10, 16);
const dk = (atId: number, gun: number, sure: number, hip = "BURSA", mesafe = 1400, yuzey = "K", irk: "INGILIZ" | "ARAP" = "INGILIZ"): DereceKaydi => ({ atId, tarih: T - gun * DERECE_GUN_MS, irk, yuzey, hip, mesafe, sure });
// referans grubu: 40 satır, süre 90.00 ± simetrik (ort. 90, sd bilinen)
const referans = () => { const l: DereceKaydi[] = []; for (let i = 0; i < 40; i++) l.push(dk(1000 + i, 100 + i, 90 + (i % 2 === 0 ? 1 : -1) * (1 + Math.floor(i / 2) * 0.1))); return l; };
const istat = () => { const t = referans().map((x) => x.sure); const mu = t.reduce((a, b) => a + b, 0) / t.length; const sd = Math.sqrt(t.reduce((s, x) => s + (x - mu) ** 2, 0) / (t.length - 1)); return { mu, sd }; };

describe("SON6 / HIZ_DERECESI (TJK resmî süre; aktif sinyal DEĞİL)", () => {
  it("SINYAL_KAYDI: kullanıcı onaylı beş aile (bu aday modül ayrıca yalnız araştırma amaçlıdır)", () => { expect(SINYAL_KAYDI.length).toBe(5); });
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
  const hedef = { yuzey: "K", mesafe: 1400 }; const par = { yarimOmurGun: 90, lambda: 1, yuzey: "AYNI" as const };
  it("H2H_{h,j} = Σw·X/(Σw+λ); w = 0,5^(gün/yarıÖmür) × min/max mesafe oranı", () => {
    const l = [hk("r1", 1, 0.0001, 2, "K", 1400), hk("r1", 2, 0.0001, 5, "K", 1400), hk("r2", 1, 90, 3, "K", 1200), hk("r2", 2, 90, 1, "K", 1200)]; const c = h2hCift(new H2HDeposu(l).gorunum(T), 1, 2, hedef, par);
    const w1 = Math.pow(0.5, 0.0001 / 90), w2 = 0.5 * (1200 / 1400); expect(c.n).toBe(2); expect(c.deger).toBeCloseTo((w1 * 1 + w2 * -1) / (w1 + w2 + 1)); expect(c.galibiyet).toBe(1); expect(c.maglubiyet).toBe(1);
  });
  it("yarı ömür ve λ parametre: uzun yarı ömür eski yarışa daha çok ağırlık; büyük λ değeri sıfıra çeker", () => {
    const g = new H2HDeposu([hk("r1", 1, 180, 1), hk("r1", 2, 180, 4)]).gorunum(T); const a = h2hCift(g, 1, 2, hedef, { ...par, yarimOmurGun: 90 }), b = h2hCift(g, 1, 2, hedef, { ...par, yarimOmurGun: 365 }); expect(b.agirlikToplam).toBeGreaterThan(a.agirlikToplam); expect(b.deger!).toBeGreaterThan(a.deger!);
    expect(h2hCift(g, 1, 2, hedef, { ...par, lambda: 5 }).deger!).toBeLessThan(h2hCift(g, 1, 2, hedef, { ...par, lambda: 1 }).deger!);
  });
  it("eşit sıra → 0; ortak yarış yoksa NULL (sıfır değil)", () => {
    expect(h2hCift(new H2HDeposu([hk("r1", 1, 10, 3), hk("r1", 2, 10, 3)]).gorunum(T), 1, 2, hedef, par).deger).toBeCloseTo(0);
    expect(h2hCift(new H2HDeposu([hk("r1", 1, 10, 3), hk("r2", 2, 10, 3)]).gorunum(T), 1, 2, hedef, par).deger).toBeNull();
  });
  it("ANA hesap yalnız AYNI yüzey; farklı yüzey ayrı hesapta; yüzey bilinmiyorsa ('?') ikisinde de dışarıda", () => {
    const l = [hk("r1", 1, 10, 1, "Ç", 1400), hk("r1", 2, 10, 4, "Ç", 1400), hk("r2", 1, 10, 4, "K", 1400), hk("r2", 2, 10, 1, "K", 1400), hk("r3", 1, 10, 1, "?", 1400), hk("r3", 2, 10, 4, "?", 1400)]; const g = new H2HDeposu(l).gorunum(T);
    const ayni = h2hCift(g, 1, 2, hedef, par), farkli = h2hCift(g, 1, 2, hedef, { ...par, yuzey: "FARKLI" }); expect(ayni.n).toBe(1); expect(ayni.deger!).toBeLessThan(0); expect(farkli.n).toBe(1); expect(farkli.deger!).toBeGreaterThan(0);
    expect(h2hCift(new H2HDeposu([hk("r3", 1, 10, 1, "?"), hk("r3", 2, 10, 4, "?")]).gorunum(T), 1, 2, hedef, par).deger).toBeNull(); expect(h2hCift(new H2HDeposu([hk("r3", 1, 10, 1, "?"), hk("r3", 2, 10, 4, "?")]).gorunum(T), 1, 2, hedef, { ...par, yuzey: "FARKLI" }).deger).toBeNull();
  });
  it("mesafe benzerliği sürekli (keskin eşik yok): yakın mesafe ağırlığı > uzak mesafe ağırlığı, ikisi de > 0", () => {
    const yakin = h2hCift(new H2HDeposu([hk("r1", 1, 10, 1, "K", 1300), hk("r1", 2, 10, 4, "K", 1300)]).gorunum(T), 1, 2, hedef, par), uzak = h2hCift(new H2HDeposu([hk("r1", 1, 10, 1, "K", 1000), hk("r1", 2, 10, 4, "K", 1000)]).gorunum(T), 1, 2, hedef, par);
    expect(yakin.agirlikToplam).toBeGreaterThan(uzak.agirlikToplam); expect(uzak.agirlikToplam).toBeGreaterThan(0);
  });
  it("az karşılaşmada λ aşırı puanı engeller: tek galibiyet 1'e değil < 1'e", () => { const c = h2hCift(new H2HDeposu([hk("r1", 1, 1, 1), hk("r1", 2, 1, 2)]).gorunum(T), 1, 2, hedef, par); expect(c.deger!).toBeLessThan(0.6); expect(c.deger!).toBeGreaterThan(0.4); });
  it("H2H_NET: yalnız ortak yarışı olan rakiplerin ortalaması; hiç yoksa null; veri olan rakip sayısı ayrı", () => {
    const l = [hk("a", 1, 5, 1), hk("a", 2, 5, 3), hk("b", 1, 5, 4), hk("b", 3, 5, 2)]; const g = new H2HDeposu(l).gorunum(T); const n = h2hNet(g, 1, [1, 2, 3, 4], hedef, par);
    expect(n.nRakip).toBe(2); expect(n.toplamRakip).toBe(3); const c12 = h2hCift(g, 1, 2, hedef, par).deger!, c13 = h2hCift(g, 1, 3, hedef, par).deger!; expect(n.deger).toBeCloseTo((c12 + c13) / 2);
    expect(h2hNet(g, 4, [1, 2, 3], hedef, par).deger).toBeNull();
  });
  it("as-of: yarış günü ve sonrası ortak yarışlar kullanılmaz", () => { const g = new H2HDeposu([hk("r1", 1, 0, 1), hk("r1", 2, 0, 5), hk("r2", 1, -3, 1), hk("r2", 2, -3, 5)]).gorunum(T); expect(h2hCift(g, 1, 2, hedef, par).deger).toBeNull(); });
  it("SIZINTI: t ve sonrası bozulunca (aynı gün sahte ortak yarışlar dahil) değerler BİREBİR aynı — tüm parametre kombinasyonlarında", () => {
    const l: H2HKayit[] = []; for (let r = 0; r < 30; r++) for (let a = 1; a <= 6; a++) l.push(hk("y" + r, a, 3 + r * 4 - (r > 24 ? 110 : 0), 1 + ((a * 5 + r * 3) % 6), r % 3 === 0 ? "Ç" : "K", 1200 + (r % 4) * 100)); const d = new H2HDeposu(l); const x = d.gorunum(T), y = d.gelecegiBoz(T, 5).gorunum(T);
    for (const hl of [90, 180, 365]) for (const lam of [1, 3, 5]) for (const yz of ["AYNI", "FARKLI"] as const) for (let a = 1; a <= 6; a++) expect(h2hNet(y, a, [1, 2, 3, 4, 5, 6], hedef, { yarimOmurGun: hl, lambda: lam, yuzey: yz })).toEqual(h2hNet(x, a, [1, 2, 3, 4, 5, 6], hedef, { yarimOmurGun: hl, lambda: lam, yuzey: yz }));
  });
  it("h2hNetCoklu: her parametre kümesi için h2hNet ile BİREBİR aynı", () => {
    const l: H2HKayit[] = []; for (let r = 0; r < 40; r++) for (let a = 1; a <= 7; a++) l.push(hk("y" + r, a, 2 + r * 5, 1 + ((a * 3 + r * 5) % 7), r % 3 === 0 ? "Ç" : r % 7 === 0 ? "?" : "K", 1000 + (r % 6) * 100)); const g = new H2HDeposu(l).gorunum(T); const pars = [] as { yarimOmurGun: number; lambda: number; yuzey: "AYNI" | "FARKLI" }[];
    for (const hl of [90, 180, 365]) for (const lam of [1, 3, 5]) for (const yz of ["AYNI", "FARKLI"] as const) pars.push({ yarimOmurGun: hl, lambda: lam, yuzey: yz });
    for (const hy of [{ yuzey: "K", mesafe: 1400 }, { yuzey: "?", mesafe: 1400 }]) for (let a = 1; a <= 7; a++) { const c = h2hNetCoklu(g, a, [1, 2, 3, 4, 5, 6, 7], hy, pars); pars.forEach((p, i) => expect(c[i]).toEqual(h2hNet(g, a, [1, 2, 3, 4, 5, 6, 7], hy, p))); }
  });
  it("yapısal: saf dosya (db/ağ/saat/rastgele/sonuç import ETMEZ)", () => {
    const kod = fs.readFileSync(path.join(__dirname, "h2h-aday.ts"), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n"); expect(/from\s+["']/.test(kod)).toBe(false); expect(/\bDate\b|Math\.random|fetch\(|prisma|\bdb\b|process\.|winner|result|ganyan/.test(kod)).toBe(false);
  });
});
