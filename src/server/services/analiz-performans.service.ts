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
 * `Result.hitTop1`/`hitInCoupon` alanlarını okur (bkz. src/lib/result-utils.ts).
 *
 * 2026-09-07 kullanıcı bulgusu — DÜZELTME: bu dosya önceden "yalnız published:true
 * tahminler sayılır, bu Karma mirror'ların çift saymasını doğal olarak önler, çünkü bir
 * yarışın yalnız TEK yayınlanmış tahmini olur" diyordu — bu YANLIŞTI. Karma bir koşu,
 * asıl koşudan BAĞIMSIZ bir Race satırıdır (Race.conditions ile asıl koşuyu işaret eder,
 * bkz. syncKarmaMirrors/syncKarmaResultMirrors) — kendi AYRI Prediction'ı ve Result'ı
 * vardır, ikisi de "TEK" ama BİRBİRİNDEN bağımsız iki satırdır. Gerçek ölçüm: 810 sonuçtan
 * 155'i (%19) Karma mirror kopyasıydı — aynı gerçek koşu iki kez sayılıp 100'lük pencereyi
 * (gerçekte ~80 bağımsız koşuluk bilgiyi 100'e şişirerek) çarpıtıyordu. Artık projedeki
 * HER YERDEKİ aynı desenle (bkz. [[feedback_karma_cift_sayim_kontrolu]]) `conditions: null`
 * filtreleniyor.
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

// 2026-09-27 kullanıcı bulgusu: eski mantık HAM oran farkına (guncel < onceki) bakıyordu —
// n=100'de %30 vs %31 gibi, standart hatanın (~%4.6 puan) beşte biri bile olmayan bir fark
// bile "DÜŞÜŞ, sistem gözden geçirilmeli" diye kırmızı alarm veriyordu; üstelik VEYA (||)
// mantığı yüzünden kupon-isabeti GERÇEKTEN yükselmişken (%60→%63) bunu görünmez kılıp
// yalnız gürültü seviyesindeki galibiyet farkına bakarak genel "düşüş" etiketi basıyordu.
// İki bağımsız oranın (n1, n2) GERÇEKTEN farklı olup olmadığını klasik iki-örneklem oran
// z-testiyle (pooled standard error) ölçüyoruz — |z|≥1.96 yalnızca %95 güvenle şansla
// açıklanamayacak kadar büyük farklarda "anlamlı" sayılır, projenin başka yerlerinde zaten
// kullanılan Wilson-GA yaklaşımıyla aynı istatistiksel aileden.
function ikiOranAnlamliFarkli(
  p1Yuzde: number, n1: number, p2Yuzde: number, n2: number
): { anlamli: boolean; yon: "artis" | "azalis" | null; z: number } {
  if (n1 === 0 || n2 === 0) return { anlamli: false, yon: null, z: 0 };
  const p1 = p1Yuzde / 100, p2 = p2Yuzde / 100;
  const pPooled = (p1 * n1 + p2 * n2) / (n1 + n2);
  const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / n1 + 1 / n2));
  if (se === 0) return { anlamli: false, yon: null, z: 0 };
  const z = (p1 - p2) / se;
  const anlamli = Math.abs(z) >= 1.96;
  return { anlamli, yon: anlamli ? (z > 0 ? "artis" : "azalis") : null, z };
}

export async function getAnalizPerformansOzeti(): Promise<AnalizPerformansOzeti> {
  const sonuclar = await db.result.findMany({
    where: {
      race: { prediction: { published: true }, conditions: null },
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

  const galibiyetTest = ikiOranAnlamliFarkli(guncel.hitTop1Orani, guncel.n, onceki.hitTop1Orani, onceki.n);
  const kuponTest = ikiOranAnlamliFarkli(guncel.hitInCouponOrani, guncel.n, onceki.hitInCouponOrani, onceki.n);

  const dususVar = galibiyetTest.yon === "azalis" || kuponTest.yon === "azalis";
  const yukselisVar = !dususVar && (galibiyetTest.yon === "artis" || kuponTest.yon === "artis");

  const durum = dususVar ? "dusus" : yukselisVar ? "yukselis" : "stabil";
  // Hangi metriğin GERÇEKTEN (istatistiksel olarak) değiştiğini, hangisinin şans/gürültü
  // sınırları içinde kaldığını (n=100'de ~1-2 puanlık farklar tipik olarak gürültüdür)
  // açıkça ayırt eden metin — eskiden ham fark yeterliydi, artık hangi rakamın anlamlı
  // olduğu okuyucuya söyleniyor.
  const galibiyetMetni = galibiyetTest.anlamli
    ? `galibiyet %${onceki.hitTop1Orani}→%${guncel.hitTop1Orani} (${galibiyetTest.yon === "artis" ? "anlamlı artış" : "anlamlı düşüş"})`
    : `galibiyet %${onceki.hitTop1Orani}→%${guncel.hitTop1Orani} (fark gürültü sınırları içinde, anlamlı değil)`;
  const kuponMetni = kuponTest.anlamli
    ? `kupon-isabet %${onceki.hitInCouponOrani}→%${guncel.hitInCouponOrani} (${kuponTest.yon === "artis" ? "anlamlı artış" : "anlamlı düşüş"})`
    : `kupon-isabet %${onceki.hitInCouponOrani}→%${guncel.hitInCouponOrani} (fark gürültü sınırları içinde, anlamlı değil)`;
  const not = dususVar
    ? `⚠ DÜŞÜŞ: son ${PENCERE_BOYUTU} koşuda ${galibiyetMetni}, ${kuponMetni}. Sistem gözden geçirilmeli (bkz. feedback_yenilik_once_backtest metodolojisi).`
    : yukselisVar
    ? `✓ Yükseliş: ${galibiyetMetni}, ${kuponMetni}.`
    : `Stabil: ${galibiyetMetni}, ${kuponMetni}.`;

  return { guncel, onceki, durum, not };
}
