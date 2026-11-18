import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { F6_SINYALLER, KANIT, TUR_AYAR, hesaplaF6, turGrubu, type F6AtGirdisi, type F6Sinyal, type TurGrubu } from "./ran-f6-model";
import { RAN_F6_BETA_ANA, RAN_F6_BETA_ILK_START, RAN_F6_KOLONLAR, RAN_F6_OLCEK, RAN_F6_TAU } from "./ran-f6-katsayilar";

const at = (d: Partial<Record<F6Sinyal, number | null>>): F6AtGirdisi => ({ deger: d });
/** Bağımsız düz-döngü uygulaması (modelden bağımsız yazıldı). */
function bagimsiz(atlar: F6AtGirdisi[], tur: TurGrubu) {
  const ilk = TUR_AYAR[tur].ilkStart; const cols = ilk ? ["S", "kap"] : F6_SINYALLER.filter((c) => !TUR_AYAR[tur].kapali.includes(c)); const beta = ilk ? RAN_F6_BETA_ILK_START : RAN_F6_BETA_ANA; const n = atlar.length; const skor = new Array(n).fill(0);
  for (const c of cols) { const sc = RAN_F6_OLCEK[c]!; const v: (number | null)[] = atlar.map((a) => { const x = (a.deger as Record<string, number | null | undefined>)[c]; return x == null ? null : x / sc; }); const dolu = v.filter((x) => x != null) as number[]; let x: number[]; if (dolu.length < 2) x = v.map(() => 0); else { let s = 0; for (const q of dolu) s += q; const mu = s / dolu.length; x = v.map((q) => (q == null ? mu : q)); } for (let i = 0; i < n; i++) skor[i] += beta[c]! * x[i]!; }
  const mx = Math.max(...skor); const e = skor.map((s) => Math.exp(s - mx)); let z = 0; for (const q of e) z += q; const p = e.map((q) => q / z); const pt = p.map((q) => Math.pow(Math.max(q, 1e-12), RAN_F6_TAU)); let zt = 0; for (const q of pt) zt += q; return pt.map((q) => q / zt);
}
const SAHA = (): F6AtGirdisi[] => [at({ acc: 18.1, kap: 0.8, S: 0.14, h2h: 0.2, sY: 1, sT: 0 }), at({ acc: 17.5, kap: 0.4, S: 0.09, h2h: -0.1, sY: 0, sT: 1 }), at({ acc: 16.9, kap: 0.55, S: 0.11, h2h: 0.0, sY: 0, sT: 0 }), at({ acc: null, kap: 0.3, S: 0.07, h2h: null, sY: 0, sT: 0 }), at({ acc: 18.5, kap: null, S: null, h2h: 0.1, sY: 1, sT: 0 })];

