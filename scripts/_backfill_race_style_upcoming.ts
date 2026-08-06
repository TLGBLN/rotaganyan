import { db } from "../src/lib/db";
import { Prisma } from "@prisma/client";

// Bkz. ingest/base.ts'teki kalıcı düzeltme notu — bu, henüz o düzeltme YOKKEN
// zaten oluşturulmuş (raceStyle=null kalmış) bugünkü/gelecekteki koşu satırlarını
// bir kereliğine düzeltir. At isminin en güncel bilinen (null olmayan) raceStyle'ını
// bulup null kalan satırlara yazar — geçmiş sonuçlanmış koşulara DOKUNMAZ.
async function main() {
  // Yalnız bugün ve sonrası (henüz sonuçlanmamış) koşular — geçmiş kayıtları
  // "gelecekte bilinen" bir stille geriye dönük değiştirmek win-stats gibi tarihsel
  // istatistikleri bozar, o yüzden bilerek dışarıda bırakılıyor.
  const nullRunners = await db.runner.findMany({
    where: { raceStyle: { equals: Prisma.DbNull }, race: { raceDay: { date: { gte: new Date(new Date().toISOString().slice(0, 10)) } } } },
    select: { id: true, name: true },
  });
  const names = [...new Set(nullRunners.map((r) => r.name))];
  console.log(`raceStyle=null olan ${nullRunners.length} satır, ${names.length} farklı at ismi.`);

  const knownStyleRows = await db.runner.findMany({
    where: { name: { in: names }, raceStyle: { not: Prisma.DbNull } },
    select: { name: true, raceStyle: true, race: { select: { raceDay: { select: { date: true } } } } },
    orderBy: { race: { raceDay: { date: "desc" } } },
  });
  const latestByName = new Map<string, Prisma.InputJsonValue>();
  for (const row of knownStyleRows) {
    if (!latestByName.has(row.name)) latestByName.set(row.name, row.raceStyle as Prisma.InputJsonValue);
  }
  console.log(`${latestByName.size} at için bilinen (geçmiş) raceStyle bulundu.`);

  let updated = 0;
  for (const r of nullRunners) {
    const style = latestByName.get(r.name);
    if (style == null) continue;
    await db.runner.update({ where: { id: r.id }, data: { raceStyle: style } });
    updated++;
  }
  console.log(`Güncellenen satır: ${updated} / ${nullRunners.length}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
