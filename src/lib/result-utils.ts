import type { Prisma } from "@prisma/client";

/**
 * "Tuttu" kuralı: tahminin 1. seçimi yarışı kesin olarak kazanırsa hit sayılır.
 * Top-3/top-6 gibi yakınsama kabul edilmez — kazanmayan at "tuttu" sayılmaz.
 * At başı/beraberlik (dead heat) durumunda TJK aynı SONUCNO=1'i birden fazla ata
 * verebiliyor — bu atların HEPSİ resmi kazanandır, herhangi biriyle eşleşme hit sayılır.
 */
export function computeHitTop1(
  actualOrder: unknown[] | null | undefined,
  winnerNos: number[] | null | undefined,
  pickNo: number | null | undefined
): boolean {
  if (pickNo == null || !winnerNos || winnerNos.length === 0) return false;
  return winnerNos.includes(pickNo);
}

/**
 * hitTop1/hitInCoupon YALNIZ sonuç ilk geldiği anda (result-sync.ts/race.actions.ts'in
 * db.result.create'i) bir kereye mahsus hesaplanıyordu — tahmin SONRADAN düzenlenip
 * yeniden kaydedilirse (ör. admin bir at seçimini düzeltirse, ya da bugünkü oturumda
 * defalarca olduğu gibi analiz sonucu düzeltilip yeniden yayınlanırsa) bu iki alan
 * sonsuza kadar BAYAT kalıyordu — kullanıcı denetimi (2026-07-27) bunu Puan Tablosu'nun
 * gerçek isabet oranını (%38 gösterirken gerçek %67'ymiş) yanlış göstermesine yol açtığını
 * ortaya çıkardı. Bu fonksiyon, GÜNCEL picks'ten yeniden hesaplayıp Result'u senkron tutar —
 * upsertPrediction'ın sonunda (sonuç zaten varsa) çağrılır.
 */
export async function recomputeHitStatsForRace(raceId: string): Promise<void> {
  const { db } = await import("@/lib/db");
  const race = await db.race.findUnique({
    where: { id: raceId },
    select: {
      result: { select: { id: true, actualOrder: true, winnerNos: true, hitTop1: true, hitInCoupon: true } },
      prediction: {
        select: { picks: { where: { rank: { lte: 3 } }, select: { rank: true, runner: { select: { no: true } } } } },
      },
    },
  });
  if (!race?.result) return;
  const picks = race.prediction?.picks ?? [];
  const topPick = picks.find((p) => p.rank === 1);
  const winnerNos = race.result.winnerNos as number[];
  const hitTop1 = computeHitTop1(race.result.actualOrder as unknown[], winnerNos, topPick?.runner?.no);
  const top3Nos = picks.map((p) => p.runner?.no).filter((n): n is number => n != null);
  const hitInCoupon = winnerNos.some((no) => top3Nos.includes(no));
  if (hitTop1 === race.result.hitTop1 && hitInCoupon === race.result.hitInCoupon) return;
  await db.result.update({ where: { id: race.result.id }, data: { hitTop1, hitInCoupon } });
}

/**
 * "Kocaeli 2. Koşu" gibi bir Race.conditions metnini {hippodromeName, raceNo}'ya çözer —
 * Karma (birden fazla hipodromu birleştiren) koşuların hangi ASIL koşuyu yansıttığını
 * bulmak için kullanılır. syncKarmaMirrors (analiz/pick, prediction.actions.ts) ve
 * syncKarmaResultMirrors (sonuç, aşağıda) aynı ayrıştırmayı paylaşır.
 */
export function parseKarmaConditionsRef(conditions: string): { hippodromeName: string; raceNo: number } | null {
  const m = conditions.match(/^(.+?)\s+(\d+)\.\s*Ko[şs]u/i);
  if (!m) return null;
  return { hippodromeName: m[1].trim(), raceNo: parseInt(m[2], 10) };
}

/**
 * 2026-08-20 kullanıcı bulgusu (KARA ALEV/UYGURKIZI vakası, Kocaeli↔Karma): syncKarmaMirrors
 * yalnız ANALİZ/pick verisini eşliyordu — Sonuç (Result) hiç kapsanmıyordu. Karma'nın TJK
 * sayfası, asıl hipodromun kendi sayfasından BAĞIMSIZ çekildiği için ikisi ayrı ayrı yanlış/
 * doğru olabiliyor (bu vakada Kocaeli'nin kendi sayfası doğruydu, Karma'nın kendi sayfası
 * KARA ALEV yerine UYGURKIZI'yı kazanan göstermişti). ASIL hipodromun kendi sonucu her zaman
 * otorite kabul edilir — Karma'daki mirror(lar) HER senkronizasyonda ondan kopyalanır (zaten
 * yanlışsa bile kendi kendini düzeltir), tersi asla olmaz. result-sync.ts, günün tüm ASIL
 * (conditions'ı boş) ve sonuçlanmış koşuları için bunu her çalıştığında yeniden çağırır —
 * yalnız yeni gelen sonuçlar değil, geçmişte hatalı kalmış Karma kopyaları da kendiliğinden
 * düzelir.
 */
