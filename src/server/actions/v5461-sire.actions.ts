"use server";

import { db } from "@/lib/db";
import { finishPos } from "@/lib/race-result";
import { breedToIrk, surfaceToPist, mesafeBucket, normalizeSireName } from "@/lib/sire-stat-match";

export type V5461SireOzet = {
  ornekKendiVeri: number | null;
  kYuzde: number | null;
};

/**
 * GEN SELF-CONTAMINATION DUZELTMESI (kullanici talimati, 2026-10-22, "Atin kendi gecmis
 * yarislarinin baba/anne/anne-babasi soy istatistiklerine karismasini engelle"): bu fonksiyon
 * SADECE motor-v1'in gen-pedigri.ts'inden cagrilir (digerlerine dokunulmadi, repo-genelinde
 * tek-cagiran dogrulandi 2026-10-22). Eski davranis: hedef atin KENDI gecmis startlari da
 * (ayni baba+irk+pist+mesafe kovasinda) babanin "diger yavrular" istatistigine karisiyordu —
 * bu, "genetik beklenti" sinyalini atin KENDI gerceklesmis sonucuyla dairesel hale getiriyordu.
 * Duzeltme: `excludeTjkAtIds` (hedef atlarin tjkAtId'leri, sireNames ile AYNI sirada) parametresi
 * eklendi — her hedef icin KENDI tjkAtId'sinin katkisi, O HEDEFE ozel olarak cikarilir (ayni
 * babadan gelen DIGER bir at ayni ragalardan HARIC TUTULMAZ, yalniz tam KENDI tjkAtId'si).
 */
let cachedSireRowsPromise: ReturnType<typeof fetchAllSireRows> | null = null;
function fetchAllSireRows() {
  return db.runner.findMany({
    where: { scratched: false, sire: { not: null }, race: { result: { isNot: null } } },
    select: {
      sire: true,
      no: true,
      tjkAtId: true,
      race: {
        select: {
          breed: true,
          surface: true,
          distance: true,
          raceDay: { select: { date: true } },
          result: { select: { actualOrder: true, winnerNos: true } },
        },
      },
    },
  });
}

export async function getV5461SireOzetleriForRace(
  sireNames: (string | null)[],
  breed: string,
  surface: string,
  distance: number,
  cutoffTarih: Date,
  excludeTjkAtIds: (number | null)[] = []
): Promise<V5461SireOzet[]> {
  const irk = breedToIrk(breed);
  const pist = surfaceToPist(surface);
  const mesafe = mesafeBucket(distance);
  const hedefSirelar = new Set(
    sireNames.map((s) => (s ? normalizeSireName(s) : "")).filter((s) => s.length > 0)
  );

  if (hedefSirelar.size === 0) {
    return sireNames.map(() => ({ ornekKendiVeri: null, kYuzde: null }));
  }

  // 2026-10-24 — PERF: ayni duzeltme gen-pedigri.ts::getOwnLineOzetleriForRace ile AYNI —
  // bu taban satir kumesi hicbir parametreye gore DB-seviyesinde filtrelenmiyordu, toplu
  // Faz1 toplamasinda yaris basina tekrar tekrar ayni binlerce satir cekiliyordu (0.01
  // yaris/sn'ye dustu). TEK SEFERDE cek, surec boyunca PAYLAS — filtre/sonuc mantigi DEGISMEDI.
  if (!cachedSireRowsPromise) cachedSireRowsPromise = fetchAllSireRows();
  const rows = await cachedSireRowsPromise;

  const sayim = new Map<string, { start: number; wins: number }>();
  // sire -> tjkAtId -> bu atin KENDI katkisi (hedef-bazli cikarim icin)
  const kendiKatki = new Map<string, Map<number, { start: number; wins: number }>>();
  const cutoffMs = cutoffTarih.getTime();

  for (const r of rows) {
    if (!r.sire || !r.race.result) continue;
    if (r.race.raceDay.date.getTime() >= cutoffMs) continue;
    if (breedToIrk(r.race.breed) !== irk) continue;
    if (surfaceToPist(r.race.surface) !== pist) continue;
    if (mesafeBucket(r.race.distance) !== mesafe) continue;

    const sire = normalizeSireName(r.sire);
    if (!hedefSirelar.has(sire)) continue;

    const pos = finishPos(r.race.result.actualOrder, r.no, r.race.result.winnerNos);
    const win = pos === 1 ? 1 : 0;
    const cur = sayim.get(sire) ?? { start: 0, wins: 0 };
    cur.start++;
    cur.wins += win;
    sayim.set(sire, cur);

    if (r.tjkAtId != null) {
      const bySire = kendiKatki.get(sire) ?? new Map<number, { start: number; wins: number }>();
      const own = bySire.get(r.tjkAtId) ?? { start: 0, wins: 0 };
      own.start++;
      own.wins += win;
      bySire.set(r.tjkAtId, own);
      kendiKatki.set(sire, bySire);
    }
  }

  return sireNames.map((sireName, i) => {
    if (!sireName) return { ornekKendiVeri: null, kYuzde: null };
    const sire = normalizeSireName(sireName);
    const cur = sayim.get(sire);
    if (!cur || cur.start === 0) return { ornekKendiVeri: null, kYuzde: null };

    let start = cur.start, wins = cur.wins;
    const excludeId = excludeTjkAtIds[i];
    if (excludeId != null) {
      const own = kendiKatki.get(sire)?.get(excludeId);
      if (own) { start -= own.start; wins -= own.wins; }
    }
    if (start <= 0) return { ornekKendiVeri: null, kYuzde: null };
    return {
      ornekKendiVeri: start,
      kYuzde: (wins / start) * 100,
    };
  });
}
