// READ-ONLY smoke test — gen-pedigri.ts'i gercek bir yarista calistirir, sire bacagini
// getV5461SireOzetleriForRace'in DOGRUDAN cikisiyla karsilastirir (parite), dam/damSire
// sonuclarini goruntuler.
import { db } from "./src/lib/db";
import { computeGenPedigriForRace } from "./src/lib/motor-v1/features/gen-pedigri";
import { getV5461SireOzetleriForRace } from "./src/server/actions/v5461-sire.actions";

async function main() {
  const race = await db.race.findFirst({
    where: { result: { isNot: null }, runners: { some: { sire: { not: null } } } },
    orderBy: { raceDay: { date: "desc" } },
    select: {
      id: true, breed: true, surface: true, distance: true,
      raceDay: { select: { date: true } },
      runners: { where: { scratched: false }, select: { no: true, name: true, sire: true, dam: true, damSire: true } },
    },
  });
  if (!race) { console.log("yaris bulunamadi"); return; }
  console.log(`Yaris: ${race.id} ${race.raceDay.date.toISOString().slice(0,10)} ${race.breed}/${race.surface}/${race.distance}m, ${race.runners.length} at`);

  const pmzHam = new Map(race.runners.map((r) => [r.no, 1 as number | null])); // sabit test degeri
  const result = await computeGenPedigriForRace(race.runners, race.breed, race.surface, race.distance, race.raceDay.date, pmzHam);

  const directSire = await getV5461SireOzetleriForRace(race.runners.map((r) => r.sire), race.breed, race.surface, race.distance, race.raceDay.date);

  let sireParityOk = true;
  for (let i = 0; i < race.runners.length; i++) {
    const r = race.runners[i];
    const gen01 = result.find((x) => x.no === r.no)!.signals.find((s) => s.code === "GEN_SIRE_01")!;
    const direct = directSire[i];
    const match = gen01.rawValue === direct.kYuzde;
    if (!match) sireParityOk = false;
    const dam = result.find((x) => x.no === r.no)!.signals.find((s) => s.code === "GEN_DAM_01")!;
    const damSire = result.find((x) => x.no === r.no)!.signals.find((s) => s.code === "GEN_DAMSIRE_01")!;
    console.log(`  at#${r.no} ${r.name}: baba=${r.sire} GEN_SIRE_01=${gen01.rawValue} (direct=${direct.kYuzde}, parite=${match}) | anne=${r.dam} GEN_DAM_01=${dam.rawValue} (${dam.missingReason ?? "OK"}) | anneBabasi=${r.damSire} GEN_DAMSIRE_01=${damSire.rawValue} (${damSire.missingReason ?? "OK"})`);
  }
  console.log(`\nSIRE PARITESI (gen-pedigri.ts GEN_SIRE_01 === getV5461SireOzetleriForRace direkt cikti): ${sireParityOk ? "TAM ESLESME" : "FARK VAR"}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