describe("RAN F6 — saf model", () => {
  it("katsayı dosyası: altı bileşen, SON6/AGF YOK, ilk-start modeli yalnız J_SEVIYE+GALOP", () => {
    expect([...RAN_F6_KOLONLAR].sort()).toEqual(["S", "acc", "h2h", "kap", "sT", "sY"].sort()); expect(Object.keys(RAN_F6_BETA_ANA).sort()).toEqual(["S", "acc", "h2h", "kap", "sT", "sY"].sort()); expect(Object.keys(RAN_F6_BETA_ILK_START).sort()).toEqual(["S", "kap"]);
    for (const k of Object.keys({ ...RAN_F6_BETA_ANA, ...RAN_F6_OLCEK })) expect(/son6|s6|agf/i.test(k)).toBe(false); expect(RAN_F6_TAU).toBeGreaterThan(0.3); expect(RAN_F6_TAU).toBeLessThan(2);
  });
  it("olasılıklar toplamı 1; sıra olasılığa göre; model bağımsız düz-döngü hesapla BİREBİR aynı (tüm tipler)", () => {
    for (const tur of Object.keys(TUR_AYAR) as TurGrubu[]) { const s = SAHA(); const r = hesaplaF6(s, tur); const b = bagimsiz(s, tur); expect(r.atlar.reduce((x, a) => x + a.olasilik, 0)).toBeCloseTo(1, 12); r.atlar.forEach((a, i) => expect(a.olasilik).toBeCloseTo(b[i]!, 12)); const sirali = [...r.atlar].sort((x, y) => x.sira - y.sira); for (let i = 1; i < sirali.length; i++) expect(sirali[i - 1]!.olasilik).toBeGreaterThanOrEqual(sirali[i]!.olasilik - 1e-15); }
  });
  it("eksik değer yarış ortalamasıyla doldurulur (nötr); <2 değerli sinyal tüm ata 0 → o sinyalin katkısı yok", () => {
    const tek = [at({ acc: 18, kap: 0.5, S: 0.1 }), at({ acc: null, kap: 0.5, S: 0.1 }), at({ acc: null, kap: 0.5, S: 0.1 })]; const r = hesaplaF6(tek, "SARTLI_345"); for (const a of r.atlar) expect(a.katki.acc).toBeCloseTo(0, 12); expect(r.atlar[1]!.eksik).toContain("acc"); expect(r.atlar[0]!.eksik).not.toContain("acc");
    const ikili = [at({ acc: 18 }), at({ acc: 16 }), at({ acc: null })]; const r2 = hesaplaF6(ikili, "SARTLI_345"); expect(r2.atlar[2]!.katki.acc).toBeCloseTo(0, 12); expect(r2.atlar[0]!.katki.acc!).toBeGreaterThan(0);
  });
  it("TİP BAZLI KAPATMA YOK: ilk start dışında HER tipte altı bileşen hesaplanır; Handikap'ta GALOP, Maiden'de H2H, KV'de T_SON olasılığı DEĞİŞTİRİR", () => {
    for (const tur of ["MAIDEN", "SARTLI_345", "SARTLI_219", "HANDIKAP", "KV", "GRUP_SATIS", "DIGER"] as const) { expect(hesaplaF6(SAHA(), tur).kullanilan.length).toBe(6); expect(hesaplaF6(SAHA(), tur).kapali).toEqual([]); expect(TUR_AYAR[tur].kapali).toEqual([]); }
    const taban = hesaplaF6(SAHA(), "HANDIKAP"); const galopDegisti = hesaplaF6(SAHA().map((x) => at({ ...x.deger, kap: x.deger.kap == null ? null : 1 - (x.deger.kap as number) })), "HANDIKAP"); expect(taban.atlar.some((a, i) => Math.abs(a.olasilik - galopDegisti.atlar[i]!.olasilik) > 1e-6)).toBe(true);
    const h2hDegisti = hesaplaF6(SAHA().map((x) => at({ ...x.deger, h2h: x.deger.h2h == null ? null : -(x.deger.h2h as number) })), "MAIDEN"); expect(hesaplaF6(SAHA(), "MAIDEN").atlar.some((a, i) => Math.abs(a.olasilik - h2hDegisti.atlar[i]!.olasilik) > 1e-6)).toBe(true);
  });
  it("kanıt tablosu YALNIZ BİLGİ: her tip × sinyal tanımlı; kanıtlanmamış sinyal bile hesaplanır", () => {
    for (const tur of Object.keys(TUR_AYAR) as TurGrubu[]) for (const c of F6_SINYALLER) expect(KANIT[tur][c]).toBeTruthy(); expect(KANIT.HANDIKAP.kap).toBe("kanıtlanmadı"); expect(hesaplaF6(SAHA(), "HANDIKAP").kullanilan).toContain("kap");
  });
  it("İLK START (Şartlı 1/27): yalnız J_SEVIYE + GALOP; diğer sinyaller verilse bile sonucu DEĞİŞTİRMEZ", () => {
    const s = SAHA(); const r = hesaplaF6(s, "SARTLI_127"); expect(r.model).toBe("ILK_START"); expect([...r.kullanilan].sort()).toEqual(["S", "kap"]); const s2 = SAHA().map((x) => at({ S: x.deger.S, kap: x.deger.kap, acc: 99, h2h: 5, sY: 1, sT: 1 })); const r2 = hesaplaF6(s2, "SARTLI_127"); r.atlar.forEach((x, i) => expect(r2.atlar[i]!.olasilik).toBeCloseTo(x.olasilik, 12)); for (const a of r.atlar) expect(Object.keys(a.katki).sort()).toEqual(["S", "kap"]);
  });
  it("katkılar yarış ortalamasına göre; toplamı = skor − ortalama skor", () => {
    const r = hesaplaF6(SAHA(), "SARTLI_345"); const ort = r.atlar.reduce((s, a) => s + a.skor, 0) / r.atlar.length; for (const a of r.atlar) expect(Object.values(a.katki).reduce((s, v) => s + (v ?? 0), 0)).toBeCloseTo(a.skor - ort, 10);
  });
  it("deterministik; girdi değiştirilmez; beraberlikte düşük indeks önde", () => {
    const s = SAHA(); const kopya = JSON.stringify(s); const a = hesaplaF6(s, "HANDIKAP"), b = hesaplaF6(s, "HANDIKAP"); expect(JSON.stringify(a)).toBe(JSON.stringify(b)); expect(JSON.stringify(s)).toBe(kopya);
    const es = hesaplaF6([at({ acc: 17 }), at({ acc: 17 }), at({ acc: 17 })], "SARTLI_345"); expect(es.atlar.map((x) => x.sira)).toEqual([1, 2, 3]);
  });
  it("tek atlı/boş saha çökmez", () => { expect(hesaplaF6([at({ acc: 1 })], "MAIDEN").atlar[0]!.olasilik).toBeCloseTo(1, 12); expect(hesaplaF6([], "MAIDEN").atlar).toEqual([]); });
  it("yarış tipi eşlemesi (TJK sınıf adları)", () => {
    const o: [string, TurGrubu][] = [["Maiden/DHÖW", "MAIDEN"], ["ŞARTLI 1/DHÖW/Dişi", "SARTLI_127"], ["ŞARTLI 27/Dişi", "SARTLI_127"], ["ŞARTLI 4/DHÖW/Y2", "SARTLI_345"], ["ŞARTLI 5", "SARTLI_345"], ["ŞARTLI 3", "SARTLI_345"], ["ŞARTLI 19", "SARTLI_219"], ["ŞARTLI 2", "SARTLI_219"], ["ŞARTLI 11", "DIGER"], ["Handikap 15 /H2", "HANDIKAP"], ["Handikap 16/DHÖW /H1", "HANDIKAP"], ["KV-6", "KV"], ["KV-9/DHÖW", "KV"], ["G 2", "GRUP_SATIS"], ["SATIŞ 1/DHÖW", "GRUP_SATIS"], ["—", "DIGER"], ["", "DIGER"]];
    for (const [ad, beklenen] of o) expect(turGrubu(ad), ad).toBe(beklenen);
  });
  it("her tipin ayarı tanımlı; ilk-start yalnız Şartlı 1/27; yalnız ilk-start'ta 'kapalı' (veri yok) listesi var", () => {
    for (const [tur, a] of Object.entries(TUR_AYAR)) { expect(a.ad.length).toBeGreaterThan(0); for (const c of a.kapali) expect(F6_SINYALLER).toContain(c); expect(a.ilkStart).toBe(tur === "SARTLI_127"); if (tur !== "SARTLI_127") expect(a.kapali).toEqual([]); } expect(TUR_AYAR.SARTLI_127.kapali).toEqual(expect.arrayContaining(["acc", "h2h", "sY", "sT"]));
  });
  it("yapısal: saf dosya (db/ağ/saat/rastgele import ETMEZ); SON6/AGF/eski motor referansı YOK", () => {
    const kod = fs.readFileSync(path.join(__dirname, "ran-f6-model.ts"), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n"); for (const m of kod.matchAll(/from\s+["']([^"']+)["']/g)) expect(m[1]).toBe("./ran-f6-katsayilar");
    expect(/\bDate\b|Math\.random|fetch\(|prisma|\bdb\b|process\.|son6|\bagf\b|v546|v5-engine/i.test(kod)).toBe(false);
  });
});
