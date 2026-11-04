import { describe, expect, it } from "vitest";
import { otomatikGroupSelections, computeAllocatorTiers, zayifTipTabanlari, ZAYIF_TIP_MIN_SECIM, type AutoFillRace, LIMITS, TOLERANCES, WIDTHS } from "./kupon-auto-fill";

// 2026-10-11 — bu dosya KuponForm.tsx'ten BİREBİR aynı mantıkla taşındı (davranış
// değişmedi); bu test hem taşımanın hem de computeAllocatorTiers'ın (publish-time RCA
// snapshot'ın kullandığı, AYNI DP çağrısının zengin OptimizeResult döndüren hali)
// otomatikGroupSelections ile TUTARLI (aynı seçimleri üreten) olduğunu doğruluyor —
// ikisi birbirinden sapmamalı, aksi halde server'ın "optimizer ne seçerdi" hesabı
// client'ın ⚡ Otomatik Doldur'undan FARKLI çıkar.
const races: AutoFillRace[] = [
  { raceNo: 1, runners: [
    { no: 1, scratched: false, ekuriGroup: null, score: null, scoreExact: 40 },
    { no: 2, scratched: false, ekuriGroup: null, score: null, scoreExact: 30 },
    { no: 3, scratched: false, ekuriGroup: null, score: null, scoreExact: 20 },
    { no: 4, scratched: false, ekuriGroup: null, score: null, scoreExact: 10 },
  ] },
  { raceNo: 2, runners: [
    { no: 1, scratched: false, ekuriGroup: null, score: null, scoreExact: 50 },
    { no: 2, scratched: false, ekuriGroup: null, score: null, scoreExact: 25 },
    { no: 3, scratched: false, ekuriGroup: null, score: null, scoreExact: 25 },
  ] },
];

describe("computeAllocatorTiers ↔ otomatikGroupSelections tutarlılığı", () => {
  it("her kademe için computeAllocatorTiers.selections, otomatikGroupSelections'ın Set'iyle AYNI at numaralarını üretir", () => {
    const groupSel = otomatikGroupSelections(races, 1.25, LIMITS, TOLERANCES);
    const tiers = computeAllocatorTiers(races, 1.25, LIMITS, TOLERANCES);

    for (const tier of tiers) {
      for (const race of races) {
        const fromTiers = [...(tier.selections[race.raceNo] ?? [])].sort((a, b) => a - b);
        const fromGroupSel = [...(groupSel[race.raceNo]?.[tier.width] ?? new Set<number>())].sort((a, b) => a - b);
        expect(fromTiers).toEqual(fromGroupSel);
      }
    }
  });

  it("kademeler bütçeyi aşmaz ve narrow→normal→wide taban-mirası korunur (eksiltme yok)", () => {
    const tiers = computeAllocatorTiers(races, 1.25, LIMITS, TOLERANCES);
    const byWidth = new Map(tiers.map((t) => [t.width, t]));
    for (const w of WIDTHS) expect(byWidth.get(w)!.combinationLimit).toBeGreaterThan(0);

    for (const race of races) {
      const narrowN = byWidth.get("narrow")!.selections[race.raceNo]?.length ?? 0;
      const normalN = byWidth.get("normal")!.selections[race.raceNo]?.length ?? 0;
      const wideN = byWidth.get("wide")!.selections[race.raceNo]?.length ?? 0;
      expect(normalN).toBeGreaterThanOrEqual(narrowN);
      expect(wideN).toBeGreaterThanOrEqual(normalN);
    }
  });
});

