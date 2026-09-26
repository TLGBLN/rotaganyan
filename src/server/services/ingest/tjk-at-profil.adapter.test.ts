// URGENT Retry Lane — hata sınıflandırma testleri (bkz. proje hafızası). SAF fonksiyon,
// ağ/DB yok.
import { describe, expect, it } from "vitest";
import { classifyFetchError } from "./tjk-at-profil.adapter";

describe("classifyFetchError", () => {
  it("HTTP 404 → permanent (at gerçekten yok, tekrar denemekle düzelmez)", () => {
    expect(classifyFetchError(new Error("HTTP 404: https://www.tjk.org/foo"))).toBe("permanent");
  });

  it("HTTP 429/502/503/504 → transient", () => {
    for (const code of [429, 502, 503, 504]) {
      expect(classifyFetchError(new Error(`HTTP ${code}: https://www.tjk.org/foo`))).toBe("transient");
    }
  });

  it("diğer 4xx (401/403) → permanent (istemci hatası, tekrarla düzelmez)", () => {
    expect(classifyFetchError(new Error("HTTP 401: https://www.tjk.org/foo"))).toBe("permanent");
    expect(classifyFetchError(new Error("HTTP 403: https://www.tjk.org/foo"))).toBe("permanent");
  });

  it("kesik/şüpheli kısa yanıt → transient (TJK'nın geçici hıçkırığı)", () => {
    expect(classifyFetchError(new Error("Şüpheli kısa yanıt (120 bayt): https://www.tjk.org/foo"))).toBe("transient");
  });

  it("timeout/network hataları → transient", () => {
    expect(classifyFetchError(new Error("Connect Timeout Error"))).toBe("transient");
    expect(classifyFetchError(new Error("ECONNRESET"))).toBe("transient");
    expect(classifyFetchError(new Error("fetch failed"))).toBe("transient");
  });

  it("bilinmeyen/tanınmayan hata → transient (fail-safe: kalıcı mezarlığa yanlışlıkla atmamak)", () => {
    expect(classifyFetchError(new Error("beklenmedik bir şey oldu"))).toBe("transient");
    expect(classifyFetchError("string hata")).toBe("transient");
    expect(classifyFetchError(null)).toBe("transient");
  });
});
