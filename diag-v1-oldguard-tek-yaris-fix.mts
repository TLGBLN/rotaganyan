import fs from "node:fs";
import { db } from "./src/lib/db";
import { computeGenPedigriForRace } from "./src/lib/motor-v1/features/gen-pedigri";
import { computeDavTakiDegisikligi, recoverTodayEquipmentFromOwnHistory, ortakYarisAnahtari } from "./src/lib/motor-v1/features/dav-taki";
import { computeRakH2HForRace } from "./src/lib/motor-v1/features/rak-rakip-gucu";

const RACE_ID_PREFIX = "cmu52aat";

async function main() {
  const oldCache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8"));
  const raceId = Object.keys(oldCache).find((id) => id.startsWith(RACE_ID_PREFIX))!;
  const oldRace = oldCache[raceId];

  const race = await db.race.findUnique({
    where: { id: raceId },
    select: {
      breed: true, surface: true, distance: true, raceNo: true,
      raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
      runners: { where: { scratched: false }, select: { no: true, name: true, sire: true, dam: true, damSire: true, tjkAtId: true, equipment: true } },
    },
  });
  if (!race) { console.error("yaris bulunamadi"); return; }
  const cutoff = race.raceDay.date;
  const davRaceKey = ortakYarisAnahtari(race.raceDay.hippodrome.name, `${String(cutoff.getUTCDate()).padStart(2,"0")}.${String(cutoff.getUTCMonth()+1).padStart(2,"0")}.${cutoff.getUTCFullYear()}`, String(race.raceNo));

  const tjkIds = race.runners.map((r) => r.tjkAtId).filter((x): x is number => x != null);
  const cacheRows = await db.horseRaceHistoryCache.findMany({ where: { tjkAtId: { in: tjkIds } }, select: { tjkAtId: true, rowsJson: true } });
  const rowsByTjk = new Map(cacheRows.map((c) => [c.tjkAtId, c.rowsJson]));

  const pmzHam = new Map<number, number | null>();
  for (const r of oldRace.runners) {
    const pmz = r.vectors.find((s: any) => s.code === "PMZ_01");
    pmzHam.set(r.no, pmz?.observed ? pmz.rawValue : null);
  }
  const genResults = await computeGenPedigriForRace(
    race.runners.map((r) => ({ no: r.no, sire: r.sire, dam: r.dam, damSire: r.damSire, tjkAtId: r.tjkAtId })),
    race.breed, race.surface, race.distance, cutoff, pmzHam
  );
  const genByNo = new Map(genResults.map((g) => [g.no, g.signals]));

  const rakInput = race.runners.map((r) => ({ no: r.no, name: r.name, tjkAtId: r.tjkAtId, rowsJson: rowsByTjk.get(r.tjkAtId ?? -1) ?? [] }));
  const rakK4 = computeRakH2HForRace(rakInput, cutoff, 4);
  const rakOld = computeRakH2HForRace(rakInput, cutoff, 999999); // K cok buyuk -> shrink~0, ama biz ESKI ham-net istiyoruz; bunun yerine dogrudan HAM net'i ayrica hesapla

  const out: Record<number, { gen: any[]; dav: any[]; rakK4: number | null; rakObserved: boolean }> = {};
  for (const r of race.runners) {
    const rowsJson = rowsByTjk.get(r.tjkAtId ?? -1) ?? [];
    const liveKnown = r.equipment != null && r.equipment.trim() !== "";
    const recovered = !liveKnown ? recoverTodayEquipmentFromOwnHistory(davRaceKey, rowsJson) : null;
    const effective = liveKnown ? r.equipment : recovered;
    const known = liveKnown || recovered != null;
    const dav = computeDavTakiDegisikligi(effective, r.tjkAtId, rowsJson, cutoff, known);
    const rakEntry = rakK4.get(r.no);
    out[r.no] = { gen: genByNo.get(r.no) ?? [], dav: dav.signals, rakK4: rakEntry?.observed ? rakEntry.rawValue : null, rakObserved: !!rakEntry?.observed };
  }

  const newRace = {
    raceId: oldRace.raceId, date: oldRace.date, winnerNo: oldRace.winnerNo,
    runners: oldRace.runners.map((rr: any) => {
      const fix = out[rr.no];
      const signals = rr.vectors.map((s: any) => {
        if (["GEN_SIRE_01","GEN_DAM_01","GEN_DAMSIRE_01","GEN_SIRE_PMZ_01"].includes(s.code)) return fix.gen.find((g: any) => g.code === s.code) ?? s;
        if (["DAV_TAKI_EKLENDI","DAV_TAKI_CIKARILDI"].includes(s.code)) return fix.dav.find((d: any) => d.code === s.code) ?? s;
        if (s.code === "RAK_H2H_01") return { ...s, rawValue: fix.rakObserved ? fix.rakK4 : null, observed: fix.rakObserved };
        return s;
      });
      return { no: rr.no, name: rr.name, vectors: signals };
    }),
  };
  fs.writeFileSync("C:/tmp/oldguard-fixed-single.json", JSON.stringify(newRace, null, 2));
  console.log("Yazildi: C:/tmp/oldguard-fixed-single.json");
  console.log("RAK_H2H_01 eski-ham vs K=4 (kazanan #5, favori #8):");
  for (const no of [5, 8]) {
    const oldS = oldRace.runners.find((r: any) => r.no === no)?.vectors.find((s: any) => s.code === "RAK_H2H_01");
    console.log(`  #${no}: eski-ham=${JSON.stringify(oldS)} -> K=4: observed=${out[no].rakObserved} value=${out[no].rakK4}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
