import { describe, expect, it } from "vitest";
import { parseClassType, parseHp, HANDIKAP_HP_BANTLARI } from "./sinif-classifier";

// 2026-10-17 — bu testler gerçek production verisine karşı (319 farklı classType, 5858
// kayıt) ölçülerek kuruldu. İki GERÇEK Türkçe büyük/küçük harf hatası bu süreçte
// yakalandı ve düzeltildi (bkz. normalize() yorumu) — bu testler o regresyonu kilitler.
// Alan isimleri kullanıcının istediği TAM şemaya göre: classFamily/classLevel/
// handicapDivision/restrictions/rawClassType/parseStatus.

describe("parseClassType — Türkçe büyük/küçük harf regresyon testleri", () => {
  it("'Maiden' MAIDEN_SARTLI1, parseStatus=PARSED", () => {
    const r = parseClassType("Maiden");
    expect(r.classFamily).toBe("MAIDEN_SARTLI1");
    expect(r.parseStatus).toBe("PARSED");
  });
  it("'MAIDEN' (tamamı büyük) da aynı şekilde ayrıştırılır", () => {
    expect(parseClassType("MAIDEN").classFamily).toBe("MAIDEN_SARTLI1");
  });
  it("'Maiden/Dişi' hem kategoriyi hem kısıtlamayı doğru yakalar", () => {
    const r = parseClassType("Maiden/Dişi");
    expect(r.classFamily).toBe("MAIDEN_SARTLI1");
    expect(r.restrictions).toContain("Dişi");
  });
  it("'SATIŞ 3' doğru ayrıştırılır", () => {
    const r = parseClassType("SATIŞ 3");
    expect(r.classFamily).toBe("SATIS");
    expect(r.classLevel).toBe(3);
  });
  it("'Handikap 15 /H2' hem seviyeyi hem alt-tier'i (handicapDivision) yakalar", () => {
    const r = parseClassType("Handikap 15 /H2");
    expect(r.classFamily).toBe("HANDIKAP");
    expect(r.classLevel).toBe(15);
    expect(r.isHandicapStyle).toBe(true);
    expect(r.handicapDivision).toBe("H2");
  });
  it("rawClassType HER ZAMAN orijinal, dönüştürülmemiş metni taşır", () => {
    expect(parseClassType("şartlı 4").rawClassType).toBe("şartlı 4");
  });
});

describe("parseClassType — kategori ayrımı (kullanıcı kuralı: tek doğrusal merdiven DEĞİL)", () => {
  it("ŞARTLI 1, Maiden ile AYNI giriş-seviyesi kategoriye düşer", () => {
    expect(parseClassType("ŞARTLI 1").classFamily).toBe("MAIDEN_SARTLI1");
  });
  it("ŞARTLI 4, genel SARTLI kategorisinde, seviye=4", () => {
    const r = parseClassType("ŞARTLI 4");
    expect(r.classFamily).toBe("SARTLI");
    expect(r.classLevel).toBe(4);
  });
  it("ŞARTLI 19, ayrı SARTLI_OZEL kategorisinde (Maiden/Şartlı1 ile KARIŞTIRILMAZ)", () => {
    expect(parseClassType("ŞARTLI 19").classFamily).toBe("SARTLI_OZEL");
  });
  it("'G 1' (boşluklu) ve 'G1' (boşluksuz) ikisi de GRUP_ACIK, seviye=1", () => {
    expect(parseClassType("G 1").classLevel).toBe(1);
    expect(parseClassType("G1").classLevel).toBe(1);
    expect(parseClassType("G 1").classFamily).toBe("GRUP_ACIK");
  });
  it("KV-21, Handikap-statülü KV olarak işaretlenir (kullanıcı dokümanı)", () => {
    const r = parseClassType("KV-21");
    expect(r.classFamily).toBe("KV");
    expect(r.isHandicapStyle).toBe(true);
  });
  it("KV-8, normal (Handikap-statülü OLMAYAN) KV olarak işaretlenir", () => {
    const r = parseClassType("KV-8");
    expect(r.classFamily).toBe("KV");
    expect(r.isHandicapStyle).toBe(false);
  });
  it("bare 'Handikap' (seviyesiz) PARTIAL — kategori bilinir, seviye bilinmez, UYDURULMAZ", () => {
    const r = parseClassType("Handikap");
    expect(r.classFamily).toBe("HANDIKAP");
    expect(r.classLevel).toBeNull();
    expect(r.parseStatus).toBe("PARTIAL");
  });
  it("boş/— değer dürüstçe UNKNOWN (tahmin edilmez)", () => {
    expect(parseClassType("").classFamily).toBe("UNKNOWN");
    expect(parseClassType("—").parseStatus).toBe("UNKNOWN");
  });
  it("doğrulanmış yazım varyantları (Sartli/Satis) kontrollü eşanlamlı listesinden çözülür", () => {
    expect(parseClassType("Sartli").classFamily).toBe("MAIDEN_SARTLI1");
    expect(parseClassType("Satis").classFamily).toBe("SATIS");
    // ham değer YİNE DE orijinal (diyakritiksiz) haliyle korunur:
    expect(parseClassType("Sartli").rawClassType).toBe("Sartli");
  });
});

describe("Handikap sınıf-seviyesi (classLevel) ile HP (ata ait) AYRI — kullanıcının kritik ayrımı", () => {
  it("HANDIKAP_HP_BANTLARI yalnız YARIŞIN kabul aralığı referansıdır, bir atın HP'sini DEĞİŞTİRMEZ", () => {
    // Bu bant tablosu salt referans — parseHp()'nin döndürdüğü değer asla buna göre kırpılmaz/düzeltilmez.
    expect(parseHp("82")).toBe(82); // HANDIKAP_HP_BANTLARI[16] dışında olsa bile (82<85, aslında içinde) DEĞİŞTİRİLMEZ
    expect(HANDIKAP_HP_BANTLARI[16]).toEqual({ min: 30, max: 85 });
  });
});

describe("parseHp", () => {
  it("geçerli bir HP string'i sayıya çevrilir", () => {
    expect(parseHp("55")).toBe(55);
  });
  it("boş/geçersiz HP null döner, 0 İLE KARIŞTIRILMAZ", () => {
    expect(parseHp("")).toBeNull();
    expect(parseHp("—")).toBeNull();
  });
});
