// TEST ALTYAPISI testleri — YENİ MOTORUN SİNYALİ DEĞİLDİR. Aşağıdaki özellikler yalnız dedektörün çalıştığını göstermek için TEST İÇİNDE tanımlı örneklerdir; hiçbir motora/kayda girmez.
import { describe, expect, it } from "vitest";
import { Deposu, type KosuKaydi } from "./asof-veri";
import { sizintiDenetimi, type Kosucu, type OzellikFn } from "./sizinti-denetimi";

const G = 86400000; const T0 = Date.UTC(2026, 0, 1);
// Sentetik: 40 gün, her gün 1 yarış 8 at; atlar 1..8 sabit; bitiş sırası deterministik karışık
function veri(): { dep: Deposu; kosucular: Kosucu[] } {
  const k: KosuKaydi[] = []; const kos: Kosucu[] = []; let s = 5; const r = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (let g = 0; g < 40; g++) { const sira = Array.from({ length: 8 }, (_, i) => i + 1).sort(() => r() - 0.5); for (let a = 1; a <= 8; a++) { const x: KosuKaydi = { raceId: "r" + g, tarih: T0 + g * G, hip: "adana", mesafe: 1400, yuzey: "KUM", sinif: "ŞARTLI 3", irk: "INGILIZ", atId: a, no: a, jokey: "J" + (a % 3), antrenor: "T" + (a % 2), kilo: 55 + a, hp: 20 + a, sira: sira.indexOf(a) + 1, kazandi: sira.indexOf(a) === 0 ? 1 : 0, alan: 8 }; k.push(x); if (g >= 10) kos.push({ raceId: x.raceId, t: x.tarih, atId: a, no: a, jokey: x.jokey, antrenor: x.antrenor, mesafe: 1400, yuzey: "KUM", sinif: x.sinif, hip: "adana", kilo: x.kilo, hp: x.hp, alan: 8 }); } }
  return { dep: new Deposu(k), kosucular: kos };
}
const ort = (a: number[]) => a.reduce((p, q) => p + q, 0) / a.length;
// DOĞRU özellik: atın son 3 bitiş sırası ortalaması (yalnız görünümden)
const dogru: OzellikFn = (g, k) => { const h = g.atGecmisi(k.atId).filter((x) => x.sira != null).slice(-3); return h.length ? ort(h.map((x) => x.sira!)) : null; };
// DOĞRU özellik 2: as-of genel kazanma oranına göre küçültülmüş jokey oranı
const dogruJokey: OzellikFn = (g, k) => { const { n, kazanan } = g.genelOnce(); const p0 = n >= 50 ? kazanan / n : 0.1; const h = g.jokeyGecmisi(k.jokey); return ((h.reduce((p, q) => p + q.kazandi, 0) + 20 * p0) / (h.length + 20)) * 100; };

describe("as-of görünüm (test altyapısı)", () => {
  it("t günü ve sonrası kayıtlar GÖRÜNMEZ (aynı gün dahil değil); önceki günler görünür", () => {
    const { dep } = veri(); const g = dep.gorunum(T0 + 10 * G); const h = g.atGecmisi(1);
    expect(h).toHaveLength(10); expect(Math.max(...h.map((x) => x.tarih))).toBeLessThan(T0 + 10 * G); expect(g.genelOnce().n).toBe(80);
  });
});

describe("sızıntı dedektörü (test altyapısı) (gelecek-bozma)", () => {
  it("doğru özellikler (at geçmişi, as-of genel oran + jokey) GEÇER", () => {
    const { dep, kosucular } = veri();
    for (const f of [dogru, dogruJokey]) { const r = sizintiDenetimi(f, dep, kosucular, 5); expect(r.denenen).toBeGreaterThan(0); expect(r.gecti).toBe(true); expect(r.farkli).toBe(0); }
  });
  it("gelecek verisi bozulunca değişen özellik YAKALANIR (özellik görünüm yerine kendi deposunu kullanır)", () => {
    const { dep, kosucular } = veri(); const sizdiran: OzellikFn = (g, k) => { const dpos = (g as unknown as { d: Deposu }).d; const h = dpos.kayitlar.filter((x) => x.atId === k.atId); return ort(h.map((x) => x.sira ?? 0)); }; // tüm tarihlere bakar
    const r = sizintiDenetimi(sizdiran, dep, kosucular, 5); expect(r.gecti).toBe(false);
  });
  it("denetlenecek koşucu yoksa 'kanıt yok' (geçmiş sayılmaz)", () => { const { dep } = veri(); expect(sizintiDenetimi(dogru, dep, [], 5).gecti).toBe(false); });
});
