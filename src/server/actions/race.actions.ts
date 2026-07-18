"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function clearJockeyStats(): Promise<{ deleted: number }> {
  await requireRole("ADMIN");
  const { count } = await db.jockeyStatSync.deleteMany({});
  revalidatePath("/admin/jokey");
  return { deleted: count };
}

export async function syncTodayResults(): Promise<{ synced: number; failed: number; errors: string[]; debug: string[] }> {
  await requireRole("EDITOR");
  const { turkeyDateString } = await import("@/lib/tz");
  const { toTjkDate, discoverTurkishCities, toSlug } = await import("@/server/services/ingest/tjk-info.adapter");
  const { fetchCityResults } = await import("@/server/services/ingest/tjk-result.adapter");
  const { computeHitTop1 } = await import("@/lib/result-utils");
  const debug: string[] = [];

  try {
    const today = turkeyDateString();
    const date = new Date(today + "T00:00:00.000Z");
    debug.push(`Tarih: ${today}`);

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
    debug.push(`Sonuçsuz yarış: ${racesNeeding.length} (${racesNeeding.map(r => `${r.raceDay.hippodrome.slug} ${r.raceNo}.koşu`).join(", ")})`);

    if (racesNeeding.length === 0) {
      revalidatePath("/admin");
      return { synced: 0, failed: 0, errors: [], debug };
    }

    const tjkDate = toTjkDate(date);
    debug.push(`TJK tarih: ${tjkDate}`);

    const cities = await discoverTurkishCities(tjkDate);
    debug.push(`Bulunan şehirler: ${cities.map(c => c.sehirAdi).join(", ")}`);

    const cityCache = new Map<string, Awaited<ReturnType<typeof fetchCityResults>>>();
    let synced = 0;

    for (const race of racesNeeding) {
      const slug = race.raceDay.hippodrome.slug;
      const city = cities.find((c) => toSlug(c.sehirAdi) === slug);
      if (!city) { debug.push(`⚠ ${slug} şehri bulunamadı`); continue; }

      let cityResults = cityCache.get(slug);
      if (cityResults === undefined) {
        cityResults = await fetchCityResults(city, tjkDate);
        cityCache.set(slug, cityResults);
        debug.push(`${slug} sonuçları: ${cityResults ? cityResults.length + " koşu" : "null (çekilemedi)"}`);
        await new Promise((r) => setTimeout(r, 300));
      }

      const raceResult = cityResults?.find((r) => r.raceNo === race.raceNo);
      if (!raceResult) { debug.push(`⚠ ${slug} ${race.raceNo}. koşu TJK'da bulunamadı`); continue; }

      const actualOrder = raceResult.rows.map((r) => r.no);
      const matchCount = actualOrder.filter((no) => race.runners.some((r) => r.no === no)).length;
      if (matchCount === 0) { debug.push(`⚠ ${slug} ${race.raceNo}. koşu: at numaraları eşleşmedi (TJK: ${actualOrder.slice(0,3).join(",")})`); continue; }

      const winnerNo = actualOrder[0];
      const ganyan = raceResult.rows[0]?.ganyan;
      // TJK ganyanı ancak sonuç kesinleştikten (itiraz/foto-finiş incelemesi bitince) sonra
      // yayınlar — ganyan yoksa sıralama geçici/olası yanlış olabilir, bir sonraki senkronizasyona bırakılır.
      if (ganyan == null) { debug.push(`⚠ ${slug} ${race.raceNo}. koşu: ganyan henüz yayınlanmamış, sonuç kesinleşmemiş sayılıp atlandı`); continue; }
      const picks = race.prediction?.picks ?? [];
      const topPick = picks.find(p => p.rank === 1);
      const hitTop1 = computeHitTop1(actualOrder, winnerNo, topPick?.runner?.no);
      const top3Nos = picks.map(p => p.runner?.no).filter((n): n is number => n != null);
      const hitInCoupon = winnerNo != null && top3Nos.includes(winnerNo);

      await db.result.create({
        data: { raceId: race.id, winnerNo, actualOrder, ganyan, hitTop1, hitInCoupon },
      });

      // Jokey-at çiftlerini runner kayıtlarına yaz (boşsa doldur)
      const jockeyUpdates = raceResult.rows
        .filter((row) => row.jockey && row.no != null)
        .map((row) =>
          db.runner.updateMany({
            where: { raceId: race.id, no: row.no, jockey: null },
            data: { jockey: row.jockey },
          })
        );
      await Promise.all(jockeyUpdates);

      debug.push(`✓ ${slug} ${race.raceNo}. koşu kaydedildi (kazanan: ${winnerNo}, ganyan: ${ganyan})`);
      synced++;
    }

    revalidatePath("/admin");
    revalidatePath("/admin/sonuclar");
    return { synced, failed: 0, errors: [], debug };
  } catch (e) {
    debug.push(`Hata: ${e instanceof Error ? e.message : String(e)}`);
    return { synced: 0, failed: 1, errors: [e instanceof Error ? e.message : String(e)], debug };
  }
}

export async function forceIngestDate(date: string): Promise<{ runners: number }> {
  await requireRole("ADMIN");
  const { toTjkDate, ingestDate } = await import("@/server/services/ingest/tjk-info.adapter");
  const tjkDate = toTjkDate(new Date(date + "T00:00:00Z"));
  const result = await ingestDate(tjkDate);
  const runners = result.cities.reduce((s, c) => s + c.runners, 0);
  revalidatePath("/admin/kosular");
  revalidatePath("/program");
  revalidatePath("/altili");
  return { runners };
}

type PedigreeInput = {
  sire?: string;
  dam?: string;
  damSire?: string;
  pedigreeNote?: string;
};

export async function updateRunnerPedigree(runnerId: string, input: PedigreeInput) {
  await requireRole("EDITOR");

  const runner = await db.runner.update({
    where: { id: runnerId },
    data: {
      sire: input.sire?.trim() || null,
      dam: input.dam?.trim() || null,
      damSire: input.damSire?.trim() || null,
      pedigreeNote: input.pedigreeNote?.trim() || null,
    },
  });

  revalidatePath("/admin/pedigri");
  revalidatePath("/program");
  return runner;
}
