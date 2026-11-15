import { describe, expect, it } from "vitest";
import { nedenSatirlari, SINYAL_BILGI } from "./neden-satirlari";
import safW from "./weights/v546-1-saf-weights.json";

describe("nedenSatirlari", () => {
  const s = [
    { kod: "jokeyPIT", hamDeger: 21.5, katki: 0.63 },
    { kod: "fMean", hamDeger: 1.5, katki: 0.71 },
    { kod: "hpRel", hamDeger: -14, katki: -0.45 },
    { kod: "dususDelta", hamDeger: -5, katki: -0.46 },
    { kod: "sireOrani", hamDeger: 7, katki: -0.11 },
    { kod: "ACC_SPEED", hamDeger: 0, katki: -0.004 },
    { kod: "h2hNetSkor", hamDeger: null, katki: 0, observed: false },
  ];
  it("büyükten küçüğe, eşik altını ve gözlemsizi dışlar", () => {
    const o = nedenSatirlari(s);
    expect(o.arti.map((x) => x.kod)).toEqual(["fMean", "jokeyPIT"]);
    expect(o.eksi.map((x) => x.kod)).toEqual(["dususDelta", "hpRel", "sireOrani"]);
  });
  it("n sınırı uygulanır", () => {
    expect(nedenSatirlari(s, { n: 1 }).eksi).toHaveLength(1);
  });
  it("derece ortalamasının sınıfa bakmadığı ham notta yazar; sınıf değişimi yön söyler", () => {
    const o = nedenSatirlari(s);
    expect(o.arti[0].ham).toContain("sınıfa bakmaz");
    expect(o.eksi[0].ham).toBe("5 basamak YÜKSELİŞ");
  });
  it("boş/undefined güvenli", () => {
    expect(nedenSatirlari(undefined)).toEqual({ arti: [], eksi: [] });
  });
  it("canlı varsayılan modelin her sinyalinin okunaklı adı var (kod ekranda görünmesin)", () => {
    const eksik = (safW as { featureNames: string[] }).featureNames.filter((k) => !SINYAL_BILGI[k]);
    expect(eksik).toEqual([]);
  });
});

import { sonYarislarOzeti, sinifSeviyesi } from "./ham-alan-sinyalleri";
describe("sonYarislarOzeti / sinifSeviyesi", () => {
  it("TJK hiyerarşisi", () => {
    expect(sinifSeviyesi("G 2/ULS")).toBe(12);
    expect(sinifSeviyesi("ŞARTLI 1")).toBe(1);
    expect(sinifSeviyesi("Maiden")).toBe(1);
    expect(sinifSeviyesi("KV-7")).toBe(8);
    expect(sinifSeviyesi("Handikap 15")).toBe(4);
    expect(sinifSeviyesi("A 3")).toBeNull();
  });
  it("yarış gününden önceki son yarışlar, en yeni önce; sınıf farkı bugüne göre", () => {
    const rows = [
      { date: "01.11.2026", classType: "Maiden", finishPos: "1" },
      { date: "16.10.2026", classType: "ŞARTLI 1", finishPos: "2" },
      { date: "15.11.2026", classType: "G 2", finishPos: "" }, // yarış günü — dışlanır
    ];
    const o = sonYarislarOzeti(rows, Date.UTC(2026, 10, 15), "G 2/ULS");
    expect(o).toHaveLength(2);
    expect(o[0]).toMatchObject({ tarih: "01.11", sinif: "Maiden", derece: 1, seviye: 1, fark: 11 });
    expect(o[1]).toMatchObject({ derece: 2, fark: 11 });
  });
});
