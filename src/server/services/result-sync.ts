/**
 * Public /kosular sayfası için otomatik sonuç çekme.
 * Sonucu olmayan koşuları TJK'dan çekip Result kaydı oluşturur.
 * Tahmin varsa hitTop1 otomatik hesaplanır; hitInCoupon admin incelemesine bırakılır.
 */

import { db } from "@/lib/db";
import { discoverTurkishCities, toSlug, toTjkDate } from "./ingest/tjk-info.adapter";
import { fetchCityResults, type CityRaceResult } from "./ingest/tjk-result.adapter";
import { computeHitTop1, syncKarmaResultMirrors } from "@/lib/result-utils";

// 2026-09-06 kullanıcı bulgusu (İstanbul K5, MOLFIT/AZİMLİ) — TJK bir koşunun sonucunu
// yayınladıktan SONRA (itiraz/foto-finiş incelemesi) değiştirebiliyor, ganyan değeriyle
// birlikte gelmiş olsa bile. Eski kod "ganyan varsa kesinleşmiştir" varsayımıyla ilk
// gördüğü veriyi kalıcı Result olarak yazıyordu — bu varsayım o gün yanlış çıktı, yanlış
// kazanan (AZİMLİ) günlerce kalıcı kayıtta durdu, kullanıcı fark edip elle düzeltti.
// Kullanıcı talebi ("bunlar olmasın, yakalanması değil olmayacak") üzerine "yakala ve
// düzelt" yerine "en baştan yazma" prensibine geçildi: bir koşunun sonucu, AYNI kazanan
// + AYNI ganyan + AYNI sıralama İKİ ARDIŞIK senkronizasyonda (cron 15 dk'da bir çalışıyor,
// bkz. vercel.json) DEĞİŞMEDEN görülmeden Result tablosuna hiç yazılmıyor — ilk görülen
// aday PendingResult'a "bekleyen" olarak yazılır, ikinci turda eşleşirse Result'a taşınıp
// PendingResult silinir; eşleşmezse PendingResult'ın kendisi güncellenip saat sıfırlanır
// (yeniden doğrulama baştan başlar).
function ayniAday(
  a: { winnerNo: number | null; winnerNos: number[]; ganyan: number | null; actualOrder: unknown },
  b: { winnerNo: number | null; winnerNos: number[]; ganyan: number | null; actualOrder: unknown }
): boolean {
  return (
    a.winnerNo === b.winnerNo &&
    a.ganyan === b.ganyan &&
    JSON.stringify(a.winnerNos) === JSON.stringify(b.winnerNos) &&
    JSON.stringify(a.actualOrder) === JSON.stringify(b.actualOrder)
  );
}

