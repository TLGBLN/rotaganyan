// Dashboard bölümleri: örnek verilerle sunucu tarafı render — çökme/NaN sızması/boş durum kontrolü.
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type FunctionComponent } from "react";
import { DurumOzeti, modelIsigi, kuponIsigi, veriIsigi, ModelGenelGorunumu, SurumKarsilastirma, TipPerformansi, KalibrasyonKarti, BankoKarti, KuponPerformansi, SinyalSagligi, VeriGuncelligi } from "./IzlemeBolumleri";
import { dilimOzeti, kalibrasyon, bankoOzeti, normalize, tipGrubu, TIP_GRUPLARI, type YarisKaydi } from "@/lib/izleme/metrikler";
import { MODEL_SURUMLERI } from "@/lib/izleme/model-surumleri";
import type { IzlemeVerisi } from "@/server/services/izleme.service";
import type { KuponTutma } from "@/server/services/kupon-tutma.service";

const kayit = (i: number, surum: string, tip = "Handikap 15"): YarisKaydi => {
  const model = normalize({ "1": 3 + (i % 3), "2": 2, "3": 2, "4": 1, "5": 1, "6": 1 });
  return { raceId: "r" + i, tarih: "2026-11-1" + (i % 3), hip: "Test", raceNo: i, classType: tip, surum, alanBuyuklugu: 6, model, piyasa: normalize({ "1": 5, "2": 3, "3": 2, "4": 1, "5": 1, "6": 1 }), kazananlar: [1 + (i % 4)], bankoAdayi: i % 7 === 0 };
};

function ornek(n25: number, n22: number): IzlemeVerisi {
  const ks = [...Array.from({ length: n22 }, (_, i) => kayit(i, MODEL_SURUMLERI[2].ad, i % 2 ? "ŞARTLI 4" : "Handikap 15")), ...Array.from({ length: n25 }, (_, i) => kayit(100 + i, MODEL_SURUMLERI[3].ad, i % 3 ? "KV-7" : "Maiden"))];
  return {
    uretildi: new Date().toISOString(), eraBaslangic: MODEL_SURUMLERI[0].baslangic, haric: 2, guncelSurumAd: MODEL_SURUMLERI[3].ad,
    surumler: MODEL_SURUMLERI.map((s) => ({ ad: s.ad, ozellikSayisi: s.ozellikSayisi, baslangic: s.baslangic, cv: s.cv, ozet: dilimOzeti(s.ad, ks.filter((k) => k.surum === s.ad)) })),
    eraToplam: dilimOzeti("Saf era (tüm sürümler)", ks), son7: dilimOzeti("Son 7 gün", ks), son30: dilimOzeti("Son 30 gün", ks),
    tipler: TIP_GRUPLARI.map((t) => dilimOzeti(t, ks.filter((k) => tipGrubu(k.classType) === t))),
    alan: ["≤7 at", "8–10 at", "11+ at"].map((a) => dilimOzeti(a, a === "≤7 at" ? ks : [])),
    kalibrasyonTop1: kalibrasyon(ks, "top1", [0, 0.15, 0.25, 0.35, 0.45, 1.01]), kalibrasyonTop3: kalibrasyon(ks, "top3", [0, 0.45, 0.55, 0.65, 0.75, 1.01]),
    banko: bankoOzeti(ks),
    sinyaller: [{ kod: "hpRel", beta: 0.38, egitimZ: 9, n7: 100, obs7: 90, n30: 400, obs30: 380, katki7: 0.4 }, { kod: "fMean", beta: -0.34, egitimZ: -7.9, n7: 100, obs7: 50, n30: 400, obs30: 380, katki7: 0.3 }, { kod: "sireOraniBirlesik", beta: null, egitimZ: null, n7: 10, obs7: 10, n30: 10, obs30: 10, katki7: 0.1 }],
    veri: { sonSonuc: new Date(Date.now() - 3600_000).toISOString(), sonAgf: new Date(Date.now() - 600_000).toISOString(), sonTahmin: null, bugunTarih: "2026-11-13", bugunKosu: 16, bugunTahminli: 3, bugunSonuclanan: 0 },
  };
}
const kupon: KuponTutma = {
  uretildi: new Date().toISOString(), gunSayisi: 30, kuponSayisi: 99,
  kademeler: [
    { anahtar: "ekonomik", ad: "Ekonomik", n: 99, tuttu: 12, aralik: { oran: 0.12, lo: 0.07, hi: 0.2 }, ortMaliyet: 648, harcama: 64187, ikramiye: 67631, ikramiyeKayitsiz: 1, net: 3444, medyanIkramiye: 2400 },
    { anahtar: "normal", ad: "Normal", n: 99, tuttu: 17, aralik: { oran: 0.17, lo: 0.11, hi: 0.26 }, ortMaliyet: 1476, harcama: 146126, ikramiye: 121100, ikramiyeKayitsiz: 0, net: -25026, medyanIkramiye: 3400 },
    { anahtar: "genis", ad: "Geniş", n: 0, tuttu: 0, aralik: { oran: NaN, lo: NaN, hi: NaN }, ortMaliyet: 0, harcama: 0, ikramiye: 0, ikramiyeKayitsiz: 0, net: 0, medyanIkramiye: null },
  ],
};

const html = <P extends object>(c: FunctionComponent<P>, p: P) => renderToStaticMarkup(createElement(c, p));
const temiz = (s: string) => { expect(s).not.toContain("NaN"); expect(s).not.toContain("undefined"); expect(s).not.toContain("Infinity"); };

