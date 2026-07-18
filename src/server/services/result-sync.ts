/**
 * Public /kosular sayfası için otomatik sonuç çekme.
 * Sonucu olmayan koşuları TJK'dan çekip Result kaydı oluşturur.
 * Tahmin varsa hitTop1 otomatik hesaplanır; hitInCoupon admin incelemesine bırakılır.
 */

import { db } from "@/lib/db";
import { discoverTurkishCities, toSlug, toTjkDate } from "./ingest/tjk-info.adapter";
import { fetchCityResults, type CityRaceResult } from "./ingest/tjk-result.adapter";
import { computeHitTop1 } from "@/lib/result-utils";

export async function syncResultsForDate(dateStr: string): Promise<void> {
  const date = new Date(dateStr + "T00:00:00.000Z");

  const racesNeeding = await db.race.findMany({
    where: { raceDay: { date }, result: null },
    include: {
      raceDay: { include: { hippodrome: true } },
      runners: { select: { no: true } },
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

    const winnerNo = actualOrder[0];
    const ganyan = raceResult.rows[0]?.ganyan;
    // TJK, bir koşunun ganyanını (kazanan oranı) ancak sonuç kesinleştikten (itiraz/foto-finiş
    // incelemesi bittikten) sonra yayınlar. Ganyan henüz yoksa sıralama geçici/olası yanlış
    // olabilir (bir kez yaşandı: 14 atlık geçici bir sıralama kaydedildi, sonradan TJK sıralamayı
    // tamamen değiştirdi) — böyle bir koşuyu KAYDETMEYİP bir sonraki senkronizasyona bırakıyoruz,
    // ki yanlış/geçici bir sonuç kalıcı olarak Result tablosuna yazılıp kupon isabet hesaplarını bozmasın.
    if (ganyan == null) continue;
    const picks = race.prediction?.picks ?? [];
    const topPick = picks.find(p => p.rank === 1);
    const hitTop1 = computeHitTop1(actualOrder, winnerNo, topPick?.runner?.no);
    // Kazanan, rank 1-3 pick'lerden biriyse "ekonomik kupon içinde" sayılır
    const top3Nos = picks.map(p => p.runner?.no).filter((n): n is number => n != null);
    const hitInCoupon = winnerNo != null && top3Nos.includes(winnerNo);

    await db.result.create({
      data: { raceId: race.id, winnerNo, actualOrder, ganyan, hitTop1, hitInCoupon },
    });
  }
}
