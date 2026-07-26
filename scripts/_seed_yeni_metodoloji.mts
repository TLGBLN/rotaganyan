import { db } from "@/lib/db";
import { readFileSync } from "fs";

const VERSION = "v6.6";
const content = readFileSync("scripts/_yeni_metodoloji.md", "utf8");

await db.methodologyVersion.updateMany({ where: { isCurrent: true, version: { not: VERSION } }, data: { isCurrent: false } });
// upsert: aynı versiyon numarası içinde (ör. bir tutarsızlık düzeltmesi) içerik
// güncellenmek istendiğinde version @unique kısıtına takılmasın diye create yerine.
const saved = await db.methodologyVersion.upsert({
  where: { version: VERSION },
  create: { version: VERSION, effectiveDate: new Date(), content, isCurrent: true },
  update: { content, isCurrent: true },
});
console.log("Metodoloji yazıldı:", saved.version, saved.content.length, "karakter");
process.exit(0);
