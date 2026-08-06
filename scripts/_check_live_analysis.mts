import "dotenv/config";
import { db } from "../src/lib/db";

async function main() {
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
  const recent = await db.claudeUsageLog.findMany({
    where: { createdAt: { gte: tenMinAgo } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  console.log("Son 10 dakikadaki ClaudeUsageLog kayıtları:", recent.length);
  recent.forEach((r) => console.log(r.createdAt.toISOString(), r.phase ?? "?", r.raceId ?? "?"));
  await db.$disconnect();
}
main();
