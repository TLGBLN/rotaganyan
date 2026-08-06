import { db } from "../src/lib/db";

// Ham classType değerlerini çek, normalizasyon yapmadan
const all = await db.prediction.findMany({
  where: { published: true },
  select: {
    race: {
      select: {
        classType: true,
        conditions: true,
        result: { select: { hitTop1: true } },
      },
    },
  },
});

// Ham değerlere göre say
const rawMap = new Map<string, { total: number; withResult: number; conditionsSet: number }>();
for (const p of all) {
  const key = p.race.classType;
  const e = rawMap.get(key) ?? { total: 0, withResult: 0, conditionsSet: 0 };
  e.total++;
  if (p.race.conditions) e.conditionsSet++;
  if (p.race.result) e.withResult++;
  rawMap.set(key, e);
}

const sorted = [...rawMap.entries()].sort((a, b) => b[1].total - a[1].total);
console.log("\nHam classType          | Toplam | Sonuçlu | Conditions");
console.log("-----------------------+--------+---------+-----------");
for (const [key, v] of sorted) {
  console.log(
    key.padEnd(23) + "| " +
    String(v.total).padStart(6) + " | " +
    String(v.withResult).padStart(7) + " | " +
    String(v.conditionsSet)
  );
}

await db.$disconnect();
