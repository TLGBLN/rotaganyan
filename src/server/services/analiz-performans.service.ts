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
 *
 * 2026-09-21 kullanıcı denetimi — DÜZELTME: eski kural `top1 azaldı VEYA kupon azaldı`
 * hiçbir istatistiksel eşik içermiyordu, iki metrikten biri şans eseri en ufak düşse bile
 * (top1 GERÇEKTE yükselirken bile) "DÜŞÜŞ, sistem gözden geçirilmeli" kırmızı uyarısı
 * veriyordu — gerçek vaka: top1 %31→%33 (z=+0.30), kupon %64→%61 (z=-0.44), İKİSİ DE
 * gürültünün çok altında ama panel yine de DÜŞÜŞ diyordu. Artık iki-oranlı z-testi + pratik
 * effect-size eşiği birlikte kullanılıyor (kullanıcının verdiği formülle BİREBİR):
 *   z = (p_güncel - p_önceki) / sqrt(p_güncel(1-p_güncel)/n_güncel + p_önceki(1-p_önceki)/n_önceki)
 *   DÜŞÜŞ: (Δtop1<0 VE zTop1<=-1.96) VEYA (Δkupon<0 VE zKupon<=-1.96)
 *   İZLE:  DÜŞÜŞ değil VE (Δtop1<=-5pp VEYA Δkupon<=-5pp) — istatistiksel kanıt yok ama
 *          pratik düşüş gözle görülür, henüz alarm değil
 *   STABİL: ikisi de değil
 * -1.96 (±%95, iki-taraflı) BİLEREK -1.645 (tek-taraflı %95) yerine seçildi — iki AYRI
 * metrik AYNI ANDA izlendiği için (multiple comparisons), daha gevşek bir eşik yanlış
 * alarm oranını artırırdı.
 *
 * Üçüncü ölçüm: race-level LogLoss (V5.46'nın asıl birincil metriği, bkz.
 * [[feedback_champion_challenger_logloss_birincil]]) — Top1/kupon-isabet SIRALAMA
 * kalitesini ölçer, olasılık KALİBRASYONUNU ÖLÇMEZ (top1 değişmeden model aşırı-güvenli/
 * aşırı-temkinli hale gelebilir). Her koşu için gerçek kazanan(lar)ın (winnerNos, beraberlik
 * dahil) kaydedilmiş Pick.scoreExact toplamından -ln(P) hesaplanır — yalnız BİLGİ amaçlı
 * gösteriliyor, henüz ayrı bir alarm eşiği YOK (kullanıcı: "ilk düzeltme için z+effect-size
 * çok daha doğru", clustered-bootstrap tabanlı bir eşik ayrı bir backtest gerektirir).
 * scoreExact NULL olan (eski/tamamlanmamış) pick'lere sahip koşular kapsam dışı bırakılır —
 * `logLossKapsam` bunu şeffaf gösterir, sessizce 0 veya yanlış bir sayı ÜRETİLMEZ.
 */

const PENCERE_BOYUTU = 100;
const Z_ESIGI = 1.96;
const IZLE_ESIGI = 0.05; // 5 yüzde puan (oran cinsinden 0.05)

export type PerformansPenceresi = {
  n: number;
  hitTop1Orani: number;
  hitInCouponOrani: number;
  logLoss: number | null;
  logLossKapsam: number;
};

export type AnalizPerformansOzeti = {
  guncel: PerformansPenceresi;
  onceki: PerformansPenceresi | null;
  durum: "stabil" | "izle" | "dusus" | "yetersiz_veri";
  not: string;
  istatistik?: { zTop1: number; zKupon: number };
};

type SonucSatiri = {
  hitTop1: boolean;
  hitInCoupon: boolean;
  winnerNos: number[];
  race: { prediction: { picks: { scoreExact: number | null; runner: { no: number } | null }[] } | null };
};

function raceLogLoss(s: SonucSatiri): number | null {
  if (!s.winnerNos || s.winnerNos.length === 0) return null;
  const picks = s.race.prediction?.picks ?? [];
  const kazananPickler = picks.filter((p) => p.runner?.no != null && s.winnerNos.includes(p.runner.no));
  if (kazananPickler.length === 0) return null;
  if (kazananPickler.some((p) => p.scoreExact == null)) return null;
  const pKazanan = kazananPickler.reduce((sum, p) => sum + (p.scoreExact ?? 0), 0) / 100;
  const kirpilmis = Math.min(0.999999, Math.max(1e-6, pKazanan));
  return -Math.log(kirpilmis);
}

function pencereOzeti(sonuclar: SonucSatiri[]): PerformansPenceresi {
  const n = sonuclar.length;
  const hitTop1 = sonuclar.filter((s) => s.hitTop1).length;
  const hitInCoupon = sonuclar.filter((s) => s.hitInCoupon).length;
  const logLossDegerleri = sonuclar.map(raceLogLoss).filter((v): v is number => v != null);
  return {
    n,
    hitTop1Orani: n > 0 ? Math.round((1000 * hitTop1) / n) / 10 : 0,
    hitInCouponOrani: n > 0 ? Math.round((1000 * hitInCoupon) / n) / 10 : 0,
    logLoss: logLossDegerleri.length > 0 ? Math.round((logLossDegerleri.reduce((a, b) => a + b, 0) / logLossDegerleri.length) * 1000) / 1000 : null,
    logLossKapsam: logLossDegerleri.length,
  };
}

function ikiOranZ(p1: number, n1: number, p2: number, n2: number): number {
  const se = Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2);
  return se > 0 ? (p1 - p2) / se : 0;
}