export async function syncKarmaResultMirrors(asilRaceId: string): Promise<void> {
  const { db } = await import("@/lib/db");
  const { startOfDay, endOfDay } = await import("date-fns");

  const asil = await db.race.findUnique({
    where: { id: asilRaceId },
    select: {
      raceNo: true,
      conditions: true,
      raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
      result: true,
    },
  });
  // Karma'nın KENDİSİ için çağrılırsa (conditions dolu) atla — yayılım yalnız asıl
  // hipodromdan Karma'ya doğrudur, tersi yok.
  if (!asil?.result || asil.conditions) return;

  const conditionsKey = `${asil.raceDay.hippodrome.name} ${asil.raceNo}. Koşu`;
  const karmaRaces = await db.race.findMany({
    where: {
      conditions: conditionsKey,
      raceDay: { date: { gte: startOfDay(asil.raceDay.date), lte: endOfDay(asil.raceDay.date) } },
    },
    select: { id: true, result: { select: { id: true, winnerNo: true } } },
  });
  if (karmaRaces.length === 0) return;

  const { actualOrder, winnerNo, winnerNos, ganyan, time, farklar, gecCikanlar } = asil.result;
  const actualOrderInput = actualOrder as Prisma.InputJsonValue;
  const gecCikanlarInput = gecCikanlar == null ? undefined : (gecCikanlar as Prisma.InputJsonValue);
  // 2026-08-20 kullanıcı talebi ("sürekli siteyi kolaçan edecek bir agent"): var olan bir
  // Karma sonucu YANLIŞ değerden asıl'a düzeltiliyorsa (ilk kez doldurulması DEĞİL, gerçek
  // bir tutarsızlık) — bu, TJK'nın Karma sayfasının o gün gerçekten yanlış veri verdiğinin
  // kanıtı. Admin'e SYSTEM bildirimi olarak anında düşürülür (bkz. veri-denetimi bölümü,
  // /admin/bildirimler'de görünür) — sessizce düzelmesin, kullanıcı haberdar olsun.
  const gercekUyusmazliklar: { karmaRaceId: string; eskiKazananNo: number | null }[] = [];
  for (const karma of karmaRaces) {
    // 2026-08-21 kullanıcı bulgusu (Vercel "Function Duration" uyarısı, 7 kat artış):
    // bu fonksiyon result-sync.ts'in HER çalışmasında (15dk'da bir, koşu saatleri boyunca)
    // günün TÜM sonuçlanmış koşuları için çağrılıyor — daha önce KOŞULSUZ yazıyordu, yani
    // zaten senkron olan bir Karma kopyasını bile her seferinde yeniden update+recompute
    // ediyordu. Zaten eşleşiyorsa hiçbir şey yapmadan atla — yalnız gerçekten yeni/farklı
    // olan durumlar (nadir) DB'ye yazar.
    if (karma.result && karma.result.winnerNo === winnerNo) continue;

    if (karma.result) {
      gercekUyusmazliklar.push({ karmaRaceId: karma.id, eskiKazananNo: karma.result.winnerNo });
      await db.result.update({
        where: { raceId: karma.id },
        data: { actualOrder: actualOrderInput, winnerNo, winnerNos, ganyan, time, farklar, gecCikanlar: gecCikanlarInput },
      });
    } else {
      await db.result.create({
        data: { raceId: karma.id, actualOrder: actualOrderInput, winnerNo, winnerNos, ganyan, time, farklar, gecCikanlar: gecCikanlarInput },
      });
    }
    await recomputeHitStatsForRace(karma.id);
  }

  if (gercekUyusmazliklar.length > 0) {
    try {
      const aranankNolar = [winnerNo, ...gercekUyusmazliklar.map((u) => u.eskiKazananNo)].filter((n): n is number => n != null);
      const runners = await db.runner.findMany({
        where: { raceId: asilRaceId, no: { in: aranankNolar } },
        select: { no: true, name: true },
      });
      const adByNo = new Map(runners.map((r) => [r.no, r.name]));
      const dogruAd = winnerNo != null ? (adByNo.get(winnerNo) ?? `#${winnerNo}`) : "?";
      const eski = gercekUyusmazliklar[0].eskiKazananNo;
      const eskiAd = eski != null ? (adByNo.get(eski) ?? `#${eski}`) : "?";
      const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      if (admins.length > 0) {
        await db.notification.createMany({
          data: admins.map((a) => ({
            userId: a.id,
            type: "SYSTEM" as const,
            title: "Karma/asıl hipodrom sonuç uyuşmazlığı düzeltildi",
            body: `${asil.raceDay.hippodrome.name} ${asil.raceNo}. Koşu — Karma'nın kendi sayfası "${eskiAd}" kazandı diyordu, asıl hipodrom sayfası "${dogruAd}" diyor. Otomatik düzeltildi (asıl otorite kabul edildi).`,
            link: "/admin/kupon",
          })),
        });
      }
    } catch {
      // Bildirim başarısız olsa bile veri düzeltmesi zaten uygulandı — sessizce geç.
    }
  }
}

/** "1-3-7" gibi tire ile ayrılmış kupon string'ini at numaralarına çevirir. */
export function parseCouponNos(coupon: string | null | undefined): number[] {
  if (!coupon) return [];
  return coupon
    .split("-")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
}

/**
 * Kazananlardan biri normal kuponun dışında ama geniş kuponun içindeyse true döner —
 * "Genişte yer aldı" uyarısı için kullanılır.
 */
export function wonOnlyInWideCoupon(
  winnerNos: number[] | null | undefined,
  couponNormal: string | null | undefined,
  couponWide: string | null | undefined
): boolean {
  if (!winnerNos || winnerNos.length === 0) return false;
  const normal = parseCouponNos(couponNormal);
  const wide = parseCouponNos(couponWide);
  if (normal.length === 0 && wide.length === 0) return false;
  const inNormal = winnerNos.some((no) => normal.includes(no));
  const inWide = winnerNos.some((no) => wide.includes(no));
  return !inNormal && inWide;
}