describe("izleme bölümleri — render", () => {
  it("güncel sürümde koşu YOKKEN (ilk gün) hepsi çökmeden render olur", () => {
    const v = ornek(0, 30);
    for (const c of [ModelGenelGorunumu, SurumKarsilastirma, TipPerformansi, KalibrasyonKarti, BankoKarti, SinyalSagligi, VeriGuncelligi]) { const s = html(c, { v }); expect(s.length).toBeGreaterThan(200); temiz(s); }
    expect(html(ModelGenelGorunumu, { v })).toContain("Henüz hüküm verilemez");
  });
  it("tamamen boş veride (hiç koşu) çökmez", () => {
    const v = ornek(0, 0);
    for (const c of [ModelGenelGorunumu, SurumKarsilastirma, TipPerformansi, KalibrasyonKarti, BankoKarti, SinyalSagligi, VeriGuncelligi]) temiz(html(c, { v }));
  });
  it("güncel sürümde yeterli koşu varsa o sürüm gösterilir; piyasa ve CV beklentisi satırları var", () => {
    const v = ornek(40, 10);
    const s = html(ModelGenelGorunumu, { v });
    expect(s).toContain("25 özellik"); expect(s).toContain("güncel sürüm"); temiz(s);
    const k = html(SurumKarsilastirma, { v }); expect(k).toContain("Piyasa"); expect(k).toContain("CV beklentisi"); temiz(k);
  });
  it("kalibrasyon ve tip tablosu başlıkları ve sıralanabilir başlık düğmeleri", () => {
    const v = ornek(40, 10);
    expect(html(TipPerformansi, { v })).toContain("Koşu tipi"); expect(html(TipPerformansi, { v })).toContain("<button");
    expect(html(KalibrasyonKarti, { v })).toContain("En iyi atın kazanma olasılığı");
  });
  it("sinyal sağlığı: düşüş ve segment-only etiketleri", () => {
    const s = html(SinyalSagligi, { v: ornek(10, 10) });
    expect(s).toContain("Düşüş"); expect(s).toContain("yalnız segment modeli"); temiz(s);
  });
  it("kupon performansı: kademe kartları, boş kademede NaN sızmaz", () => {
    const s = html(KuponPerformansi, { k: kupon });
    expect(s).toContain("Ekonomik"); expect(s).toContain("12/99"); expect(s).toContain("kayıtsız"); temiz(s);
  });
});


describe("durum özeti — ışık kuralları", () => {
  const simdi = Date.now();
  const saglikliSinyaller = [{ kod: "hpRel", beta: 0.38, egitimZ: 9, n7: 100, obs7: 90, n30: 400, obs30: 380, katki7: 0.4 }];

  it("model: güncel sürümde az koşu → altın 'Henüz erken'; veri yoksa gri", () => {
    expect(modelIsigi(ornek(0, 30))).toMatchObject({ ton: "altin", etiket: "Henüz erken" });
    expect(modelIsigi(null)).toMatchObject({ ton: "gri" });
  });
  it("kupon: geçmişle uyumlu → yeşil; geçmişin çok altı → kırmızı; az kupon → altın; veri yok → gri", () => {
    expect(kuponIsigi(kupon)).toMatchObject({ ton: "yesil" });
    const kotu: KuponTutma = { ...kupon, kademeler: kupon.kademeler.map((x) => (x.anahtar === "ekonomik" ? { ...x, tuttu: 1, aralik: { oran: 0.01, lo: 0.0, hi: 0.055 } } : x)) };
    expect(kuponIsigi(kotu)).toMatchObject({ ton: "kirmizi" });
    const az: KuponTutma = { ...kupon, kademeler: kupon.kademeler.map((x) => ({ ...x, n: 5 })) };
    expect(kuponIsigi(az)).toMatchObject({ ton: "altin" });
    expect(kuponIsigi(null)).toMatchObject({ ton: "gri" });
  });
  it("veri: taze AGF + sağlıklı sinyal → yeşil; 5 saatlik AGF → altın; 13 saatlik AGF → kırmızı; 3 sinyal düşüşü → kırmızı", () => {
    const v = (agfDk: number, sinyaller = saglikliSinyaller): IzlemeVerisi => ({ ...ornek(0, 0), sinyaller, veri: { ...ornek(0, 0).veri, sonAgf: new Date(simdi - agfDk * 60_000).toISOString() } });
    expect(veriIsigi(v(10)).ton).toBe("yesil");
    expect(veriIsigi(v(300)).ton).toBe("altin");
    expect(veriIsigi(v(13 * 60)).ton).toBe("kirmizi");
    const dusus = (kod: string) => ({ kod, beta: 0.1, egitimZ: 5, n7: 100, obs7: 50, n30: 400, obs30: 380, katki7: 0.1 });
    expect(veriIsigi(v(10, [dusus("hpRel"), dusus("kgsLog"), dusus("fMean")])).ton).toBe("kirmizi");
    expect(veriIsigi(v(10, [dusus("hpRel")])).ton).toBe("altin");
  });
  it("DurumOzeti: üç kart + genel bant render olur, boş veride de çöker değil", () => {
    const s = html(DurumOzeti, { v: ornek(0, 30), k: kupon });
    expect(s).toContain("Model"); expect(s).toContain("Kuponlar"); expect(s).toContain("Veri ve Sistem"); expect(s).toContain("Ayrıntı"); temiz(s);
    temiz(html(DurumOzeti, { v: null, k: null }));
  });
});
