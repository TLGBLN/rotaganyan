import { db } from "@/lib/db";

/**
 * v6.103 — kullanıcı kararı 2026-08-11: "Rotaganyan'ın çalışma mantığı bu olacak: veri
 * kaynaklı kazanma oranları geçirilecek. eğer yükseliş yok düşüş varsa gözden geçirilecek
 * sistem. denetleme periyodunu sen seç." Periyot SAYI bazlı seçildi (süre değil): bu gecenin
 * backtestlerinde n<20 gürültüye dönüşüyordu (bkz. AGF trend eşiği denemesi, n=12), n=66-104
 * arası net sinyal veriyordu — 100 koşuluk pencere bu eşiğin güvenli üstünde ve takvime göre
 * (gün/hafta) DEĞİL gerçek örneklem büyüklüğüne göre tetiklenir, yayın hızı değişse bile
 * istatistiksel gücü sabit tutar.
 *
 * Ek Claude çağrısı YOK — yalnız zaten `recomputeHitStatsForRace`'in bakımını yaptığı
 * `Result.hitTop1`/`hitInCoupon` alanlarını okur (bkz. src/lib/result-utils.ts). Yalnız
 * `published: true` tahminler sayılır — bu, Karma mirror kopyalarının (bkz.
 * [[project_darkrok_details_bug]] tarzı geçmiş bulgular) çift saymasını doğal olarak önler,
 * çünkü bir yarışın yalnız TEK yayınlanmış tahmini olur.
 */

const PENCERE_BOYUTU = 100;

export type PerformansPenceresi = {
  n: number;
  hitTop1Orani: number;
  hitInCouponOrani: number;
};

export type AnalizPerformansOzeti = {
  guncel: PerformansPenceresi;
  onceki: PerformansPenceresi | null;
  durum: "yukselis" | "stabil" | "dusus" | "yetersiz_veri";
  not: string;
};

function pencereOzeti(sonuclar: { hitTop1: boolean; hitInCoupon: boolean }[]): PerformansPenceresi {
  const n = sonuclar.length;
  const hitTop1 = sonuclar.filter((s) => s.hitTop1).length;
  const hitInCoupon = sonuclar.filter((s) => s.hitInCoupon).length;
  return {
    n,
    hitTop1Orani: n > 0 ? Math.round((1000 * hitTop1) / n) / 10 : 0,
    hitInCouponOrani: n > 0 ? Math.round((1000 * hitInCoupon) / n) / 10 : 0,
  };
}

export async function getAnalizPerformansOzeti(): Promise<AnalizPerformansOzeti> {
  const sonuclar = await db.result.findMany({
    where: {
      race: { prediction: { published: true } },
    },
    select: { hitTop1: true, hitInCoupon: true, enteredAt: true },
    orderBy: { enteredAt: "desc" },
    take: PENCERE_BOYUTU * 2,
  });

  const guncelHam = sonuclar.slice(0, PENCERE_BOYUTU);
  const oncekiHam = sonuclar.slice(PENCERE_BOYUTU, PENCERE_BOYUTU * 2);

  const guncel = pencereOzeti(guncelHam);
  const onceki = oncekiHam.length > 0 ? pencereOzeti(oncekiHam) : null;

  if (guncel.n < PENCERE_BOYUTU) {
    return {
      guncel, onceki,
      durum: "yetersiz_veri",
      not: `Henüz ${guncel.n}/${PENCERE_BOYUTU} sonuçlanmış+yayınlanmış koşu birikti — güvenilir bir karşılaştırma için ${PENCERE_BOYUTU} koşu gerekiyor.`,
    };
  }
  if (!onceki) {
    return {
      guncel, onceki,
      durum: "yetersiz_veri",
      not: `Güncel ${PENCERE_BOYUTU} koşu tamam, ama karşılaştırılacak ÖNCEKİ ${PENCERE_BOYUTU} koşu henüz yok — ilk ölçüm, referans olarak kaydedildi.`,
    };
  }

  const dususVar = guncel.hitTop1Orani < onceki.hitTop1Orani || guncel.hitInCouponOrani < onceki.hitInCouponOrani;
  const yukselisVar = guncel.hitTop1Orani > onceki.hitTop1Orani && guncel.hitInCouponOrani >= onceki.hitInCouponOrani;

  const durum = dususVar ? "dusus" : yukselisVar ? "yukselis" : "stabil";
  const not = dususVar
    ? `⚠ DÜŞÜŞ: son ${PENCERE_BOYUTU} koşuda galibiyet %${guncel.hitTop1Orani}/kupon-isabet %${guncel.hitInCouponOrani} — önceki ${PENCERE_BOYUTU} koşuya (%${onceki.hitTop1Orani}/%${onceki.hitInCouponOrani}) göre düşük. Sistem gözden geçirilmeli (bkz. feedback_yenilik_once_backtest metodolojisi).`
    : yukselisVar
    ? `✓ Yükseliş: %${onceki.hitTop1Orani}/%${onceki.hitInCouponOrani} → %${guncel.hitTop1Orani}/%${guncel.hitInCouponOrani}.`
    : `Stabil: %${guncel.hitTop1Orani}/%${guncel.hitInCouponOrani} (önceki %${onceki.hitTop1Orani}/%${onceki.hitInCouponOrani}).`;

  return { guncel, onceki, durum, not };
}
