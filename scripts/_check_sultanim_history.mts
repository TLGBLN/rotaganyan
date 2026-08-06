import { db } from "@/lib/db";
import { fetchTjkAtKosuBilgileri } from "@/server/services/ingest/tjk-at-performans.adapter";

const runner = await db.runner.findUnique({
  where: { id: "cms0pbusq004404l7dzr936ks" },
  select: { tjkAtId: true, equipment: true },
});
console.log("bugünkü takı:", runner?.equipment);

const history = await fetchTjkAtKosuBilgileri(runner!.tjkAtId!);
const sorted = [...history].sort((a, b) => {
  const [da, ma, ya] = a.date.split(".").map(Number);
  const [db_, mb, yb] = b.date.split(".").map(Number);
  return new Date(yb, mb - 1, db_).getTime() - new Date(ya, ma - 1, da).getTime();
});
console.log("\nSon 6 yarış (yeni->eski): tarih | bitiş | takı | sınıf");
for (const row of sorted.slice(0, 6)) {
  console.log(`${row.date} | ${row.finishPos}. | ${row.equipment || "—"} | ${row.classType}`);
}
process.exit(0);