export async function syncResultsForDate(dateStr: string): Promise<void> {
  const date = new Date(dateStr + "T00:00:00.000Z");

  const racesNeeding = await db.race.findMany({
    where: { raceDay: { date }, result: null },
    include: {
      raceDay: { include: { hippodrome: true } },
      runners: { select: { no: true } },
      pendingResult: true,
      prediction: {
        include: { picks: { where: { rank: { lte: 3 } }, include: { runner: { select: { no: true } } } } },
      },
    },
  });
  if (racesNeeding.length === 0) return;

  const tjkDate = toTjkDate(date);
  const cities = await discoverTurkishCities(tjkDate);
  const cityCache = new Map<string, CityRaceResult[] | null>();

  for (const race of racesNeeding) {
    const slug = race.raceDay.hippodrome.slug;
    const city = cities.find((c) => toSlug(c.sehirAdi) === slug);
    if (!city) continue;

    let cityResults = cityCache.get(slug);
    if (cityResults === undefined) {
      cityResults = await fetchCityResults(city, tjkDate);
      cityCache.set(slug, cityResults);
      await new Promise((r) => setTimeout(r, 300));
    }

    const raceResult = cityResults?.find((r) => r.raceNo === race.raceNo);
    if (!raceResult) continue;

    const actualOrder = raceResult.rows.map((r) => r.no);
    const matchCount = actualOrder.filter((no) => race.runners.some((r) => r.no === no)).length;
    if (matchCount === 0) continue;

    // At başı/beraberlik (dead heat): TJK aynı SONUCNO=1'i birden fazla ata verebiliyor —
    // rows zaten rank'e göre sıralı geliyor (bkz. tjk-result.adapter.ts), en düşük rank'e
    // (genelde 1) sahip TÜM satırlar resmi kazanandır.
    const minRank = raceResult.rows[0]?.rank;
    const winnerNos = raceResult.rows.filter((r) => r.rank === minRank).map((r) => r.no);
    const winnerNo = winnerNos[0] ?? null;
    const ganyan = raceResult.rows[0]?.ganyan;
    // TJK, bir koşunun ganyanını (kazanan oranı) ancak sonuç kesinleştikten (itiraz/foto-finiş
    // incelemesi bittikten) sonra yayınlar. Ganyan henüz yoksa sıralama kesin olarak geçicidir —
    // bu koşuyu KAYDETMEYİP bir sonraki senkronizasyona bırakıyoruz.
    if (ganyan == null) continue;

    const aday = { winnerNo, winnerNos, ganyan, actualOrder };
    if (!race.pendingResult || !ayniAday(race.pendingResult, aday)) {
      // İlk kez görülen aday (ya da öncekinden FARKLI bir aday) — henüz Result'a YAZILMIYOR,
      // yalnız "bekleyen" olarak kaydedilip bir sonraki senkronizasyonda aynısı tekrar
      // görülürse kesinleştirilecek.
      await db.pendingResult.upsert({
        where: { raceId: race.id },
        create: { raceId: race.id, winnerNo, winnerNos, ganyan, actualOrder },
        update: { winnerNo, winnerNos, ganyan, actualOrder, firstSeenAt: new Date() },
      });
      continue;
    }
    // İkinci ardışık senkronizasyonda AYNI aday doğrulandı — artık kesinleştirilebilir.
    await db.pendingResult.delete({ where: { raceId: race.id } }).catch(() => {});

    const picks = race.prediction?.picks ?? [];
    const topPick = picks.find(p => p.rank === 1);
    const hitTop1 = computeHitTop1(actualOrder, winnerNos, topPick?.runner?.no);
    // Kazananlardan biri rank 1-3 pick'lerden biriyse "ekonomik kupon içinde" sayılır
    const top3Nos = picks.map(p => p.runner?.no).filter((n): n is number => n != null);
    const hitInCoupon = winnerNos.some((no) => top3Nos.includes(no));

    // Müddet = kazananın resmi koşu süresi; Farklar = ilk 5 sıra arasındaki TJK mesafe farkları.
    const sortedRows = [...raceResult.rows].sort((a, b) => a.rank - b.rank);
    const time = sortedRows[0]?.time ?? null;
    const farklar = sortedRows.slice(0, 5).map((r) => r.fark).filter((f): f is string => !!f).join(", ") || null;
    // "Geç Çıkış" — TJK'nın kendi start-kalitesi tespiti (kullanıcı talebi 2026-08-01).
    const gecCikanlar = raceResult.rows
      .filter((r) => r.gecCikis)
      .map((r) => ({ no: r.no, name: r.name, fark: r.gecCikis }));

    await db.result.create({
      data: { raceId: race.id, winnerNo, winnerNos, actualOrder, ganyan, time, farklar, hitTop1, hitInCoupon, gecCikanlar: gecCikanlar.length > 0 ? gecCikanlar : undefined },
    });
  }

  // 2026-08-20 kullanıcı bulgusu (KARA ALEV/UYGURKIZI vakası): Karma'nın kendi TJK sayfası,
  // asıl hipodromun sayfasından bağımsız çekildiği için ayrı yanlış okunabiliyor. Günün TÜM
  // asıl (Karma olmayan) ve sonuçlanmış koşuları için mirror'ı yeniden uygula — yalnız bu
  // çalıştırmada yeni gelenler değil, geçmişte hatalı kalmış Karma kopyaları da kendiliğinden
  // düzelir (bkz. syncKarmaResultMirrors, result-utils.ts).
  const asilSonuclu = await db.race.findMany({
    where: { raceDay: { date }, conditions: null, result: { isNot: null } },
    select: { id: true },
  });
  for (const race of asilSonuclu) {
    try { await syncKarmaResultMirrors(race.id); } catch { /* bir sonraki senkronizasyona bırak */ }
  }
}
