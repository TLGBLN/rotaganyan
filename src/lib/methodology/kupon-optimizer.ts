// KALICI ARAÇ (V5.32, 2026-08-31) — SİLİNMİYOR.
// "Kupon Oluştur" otomasyonunun çekirdeği: her ayağın gerçek model olasılıklarına göre,
// bir bütçe (maksimum kombinasyon sayısı) içinde kalarak TÜM ayakların birlikte kazanma
// olasılığını (kapsama olasılıklarının çarpımı) maksimize eden "ilk-K at" seçimini bulur.
//
// Bugünkü Elazığ kuponlarında elle yapılan işin AYNISI, kalıcı/tekrar kullanılabilir hale
// getirildi. Elazığ K1'de yaşanan gerçek hata (eküri ortaklarının İKİSİNİ birden yazmak,
// bir slotu boşa harcamak — #6+#12 ve #1+#9 aynı anda yazılınca gerçek kazanan #5
// LARİSA'ya yer kalmamıştı) burada YAPISAL olarak engelleniyor: dedupeEkuri her eküri
// grubundan yalnız EN YÜKSEK olasılıklı üyeyi "seçilebilir" listede tutar, ama o üyenin
// KAPSADIĞI olasılık grubun TAMAMININ toplamıdır (TJK kuralı: eküri ortaklarından biri
// kazanırsa diğeri de "dolaylı kazanan" sayılır — bkz. race.service.ts'teki
// buildEkuriWinnerMap/legWon ile AYNI mantık).
//
// Sadece SEÇİM/BÜTÇE matematiği yapar — model olasılığını (.olasilik) hiçbir şekilde
// değiştirmez, yeniden hesaplamaz.

export type LegRunner = { no: number; olasilik: number; ekuriGroup?: number | null };
export type LegProbability = { raceNo: number; runners: LegRunner[] };

type EfektifAday = { no: number; kendiOlasilik: number; kapsamOlasilik: number };

/**
 * Eküri ortaklarını TEK bir "aday"a indirger: grubun en yüksek olasılıklı üyesi listede
 * kalır, kapsamOlasilik'i (kazanma kredisi kapsamı) grubun TÜM üyelerinin toplamı olur.
 * Eküri'si olmayan atlar değişmeden geçer (kapsamOlasilik = kendiOlasilik).
 * Sonuç kendiOlasilik'e göre azalan sırada döner (seçim önceliği budur — TJK'nın "en
 * olası" sıralamasıyla tutarlı; kapsamOlasilik yalnız MALİYET/KAPSAM hesabında kullanılır).
 *
 * NOT: `olasilik` alanı Faz1RunnerV5Sirali.olasilik ile AYNI ölçekte (0-1 arası KESİR,
 * %-DEĞİL) bekleniyor — v5BankoAdayiTespit'teki `(birinci.olasilik * 100)` deseniyle
 * tutarlı. Çağıran taraf ham `.olasilik` değerini DOĞRUDAN geçirmeli, 100 ile ÇARPMAMALI.
 */
export function dedupeEkuri(runners: LegRunner[]): EfektifAday[] {
  const grupToplam = new Map<number, number>();
  for (const r of runners) {
    if (r.ekuriGroup != null) {
      grupToplam.set(r.ekuriGroup, (grupToplam.get(r.ekuriGroup) ?? 0) + r.olasilik);
    }
  }
  const grupTemsilci = new Map<number, number>(); // ekuriGroup -> en yuksek olasilikli no
  for (const r of runners) {
    if (r.ekuriGroup == null) continue;
    const mevcut = grupTemsilci.get(r.ekuriGroup);
    if (mevcut == null || r.olasilik > (runners.find((x) => x.no === mevcut)?.olasilik ?? -1)) {
      grupTemsilci.set(r.ekuriGroup, r.no);
    }
  }
  const sonuc: EfektifAday[] = [];
  for (const r of runners) {
    if (r.ekuriGroup != null) {
      if (grupTemsilci.get(r.ekuriGroup) !== r.no) continue; // grubun temsilcisi değil, atla
      sonuc.push({ no: r.no, kendiOlasilik: r.olasilik, kapsamOlasilik: grupToplam.get(r.ekuriGroup) ?? r.olasilik });
    } else {
      sonuc.push({ no: r.no, kendiOlasilik: r.olasilik, kapsamOlasilik: r.olasilik });
    }
  }
  return sonuc.sort((a, b) => b.kendiOlasilik - a.kendiOlasilik);
}

