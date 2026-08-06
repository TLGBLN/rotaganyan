import "dotenv/config";
import { db } from "../src/lib/db";
async function main() {
  const cur = await db.methodologyVersion.findFirst({ where: { isCurrent: true } });
  console.log("DB'deki güncel metodoloji versiyonu:", cur?.version, cur?.content.length, "karakter", cur?.effectiveDate.toISOString());
  const localVersion = (await import("fs")).readFileSync("scripts/_yeni_metodoloji.md", "utf8").match(/v6\.\d+/)?.[0];
  console.log("Diskteki _yeni_metodoloji.md başlığı:", localVersion);
  await db.$disconnect();
}
main();
