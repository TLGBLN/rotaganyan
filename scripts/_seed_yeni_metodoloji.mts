import { db } from "@/lib/db";
import { readFileSync } from "fs";

const content = readFileSync("scripts/_yeni_metodoloji.md", "utf8");

await db.methodologyVersion.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
const created = await db.methodologyVersion.create({
  data: {
    version: "v6.1",
    effectiveDate: new Date(),
    content,
    isCurrent: true,
  },
});
console.log("Yeni metodoloji yazıldı:", created.version, created.content.length, "karakter");
process.exit(0);