export type LegAllocation = { raceNo: number; picks: number[]; coverage: number };
// totalCost YOK — bu fonksiyon stakePerCombination'ı bilmiyor (bilerek stake-agnostik
// tutuldu), çağıran taraf totalCombinations * ALTILI_STAKE_PER_COMBINATION ile hesaplar
// (race.service.ts'teki sabit tekrar tanımlanmasın diye).
export type OptimizeResult = { allocations: LegAllocation[]; totalCombinations: number; jointCoverage: number } | null;

/**
 * Her ayak için 1..N arası bir "ilk-K" kesme noktası seçip, TÜM kombinasyon sayısı
 * `maxCombinations`'ı aşmadan (ve varsa `minCombinations`'ın altında kalmadan) toplam
 * kapsama olasılığının (ayrı ayrı kapsama olasılıklarının ÇARPIMI — tüm ayaklar birden
 * tutmalı) en yüksek olduğu tahsisi bulur. DP durumu = "şu ana kadar kullanılan
 * kombinasyon sayısı" (maxCombinations ile sınırlı, pratikte birkaç bin durum).
 */
export function optimizeKuponAllocation(
  legs: LegProbability[],
  maxCombinations: number,
  minCombinations = 1
): OptimizeResult {
  if (legs.length === 0 || maxCombinations < 1) return null;

  const efektifPerLeg = legs.map((l) => dedupeEkuri(l.runners));
  // kapsamCum[legIdx][k] = ilk k adayin (kendiOlasilik'e gore) kapsamOlasilik TOPLAMI (k>=1)
  const kapsamCum: number[][] = efektifPerLeg.map((aday) => {
    const cum: number[] = [0];
    for (const a of aday) cum.push(cum[cum.length - 1] + a.kapsamOlasilik);
    return cum;
  });

  // dp: combosUsed -> { coverage, secimler: k[] (her ayak icin secilen k) }
  let dp = new Map<number, { coverage: number; secimler: number[] }>([[1, { coverage: 1, secimler: [] }]]);

  for (let legIdx = 0; legIdx < legs.length; legIdx++) {
    const adaySayisi = efektifPerLeg[legIdx].length;
    if (adaySayisi === 0) return null; // bos saha, optimize edilemez
    const yeniDp = new Map<number, { coverage: number; secimler: number[] }>();
    for (const [combosSoFar, durum] of dp) {
      for (let k = 1; k <= adaySayisi; k++) {
        const yeniCombos = combosSoFar * k;
        if (yeniCombos > maxCombinations) break; // k artan sirada, daha buyuk k de gecmez
        const yeniCoverage = durum.coverage * kapsamCum[legIdx][k];
        const mevcut = yeniDp.get(yeniCombos);
        if (!mevcut || yeniCoverage > mevcut.coverage) {
          yeniDp.set(yeniCombos, { coverage: yeniCoverage, secimler: [...durum.secimler, k] });
        }
      }
    }
    if (yeniDp.size === 0) return null; // butce bu ayagi tek atla bile karsilayamiyor
    dp = yeniDp;
  }

  let enIyi: { combos: number; coverage: number; secimler: number[] } | null = null;
  for (const [combos, durum] of dp) {
    if (combos < minCombinations) continue;
    if (!enIyi || durum.coverage > enIyi.coverage) enIyi = { combos, coverage: durum.coverage, secimler: durum.secimler };
  }
  if (!enIyi) return null;

  const allocations: LegAllocation[] = legs.map((l, i) => {
    const k = enIyi!.secimler[i];
    const aday = efektifPerLeg[i].slice(0, k);
    return { raceNo: l.raceNo, picks: aday.map((a) => a.no), coverage: kapsamCum[i][k] };
  });

  return { allocations, totalCombinations: enIyi.combos, jointCoverage: enIyi.coverage };
}
