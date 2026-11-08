"use server";

// v5461-sire.actions.ts'in BİREBİR AYNI deseni, dam/damsire için — 2026-11-05/06 bulgusu:
// DamStatOwn (dam-stat.actions.ts) GÜNCEL bir anlık görüntü, geçmiş yarışları backtest
// ederken sireOrani'nin 2026-08-21'de yakalanan AYNI sızıntısına düşürüyor. Burada ham
// Runner/Result verimizden, yalnız cutoff tarihinden KESİNLİKLE önceki kayıtlarla sayılıyor.
import { db } from "@/lib/db";
import { finishPos } from "@/lib/race-result";
import { breedToIrk, surfaceToPist, mesafeBucket, normalizeSireName } from "@/lib/sire-stat-match";

export type V5461DamlineOzet = { ornekKendiVeri: number | null; kYuzde: number | null };

type DamHamSatir = {
  dam: string | null; damSire: string | null; no: number;
  race: { breed: string; surface: string; distance: number; raceDay: { date: Date }; result: { actualOrder: unknown; winnerNos: number[] } | null };
};

const DAM_ONBELLEK_TTL_MS = 30 * 60 * 1000;
let damOnbellek: { rows: DamHamSatir[]; zaman: number } | null = null;
async function tumDamSatirlariniGetir(): Promise<DamHamSatir[]> {
  if (damOnbellek && Date.now() - damOnbellek.zaman < DAM_ONBELLEK_TTL_MS) return damOnbellek.rows;
  // 2026-11-09 — "karma" hipodromu GERÇEK yarışların bahis-kombinasyonu MIRROR'ı, aynı
  // sonucu TEKRAR sayıyor (bkz. pedigri-own-stat.service.ts/jokey-form.actions.ts'teki
  // 2026-11-08 LION HEART (USA) bulgusu — aynı çift-sayım burada da vardı, düzeltildi).
  const rows = await db.runner.findMany({
    where: { scratched: false, dam: { not: null }, race: { result: { isNot: null }, raceDay: { hippodrome: { slug: { notIn: ["karma", "perak-malezya"] } } } } },
    select: {
      dam: true, damSire: true, no: true,
      race: { select: { breed: true, surface: true, distance: true, raceDay: { select: { date: true } }, result: { select: { actualOrder: true, winnerNos: true } } } },
    },
  });
  damOnbellek = { rows, zaman: Date.now() };
  return rows;
}

/** DAM-TEK-BAŞINA: bu annenin (hangi aygırdan olursa olsun) TÜM yavrularının oranı. */
export async function getV5461DamOzetleriForRace(
  dams: (string | null)[], breed: string, surface: string, distance: number, cutoffTarih: Date
): Promise<V5461DamlineOzet[]> {
  const irk = breedToIrk(breed), pist = surfaceToPist(surface), mesafe = mesafeBucket(distance);
  const hedef = new Set(dams.map((s) => (s ? normalizeSireName(s) : "")).filter((s) => s.length > 0));
  if (hedef.size === 0) return dams.map(() => ({ ornekKendiVeri: null, kYuzde: null }));
  const rows = await tumDamSatirlariniGetir();
  const sayim = new Map<string, { start: number; wins: number }>();
  const cutoffMs = cutoffTarih.getTime();
  for (const r of rows) {
    if (!r.dam || !r.race.result) continue;
    if (r.race.raceDay.date.getTime() >= cutoffMs) continue;
    if (breedToIrk(r.race.breed) !== irk) continue;
    if (surfaceToPist(r.race.surface) !== pist) continue;
    if (mesafeBucket(r.race.distance) !== mesafe) continue;
    const dam = normalizeSireName(r.dam);
    if (!hedef.has(dam)) continue;
    const pos = finishPos(r.race.result.actualOrder, r.no, r.race.result.winnerNos);
    const cur = sayim.get(dam) ?? { start: 0, wins: 0 };
    cur.start++;
    if (pos === 1) cur.wins++;
    sayim.set(dam, cur);
  }
  return dams.map((damName) => {
    if (!damName) return { ornekKendiVeri: null, kYuzde: null };
    const cur = sayim.get(normalizeSireName(damName));
    if (!cur || cur.start === 0) return { ornekKendiVeri: null, kYuzde: null };
    return { ornekKendiVeri: cur.start, kYuzde: (cur.wins / cur.start) * 100 };
  });
}

/** DAMSIRE-TEK-BAŞINA: bu aygırın kısrak-babası olarak (hangi anne olursa olsun) TÜM torunlarının oranı. */
export async function getV5461DamsireOzetleriForRace(
  damSires: (string | null)[], breed: string, surface: string, distance: number, cutoffTarih: Date
): Promise<V5461DamlineOzet[]> {
  const irk = breedToIrk(breed), pist = surfaceToPist(surface), mesafe = mesafeBucket(distance);
  const hedef = new Set(damSires.map((s) => (s ? normalizeSireName(s) : "")).filter((s) => s.length > 0));
  if (hedef.size === 0) return damSires.map(() => ({ ornekKendiVeri: null, kYuzde: null }));
  const rows = await tumDamSatirlariniGetir();
  const sayim = new Map<string, { start: number; wins: number }>();
  const cutoffMs = cutoffTarih.getTime();
  for (const r of rows) {
    if (!r.damSire || !r.race.result) continue;
    if (r.race.raceDay.date.getTime() >= cutoffMs) continue;
    if (breedToIrk(r.race.breed) !== irk) continue;
    if (surfaceToPist(r.race.surface) !== pist) continue;
    if (mesafeBucket(r.race.distance) !== mesafe) continue;
    const ds = normalizeSireName(r.damSire);
    if (!hedef.has(ds)) continue;
    const pos = finishPos(r.race.result.actualOrder, r.no, r.race.result.winnerNos);
    const cur = sayim.get(ds) ?? { start: 0, wins: 0 };
    cur.start++;
    if (pos === 1) cur.wins++;
    sayim.set(ds, cur);
  }
  return damSires.map((damSireName) => {
    if (!damSireName) return { ornekKendiVeri: null, kYuzde: null };
    const cur = sayim.get(normalizeSireName(damSireName));
    if (!cur || cur.start === 0) return { ornekKendiVeri: null, kYuzde: null };
    return { ornekKendiVeri: cur.start, kYuzde: (cur.wins / cur.start) * 100 };
  });
}
