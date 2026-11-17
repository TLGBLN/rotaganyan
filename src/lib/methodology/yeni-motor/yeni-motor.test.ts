import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { SINYAL_KAYDI, YENI_MOTOR_KURALLARI, sinyalKaydiDogrula } from "./sinyal-kaydi";

// KULLANICI ONAYLI SİNYAL SAYISI. Bu sabit, sinyal kaydıyla BİRLİKTE ve yalnız kullanıcı onayıyla değiştirilir (iki adımlı koruma).
const ONAYLI_SINYAL_SAYISI = 0;

describe("YENİ MOTOR — sıfır sinyal ve kullanıcı yetkisi", () => {
  it("sinyal listesi BOŞ; sayı 0; kurallar sabit", () => {
    expect(SINYAL_KAYDI).toHaveLength(0); expect(SINYAL_KAYDI.length).toBe(ONAYLI_SINYAL_SAYISI);
    expect(YENI_MOTOR_KURALLARI).toEqual({ sinyalSayisi: 0, sinyalListesi: "bos", sinyalSecmeYetkisi: "kullanici", otomatikSinyalGelistirme: false, eskiSinyalTasima: false, modelEgitimi: false, yayinlanabilir: false });
  });
  it("kaydedilmiş her sinyal KULLANICI onaylı olmak zorunda (boş kayıt geçerli)", () => { expect(sinyalKaydiDogrula(SINYAL_KAYDI).gecerli).toBe(true); });
  it("onaysız / eksik tanımlı sinyal REDDEDİLİR", () => {
    const r = sinyalKaydiDogrula([{ kod: "x" }, { kod: "y", tanim: "t", hesaplamaYontemi: "h", onay: { veren: "asistan", tarih: "2026-11-17", referans: "r" } }, { kod: "z", tanim: "t", hesaplamaYontemi: "h" }]);
    expect(r.gecerli).toBe(false); expect(r.hatalar.length).toBeGreaterThanOrEqual(4); expect(r.hatalar.join(" ")).toContain("KULLANICI ONAYI");
  });
  it("tam onaylı bir kayıt biçim olarak geçerli (yalnız doğrulama; KAYDA EKLENMEZ)", () => {
    expect(sinyalKaydiDogrula([{ kod: "ornek", tanim: "t", hesaplamaYontemi: "h", onay: { veren: "kullanici", tarih: "2026-11-17", referans: "mesaj" } }]).gecerli).toBe(true);
  });
});

describe("YENİ MOTOR — eski modellerden ve eğitimden yapısal yalıtım", () => {
  it("yeni-motor/*.ts (altyapı hariç) eski motor, ağırlık, Accurace/galop/PIT, veritabanı import ETMEZ; eğitim/olasılık/seçim kodu İÇERMEZ", () => {
    const dir = __dirname; const dosyalar = fs.readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts")); expect(dosyalar).toContain("sinyal-kaydi.ts");
    for (const f of dosyalar) {
      const kod = fs.readFileSync(path.join(dir, f), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
      for (const m of kod.matchAll(/from\s+["']([^"']+)["']/g)) expect(m[1], f + " import yasak").toMatch(/^\.\/(?!.*(weights|engine))/);
      for (const yasak of ["softmax", "egit(", "train", "forward", "backward", "beta", "weights.json", "@/lib/db", "prisma", "v546", "accurace", "galop-motor", "pit-seviye"]) expect(kod.toLowerCase().includes(yasak.toLowerCase()), f + " yasak ifade: " + yasak).toBe(false);
    }
  });
  it("eski ağırlık dosyaları yeni-motor dizininden referanslanmaz (özellik/katsayı taşıma yok)", () => {
    const hepsi: string[] = []; const gez = (d: string) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? gez(path.join(d, e.name)) : e.name.endsWith(".ts") && !e.name.endsWith(".test.ts") ? hepsi.push(path.join(d, e.name)) : 0)); gez(__dirname);
    for (const f of hepsi) { const kod = fs.readFileSync(f, "utf8"); expect(/weights\/|v546-1|v5-engine|saf-weights/.test(kod.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n")), f).toBe(false); }
  });
});
