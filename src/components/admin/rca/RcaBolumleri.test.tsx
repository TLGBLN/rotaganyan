import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AcikSorunlar, KayitDefteriTablosu, OzetSeridi, SaglikliKontroller } from "./RcaBolumleri";
import type { RcaSorun } from "@/lib/rca/rca-cekirdek";

const sorun: RcaSorun = {
  kod: "veri.derece-bayat", baslik: "Derece arşivi bayat", kategori: "VERI", siddet: "KRITIK", durum: "SORUN", etki: "hizDerecesi bayat.",
  kanit: { gecikmeGun: 8 }, zincir: [{ soru: "Belirti?", cevap: "8 gün gecikme" }], kokNeden: "cron yazamıyor", cozum: "Senkronu çalıştır", otomatikCozum: "DERECE_SYNC", dogrulama: "≤3 gün.",
};
const saglikli: RcaSorun = { ...sorun, kod: "x", baslik: "AGF güncel", durum: "SAGLIKLI", otomatikCozum: null, zincir: [] };

describe("RCA arayüzü", () => {
  it("açık sorun kartı kök neden, çözüm ve Çöz düğmesini gösterir", () => {
    const h = renderToStaticMarkup(<AcikSorunlar sorunlar={[sorun, saglikli]} kayitlar={[]} />);
    expect(h).toContain("cron yazamıyor"); expect(h).toContain("Senkronu çalıştır"); expect(h).toContain("Derece arşivini şimdi yenile");
    expect(h).not.toContain("AGF güncel");
  });
  it("özet şeridi sayıları doğru verir", () => {
    const h = renderToStaticMarkup(<OzetSeridi sorunlar={[sorun, saglikli]} kayitlar={[]} kupon={null} />);
    expect(h).toContain("1 açık sorun"); expect(h).toContain("1 kritik");
  });
  it("sağlıklı kontroller ve boş kayıt defteri hatasız render olur", () => {
    expect(renderToStaticMarkup(<SaglikliKontroller sorunlar={[sorun, saglikli]} />)).toContain("AGF güncel");
    expect(renderToStaticMarkup(<KayitDefteriTablosu kayitlar={[]} />)).toContain("Henüz kayıt yok");
  });
});
