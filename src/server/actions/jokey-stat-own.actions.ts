"use server";

import { db } from "@/lib/db";
import { surfaceToPist, mesafeBucket } from "@/lib/sire-stat-match";
import { classToSkk } from "@/lib/methodology/veri-toplama";

const MIN_ORNEK = 3;

export type JokeyPistMesafeSkkOzet = { ozet: string | null };
export type JokeyAntrenorKombinasyonOzet = { ozet: string | null };

/**
 * (1) Jokeyin BU pist+mesafe+SKK kademesindeki kendi verimizdeki kazanma oranı —
 * kullanıcı doktrini 2026-07-27 önceliğinin İLK maddesi. Genel jockeyWinPct'ten
 * (TrainerStatSync benzeri, TJK yıllık toplam) FARKLI ve daha ÖNCELİKLİ bir sinyal.
 */
export async function getJokeyPistMesafeSkkForRace(raceId: string): Promise<JokeyPistMesafeSkkOzet[]> {
  const race = await db.race.findUnique({
    where: { id: raceId },
    select: { surface: true, distance: true, classType: true, runners: { select: { jockey: true } } },
  });
  if (!race) return [];

  const skk = classToSkk(race.classType);
  const pist = surfaceToPist(race.surface);
  const mesafe = mesafeBucket(race.distance);
  if (skk == null) return race.runners.map(() => ({ ozet: null }));

  const jockeyNames = [...new Set(race.runners.map((r) => r.jockey).filter((j): j is string => !!j))];
  if (jockeyNames.length === 0) return race.runners.map(() => ({ ozet: null }));

  const pool = await db.jockeyPistMesafeSkkStatOwn.findMany({
    where: { jockey: { in: jockeyNames }, pist, mesafe, skk },
  });
  const byJockey = new Map(pool.map((p) => [p.jockey, p]));

  return race.runners.map((r) => {
    const s = r.jockey ? byJockey.get(r.jockey) : undefined;
    if (!s || s.start < MIN_ORNEK) return { ozet: null };
    return { ozet: `${s.jockey} — bu pist/mesafe/sınıf kademesinde kendi verimiz: ${s.start} start, K% ${s.kYuzde} (${s.birinci}/${s.start})` };
  });
}

/**
 * (2) Jokey-Antrenör ikilisinin SON 60 GÜNDEKİ kombinasyon kazanma oranı ("hot streak") —
 * kullanıcı doktrini 2026-07-27 önceliğinin İKİNCİ maddesi.
 */
export async function getJokeyAntrenorKombinasyonForRace(raceId: string): Promise<JokeyAntrenorKombinasyonOzet[]> {
  const race = await db.race.findUnique({
    where: { id: raceId },
    select: { runners: { select: { jockey: true, trainer: true } } },
  });
  if (!race) return [];

  const ciftler = race.runners
    .filter((r): r is { jockey: string; trainer: string } => !!r.jockey && !!r.trainer)
    .map((r) => `${r.jockey}||${r.trainer}`);
  if (ciftler.length === 0) return race.runners.map(() => ({ ozet: null }));

  const pool = await db.jokeyAntrenorKombinasyonStatOwn.findMany({
    where: { OR: [...new Set(ciftler)].map((c) => { const [jockey, trainer] = c.split("||"); return { jockey, trainer }; }) },
  });
  const byKey = new Map(pool.map((p) => [`${p.jockey}||${p.trainer}`, p]));

  return race.runners.map((r) => {
    if (!r.jockey || !r.trainer) return { ozet: null };
    const s = byKey.get(`${r.jockey}||${r.trainer}`);
    if (!s || s.start < MIN_ORNEK) return { ozet: null };
    return { ozet: `${s.jockey} + ${s.trainer} ikilisi, son 60 günde kendi verimiz: ${s.start} start, K% ${s.kYuzde} (${s.birinci}/${s.start})` };
  });
}
