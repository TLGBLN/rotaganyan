import "dotenv/config";
import { db } from "../src/lib/db";
import { getSireStatOzetleriForRace } from "../src/server/actions/sire-stat.actions";
import { getDamStatOzetleriForRace } from "../src/server/actions/dam-stat.actions";

async function main() {
  const race = await db.race.findFirst({
    where: { runners: { some: { sire: { not: null } } } },
    include: { runners: { select: { sire: true, dam: true, damSire: true } } },
    orderBy: { id: "desc" },
  });
  if (!race) return console.log("Koşu bulunamadı");
  console.log("Test koşusu:", race.id, race.breed, race.surface, race.distance);

  const sireOzet = await getSireStatOzetleriForRace(race.runners.map((r) => r.sire), race.breed, race.surface, race.distance);
  const damOzet = await getDamStatOzetleriForRace(race.runners.map((r) => ({ dam: r.dam, damSire: r.damSire })), race.breed, race.surface, race.distance);

  console.log("\n=== SIRE ÖZET ===");
  sireOzet.forEach((o, i) => console.log(race.runners[i].sire, "->", o.ozet, "| ornekKendiVeri:", o.ornekKendiVeri));
  console.log("\n=== DAM ÖZET ===");
  damOzet.forEach((o, i) => console.log(race.runners[i].dam, "->", o.ozet, "| ornekKendiVeri:", o.ornekKendiVeri));

  await db.$disconnect();
}
main();
