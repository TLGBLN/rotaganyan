// SALT-OKUMA: bir günün kayıtlı kuponunun ayaklarını + o koşuların model olasılıklarını yan yana döker.
// Kullanım: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-kupon-ayak-incele.mts --tarih 2026-11-15 --hipodrom İstanbul
import { db } from "./src/lib/db";

const get = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const tarih = get("--tarih") ?? new Date().toISOString().slice(0, 10);
const hip = get("--hipodrom") ?? "İstanbul";
console.log("hip=", JSON.stringify(hip), [...hip].map((c) => c.charCodeAt(0)).join(","));

async function main() {
  const gun = new Date(tarih + "T00:00:00.000Z");
  const kuponlar = await db.homeKupon.findMany({
    where: { hippodromeName: { startsWith: hip }, isActive: true, date: { gte: new Date(gun.getTime() - 12 * 3600e3), lt: new Date(gun.getTime() + 36 * 3600e3) } },
    orderBy: { createdAt: "asc" },
  });
  console.log("kupon kaydı:", kuponlar.length);
  for (const k of kuponlar) {
    console.log(`\n=== slot ${k.slot} aktif=${k.isActive} oluşturma=${k.createdAt.toISOString()} güncelleme=${k.updatedAt.toISOString()}`);
    const legs = k.legs as { raceNo: number; narrow: number[]; normal: number[]; wide: number[] }[];
    for (const [i, l] of legs.entries()) {
      const race = await db.race.findFirst({
        where: { raceNo: l.raceNo, raceDay: { date: { gte: new Date(gun.getTime() - 12 * 3600e3), lt: new Date(gun.getTime() + 36 * 3600e3) }, hippodrome: { name: hip } } },
        select: { classType: true, distance: true, surface: true, runners: { select: { no: true, scratched: true, name: true } }, prediction: { select: { picks: { select: { rank: true, scoreExact: true, probTop3: true, runner: { select: { no: true } } }, orderBy: { rank: "asc" } } } } },
      });
      const aktif = race?.runners.filter((r) => !r.scratched).length ?? 0;
      const sirali = (race?.prediction?.picks ?? []).map((p) => `${p.runner?.no}:%${((p.scoreExact ?? 0) * 100).toFixed(1)}`).join(" ");
      console.log(`\n${i + 1}. ayak = K${l.raceNo} ${race?.classType} ${race?.surface} ${race?.distance}m, aktif at=${aktif}`);
      console.log(`  dar=[${l.narrow}] normal=[${l.normal}] geniş=[${l.wide}]`);
      console.log(`  model sırası (no:olasılık): ${sirali}`);
    }
  }
  await db.$disconnect();
}
main();
