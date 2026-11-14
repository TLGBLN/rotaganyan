import { describe, expect, it } from "vitest";
import { otomatikGroupSelections, computeAllocatorTiers, zayifTipTabanlari, zayifTipTabanlariSinirli, ZAYIF_TIP_MIN_SECIM_BY_WIDTH, type AutoFillRace, LIMITS, TOLERANCES, WIDTHS } from "./kupon-auto-fill";

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
// zayıf-10 tipte (bkz. project_kaybedilen_kazananlar_hedef_listesi) her kademe en az
// ZAYIF_TIP_MIN_SECIM_BY_WIDTH[width] at seçmeli, güçlü/bilinmeyen tiplerde davranış
// DEĞİŞMEMELİ. Taban kademeyle BİRLİKTE büyür (narrow=4 < normal=6 < wide=8) — bkz.
// aşağıdaki "kademeyle birlikte büyür" testi (gerçek canlı vaka: Handikap 17, 5. Koşu).
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
    // 1. ayak (zayıf tip) DÜZ dağılımlı: taban, kapsama-hedefi tavanına (2026-11-14) takılmadan tam uygulansın.
    // (%80'lik tek favorili zayıf ayakta taban artık bilerek küçülür — aşağıdaki "kapsama-hedefi tavanı" testlerine bak.)
    runners: raceNo === 1 ? Array.from({ length: 10 }, (_, i) => ({ no: i + 1, scratched: false, ekuriGroup: null, score: null, scoreExact: 10 })) : mkRunners(),
  }));
  const classTypeOlmayanRaces: AutoFillRace[] = zayifRaces.map(({ classType: _classType, ...rest }) => rest);

  it("zayifTipTabanlari yalnız bilinen zayıf tipler için taban döner, classType eksikse boş", () => {
    expect(zayifTipTabanlari(zayifRaces, "narrow")).toEqual({ 1: ZAYIF_TIP_MIN_SECIM_BY_WIDTH.narrow });
    expect(zayifTipTabanlari(zayifRaces, "wide")).toEqual({ 1: ZAYIF_TIP_MIN_SECIM_BY_WIDTH.wide });
    expect(zayifTipTabanlari(classTypeOlmayanRaces, "narrow")).toEqual({});
  });

  it("Ekonomik kademede zayıf tip en az narrow-tabanı kadar at seçer, AYNI dağılımlı güçlü tip (G1) kendi doğal (daha dar) seçimini korur", () => {
    const groupSel = otomatikGroupSelections(zayifRaces, 1.25, LIMITS, TOLERANCES);
    expect(groupSel[1].narrow.size).toBeGreaterThanOrEqual(ZAYIF_TIP_MIN_SECIM_BY_WIDTH.narrow);
    // Diğer 5 ayak (G1, aynı olasılık şekli, taban YOK) paylaşımlı bütçe altında
    // tabandan daha dar seçmeli — aksi halde test anlamsız olurdu.
    for (const raceNo of [2, 3, 4, 5, 6]) {
      expect(groupSel[raceNo].narrow.size).toBeLessThan(ZAYIF_TIP_MIN_SECIM_BY_WIDTH.narrow);
    }
  });

  // 2026-11-04 CANLIDA yakalanan gerçek vaka (Handikap 17, 5. Koşu, ekran görüntüsüyle
  // bildirildi): taban TEK sabit değerken (eskiden 4, üç kademede de aynı), paylaşımlı
  // bütçe rekabeti yüzünden Normal/Geniş'in çok daha büyük bütçesi olsa bile zayıf ayak
  // tam tabanda DONUP KALIYORDU (ARAM SAMSAM gibi 5.+ atlar hiçbir kademede giremiyordu).
  // Artık taban kademeyle BİRLİKTE büyüdüğü için (narrow=4 < normal=6 < wide=8), Geniş
  // kademe en az kendi (daha yüksek) tabanını garanti etmeli — narrow'un tabanında donup
  // kalmamalı.
  it("zayıf tipte taban kademeyle BİRLİKTE büyür — Geniş, Ekonomik'in tabanında donup kalmaz", () => {
    const groupSel = otomatikGroupSelections(zayifRaces, 1.25, LIMITS, TOLERANCES);
    expect(groupSel[1].narrow.size).toBeGreaterThanOrEqual(ZAYIF_TIP_MIN_SECIM_BY_WIDTH.narrow);
    expect(groupSel[1].normal.size).toBeGreaterThanOrEqual(ZAYIF_TIP_MIN_SECIM_BY_WIDTH.normal);
    expect(groupSel[1].wide.size).toBeGreaterThanOrEqual(ZAYIF_TIP_MIN_SECIM_BY_WIDTH.wide);
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
      // Hiçbir kademe bir öncekinden DAR olamaz (zincirleme garantisi korunmalı).
      expect(groupSel[raceNo].normal.size).toBeGreaterThanOrEqual(groupSel[raceNo].narrow.size);
      expect(groupSel[raceNo].wide.size).toBeGreaterThanOrEqual(groupSel[raceNo].normal.size);
    }
  });

  // 2026-11-04 CANLIDA yakalanan ÜÇÜNCÜ bug (gerçek vaka, İstanbul 04.11.2026 1. Altılı —
  // 5/6 ayak AYNI ANDA zayıf tip: Maiden/Şartlı4/Handikap15/Şartlı4/Handikap17): yukarıdaki
  // "taban ürünü küçültme" düzeltmesi TÜM tabanları eşit indirilebilir sayıyordu — bu,
  // ÖNCEKİ (dar) kademenin ZATEN elde ettiği sonucu da indirip Normal'in Ekonomik'ten
  // DAHA DAR çıkmasına sebep oluyordu (kullanıcı ekran görüntüsüyle bildirdi: narrow=5,
  // normal=4). optimizeKuponAllocation'a eklenen minHardFloor (önceki kademenin sonucu,
  // ASLA indirilemez) + minUnitCounts (zayıf-tip hedefi, ESNEK) ayrımı bunu çözüyor.
  it("5/6 ayak aynı anda zayıf tipse bile hiçbir kademe bir öncekinden DAR olmaz (gerçek vaka)", () => {
    const mkRace = (raceNo: number, classType: string, probs: number[]): AutoFillRace => ({
      raceNo, classType,
      runners: probs.map((p, i) => ({ no: i + 1, scratched: false, ekuriGroup: null, score: null, scoreExact: p })),
    });
    const cokZayifRaces: AutoFillRace[] = [
      mkRace(1, "Maiden", [25, 18, 15, 12, 10, 8, 5, 4, 2, 1]),
      mkRace(2, "ŞARTLI 4", [30, 20, 15, 10, 8, 7, 5, 3, 2]),
      mkRace(3, "Handikap 15", [63.1, 15.2, 9.3, 6.3, 6.0]),
      mkRace(4, "ŞARTLI 4", [21.7, 19.2, 15.7, 12.5, 8.6, 5.7, 5.7, 4.9, 3.5, 2.6]),
      mkRace(5, "Handikap 17", [18.6, 17.9, 13.8, 8.2, 7.1, 6.2, 5.0, 4.5, 4.1, 3.8, 3.5, 3.0, 2.5, 2.0, 1.1]),
      mkRace(6, "SATIŞ 3", [40, 20, 12, 8, 6, 5, 4, 3, 1, 1]), // tek güçlü/zayıf-olmayan ayak
    ];
    const groupSel = otomatikGroupSelections(cokZayifRaces, 1.25, LIMITS, TOLERANCES);
    for (const race of cokZayifRaces) {
      const s = groupSel[race.raceNo];
      expect(s.normal.size).toBeGreaterThanOrEqual(s.narrow.size);
      expect(s.wide.size).toBeGreaterThanOrEqual(s.normal.size);
    }
  });

  it("classType verilmeyen (eski/eksik veri) senaryoda zayıf-tip tabanı HİÇ tetiklenmez", () => {
    // DP ORTAK bütçeyi optimize ettiği için (bkz. kupon-optimizer.ts başı) bir ayağın
    // tabanı genişleyince PAYLAŞILAN bütçeden diğer ayaklara az kalır — yani G1 ayakları
    // (2-6) classType'lı/classType'sız senaryoda BİREBİR aynı kalmayabilir, bu bug değil,
    // ortak optimizasyonun doğal sonucu. Asıl garanti edilmesi gereken: classType hiç
    // verilmezse 1. ayak için taban HİÇ uygulanmaz (zayifTipTabanlari zaten {} döner).
    const withoutClassType = otomatikGroupSelections(classTypeOlmayanRaces, 1.25, LIMITS, TOLERANCES);
    expect(zayifTipTabanlari(classTypeOlmayanRaces, "narrow")).toEqual({});
    // (Düz dağılımlı 1. ayakta DP zaten doğal olarak çok at seçebilir; asıl garanti tabanın hiç OLUŞMAMASI.)
    expect(zayifTipTabanlariSinirli(classTypeOlmayanRaces, "narrow")).toEqual({});
    expect(withoutClassType[1].narrow.size).toBeGreaterThanOrEqual(1);
  });
});