// 2026-11-04 — "kaybedilen kazananlar" araştırmasının kupon optimizörüne bağlanması:
// zayıf-10 tipte (bkz. project_kaybedilen_kazananlar_hedef_listesi) Ekonomik kademe bile
// en az ZAYIF_TIP_MIN_SECIM at seçmeli, güçlü/bilinmeyen tiplerde davranış DEĞİŞMEMELİ.
describe("zayıf-tip tabanı (kaybedilen kazananlar -> optimizör köprüsü)", () => {
  // Gerçekçi 6 ayaklı (Altılı) senaryo, dar Ekonomik bütçe altında — favori-ağırlıklı
  // dağılım, tek ayaklık testlerde bütçe bolluğundan tabanın hiç tetiklenmediği
  // (yanlış-negatif) bir ilk deneme düzeltildi: 6 ayak PAYLAŞIMLI bütçe için rekabet
  // etmeli ki taban gerçekten bir şey DEĞİŞTİRSİN.
  const favoriAgirlikli = [80, 8, 5, 3, 2, 1, 0.6, 0.4];
  const mkRunners = () => favoriAgirlikli.map((p, i) => ({ no: i + 1, scratched: false, ekuriGroup: null, score: null, scoreExact: p }));
  const zayifRaces: AutoFillRace[] = [1, 2, 3, 4, 5, 6].map((raceNo) => ({
    raceNo,
    classType: raceNo === 1 ? "Handikap 21" : "G 1", // yalnız 1. ayak zayıf tip (ZAYIF_TIPLER'de)
    runners: mkRunners(),
  }));
  const classTypeOlmayanRaces: AutoFillRace[] = zayifRaces.map(({ classType: _classType, ...rest }) => rest);

  it("zayifTipTabanlari yalnız bilinen zayıf tipler için taban döner, classType eksikse boş", () => {
    expect(zayifTipTabanlari(zayifRaces)).toEqual({ 1: ZAYIF_TIP_MIN_SECIM });
    expect(zayifTipTabanlari(classTypeOlmayanRaces)).toEqual({});
  });

  it("Ekonomik kademede zayıf tip en az ZAYIF_TIP_MIN_SECIM at seçer, AYNI dağılımlı güçlü tip (G1) kendi doğal (daha dar) seçimini korur", () => {
    const groupSel = otomatikGroupSelections(zayifRaces, 1.25, LIMITS, TOLERANCES);
    expect(groupSel[1].narrow.size).toBeGreaterThanOrEqual(ZAYIF_TIP_MIN_SECIM);
    // Diğer 5 ayak (G1, aynı olasılık şekli, taban YOK) paylaşımlı bütçe altında
    // tabandan daha dar seçmeli — aksi halde test anlamsız olurdu.
    for (const raceNo of [2, 3, 4, 5, 6]) {
      expect(groupSel[raceNo].narrow.size).toBeLessThan(ZAYIF_TIP_MIN_SECIM);
    }
  });

  // 2026-11-04 CANLIDA yakalanan gerçek bug: bir Altılı grubunda BİRDEN FAZLA ayak
  // zayıf tipse (ör. hepsi Maiden), tabanların çarpımı (4^6) Ekonomik bütçeyi aşıyor
  // ve DP TÜM kuponu BOŞ döndürüyordu (bir ayağın tabanı yüzünden diğer TÜM ayaklar da
  // seçimsiz kalıyordu) — kullanıcı ekran görüntüsüyle bildirdi ("neden ekonomik kupon
  // hazırlamıyor"). kupon-optimizer.ts'teki taban-ürünü-kademeli-küçültme düzeltmesi
  // bunu önlüyor: hiçbir kademe asla tamamen boş dönmemeli.
  it("TÜM ayaklar zayıf tipse (en kötü senaryo), Ekonomik kademe ASLA tamamen boş dönmez", () => {
    const hepsiZayif: AutoFillRace[] = [1, 2, 3, 4, 5, 6].map((raceNo) => ({
      raceNo,
      classType: "Maiden",
      runners: mkRunners(),
    }));
    const groupSel = otomatikGroupSelections(hepsiZayif, 1.25, LIMITS, TOLERANCES);
    for (const raceNo of [1, 2, 3, 4, 5, 6]) {
      expect(groupSel[raceNo].narrow.size).toBeGreaterThan(0);
      // Geniş genişlik asla dardan dar olamaz (mevcut zincirleme garantisi korunmalı).
      expect(groupSel[raceNo].wide.size).toBeGreaterThanOrEqual(groupSel[raceNo].narrow.size);
    }
  });

  it("classType verilmeyen (eski/eksik veri) senaryoda zayıf-tip tabanı HİÇ tetiklenmez", () => {
    // DP ORTAK bütçeyi optimize ettiği için (bkz. kupon-optimizer.ts başı) bir ayağın
    // tabanı genişleyince PAYLAŞILAN bütçeden diğer ayaklara az kalır — yani G1 ayakları
    // (2-6) classType'lı/classType'sız senaryoda BİREBİR aynı kalmayabilir, bu bug değil,
    // ortak optimizasyonun doğal sonucu. Asıl garanti edilmesi gereken: classType hiç
    // verilmezse 1. ayak için taban HİÇ uygulanmaz (zayifTipTabanlari zaten {} döner).
    const withoutClassType = otomatikGroupSelections(classTypeOlmayanRaces, 1.25, LIMITS, TOLERANCES);
    expect(zayifTipTabanlari(classTypeOlmayanRaces)).toEqual({});
    expect(withoutClassType[1].narrow.size).toBeLessThan(ZAYIF_TIP_MIN_SECIM);
  });
});
