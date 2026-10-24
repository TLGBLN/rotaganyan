import { describe, expect, it } from "vitest";
import { jockeyAbbrevMatchesFullName } from "./jokey";

// JOKEY_03/04'ün at-jokey eşleştirmesi bu fonksiyona dayanıyor — yanlış eşleşme SESSİZCE
// başka bir jokeyin geçmişini "uyum" sayardı, bu yüzden gerçek, bilinen örneklerle kilitlendi.
describe("jockeyAbbrevMatchesFullName — gerçek TJK isim formatı örnekleri", () => {
  it("kısaltılmış 'N.AVCİ', tam ad 'NEVZAT AVCI' ile EŞLEŞİR (Türkçe İ/I farkına DUYARSIZ)", () => {
    expect(jockeyAbbrevMatchesFullName("N.AVCİ", "NEVZAT AVCI")).toBe(true);
  });
  it("kısaltılmış 'H.KARATAŞ', tam ad 'HASAN KARATAŞ' ile EŞLEŞİR", () => {
    expect(jockeyAbbrevMatchesFullName("H.KARATAŞ", "HASAN KARATAŞ")).toBe(true);
  });
  it("yalnız soyadı farklı iki jokey EŞLEŞMEZ (farklı kişi)", () => {
    expect(jockeyAbbrevMatchesFullName("H.KARATAŞ", "HASAN ABİŞ")).toBe(false);
  });
  it("AYNI soyad ama UYUMSUZ baş harf EŞLEŞMEZ (farklı kişi, yanlış pozitif ÜRETİLMEZ)", () => {
    expect(jockeyAbbrevMatchesFullName("V.ABİŞ", "HASAN ABİŞ")).toBe(false);
  });
  it("çok-baş-harfli kısaltma 'M.S.ÇELİK' ile 'MEHMET SELİM ÇELİK' EŞLEŞİR", () => {
    expect(jockeyAbbrevMatchesFullName("M.S.ÇELİK", "MEHMET SELİM ÇELİK")).toBe(true);
  });
  it("boş soyad üretecek girdi (yalnız boşluk) EŞLEŞMEZ, hata FIRLATMAZ", () => {
    expect(jockeyAbbrevMatchesFullName("", "NEVZAT AVCI")).toBe(false);
    expect(jockeyAbbrevMatchesFullName("   ", "")).toBe(false);
  });
});