// 2026-11-14 (Ankara 1. Altılı: K2 Maiden'de %35'lik favori ETMAN varken 4/5/6 at, K4 Handikap 21'de %47'lik favoriyle 7 at
// yazılırken düz dağılımlı K1'e 2 at kaldı → DEJAME dışarıda, ilk ayakta yattı): zayıf-tip tabanı ayağın kendi olasılığına göre
// kapsama-hedefi tavanıyla sınırlanır.
describe("zayıf-tip tabanı — kapsama-hedefi tavanı (zayifTipTabanlariSinirli)", () => {
  const mk = (raceNo: number, classType: string, ps: number[]): AutoFillRace => ({ raceNo, classType, runners: ps.map((p, i) => ({ no: i + 1, scratched: false, ekuriGroup: null, score: null, scoreExact: p })) });

  it("güçlü favorili zayıf-tip ayakta taban KÜÇÜLÜR (%80 favori → Ekonomik/Normal'de 1, Geniş'te 2 at yeter)", () => {
    const r = [mk(1, "Handikap 21", [80, 8, 5, 3, 2, 1, 0.6, 0.4])];
    expect(zayifTipTabanlari(r, "wide")[1]).toBe(ZAYIF_TIP_MIN_SECIM_BY_WIDTH.wide);
    expect(zayifTipTabanlariSinirli(r, "narrow")[1]).toBe(1);
    expect(zayifTipTabanlariSinirli(r, "normal")[1]).toBe(1);
    expect(zayifTipTabanlariSinirli(r, "wide")[1]).toBe(2);
  });

  it("düz dağılımlı zayıf-tip ayakta taban AYNEN korunur", () => {
    const r = [mk(1, "Handikap 16", Array.from({ length: 10 }, () => 10))];
    expect(zayifTipTabanlariSinirli(r, "narrow")[1]).toBe(4);
    expect(zayifTipTabanlariSinirli(r, "normal")[1]).toBe(6);
    expect(zayifTipTabanlariSinirli(r, "wide")[1]).toBe(8);
  });

  it("Ankara K2 Maiden (ETMAN %34.9 ...) → taban 4/5/5 (eskiden 4/6/8)", () => {
    const r = [mk(2, "Maiden/DHÖW", [34.9, 16.1, 11.6, 11.5, 11.5, 7.7, 2.6, 1.5, 1.4, 1.2])];
    expect(zayifTipTabanlariSinirli(r, "narrow")[2]).toBe(4);
    expect(zayifTipTabanlariSinirli(r, "normal")[2]).toBe(5);
    expect(zayifTipTabanlariSinirli(r, "wide")[2]).toBe(5);
  });

  it("zayıf olmayan tipte taban hiç oluşmaz, olasılığı olmayan zayıf ayakta ham taban korunur", () => {
    expect(zayifTipTabanlariSinirli([mk(1, "ŞARTLI 5", [24, 23, 17, 17, 8, 6, 5])], "wide")).toEqual({});
    expect(zayifTipTabanlariSinirli([mk(1, "Handikap 16", [0, 0, 0, 0])], "normal")[1]).toBe(6);
  });

  it("taban tavanı ASLA ham tabanı AŞMAZ ve en az 1'dir", () => {
    const r = [mk(1, "Handikap 16", Array.from({ length: 20 }, () => 5))];
    for (const w of ["narrow", "normal", "wide"] as const) { const t = zayifTipTabanlariSinirli(r, w)[1]; expect(t).toBeLessThanOrEqual(ZAYIF_TIP_MIN_SECIM_BY_WIDTH[w]); expect(t).toBeGreaterThanOrEqual(1); }
  });

  it("Ankara 1. Altılı vakası: favorili zayıf ayaklar (K2/K4) küçülen tabanla bütçeyi düz K1'e bırakır — K1'e Geniş'te en az 3 at", () => {
    const ayaklar: AutoFillRace[] = [
      mk(1, "ŞARTLI 5", [24.2, 23.4, 16.8, 16.7, 8.1, 6.3, 4.5]),
      mk(2, "Maiden/DHÖW", [34.9, 16.1, 11.6, 11.5, 11.5, 7.7, 2.6, 1.5, 1.4, 1.2]),
      mk(3, "SATIŞ 3", [34.1, 32.3, 14.6, 13.9, 5.1]),
      mk(4, "Handikap 21 /H1", [47.4, 15.4, 12.8, 9.8, 7.8, 3.5, 3.3]),
      mk(5, "Handikap 16 /H1", [23.5, 12.5, 11.5, 10, 8.2, 6.6, 6, 5.5, 5, 4.2, 3]),
      mk(6, "G 2/ULS", [26.1, 23.9, 16.1, 10.8, 7.5, 6.1, 5, 4.5]),
    ];
    const t = computeAllocatorTiers(ayaklar, 1.25);
    const k1 = (w: string) => (t.find((x) => x.width === w)!.selections[1] ?? []).length;
    const k4 = (w: string) => (t.find((x) => x.width === w)!.selections[4] ?? []).length;
    expect(k1("wide")).toBeGreaterThanOrEqual(3);
    expect(k4("wide")).toBeLessThan(7); // eskiden %47'lik favorili Handikap 21'e 7 at yazılıyordu
  });
});
