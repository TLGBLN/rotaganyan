// SALT-OKUMA — kaç sonuçlanmış yarış var, kaçının sinyal anlık görüntüsü kayıtlı, eğitim seti (1392) neyle sınırlı?
import { db } from "./src/lib/db";
import * as fs from "fs";
async function main() {
  const sonuclu = await db.race.count({ where: { result: { isNot: null }, raceDay: { hippodrome: { slug: { notIn: ["karma", "perak-malezya"] } } } } });
  const ilk = await db.raceDay.findFirst({ where: { races: { some: { result: { isNot: null } } } }, orderBy: { date: "asc" }, select: { date: true } });
  const son = await db.raceDay.findFirst({ where: { races: { some: { result: { isNot: null } } } }, orderBy: { date: "desc" }, select: { date: true } });
  console.log("sonuçlanmış yarış (DB):", sonuclu, "| ilk gün:", ilk?.date.toISOString().slice(0, 10), "| son gün:", son?.date.toISOString().slice(0, 10));
  const d18 = JSON.parse(fs.readFileSync("C:/tmp/saf18-model-egitim-verisi.json", "utf8")) as { tarih: string; raceId: string }[];
  const gun = d18.map((r) => r.tarih).sort();
  console.log("eğitim verisi yarışı:", d18.length, "| aralık:", gun[0], "→", gun[gun.length - 1]);
  const aylar = new Map<string, number>(); for (const r of d18) aylar.set(r.tarih.slice(0, 7), (aylar.get(r.tarih.slice(0, 7)) ?? 0) + 1);
  console.log("ay bazlı:", [...aylar].sort().map(([a, n]) => a + "=" + n).join(" "));
  const dbAy = await db.$queryRawUnsafe<{ ay: string; n: bigint }[]>(`select to_char(rd.date,'YYYY-MM') ay, count(*)::bigint n from "Race" r join "RaceResult" rr on rr."raceId"=r.id join "RaceDay" rd on rd.id=r."raceDayId" group by 1 order by 1`).catch((e) => { console.log("ham sorgu hata:", String(e).slice(0, 120)); return []; });
  console.log("DB ay bazlı sonuçlu yarış:", dbAy.map((x) => x.ay + "=" + x.n).join(" "));
  await db.$disconnect();
}
main();