export async function getAnalizPerformansOzeti(): Promise<AnalizPerformansOzeti> {
  const sonuclar = await db.result.findMany({
    where: { race: { prediction: { published: true }, conditions: null } },
    select: {
      hitTop1: true,
      hitInCoupon: true,
      enteredAt: true,
      winnerNos: true,
      race: { select: { prediction: { select: { picks: { select: { scoreExact: true, runner: { select: { no: true } } } } } } } },
    },
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

  const pTop1G = guncel.hitTop1Orani / 100, pTop1O = onceki.hitTop1Orani / 100;
  const pKupG = guncel.hitInCouponOrani / 100, pKupO = onceki.hitInCouponOrani / 100;
  const deltaTop1 = pTop1G - pTop1O;
  const deltaKup = pKupG - pKupO;
  const zTop1 = ikiOranZ(pTop1G, guncel.n, pTop1O, onceki.n);
  const zKupon = ikiOranZ(pKupG, guncel.n, pKupO, onceki.n);

  const dususVar = (deltaTop1 < 0 && zTop1 <= -Z_ESIGI) || (deltaKup < 0 && zKupon <= -Z_ESIGI);
  const izleVar = !dususVar && (deltaTop1 <= -IZLE_ESIGI || deltaKup <= -IZLE_ESIGI);
  const durum: AnalizPerformansOzeti["durum"] = dususVar ? "dusus" : izleVar ? "izle" : "stabil";

  const deltaTop1Pp = Math.round(deltaTop1 * 1000) / 10;
  const deltaKuponPp = Math.round(deltaKup * 1000) / 10;
  const isaret = (x: number) => (x >= 0 ? "+" : "");

  const logLossNotu =
    guncel.logLoss != null && onceki.logLoss != null
      ? ` LogLoss: ${onceki.logLoss.toFixed(3)}→${guncel.logLoss.toFixed(3)} (${isaret(guncel.logLoss - onceki.logLoss)}${(guncel.logLoss - onceki.logLoss).toFixed(3)}, ${guncel.logLoss > onceki.logLoss ? "kötüleşme" : "iyileşme"}, kapsam ${guncel.logLossKapsam}/${guncel.n}).`
      : " LogLoss hesaplanamadı (eski kayıtlarda scoreExact eksik).";

  const not =
    durum === "dusus"
      ? `⚠ DÜŞÜŞ: son ${PENCERE_BOYUTU} koşuda galibiyet %${guncel.hitTop1Orani}/kupon-isabet %${guncel.hitInCouponOrani} — önceki ${PENCERE_BOYUTU} koşuya (%${onceki.hitTop1Orani}/%${onceki.hitInCouponOrani}) göre istatistiksel olarak anlamlı düşüş (z=${zTop1.toFixed(2)}/${zKupon.toFixed(2)}, eşik ±${Z_ESIGI}). Sistem gözden geçirilmeli (bkz. feedback_yenilik_once_backtest metodolojisi).${logLossNotu}`
      : durum === "izle"
      ? `◐ İZLE: Top1 ${isaret(deltaTop1Pp)}${deltaTop1Pp}pp, kupon-isabet ${isaret(deltaKuponPp)}${deltaKuponPp}pp — pratik düşüş var ama henüz istatistiksel olarak anlamlı değil (z=${zTop1.toFixed(2)}/${zKupon.toFixed(2)}, eşik ±${Z_ESIGI}).${logLossNotu}`
      : `✓ STABİL: Son ${PENCERE_BOYUTU} koşunun performansı önceki ${PENCERE_BOYUTU} koşudan istatistiksel olarak anlamlı biçimde farklı değil (z=${zTop1.toFixed(2)}/${zKupon.toFixed(2)}). Top1 ${isaret(deltaTop1Pp)}${deltaTop1Pp}pp, kupon isabeti ${isaret(deltaKuponPp)}${deltaKuponPp}pp.${logLossNotu}`;

  return { guncel, onceki, durum, not, istatistik: { zTop1, zKupon } };
}
